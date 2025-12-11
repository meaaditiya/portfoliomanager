const jwt = require("jsonwebtoken");
const optionalAuth = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      
      
      const userId = decoded.user_id;
      
      if (userId) {
        
        req.user = { 
          id: String(userId),
          _id: String(userId)
        };
      }
    } catch (err) {
      
      console.error('Token verification failed:', err.message);
    }
  }
  next();
};
module.exports = optionalAuth;