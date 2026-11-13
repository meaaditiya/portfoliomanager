const jwt = require('jsonwebtoken');
const User = require('../models/userSchema');
const BlacklistedToken = require('../models/blacklistedtoken.js');

const clean = (t) => (t && t !== 'null' && t !== 'undefined' ? t : null);

const authenticateUser = async (req, res, next) => {
  try {
    const token = clean(req.cookies?.token) || clean(req.headers.authorization?.split(' ')[1]);

    if (!token) {
      return res.status(401).json({ message: 'Login required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

    if (!decoded.user_id) {
      return res.status(403).json({ message: 'Only signed in users can bookmark' });
    }

    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      return res.status(401).json({ message: 'Session expired' });
    }

    const user = await User.findById(decoded.user_id).select('_id');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = { user_id: user._id, type: 'user' };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = authenticateUser;