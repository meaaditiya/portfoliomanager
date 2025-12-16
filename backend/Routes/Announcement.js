const express = require("express");
const router = express.Router();
const authenticateToken = require("../middlewares/authMiddleware"); 
const upload = require("../middlewares/cloudinaryUpload");
const Announcement = require("../models/announcementSchema");
const calculateExpiryDate = require("../utils/calculateExpiryDate");
const cleanupUnusedImages = require("../utils/cleanupUnusedImages");
const cleanupUnusedVideos = require("../utils/cleanupUnusedVideos");
const extractVideoInfo = require("../utils/extractVideoInfo");
const processContent = require("../utils/processContent");
const cloudinary = require('../Config/cloudinarystorage');




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
      captionImages,
      captionVideos,
      linkUrl,
      linkName,
      linkOpenInNewTab,
      priority, 
      expiryType, 
      expiryValue, 
      expiresAt 
    } = req.body;

    if (!title || !caption) {
      return res.status(400).json({ error: 'Title and caption are required' });
    }

    const cleanedImages = cleanupUnusedImages(caption, captionImages ? JSON.parse(captionImages) : []);
    const cleanedVideos = cleanupUnusedVideos(caption, captionVideos ? JSON.parse(captionVideos) : []);

    const announcementData = {
      title,
      titleColor: titleColor || '#000000',
      caption: caption || '',
      captionFormat: captionFormat || 'markdown',
      captionImages: cleanedImages,
      captionVideos: cleanedVideos,
      link: {
        url: linkUrl || '',
        name: linkName || 'Learn More',
        openInNewTab: linkOpenInNewTab !== 'false' && linkOpenInNewTab !== false
      },
      priority: priority || 0,
      createdBy: req.user.admin_id
    };

    if (expiryType) {
      const expiryDate = calculateExpiryDate(expiryType, expiryValue, expiresAt);
      if (expiryDate) {
        announcementData.expiresAt = expiryDate;
      }
    }

    if (req.files && req.files.image) {
      const imageFile = req.files.image[0];
      announcementData.image = {
        url: imageFile.path,
        publicId: imageFile.filename,
        filename: imageFile.originalname
      };
    }

    if (req.files && req.files.document) {
      const docFile = req.files.document[0];
      announcementData.document = {
        url: docFile.path,
        publicId: docFile.filename,
        filename: docFile.originalname
      };
    }

    const announcement = new Announcement(announcementData);
    await announcement.save();

    const processedCaption = processContent(
      announcement.caption, 
      announcement.captionImages, 
      announcement.captionVideos
    );

    res.status(201).json({ 
      message: 'Announcement created successfully', 
      announcement: {
        _id: announcement._id,
        title: announcement.title,
        titleColor: announcement.titleColor,
        caption: announcement.caption,
        captionFormat: announcement.captionFormat,
        processedCaption: processedCaption,
        renderedCaption: announcement.getRenderedCaption(),
        link: announcement.link,
        priority: announcement.priority,
        isActive: announcement.isActive,
        expiresAt: announcement.expiresAt,
        isExpired: announcement.isExpired,
        hasImage: !!(announcement.image && announcement.image.url),
        hasDocument: !!(announcement.document && announcement.document.url),
        captionImagesCount: announcement.captionImages.length,
        captionVideosCount: announcement.captionVideos.length,
        createdAt: announcement.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: error.message });
  }
});


router.post('/api/admin/announcement/:id/caption-images', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { url, alt, caption, position } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'Image URL is required' });
    }
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    
    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this announcement' });
    }
    
    
    const imageId = 'ann_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const newImage = {
      url,
      alt: alt || '',
      caption: caption || '',
      position: position || 'center',
      imageId
    };
    
    announcement.captionImages.push(newImage);
    await announcement.save();
    
    res.status(201).json({
      message: 'Caption image added successfully',
      image: newImage,
      imageId: imageId,
      embedCode: `[IMAGE:${imageId}]`
    });
  } catch (error) {
    console.error('Error adding caption image:', error);
    res.status(500).json({ message: error.message });
  }
});


