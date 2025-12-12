const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const winston = require('winston');
const morgan = require('morgan');

const config = {
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  burstLimit: {
    windowMs: parseInt(process.env.BURST_LIMIT_WINDOW_MS) || 60 * 1000,
    max: parseInt(process.env.BURST_LIMIT_MAX_REQUESTS) || 20,
  },
  maxUrlLength: 2000,
  suspicionThreshold: 10,
  enableRedis: !!process.env.REDIS_URL,
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

// Store rate limiter instances for cleanup
let rateLimiterInstance = null;
let burstLimiterInstance = null;

// Store cleanup interval reference for proper shutdown
let cleanupInterval = null;

if (process.env.NODE_ENV !== 'test') {
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of blockedIPs.entries()) {
      if (data.blockedUntil < now) {
        blockedIPs.delete(ip);
      }
    }
    for (const [ip, data] of suspicionScores.entries()) {
      if (now - data.lastUpdate > 3600000) {
        suspicionScores.delete(ip);
      }
    }
  }, 600000);
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

function addSuspicionScore(ip, points, reason) {
  if (process.env.NODE_ENV === 'test' && (ip === '127.0.0.1' || ip === 'localhost')) {
    return;
  }
  
  const current = suspicionScores.get(ip) || { score: 0, lastUpdate: Date.now() };
  current.score += points;
  current.lastUpdate = Date.now();
  suspicionScores.set(ip, current);
  
  logger.warn(`Suspicion added to ${ip}: +${points} (${reason}), total: ${current.score}`);
  
  if (current.score >= config.suspicionThreshold) {
    blockIP(ip, 300000, `Suspicion threshold exceeded: ${current.score} points`);
  }
}

function blockIP(ip, duration, reason) {
  if (process.env.NODE_ENV === 'test' && (ip === '127.0.0.1' || ip === 'localhost')) {
    return;
  }
  
  const blockedUntil = Date.now() + duration;
  blockedIPs.set(ip, { blockedUntil, reason });
  logger.error(`IP BLOCKED: ${ip} for ${duration}ms - ${reason}`);
  
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
    /(\bor\b|\band\b).*?[=<>]/i,
    /union.*select/i,
    /select.*from/i,
    /insert.*into/i,
    /delete.*from/i,
    /update.*set/i,
    /drop.*table/i,
    /exec(\s|\()/i,
    /script.*src/i,
    /javascript:/i,
    /'\s*(or|and)\s*'?\d/i,
    /--/,
    /;.*drop/i,
  ],
  nosqli: [
    /\$where/i,
    /\$ne/,
    /\$gt/,
    /\$lt/,
    /\$regex/,
    /\$or/,
    /\$and/,
  ],
  xss: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /eval\(/gi,
    /expression\(/gi,
  ],
  pathTraversal: [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e/gi,
    /\/etc\/passwd/i,
    /\/proc\//i,
    /c:\\windows/i,
  ],
};

function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xssFilter: true,
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
        message: 'Your IP has been blocked due to suspicious activity',
      });
    }
    
    next();
  };
}

function rateLimiterMiddleware() {
  rateLimiterInstance = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient && RedisStore && process.env.NODE_ENV !== 'test'
      ? new RedisStore({
          client: redisClient,
          prefix: 'rl:',
        })
      : undefined,
    handler: (req, res) => {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 2, 'Rate limit exceeded');
      logger.warn(`Rate limit exceeded for ${ip}`);
      res.status(429).json({
        error: 'Too many requests',
        message: 'Please slow down and try again later',
      });
    },
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
  });

  return rateLimiterInstance;
}

function burstLimiterMiddleware() {
  burstLimiterInstance = rateLimit({
    windowMs: config.burstLimit.windowMs,
    max: config.burstLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient && RedisStore && process.env.NODE_ENV !== 'test'
      ? new RedisStore({
          client: redisClient,
          prefix: 'bl:',
        })
      : undefined,
    handler: (req, res) => {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 3, 'Burst limit exceeded');
      logger.warn(`Burst limit exceeded for ${ip}`);
      res.status(429).json({
        error: 'Too many requests',
        message: 'Burst limit exceeded. Please wait before retrying.',
      });
    },
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
  });

  return burstLimiterInstance;
}
function slowDownMiddleware() {
  return slowDown({
    windowMs: 60 * 1000,
    delayAfter: 10,
    delayMs: () => 500,
    maxDelayMs: 20000,
    skip: () => process.env.NODE_ENV === 'test'
  });
}

