const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("../Config/cloudinarystorage");
const Admin = require("../models/admin");          
const authenticateToken = require("../middlewares/authMiddleware"); 
const isSuperAdmin = require("../middlewares/isSuperAdmin");        
const upload = require("../middlewares/cloudinaryUpload");                    

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
    
    if (!name || !email || !password) {
      if (req.file) await cloudinary.uploader.destroy(req.file.filename);
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      if (req.file) await cloudinary.uploader.destroy(req.file.filename);
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const adminData = {
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
      status: 'active'
    };

    if (req.file) {
      adminData.profileImage = {
        publicId: req.file.filename,
        url: req.file.path,
        secureUrl: req.file.path
      };
    }
    
    const newAdmin = new Admin(adminData);
    await newAdmin.save();
    
    const adminResponse = newAdmin.toObject();
    delete adminResponse.password;
    
    res.status(201).json({
      message: 'Admin created successfully',
      admin: adminResponse
    });
  } catch (error) {
    if (req.file) await cloudinary.uploader.destroy(req.file.filename);
    console.error('Error creating admin:', error);
    res.status(500).json({ message: error.message });
  }
});

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
    
    const count = await Admin.countDocuments(query);
    
    res.json({
      admins,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalAdmins: count
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/admins/:id', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    res.json({ admin });
  } catch (error) {
    console.error('Error fetching admin:', error);
    res.status(500).json({ message: error.message });
  }
});

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

    if (admin.profileImage?.publicId) {
      await cloudinary.uploader.destroy(admin.profileImage.publicId);
    }
    
    await Admin.findByIdAndDelete(id);
    
    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.admin_id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    res.json({ admin });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: error.message });
  }
});

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
      if (req.file) await cloudinary.uploader.destroy(req.file.filename);
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    if (name) admin.name = name;
    if (email) {
      const existingAdmin = await Admin.findOne({ email, _id: { $ne: id } });
      if (existingAdmin) {
        if (req.file) await cloudinary.uploader.destroy(req.file.filename);
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
    
    if (removeImage === 'true' || removeImage === true) {
      if (admin.profileImage?.publicId) {
        await cloudinary.uploader.destroy(admin.profileImage.publicId);
      }
      admin.profileImage = undefined;
    } else if (req.file) {
      if (admin.profileImage?.publicId) {
        await cloudinary.uploader.destroy(admin.profileImage.publicId);
      }
      admin.profileImage = {
        publicId: req.file.filename,
        url: req.file.path,
        secureUrl: req.file.path
      };
    }
    
    if (password) {
      admin.password = await bcrypt.hash(password, 10);
    }
    
    await admin.save();
    
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    
    res.json({
      message: 'Admin updated successfully',
      admin: adminResponse
    });
  } catch (error) {
    if (req.file) await cloudinary.uploader.destroy(req.file.filename);
    console.error('Error updating admin:', error);
    res.status(500).json({ message: error.message });
  }
});

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
      if (req.file) await cloudinary.uploader.destroy(req.file.filename);
      return res.status(404).json({ message: 'Admin not found' });
    }
    
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
    
    if (removeImage === 'true' || removeImage === true) {
      if (admin.profileImage?.publicId) {
        await cloudinary.uploader.destroy(admin.profileImage.publicId);
      }
      admin.profileImage = undefined;
    } else if (req.file) {
      if (admin.profileImage?.publicId) {
        await cloudinary.uploader.destroy(admin.profileImage.publicId);
      }
      admin.profileImage = {
        publicId: req.file.filename,
        url: req.file.path,
        secureUrl: req.file.path
      };
    }
    
    await admin.save();
    
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    
    res.json({
      message: 'Profile updated successfully',
      admin: adminResponse
    });
  } catch (error) {
    if (req.file) await cloudinary.uploader.destroy(req.file.filename);
    console.error('Error updating profile:', error);
    res.status(500).json({ message: error.message });
  }
});

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
    
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/api/profile/image', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Profile image is required' });
    }
    
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      await cloudinary.uploader.destroy(req.file.filename);
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.profileImage?.publicId) {
      await cloudinary.uploader.destroy(admin.profileImage.publicId);
    }
    
    admin.profileImage = {
      publicId: req.file.filename,
      url: req.file.path,
      secureUrl: req.file.path
    };
    await admin.save();
    
    res.json({
      message: 'Profile image updated successfully',
      profileImage: admin.profileImage
    });
  } catch (error) {
    if (req.file) await cloudinary.uploader.destroy(req.file.filename);
    console.error('Error updating profile image:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/api/profile/image', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.admin_id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.profileImage?.publicId) {
      await cloudinary.uploader.destroy(admin.profileImage.publicId);
    }
    
    admin.profileImage = undefined;
    await admin.save();
    
    res.json({ message: 'Profile image removed successfully' });
  } catch (error) {
    console.error('Error removing profile image:', error);
    res.status(500).json({ message: error.message });
  }
});

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

router.get('/api/admins/:id/public', async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select(
      'name profileImage bio designation socialLinks location expertise interests joinedDate status'
    );
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    if (admin.status !== 'active') {
      return res.status(404).json({ message: 'Admin profile not available' });
    }
    
    const adminObj = admin.toObject();
    delete adminObj.status;
    
    res.json({ admin: adminObj });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/admins/public/all', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const admins = await Admin.find({ status: 'active' })
      .select('name profileImage bio designation socialLinks location expertise interests joinedDate')
      .sort({ joinedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Admin.countDocuments({ status: 'active' });
    
    res.json({
      admins,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalAdmins: count
    });
  } catch (error) {
    console.error('Error fetching public profiles:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;