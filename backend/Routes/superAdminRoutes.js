const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Admin = require("../models/admin");          // Admin model

const authenticateToken = require("../middlewares/authMiddleware"); // Login check
const isSuperAdmin = require("../middlewares/isSuperAdmin");        // Super admin check
const upload = require("../middlewares/upload");                    // File upload middleware


router.post('/api/admins', authenticateToken, isSuperAdmin, upload.single('profileImage'), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      isSuperAdmin,
      designation,
      bio,
      location,
      expertise,
      interests,
      socialLinks
    } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Prepare profile image data
    let profileImageData = null;
    if (req.file) {
      profileImageData = {
        data: req.file.buffer,
        contentType: req.file.mimetype
      };
    }
    
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
      role: role || 'admin',
      isSuperAdmin: isSuperAdmin === 'true' || isSuperAdmin === true,
      designation,
      bio,
      location,
      expertise: expertise ? (typeof expertise === 'string' ? JSON.parse(expertise) : expertise) : [],
      interests: interests ? (typeof interests === 'string' ? JSON.parse(interests) : interests) : [],
      socialLinks: socialLinks ? (typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks) : {},
      profileImage: profileImageData,
      status: 'active'
    });
    
    await newAdmin.save();
    
    // Remove password and image buffer from response
    const adminResponse = newAdmin.toObject();
    delete adminResponse.password;
    if (adminResponse.profileImage) {
      adminResponse.profileImage = {
        contentType: adminResponse.profileImage.contentType,
        hasImage: true
      };
    }
    
    res.status(201).json({
      message: 'Admin created successfully',
      admin: adminResponse
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all admins (Super Admin only)
router.get('/api/admins', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { status, role, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (role) query.role = role;
    
    const admins = await Admin.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Convert image data to indicate presence only (not sending full buffer)
    const adminsResponse = admins.map(admin => {
      const adminObj = admin.toObject();
      if (adminObj.profileImage && adminObj.profileImage.data) {
        adminObj.profileImage = {
          contentType: adminObj.profileImage.contentType,
          hasImage: true
        };
      }
      return adminObj;
    });
    
    const count = await Admin.countDocuments(query);
    
    res.json({
      admins: adminsResponse,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalAdmins: count
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single admin by ID (Super Admin only)
router.get('/api/admins/:id', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    const adminObj = admin.toObject();
    if (adminObj.profileImage && adminObj.profileImage.data) {
      adminObj.profileImage = {
        contentType: adminObj.profileImage.contentType,
        hasImage: true
      };
    }
    
    res.json({ admin: adminObj });
  } catch (error) {
    console.error('Error fetching admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get admin profile image
router.get('/api/admins/:id/image', async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select('profileImage');
    
    if (!admin || !admin.profileImage || !admin.profileImage.data) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    res.set('Content-Type', admin.profileImage.contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.send(admin.profileImage.data);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update admin (Super Admin only) - WITH IMAGE UPLOAD
router.put('/api/admins/:id', authenticateToken, isSuperAdmin, upload.single('profileImage'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      role,
      isSuperAdmin,
      status,
      designation,
      bio,
      location,
      expertise,
      interests,
      socialLinks,
      password,
      removeImage
    } = req.body;
    
    const admin = await Admin.findById(id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Update fields
    if (name) admin.name = name;
    if (email) {
      const existingAdmin = await Admin.findOne({ email, _id: { $ne: id } });
      if (existingAdmin) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      admin.email = email;
    }
    if (role) admin.role = role;
    if (typeof isSuperAdmin !== 'undefined') {
      admin.isSuperAdmin = isSuperAdmin === 'true' || isSuperAdmin === true;
    }
    if (status) admin.status = status;
    if (designation !== undefined) admin.designation = designation;
    if (bio !== undefined) admin.bio = bio;
    if (location !== undefined) admin.location = location;
    if (expertise) {
      admin.expertise = typeof expertise === 'string' ? JSON.parse(expertise) : expertise;
    }
    if (interests) {
      admin.interests = typeof interests === 'string' ? JSON.parse(interests) : interests;
    }
    if (socialLinks) {
      const parsedLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
      admin.socialLinks = { ...admin.socialLinks, ...parsedLinks };
    }
    
    // Handle profile image
    if (removeImage === 'true' || removeImage === true) {
      admin.profileImage = null;
    } else if (req.file) {
      admin.profileImage = {
        data: req.file.buffer,
        contentType: req.file.mimetype
      };
    }
    
    // Update password if provided
    if (password) {
      admin.password = await bcrypt.hash(password, 10);
    }
    
    await admin.save();
    
    // Remove password and image buffer from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    if (adminResponse.profileImage && adminResponse.profileImage.data) {
      adminResponse.profileImage = {
        contentType: adminResponse.profileImage.contentType,
        hasImage: true
      };
    }
    
    res.json({
      message: 'Admin updated successfully',
      admin: adminResponse
    });
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete admin (Super Admin only)
router.delete('/api/admins/:id', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (id === req.user.admin_id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    const admin = await Admin.findById(id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    await Admin.findByIdAndDelete(id);
    
    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// REGULAR ADMIN ROUTES - Self Profile Management
// ============================================

// Get own profile
router.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.admin_id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    const adminObj = admin.toObject();
    if (adminObj.profileImage && adminObj.profileImage.data) {
      adminObj.profileImage = {
        contentType: adminObj.profileImage.contentType,
        hasImage: true
      };
    }
    
    res.json({ admin: adminObj });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update own profile - WITH IMAGE UPLOAD
router.put('/api/profile', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    const {
      name,
      bio,
      designation,
      location,
      expertise,
      interests,
      socialLinks,
      removeImage
    } = req.body;
    
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Update allowed fields
    if (name) admin.name = name;
    if (bio !== undefined) admin.bio = bio;
    if (designation !== undefined) admin.designation = designation;
    if (location !== undefined) admin.location = location;
    if (expertise) {
      admin.expertise = typeof expertise === 'string' ? JSON.parse(expertise) : expertise;
    }
    if (interests) {
      admin.interests = typeof interests === 'string' ? JSON.parse(interests) : interests;
    }
    if (socialLinks) {
      const parsedLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
      admin.socialLinks = { ...admin.socialLinks, ...parsedLinks };
    }
    
    // Handle profile image
    if (removeImage === 'true' || removeImage === true) {
      admin.profileImage = null;
    } else if (req.file) {
      admin.profileImage = {
        data: req.file.buffer,
        contentType: req.file.mimetype
      };
    }
    
    await admin.save();
    
    // Remove password and image buffer from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    if (adminResponse.profileImage && adminResponse.profileImage.data) {
      adminResponse.profileImage = {
        contentType: adminResponse.profileImage.contentType,
        hasImage: true
      };
    }
    
    res.json({
      message: 'Profile updated successfully',
      admin: adminResponse
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update own password
router.put('/api/profile/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }
    
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash and update new password
    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update profile image only
router.put('/api/profile/image', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Profile image is required' });
    }
    
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    admin.profileImage = {
      data: req.file.buffer,
      contentType: req.file.mimetype
    };
    await admin.save();
    
    res.json({
      message: 'Profile image updated successfully',
      hasImage: true
    });
  } catch (error) {
    console.error('Error updating profile image:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete profile image
router.delete('/api/profile/image', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    admin.profileImage = null;
    await admin.save();
    
    res.json({ message: 'Profile image removed successfully' });
  } catch (error) {
    console.error('Error removing profile image:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update social links
router.put('/api/profile/social-links', authenticateToken, async (req, res) => {
  try {
    const { socialLinks } = req.body;
    
    if (!socialLinks || typeof socialLinks !== 'object') {
      return res.status(400).json({ message: 'Valid social links object is required' });
    }
    
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    admin.socialLinks = { ...admin.socialLinks, ...socialLinks };
    await admin.save();
    
    res.json({
      message: 'Social links updated successfully',
      socialLinks: admin.socialLinks
    });
  } catch (error) {
    console.error('Error updating social links:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update expertise
router.put('/api/profile/expertise', authenticateToken, async (req, res) => {
  try {
    const { expertise } = req.body;
    
    if (!Array.isArray(expertise)) {
      return res.status(400).json({ message: 'Expertise must be an array' });
    }
    
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    admin.expertise = expertise;
    await admin.save();
    
    res.json({
      message: 'Expertise updated successfully',
      expertise: admin.expertise
    });
  } catch (error) {
    console.error('Error updating expertise:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update interests
router.put('/api/profile/interests', authenticateToken, async (req, res) => {
  try {
    const { interests } = req.body;
    
    if (!Array.isArray(interests)) {
      return res.status(400).json({ message: 'Interests must be an array' });
    }
    
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    admin.interests = interests;
    await admin.save();
    
    res.json({
      message: 'Interests updated successfully',
      interests: admin.interests
    });
  } catch (error) {
    console.error('Error updating interests:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// PUBLIC ROUTES - Admin Public Profile
// ============================================

// Get public profile of a specific admin by ID
router.get('/api/admins/:id/public', async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select(
      'name profileImage bio designation socialLinks location expertise interests joinedDate status'
    );
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Only return profile if admin is active
    if (admin.status !== 'active') {
      return res.status(404).json({ message: 'Admin profile not available' });
    }
    
    const adminObj = admin.toObject();
    delete adminObj.status;
    
    if (adminObj.profileImage && adminObj.profileImage.data) {
      adminObj.profileImage = {
        contentType: adminObj.profileImage.contentType,
        hasImage: true
      };
    }
    
    res.json({ admin: adminObj });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get public profiles of all active admins (for team page, etc.)
router.get('/api/admins/public/all', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const admins = await Admin.find({ status: 'active' })
      .select('name profileImage bio designation socialLinks location expertise interests joinedDate')
      .sort({ joinedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const adminsResponse = admins.map(admin => {
      const adminObj = admin.toObject();
      if (adminObj.profileImage && adminObj.profileImage.data) {
        adminObj.profileImage = {
          contentType: adminObj.profileImage.contentType,
          hasImage: true
        };
      }
      return adminObj;
    });
    
    const count = await Admin.countDocuments({ status: 'active' });
    
    res.json({
      admins: adminsResponse,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalAdmins: count
    });
  } catch (error) {
    console.error('Error fetching public profiles:', error);
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;
