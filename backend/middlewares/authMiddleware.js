const jwt = require("jsonwebtoken");
const BlacklistedToken = require("../models/blacklistedtoken");

const authenticateToken = async (req, res, next) => {
  try {
    
    let token = req.cookies.token;
    
    
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    
    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been invalidated' });
    }

    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

  
module.exports = authenticateToken;
