const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../security/securityService');

const GRANT_SECRET = process.env.FILE_GRANT_SECRET || process.env.JWT_SECRET || 'your_jwt_secret';
const GRANT_TTL_SECONDS = 120;
const ISSUER = 'docs-api';
const AUDIENCE = 'file-read';

const memoryGrants = new Map();
const memoryRevocations = new Map();

function fingerprint(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 16);
}

async function storeGrant(jti, payload) {
  const client = getRedisClient();
  const serialized = JSON.stringify(payload);
  if (client) {
    await client.set(`grant:${jti}`, serialized, { NX: true, EX: GRANT_TTL_SECONDS });
    return;
  }
  memoryGrants.set(jti, { payload: serialized, expires: Date.now() + GRANT_TTL_SECONDS * 1000 });
}

async function takeGrant(jti) {
  const client = getRedisClient();
  if (client) {
    const raw = await client.get(`grant:${jti}`);
    if (raw) await client.del(`grant:${jti}`);
    return raw ? JSON.parse(raw) : null;
  }
  const entry = memoryGrants.get(jti);
  memoryGrants.delete(jti);
  if (!entry) return null;
  if (entry.expires < Date.now()) return null;
  return JSON.parse(entry.payload);
}

async function isSubjectRevoked(subjectId) {
  if (!subjectId) return false;
  const client = getRedisClient();
  if (client) {
    const val = await client.get(`revoke:subject:${subjectId}`);
    return !!val;
  }
  const expiry = memoryRevocations.get(subjectId);
  return !!expiry && expiry > Date.now();
}

async function revokeSubject(subjectId, seconds = 300) {
  const client = getRedisClient();
  if (client) {
    await client.set(`revoke:subject:${subjectId}`, '1', { EX: seconds });
    return;
  }
  memoryRevocations.set(subjectId, Date.now() + seconds * 1000);
}

/**
 * Mint a short-lived, single-use, client-bound capability for one document.
 * The client receives this token; it never receives a storage location.
 */
async function issueGrant({ subject, doc, via, req }) {
  const jti = crypto.randomUUID();
  const bind = fingerprint(req);
  const subjectId = subject?.id || 'anon';

  await storeGrant(jti, { sub: subjectId, doc: String(doc._id), via, bind });

  const token = jwt.sign(
    { sub: subjectId, doc: String(doc._id), jti, via },
    GRANT_SECRET,
    { expiresIn: `${GRANT_TTL_SECONDS}s`, audience: AUDIENCE, issuer: ISSUER }
  );

  return token;
}

/**
 * Verify + burn a grant token. Throws a DomainError-shaped object with
 * statusCode on any failure so the controller can map it straight to a response.
 */
async function redeemGrant(token, req) {
  if (!token) {
    const err = new Error('missing_grant');
    err.statusCode = 401;
    throw err;
  }

  let claims;
  try {
    claims = jwt.verify(token, GRANT_SECRET, { audience: AUDIENCE, issuer: ISSUER });
  } catch (e) {
    const err = new Error('invalid_or_expired_grant');
    err.statusCode = 401;
    throw err;
  }

  const bind = fingerprint(req);
  const stored = await takeGrant(claims.jti);

  if (!stored) {
    const err = new Error('grant_already_used_or_expired');
    err.statusCode = 401;
    throw err;
  }

  if (stored.bind !== bind) {
    const err = new Error('grant_not_bound_to_this_client');
    err.statusCode = 401;
    throw err;
  }

  if (await isSubjectRevoked(stored.sub)) {
    const err = new Error('access_revoked');
    err.statusCode = 401;
    throw err;
  }

  return { subjectId: stored.sub, documentId: stored.doc, via: stored.via, jti: claims.jti };
}

module.exports = { issueGrant, redeemGrant, revokeSubject, isSubjectRevoked };
