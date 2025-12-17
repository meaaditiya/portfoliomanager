const express = require("express");
const router = express.Router();
const authenticateToken = require("../middlewares/authMiddleware");
const upload = require("../middlewares/cloudinaryUpload");
const Policy = require("../models/PrivacyPolicy");
const cloudinary = require('../Config/cloudinarystorage');
const extractVideoInfo = require("../utils/extractVideoInfo");

router.post('/api/admin/policy', authenticateToken, async (req, res) => {
  try {
    const { policyType } = req.body;

    if (!policyType) {
      return res.status(400).json({ error: 'Policy type is required' });
    }

    const existingPolicy = await Policy.findOne({ policyType });
    if (existingPolicy) {
      return res.status(409).json({ error: 'Policy type already exists' });
    }

    const policy = new Policy({
      policyType,
      tabs: [],
      createdBy: req.user.admin_id
    });

    await policy.save();

    res.status(201).json({
      message: 'Policy created successfully',
      policy: {
        _id: policy._id,
        policyType: policy.policyType,
        tabs: policy.tabs,
        isActive: policy.isActive,
        createdAt: policy.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating policy:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/admin/policy/:id/tabs', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tabId, tabName, tabOrder } = req.body;

    if (!tabId || !tabName) {
      return res.status(400).json({ error: 'Tab ID and name are required' });
    }

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tabExists = policy.tabs.some(tab => tab.tabId === tabId);
    if (tabExists) {
      return res.status(409).json({ error: 'Tab ID already exists' });
    }

    policy.addTab(tabId, tabName, tabOrder || policy.tabs.length);
    await policy.save();

    const newTab = policy.tabs[policy.tabs.length - 1];

    res.status(201).json({
      message: 'Tab added successfully',
      tab: {
        _id: newTab._id,
        tabId: newTab.tabId,
        tabName: newTab.tabName,
        content: newTab.content,
        contentFormat: newTab.contentFormat,
        tabOrder: newTab.tabOrder,
        isActive: newTab.isActive,
        images: newTab.images,
        videos: newTab.videos,
        documents: newTab.documents,
        createdAt: newTab.createdAt
      }
    });
  } catch (error) {
    console.error('Error adding tab:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/api/admin/policy/:id/tabs/:tabId/content', authenticateToken, async (req, res) => {
  try {
    const { id, tabId } = req.params;
    const { content, contentFormat } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    tab.content = content;
    if (contentFormat) tab.contentFormat = contentFormat;
    tab.updatedAt = Date.now();

    await policy.save();

    const renderedContent = policy.getRenderedTabContent(tabId);

    res.json({
      message: 'Tab content updated successfully',
      tab: {
        tabId: tab.tabId,
        tabName: tab.tabName,
        content: tab.content,
        contentFormat: tab.contentFormat,
        renderedContent: renderedContent,
        updatedAt: tab.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating tab content:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/api/admin/policy/:id/tabs/:tabId/images', authenticateToken, async (req, res) => {
  try {
    const { id, tabId } = req.params;
    const { url, alt, caption, position } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    const imageId = 'pol_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const newImage = {
      url,
      alt: alt || '',
      caption: caption || '',
      position: position || 'center',
      imageId,
      publicId: '',
      filename: ''
    };

    tab.images.push(newImage);
    tab.updatedAt = Date.now();
    await policy.save();

    res.status(201).json({
      message: 'Image added to tab successfully',
      image: newImage,
      embedCode: `[IMAGE:${imageId}]`
    });
  } catch (error) {
    console.error('Error adding image to tab:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/api/admin/policy/:id/tabs/:tabId/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const { id, tabId, imageId } = req.params;
    const { url, alt, caption, position } = req.body;

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    const image = tab.images.find(img => img.imageId === imageId);

    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    if (url) image.url = url;
    if (alt !== undefined) image.alt = alt;
    if (caption !== undefined) image.caption = caption;
    if (position) image.position = position;
    
    tab.updatedAt = Date.now();
    await policy.save();

    res.json({
      message: 'Image updated successfully',
      image: image
    });
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/api/admin/policy/:id/tabs/:tabId/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const { id, tabId, imageId } = req.params;

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    const imageIndex = tab.images.findIndex(img => img.imageId === imageId);

    if (imageIndex === -1) {
      return res.status(404).json({ message: 'Image not found' });
    }

    const image = tab.images[imageIndex];
    if (image.publicId) {
      await cloudinary.uploader.destroy(image.publicId);
    }

    tab.images.splice(imageIndex, 1);
    tab.updatedAt = Date.now();
    await policy.save();

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/api/admin/policy/:id/tabs/:tabId/videos', authenticateToken, async (req, res) => {
  try {
    const { id, tabId } = req.params;
    const { url, title, caption, position, autoplay, muted } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'Video URL is required' });
    }

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    const videoInfo = extractVideoInfo(url);

    if (!videoInfo) {
      return res.status(400).json({
        message: 'Invalid video URL. Supported: YouTube, Vimeo, Dailymotion'
      });
    }

    const embedId = 'pol_vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const newVideo = {
      url: videoInfo.url,
      videoId: videoInfo.videoId,
      platform: videoInfo.platform,
      title: title || '',
      caption: caption || '',
      position: position || 'center',
      autoplay: autoplay || false,
      muted: muted || false,
      embedId,
      publicId: '',
      filename: ''
    };

    tab.videos.push(newVideo);
    tab.updatedAt = Date.now();
    await policy.save();

    res.status(201).json({
      message: 'Video added to tab successfully',
      video: newVideo,
      embedCode: `[VIDEO:${embedId}]`
    });
  } catch (error) {
    console.error('Error adding video to tab:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/api/admin/policy/:id/tabs/:tabId/videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, tabId, embedId } = req.params;
    const { url, title, caption, position, autoplay, muted } = req.body;

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    const video = tab.videos.find(vid => vid.embedId === embedId);

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (url) {
      const videoInfo = extractVideoInfo(url);
      if (!videoInfo) {
        return res.status(400).json({ message: 'Invalid video URL' });
      }
      video.url = videoInfo.url;
      video.videoId = videoInfo.videoId;
      video.platform = videoInfo.platform;
    }

    if (title !== undefined) video.title = title;
    if (caption !== undefined) video.caption = caption;
    if (position) video.position = position;
    if (autoplay !== undefined) video.autoplay = autoplay;
    if (muted !== undefined) video.muted = muted;

    tab.updatedAt = Date.now();
    await policy.save();

    res.json({
      message: 'Video updated successfully',
      video: video
    });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/api/admin/policy/:id/tabs/:tabId/videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, tabId, embedId } = req.params;

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    const videoIndex = tab.videos.findIndex(vid => vid.embedId === embedId);

    if (videoIndex === -1) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const video = tab.videos[videoIndex];
    if (video.publicId) {
      await cloudinary.uploader.destroy(video.publicId);
    }

    tab.videos.splice(videoIndex, 1);
    tab.updatedAt = Date.now();
    await policy.save();

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/api/admin/policy/:id/tabs/:tabId/documents', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    const { id, tabId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'Document file is required' });
    }

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    const documentId = 'pol_doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const newDocument = {
      url: req.file.path,
      filename: req.file.originalname,
      publicId: req.file.filename,
      documentId
    };

    tab.documents.push(newDocument);
    tab.updatedAt = Date.now();
    await policy.save();

    res.status(201).json({
      message: 'Document added to tab successfully',
      document: newDocument
    });
  } catch (error) {
    console.error('Error adding document to tab:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/api/admin/policy/:id/tabs/:tabId/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const { id, tabId, documentId } = req.params;

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    const docIndex = tab.documents.findIndex(doc => doc.documentId === documentId);

    if (docIndex === -1) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const document = tab.documents[docIndex];
    if (document.publicId) {
      await cloudinary.uploader.destroy(document.publicId);
    }

    tab.documents.splice(docIndex, 1);
    tab.updatedAt = Date.now();
    await policy.save();

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/api/admin/policy/:id/tabs/:tabId', authenticateToken, async (req, res) => {
  try {
    const { id, tabId } = req.params;
    const { tabName, tabOrder, isActive } = req.body;

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tab = policy.tabs.find(t => t.tabId === tabId);

    if (!tab) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    if (tabName) tab.tabName = tabName;
    if (tabOrder !== undefined) tab.tabOrder = tabOrder;
    if (isActive !== undefined) tab.isActive = isActive;
    tab.updatedAt = Date.now();

    await policy.save();

    res.json({
      message: 'Tab updated successfully',
      tab: {
        _id: tab._id,
        tabId: tab.tabId,
        tabName: tab.tabName,
        tabOrder: tab.tabOrder,
        isActive: tab.isActive,
        updatedAt: tab.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating tab:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/api/admin/policy/:id/tabs/:tabId', authenticateToken, async (req, res) => {
  try {
    const { id, tabId } = req.params;

    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to modify this policy' });
    }

    const tabIndex = policy.tabs.findIndex(t => t.tabId === tabId);

    if (tabIndex === -1) {
      return res.status(404).json({ message: 'Tab not found' });
    }

    const tab = policy.tabs[tabIndex];
    
    for (const image of tab.images) {
      if (image.publicId) {
        await cloudinary.uploader.destroy(image.publicId);
      }
    }
    
    for (const video of tab.videos) {
      if (video.publicId) {
        await cloudinary.uploader.destroy(video.publicId);
      }
    }
    
    for (const document of tab.documents) {
      if (document.publicId) {
        await cloudinary.uploader.destroy(document.publicId);
      }
    }

    policy.tabs.splice(tabIndex, 1);
    await policy.save();

    res.json({ message: 'Tab deleted successfully' });
  } catch (error) {
    console.error('Error deleting tab:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/admin/policy', authenticateToken, async (req, res) => {
  try {
    const policies = await Policy.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    const policiesWithInfo = policies.map(policy => ({
      _id: policy._id,
      policyType: policy.policyType,
      tabsCount: policy.tabs.length,
      tabs: policy.getAllTabs().map(tab => ({
        _id: tab._id,
        tabId: tab.tabId,
        tabName: tab.tabName,
        tabOrder: tab.tabOrder,
        isActive: tab.isActive,
        imagesCount: tab.images.length,
        videosCount: tab.videos.length,
        documentsCount: tab.documents.length,
        contentLength: tab.content.length,
        createdAt: tab.createdAt,
        updatedAt: tab.updatedAt
      })),
      isActive: policy.isActive,
      createdBy: policy.createdBy,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt
    }));

    res.json({ policies: policiesWithInfo });
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/admin/policy/:id', authenticateToken, async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const tabs = policy.getAllTabs().map(tab => ({
      _id: tab._id,
      tabId: tab.tabId,
      tabName: tab.tabName,
      content: tab.content,
      contentFormat: tab.contentFormat,
      renderedContent: policy.getRenderedTabContent(tab.tabId),
      images: tab.images,
      videos: tab.videos,
      documents: tab.documents,
      tabOrder: tab.tabOrder,
      isActive: tab.isActive,
      imagesCount: tab.images.length,
      videosCount: tab.videos.length,
      documentsCount: tab.documents.length,
      createdAt: tab.createdAt,
      updatedAt: tab.updatedAt
    }));

    res.json({
      policy: {
        _id: policy._id,
        policyType: policy.policyType,
        tabs: tabs,
        isActive: policy.isActive,
        createdBy: policy.createdBy,
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/admin/policy/:id', authenticateToken, async (req, res) => {
  try {
    const { isActive } = req.body;

    const policy = await Policy.findById(req.params.id);

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ error: 'Not authorized to update this policy' });
    }

    if (isActive !== undefined) policy.isActive = isActive;
    policy.updatedAt = Date.now();

    await policy.save();

    res.json({
      message: 'Policy updated successfully',
      policy: {
        _id: policy._id,
        policyType: policy.policyType,
        isActive: policy.isActive,
        updatedAt: policy.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/admin/policy/:id', authenticateToken, async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    if (policy.createdBy.toString() !== req.user.admin_id) {
      return res.status(403).json({ error: 'Not authorized to delete this policy' });
    }

    for (const tab of policy.tabs) {
      for (const image of tab.images) {
        if (image.publicId) {
          await cloudinary.uploader.destroy(image.publicId);
        }
      }
      for (const video of tab.videos) {
        if (video.publicId) {
          await cloudinary.uploader.destroy(video.publicId);
        }
      }
      for (const document of tab.documents) {
        if (document.publicId) {
          await cloudinary.uploader.destroy(document.publicId);
        }
      }
    }

    await Policy.findByIdAndDelete(req.params.id);

    res.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting policy:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/policy/:policyType', async (req, res) => {
  try {
    const { policyType } = req.params;

    const policy = await Policy.findOne({ policyType, isActive: true });

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const tabs = policy.getAllTabs().map(tab => ({
      _id: tab._id,
      tabId: tab.tabId,
      tabName: tab.tabName,
      content: tab.content,
      contentFormat: tab.contentFormat,
      renderedContent: policy.getRenderedTabContent(tab.tabId),
      images: tab.images,
      videos: tab.videos,
      documents: tab.documents,
      tabOrder: tab.tabOrder,
      imagesCount: tab.images.length,
      videosCount: tab.videos.length,
      documentsCount: tab.documents.length
    }));

    res.json({
      policy: {
        _id: policy._id,
        policyType: policy.policyType,
        tabs: tabs,
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/policy', async (req, res) => {
  try {
    const policies = await Policy.find({ isActive: true }).select('policyType _id');
    // ✅ Only select what you need (inclusion only)

    res.json({
      policies: policies.map(p => ({
        _id: p._id,
        policyType: p.policyType
      }))
    });
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;