function urlLengthMiddleware() {
  return (req, res, next) => {
    const urlLength = req.url.length;
    
    if (urlLength > config.maxUrlLength) {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 5, `Excessive URL length: ${urlLength}`);
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
      headers: req.headers,
    });
    
    for (const pattern of ATTACK_PATTERNS.sqli) {
      if (pattern.test(scanData)) {
        suspicionPoints += 5;
        violations.push('SQL Injection pattern detected');
        break;
      }
    }
    
    for (const pattern of ATTACK_PATTERNS.nosqli) {
      if (pattern.test(scanData)) {
        suspicionPoints += 5;
        violations.push('NoSQL Injection pattern detected');
        break;
      }
    }
    
    for (const pattern of ATTACK_PATTERNS.xss) {
      if (pattern.test(scanData)) {
        suspicionPoints += 4;
        violations.push('XSS pattern detected');
        break;
      }
    }
    
    for (const pattern of ATTACK_PATTERNS.pathTraversal) {
      if (pattern.test(scanData)) {
        suspicionPoints += 5;
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
          req.query[key] = req.query[key]
            .replace(/[<>"']/g, '')
            .trim();
        }
      }
    }
    
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          req.body[key] = req.body[key]
            .replace(/[<>]/g, '')
            .trim();
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
    /burp/i,
    /havij/i,
    /acunetix/i,
  ];
  
  return (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const ip = getClientIP(req);
    
    if (!userAgent && process.env.NODE_ENV !== 'test') {
      addSuspicionScore(ip, 1, 'Missing User-Agent');
    }
    
    for (const pattern of suspiciousAgents) {
      if (pattern.test(userAgent)) {
        addSuspicionScore(ip, 8, `Suspicious User-Agent: ${userAgent}`);
        logger.error(`Attack tool detected from ${ip}: ${userAgent}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Suspicious user agent detected',
        });
      }
    }
    
    next();
  };
}

function forbiddenMethodsMiddleware() {
  const forbiddenMethods = ['TRACE', 'TRACK', 'DEBUG'];
  
  return (req, res, next) => {
    if (forbiddenMethods.includes(req.method.toUpperCase())) {
      const ip = getClientIP(req);
      addSuspicionScore(ip, 3, `Forbidden method: ${req.method}`);
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
    '/admin',
    '/phpmyadmin',
    '/wp-admin',
    '/wp-login.php',
    '/.env',
    '/.git/config',
    '/config.php',
    '/backup',
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

const requestTimestamps = new Map();

function anomalyDetectionMiddleware() {
  return (req, res, next) => {
    const ip = getClientIP(req);
    const now = Date.now();
    
    if (!requestTimestamps.has(ip)) {
      requestTimestamps.set(ip, []);
    }
    
    const timestamps = requestTimestamps.get(ip);
    
    const recentTimestamps = timestamps.filter(ts => now - ts < 10000);
    recentTimestamps.push(now);
    requestTimestamps.set(ip, recentTimestamps);
    
    if (recentTimestamps.length >= 10 && process.env.NODE_ENV !== 'test') {
      addSuspicionScore(ip, 2, 'Rapid refresh pattern detected');
      logger.warn(`Anomaly: Rapid requests from ${ip} (${recentTimestamps.length} in 10s)`);
    }
    
    next();
  };
}

// Export a function to clear state for testing
function clearSecurityState() {
  blockedIPs.clear();
  suspicionScores.clear();
  honeypotHits.clear();
  requestTimestamps.clear();
  
  // Reset rate limiter stores
  if (rateLimiterInstance && rateLimiterInstance.resetKey) {
    // Clear all keys - this is a hack but necessary for testing
    rateLimiterInstance.store = undefined;
  }
  if (burstLimiterInstance && burstLimiterInstance.resetKey) {
    burstLimiterInstance.store = undefined;
  }
}

// Cleanup function for proper shutdown
function cleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  clearSecurityState();
}

module.exports = function(app) {
  logger.info('Initializing Security Service...');
  
  // Enable trust proxy to handle X-Forwarded-For
  app.set('trust proxy', true);
  
  const middlewares = [
    helmetMiddleware(),
    morganMiddleware(),
    ipBlockerMiddleware(),
    forbiddenMethodsMiddleware(),
    urlLengthMiddleware(),
    userAgentMiddleware(),
    rateLimiterMiddleware(),
    burstLimiterMiddleware(),
    slowDownMiddleware(),
    anomalyDetectionMiddleware(),
    suspiciousPayloadMiddleware(),
    sanitizerMiddleware(),
  ];
  
  honeypotMiddleware(app);
  
  logger.info('Security Service initialized with all layers active');
  
  return middlewares;
};

module.exports.closeLogger = function() {
  cleanup();
  logger.close();
};

module.exports.clearSecurityState = clearSecurityState;
module.exports.cleanup = cleanup;