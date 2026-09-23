const Document = require('../models/Document');
const { getRedisClient } = require('../security/securityService');

const ANCESTOR_CACHE_TTL_SECONDS = 30;
const memoryCache = new Map();

async function readAncestorCache(docId) {
  const client = getRedisClient();
  const key = `doc:ancestors:${docId}`;
  if (client) {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  const entry = memoryCache.get(key);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.value;
}

async function writeAncestorCache(docId, chain) {
  const client = getRedisClient();
  const key = `doc:ancestors:${docId}`;
  const serialized = JSON.stringify(chain);
  if (client) {
    await client.set(key, serialized, { EX: ANCESTOR_CACHE_TTL_SECONDS });
    return;
  }
  memoryCache.set(key, { value: JSON.parse(serialized), expires: Date.now() + ANCESTOR_CACHE_TTL_SECONDS * 1000 });
}

function slimAncestor(doc) {
  return {
    _id: String(doc._id),
    name: doc.name,
    accessLevel: doc.accessLevel,
    privateAccessLinks: (doc.privateAccessLinks || []).map((l) => ({
      linkId: l.linkId,
      isActive: l.isActive,
      expiresAt: l.expiresAt,
      maxAccessCount: l.maxAccessCount,
      accessCount: l.accessCount
    })),
    grantedUsers: (doc.grantedUsers || []).map((g) => ({ userId: String(g.userId) }))
  };
}

/**
 * Returns { doc, ancestors } where ancestors is root -> leaf and includes
 * the document itself as the last element. This is the only place in the
 * codebase that walks the parent chain, and the only place that needs to
 * change if the storage layout ever moves to a materialised path.
 */
async function getWithAncestors(documentId) {
  const doc = await Document.findById(documentId);
  if (!doc) return { doc: null, ancestors: [] };

  const cached = await readAncestorCache(String(documentId));
  if (cached) {
    return { doc, ancestors: cached };
  }

  const chain = [];
  let current = doc;
  while (current) {
    chain.unshift(slimAncestor(current));
    if (current.parent) {
      current = await Document.findById(current.parent).select(
        'name accessLevel privateAccessLinks grantedUsers parent'
      );
    } else {
      current = null;
    }
  }

  await writeAncestorCache(String(documentId), chain);
  return { doc, ancestors: chain };
}

async function invalidateAncestorCache(documentId) {
  const client = getRedisClient();
  const key = `doc:ancestors:${documentId}`;
  if (client) {
    await client.del(key);
    return;
  }
  memoryCache.delete(key);
}

async function bumpLinkAccessCount(doc, linkId) {
  if (!linkId) return;
  const link = doc.privateAccessLinks.find((l) => l.linkId === linkId);
  if (link && link.isActive) {
    link.accessCount += 1;
    await doc.save();
    await invalidateAncestorCache(String(doc._id));
  }
}

module.exports = { getWithAncestors, invalidateAncestorCache, bumpLinkAccessCount };