router.put('/api/admin/announcement/:id/caption-images/:imageId', authenticateToken, async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const { url, alt, caption, position } = req.body;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this announcement' });
    }
    
    const imageIndex = announcement.captionImages.findIndex(img => img.imageId === imageId);
    
    if (imageIndex === -1) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    if (url) announcement.captionImages[imageIndex].url = url;
    if (alt !== undefined) announcement.captionImages[imageIndex].alt = alt;
    if (caption !== undefined) announcement.captionImages[imageIndex].caption = caption;
    if (position) announcement.captionImages[imageIndex].position = position;
    
    await announcement.save();
    
    res.json({
      message: 'Caption image updated successfully',
      image: announcement.captionImages[imageIndex]
    });
  } catch (error) {
    console.error('Error updating caption image:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/admin/announcement/:id/caption-images/:imageId', authenticateToken, async (req, res) => {
  try {
    const { id, imageId } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this announcement' });
    }
    
    const imageIndex = announcement.captionImages.findIndex(img => img.imageId === imageId);
    
    if (imageIndex === -1) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    announcement.captionImages.splice(imageIndex, 1);
    await announcement.save();
    
    res.json({ message: 'Caption image deleted successfully' });
  } catch (error) {
    console.error('Error deleting caption image:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/admin/announcement/:id/caption-images', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to view this announcement' });
    }
    
    res.json({
      images: announcement.captionImages,
      totalImages: announcement.captionImages.length
    });
  } catch (error) {
    console.error('Error fetching caption images:', error);
    res.status(500).json({ message: error.message });
  }
});




router.post('/api/admin/announcement/:id/caption-videos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { url, title, caption, position, autoplay, muted } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'Video URL is required' });
    }
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this announcement' });
    }
    
    
    const videoInfo = extractVideoInfo(url);
    
    if (!videoInfo) {
      return res.status(400).json({ 
        message: 'Invalid video URL. Supported: YouTube, Vimeo, Dailymotion' 
      });
    }
    
    
    const embedId = 'ann_vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const newVideo = {
      url: videoInfo.url,
      videoId: videoInfo.videoId,
      platform: videoInfo.platform,
      title: title || '',
      caption: caption || '',
      position: position || 'center',
      autoplay: autoplay || false,
      muted: muted || false,
      embedId
    };
    
    announcement.captionVideos.push(newVideo);
    await announcement.save();
    
    res.status(201).json({
      message: 'Caption video added successfully',
      video: newVideo,
      embedId: embedId,
      embedCode: `[VIDEO:${embedId}]`
    });
  } catch (error) {
    console.error('Error adding caption video:', error);
    res.status(500).json({ message: error.message });
  }
});


