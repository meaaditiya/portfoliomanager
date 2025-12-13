const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const winston = require('winston');
const morgan = require('morgan');

const config = {
  // Standard rate limits for regular routes
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200, // 200 requests per 15 min
  },
  burstLimit: {
    windowMs: parseInt(process.env.BURST_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
    max: parseInt(process.env.BURST_LIMIT_MAX_REQUESTS) || 40, // 40 requests per minute
  },
  // Lenient limits for high-traffic public routes
  lenientRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 600, // 600 requests per 15 min (reasonable for browsing)
  },
  lenientBurstLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute (still reasonable)
  },
  maxUrlLength: 4000,
  suspicionThreshold: 50,
  enableRedis: !!process.env.REDIS_URL,
  
  // High-traffic routes with lenient limits
  lenientPaths: [
    '/api/blogs',
    '/api/image-posts',
    '/api/gallery',
    '/api/projects',
    '/api/visitors',
    '/api/comments',
    '/api/reactions',
    '/api/folder/contents',
    '/api/folder/tree',
    '/api/item/',
    '/api/user/bookmark',
    '/api/user/bookmarks',
    '/api/search',
    '/health',
    '/socket.io',
    '/public',
  ],
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/security.log', level: 'warn' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

const blockedIPs = new Map();
const suspicionScores = new Map();
const honeypotHits = new Set();
const requestTimestamps = new Map();

let standardRateLimiter = null;
let lenientRateLimiter = null;
let standardBurstLimiter = null;
let lenientBurstLimiter = null;
let cleanupInterval = null;

if (process.env.NODE_ENV !== 'test') {
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    
    for (const [ip, data] of blockedIPs.entries()) {
      if (data.blockedUntil < now) {
        blockedIPs.delete(ip);
        logger.info(`IP unblocked: ${ip}`);
      }
    }
    
    for (const [ip, data] of suspicionScores.entries()) {
      if (now - data.lastUpdate > 3600000) {
        suspicionScores.delete(ip);
      }
    }
    
    for (const [ip, timestamps] of requestTimestamps.entries()) {
      const recent = timestamps.filter(ts => now - ts < 60000);
      if (recent.length === 0) {
        requestTimestamps.delete(ip);
      } else {
        requestTimestamps.set(ip, recent);
      }
    }
  }, 300000);
}

let redisClient = null;
let RedisStore = null;

if (config.enableRedis) {
  try {
    const redis = require('redis');
    const RedisStoreLib = require('rate-limit-redis');
    
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error', err);
    });

    redisClient.connect().then(() => {
      logger.info('Redis connected successfully');
      RedisStore = RedisStoreLib;
    }).catch(err => {
      logger.error('Redis connection failed', err);
      redisClient = null;
    });
  } catch (err) {
    logger.warn('Redis not available, using in-memory storage', err);
  }
}

function getClientIP(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
  
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  return ip;
}

function isLenientPath(path) {
  return config.lenientPaths.some(lenient => 
    path.startsWith(lenient)
  );
}

function addSuspicionScore(ip, points, reason) {
  if (process.env.NODE_ENV === 'test' && (ip === '127.0.0.1' || ip === 'localhost')) {
    return;
  }
  
  const current = suspicionScores.get(ip) || { score: 0, lastUpdate: Date.now(), reasons: [] };
  current.score += points;
  current.lastUpdate = Date.now();
  current.reasons.push({ reason, points, timestamp: Date.now() });
  
  if (current.reasons.length > 10) {
    current.reasons = current.reasons.slice(-10);
  }
  
  suspicionScores.set(ip, current);
  
  logger.warn(`Suspicion added to ${ip}: +${points} (${reason}), total: ${current.score}`);
  
  if (current.score >= config.suspicionThreshold) {
    blockIP(ip, 600000, `Suspicion threshold exceeded: ${current.score} points - ${reason}`);
  }
}

function blockIP(ip, duration, reason) {
  if (process.env.NODE_ENV === 'test' && (ip === '127.0.0.1' || ip === 'localhost')) {
    return;
  }
  
  const blockedUntil = Date.now() + duration;
  blockedIPs.set(ip, { blockedUntil, reason });
  logger.error(`IP BLOCKED: ${ip} for ${Math.floor(duration/1000)}s - ${reason}`);
  
  if (redisClient) {
    redisClient.setEx(`blocked:${ip}`, Math.floor(duration / 1000), reason)
      .catch(err => logger.error('Redis block storage failed', err));
  }
}

