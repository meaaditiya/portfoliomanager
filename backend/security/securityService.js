const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const winston = require('winston');
const expressWinston = require('express-winston');

const config = {
  apiRateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
  },
  
  strictRateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Rate limit exceeded for sensitive operations.'
  },
  
  authRateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: 'Too many failed authentication attempts, please try again later.'
  },

  publicRateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many requests, please slow down.'
  },

  uploadRateLimit: {
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Upload limit exceeded, please try again later.'
  }
};

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
    }
  });
}

function setupCors() {
  const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://connectwithaaditiya.onrender.com',
    'https://connectwithaaditiyamg.onrender.com',
    'https://connectwithaaditiyaadmin.onrender.com',
    'http://192.168.1.33:5174',
    'http://192.168.1.33:5173',
    'https://aaditiyatyagi.vercel.app'
  ];

  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : defaultOrigins;

  return {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 600
  };
}

function createApiLimiter() {
  return rateLimit({
    windowMs: config.apiRateLimit.windowMs,
    max: config.apiRateLimit.max,
    message: { error: config.apiRateLimit.message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      return process.env.NODE_ENV === 'test' || 
             req.path === '/health' || 
             req.path.startsWith('/public');
    }
  });
}

function createStrictLimiter() {
  return rateLimit({
    windowMs: config.strictRateLimit.windowMs,
    max: config.strictRateLimit.max,
    message: { error: config.strictRateLimit.message },
    standardHeaders: true,
    legacyHeaders: false
  });
}

function createAuthLimiter() {
  return rateLimit({
    windowMs: config.authRateLimit.windowMs,
    max: config.authRateLimit.max,
    skipSuccessfulRequests: config.authRateLimit.skipSuccessfulRequests,
    message: { error: config.authRateLimit.message },
    standardHeaders: true,
    legacyHeaders: false
  });
}

function createPublicLimiter() {
  return rateLimit({
    windowMs: config.publicRateLimit.windowMs,
    max: config.publicRateLimit.max,
    message: { error: config.publicRateLimit.message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      return process.env.NODE_ENV === 'test' || req.path === '/health';
    }
  });
}

function createUploadLimiter() {
  return rateLimit({
    windowMs: config.uploadRateLimit.windowMs,
    max: config.uploadRateLimit.max,
    message: { error: config.uploadRateLimit.message },
    standardHeaders: true,
    legacyHeaders: false
  });
}

function setupRequestLogger() {
  return expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: "HTTP {{req.method}} {{req.url}}",
    expressFormat: true,
    colorize: false,
    ignoreRoute: function (req, res) { 
      return req.path === '/health' || process.env.NODE_ENV === 'test';
    }
  });
}

function setupErrorLogger() {
  return expressWinston.errorLogger({
    winstonInstance: logger
  });
}

function urlValidationMiddleware() {
  return (req, res, next) => {
    if (req.url.length > 2048) {
      return res.status(414).json({ 
        error: 'URI too long' 
      });
    }
    next();
  };
}

function setupSanitization() {
  return [
    mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        logger.warn(`Sanitized key ${key} in request from ${req.ip}`);
      },
    }),
    xss(),
    hpp()
  ];
}

function securityHeaders() {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.removeHeader('X-Powered-By');
    next();
  };
}

function initializeSecurity(app) {
  logger.info('Initializing security middleware...');

  app.set('trust proxy', 1);

  app.use(setupHelmet());
  app.use(securityHeaders());
  app.use(compression());
  app.use(urlValidationMiddleware());
  
  if (process.env.NODE_ENV !== 'test') {
    app.use(setupRequestLogger());
  }

  app.use(...setupSanitization());

  logger.info('Security middleware initialized successfully');
  logger.info(`API Rate Limit: ${config.apiRateLimit.max} requests per 15 minutes`);
  logger.info(`Auth Rate Limit: ${config.authRateLimit.max} attempts per 15 minutes`);
  logger.info(`Public Rate Limit: ${config.publicRateLimit.max} requests per 15 minutes`);

  return {
    apiLimiter: createApiLimiter(),
    strictLimiter: createStrictLimiter(),
    authLimiter: createAuthLimiter(),
    publicLimiter: createPublicLimiter(),
    uploadLimiter: createUploadLimiter(),
    errorLogger: setupErrorLogger(),
    corsConfig: setupCors()
  };
}

module.exports = {
  initializeSecurity,
  logger
};