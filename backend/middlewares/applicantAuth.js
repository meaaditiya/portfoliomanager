const jwt = require('jsonwebtoken');
const User = require('../models/userSchema');
const BlacklistedToken = require('../models/blacklistedtoken.js');

const clean = (t) => (t && t !== 'null' && t !== 'undefined' ? t : null);

const resolveUser = async (req) => {
  const token = clean(req.cookies?.token) || clean(req.headers.authorization?.split(' ')[1]);
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
  if (!decoded.user_id) return null;

  const blacklisted = await BlacklistedToken.findOne({ token });
  if (blacklisted) return null;

  const user = await User.findById(decoded.user_id).select('_id');
  if (!user) return null;

  return { user_id: user._id, type: 'user' };
};

const requireUser = async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Login required' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const optionalUser = async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (user) req.user = user;
  } catch (error) {
    req.user = undefined;
  }
  next();
};

module.exports = { requireUser, optionalUser };