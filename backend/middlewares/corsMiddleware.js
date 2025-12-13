const cors = require("cors");

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://connectwithaaditiya.onrender.com',
  'https://connectwithaaditiyamg.onrender.com',
  'https://connectwithaaditiyamg2.onrender.com',
  'https://connectwithaaditiyaadmin.onrender.com',
  'http://192.168.1.33:5174',
  'http://192.168.1.33:5173',
  'https://aaditiyatyagi.vercel.app'
];

const corsMiddleware = cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error('CORS: Origin not allowed.'), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept','X-Turnstile-Token' ]
});

module.exports = corsMiddleware;