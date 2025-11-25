const express = require("express");
const router = express.Router();
const SocialMediaEmbed= require('../models/socialMediaEmbedSchema');
const authenticateToken = require("../middlewares/authMiddleware");
router.post('/api/admin/social-embeds', authenticateToken, async (req, res) => {
  try {
    const { title, platform, embedUrl, embedCode, description } = req.body;
    
    
    if (!title || !platform || !embedUrl || !embedCode) {
      return res.status(400).json({ 
        message: 'Title, platform, embed URL and embed code are required' 
      });
    }
    
    
    if (!['twitter', 'facebook', 'linkedin'].includes(platform)) {
      return res.status(400).json({ 
        message: 'Platform must be twitter, facebook, or linkedin' 
      });
    }
    
    
    const newEmbed = new SocialMediaEmbed({
      title,
      platform,
      embedUrl,
      embedCode,
      description,
      author: req.user.admin_id
    });
    
    await newEmbed.save();
    
    res.status(201).json({
      message: 'Social media embed created successfully',
      embed: {
        id: newEmbed._id,
        title: newEmbed.title,
        platform: newEmbed.platform,
        embedUrl: newEmbed.embedUrl,
        description: newEmbed.description,
        isActive: newEmbed.isActive,
        createdAt: newEmbed.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating social media embed:', error);
    res.status(500).json({ message: error.message });
  }
});


router.put('/api/admin/social-embeds/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, platform, embedUrl, embedCode, description, isActive } = req.body;
    
    
    const embed = await SocialMediaEmbed.findById(id);
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found' });
    }
    
    
    if (embed.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to update this embed' });
    }
    
    
    if (title) embed.title = title;
    if (platform && ['twitter', 'facebook', 'linkedin'].includes(platform)) {
      embed.platform = platform;
    }
    if (embedUrl) embed.embedUrl = embedUrl;
    if (embedCode) embed.embedCode = embedCode;
    if (description !== undefined) embed.description = description;
    if (isActive !== undefined) embed.isActive = isActive;
    
    embed.updatedAt = new Date();
    await embed.save();
    
    res.json({
      message: 'Social media embed updated successfully',
      embed: {
        id: embed._id,
        title: embed.title,
        platform: embed.platform,
        embedUrl: embed.embedUrl,
        description: embed.description,
        isActive: embed.isActive,
        updatedAt: embed.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating social media embed:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/admin/social-embeds/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    
    const embed = await SocialMediaEmbed.findById(id);
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found' });
    }
    
    
    if (embed.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to delete this embed' });
    }
    
    await SocialMediaEmbed.findByIdAndDelete(id);
    
    res.json({ message: 'Social media embed deleted successfully' });
  } catch (error) {
    console.error('Error deleting social media embed:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/admin/social-embeds', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, platform } = req.query;
    
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    
    const filter = {};
    if (platform && ['twitter', 'facebook', 'linkedin'].includes(platform)) {
      filter.platform = platform;
    }
    
    
    const embeds = await SocialMediaEmbed.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'name email');
    
    const total = await SocialMediaEmbed.countDocuments(filter);
    
    res.json({
      embeds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching social media embeds for admin:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/admin/social-embeds/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const embed = await SocialMediaEmbed.findById(id)
      .populate('author', 'name email');
    
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found' });
    }
    
    res.json({ embed });
  } catch (error) {
    console.error('Error fetching social media embed details for admin:', error);
    res.status(500).json({ message: error.message });
  }
});


router.patch('/api/admin/social-embeds/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const embed = await SocialMediaEmbed.findById(id);
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found' });
    }
    
    
    if (embed.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to modify this embed' });
    }
    
    embed.isActive = !embed.isActive;
    embed.updatedAt = new Date();
    await embed.save();
    
    res.json({
      message: `Embed ${embed.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: embed.isActive
    });
  } catch (error) {
    console.error('Error toggling embed status:', error);
    res.status(500).json({ message: error.message });
  }
});



router.get('/api/social-embeds', async (req, res) => {
  try {
    const { page = 1, limit = 10, platform } = req.query;
    
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    
    const filter = { isActive: true };
    if (platform && ['twitter', 'facebook', 'linkedin'].includes(platform)) {
      filter.platform = platform;
    }
    
    
    const embeds = await SocialMediaEmbed.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('title platform embedUrl embedCode description createdAt updatedAt')
      .lean();
    
    const total = await SocialMediaEmbed.countDocuments(filter);
    
    res.json({
      embeds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching public social media embeds:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/social-embeds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const embed = await SocialMediaEmbed.findOne({ 
      _id: id, 
      isActive: true 
    }).select('title platform embedUrl embedCode description createdAt updatedAt');
    
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found or inactive' });
    }
    
    res.json({ embed });
  } catch (error) {
    console.error('Error fetching public social media embed:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/social-embeds/platform/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    
    if (!['twitter', 'facebook', 'linkedin'].includes(platform)) {
      return res.status(400).json({ message: 'Invalid platform' });
    }
    
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    
    const embeds = await SocialMediaEmbed.find({ 
      platform, 
      isActive: true 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('title platform embedUrl embedCode description createdAt updatedAt')
      .lean();
    
    const total = await SocialMediaEmbed.countDocuments({ 
      platform, 
      isActive: true 
    });
    
    res.json({
      embeds,
      platform,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching embeds by platform:', error);
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;