async function isIPBlocked(ip) {
  if (process.env.NODE_ENV === 'test' && (ip === '127.0.0.1' || ip === 'localhost')) {
    return { blocked: false };
  }
  
  const blocked = blockedIPs.get(ip);
  if (blocked && blocked.blockedUntil > Date.now()) {
    return { blocked: true, reason: blocked.reason };
  }
  
  if (redisClient) {
    try {
      const reason = await redisClient.get(`blocked:${ip}`);
      if (reason) {
        return { blocked: true, reason };
      }
    } catch (err) {
      logger.error('Redis block check failed', err);
    }
  }
  
  return { blocked: false };
}

const ATTACK_PATTERNS = {
  sqli: [
    /union\s+select/i,
    /;\s*drop\s+table/i,
    /;\s*delete\s+from/i,
    /exec\s*\(/i,
    /'\s*or\s+'1'\s*=\s*'1/i,
    /'\s*or\s+1\s*=\s*1/i,
    /--\s*$/,
    /\/\*.*\*\//,
    /benchmark\s*\(/i,
    /sleep\s*\(/i,
    /waitfor\s+delay/i,
  ],
  nosqli: [
    /\{\s*['"]\$where['"]\s*:/i,
    /\{\s*['"]\$ne['"]\s*:\s*null\s*\}/i,
    /\{\s*['"]\$gt['"]\s*:\s*["']\s*["']\s*\}/i,
  ],
  xss: [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<iframe[^>]*src=/gi,
    /javascript:\s*alert\s*\(/gi,
    /onerror\s*=\s*["'][^"']*["']/gi,
    /onclick\s*=\s*["'][^"']*["']/gi,
    /<embed[^>]*>/gi,
    /eval\s*\(\s*["'][^"']*["']\s*\)/gi,
  ],
  pathTraversal: [
    /\.\.[\/\\]{2,}/g,
    /[\/\\]\.\.([\/\\]\.\.)+/g,
    /%2e%2e[\/\\]/gi,
    /\/etc\/passwd/i,
    /\/proc\/self/i,
    /c:[\\\/]windows[\\\/]system32/i,
  ],
};

function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", 'https:', 'blob:'],
        frameSrc: ["'self'", 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xssFilter: false,
    hidePoweredBy: true,
  });
}

function morganMiddleware() {
  const stream = {
    write: (message) => logger.http(message.trim())
  };
  
  return morgan(
    ':remote-addr :method :url :status :res[content-length] - :response-time ms',
    { stream, skip: () => process.env.NODE_ENV === 'test' }
  );
}

function ipBlockerMiddleware() {
  return async (req, res, next) => {
    const ip = getClientIP(req);
    const blockStatus = await isIPBlocked(ip);
    
    if (blockStatus.blocked) {
      logger.warn(`Blocked request from ${ip}: ${blockStatus.reason}`);
      return res.status(403).json({
        error: 'Access forbidden',
        message: 'Your IP has been temporarily blocked due to suspicious activity. Please try again later.',
      });
    }
    
    next();
  };
}

// Standard rate limiter for regular routes
function createStandardRateLimiter() {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient && RedisStore && process.env.NODE_ENV !== 'test'
      ? new RedisStore({
          client: redisClient,
          prefix: 'rl:standard:',
        })
      : undefined,
    handler: (req, res) => {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 5, `Rate limit exceeded on ${req.path}`);
      logger.warn(`Standard rate limit exceeded for ${ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please slow down. Limit: ${config.rateLimit.max} requests per 15 minutes.`,
      });
    },
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
  });
}

// Lenient rate limiter for high-traffic routes
function createLenientRateLimiter() {
  return rateLimit({
    windowMs: config.lenientRateLimit.windowMs,
    max: config.lenientRateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient && RedisStore && process.env.NODE_ENV !== 'test'
      ? new RedisStore({
          client: redisClient,
          prefix: 'rl:lenient:',
        })
      : undefined,
    handler: (req, res) => {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 3, `Lenient rate limit exceeded on ${req.path}`);
      logger.warn(`Lenient rate limit exceeded for ${ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too many requests',
        message: `You're browsing too fast. Please slow down. Limit: ${config.lenientRateLimit.max} requests per 15 minutes.`,
      });
    },
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
  });
}

