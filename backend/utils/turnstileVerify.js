const crypto = require('crypto');
const { getRedisClient } = require('../security/securityService');

const VERIFIED_TTL_SECONDS = 600;
const memoryCache = new Map();

function fingerprint(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 24);
}

async function readCache(key) {
  const client = getRedisClient();
  if (client) {
    try {
      const val = await client.get(key);
      return !!val;
    } catch (err) {
      return false;
    }
  }
  const expiry = memoryCache.get(key);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    memoryCache.delete(key);
    return false;
  }
  return true;
}

async function writeCache(key) {
  const client = getRedisClient();
  if (client) {
    try {
      await client.set(key, '1', { EX: VERIFIED_TTL_SECONDS });
      return;
    } catch (err) {
      /* fall through to memory cache */
    }
  }
  memoryCache.set(key, Date.now() + VERIFIED_TTL_SECONDS * 1000);
}

async function verifyWithCloudflare(token) {
  const params = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: token
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns true if this caller already solved a challenge recently, or if the
 * supplied token verifies now (and caches that success for VERIFIED_TTL_SECONDS
 * so a single solve covers several file requests instead of one per file).
 */
async function checkTurnstile(req) {
  const key = `turnstile:ok:${fingerprint(req)}`;

  if (await readCache(key)) {
    return { ok: true, cached: true };
  }

  const token = req.headers['x-turnstile-token'] || req.body?.turnstileToken || req.query?.turnstileToken;
  if (!token) {
    return { ok: false, cached: false };
  }

  const valid = await verifyWithCloudflare(token);
  if (valid) {
    await writeCache(key);
  }
  return { ok: valid, cached: false };
}

/** Express middleware form — skips entirely for admin/premium subjects. */
function requireTurnstile() {
  return async (req, res, next) => {
    const isAdmin = req.user?.isAdmin || false;
    const isPremium = req.user?.isPremium || false;
    if (isAdmin || isPremium) return next();

    const result = await checkTurnstile(req);
    if (!result.ok) {
      return res.status(403).json({
        message: 'Turnstile verification required',
        requiresTurnstile: true
      });
    }
    next();
  };
}

module.exports = { checkTurnstile, requireTurnstile, verifyWithCloudflare };
