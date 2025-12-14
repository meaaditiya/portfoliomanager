const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/blacklistedtoken');
const User = require('../models/userSchema');

const UserAuthMiddleware = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      return res.status(403).json({ message: 'Token has been revoked' });
    }
    
    const user = await User.findById(decoded.user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    req.user = {
      user_id: user._id,
      userId: user._id,
      email: user.email,
      name: user.name,
      isAuthenticated: true
    };
    
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

module.exports = UserAuthMiddleware;