// Standard burst limiter
function createStandardBurstLimiter() {
  return rateLimit({
    windowMs: config.burstLimit.windowMs,
    max: config.burstLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient && RedisStore && process.env.NODE_ENV !== 'test'
      ? new RedisStore({
          client: redisClient,
          prefix: 'bl:standard:',
        })
      : undefined,
    handler: (req, res) => {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 8, `Burst limit exceeded on ${req.path}`);
      logger.warn(`Standard burst limit exceeded for ${ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too many requests',
        message: `Burst limit exceeded. Please wait a moment. Limit: ${config.burstLimit.max} requests per minute.`,
      });
    },
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
  });
}

// Lenient burst limiter
function createLenientBurstLimiter() {
  return rateLimit({
    windowMs: config.lenientBurstLimit.windowMs,
    max: config.lenientBurstLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient && RedisStore && process.env.NODE_ENV !== 'test'
      ? new RedisStore({
          client: redisClient,
          prefix: 'bl:lenient:',
        })
      : undefined,
    handler: (req, res) => {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 5, `Lenient burst limit exceeded on ${req.path}`);
      logger.warn(`Lenient burst limit exceeded for ${ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too many requests',
        message: `You're clicking too fast. Please slow down. Limit: ${config.lenientBurstLimit.max} requests per minute.`,
      });
    },
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
  });
}

// Smart rate limiter middleware that chooses the right limiter
function smartRateLimiterMiddleware() {
  return (req, res, next) => {
    const isLenient = isLenientPath(req.path);
    const limiter = isLenient ? lenientRateLimiter : standardRateLimiter;
    limiter(req, res, next);
  };
}

// Smart burst limiter middleware
function smartBurstLimiterMiddleware() {
  return (req, res, next) => {
    const isLenient = isLenientPath(req.path);
    const limiter = isLenient ? lenientBurstLimiter : standardBurstLimiter;
    limiter(req, res, next);
  };
}

function slowDownMiddleware() {
  return slowDown({
    windowMs: 60 * 1000,
    delayAfter: 30, // Start slowing down after 30 requests per minute
    delayMs: (used) => (used - 30) * 200, // Gradual delay increase
    maxDelayMs: 10000, // Max 10 second delay
    skip: (req) => {
      return process.env.NODE_ENV === 'test';
    }
  });
}

function urlLengthMiddleware() {
  return (req, res, next) => {
    const urlLength = req.url.length;
    
    if (urlLength > config.maxUrlLength) {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 10, `Excessive URL length: ${urlLength}`);
      logger.warn(`URL too long from ${ip}: ${urlLength} chars`);
      return res.status(414).json({
        error: 'URI Too Long',
        message: 'Request URL exceeds maximum allowed length',
      });
    }
    
    next();
  };
}

function suspiciousPayloadMiddleware() {
  return (req, res, next) => {
    const ip = getClientIP(req);
    let suspicionPoints = 0;
    const violations = [];
    
    const scanData = JSON.stringify({
      query: req.query,
      params: req.params,
      body: req.body,
    });
    
    let sqlMatches = 0;
    for (const pattern of ATTACK_PATTERNS.sqli) {
      if (pattern.test(scanData)) {
        sqlMatches++;
      }
    }
    if (sqlMatches >= 2) {
      suspicionPoints += 15;
      violations.push('SQL Injection attempt detected');
    }
    
    for (const pattern of ATTACK_PATTERNS.nosqli) {
      if (pattern.test(scanData)) {
        suspicionPoints += 15;
        violations.push('NoSQL Injection attempt detected');
        break;
      }
    }
    
    let xssMatches = 0;
    for (const pattern of ATTACK_PATTERNS.xss) {
      if (pattern.test(scanData)) {
        xssMatches++;
      }
    }
    if (xssMatches >= 1) {
      suspicionPoints += 12;
      violations.push('XSS attempt detected');
    }
    
    for (const pattern of ATTACK_PATTERNS.pathTraversal) {
      if (pattern.test(scanData)) {
        suspicionPoints += 15;
        violations.push('Path traversal attempt detected');
        break;
      }
    }
    
    if (suspicionPoints > 0) {
      addSuspicionScore(ip, suspicionPoints, violations.join(', '));
      logger.error(`Malicious payload detected from ${ip}:`, violations);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request contains suspicious patterns',
      });
    }
    
    next();
  };
}

function sanitizerMiddleware() {
  return (req, res, next) => {
    if (req.query) {
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = req.query[key].trim();
        }
      }
    }
    
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          req.body[key] = req.body[key].trim();
        }
      }
    }
    
    next();
  };
}

