const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const winston = require('winston');
const morgan = require('morgan');

const config = {
  // Generous rate limits for non-whitelisted routes
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300, // 300 requests per 15 min
  },
  burstLimit: {
    windowMs: parseInt(process.env.BURST_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
    max: parseInt(process.env.BURST_LIMIT_MAX_REQUESTS) || 60, // 60 requests per minute
  },
  // Lenient limits for high-traffic public routes
  publicRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 min
  },
  publicBurstLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
  },
  maxUrlLength: 4000,
  suspicionThreshold: 50, // High threshold
  enableRedis: !!process.env.REDIS_URL,
  
  // High-traffic public routes with lenient rate limiting
  lenientPaths: [
    // Public API routes
    '/api/blogs',
    '/api/image-posts',
    '/api/gallery',
    '/api/projects',
    '/api/featured-projects',
    '/api/profile',
    '/api/quotes',
    '/api/community',
    '/api/announcements',
    '/api/streams',
    
    // Visitor tracking (high frequency)
    '/api/visitors',
    
    // Comment and reaction routes (frequent user interactions)
    '/api/comments',
    '/api/reactions',
    
    // Document browsing (moderate limits)
    '/api/folder/contents',
    '/api/folder/tree',
    '/api/item/',
    
    // User bookmarks and checkmarks (frequent interactions)
    '/api/user/bookmark',
    '/api/user/bookmarks',
    '/api/user/check-access',
    '/api/user/access-via-link',
    '/api/user/my-access-requests',
    
    // Search (can be frequent)
    '/api/search',
    
    // Health and monitoring
    '/health',
    '/socket.io',
    
    // Static files
    '/public',
    
    // Media serving
    '/api/image-posts/',
    '/api/blogs/',
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

let rateLimiterInstance = null;
let burstLimiterInstance = null;
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
      if (now - data.lastUpdate > 3600000) { // 1 hour
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
  }, 300000); // Every 5 minutes
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

function isWhitelistedPath(path) {
  return config.lenientPaths.some(whitelisted => 
    path.startsWith(whitelisted)
  );
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

// Precise attack patterns
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
        message: 'Your IP has been temporarily blocked. Please contact support if you believe this is an error.',
      });
    }
    
    next();
  };
}

function rateLimiterMiddleware() {
  rateLimiterInstance = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: (req) => {
      // Apply lenient limits for public routes
      if (isLenientPath(req.path)) {
        return config.publicRateLimit.max;
      }
      return config.rateLimit.max;
    },
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
      const isLenient = isLenientPath(req.path);
      addSuspicionScore(ip, isLenient ? 3 : 5, 'General rate limit exceeded');
      logger.warn(`Rate limit exceeded for ${ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too many requests',
        message: 'Please slow down and try again in a few minutes',
      });
    },
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
  });

  return rateLimiterInstance;
}

function burstLimiterMiddleware() {
  burstLimiterInstance = rateLimit({
    windowMs: config.burstLimit.windowMs,
    max: (req) => {
      // Apply lenient limits for public routes
      if (isLenientPath(req.path)) {
        return config.publicBurstLimit.max;
      }
      return config.burstLimit.max;
    },
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
      const isLenient = isLenientPath(req.path);
      addSuspicionScore(ip, isLenient ? 5 : 8, 'Burst limit exceeded');
      logger.warn(`Burst limit exceeded for ${ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too many requests',
        message: 'Burst limit exceeded. Please wait a moment before retrying.',
      });
    },
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
  });

  return burstLimiterInstance;
}

function slowDownMiddleware() {
  return slowDown({
    windowMs: 60 * 1000,
    delayAfter: (req) => {
      // Higher threshold for lenient paths
      if (isLenientPath(req.path)) {
        return 100; // Allow 100 requests before slowing down
      }
      return 50;
    },
    delayMs: () => 100,
    maxDelayMs: 5000,
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
    
    // Only scan request data, not headers
    const scanData = JSON.stringify({
      query: req.query,
      params: req.params,
      body: req.body,
    });
    
    // SQL Injection - require multiple matches
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
    
    // NoSQL Injection
    for (const pattern of ATTACK_PATTERNS.nosqli) {
      if (pattern.test(scanData)) {
        suspicionPoints += 15;
        violations.push('NoSQL Injection attempt detected');
        break;
      }
    }
    
    // XSS
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
    
    // Path Traversal
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
    // Light sanitization
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
    
    // Don't penalize missing user agent for whitelisted paths
    if (!userAgent && process.env.NODE_ENV !== 'test' && !isWhitelistedPath(req.path)) {
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
    
    // For lenient paths: allow more requests but still monitor for extreme abuse
    const threshold = isLenientPath(path) ? 300 : 50;
    
    if (recentTimestamps.length > threshold && process.env.NODE_ENV !== 'test') {
      const points = isLenientPath(path) ? 3 : 5;
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
  
  if (rateLimiterInstance && rateLimiterInstance.store) {
    rateLimiterInstance.store = undefined;
  }
  if (burstLimiterInstance && burstLimiterInstance.store) {
    burstLimiterInstance.store = undefined;
  }
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
  
  logger.info('Security Service initialized');
  logger.info(`Standard rate limit: ${config.rateLimit.max} requests per ${config.rateLimit.windowMs/1000}s`);
  logger.info(`Lenient rate limit: ${config.publicRateLimit.max} requests per ${config.publicRateLimit.windowMs/1000}s`);
  logger.info(`Standard burst limit: ${config.burstLimit.max} requests per ${config.burstLimit.windowMs/1000}s`);
  logger.info(`Lenient burst limit: ${config.publicBurstLimit.max} requests per ${config.publicBurstLimit.windowMs/1000}s`);
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