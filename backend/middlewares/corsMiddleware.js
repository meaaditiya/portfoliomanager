const cors = require("cors");

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://connectwithaaditiya.onrender.com',
  'https://connectwithaaditiyamg.onrender.com',
  'https://connectwithaaditiyaadmin.onrender.com',
  'http://192.168.1.33:5174',
  'http://192.168.1.33:5173',
  'https://aaditiyatyagi.vercel.app'
];

const corsMiddleware = cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    
    return callback(new Error('CORS: Origin not allowed.'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Fingerprint-Data'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 3600
});
const varyMiddleware = (req, res, next) => {
  res.setHeader('Vary', 'Origin');
  next();
};
const combinedCorsMiddleware = (req, res, next) => {
  varyMiddleware(req, res, () => {
    corsMiddleware(req, res, next);
  });
};

module.exports = combinedCorsMiddleware;