function userAgentMiddleware() {
  const suspiciousAgents = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /metasploit/i,
    /burp.*intruder/i,
    /havij/i,
    /acunetix/i,
    /w3af/i,
    /paros/i,
  ];
  
  return (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const ip = getClientIP(req);
    
    if (!userAgent && process.env.NODE_ENV !== 'test' && !isLenientPath(req.path)) {
      addSuspicionScore(ip, 1, 'Missing User-Agent header');
    }
    
    for (const pattern of suspiciousAgents) {
      if (pattern.test(userAgent)) {
        addSuspicionScore(ip, 20, `Attack tool detected: ${userAgent}`);
        logger.error(`Attack tool detected from ${ip}: ${userAgent}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }
    }
    
    next();
  };
}

function forbiddenMethodsMiddleware() {
  const forbiddenMethods = ['TRACE', 'TRACK', 'DEBUG', 'CONNECT'];
  
  return (req, res, next) => {
    if (forbiddenMethods.includes(req.method.toUpperCase())) {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 8, `Forbidden method: ${req.method}`);
      logger.warn(`Forbidden method ${req.method} from ${ip}`);
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `${req.method} method is not permitted`,
      });
    }
    
    next();
  };
}

function honeypotMiddleware(app) {
  const honeypotPaths = [
    '/phpmyadmin',
    '/wp-admin',
    '/wp-login.php',
    '/.env',
    '/.git/config',
    '/config.php',
    '/backup.sql',
    '/.aws/credentials',
    '/phpinfo.php',
  ];
  
  honeypotPaths.forEach(path => {
    app.all(path, (req, res) => {
      const ip = getClientIP(req);
      honeypotHits.add(ip);
      blockIP(ip, 86400000, `Honeypot triggered: ${path}`);
      logger.error(`HONEYPOT HIT from ${ip} on ${path}`);
      res.status(404).json({ error: 'Not Found' });
    });
  });
  
  return (req, res, next) => next();
}

function anomalyDetectionMiddleware() {
  return (req, res, next) => {
    const ip = getClientIP(req);
    const now = Date.now();
    const path = req.path;
    
    if (!requestTimestamps.has(ip)) {
      requestTimestamps.set(ip, []);
    }
    
    const timestamps = requestTimestamps.get(ip);
    const recentTimestamps = timestamps.filter(ts => now - ts < 10000);
    recentTimestamps.push(now);
    requestTimestamps.set(ip, recentTimestamps);
    
    // Different thresholds for different route types
    const threshold = isLenientPath(path) ? 150 : 40;
    
    if (recentTimestamps.length > threshold && process.env.NODE_ENV !== 'test') {
      const points = isLenientPath(path) ? 5 : 8;
      addSuspicionScore(ip, points, `Excessive request rate: ${recentTimestamps.length} in 10s on ${path}`);
      logger.warn(`Anomaly: Excessive requests from ${ip} (${recentTimestamps.length} in 10s) on ${path}`);
    }
    
    next();
  };
}

function clearSecurityState() {
  blockedIPs.clear();
  suspicionScores.clear();
  honeypotHits.clear();
  requestTimestamps.clear();
}

function cleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  clearSecurityState();
}

module.exports = function(app) {
  logger.info('Initializing Security Service...');
  
  app.set('trust proxy', true);
  
  // Initialize all rate limiters
  standardRateLimiter = createStandardRateLimiter();
  lenientRateLimiter = createLenientRateLimiter();
  standardBurstLimiter = createStandardBurstLimiter();
  lenientBurstLimiter = createLenientBurstLimiter();
  
  const middlewares = [
    helmetMiddleware(),
    morganMiddleware(),
    ipBlockerMiddleware(),
    forbiddenMethodsMiddleware(),
    urlLengthMiddleware(),
    userAgentMiddleware(),
    smartRateLimiterMiddleware(),
    smartBurstLimiterMiddleware(),
    slowDownMiddleware(),
    anomalyDetectionMiddleware(),
    suspiciousPayloadMiddleware(),
    sanitizerMiddleware(),
  ];
  
  honeypotMiddleware(app);
  
  logger.info('Security Service initialized');
  logger.info(`Standard rate limit: ${config.rateLimit.max} req/15min, ${config.burstLimit.max} req/min`);
  logger.info(`Lenient rate limit: ${config.lenientRateLimit.max} req/15min, ${config.lenientBurstLimit.max} req/min`);
  logger.info(`Suspicion threshold: ${config.suspicionThreshold} points`);
  logger.info(`Lenient paths: ${config.lenientPaths.length} routes`);
  
  return middlewares;
};

module.exports.closeLogger = function() {
  cleanup();
  logger.close();
};

module.exports.clearSecurityState = clearSecurityState;
module.exports.cleanup = cleanup;
module.exports.getClientIP = getClientIP;
module.exports.addSuspicionScore = addSuspicionScore;
module.exports.blockIP = blockIP;
module.exports.isIPBlocked = isIPBlocked;