const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { ipKeyGenerator } = require('express-rate-limit');
const { getRedisClient } = require('../security/securityService');

function buildLimiter() {
  const client = getRedisClient();

  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ? `subject:${req.user.id}` : `ip:${ipKeyGenerator(req)}`,
    store: client
      ? new RedisStore({ sendCommand: (...args) => client.sendCommand(args), prefix: 'rl:docaccess:' })
      : undefined,
    message: { message: 'Too many document requests, please slow down.' }
  });
}

let cached;
module.exports = (req, res, next) => {
  if (!cached) cached = buildLimiter();
  return cached(req, res, next);
};
