// corsMiddleware.js
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
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error('CORS: Origin not allowed.'), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

module.exports = corsMiddleware;