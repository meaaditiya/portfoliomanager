const express = require('express');
const { PDFDocument } = require('pdf-lib');
const drive = require('../services/driveService');
const { Document } = require('../models/Document');
const DocumentAccessLog = require('../models/DocumentAccessLog');
const optionalAuthenticate = require('../middlewares/optionalAuthenticate');
const documentAccessLimiter = require('../middlewares/documentAccessLimiter');
const { requireTurnstile } = require('../utils/turnstileVerify');
const { issueGrant, redeemGrant } = require('../services/grantService');
const { canRead } = require('../policies/documentPolicy');
const { getWithAncestors, bumpLinkAccessCount } = require('../repositories/documentRepo');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function logAccess({ documentId, subjectId, via, grantId, bytesServed, outcome, ip }) {
  try {
    await DocumentAccessLog.create({ documentId, subjectId, via, grantId, bytesServed, outcome, ip });
  } catch (err) {
    /* logging never blocks delivery */
  }
}

function parseRangeHeader(rangeHeader, size) {
  if (!rangeHeader || !size) return null;
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) return null;
  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

// -- Call 1: ask for permission, receive a capability, never a location -----
router.get(
  '/api/documents/:id/access',
  optionalAuthenticate,
  documentAccessLimiter,
  requireTurnstile(),
  asyncHandler(async (req, res) => {
    const { key } = req.query;
    const { doc, ancestors } = await getWithAncestors(req.params.id);

    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.type !== 'file') return res.status(400).json({ message: 'Cannot access this item type' });

    const decision = canRead(req.user, ancestors, { linkId: key, now: new Date() });
    if (!decision.allow) {
      return res.status(403).json({
        message: `Access denied: ${decision.reason}`,
        details: decision.at,
        canRequestAccess: true
      });
    }

    if (key) await bumpLinkAccessCount(doc, key);

    const grant = await issueGrant({ subject: req.user, doc, via: decision.via, req });

    return res.json({
      grant,
      filename: doc.originalName || doc.name,
      mimeType: doc.mimeType,
      size: doc.size
    });
  })
);

// -- Call 2: spend the capability, bytes stream through the app -------------
router.get(
  '/api/documents/:id/content',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const grantToken = authHeader.startsWith('Grant ') ? authHeader.slice(6) : req.query.grant;

    let redeemed;
    try {
      redeemed = await redeemGrant(grantToken, req);
    } catch (err) {
      return res.status(err.statusCode || 401).json({ message: err.message });
    }

    if (redeemed.documentId !== req.params.id) {
      return res.status(400).json({ message: 'grant_document_mismatch' });
    }

    const doc = await Document.findById(redeemed.documentId);
    if (!doc || doc.type !== 'file' || !doc.driveFileId) {
      return res.status(404).json({ message: 'Source file unavailable' });
    }

    const range = parseRangeHeader(req.headers.range, doc.size);

    let source;
    try {
      source = await drive.getFileStream(doc.driveFileId, range);
    } catch (err) {
      return res.status(err.statusCode || 502).json({ message: 'Could not read source file' });
    }

    const isPartial = range && (source.status === 206 || source.headers['content-range']);
    res.status(isPartial ? 206 : 200);
    res.set('Content-Type', doc.mimeType || 'application/octet-stream');
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Accept-Ranges', 'bytes');
    res.set(
      'Content-Disposition',
      `${req.query.inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(doc.originalName || doc.name)}"`
    );
    if (source.headers['content-length']) res.set('Content-Length', source.headers['content-length']);
    if (isPartial && range) res.set('Content-Range', `bytes ${range.start}-${range.end}/${doc.size}`);

    let bytesServed = 0;
    source.stream.on('data', (chunk) => { bytesServed += chunk.length; });

    req.on('aborted', () => {
      source.stream.destroy();
      logAccess({
        documentId: doc._id, subjectId: redeemed.subjectId, via: redeemed.via,
        grantId: redeemed.jti, bytesServed, outcome: 'aborted', ip: req.ip
      });
    });

    const { pipeline } = require('stream/promises');
    try {
      await pipeline(source.stream, res);
      await logAccess({
        documentId: doc._id, subjectId: redeemed.subjectId, via: redeemed.via,
        grantId: redeemed.jti, bytesServed, outcome: 'complete', ip: req.ip
      });
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ message: 'Stream failed' });
      }
      await logAccess({
        documentId: doc._id, subjectId: redeemed.subjectId, via: redeemed.via,
        grantId: redeemed.jti, bytesServed, outcome: 'aborted', ip: req.ip
      });
    }
  })
);

// -- Preview: server builds a trimmed copy and streams bytes directly -------
async function buildPreviewPdf(fileBuffer, pageCount) {
  const srcDoc = await PDFDocument.load(fileBuffer);
  const n = Math.min(pageCount, srcDoc.getPageCount());
  const previewDoc = await PDFDocument.create();
  const copiedPages = await previewDoc.copyPages(srcDoc, [...Array(n).keys()]);
  copiedPages.forEach((p) => previewDoc.addPage(p));
  const bytes = await previewDoc.save();
  return Buffer.from(bytes);
}

router.get(
  '/api/documents/:id/preview',
  optionalAuthenticate,
  documentAccessLimiter,
  asyncHandler(async (req, res) => {
    const { key } = req.query;
    const { doc, ancestors } = await getWithAncestors(req.params.id);

    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.type !== 'file' || !doc.mimeType?.includes('pdf')) {
      return res.status(400).json({ message: 'Preview not supported for this file type' });
    }
    if (!doc.previewEnabled) {
      return res.status(403).json({ message: 'Preview not enabled for this document' });
    }

    const decision = canRead(req.user, ancestors, { linkId: key, now: new Date() });
    if (!decision.allow) {
      return res.status(403).json({ message: `Access denied: ${decision.reason}`, details: decision.at });
    }
    if (!doc.driveFileId) {
      return res.status(400).json({ message: 'Preview source unavailable' });
    }

    const source = await drive.getFileStream(doc.driveFileId, null);
    const chunks = [];
    for await (const chunk of source.stream) chunks.push(chunk);
    const originalBuffer = Buffer.concat(chunks);

    const previewBuffer = await buildPreviewPdf(originalBuffer, doc.previewPageCount || 2);
    originalBuffer.fill(0);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="preview.pdf"');
    res.set('Cache-Control', 'no-store');

    await logAccess({
      documentId: doc._id, subjectId: req.user?.id || null, via: 'preview',
      grantId: null, bytesServed: previewBuffer.length, outcome: 'complete', ip: req.ip
    });

    return res.send(previewBuffer);
  })
);

module.exports = router;
