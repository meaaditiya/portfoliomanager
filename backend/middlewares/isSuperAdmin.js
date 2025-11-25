const Admin = require("../models/admin"); 
const isSuperAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    if (!admin.isSuperAdmin) {
      return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = isSuperAdmin;
