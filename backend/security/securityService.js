const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('redis');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const winston = require('winston');
const validator = require('validator');
const { ipKeyGenerator } = require('express-rate-limit');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

let redisClient;
let isRedisConnected = false;

async function initializeRedis() {
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not configured, using in-memory rate limiting');
    return null;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection attempts exceeded');
            return new Error('Redis reconnection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      isRedisConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
      isRedisConnected = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      isRedisConnected = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    return null;
  }
}

function createRateLimitStore() {
  if (redisClient && isRedisConnected) {
    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args)
    });
  }
}

function setupHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        fontSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https:", "blob:"],
        frameSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { 
      policy: 'strict-origin-when-cross-origin' 
    },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true
  });
}

function createSmartLimiter(options = {}) {
  const {
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = ipKeyGenerator,
    skip = () => false
  } = options;

  const config = {
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator,
    skip,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  };

  const store = createRateLimitStore();
  if (store) {
    config.store = store;
    logger.info(`Rate limiter using Redis store (${max} req/${windowMs}ms)`);
  } else {
    logger.warn(`Rate limiter using memory store (${max} req/${windowMs}ms)`);
  }

  return rateLimit(config);
}

function createBurstLimiter() {
  const windowMs = parseInt(process.env.BURST_LIMIT_WINDOW_MS) || 60000;
  const max = parseInt(process.env.BURST_LIMIT_MAX_REQUESTS) || 150;

  return createSmartLimiter({
    windowMs,
    max,
    message: 'Too many requests in short time, slow down',
    keyGenerator: (req) => {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
      return `burst:${ipKeyGenerator(req)}`;
    }
  });
}

function createApiLimiter() {
  return createSmartLimiter({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300,
    message: 'API rate limit exceeded'
  });
}

function createStrictLimiter() {
  return createSmartLimiter({
    windowMs: 900000,
    max: 30,
    message: 'Rate limit exceeded for sensitive operations',
    keyGenerator: (req) => {
      const userId = req.user?.id || req.user?._id || 'anonymous';
      return `strict:${ipKeyGenerator(req)}:${userId}`;
    }
  });
}

function createAuthLimiter() {
  return createSmartLimiter({
    windowMs: 900000,
    max: 5,
    skipSuccessfulRequests: true,
    message: 'Too many authentication attempts, please try again later',
    keyGenerator: (req) => {
      const identifier = req.body?.email || req.body?.username || ipKeyGenerator(req);
      return `auth:${identifier}`;
    }
  });
}

function createPublicLimiter() {
  return createSmartLimiter({
    windowMs: parseInt(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.PUBLIC_RATE_LIMIT_MAX_REQUESTS) || 500,
    message: 'Public API rate limit exceeded',
    skip: (req) => req.path === '/health' || req.path === '/api/health'
  });
}

function createUploadLimiter() {
  return createSmartLimiter({
    windowMs: 3600000,
    max: 20,
    message: 'Upload limit exceeded, please try again later',
    keyGenerator: (req) => {
      const userId = req.user?.id || req.user?._id || ipKeyGenerator(req);
      return `upload:${userId}`;
    }
  });
}

function advancedSanitization() {
  return [
    mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        logger.warn(`Sanitized NoSQL injection attempt: ${key} from ${req.ip}`);
      }
    }),
    xss(),
    hpp({
      whitelist: ['sort', 'filter', 'page', 'limit', 'fields']
    })
  ];
}

function securityHeaders() {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.removeHeader('X-Powered-By');
    next();
  };
}

function urlValidation() {
  return (req, res, next) => {
    if (req.url.length > 2048) {
      logger.warn(`URL too long from IP: ${req.ip}`);
      return res.status(414).json({ error: 'URI too long' });
    }

    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /\.\.\/\.\.\//,
      /%00/,
      /\x00/
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(req.url))) {
      logger.warn(`Suspicious URL pattern detected from IP: ${req.ip} - ${req.url}`);
      return res.status(400).json({ error: 'Invalid request' });
    }

    next();
  };
}

