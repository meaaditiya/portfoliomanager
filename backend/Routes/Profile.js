const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const cloudinary = require('../Config/cloudinarystorage');
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/cloudinaryUpload');
const ProfileImage = require('../models/profileImageSchema');

router.post(
  '/api/profile-image/upload',
  authenticateToken,
  upload.single('profileImage'),
  [
    body('filename').optional().trim().isLength({ min: 1, max: 100 })
      .withMessage('Filename must be between 1 and 100 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.file) await cloudinary.uploader.destroy(req.file.filename);
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Profile image file is required' });
      }

      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedImageTypes.includes(req.file.mimetype)) {
        await cloudinary.uploader.destroy(req.file.filename);
        return res.status(400).json({ message: 'Invalid file type. Only images are allowed.' });
      }

      await ProfileImage.updateMany(
        { isActive: true },
        { isActive: false }
      );

      const newProfileImage = new ProfileImage({
        publicId: req.file.filename,
        url: req.file.path,
        secureUrl: req.file.path,
        contentType: req.file.mimetype,
        filename: req.body.filename || req.file.originalname,
        size: req.file.size,
        uploadedBy: {
          name: req.user.name || 'Aaditiya Tyagi',
          email: req.user.email
        },
        isActive: true
      });

      await newProfileImage.save();

      res.status(201).json({
        message: 'Profile image uploaded successfully',
        profileImage: {
          id: newProfileImage._id,
          filename: newProfileImage.filename,
          contentType: newProfileImage.contentType,
          size: newProfileImage.size,
          url: newProfileImage.secureUrl,
          uploadedAt: newProfileImage.uploadedAt
        }
      });

    } catch (error) {
      if (req.file) await cloudinary.uploader.destroy(req.file.filename);
      console.error('Error uploading profile image:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.get('/api/profile-image/active', async (req, res) => {
  try {
    const profileImage = await ProfileImage.findOne({ isActive: true });
    
    if (!profileImage) {
      return res.status(404).json({ message: 'No active profile image found' });
    }

    res.json({
      profileImage: {
        id: profileImage._id,
        url: profileImage.secureUrl,
        filename: profileImage.filename,
        contentType: profileImage.contentType,
        uploadedAt: profileImage.uploadedAt
      }
    });

  } catch (error) {
    console.error('Error fetching profile image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/api/profile-image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const profileImage = await ProfileImage.findById(id);
    
    if (!profileImage) {
      return res.status(404).json({ message: 'Profile image not found' });
    }

    res.json({
      profileImage: {
        id: profileImage._id,
        url: profileImage.secureUrl,
        filename: profileImage.filename,
        contentType: profileImage.contentType,
        uploadedAt: profileImage.uploadedAt
      }
    });

  } catch (error) {
    console.error('Error fetching profile image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/api/profile-images', authenticateToken, async (req, res) => {
  try {
    const profileImages = await ProfileImage.find()
      .sort({ uploadedAt: -1 });

    res.json({
      message: 'Profile images retrieved successfully',
      profileImages
    });

  } catch (error) {
    console.error('Error fetching profile images:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/api/profile-image/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const profileImage = await ProfileImage.findById(id);
    
    if (!profileImage) {
      return res.status(404).json({ message: 'Profile image not found' });
    }

    if (profileImage.publicId) {
      await cloudinary.uploader.destroy(profileImage.publicId);
    }

    await ProfileImage.findByIdAndDelete(id);

    res.json({
      message: 'Profile image deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting profile image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/api/profile-image/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await ProfileImage.updateMany(
      { isActive: true },
      { isActive: false }
    );

    const profileImage = await ProfileImage.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );

    if (!profileImage) {
      return res.status(404).json({ message: 'Profile image not found' });
    }

    res.json({
      message: 'Profile image set as active successfully',
      profileImage: {
        id: profileImage._id,
        filename: profileImage.filename,
        contentType: profileImage.contentType,
        size: profileImage.size,
        url: profileImage.secureUrl,
        uploadedAt: profileImage.uploadedAt,
        isActive: profileImage.isActive,
      },
    });
  } catch (error) {
    console.error('Error setting active profile image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;