router.put('/api/admin/announcement/:id/caption-videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, embedId } = req.params;
    const { url, title, caption, position, autoplay, muted } = req.body;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this announcement' });
    }
    
    const videoIndex = announcement.captionVideos.findIndex(vid => vid.embedId === embedId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    if (url) {
      const videoInfo = extractVideoInfo(url);
      if (!videoInfo) {
        return res.status(400).json({ message: 'Invalid video URL' });
      }
      announcement.captionVideos[videoIndex].url = videoInfo.url;
      announcement.captionVideos[videoIndex].videoId = videoInfo.videoId;
      announcement.captionVideos[videoIndex].platform = videoInfo.platform;
    }
    
    if (title !== undefined) announcement.captionVideos[videoIndex].title = title;
    if (caption !== undefined) announcement.captionVideos[videoIndex].caption = caption;
    if (position) announcement.captionVideos[videoIndex].position = position;
    if (autoplay !== undefined) announcement.captionVideos[videoIndex].autoplay = autoplay;
    if (muted !== undefined) announcement.captionVideos[videoIndex].muted = muted;
    
    await announcement.save();
    
    res.json({
      message: 'Caption video updated successfully',
      video: announcement.captionVideos[videoIndex]
    });
  } catch (error) {
    console.error('Error updating caption video:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/admin/announcement/:id/caption-videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, embedId } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this announcement' });
    }
    
    const videoIndex = announcement.captionVideos.findIndex(vid => vid.embedId === embedId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    announcement.captionVideos.splice(videoIndex, 1);
    await announcement.save();
    
    res.json({ message: 'Caption video deleted successfully' });
  } catch (error) {
    console.error('Error deleting caption video:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/admin/announcement/:id/caption-videos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to view this announcement' });
    }
    
    res.json({
      videos: announcement.captionVideos,
      totalVideos: announcement.captionVideos.length
    });
  } catch (error) {
    console.error('Error fetching caption videos:', error);
    res.status(500).json({ message: error.message });
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

    const announcementsWithInfo = announcements.map(ann => {
      const processedCaption = processContent(
        ann.caption, 
        ann.captionImages, 
        ann.captionVideos
      );

      return {
        _id: ann._id,
        title: ann.title,
        titleColor: ann.titleColor,
        caption: ann.caption,
        captionFormat: ann.captionFormat,
        processedCaption: processedCaption,
        renderedCaption: ann.getRenderedCaption(),
        captionImages: ann.captionImages || [], 
        captionVideos: ann.captionVideos || [], 
        link: ann.link,
        priority: ann.priority,
        expiresAt: ann.expiresAt,
        hasImage: !!(ann.image && ann.image.url),
        hasDocument: !!(ann.document && ann.document.url),
        imageUrl: ann.image?.url,
        documentUrl: ann.document?.url,
        captionImagesCount: ann.captionImages.length,
        captionVideosCount: ann.captionVideos.length,
        createdAt: ann.createdAt
      };
    });

    res.json({ announcements: announcementsWithInfo });
  } catch (error) {
    console.error('Error fetching active announcements:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/admin/announcement', authenticateToken, async (req, res) => {
  try {
    await Announcement.expireOldAnnouncements();

    const announcements = await Announcement.find()
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 });

    const announcementsWithInfo = announcements.map(ann => {
      const processedCaption = processContent(
        ann.caption, 
        ann.captionImages, 
        ann.captionVideos
      );

      return {
        _id: ann._id,
        title: ann.title,
        titleColor: ann.titleColor,
        caption: ann.caption,
        captionFormat: ann.captionFormat,
        processedCaption: processedCaption,
        renderedCaption: ann.getRenderedCaption(),
        captionImages: ann.captionImages || [], 
        captionVideos: ann.captionVideos || [], 
        link: ann.link,
        priority: ann.priority,
        isActive: ann.isActive,
        expiresAt: ann.expiresAt,
        isExpired: ann.isExpired,
        hasImage: !!(ann.image && ann.image.url),
        hasDocument: !!(ann.document && ann.document.url),
        imageUrl: ann.image?.url,
        documentUrl: ann.document?.url,
        imageFilename: ann.image?.filename,
        documentFilename: ann.document?.filename,
        captionImagesCount: ann.captionImages.length,
        captionVideosCount: ann.captionVideos.length,
        createdBy: ann.createdBy,
        createdAt: ann.createdAt,
        updatedAt: ann.updatedAt
      };
    });

    res.json({ announcements: announcementsWithInfo });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/admin/announcement/:id', authenticateToken, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    announcement.checkExpiry();
    if (announcement.isModified()) {
      await announcement.save();
    }

    const processedCaption = processContent(
      announcement.caption, 
      announcement.captionImages, 
      announcement.captionVideos
    );

    res.json({ 
      announcement: {
        _id: announcement._id,
        title: announcement.title,
        titleColor: announcement.titleColor,
        caption: announcement.caption,
        captionFormat: announcement.captionFormat,
        processedCaption: processedCaption,
        renderedCaption: announcement.getRenderedCaption(),
        captionImages: announcement.captionImages || [], 
        captionVideos: announcement.captionVideos || [], 
        link: announcement.link,
        priority: announcement.priority,
        isActive: announcement.isActive,
        expiresAt: announcement.expiresAt,
        isExpired: announcement.isExpired,
        hasImage: !!(announcement.image && announcement.image.url),
        hasDocument: !!(announcement.document && announcement.document.url),
        imageUrl: announcement.image?.url,
        documentUrl: announcement.document?.url,
        imageFilename: announcement.image?.filename,
        documentFilename: announcement.document?.filename,
        createdBy: announcement.createdBy,
        createdAt: announcement.createdAt,
        updatedAt: announcement.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/announcement/:id/image', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement || !announcement.image || !announcement.image.url) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.redirect(announcement.image.url);
  } catch (error) {
    console.error('Error fetching announcement image:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/announcement/:id/document', async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement || !announcement.document || !announcement.document.url) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.redirect(announcement.document.url);
  } catch (error) {
    console.error('Error fetching announcement document:', error);
    res.status(500).json({ error: error.message });
  }
});





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
      captionImages,
      captionVideos,
      linkUrl,
      linkName,
      linkOpenInNewTab,
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

    if (!req.user || !req.user.admin_id) {
      return res.status(401).json({ error: 'Unauthorized - Invalid user session' });
    }

    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ error: 'Not authorized to update this announcement' });
    }

    if (title) announcement.title = title;
    if (titleColor !== undefined) announcement.titleColor = titleColor;
    if (caption !== undefined) {
      announcement.caption = caption;
      
      if (captionImages) {
        announcement.captionImages = cleanupUnusedImages(
          caption, 
          JSON.parse(captionImages)
        );
      }
      if (captionVideos) {
        announcement.captionVideos = cleanupUnusedVideos(
          caption, 
          JSON.parse(captionVideos)
        );
      }
    }
    if (captionFormat !== undefined) announcement.captionFormat = captionFormat;
    
    if (linkUrl !== undefined) announcement.link.url = linkUrl;
    if (linkName !== undefined) announcement.link.name = linkName;
    if (linkOpenInNewTab !== undefined) {
      announcement.link.openInNewTab = linkOpenInNewTab === 'true' || linkOpenInNewTab === true;
    }
    
    if (priority !== undefined) announcement.priority = priority;
    if (isActive !== undefined) announcement.isActive = isActive === 'true' || isActive === true;

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
      if (announcement.image && announcement.image.publicId) {
        await cloudinary.uploader.destroy(announcement.image.publicId);
      }
      announcement.image = undefined;
    }
    if (req.files && req.files.image) {
      if (announcement.image && announcement.image.publicId) {
        await cloudinary.uploader.destroy(announcement.image.publicId);
      }
      const imageFile = req.files.image[0];
      announcement.image = {
        url: imageFile.path,
        publicId: imageFile.filename,
        filename: imageFile.originalname
      };
    }

    if (removeDocument === 'true' || removeDocument === true) {
      if (announcement.document && announcement.document.publicId) {
        await cloudinary.uploader.destroy(announcement.document.publicId);
      }
      announcement.document = undefined;
    }
    if (req.files && req.files.document) {
      if (announcement.document && announcement.document.publicId) {
        await cloudinary.uploader.destroy(announcement.document.publicId);
      }
      const docFile = req.files.document[0];
      announcement.document = {
        url: docFile.path,
        publicId: docFile.filename,
        filename: docFile.originalname
      };
    }

    await announcement.save();

    const processedCaption = processContent(
      announcement.caption, 
      announcement.captionImages, 
      announcement.captionVideos
    );

    res.json({ 
      message: 'Announcement updated successfully',
      announcement: {
        _id: announcement._id,
        title: announcement.title,
        titleColor: announcement.titleColor,
        caption: announcement.caption,
        captionFormat: announcement.captionFormat,
        processedCaption: processedCaption,
        renderedCaption: announcement.getRenderedCaption(),
        link: announcement.link,
        priority: announcement.priority,
        isActive: announcement.isActive,
        expiresAt: announcement.expiresAt,
        isExpired: announcement.isExpired,
        hasImage: !!(announcement.image && announcement.image.url),
        hasDocument: !!(announcement.document && announcement.document.url),
        captionImagesCount: announcement.captionImages.length,
        captionVideosCount: announcement.captionVideos.length,
        updatedAt: announcement.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: error.message });
  }
});


router.patch('/api/admin/announcement/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ error: 'Not authorized to modify this announcement' });
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
    console.error('Error toggling announcement:', error);
    res.status(500).json({ error: error.message });
  }
});


router.delete('/api/admin/announcement/:id', authenticateToken, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (announcement.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ error: 'Not authorized to delete this announcement' });
    }

    if (announcement.image && announcement.image.publicId) {
      await cloudinary.uploader.destroy(announcement.image.publicId);
    }

    if (announcement.document && announcement.document.publicId) {
      await cloudinary.uploader.destroy(announcement.document.publicId);
    }

    await Announcement.findByIdAndDelete(req.params.id);

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: error.message });
  }
});


router.delete('/api/admin/announcement', authenticateToken, async (req, res) => {
  try {
    const result = await Announcement.deleteMany({});
    res.json({ 
      message: 'All announcements deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting all announcements:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;