const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/blacklistedtoken');
const User = require('../models/userSchema');

const anonymousUser = () => ({
  isAuthenticated: false,
  isAdmin: false,
  isPremium: false
});

const optionalAuthenticate = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    req.user = anonymousUser();
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      req.user = anonymousUser();
      return next();
    }

    const isAdminToken = !!decoded.admin_id || decoded.role === 'admin';

    if (isAdminToken) {
      req.user = {
        id: String(decoded.admin_id),
        _id: String(decoded.admin_id),
        email: decoded.email,
        name: decoded.name,
        isAdmin: true,
        isPremium: true,
        isAuthenticated: true,
        type: 'admin'
      };
      return next();
    }

    const userId = decoded.user_id;
    if (!userId) {
      req.user = anonymousUser();
      return next();
    }

    const user = await User.findById(userId);
    if (!user) {
      req.user = anonymousUser();
      return next();
    }

    req.user = {
      id: String(userId),
      _id: String(userId),
      email: user.email,
      name: user.name,
      isAdmin: false,
      isPremium: user.isPremium || false,
      isAuthenticated: true,
      type: 'user'
    };
    return next();
  } catch (err) {
    req.user = anonymousUser();
    return next();
  }
};

module.exports = optionalAuthenticate;
