const cors = require("cors");

const corsMiddleware = cors({
  origin: (origin, callback) => {
    return callback(null, true); // Allow all origins
  },
  credentials: true, // Allow cookies, tokens, authentication
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

module.exports = corsMiddleware;
