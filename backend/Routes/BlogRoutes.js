const express = require("express");
const router = express.Router();
const mongoose = require('mongoose');
const authenticateToken = require("../middlewares/authMiddleware");
const cleanupUnusedImages = require("../utils/cleanupUnusedImages");
const cleanupUnusedVideos = require("../utils/cleanupUnusedVideos");
const extractPlainText = require("../utils/extractPlainText");
const extractVideoInfo = require("../utils/extractVideoInfo");
const  processContent = require("../utils/processContent");
const validateApiKey = require("../utils/validateApiKey");
const Blog = require("../models/blog");
const moderateContent = require("../utils/moderateContent");
const { body, validationResult } = require('express-validator');
const  Comment = require('../models/comment');
const  CommentReaction = require('../models/commentreaction');
const Reaction = require("../models/reaction");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getFingerprintFromRequest } = require("../utils/GenerateFingerprint");
const cachemiddleware = require("../middlewares/cacheMiddleware");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const { 
  generateQueryEmbedding, 
  cosineSimilarity,
  doextractPlainText,
  generateBlogEmbedding  // ADD THIS
} = require('../services/embeddingService');
router.post('/api/blogs', authenticateToken, async (req, res) => {
  try {
    const { title, content, summary, status, tags, featuredImage, contentImages, contentVideos } = req.body;
    
    // Validate required fields
    if (!title || !content || !summary) {
      return res.status(400).json({ message: 'Title, content, and summary are required' });
    }
    
    // Clean up unused images and videos
    const cleanedImages = cleanupUnusedImages(content, contentImages || []);
    const cleanedVideos = cleanupUnusedVideos(content, contentVideos || []);
    
    const newBlog = new Blog({
      title,
      content,
      summary,
      author: req.user.admin_id,
      status: status || 'draft',
      tags: tags || [],
      featuredImage,
      contentImages: cleanedImages,
      contentVideos: cleanedVideos
    });
    
    await newBlog.save();
    
    // ✅ AUTO-GENERATE EMBEDDING IF PUBLISHED
    if (newBlog.status === 'published') {
      try {
        await generateBlogEmbedding(newBlog);
        await newBlog.save();
        console.log(`✅ Embedding auto-generated for: "${newBlog.title}"`);
      } catch (embeddingError) {
        console.error('⚠️ Embedding generation failed (non-critical):', embeddingError.message);
        // Don't fail the entire request - embedding can be generated later
      }
    }
    
    res.status(201).json({
      message: 'Blog post created successfully',
      blog: newBlog,
      embeddingGenerated: newBlog.status === 'published' && !!newBlog.embedding
    });
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({ message: error.message });
  }
});

  // Add image to blog content
  router.post('/api/blogs/:id/images', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { url, alt, caption, position } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: 'Image URL is required' });
      }
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check authorization
      if (blog.author.toString() !== req.user.admin_id) {
        return res.status(403).json({ message: 'Not authorized to modify this blog post' });
      }
      
      // Generate unique image ID
      const imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      const newImage = {
        url,
        alt: alt || '',
        caption: caption || '',
        position: position || 'center',
        imageId
      };
      
      blog.contentImages.push(newImage);
      await blog.save();
      
      res.status(201).json({
        message: 'Image added successfully',
        image: newImage,
        imageId: imageId,
        embedCode: `[IMAGE:${imageId}]`
      });
    } catch (error) {
      console.error('Error adding image:', error);
      res.status(500).json({ message: error.message });
    }
  });
  router.get('/api/admin/blogs/:identifier/read-stats', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    
    const query = isObjectId 
      ? { _id: identifier }
      : { slug: identifier };
    
    const blog = await Blog.findOne(query)
      .select('title slug totalReads readFingerprints status createdAt publishedAt')
      .exec();
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Calculate statistics
    const uniqueReaders = blog.readFingerprints.length;
    const totalReads = blog.totalReads;
    const averageReadsPerReader = uniqueReaders > 0 ? (totalReads / uniqueReaders).toFixed(2) : 0;
    
    // Get top readers (most reads from same fingerprint)
    const topReaders = blog.readFingerprints
      .sort((a, b) => b.readCount - a.readCount)
      .slice(0, 10)
      .map((rf, index) => ({
        rank: index + 1,
        readCount: rf.readCount,
        lastReadAt: rf.readAt
      }));
    
    // Calculate read trend (reads per day for last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentReads = blog.readFingerprints.filter(rf => rf.readAt >= thirtyDaysAgo);
    
    res.json({
      blog: {
        _id: blog._id,
        title: blog.title,
        slug: blog.slug,
        status: blog.status,
        createdAt: blog.createdAt,
        publishedAt: blog.publishedAt
      },
      readStats: {
        totalReads,
        uniqueReaders,
        averageReadsPerReader,
        topReaders,
        recentReadsLast30Days: recentReads.length
      }
    });
  } catch (error) {
    console.error('Error fetching read stats:', error);
    res.status(500).json({ message: error.message });
  }
});
  // Update content image
  router.put('/api/blogs/:id/images/:imageId', authenticateToken, async (req, res) => {
    try {
      const { id, imageId } = req.params;
      const { url, alt, caption, position } = req.body;
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check authorization
      if (blog.author.toString() !== req.user.admin_id) {
        return res.status(403).json({ message: 'Not authorized to modify this blog post' });
      }
      
      const imageIndex = blog.contentImages.findIndex(img => img.imageId === imageId);
      
      if (imageIndex === -1) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      // Update image properties
      if (url) blog.contentImages[imageIndex].url = url;
      if (alt !== undefined) blog.contentImages[imageIndex].alt = alt;
      if (caption !== undefined) blog.contentImages[imageIndex].caption = caption;
      if (position) blog.contentImages[imageIndex].position = position;
      
      await blog.save();
      
      res.json({
        message: 'Image updated successfully',
        image: blog.contentImages[imageIndex]
      });
    } catch (error) {
      console.error('Error updating image:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete content image
  router.delete('/api/blogs/:id/images/:imageId', authenticateToken, async (req, res) => {
    try {
      const { id, imageId } = req.params;
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check authorization
      if (blog.author.toString() !== req.user.admin_id) {
        return res.status(403).json({ message: 'Not authorized to modify this blog post' });
      }
      
      const imageIndex = blog.contentImages.findIndex(img => img.imageId === imageId);
      
      if (imageIndex === -1) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      blog.contentImages.splice(imageIndex, 1);
      await blog.save();
      
      res.json({ message: 'Image deleted successfully' });
    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all blog posts (with pagination and filtering)
router.get(
  "/api/blogs",
  cachemiddleware,   // <-- Caching applied ONLY here
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status, 
        tag,
        search,
        sortBy = "createdAt",
        sortOrder = "desc"
      } = req.query;

      const filter = {};

      if (status) {
        filter.status = status;
      } else {
        const isAuthenticated = req.user?.admin_id;
        if (!isAuthenticated) {
          filter.status = "published";
        }
      }

      if (tag) filter.tags = tag;

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
          { summary: { $regex: search, $options: "i" } }
        ];
      }

      const sort = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const blogs = await Blog.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("author", "name email")
        .exec();

      const processedBlogs = blogs.map(blog => {
        const blogObj = blog.toObject();
        blogObj.processedContent = processContent(
          blogObj.content,
          blogObj.contentImages,
          blogObj.contentVideos
        );
        return blogObj;
      });

      const total = await Blog.countDocuments(filter);

      res.json({
        blogs: processedBlogs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error("Error fetching blogs:", error);
      res.status(500).json({ message: error.message });
    }
  }
);
  
// UPDATED: Get a single blog post (with read tracking)
router.get(
  '/api/blogs/:identifier',
  cachemiddleware,   // <-- CACHE APPLIED SAFELY HERE
  async (req, res) => {
    try {
      const { identifier } = req.params;
      const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
      
      const query = isObjectId 
        ? { _id: identifier }
        : { slug: identifier };
      
      const isAuthenticated = req.user?.admin_id;
      if (!isAuthenticated) {
        query.status = 'published';
      }
      
      // Generate fingerprint
      const fingerprint = getFingerprintFromRequest(req);
      console.log('Generated fingerprint:', fingerprint);
      
      // Fetch blog (NO COMMENTS INCLUDED → SAFE TO CACHE)
      let blog = await Blog.findOne(query)
        .populate('author', 'name email profileImage designation location bio socialLinks')
        .exec();
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      console.log('Blog found:', blog._id);
      console.log('Current readFingerprints:', blog.readFingerprints);
      
      if (!blog.readFingerprints) {
        blog.readFingerprints = [];
      }
      
      const existingFingerprintIndex = blog.readFingerprints.findIndex(
        rf => rf.fingerprint === fingerprint
      );
      
      if (existingFingerprintIndex !== -1) {
        blog.readFingerprints[existingFingerprintIndex].readCount += 1;
        blog.readFingerprints[existingFingerprintIndex].readAt = new Date();
        console.log('Incremented existing fingerprint');
      } else {
        blog.readFingerprints.push({
          fingerprint,
          readAt: new Date(),
          readCount: 1
        });
        console.log('Added new fingerprint');
      }
      
      blog.totalReads += 1;
      await blog.save();
      console.log('Blog saved with readFingerprints');
      
      const blogObj = blog.toObject();
      
      const uniqueReaders = blog.readFingerprints.length;
      blogObj.uniqueReaders = uniqueReaders;
      
      blogObj.processedContent = processContent(
        blogObj.content,
        blogObj.contentImages,
        blogObj.contentVideos
      );
      
      delete blogObj.reports;
      delete blogObj.readFingerprints;
      
      console.log('Response:', { totalReads: blogObj.totalReads, uniqueReaders });
      
      res.json(blogObj);
    } catch (error) {
      console.error('Error fetching blog:', error);
      res.status(500).json({ message: error.message });
    }
  }
);



// NEW: Report a blog post (Public route)
router.post('/api/blogs/:identifier/report', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { userEmail, reason } = req.body;
    
    // Validation
    if (!userEmail || !reason) {
      return res.status(400).json({ 
        message: 'User email and reason are required' 
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({ 
        message: 'Invalid email format' 
      });
    }
    
    // Reason length validation
    if (reason.trim().length < 10 || reason.trim().length > 500) {
      return res.status(400).json({ 
        message: 'Reason must be between 10 and 500 characters' 
      });
    }
    
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    const query = isObjectId 
      ? { _id: identifier }
      : { slug: identifier };
    
    // Only published blogs can be reported
    query.status = 'published';
    
    const blog = await Blog.findOne(query);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check if user has already reported this blog
    const existingReport = blog.reports.find(
      report => report.userEmail.toLowerCase() === userEmail.toLowerCase()
    );
    
    if (existingReport) {
      return res.status(400).json({ 
        message: 'You have already reported this blog post' 
      });
    }
    
    // Add the report
    blog.reports.push({
      userEmail: userEmail.toLowerCase().trim(),
      reason: reason.trim(),
      timestamp: new Date()
    });
    
    await blog.save();
    
    res.status(201).json({ 
      message: 'Report submitted successfully',
      totalReports: blog.totalReports
    });
  } catch (error) {
    console.error('Error reporting blog:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: Get reports for a specific blog (Admin only)
router.get('/api/blogs/:identifier/reports', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    
    const query = isObjectId 
      ? { _id: identifier }
      : { slug: identifier };
    
    const blog = await Blog.findOne(query)
      .select('title slug reports totalReports')
      .exec();
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    res.json({
      blogId: blog._id,
      title: blog.title,
      slug: blog.slug,
      totalReports: blog.totalReports,
      reports: blog.reports
    });
  } catch (error) {
    console.error('Error fetching blog reports:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: Delete a specific report (Admin only)
router.delete('/api/blogs/:identifier/reports/:reportId', authenticateToken, async (req, res) => {
  try {
    const { identifier, reportId } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    
    const query = isObjectId 
      ? { _id: identifier }
      : { slug: identifier };
    
    const blog = await Blog.findOne(query);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    const reportIndex = blog.reports.findIndex(
      report => report._id.toString() === reportId
    );
    
    if (reportIndex === -1) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    blog.reports.splice(reportIndex, 1);
    await blog.save();
    
    res.json({ 
      message: 'Report deleted successfully',
      totalReports: blog.totalReports
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: Clear all reports for a specific blog (Admin only)
router.delete('/api/blogs/:identifier/reports', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    
    const query = isObjectId 
      ? { _id: identifier }
      : { slug: identifier };
    
    const blog = await Blog.findOne(query);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    blog.reports = [];
    await blog.save();
    
    res.json({ 
      message: 'All reports cleared successfully',
      totalReports: blog.totalReports
    });
  } catch (error) {
    console.error('Error clearing reports:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: Get all blogs with reports (Admin only)
router.get('/api/blogs/reports/all', authenticateToken, async (req, res) => {
  try {
    const blogs = await Blog.find({ totalReports: { $gt: 0 } })
      .select('title slug totalReports reports status createdAt')
      .populate('author', 'name email')
      .sort('-totalReports')
      .exec();
    
    res.json(blogs);
  } catch (error) {
    console.error('Error fetching blogs with reports:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: Get blog statistics (Admin only)
// ============================================
// UPDATED ROUTE: Get blog statistics (Admin only)
// ============================================
router.get('/api/blogs/:identifier/stats', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    
    const query = isObjectId 
      ? { _id: identifier }
      : { slug: identifier };
    
    const blog = await Blog.findOne(query)
      .select('title slug totalReads totalReports reactionCounts commentsCount status publishedAt createdAt readFingerprints')
      .populate('author', 'name email')
      .exec();
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    const uniqueReaders = blog.readFingerprints.length;
    
    res.json({
      blogId: blog._id,
      title: blog.title,
      slug: blog.slug,
      status: blog.status,
      author: blog.author,
      publishedAt: blog.publishedAt,
      createdAt: blog.createdAt,
      stats: {
        totalReads: blog.totalReads,
        uniqueReaders: uniqueReaders,
        totalReports: blog.totalReports,
        likes: blog.reactionCounts.likes,
        dislikes: blog.reactionCounts.dislikes,
        commentsCount: blog.commentsCount
      }
    });
  } catch (error) {
    console.error('Error fetching blog stats:', error);
    res.status(500).json({ message: error.message });
  }
});
// NEW: Get overall blog statistics (Admin only)
router.get('/api/blogs/stats/overview', authenticateToken, async (req, res) => {
  try {
    const totalBlogs = await Blog.countDocuments();
    const publishedBlogs = await Blog.countDocuments({ status: 'published' });
    const draftBlogs = await Blog.countDocuments({ status: 'draft' });
    const blogsWithReports = await Blog.countDocuments({ totalReports: { $gt: 0 } });
    
    // Calculate total reads and unique readers
    const readStatsResult = await Blog.aggregate([
      { 
        $group: { 
          _id: null, 
          totalReads: { $sum: '$totalReads' },
          totalUniqueReaders: { $sum: { $size: '$readFingerprints' } }
        } 
      }
    ]);
    
    const totalReportsResult = await Blog.aggregate([
      { $group: { _id: null, totalReports: { $sum: '$totalReports' } } }
    ]);
    
    const totalReactionsResult = await Blog.aggregate([
      { 
        $group: { 
          _id: null, 
          totalLikes: { $sum: '$reactionCounts.likes' },
          totalDislikes: { $sum: '$reactionCounts.dislikes' }
        } 
      }
    ]);
    
    const mostReadBlogs = await Blog.find({ status: 'published' })
      .select('title slug totalReads publishedAt readFingerprints')
      .sort('-totalReads')
      .limit(5)
      .exec();
    
    // Add unique readers count to most read blogs
    const mostReadBlogsWithUnique = mostReadBlogs.map(blog => ({
      title: blog.title,
      slug: blog.slug,
      totalReads: blog.totalReads,
      uniqueReaders: blog.readFingerprints.length,
      publishedAt: blog.publishedAt
    }));
    
    const mostReportedBlogs = await Blog.find({ totalReports: { $gt: 0 } })
      .select('title slug totalReports status')
      .sort('-totalReports')
      .limit(5)
      .exec();
    
    res.json({
      overview: {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        blogsWithReports,
        totalReads: readStatsResult[0]?.totalReads || 0,
        totalUniqueReaders: readStatsResult[0]?.totalUniqueReaders || 0,
        totalReports: totalReportsResult[0]?.totalReports || 0,
        totalLikes: totalReactionsResult[0]?.totalLikes || 0,
        totalDislikes: totalReactionsResult[0]?.totalDislikes || 0
      },
      mostReadBlogs: mostReadBlogsWithUnique,
      mostReportedBlogs
    });
  } catch (error) {
    console.error('Error fetching blog overview stats:', error);
    res.status(500).json({ message: error.message });
  }
});
// Update a blog post (updated to handle videos)
// Update a blog post (updated to handle videos + auto-embedding)
router.put('/api/blogs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    if (blog.author.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to update this blog post' });
    }
    
    // ✅ TRACK CHANGES THAT AFFECT EMBEDDINGS
    const wasPublished = blog.status === 'published';
    const contentChanged = updates.content !== undefined || 
                          updates.title !== undefined || 
                          updates.summary !== undefined;
    
    const allowedUpdates = ['title', 'content', 'summary', 'status', 'tags', 'featuredImage', 'contentImages', 'contentVideos'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        blog[field] = updates[field];
      }
    });
    
    // Clean up unused media if content was updated
    if (updates.content !== undefined) {
      blog.contentImages = cleanupUnusedImages(updates.content, blog.contentImages);
      blog.contentVideos = cleanupUnusedVideos(updates.content, blog.contentVideos);
    }
    
    await blog.save();
    
    // ✅ AUTO-REGENERATE EMBEDDING IF NEEDED
    const isNowPublished = blog.status === 'published';
    const shouldRegenerateEmbedding = isNowPublished && (
      contentChanged ||                    // Content/title/summary changed
      (!wasPublished && isNowPublished)   // Draft → Published transition
    );
    
    if (shouldRegenerateEmbedding) {
      try {
        await generateBlogEmbedding(blog);
        await blog.save();
        console.log(`✅ Embedding auto-regenerated for: "${blog.title}"`);
      } catch (embeddingError) {
        console.error('⚠️ Embedding regeneration failed (non-critical):', embeddingError.message);
        // Don't fail the entire request
      }
    }
    
    const blogObj = blog.toObject();
    blogObj.processedContent = processContent(blogObj.content, blogObj.contentImages, blogObj.contentVideos);
    
    res.json({
      message: 'Blog post updated successfully',
      blog: blogObj,
      embeddingRegenerated: shouldRegenerateEmbedding && !!blog.embedding
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({ message: error.message });
  }
});
  
  
  // Delete a blog post
  router.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find blog post
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check if user is the author or has admin rights
      if (blog.author.toString() !== req.user.admin_id) {
        return res.status(403).json({ message: 'Not authorized to delete this blog post' });
      }
      
      await Blog.findByIdAndDelete(id);
      
      res.json({ message: 'Blog post deleted successfully' });
    } catch (error) {
      console.error('Error deleting blog:', error);
      res.status(500).json({ message: error.message });
    }
  });
  // Get all images for a specific blog post
  router.get('/api/blogs/:id/images', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check authorization
      if (blog.author.toString() !== req.user.admin_id ) {
        return res.status(403).json({ message: 'Not authorized to view this blog post images' });
      }
      
      res.json({
        images: blog.contentImages,
        totalImages: blog.contentImages.length
      });
    } catch (error) {
      console.error('Error fetching blog images:', error);
      res.status(500).json({ message: error.message });
    }
  });




  // Video Routes for Blog Posts

// Add video to blog content
router.post('/api/blogs/:id/videos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { url, title, caption, position, autoplay, muted } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'Video URL is required' });
    }
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check authorization
    if (blog.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to modify this blog post' });
    }
    
    // Extract video info from URL
    const videoInfo = extractVideoInfo(url);
    
    if (!videoInfo) {
      return res.status(400).json({ message: 'Invalid video URL. Currently supported: YouTube, Vimeo, Dailymotion' });
    }
    
    // Generate unique embed ID
    const embedId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
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
    
    blog.contentVideos.push(newVideo);
    await blog.save();
    
    res.status(201).json({
      message: 'Video added successfully',
      video: newVideo,
      embedId: embedId,
      embedCode: `[VIDEO:${embedId}]`
    });
  } catch (error) {
    console.error('Error adding video:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update content video
router.put('/api/blogs/:id/videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, embedId } = req.params;
    const { url, title, caption, position, autoplay, muted } = req.body;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check authorization
    if (blog.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to modify this blog post' });
    }
    
    const videoIndex = blog.contentVideos.findIndex(vid => vid.embedId === embedId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Update video properties
    if (url) {
      const videoInfo = extractVideoInfo(url);
      if (!videoInfo) {
        return res.status(400).json({ message: 'Invalid video URL' });
      }
      blog.contentVideos[videoIndex].url = videoInfo.url;
      blog.contentVideos[videoIndex].videoId = videoInfo.videoId;
      blog.contentVideos[videoIndex].platform = videoInfo.platform;
    }
    
    if (title !== undefined) blog.contentVideos[videoIndex].title = title;
    if (caption !== undefined) blog.contentVideos[videoIndex].caption = caption;
    if (position) blog.contentVideos[videoIndex].position = position;
    if (autoplay !== undefined) blog.contentVideos[videoIndex].autoplay = autoplay;
    if (muted !== undefined) blog.contentVideos[videoIndex].muted = muted;
    
    await blog.save();
    
    res.json({
      message: 'Video updated successfully',
      video: blog.contentVideos[videoIndex]
    });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete content video
router.delete('/api/blogs/:id/videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, embedId } = req.params;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check authorization
    if (blog.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to modify this blog post' });
    }
    
    const videoIndex = blog.contentVideos.findIndex(vid => vid.embedId === embedId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    blog.contentVideos.splice(videoIndex, 1);
    await blog.save();
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all videos for a specific blog post
router.get('/api/blogs/:id/videos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check authorization
    if (blog.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to view this blog post videos' });
    }
    
    res.json({
      videos: blog.contentVideos,
      totalVideos: blog.contentVideos.length
    });
  } catch (error) {
    console.error('Error fetching blog videos:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate summary for a blog post (Public route)
router.post('/api/blogs/:id/generate-summary', async (req, res) => {
  try {
    // Validate API key first
    validateApiKey();
    
    const { id } = req.params;
    const { wordLimit = 300, temperature = 0.7 } = req.body; // Made wordLimit configurable
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Extract plain text from blog content
    const plainTextContent = extractPlainText(blog.content);
    
    if (plainTextContent.length < 100) {
      return res.status(400).json({ 
        message: 'Blog content is too short to generate a meaningful summary' 
      });
    }
    
    // Create the prompt for Gemini with better structure
    const prompt = `Please create a comprehensive summary of the following blog post. The summary should:
    - Be approximately ${wordLimit} words long
    - Capture the main points and key insights
    - Be engaging and well-structured with clear paragraphs
    - Maintain the tone and style of the original content
    - Be suitable for readers who want a quick overview
    - Focus on the most important information and actionable insights
    - Generate different answer every time  but same meaining 
    Blog Title: "${blog.title}"
    
    Blog Content:
    ${plainTextContent}
    
    Please provide only the summary without any additional commentary, formatting, or meta-text.`;
    
    // Configure generation parameters for better results
    const generationConfig = {
      temperature: temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: Math.ceil(wordLimit * 1.5), // Allow some flexibility
    };
    
    const modelWithConfig = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: generationConfig
    });
    
    // Generate summary using Gemini with retry logic
    let result;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        result = await modelWithConfig.generateContent(prompt);
        break;
      } catch (retryError) {
        attempts++;
        if (attempts >= maxAttempts) throw retryError;
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
    
    const response = await result.response;
    let generatedSummary = response.text().trim();
    
    // Clean up any unwanted formatting that might be added
    generatedSummary = generatedSummary
      .replace(/^\*\*Summary\*\*:?\s*/i, '')
      .replace(/^\*\*\s*|\s*\*\*$/g, '')
      .trim();
    
    // Validate generated summary length (rough word count)
    const wordCount = generatedSummary.split(/\s+/).filter(word => word.length > 0).length;
    
    if (wordCount < Math.floor(wordLimit * 0.7)) {
      console.warn(`Generated summary word count (${wordCount}) is significantly below target (${wordLimit})`);
    }
    
    if (wordCount > wordLimit * 1.5) {
      console.warn(`Generated summary word count (${wordCount}) is significantly above target (${wordLimit})`);
    }
    
    res.json({
      message: 'Summary generated successfully',
      summary: generatedSummary,
      wordCount: wordCount,
      targetWordLimit: wordLimit,
      blogId: blog._id,
      blogTitle: blog.title,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error generating blog summary:', error);
    
    // Enhanced error handling with more specific cases
    if (error.message.includes('API_KEY') || error.message.includes('key')) {
      return res.status(500).json({ 
        message: 'Gemini API configuration error. Please check your API key.',
        code: 'API_KEY_ERROR'
      });
    }
    
    if (error.message.includes('quota') || error.message.includes('limit') || error.status === 429) {
      return res.status(429).json({ 
        message: 'API quota exceeded. Please try again later.',
        code: 'QUOTA_EXCEEDED'
      });
    }
    
    if (error.status === 404 || error.message.includes('model not found')) {
      return res.status(500).json({ 
        message: 'Gemini model not found. Please check the model configuration.',
        code: 'MODEL_NOT_FOUND'
      });
    }
    
    if (error.status === 400) {
      return res.status(400).json({ 
        message: 'Invalid request to Gemini API. Please check the content format.',
        code: 'INVALID_REQUEST'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to generate summary. Please try again.',
      code: 'GENERATION_FAILED',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update blog with AI-generated summary (Public route)
router.put('/api/blogs/:id/update-summary', async (req, res) => {
  try {
    const { id } = req.params;
    const { summary, replaceExisting = false } = req.body;
    
    if (!summary || typeof summary !== 'string') {
      return res.status(400).json({ message: 'Valid summary is required' });
    }
    
    if (summary.length > 2000) { // Increased limit for better summaries
      return res.status(400).json({ 
        message: 'Summary is too long. Maximum 2000 characters allowed.' 
      });
    }
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check if summary already exists and replaceExisting is false
    if (blog.summary && blog.summary.trim() !== '' && !replaceExisting) {
      return res.status(409).json({ 
        message: 'Blog already has a summary. Set replaceExisting to true to overwrite.',
        currentSummary: blog.summary 
      });
    }
    
    // Update the summary with metadata
    blog.summary = summary.trim();
    blog.summaryUpdatedAt = new Date();
    blog.summaryWordCount = summary.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    await blog.save();
    
    res.json({
      message: 'Blog summary updated successfully',
      blog: {
        _id: blog._id,
        title: blog.title,
        summary: blog.summary,
        summaryWordCount: blog.summaryWordCount,
        summaryUpdatedAt: blog.summaryUpdatedAt,
        updatedAt: blog.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Error updating blog summary:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate and auto-update summary in one step (Public route)
router.post('/api/blogs/:id/auto-summary', async (req, res) => {
  try {
    validateApiKey();
    
    const { id } = req.params;
    const { wordLimit = 300, forceUpdate = false, temperature = 0.7 } = req.body;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check if summary already exists
    if (blog.summary && blog.summary.trim() !== '' && !forceUpdate) {
      return res.status(409).json({ 
        message: 'Blog already has a summary. Set forceUpdate to true to regenerate.',
        currentSummary: blog.summary 
      });
    }
    
    // Generate summary (reuse logic from generate-summary route)
    const plainTextContent = extractPlainText(blog.content);
    
    if (plainTextContent.length < 100) {
      return res.status(400).json({ 
        message: 'Blog content is too short to generate a meaningful summary' 
      });
    }
    
    const prompt = `Please create a comprehensive summary of the following blog post. The summary should:
    - Be approximately ${wordLimit} words long
    - Capture the main points and key insights
    - Be engaging and well-structured with clear paragraphs
    - Maintain the tone and style of the original content
    - Be suitable for readers who want a quick overview
    - Focus on the most important information and actionable insights
    
    Blog Title: "${blog.title}"
    
    Blog Content:
    ${plainTextContent}
    
    Please provide only the summary without any additional commentary, formatting, or meta-text.`;
    
    const generationConfig = {
      temperature: temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: Math.ceil(wordLimit * 1.5),
    };
    
    const modelWithConfig = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: generationConfig
    });
    
    const result = await modelWithConfig.generateContent(prompt);
    const response = await result.response;
    let generatedSummary = response.text().trim();
    
    // Clean up formatting
    generatedSummary = generatedSummary
      .replace(/^\*\*Summary\*\*:?\s*/i, '')
      .replace(/^\*\*\s*|\s*\*\*$/g, '')
      .trim();
    
    // Update the blog with generated summary and metadata
    blog.summary = generatedSummary;
    blog.summaryUpdatedAt = new Date();
    blog.summaryWordCount = generatedSummary.split(/\s+/).filter(word => word.length > 0).length;
    
    await blog.save();
    
    res.json({
      message: 'Summary generated and updated successfully',
      blog: {
        _id: blog._id,
        title: blog.title,
        summary: blog.summary,
        summaryWordCount: blog.summaryWordCount,
        summaryUpdatedAt: blog.summaryUpdatedAt,
        updatedAt: blog.updatedAt
      },
      targetWordLimit: wordLimit
    });
    
  } catch (error) {
    console.error('Error in auto-summary generation:', error);
    
    // Apply same error handling as generate-summary route
    if (error.message.includes('API_KEY') || error.message.includes('key')) {
      return res.status(500).json({ 
        message: 'Gemini API configuration error. Please check your API key.',
        code: 'API_KEY_ERROR'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to generate and update summary. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get summary status for multiple blogs (batch check) - Public route
router.post('/api/blogs/summary-status', async (req, res) => {
  try {
    const { blogIds } = req.body;
    
    if (!Array.isArray(blogIds) || blogIds.length === 0) {
      return res.status(400).json({ message: 'Blog IDs array is required' });
    }
    
    if (blogIds.length > 100) { // Increased limit
      return res.status(400).json({ message: 'Maximum 100 blog IDs allowed per request' });
    }
    
    const blogs = await Blog.find({
      _id: { $in: blogIds }
    }).select('_id title summary summaryWordCount summaryUpdatedAt createdAt updatedAt');
    
    const summaryStatus = blogs.map(blog => ({
      blogId: blog._id,
      title: blog.title,
      hasSummary: !!(blog.summary && blog.summary.trim() !== ''),
      summaryLength: blog.summary ? blog.summary.length : 0,
      summaryWordCount: blog.summaryWordCount || (blog.summary ? blog.summary.split(/\s+/).length : 0),
      lastUpdated: blog.updatedAt,
      summaryUpdatedAt: blog.summaryUpdatedAt || null
    }));
    
    res.json({
      summaryStatus,
      totalBlogs: summaryStatus.length,
      blogsWithSummary: summaryStatus.filter(status => status.hasSummary).length,
      blogsWithoutSummary: summaryStatus.filter(status => !status.hasSummary).length,
      checkedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking summary status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Health check endpoint for API connectivity
router.get('/api/gemini/health', async (req, res) => {
  try {
    validateApiKey();
    
    // Test with a simple generation request
    const testModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const testResult = await testModel.generateContent("Say 'API is working' in exactly 3 words.");
    const testResponse = await testResult.response;
    
    res.json({
      status: 'healthy',
      model: 'gemini-2.0-flash',
      apiKeyConfigured: true,
      testResponse: testResponse.text().trim(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      apiKeyConfigured: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    });
  }
});
 router.get('/api/blogs/:blogId/comments', async (req, res) => {
  try {
    const { blogId } = req.params;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get only top-level approved comments (not replies)
    const comments = await Comment.find({ 
      blog: blogId,
      status: 'approved',
      parentComment: null // Only top-level comments
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Comment.countDocuments({
      blog: blogId,
      status: 'approved',
      parentComment: null
    });
    
    res.status(200).json({
      comments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
 
router.post(
  '/api/blogs/:blogId/comments',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('content').trim().notEmpty().withMessage('Comment content is required')
      .isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { blogId } = req.params;
      const { name, email, content } = req.body;

      const blog = await Blog.findById(blogId);
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }

      // Get fingerprint
      const fingerprint = getFingerprintFromRequest(req);

      console.log(`🔍 Moderating comment from ${name}...`);
      const moderation = await moderateContent(content, name);
      
      if (!moderation.approved) {
        console.log(`✅ Content moderation blocked comment from ${name} - Reason: ${moderation.reason}`);
        
        return res.status(422).json({
          message: 'Your comment cannot be posted as it strongly violates our community guidelines. Please be respectful and constructive in your contributions.',
          code: 'CONTENT_POLICY_VIOLATION',
          severity: moderation.severity,
          moderationId: `MOD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          hint: moderation.systemError 
            ? 'Your comment is under review. Please try again later.' 
            : 'Please review our community guidelines and post respectful, constructive content.'
        });
      }

      console.log(`✅ Content approved for ${name}`);

      const newComment = new Comment({
        blog: blogId,
        user: { name, email },
        content,
        fingerprint
      });

      await newComment.save();
      
      await Blog.findByIdAndUpdate(blogId, { $inc: { commentsCount: 1 } });

      res.status(201).json({ 
        message: 'Comment added successfully',
        comment: newComment
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ 
        message: 'Server error', 
        error: error.message,
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
);
// Public route: Delete user's own comment
router.delete('/api/comments/:commentId/user', 
  [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { email } = req.body;
      
      // Find the comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      // Check if the email matches the comment owner
      if (comment.user.email !== email) {
        return res.status(403).json({ message: 'You can only delete your own comments' });
      }

      // Prevent deletion of author comments through this route
      if (comment.isAuthorComment) {
        return res.status(403).json({ message: 'Author comments cannot be deleted through this route' });
      }

      // If it's a reply, update parent comment's replies count
      if (comment.parentComment) {
        await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });
      }
      
      // If comment was approved and is a top-level comment, update the blog comments count
      if (comment.status === 'approved' && !comment.parentComment) {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      }

      // Delete all replies to this comment if it's a top-level comment
      if (!comment.parentComment) {
        const repliesToDelete = await Comment.find({ parentComment: commentId });
        for (const reply of repliesToDelete) {
          // Delete reactions for each reply
          await CommentReaction.deleteMany({ comment: reply._id });
        }
        await Comment.deleteMany({ parentComment: commentId });
      }

      // Delete reactions for this comment
      await CommentReaction.deleteMany({ comment: commentId });
      
      await Comment.deleteOne({ _id: commentId });
      
      res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Error deleting user comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);
  
  // Admin route: Get all comments for a blog (including pending/rejected)
  router.get('/api/admin/blogs/:blogId/comments', authenticateToken, async (req, res) => {
    try {
      const { blogId } = req.params;
      
      // Pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Get all comments (status filter optional)
      const statusFilter = req.query.status ? { status: req.query.status } : {};
      
      const comments = await Comment.find({ 
        blog: blogId,
        ...statusFilter
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
      const total = await Comment.countDocuments({
        blog: blogId,
        ...statusFilter
      });
      
      res.status(200).json({
        comments,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching admin comments:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Admin route: Update comment status
  router.patch('/api/admin/comments/:commentId', authenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      const { status } = req.body;
      
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      // If comment was not approved before but is now being approved, increment the count
      if (comment.status !== 'approved' && status === 'approved') {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: 1 } });
      }
      
      // If comment was approved before but is now being unapproved, decrement the count
      if (comment.status === 'approved' && status !== 'approved') {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      }
      
      comment.status = status;
      await comment.save();
      
      res.status(200).json({ 
        message: 'Comment status updated',
        comment
      });
    } catch (error) {
      console.error('Error updating comment status:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Admin route: Delete comment
  router.delete('/api/admin/comments/:commentId', authenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      // If comment was approved, update the count on blog
      if (comment.status === 'approved') {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      }
      
      await Comment.deleteOne({ _id: commentId });
      
      res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

// POST comment route with content moderation
router.post(
  '/api/blogs/:blogId/comments',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('content').trim().notEmpty().withMessage('Comment content is required')
      .isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { blogId } = req.params;
      const { name, email, content } = req.body;

      const blog = await Blog.findById(blogId);
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }

      // Get fingerprint
      const fingerprint = getFingerprintFromRequest(req);

      console.log(`🔍 Moderating comment from ${name}...`);
      const moderation = await moderateContent(content, name);
      
      if (!moderation.approved) {
        console.log(`✅ Content moderation blocked comment from ${name} - Reason: ${moderation.reason}`);
        
        return res.status(422).json({
          message: 'Your comment cannot be posted as it strongly violates our community guidelines. Please be respectful and constructive in your contributions.',
          code: 'CONTENT_POLICY_VIOLATION',
          severity: moderation.severity,
          moderationId: `MOD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          hint: moderation.systemError 
            ? 'Your comment is under review. Please try again later.' 
            : 'Please review our community guidelines and post respectful, constructive content.'
        });
      }

      console.log(`✅ Content approved for ${name}`);

      const newComment = new Comment({
        blog: blogId,
        user: { name, email },
        content,
        fingerprint
      });

      await newComment.save();
      
      await Blog.findByIdAndUpdate(blogId, { $inc: { commentsCount: 1 } });

      res.status(201).json({ 
        message: 'Comment added successfully',
        comment: newComment
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ 
        message: 'Server error', 
        error: error.message,
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
);

// POST reply route with content moderation
router.post(
  '/api/comments/:commentId/replies',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('content').trim().notEmpty().withMessage('Reply content is required')
      .isLength({ max: 1000 }).withMessage('Reply cannot exceed 1000 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { name, email, content } = req.body;

      const parentComment = await Comment.findById(commentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }

      if (parentComment.status !== 'approved') {
        return res.status(400).json({ 
          message: 'Cannot reply to unapproved comment',
          code: 'PARENT_NOT_APPROVED'
        });
      }

      // Get fingerprint
      const fingerprint = getFingerprintFromRequest(req);

      console.log(`🔍 Moderating reply from ${name}...`);
      const moderation = await moderateContent(content, name);
      
      if (!moderation.approved) {
        console.log(`✅ Content moderation blocked reply from ${name} - Reason: ${moderation.reason}`);
        
        return res.status(422).json({
          message: 'Your reply cannot be posted as it strongly violates our community guidelines. Please be respectful and constructive in your contributions.',
          code: 'CONTENT_POLICY_VIOLATION',
          severity: moderation.severity,
          moderationId: `MOD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          hint: moderation.systemError 
            ? 'Your reply is under review. Please try again later.' 
            : 'Please review our community guidelines and post respectful, constructive content.'
        });
      }

      console.log(`✅ Content approved for ${name}`);

      const newReply = new Comment({
        blog: parentComment.blog,
        user: { name, email },
        content,
        parentComment: commentId,
        fingerprint
      });

      await newReply.save();
      
      await Comment.findByIdAndUpdate(commentId, { $inc: { repliesCount: 1 } });

      res.status(201).json({ 
        message: 'Reply added successfully',
        reply: newReply
      });
    } catch (error) {
      console.error('Error adding reply:', error);
      res.status(500).json({ 
        message: 'Server error', 
        error: error.message,
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
);
// Get replies for a comment
router.get('/api/comments/:commentId/replies', async (req, res) => {
  try {
    const { commentId } = req.params;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get approved replies
    const replies = await Comment.find({ 
      parentComment: commentId,
      status: 'approved'
    })
    .sort({ createdAt: 1 }) // Replies in chronological order
    .skip(skip)
    .limit(limit);
    
    const total = await Comment.countDocuments({
      parentComment: commentId,
      status: 'approved'
    });
    
    res.status(200).json({
      replies,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Add/Remove reaction to a comment
router.post(
  '/api/comments/:commentId/reactions',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('type').isIn(['like', 'dislike']).withMessage('Type must be like or dislike')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { name, email, type } = req.body;

      const comment = await Comment.findOne({ _id: commentId, status: 'approved' });
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found or not approved' });
      }

      // Get fingerprint
      const fingerprint = getFingerprintFromRequest(req);

      const existingReaction = await CommentReaction.findOne({
        comment: commentId,
        'user.email': email
      });

      if (existingReaction) {
        if (existingReaction.type === type) {
          await CommentReaction.deleteOne({ _id: existingReaction._id });
          
          if (type === 'like') {
            await Comment.findByIdAndUpdate(commentId, { $inc: { 'reactionCounts.likes': -1 } });
          } else {
            await Comment.findByIdAndUpdate(commentId, { $inc: { 'reactionCounts.dislikes': -1 } });
          }
          
          return res.status(200).json({ 
            message: `${type} removed successfully`,
            reactionRemoved: true
          });
        } else {
          existingReaction.type = type;
          existingReaction.fingerprint = fingerprint;
          await existingReaction.save();
          
          if (type === 'like') {
            await Comment.findByIdAndUpdate(commentId, { 
              $inc: { 
                'reactionCounts.likes': 1,
                'reactionCounts.dislikes': -1
              } 
            });
          } else {
            await Comment.findByIdAndUpdate(commentId, { 
              $inc: { 
                'reactionCounts.likes': -1,
                'reactionCounts.dislikes': 1
              } 
            });
          }
          
          return res.status(200).json({
            message: `Reaction changed to ${type}`,
            reaction: existingReaction
          });
        }
      }

      const newReaction = new CommentReaction({
        comment: commentId,
        type,
        user: { name, email },
        fingerprint
      });

      await newReaction.save();
      
      if (type === 'like') {
        await Comment.findByIdAndUpdate(commentId, { $inc: { 'reactionCounts.likes': 1 } });
      } else {
        await Comment.findByIdAndUpdate(commentId, { $inc: { 'reactionCounts.dislikes': 1 } });
      }

      res.status(201).json({ 
        message: `${type} added successfully`,
        reaction: newReaction
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: 'You have already reacted to this comment' });
      }
      console.error('Error adding comment reaction:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Get user's reaction to a comment
router.get('/api/comments/:commentId/reactions/user', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const reaction = await CommentReaction.findOne({
      comment: commentId,
      'user.email': email
    });
    
    if (!reaction) {
      return res.status(200).json({ hasReacted: false });
    }
    
    res.status(200).json({
      hasReacted: true,
      reactionType: reaction.type
    });
  } catch (error) {
    console.error('Error fetching user comment reaction:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get reaction counts for a comment
router.get('/api/comments/:commentId/reactions/count', async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const comment = await Comment.findById(commentId, 'reactionCounts');
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    res.status(200).json({
      likes: comment.reactionCounts.likes || 0,
      dislikes: comment.reactionCounts.dislikes || 0
    });
  } catch (error) {
    console.error('Error fetching comment reaction counts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
  // Author route: Add author comment (requires authentication)
router.post(
  '/api/blogs/:blogId/author-comment',
  authenticateToken, // Assuming you have auth middleware
  [
    body('content').trim().notEmpty().withMessage('Comment content is required')
      .isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { blogId } = req.params;
      const { content } = req.body;

      // Check if blog exists
      const blog = await Blog.findById(blogId);
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }

      // Create new author comment
      const newComment = new Comment({
        blog: blogId,
        user: { 
          name: req.user.name || 'Aaditiya Tyagi', // Get from authenticated user
          email: req.user.email // Get from authenticated user
        },
        content,
        isAuthorComment: true,
        status: 'approved' // Author comments are auto-approved
      });

      await newComment.save();
      
      // Update blog comments count
      await Blog.findByIdAndUpdate(blogId, { $inc: { commentsCount: 1 } });

      res.status(201).json({ 
        message: 'Author comment added successfully',
        comment: newComment
      });
    } catch (error) {
      console.error('Error adding author comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Author route: Get author comments for a blog
router.get('/api/blogs/:blogId/author-comments', authenticateToken, async (req, res) => {
  try {
    const { blogId } = req.params;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get only author comments
    const comments = await Comment.find({ 
      blog: blogId,
      isAuthorComment: true
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Comment.countDocuments({
      blog: blogId,
      isAuthorComment: true
    });
    
    res.status(200).json({
      comments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching author comments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Author route: Delete author comment
router.delete('/api/author-comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if it's an author comment
    if (!comment.isAuthorComment) {
      return res.status(403).json({ message: 'Not an author comment' });
    }

    // If it's a reply, update parent comment's replies count
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });
    }
    
    // If it's a top-level comment, update blog comments count
    if (!comment.parentComment) {
      await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      
      // Delete all replies to this comment
      const repliesToDelete = await Comment.find({ parentComment: commentId });
      for (const reply of repliesToDelete) {
        // Delete reactions for each reply
        await CommentReaction.deleteMany({ comment: reply._id });
      }
      await Comment.deleteMany({ parentComment: commentId });
    }

    // Delete reactions for this comment
    await CommentReaction.deleteMany({ comment: commentId });
    
    await Comment.deleteOne({ _id: commentId });
    
    res.status(200).json({ message: 'Author comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting author comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
  // ============================================
// UPDATED ROUTE: Post blog reaction with fingerprint
// ============================================
router.post(
  '/api/blogs/:blogId/reactions',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('type').isIn(['like', 'dislike']).withMessage('Type must be like or dislike')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { blogId } = req.params;
      const { name, email, type } = req.body;

      const blog = await Blog.findById(blogId);
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }

      // Get fingerprint
      const fingerprint = getFingerprintFromRequest(req);

      const existingReaction = await Reaction.findOne({
        blog: blogId,
        'user.email': email
      });

      if (existingReaction) {
        if (existingReaction.type === type) {
          await Reaction.deleteOne({ _id: existingReaction._id });
          
          if (type === 'like') {
            await Blog.findByIdAndUpdate(blogId, { $inc: { 'reactionCounts.likes': -1 } });
          } else {
            await Blog.findByIdAndUpdate(blogId, { $inc: { 'reactionCounts.dislikes': -1 } });
          }
          
          return res.status(200).json({ 
            message: `${type} removed successfully`,
            reactionRemoved: true
          });
        } else {
          existingReaction.type = type;
          existingReaction.fingerprint = fingerprint;
          await existingReaction.save();
          
          if (type === 'like') {
            await Blog.findByIdAndUpdate(blogId, { 
              $inc: { 
                'reactionCounts.likes': 1,
                'reactionCounts.dislikes': -1
              } 
            });
          } else {
            await Blog.findByIdAndUpdate(blogId, { 
              $inc: { 
                'reactionCounts.likes': -1,
                'reactionCounts.dislikes': 1
              } 
            });
          }
          
          return res.status(200).json({
            message: `Reaction changed to ${type}`,
            reaction: existingReaction
          });
        }
      }

      const newReaction = new Reaction({
        blog: blogId,
        type,
        user: { name, email },
        fingerprint
      });

      await newReaction.save();
      
      if (type === 'like') {
        await Blog.findByIdAndUpdate(blogId, { $inc: { 'reactionCounts.likes': 1 } });
      } else {
        await Blog.findByIdAndUpdate(blogId, { $inc: { 'reactionCounts.dislikes': 1 } });
      }

      res.status(201).json({ 
        message: `${type} added successfully`,
        reaction: newReaction
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: 'You have already reacted to this blog post' });
      }
      console.error('Error adding reaction:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);
  
  // Get user's reaction to a blog
  router.get('/api/blogs/:blogId/reactions/user', async (req, res) => {
    try {
      const { blogId } = req.params;
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      const reaction = await Reaction.findOne({
        blog: blogId,
        'user.email': email
      });
      
      if (!reaction) {
        return res.status(200).json({ hasReacted: false });
      }
      
      res.status(200).json({
        hasReacted: true,
        reactionType: reaction.type
      });
    } catch (error) {
      console.error('Error fetching user reaction:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Get reaction counts for a blog
  router.get('/api/blogs/:blogId/reactions/count', async (req, res) => {
    try {
      const { blogId } = req.params;
      
      const blog = await Blog.findById(blogId, 'reactionCounts');
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }
      
      res.status(200).json({
        likes: blog.reactionCounts.likes || 0,
        dislikes: blog.reactionCounts.dislikes || 0
      });
    } catch (error) {
      console.error('Error fetching reaction counts:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Admin route: Get detailed reactions data (requires authentication)
  router.get('/api/admin/blogs/:blogId/reactions', authenticateToken, async (req, res) => {
    try {
      const { blogId } = req.params;
      
      const reactions = await Reaction.find({ blog: blogId })
        .sort({ createdAt: -1 });
      
      const counts = {
        likes: reactions.filter(r => r.type === 'like').length,
        dislikes: reactions.filter(r => r.type === 'dislike').length,
        total: reactions.length
      };
      
      res.status(200).json({
        counts,
        reactions
      });
    } catch (error) {
      console.error('Error fetching reactions:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  // AUTHOR ROUTE: Add author reply to a comment
  router.post(
    '/api/comments/:commentId/author-reply',
    authenticateToken,
    [
      body('content').trim().notEmpty().withMessage('Reply content is required')
        .isLength({ max: 1000 }).withMessage('Reply cannot exceed 1000 characters')
    ],
    async (req, res) => {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      try {
        const { commentId } = req.params;
        const { content } = req.body;
  
        // Check if parent comment exists
        const parentComment = await Comment.findById(commentId);
        if (!parentComment) {
          return res.status(404).json({ message: 'Parent comment not found' });
        }
  
        // Check if parent comment is approved
        if (parentComment.status !== 'approved') {
          return res.status(400).json({ message: 'Cannot reply to unapproved comment' });
        }
  
        // Create new author reply
        const newReply = new Comment({
          blog: parentComment.blog,
          user: { 
            name: req.user.name || 'Aaditiya Tyagi',
            email: req.user.email
          },
          content,
          parentComment: commentId,
          isAuthorComment: true,
          status: 'approved' // Author replies are auto-approved
        });
  
        await newReply.save();
        
        // Update parent comment's replies count
        await Comment.findByIdAndUpdate(commentId, { $inc: { repliesCount: 1 } });
  
        res.status(201).json({ 
          message: 'Author reply added successfully',
          reply: newReply
        });
      } catch (error) {
        console.error('Error adding author reply:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
      }
    }
  );
  router.post('/api/search', async (req, res) => {
  try {
    const { 
      query, 
      limit = 10, 
      minScore = 0.3,
      includeUnpublished = false,
      filters = {},
      hybridSearch = true,
      generateSuggestions = true
    } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        message: 'Search query is required' 
      });
    }
    
    console.log(`Processing semantic search for query: "${query}"`);
    
    // Step 1: Generate query embedding
    let queryEmbedding;
    try {
      queryEmbedding = await generateQueryEmbedding(query);
    } catch (embeddingError) {
      console.error('Embedding generation failed, falling back to text search:', embeddingError);
      return await performTextSearch(query, limit, includeUnpublished, filters, res);
    }
    
    // Step 2: Build base query with filters
    const baseQuery = {
      embedding: { $exists: true, $ne: null }
    };
    
    if (!includeUnpublished) {
      baseQuery.status = 'published';
    }
    
    // Apply additional filters
    if (filters.tags && filters.tags.length > 0) {
      baseQuery.tags = { $in: filters.tags };
    }
    
    if (filters.author) {
      baseQuery.author = filters.author;
    }
    
    if (filters.dateFrom || filters.dateTo) {
      baseQuery.publishedAt = {};
      if (filters.dateFrom) baseQuery.publishedAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) baseQuery.publishedAt.$lte = new Date(filters.dateTo);
    }
    
    // Step 3: Fetch blogs with embeddings
    const blogs = await Blog.find(baseQuery)
      .select('+embedding')
      .populate('author', 'name email')
      .lean()
      .limit(limit * 3);  // Fetch more than needed for better scoring
    
    if (blogs.length === 0) {
      return res.json({
        message: 'No blogs found with embeddings',
        results: [],
        searchMetadata: {
          query,
          totalResults: 0,
          processingTime: 0
        }
      });
    }
    
    const startTime = Date.now();
    
   // Step 4: Perform vector search in MongoDB
let vectorResults = await Blog.aggregate([
  {
    $vectorSearch: {
      index: "blog_vector_search",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 50,
      limit: limit
    }
  },
  {
    $match: includeUnpublished ? {} : { status: "published" }
  },
  {
    $project: {
      title: 1,
      summary: 1,
      content: 1,
      slug: 1,
      author: 1,
      tags: 1,
      featuredImage: 1,
      publishedAt: 1,
      reactionCounts: 1,
      commentsCount: 1,
      totalReads: 1,
      similarityScore: { $meta: "vectorSearchScore" }
    }
  }
]);

// Remove blogs below minimum score threshold
vectorResults = vectorResults.filter(r => r.similarityScore >= minScore);

// Vector search results replace manual cosineSimilarity results
let results = vectorResults;

    
    // Step 6: Hybrid search enhancement (combine with text search)
    if (hybridSearch && results.length < limit) {
      const textResults = await performTextSearchInternal(
        query, 
        limit - results.length, 
        includeUnpublished, 
        filters
      );
      
      // Merge results, avoiding duplicates
      const resultIds = new Set(results.map(r => r._id.toString()));
      const uniqueTextResults = textResults.filter(
        r => !resultIds.has(r._id.toString())
      );
      
      results = [...results, ...uniqueTextResults];
    }
    
    const processingTime = Date.now() - startTime;
    
    // Step 7: Generate related search suggestions
    let suggestions = [];
    if (generateSuggestions && results.length > 0) {
      try {
        suggestions = await generateSearchSuggestions(query, results.slice(0, 5));
      } catch (suggestionError) {
        console.error('Failed to generate suggestions:', suggestionError);
      }
    }
    
    // Step 8: Prepare response
    res.json({
      message: 'Search completed successfully',
      results: results.map(blog => ({
        _id: blog._id,
        title: blog.title,
        summary: blog.summary,
        content: blog.content.substring(0, 300) + '...',  // Preview only
        slug: blog.slug,
        author: blog.author,
        tags: blog.tags,
        featuredImage: blog.featuredImage,
        publishedAt: blog.publishedAt,
        reactionCounts: blog.reactionCounts,
        commentsCount: blog.commentsCount,
        totalReads: blog.totalReads,
        similarityScore: blog.similarityScore,
        relevanceLevel: getRelevanceLevel(blog.similarityScore)
      })),
      suggestions,
      searchMetadata: {
        query,
        totalResults: results.length,
        processingTime: `${processingTime}ms`,
        searchType: 'semantic_vector',
        hybridSearchUsed: hybridSearch,
        averageSimilarity: results.length > 0 
          ? (results.reduce((sum, r) => sum + r.similarityScore, 0) / results.length).toFixed(3)
          : 0
      }
    });
    
  } catch (error) {
    console.error('Error in semantic search:', error);
    res.status(500).json({ 
      message: 'Search failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Generate related search suggestions using Gemini
 */
async function generateSearchSuggestions(originalQuery, topResults) {
  try {
    const resultTitles = topResults.map(r => r.title).join(', ');
    const resultTags = [...new Set(topResults.flatMap(r => r.tags || []))].slice(0, 10).join(', ');
    
    const prompt = `Based on the search query "${originalQuery}" and these related blog titles: "${resultTitles}", and tags: "${resultTags}", suggest 5 related search queries that a user might be interested in.

Requirements:
- Each suggestion should be 2-5 words
- Be specific and relevant to the original query
- Vary in specificity (some broader, some more specific)
- Return ONLY a JSON array of strings, no other text

Example format: ["query 1", "query 2", "query 3", "query 4", "query 5"]`;
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    
    // Clean up response
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const suggestions = JSON.parse(text);
    
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      return suggestions.slice(0, 5);
    }
    
    return [];
    
  } catch (error) {
    console.error('Error generating search suggestions:', error);
    return [];
  }
}

/**
 * Fallback text search
 */
async function performTextSearch(query, limit, includeUnpublished, filters, res) {
  try {
    const results = await performTextSearchInternal(query, limit, includeUnpublished, filters);
    
    res.json({
      message: 'Text search completed (vector search unavailable)',
      results,
      searchMetadata: {
        query,
        totalResults: results.length,
        searchType: 'text_fallback'
      }
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Internal text search helper
 */
async function performTextSearchInternal(query, limit, includeUnpublished, filters) {
  const searchQuery = {
    $text: { $search: query }
  };
  
  if (!includeUnpublished) {
    searchQuery.status = 'published';
  }
  
  if (filters.tags && filters.tags.length > 0) {
    searchQuery.tags = { $in: filters.tags };
  }
  
  if (filters.author) {
    searchQuery.author = filters.author;
  }
  
  const results = await Blog.find(searchQuery, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .populate('author', 'name email')
    .lean();
  
  return results;
}

/**
 * Get relevance level based on similarity score
 */
function getRelevanceLevel(score) {
  if (score >= 0.8) return 'very_high';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  if (score >= 0.2) return 'low';
  return 'very_low';
}

/**
 * Get search analytics
 * GET /api/search/analytics
 */
router.get('/api/search/analytics', async (req, res) => {
  try {
    const totalBlogs = await Blog.countDocuments({ status: 'published' });
    const blogsWithEmbeddings = await Blog.countDocuments({ 
      status: 'published',
      embedding: { $exists: true, $ne: null }
    });
    
    const embeddingCoverage = totalBlogs > 0 
      ? ((blogsWithEmbeddings / totalBlogs) * 100).toFixed(2)
      : 0;
    
    res.json({
      totalBlogs,
      blogsWithEmbeddings,
      blogsWithoutEmbeddings: totalBlogs - blogsWithEmbeddings,
      embeddingCoverage: `${embeddingCoverage}%`,
      vectorSearchReady: blogsWithEmbeddings > 0
    });
    
  } catch (error) {
    console.error('Error fetching search analytics:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});


module.exports = router;