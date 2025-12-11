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
const jwt = require('jsonwebtoken');
const User = require("../models/userSchema");
const calculateReadTime = require('../utils/calculateReadTime');

const { 
  generateQueryEmbedding, 
  cosineSimilarity,
  doextractPlainText,
  generateBlogEmbedding 
} = require('../services/embeddingService');
router.post('/api/blogs', authenticateToken, async (req, res) => {
  try {
    const { title, content, summary, status, tags, featuredImage, contentImages, contentVideos, isSubscriberOnly } = req.body;
    if (!title || !content || !summary) {
      return res.status(400).json({ message: 'Title, content, and summary are required' });
    }
    const cleanedImages = cleanupUnusedImages(content, contentImages || []);
    const cleanedVideos = cleanupUnusedVideos(content, contentVideos || []);
    const readTime = calculateReadTime(content);
    const newBlog = new Blog({
      title,
      content,
      summary,
      author: req.user.admin_id,
      status: status || 'draft',
      tags: tags || [],
      featuredImage,
      contentImages: cleanedImages,
      contentVideos: cleanedVideos,
      isSubscriberOnly: isSubscriberOnly || false,
      readTime: readTime
    });
    
    await newBlog.save();
    if (newBlog.status === 'published') {
      try {
        await generateBlogEmbedding(newBlog);
        await newBlog.save();
        console.log(`✅ Embedding auto-generated for: "${newBlog.title}"`);
      } catch (embeddingError) {
        console.error('⚠️ Embedding generation failed (non-critical):', embeddingError.message);
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
      
      
      if (blog.author.toString() !== req.user.admin_id) {
        return res.status(403).json({ message: 'Not authorized to modify this blog post' });
      }
      
      
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
    
    
    const uniqueReaders = blog.readFingerprints.length;
    const totalReads = blog.totalReads;
    const averageReadsPerReader = uniqueReaders > 0 ? (totalReads / uniqueReaders).toFixed(2) : 0;
    
    
    const topReaders = blog.readFingerprints
      .sort((a, b) => b.readCount - a.readCount)
      .slice(0, 10)
      .map((rf, index) => ({
        rank: index + 1,
        readCount: rf.readCount,
        lastReadAt: rf.readAt
      }));
    
    
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
  
  router.put('/api/blogs/:id/images/:imageId', authenticateToken, async (req, res) => {
    try {
      const { id, imageId } = req.params;
      const { url, alt, caption, position } = req.body;
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      
      if (blog.author.toString() !== req.user.admin_id) {
        return res.status(403).json({ message: 'Not authorized to modify this blog post' });
      }
      
      const imageIndex = blog.contentImages.findIndex(img => img.imageId === imageId);
      
      if (imageIndex === -1) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      
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
  
  
  router.delete('/api/blogs/:id/images/:imageId', authenticateToken, async (req, res) => {
    try {
      const { id, imageId } = req.params;
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      
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
  



const extractAuthFromToken = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      
      console.log('🔍 Token decoded:', decoded); 
      
      
      if (decoded.admin_id) {
        req.user = {
          admin_id: decoded.admin_id,
          isAuthenticated: true,
          type: 'admin'
        };
        console.log('✅ Admin authenticated:', decoded.admin_id);
        next();
      } 
      
      else if (decoded.user_id) {  
        try {
          const user = await User.findById(decoded.user_id);
          
          if (user) {
            req.user = {
              user_id: user._id,
              userId: user._id,  
              email: user.email,
              name: user.name,
              isAuthenticated: true,
              type: 'user'
            };
            console.log('✅ User authenticated:', user.name, user.email);
          } else {
            console.log('❌ User not found in database');
            req.user = { isAuthenticated: false };
          }
          next();
        } catch (dbError) {
          console.error('❌ Database error fetching user:', dbError);
          req.user = { isAuthenticated: false };
          next();
        }
      } else {
        console.log('❌ No valid user_id or admin_id in token');
        req.user = { isAuthenticated: false };
        next();
      }
    } else {
      console.log('❌ No token provided');
      req.user = { isAuthenticated: false };
      next();
    }
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    req.user = { isAuthenticated: false };
    next();
  }
};



router.get(
  '/api/blogs/:identifier',
  extractAuthFromToken, 
  async (req, res) => {
    try {
      const { identifier } = req.params;
      const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
      
      const query = isObjectId 
        ? { _id: identifier }
        : { slug: identifier };
      
      
      const isAuthenticated = req.user?.isAuthenticated;
      
      console.log('Auth check:', {
        isAuthenticated,
        authType: req.user?.type,
        identifier
      });
      
      if (!isAuthenticated) {
        query.status = 'published';
      }
      
      let blog = await Blog.findOne(query)
        .populate('author', 'name email profileImage designation location bio socialLinks')
        .exec();
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      console.log('Blog found:', {
        id: blog._id,
        isSubscriberOnly: blog.isSubscriberOnly,
        isAuthenticated
      });
      
      
      if (blog.isSubscriberOnly && !isAuthenticated) {
        console.log('✅ Returning subscriber-only preview (not authenticated)');
        return res.json({
          _id: blog._id,
          title: blog.title,
          summary: blog.summary,
          featuredImage: blog.featuredImage,
          author: blog.author,
          publishedAt: blog.publishedAt,
          tags: blog.tags || [],
          readTime: blog.readTime,  
          isSubscriberOnly: true,
          preview: true,
          message: 'This is subscriber-only content. Please login to access full article.'
        });
      }
      
      
      
      
      console.log('✅ Returning full blog content (public or authenticated)');
      
      const fingerprint = getFingerprintFromRequest(req);
      
      if (!blog.readFingerprints) {
        blog.readFingerprints = [];
      }
      
      const existingFingerprintIndex = blog.readFingerprints.findIndex(
        rf => rf.fingerprint === fingerprint
      );
      
      if (existingFingerprintIndex !== -1) {
        blog.readFingerprints[existingFingerprintIndex].readCount += 1;
        blog.readFingerprints[existingFingerprintIndex].readAt = new Date();
      } else {
        blog.readFingerprints.push({
          fingerprint,
          readAt: new Date(),
          readCount: 1
        });
      }
      
      blog.totalReads += 1;
      await blog.save();
      
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
      
      res.json(blogObj);
    } catch (error) {
      console.error('Error fetching blog:', error);
      res.status(500).json({ message: error.message });
    }
  }
);







router.get(
  "/api/blogs",
  extractAuthFromToken,
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
        filter.status = "published";
      }

      
      if (tag) {
        filter.tags = { $in: [tag] };
      }

      
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
        .select('+tags') 
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("author", "name email")
        .lean() 
        .exec();

      const isAuthenticated = req.user?.isAuthenticated;

      console.log('📊 Query Results:', {
        totalBlogs: blogs.length,
        isAuthenticated,
        firstBlogHasTags: blogs.length > 0 ? !!blogs[0].tags : 'no blogs',
        firstBlogTags: blogs.length > 0 ? blogs[0].tags : 'no blogs'
      });

      const processedBlogs = blogs.map(blog => {
        const isSubscriberOnly = blog.isSubscriberOnly || false;

       
        if (isSubscriberOnly && !isAuthenticated) {
          const previewBlog = {
            _id: blog._id,
            title: blog.title,
            summary: blog.summary,
            featuredImage: blog.featuredImage,
            author: blog.author,
            publishedAt: blog.publishedAt,
            tags: blog.tags || [], 
            readTime: blog.readTime,
            isSubscriberOnly: true,
            preview: true
          };
          
          console.log('🔒 Preview blog:', {
            id: previewBlog._id,
            title: previewBlog.title,
            tags: previewBlog.tags
          });
          
          return previewBlog;
        }

        
        const fullBlog = {
          ...blog,
          processedContent: processContent(
            blog.content,
            blog.contentImages || [],
            blog.contentVideos || []
          ),
          tags: blog.tags || [] 
        };

        console.log('🔓 Full blog:', {
          id: fullBlog._id,
          title: fullBlog.title,
          tags: fullBlog.tags
        });

        return fullBlog;
      });

      const total = await Blog.countDocuments(filter);

      console.log('✅ Final response:', {
        totalProcessed: processedBlogs.length,
        sampleBlogHasTags: processedBlogs.length > 0 ? !!processedBlogs[0].tags : 'no blogs'
      });

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
      console.error("❌ Error fetching blogs:", error);
      res.status(500).json({ message: error.message });
    }
  }
);








router.post('/api/blogs/:identifier/report', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { userEmail, reason } = req.body;
    
    if (!userEmail || !reason) {
      return res.status(400).json({ 
        message: 'User email and reason are required' 
      });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({ 
        message: 'Invalid email format' 
      });
    }
    
    if (reason.trim().length < 10 || reason.trim().length > 500) {
      return res.status(400).json({ 
        message: 'Reason must be between 10 and 500 characters' 
      });
    }
    
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    const query = isObjectId 
      ? { _id: identifier }
      : { slug: identifier };
    
    query.status = 'published';
    
    const blog = await Blog.findOne(query);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    const existingReport = blog.reports.find(
      report => report.userEmail.toLowerCase() === userEmail.toLowerCase()
    );
    
    if (existingReport) {
      return res.status(400).json({ 
        message: 'You have already reported this blog post' 
      });
    }
    
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

router.get('/api/blogs/stats/overview', authenticateToken, async (req, res) => {
  try {
    const totalBlogs = await Blog.countDocuments();
    const publishedBlogs = await Blog.countDocuments({ status: 'published' });
    const draftBlogs = await Blog.countDocuments({ status: 'draft' });
    const blogsWithReports = await Blog.countDocuments({ totalReports: { $gt: 0 } });
    
    
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
    
   
    const wasPublished = blog.status === 'published';
    const contentChanged = updates.content !== undefined || 
                          updates.title !== undefined || 
                          updates.summary !== undefined;
    
    
    const allowedUpdates = [
      'title', 
      'content', 
      'summary', 
      'status', 
      'tags', 
      'featuredImage', 
      'contentImages', 
      'contentVideos',
      'isSubscriberOnly'  
    ];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        blog[field] = updates[field];
      }
    });
    
    
    if (updates.content !== undefined) {
      blog.readTime = calculateReadTime(updates.content);
      blog.contentImages = cleanupUnusedImages(updates.content, blog.contentImages);
      blog.contentVideos = cleanupUnusedVideos(updates.content, blog.contentVideos);
    }
    
    await blog.save();
    
    
    const isNowPublished = blog.status === 'published';
    const shouldRegenerateEmbedding = isNowPublished && (
      contentChanged ||                    
      (!wasPublished && isNowPublished)   
    );
    
    if (shouldRegenerateEmbedding) {
      try {
        await generateBlogEmbedding(blog);
        await blog.save();
        console.log(`✅ Embedding auto-regenerated for: "${blog.title}"`);
      } catch (embeddingError) {
        console.error('⚠️ Embedding regeneration failed (non-critical):', embeddingError.message);
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
  
  
  
  router.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      
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
  
  router.get('/api/blogs/:id/images', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      
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
    
    
    if (blog.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to modify this blog post' });
    }
    
    
    const videoInfo = extractVideoInfo(url);
    
    if (!videoInfo) {
      return res.status(400).json({ message: 'Invalid video URL. Currently supported: YouTube, Vimeo, Dailymotion' });
    }
    
    
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


router.put('/api/blogs/:id/videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, embedId } = req.params;
    const { url, title, caption, position, autoplay, muted } = req.body;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    
    if (blog.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to modify this blog post' });
    }
    
    const videoIndex = blog.contentVideos.findIndex(vid => vid.embedId === embedId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    
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


router.delete('/api/blogs/:id/videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, embedId } = req.params;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    
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


router.get('/api/blogs/:id/videos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    
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


router.post('/api/blogs/:id/generate-summary', async (req, res) => {
  try {
    
    validateApiKey();
    
    const { id } = req.params;
    const { wordLimit = 300, temperature = 0.7 } = req.body; 
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    
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
    - Generate different answer every time  but same meaining 
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
        
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
    
    const response = await result.response;
    let generatedSummary = response.text().trim();
    
    
    generatedSummary = generatedSummary
      .replace(/^\*\*Summary\*\*:?\s*/i, '')
      .replace(/^\*\*\s*|\s*\*\*$/g, '')
      .trim();
    
    
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


router.put('/api/blogs/:id/update-summary', async (req, res) => {
  try {
    const { id } = req.params;
    const { summary, replaceExisting = false } = req.body;
    
    if (!summary || typeof summary !== 'string') {
      return res.status(400).json({ message: 'Valid summary is required' });
    }
    
    if (summary.length > 2000) { 
      return res.status(400).json({ 
        message: 'Summary is too long. Maximum 2000 characters allowed.' 
      });
    }
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    
    if (blog.summary && blog.summary.trim() !== '' && !replaceExisting) {
      return res.status(409).json({ 
        message: 'Blog already has a summary. Set replaceExisting to true to overwrite.',
        currentSummary: blog.summary 
      });
    }
    
    
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


router.post('/api/blogs/:id/auto-summary', async (req, res) => {
  try {
    validateApiKey();
    
    const { id } = req.params;
    const { wordLimit = 300, forceUpdate = false, temperature = 0.7 } = req.body;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    
    if (blog.summary && blog.summary.trim() !== '' && !forceUpdate) {
      return res.status(409).json({ 
        message: 'Blog already has a summary. Set forceUpdate to true to regenerate.',
        currentSummary: blog.summary 
      });
    }
    
    
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
    
    
    generatedSummary = generatedSummary
      .replace(/^\*\*Summary\*\*:?\s*/i, '')
      .replace(/^\*\*\s*|\s*\*\*$/g, '')
      .trim();
    
    
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


router.post('/api/blogs/summary-status', async (req, res) => {
  try {
    const { blogIds } = req.body;
    
    if (!Array.isArray(blogIds) || blogIds.length === 0) {
      return res.status(400).json({ message: 'Blog IDs array is required' });
    }
    
    if (blogIds.length > 100) { 
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


router.get('/api/gemini/health', async (req, res) => {
  try {
    validateApiKey();
    
    
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
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    
    let comments = await Comment.find({ 
      blog: blogId,
      status: 'approved',
      parentComment: null
    })
    .populate('authorAdminId', 'name email profileImage') 
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
    
    
    for (let comment of comments) {
      
      if (comment.user.userId) {
        const userData = await User.findById(comment.user.userId)
          .select('name email profilePicture googleId')
          .lean();
        
        if (userData) {
          comment.user.profilePicture = userData.profilePicture;
          comment.user.googleId = userData.googleId;
        }
      }
      
      
      if (comment.isAuthorComment && comment.authorAdminId) {
        comment.authorHasProfileImage = !!(
          comment.authorAdminId.profileImage && 
          comment.authorAdminId.profileImage.data
        );
      }
      
      comment.repliesCount = await Comment.countDocuments({
        parentComment: comment._id,
        status: 'approved'
      });
    }
    
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
      let { name, email, content } = req.body;

      
      const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
      let userId = null;
      let isAuthenticated = false;
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
          
          userId = decoded.user_id;
          
          
          const user = await User.findById(userId);
          if (user) {
            name = user.name;
            email = user.email;
            isAuthenticated = true;
          }
        } catch (err) {
          console.log('Invalid token, treating as guest');
        }
      }

      const blog = await Blog.findById(blogId);
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }

      const fingerprint = getFingerprintFromRequest(req);

      console.log(`🔍 Moderating comment from ${name}...`);
      const moderation = await moderateContent(content, name);
      
      if (!moderation.approved) {
        console.log(`✅ Content moderation blocked comment from ${name} - Reason: ${moderation.reason}`);
        
        return res.status(422).json({
          message: 'Your comment cannot be posted as it strongly violates our community guidelines.',
          code: 'CONTENT_POLICY_VIOLATION',
          severity: moderation.severity,
          moderationId: `MOD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          hint: moderation.systemError 
            ? 'Your comment is under review. Please try again later.' 
            : 'Please review our community guidelines and post respectful, constructive content.'
        });
      }

      console.log(`✅ Content approved for ${name}`);

      
      const commentStatus = isAuthenticated ? 'approved' : 'pending';

      
      const newComment = new Comment({
        blog: blogId,
        user: { 
          name, 
          email,
          userId: userId || null  
        },
        content,
        fingerprint,
        status: commentStatus
      });

      await newComment.save();
      
      
      if (commentStatus === 'approved') {
        await Blog.findByIdAndUpdate(blogId, { $inc: { commentsCount: 1 } });
      }

      res.status(201).json({ 
        message: isAuthenticated 
          ? 'Comment added successfully' 
          : 'Comment submitted and is pending approval',
        comment: newComment,
        status: commentStatus
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


router.post('/api/comments/:commentId/verify-ownership', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { email } = req.body;
    
    
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ canDelete: false, message: 'Comment not found' });
    }
    
    
    if (comment.isAuthorComment) {
      return res.status(200).json({ canDelete: false, reason: 'author_comment' });
    }
    
    let canDelete = false;
    let verificationMethod = 'none';
    
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        const user = await User.findById(decoded.userId);
        
        if (user && user.email === comment.user.email) {
          canDelete = true;
          verificationMethod = 'jwt_authenticated';
        }
      } catch (err) {
        console.log('Token verification failed');
      }
    }
    
    
    if (!canDelete && email) {
      const requestFingerprint = getFingerprintFromRequest(req);
      
      
      if (comment.user.email === email && comment.fingerprint === requestFingerprint) {
        canDelete = true;
        verificationMethod = 'fingerprint_match';
      }
    }
    
    res.status(200).json({ 
      canDelete,
      verificationMethod,
      commentId: comment._id
    });
    
  } catch (error) {
    console.error('Error verifying comment ownership:', error);
    res.status(500).json({ canDelete: false, message: 'Server error' });
  }
});
router.delete('/api/comments/:commentId/user', 
  [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { email } = req.body;
      
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      
      if (comment.isAuthorComment) {
        return res.status(403).json({ message: 'Author comments cannot be deleted through this route' });
      }

      
      const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
      
      let isAuthorized = false;
      
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
          const user = await User.findById(decoded.userId);
          
          if (user && user.email === comment.user.email) {
            isAuthorized = true;
            console.log('✅ Deletion authorized via JWT authentication');
          }
        } catch (err) {
          console.log('Token verification failed, checking fingerprint...');
        }
      }
      
      
      if (!isAuthorized) {
        const requestFingerprint = getFingerprintFromRequest(req);
        
        
        if (comment.user.email === email && comment.fingerprint === requestFingerprint) {
          isAuthorized = true;
          console.log('✅ Deletion authorized via fingerprint match');
        } else {
          console.log('❌ Authorization failed - Email or fingerprint mismatch');
          console.log('Comment email:', comment.user.email);
          console.log('Request email:', email);
          console.log('Comment fingerprint:', comment.fingerprint);
          console.log('Request fingerprint:', requestFingerprint);
        }
      }
      
      if (!isAuthorized) {
        return res.status(403).json({ 
          message: 'You can only delete your own comments. Verification failed.',
          hint: 'This comment was created from a different device or browser session.'
        });
      }

      
      if (comment.parentComment) {
        await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });
      }
      
      if (comment.status === 'approved' && !comment.parentComment) {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      }

      if (!comment.parentComment) {
        const repliesToDelete = await Comment.find({ parentComment: commentId });
        for (const reply of repliesToDelete) {
          await CommentReaction.deleteMany({ comment: reply._id });
        }
        await Comment.deleteMany({ parentComment: commentId });
      }

      await CommentReaction.deleteMany({ comment: commentId });
      await Comment.deleteOne({ _id: commentId });
      
      res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Error deleting user comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);
  
  
  router.get('/api/admin/blogs/:blogId/comments', authenticateToken, async (req, res) => {
    try {
      const { blogId } = req.params;
      
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      
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
      
      
      if (comment.status !== 'approved' && status === 'approved') {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: 1 } });
      }
      
      
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
  
  
  router.delete('/api/admin/comments/:commentId', authenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      
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
      let { name, email, content } = req.body;

      
      const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
      let userId = null;
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
          userId = decoded.user_id;  
          
          const user = await User.findById(userId);
          if (user) {
            name = user.name;
            email = user.email;
          }
        } catch (err) {
          console.log('Invalid token, treating as guest');
        }
      }

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

      const fingerprint = getFingerprintFromRequest(req);

      console.log(`🔍 Moderating reply from ${name}...`);
      const moderation = await moderateContent(content, name);
      
      if (!moderation.approved) {
        return res.status(422).json({
          message: 'Your reply cannot be posted as it violates community guidelines.',
          code: 'CONTENT_POLICY_VIOLATION'
        });
      }

      
      const newReply = new Comment({
        blog: parentComment.blog,
        user: { 
          name, 
          email,
          userId: userId || null  
        },
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
        error: error.message
      });
    }
  }
);
router.get('/api/comments/:commentId/replies', async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    
    let replies = await Comment.find({ 
      parentComment: commentId,
      status: 'approved'
    })
    .populate('authorAdminId', 'name email profileImage') 
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
    
    
    for (let reply of replies) {
      
      if (reply.user.userId) {
        const userData = await User.findById(reply.user.userId)
          .select('name email profilePicture googleId')
          .lean();
        
        if (userData) {
          reply.user.profilePicture = userData.profilePicture;
          reply.user.googleId = userData.googleId;
        }
      }
      
      
      if (reply.isAuthorComment && reply.authorAdminId) {
        reply.authorHasProfileImage = !!(
          reply.authorAdminId.profileImage && 
          reply.authorAdminId.profileImage.data
        );
      }
    }
    
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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { commentId } = req.params;
      let { name, email, type } = req.body;

      
      const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
      let userId = null;
     if (token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    userId = decoded.user_id;
    
    const user = await User.findById(userId);
    if (user) {
      name = user.name;
      email = user.email;
    }
  } catch (err) {
    console.log('Invalid token, using form data');
  }
}

      const comment = await Comment.findOne({ 
        _id: commentId, 
        status: 'approved' 
      }).session(session);
      
      if (!comment) {
        await session.abortTransaction();
        return res.status(404).json({ 
          message: 'Comment not found or not approved' 
        });
      }

      const fingerprint = getFingerprintFromRequest(req);

      const existingReaction = await CommentReaction.findOne({
        comment: commentId,
        'user.email': email
      }).session(session);

      let reactionRemoved = false;
      let oldType = null;

      if (existingReaction) {
        oldType = existingReaction.type;
        
        if (existingReaction.type === type) {
          await CommentReaction.deleteOne({ 
            _id: existingReaction._id 
          }).session(session);
          
          await Comment.findByIdAndUpdate(
            commentId,
            { 
              $inc: { 
                [`reactionCounts.${type}s`]: -1 
              } 
            },
            { session }
          );
          
          reactionRemoved = true;
          
        } else {
          existingReaction.type = type;
          existingReaction.fingerprint = fingerprint;
          await existingReaction.save({ session });
          
          await Comment.findByIdAndUpdate(
            commentId,
            { 
              $inc: { 
                [`reactionCounts.${oldType}s`]: -1,
                [`reactionCounts.${type}s`]: 1
              } 
            },
            { session }
          );
        }
        
      } else {
        const newReaction = new CommentReaction({
          comment: commentId,
          type,
          user: { name, email,userId: userId || null  },
          fingerprint
        });
        
        await newReaction.save({ session });
        
        await Comment.findByIdAndUpdate(
          commentId,
          { 
            $inc: { 
              [`reactionCounts.${type}s`]: 1 
            } 
          },
          { session }
        );
      }

      await session.commitTransaction();
      
      const updatedComment = await Comment.findById(commentId)
        .select('reactionCounts');

      res.status(200).json({
        message: reactionRemoved ? `${type} removed successfully` : 
                 oldType ? `Reaction changed to ${type}` : 
                 `${type} added successfully`,
        reactionRemoved,
        reaction: existingReaction || null,
        counts: updatedComment.reactionCounts
      });

    } catch (error) {
      await session.abortTransaction();
      
      console.error('Error processing comment reaction:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({ 
          message: 'Reaction conflict detected. Please try again.' 
        });
      }
      
      res.status(500).json({ 
        message: 'Server error processing reaction',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      session.endSession();
    }
  }
);

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

router.get('/api/blogs/:blogId/reactions/users', async (req, res) => {
  try {
    const { blogId } = req.params;
    const { type } = req.query; 
    
    const query = { blog: blogId };
    if (type) query.type = type;
    
    const reactions = await Reaction.find(query)
      .populate('user.userId', 'name profilePicture')
      .sort({ createdAt: -1 })
      .limit(50);
    
    const users = reactions.map(r => ({
      name: r.user.userId?.name || r.user.name,
      profilePicture: r.user.userId?.profilePicture || null,
      type: r.type,
      createdAt: r.createdAt
    }));
    
    res.json({ users, total: users.length });
  } catch (err) {
    console.error('Error fetching blog reaction users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/api/comments/:commentId/reactions/users', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { type } = req.query;
    
    const query = { comment: commentId };
    if (type) query.type = type;
    
    const reactions = await CommentReaction.find(query)
      .populate('user.userId', 'name profilePicture')
      .sort({ createdAt: -1 })
      .limit(50);
    
    const users = reactions.map(r => ({
      name: r.user.userId?.name || r.user.name,
      profilePicture: r.user.userId?.profilePicture || null,
      type: r.type,
      createdAt: r.createdAt
    }));
    
    res.json({ users, total: users.length });
  } catch (err) {
    console.error('Error fetching comment reaction users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post(
  '/api/blogs/:blogId/author-comment',
  authenticateToken, 
  [
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
      const { content } = req.body;

      const blog = await Blog.findById(blogId);
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }

      
      const newComment = new Comment({
        blog: blogId,
        user: { 
          name: req.user.name || 'Aaditiya Tyagi', 
          email: req.user.email 
        },
        content,
        isAuthorComment: true,
        authorAdminId: req.user.admin_id, 
        status: 'approved'
      });

      await newComment.save();
      
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

router.get('/api/blogs/:blogId/author-comments', authenticateToken, async (req, res) => {
  try {
    const { blogId } = req.params;
    
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    
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


router.delete('/api/author-comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    
    if (!comment.isAuthorComment) {
      return res.status(403).json({ message: 'Not an author comment' });
    }

    
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });
    }
    
    
    if (!comment.parentComment) {
      await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      
      
      const repliesToDelete = await Comment.find({ parentComment: commentId });
      for (const reply of repliesToDelete) {
        
        await CommentReaction.deleteMany({ comment: reply._id });
      }
      await Comment.deleteMany({ parentComment: commentId });
    }

    
    await CommentReaction.deleteMany({ comment: commentId });
    
    await Comment.deleteOne({ _id: commentId });
    
    res.status(200).json({ message: 'Author comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting author comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
  


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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { blogId } = req.params;
      let { name, email, type } = req.body;

      
      const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
      let userId = null;
      if (token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    userId = decoded.user_id;
    
    const user = await User.findById(userId);
    if (user) {
      name = user.name;
      email = user.email;
    }
  } catch (err) {
    console.log('Invalid token, using form data');
  }
}
      const blog = await Blog.findById(blogId).session(session);
      if (!blog) {
        await session.abortTransaction();
        return res.status(404).json({ message: 'Blog not found' });
      }

      const fingerprint = getFingerprintFromRequest(req);

      const existingReaction = await Reaction.findOne({
        blog: blogId,
        'user.email': email
      }).session(session);

      let reactionRemoved = false;
      let oldType = null;

      if (existingReaction) {
        oldType = existingReaction.type;
        
        if (existingReaction.type === type) {
          await Reaction.deleteOne({ _id: existingReaction._id }).session(session);
          
          await Blog.findByIdAndUpdate(
            blogId,
            { 
              $inc: { 
                [`reactionCounts.${type}s`]: -1 
              } 
            },
            { session }
          );
          
          reactionRemoved = true;
          
        } else {
          existingReaction.type = type;
          existingReaction.fingerprint = fingerprint;
          await existingReaction.save({ session });
          
          await Blog.findByIdAndUpdate(
            blogId,
            { 
              $inc: { 
                [`reactionCounts.${oldType}s`]: -1,
                [`reactionCounts.${type}s`]: 1
              } 
            },
            { session }
          );
        }
        
      } else {
        const newReaction = new Reaction({
          blog: blogId,
          type,
          user: { name, email, userId: userId || null},
          fingerprint
        });
        
        await newReaction.save({ session });
        
        await Blog.findByIdAndUpdate(
          blogId,
          { 
            $inc: { 
              [`reactionCounts.${type}s`]: 1 
            } 
          },
          { session }
        );
      }

      await session.commitTransaction();
      
      const updatedBlog = await Blog.findById(blogId).select('reactionCounts');

      res.status(200).json({ 
        message: reactionRemoved ? `${type} removed successfully` : 
                 oldType ? `Reaction changed to ${type}` : 
                 `${type} added successfully`,
        reactionRemoved,
        reaction: existingReaction || null,
        counts: updatedBlog.reactionCounts
      });

    } catch (error) {
      await session.abortTransaction();
      
      console.error('Error processing blog reaction:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({ 
          message: 'Reaction conflict detected. Please try again.' 
        });
      }
      
      res.status(500).json({ 
        message: 'Server error processing reaction',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      session.endSession();
    }
  }
);
  
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
  
router.post(
  '/api/comments/:commentId/author-reply',
  authenticateToken,
  [
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
      const { content } = req.body;

      const parentComment = await Comment.findById(commentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }

      if (parentComment.status !== 'approved') {
        return res.status(400).json({ message: 'Cannot reply to unapproved comment' });
      }

      
      const newReply = new Comment({
        blog: parentComment.blog,
        user: { 
          name: req.user.name || 'Aaditiya Tyagi',
          email: req.user.email
        },
        content,
        parentComment: commentId,
        isAuthorComment: true,
        authorAdminId: req.user.admin_id, 
        status: 'approved'
      });

      await newReply.save();
      
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
function getRelevanceLevel(score) {
  if (score >= 0.8) return 'very_high';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  if (score >= 0.2) return 'low';
  return 'very_low';
}





async function performTextSearchInternal(query, limit, includeUnpublished, filters = {}) {
  const searchQuery = { $text: { $search: query } };

  if (!includeUnpublished) searchQuery.status = 'published';

  if (filters.tags && filters.tags.length > 0) searchQuery.tags = { $in: filters.tags };
  if (filters.author) searchQuery.author = filters.author;
  if (filters.dateFrom || filters.dateTo) {
    searchQuery.publishedAt = {};
    if (filters.dateFrom) searchQuery.publishedAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) searchQuery.publishedAt.$lte = new Date(filters.dateTo);
  }

  const results = await Blog.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .populate('author', 'name')
    .lean();

  return results;
}





function prepareResultForUser(doc, isAuthenticated) {
  const base = {
    _id: doc._id,
    title: doc.title,
    summary: doc.summary,
    slug: doc.slug,
    author: {
      _id: doc.author?._id || null,
      name: doc.author?.name || 'Unknown Author'
    },
    tags: doc.tags || [],
    featuredImage: doc.featuredImage || null,
    publishedAt: doc.publishedAt || null,
    reactionCounts: doc.reactionCounts || 0,
    commentsCount: doc.commentsCount || 0,
    totalReads: doc.totalReads || 0,
     readTime: doc.readTime || 0,
    isSubscriberOnly: !!doc.isSubscriberOnly
  };

  
  if (doc.isSubscriberOnly && !isAuthenticated) {
    return {
      ...base,
      preview: true
      
    };
  }

  
  return {
    ...base,
    preview: false,
    
    contentPreview: typeof doc.content === 'string' ? (doc.content.substring(0, 300) + (doc.content.length > 300 ? '...' : '')) : ''
  };
}




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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const suggestions = JSON.parse(text);
    return Array.isArray(suggestions) ? suggestions.slice(0, 5) : [];
  } catch (err) {
    console.error('Suggestion generation error:', err);
    return [];
  }
}




router.post('/api/search', extractAuthFromToken, async (req, res) => {
  try {
    const {
      query,
      limit = 10,
      minScore = 0.15, 
      includeUnpublished = false,
      filters = {},
      hybridSearch = true,
      generateSuggestions = true,
      debug = false 
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const isAuthenticated = !!req.user?.isAuthenticated;
    const startTime = Date.now();

    
    const normalizedQuery = query.trim();
    const exactMatch = await Blog.findOne({
      $or: [
        { title: normalizedQuery },
        { slug: normalizedQuery },
        { titleLower: normalizedQuery.toLowerCase() }, 
      ],
      ...(includeUnpublished ? {} : { status: 'published' })
    }).populate('author', 'name').lean();

    
    let queryEmbedding;
    try {
      queryEmbedding = await generateQueryEmbedding(query);
    } catch (embeddingError) {
      console.error('Query embedding failed, falling back to text search:', embeddingError);
      
      return await (async () => {
        const textResults = await performTextSearchInternal(query, limit, includeUnpublished, filters);
        return res.json({
          message: 'Text search (fallback) completed',
          results: textResults.map(r => prepareResultForUser(r, isAuthenticated)),
          searchMetadata: {
            query,
            totalResults: textResults.length,
            searchType: 'text_fallback'
          }
        });
      })();
    }

    
    const candidateLimit = 200;
    const vectorAgg = await Blog.aggregate([
      {
        $vectorSearch: {
          index: 'blog_vector_search',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: candidateLimit,
          limit: candidateLimit
        }
      },
      {
    $lookup: {
      from: 'admins', 
      localField: 'author',
      foreignField: '_id',
      as: 'author'
    }
  },
  {
    $unwind: {
      path: '$author',
      preserveNullAndEmptyArrays: true  // Keep blogs without authors
    }
  },
      { $match: includeUnpublished ? {} : { status: 'published' } },
      
      {
        $project: {
          title: 1,
          summary: 1,
          slug: 1,
          author: { 
        _id: 1,
        name: 1,
        email: 1,
        profileImage: 1
      },
          author: 1,
          tags: 1,
          featuredImage: 1,
          publishedAt: 1,
          reactionCounts: 1,
          commentsCount: 1,
          totalReads: 1,
          isSubscriberOnly: 1,
          content: 1,
          readTime: 1,
          embedding: 1,
          similarityScore: { $meta: 'vectorSearchScore' }
        }
      }
    ]);

    
    let textCandidates = [];
    if (hybridSearch) {
      textCandidates = await performTextSearchInternal(query, candidateLimit, includeUnpublished, filters);
      
    }

    
    const idToDoc = new Map();

    
    for (const d of vectorAgg) {
      const id = d._id.toString();
      let vectorSim = d.similarityScore || 0;
      if (Array.isArray(d.embedding) && d.embedding.length > 0) {
        try {
          vectorSim = cosineSimilarity(queryEmbedding, d.embedding);
        } catch (e) {
          
        }
      }
      idToDoc.set(id, {
        doc: d,
        vectorSim,
        textScore: 0
      });
    }

    
    for (const t of textCandidates) {
      const id = t._id.toString();
      if (idToDoc.has(id)) {
        idToDoc.get(id).textScore = t.score || 0;
        
        if (!idToDoc.get(id).doc) idToDoc.get(id).doc = t;
      } else {
        idToDoc.set(id, { doc: t, vectorSim: 0, textScore: t.score || 0 });
      }
    }

    
    if (exactMatch) {
      const id = exactMatch._id.toString();
      if (!idToDoc.has(id)) {
        idToDoc.set(id, { doc: exactMatch, vectorSim: 1.0, textScore: 10 }); 
      } else {
        
        const item = idToDoc.get(id);
        item.vectorSim = Math.max(item.vectorSim, 0.99);
        item.textScore = Math.max(item.textScore, 10);
      }
    }

    
    const merged = Array.from(idToDoc.values()).map(item => ({
      doc: item.doc,
      vectorSim: (typeof item.vectorSim === 'number' ? item.vectorSim : 0),
      textScore: (typeof item.textScore === 'number' ? item.textScore : 0)
    }));

    
    const maxVec = Math.max(...merged.map(m => m.vectorSim), 1e-6);
    const maxText = Math.max(...merged.map(m => m.textScore), 1e-6);

    
    const alpha = 0.7;
    const beta = 0.3;

    merged.forEach(m => {
      m.vectorNorm = m.vectorSim / maxVec;
      m.textNorm = m.textScore / maxText;
      m.fused = alpha * m.vectorNorm + beta * m.textNorm;
    });

    
    merged.sort((a, b) => b.fused - a.fused);

    
    const finalCandidates = merged.filter(m => m.fused >= minScore);
    
    const finalSelection = finalCandidates.length >= limit
      ? finalCandidates.slice(0, limit)
      : merged.slice(0, Math.max(limit, finalCandidates.length)).slice(0, limit);

    
    const results = finalSelection.map(m => {
      
      const doc = m.doc;
      
      
      return {
        ...prepareResultForUser(doc, isAuthenticated),
        similarityScore: m.vectorSim,
        textScore: m.textScore,
        fusedScore: m.fused,
        relevanceLevel: getRelevanceLevel(m.fused),

      };
    });

    
    let suggestions = [];
    if (generateSuggestions && results.length > 0) {
      try {
        suggestions = await generateSearchSuggestions(query, results.slice(0, 5));
      } catch (err) {
        console.error('Suggestions error:', err);
      }
    }

    const processingTime = Date.now() - startTime;

    
    const debugInfo = debug ? {
      candidateCount: merged.length,
      topCandidates: merged.slice(0, 10).map(m => ({
        id: m.doc._id,
        title: m.doc.title,
        vectorSim: m.vectorSim,
        textScore: m.textScore,
        fused: m.fused
      }))
    } : undefined;

    res.json({
      message: 'Search completed successfully',
      results,
      suggestions,
      searchMetadata: {
        query,
        totalResults: results.length,
        processingTime: `${processingTime}ms`,
        searchType: 'hybrid_fused',
        hybridSearchUsed: hybridSearch,
        averageFused: results.length > 0 ? (results.reduce((s, r) => s + (r.fusedScore || r.fused || 0), 0) / results.length).toFixed(3) : 0
      },
      debug: debugInfo
    });

  } catch (error) {
    console.error('Search route error:', error);
    res.status(500).json({
      message: 'Search failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});




router.get('/api/search/analytics', async (req, res) => {
  try {
    const totalBlogs = await Blog.countDocuments({ status: 'published' });
    const blogsWithEmbeddings = await Blog.countDocuments({
      status: 'published',
      embedding: { $exists: true, $ne: null }
    });

    const embeddingCoverage = totalBlogs > 0
      ? ((blogsWithEmbeddings / totalBlogs) * 100).toFixed(2)
      : '0';

    res.json({
      totalBlogs,
      blogsWithEmbeddings,
      blogsWithoutEmbeddings: totalBlogs - blogsWithEmbeddings,
      embeddingCoverage: `${embeddingCoverage}%`,
      vectorSearchReady: blogsWithEmbeddings > 0
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});


module.exports = router;