function requestValidation() {
  return (req, res, next) => {
    const contentType = req.headers['content-type'];
    
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (!contentType) {
        return res.status(400).json({ error: 'Content-Type header required' });
      }
    }

    if (contentType && contentType.includes('application/json')) {
      if (req.body && typeof req.body === 'object') {
        const jsonStr = JSON.stringify(req.body);
        if (jsonStr.length > 1024 * 1024 * 10) {
          logger.warn(`Large JSON payload from IP: ${req.ip}`);
          return res.status(413).json({ error: 'Payload too large' });
        }
      }
    }

    next();
  };
}

function ipWhitelist() {
  const whitelist = process.env.IP_WHITELIST 
    ? process.env.IP_WHITELIST.split(',').map(ip => ip.trim())
    : [];

  return (req, res, next) => {
    if (whitelist.length === 0) {
      return next();
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    
    if (whitelist.includes(clientIp)) {
      return next();
    }

    logger.warn(`IP not whitelisted: ${clientIp}`);
    return res.status(403).json({ error: 'Access denied' });
  };
}

function requestLogger() {
  return (req, res, next) => {
    if (req.path === '/health' || process.env.NODE_ENV === 'test') {
      return next();
    }

    const start = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      res.send = originalSend;
      const duration = Date.now() - start;
      
      logger.http({
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      return res.send(data);
    };

    next();
  };
}

function errorLogger() {
  return (err, req, res, next) => {
    logger.error({
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    next(err);
  };
}

function suspiciousActivityDetector() {
  const suspiciousRequests = new Map();
  const THRESHOLD = parseInt(process.env.SUSPICIOUS_ACTIVITY_THRESHOLD) || 100;
  const WINDOW = parseInt(process.env.SUSPICIOUS_ACTIVITY_WINDOW_MS) || 60000;

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();

    if (!suspiciousRequests.has(key)) {
      suspiciousRequests.set(key, []);
    }

    const requests = suspiciousRequests.get(key);
    const recentRequests = requests.filter(time => now - time < WINDOW);
    recentRequests.push(now);
    suspiciousRequests.set(key, recentRequests);

    if (recentRequests.length > THRESHOLD) {
      logger.warn(`Suspicious activity detected from IP: ${req.ip}`);
      return res.status(429).json({ 
        error: 'Suspicious activity detected, access temporarily restricted' 
      });
    }

    next();
  };
}

async function initializeSecurity(app) {
  logger.info('Initializing advanced security middleware...');

  await initializeRedis();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  logger.info('Security middleware initialized successfully');
  logger.info(`Redis status: ${isRedisConnected ? 'Connected' : 'Disconnected (using memory store)'}`);
  logger.info(`Rate limiting: ${process.env.RATE_LIMIT_MAX_REQUESTS || 300} req/${(process.env.RATE_LIMIT_WINDOW_MS || 900000)/1000}s`);
  logger.info(`Burst limiting: ${process.env.BURST_LIMIT_MAX_REQUESTS || 150} req/${(process.env.BURST_LIMIT_WINDOW_MS || 60000)/1000}s`);
  logger.info(`Public limiting: ${process.env.PUBLIC_RATE_LIMIT_MAX_REQUESTS || 500} req/${(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS || 900000)/1000}s`);

  return {
    helmet: setupHelmet(),
    securityHeaders: securityHeaders(),
    compression: compression({ level: 6, threshold: 1024 }),
    urlValidation: urlValidation(),
    requestValidation: requestValidation(),
    requestLogger: requestLogger(),
    sanitization: advancedSanitization(),
    suspiciousActivity: suspiciousActivityDetector(),
    ipWhitelist: ipWhitelist(),
    get apiLimiter() { return createApiLimiter(); },
    get strictLimiter() { return createStrictLimiter(); },
    get authLimiter() { return createAuthLimiter(); },
    get publicLimiter() { return createPublicLimiter(); },
    get uploadLimiter() { return createUploadLimiter(); },
    get burstLimiter() { return createBurstLimiter(); },
    errorLogger: errorLogger(),
    redisClient,
    isRedisConnected: () => isRedisConnected
  };
}

process.on('SIGTERM', async () => {
  if (redisClient && isRedisConnected) {
    logger.info('Closing Redis connection...');
    await redisClient.quit();
  }
});

module.exports = {
  initializeSecurity,
  logger
};