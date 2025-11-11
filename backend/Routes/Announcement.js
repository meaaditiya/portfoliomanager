const express = require("express");
const router = express.Router();
const authenticateToken = require("../middlewares/authMiddleware"); 
const upload = require("../middlewares/upload");                    
const Announcement = require("../models/announcementSchema");
const calculateExpiryDate = require("../utils/calculateExpiryDate");
router.post('/api/admin/announcement', authenticateToken, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      title, 
      titleColor,
      caption, 
      captionFormat,
      link, 
      priority, 
      expiryType, 
      expiryValue, 
      expiresAt 
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const announcementData = {
      title,
      titleColor: titleColor || '#000000',
      caption: caption || '',
      captionFormat: captionFormat || 'markdown',
      link: link || '',
      priority: priority || 0
    };

    // Handle expiry
    if (expiryType) {
      const expiryDate = calculateExpiryDate(expiryType, expiryValue, expiresAt);
      if (expiryDate) {
        announcementData.expiresAt = expiryDate;
      }
    }

    if (req.files && req.files.image) {
      const imageFile = req.files.image[0];
      announcementData.image = {
        data: imageFile.buffer,
        contentType: imageFile.mimetype,
        filename: imageFile.originalname
      };
    }

    if (req.files && req.files.document) {
      const docFile = req.files.document[0];
      announcementData.document = {
        data: docFile.buffer,
        contentType: docFile.mimetype,
        filename: docFile.originalname
      };
    }

    const announcement = new Announcement(announcementData);
    await announcement.save();

    res.status(201).json({ 
      message: 'Announcement created successfully', 
      announcement: {
        _id: announcement._id,
        title: announcement.title,
        titleColor: announcement.titleColor,
        caption: announcement.caption,
        captionFormat: announcement.captionFormat,
        renderedCaption: announcement.getRenderedCaption(),
        link: announcement.link,
        priority: announcement.priority,
        isActive: announcement.isActive,
        expiresAt: announcement.expiresAt,
        isExpired: announcement.isExpired,
        hasImage: !!announcement.image,
        hasDocument: !!announcement.document,
        createdAt: announcement.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get('/api/admin/announcement', authenticateToken, async (req, res) => {
  try {
    await Announcement.expireOldAnnouncements();

    const announcements = await Announcement.find()
      .select('-image.data -document.data')
      .sort({ priority: -1, createdAt: -1 });

    const announcementsWithInfo = announcements.map(ann => ({
      _id: ann._id,
      title: ann.title,
      titleColor: ann.titleColor,
      caption: ann.caption,
      captionFormat: ann.captionFormat,
      renderedCaption: ann.getRenderedCaption(),
      link: ann.link,
      priority: ann.priority,
      isActive: ann.isActive,
      expiresAt: ann.expiresAt,
      isExpired: ann.isExpired,
      hasImage: !!ann.image?.data,
      hasDocument: !!ann.document?.data,
      imageFilename: ann.image?.filename,
      documentFilename: ann.document?.filename,
      createdAt: ann.createdAt,
      updatedAt: ann.updatedAt
    }));

    res.json({ announcements: announcementsWithInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get('/api/announcement/active', async (req, res) => {
  try {
    await Announcement.expireOldAnnouncements();

    const announcements = await Announcement.find({ 
      isActive: true,
      isExpired: false
    })
    .sort({ priority: -1, createdAt: -1 });

    const announcementsWithInfo = announcements.map(ann => ({
      _id: ann._id,
      title: ann.title,
      titleColor: ann.titleColor,
      caption: ann.caption,
      captionFormat: ann.captionFormat,
      renderedCaption: ann.getRenderedCaption(),
      link: ann.link,
      priority: ann.priority,
      expiresAt: ann.expiresAt,
      hasImage: !!(ann.image && ann.image.data),
      hasDocument: !!(ann.document && ann.document.data),
      createdAt: ann.createdAt
    }));

    res.json({ announcements: announcementsWithInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET SINGLE ANNOUNCEMENT BY ID
router.get('/api/admin/announcement/:id', authenticateToken, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .select('-image.data -document.data');

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    announcement.checkExpiry();
    if (announcement.isModified()) {
      await announcement.save();
    }

    res.json({ 
      announcement: {
        _id: announcement._id,
        title: announcement.title,
        titleColor: announcement.titleColor,
        caption: announcement.caption,
        captionFormat: announcement.captionFormat,
        renderedCaption: announcement.getRenderedCaption(),
        link: announcement.link,
        priority: announcement.priority,
        isActive: announcement.isActive,
        expiresAt: announcement.expiresAt,
        isExpired: announcement.isExpired,
        hasImage: !!announcement.image?.data,
        hasDocument: !!announcement.document?.data,
        imageFilename: announcement.image?.filename,
        documentFilename: announcement.document?.filename,
        createdAt: announcement.createdAt,
        updatedAt: announcement.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET ANNOUNCEMENT IMAGE
router.get('/api/announcement/:id/image', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement || !announcement.image || !announcement.image.data) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.set('Content-Type', announcement.image.contentType);
    res.send(announcement.image.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET ANNOUNCEMENT DOCUMENT
router.get('/api/announcement/:id/document', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement || !announcement.document || !announcement.document.data) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.set('Content-Type', announcement.document.contentType);
    res.set('Content-Disposition', `attachment; filename="${announcement.document.filename}"`);
    res.send(announcement.document.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE ANNOUNCEMENT
router.put('/api/admin/announcement/:id', authenticateToken, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      title,
      titleColor,
      caption,
      captionFormat,
      link, 
      priority, 
      isActive, 
      removeImage, 
      removeDocument,
      expiryType,
      expiryValue,
      expiresAt,
      removeExpiry
    } = req.body;

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (title) announcement.title = title;
    if (titleColor !== undefined) announcement.titleColor = titleColor;
    if (caption !== undefined) announcement.caption = caption;
    if (captionFormat !== undefined) announcement.captionFormat = captionFormat;
    if (link !== undefined) announcement.link = link;
    if (priority !== undefined) announcement.priority = priority;
    if (isActive !== undefined) announcement.isActive = isActive === 'true' || isActive === true;

    // Handle expiry
    if (removeExpiry === 'true' || removeExpiry === true) {
      announcement.expiresAt = null;
      announcement.isExpired = false;
    } else if (expiryType) {
      const expiryDate = calculateExpiryDate(expiryType, expiryValue, expiresAt);
      if (expiryDate) {
        announcement.expiresAt = expiryDate;
        announcement.isExpired = false;
      }
    }

    if (removeImage === 'true' || removeImage === true) {
      announcement.image = undefined;
    }

    if (removeDocument === 'true' || removeDocument === true) {
      announcement.document = undefined;
    }

    if (req.files && req.files.image) {
      const imageFile = req.files.image[0];
      announcement.image = {
        data: imageFile.buffer,
        contentType: imageFile.mimetype,
        filename: imageFile.originalname
      };
    }

    if (req.files && req.files.document) {
      const docFile = req.files.document[0];
      announcement.document = {
        data: docFile.buffer,
        contentType: docFile.mimetype,
        filename: docFile.originalname
      };
    }

    await announcement.save();

    res.json({ 
      message: 'Announcement updated successfully',
      announcement: {
        _id: announcement._id,
        title: announcement.title,
        titleColor: announcement.titleColor,
        caption: announcement.caption,
        captionFormat: announcement.captionFormat,
        renderedCaption: announcement.getRenderedCaption(),
        link: announcement.link,
        priority: announcement.priority,
        isActive: announcement.isActive,
        expiresAt: announcement.expiresAt,
        isExpired: announcement.isExpired,
        hasImage: !!announcement.image,
        hasDocument: !!announcement.document,
        updatedAt: announcement.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TOGGLE ANNOUNCEMENT ACTIVE STATUS
router.patch('/api/admin/announcement/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (announcement.isExpired) {
      return res.status(400).json({ 
        error: 'Cannot activate an expired announcement. Please update the expiry date first.' 
      });
    }

    announcement.isActive = !announcement.isActive;
    await announcement.save();

    res.json({ 
      message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`,
      announcement: {
        _id: announcement._id,
        isActive: announcement.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE SINGLE ANNOUNCEMENT
router.delete('/api/admin/announcement/:id', authenticateToken, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE ALL ANNOUNCEMENTS
router.delete('/api/admin/announcement', authenticateToken, async (req, res) => {
  try {
    const result = await Announcement.deleteMany({});
    res.json({ 
      message: 'All announcements deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;