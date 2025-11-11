const express = require("express");
const router = express.Router();
const ImageComment = require('../models/imageCommentSchema');
const ImagePost= require('../models/imagepost');
const ImageReaction= require('../models/imageReactionSchema');
const authenticateToken = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");
const extractDeviceId = require("../middlewares/extractDeviceId");
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
router.post('/api/admin/image-posts', authenticateToken, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const { caption, hideReactionCount, mediaType, videoDuration } = req.body;
    
    // Validate media type
    if (!mediaType || !['image', 'video'].includes(mediaType)) {
      return res.status(400).json({ message: 'Valid mediaType (image or video) is required' });
    }
    
    // Validate media is provided based on type
    if (mediaType === 'image' && !req.files?.image) {
      return res.status(400).json({ message: 'Image is required for image posts' });
    }
    
    if (mediaType === 'video' && !req.files?.video) {
      return res.status(400).json({ message: 'Video is required for video posts' });
    }
    
    // Create new post object
    const postData = {
      caption,
      mediaType,
      author: req.user.admin_id,
      hideReactionCount: hideReactionCount === 'true' || hideReactionCount === true
    };
    
    // Add image data if image type
    if (mediaType === 'image' && req.files.image) {
      postData.image = {
        data: req.files.image[0].buffer,
        contentType: req.files.image[0].mimetype
      };
    }
    
    // Add video data if video type
    if (mediaType === 'video' && req.files.video) {
      postData.video = {
        data: req.files.video[0].buffer,
        contentType: req.files.video[0].mimetype,
        duration: videoDuration ? parseFloat(videoDuration) : null
      };
      
      // Add thumbnail if provided
      if (req.files.thumbnail) {
        postData.video.thumbnail = {
          data: req.files.thumbnail[0].buffer,
          contentType: req.files.thumbnail[0].mimetype
        };
      }
    }
    
    const newImagePost = new ImagePost(postData);
    await newImagePost.save();
    
    res.status(201).json({
      message: `${mediaType === 'video' ? 'Video' : 'Image'} post created successfully`,
      post: {
        id: newImagePost._id,
        caption: newImagePost.caption,
        mediaType: newImagePost.mediaType,
        hideReactionCount: newImagePost.hideReactionCount,
        createdAt: newImagePost.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: error.message });
  }
});


// Update an image/video post (admin only)
router.put('/api/admin/image-posts/:id', authenticateToken, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, hideReactionCount, mediaType, videoDuration } = req.body;
    
    // Find post
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if user is authorized
    if (post.author.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }
    
    // Update basic fields
    if (caption) post.caption = caption;
    if (hideReactionCount !== undefined) {
      post.hideReactionCount = hideReactionCount === 'true' || hideReactionCount === true;
    }
    
    // Update media type if provided
    if (mediaType && ['image', 'video'].includes(mediaType)) {
      post.mediaType = mediaType;
    }
    
    // Update image if provided and type is image
    if (req.files?.image && post.mediaType === 'image') {
      post.image = {
        data: req.files.image[0].buffer,
        contentType: req.files.image[0].mimetype
      };
      // Clear video data if switching from video to image
      post.video = undefined;
    }
    
    // Update video if provided and type is video
    if (req.files?.video && post.mediaType === 'video') {
      post.video = {
        data: req.files.video[0].buffer,
        contentType: req.files.video[0].mimetype,
        duration: videoDuration ? parseFloat(videoDuration) : post.video?.duration
      };
      
      // Update thumbnail if provided
      if (req.files.thumbnail) {
        post.video.thumbnail = {
          data: req.files.thumbnail[0].buffer,
          contentType: req.files.thumbnail[0].mimetype
        };
      }
      
      // Clear image data if switching from image to video
      post.image = undefined;
    }
    
    // Update thumbnail separately if provided for existing video
    if (req.files?.thumbnail && post.mediaType === 'video' && !req.files.video) {
      if (!post.video) post.video = {};
      post.video.thumbnail = {
        data: req.files.thumbnail[0].buffer,
        contentType: req.files.thumbnail[0].mimetype
      };
    }
    
    post.updatedAt = new Date();
    await post.save();
    
    res.json({
      message: 'Post updated successfully',
      post: {
        id: post._id,
        caption: post.caption,
        mediaType: post.mediaType,
        hideReactionCount: post.hideReactionCount,
        updatedAt: post.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ message: error.message });
  }
});
// Delete an image post (admin only)
router.delete('/api/admin/image-posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find post
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    // Check if user is authorized (author or admin)
    if (post.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }
    
    // Delete post and associated reactions and comments
    await ImageReaction.deleteMany({ post: id });
    await ImageComment.deleteMany({ post: id });
    await ImagePost.findByIdAndDelete(id);
    
    res.json({ message: 'Image post and associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting image post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all image posts for admin dashboard
router.get('/api/admin/image-posts', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, mediaType } = req.query;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter
    const filter = {};
    if (mediaType && ['image', 'video'].includes(mediaType)) {
      filter.mediaType = mediaType;
    }
    
    // Get posts with reaction and comment counts
    const posts = await ImagePost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-image.data -video.data -video.thumbnail.data') // Exclude binary data for listing
      .populate('author', 'name email');
    
    const total = await ImagePost.countDocuments(filter);
    
    res.json({
      posts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching image posts for admin:', error);
    res.status(500).json({ message: error.message });
  }
});
// Get single image/video post with admin details
router.get('/api/admin/image-posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ImagePost.findById(id)
      .populate('author', 'name email');
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Prepare response based on media type
    let mediaData = null;
    let thumbnailData = null;
    
    if (post.mediaType === 'image' && post.image?.data) {
      mediaData = `data:${post.image.contentType};base64,${post.image.data.toString('base64')}`;
    } else if (post.mediaType === 'video' && post.video?.data) {
      mediaData = `data:${post.video.contentType};base64,${post.video.data.toString('base64')}`;
      
      if (post.video.thumbnail?.data) {
        thumbnailData = `data:${post.video.thumbnail.contentType};base64,${post.video.thumbnail.data.toString('base64')}`;
      }
    }
    
    // Get reactions and comments
    const reactions = await ImageReaction.find({ post: id }).countDocuments();
    const comments = await ImageComment.find({ post: id }).sort({ createdAt: -1 });
    
    res.json({
      post: {
        ...post._doc,
        media: mediaData,
        thumbnail: thumbnailData,
        videoDuration: post.video?.duration,
        image: undefined,
        video: undefined
      },
      reactions,
      comments
    });
  } catch (error) {
    console.error('Error fetching post details for admin:', error);
    res.status(500).json({ message: error.message });
  }
});
// PUBLIC ROUTES
// Get all published image posts (public)
// Get all published image/video posts (public)
router.get('/api/image-posts', async (req, res) => {
  try {
    const { page = 1, limit = 10, mediaType } = req.query;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter
    const filter = {};
    if (mediaType && ['image', 'video'].includes(mediaType)) {
      filter.mediaType = mediaType;
    }
    
    // Get posts for public view
    const posts = await ImagePost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-image.data -video.data -video.thumbnail.data') // Exclude binary data for listing
      .lean();
    
    const total = await ImagePost.countDocuments(filter);
    
    res.json({
      posts: posts.map(post => ({
        ...post,
        // Only include reaction count if not hidden
        reactionCount: post.hideReactionCount ? null : post.reactionCount
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching public posts:', error);
    res.status(500).json({ message: error.message });
  }
});
// Get single image/video post (public)
router.get('/api/image-posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Prepare response based on media type
    let mediaData = null;
    let thumbnailData = null;
    
    if (post.mediaType === 'image' && post.image?.data) {
      mediaData = `data:${post.image.contentType};base64,${post.image.data.toString('base64')}`;
    } else if (post.mediaType === 'video' && post.video?.data) {
      mediaData = `data:${post.video.contentType};base64,${post.video.data.toString('base64')}`;
      
      if (post.video.thumbnail?.data) {
        thumbnailData = `data:${post.video.thumbnail.contentType};base64,${post.video.thumbnail.data.toString('base64')}`;
      }
    }
    
    // Get active TOP-LEVEL comments only (no replies)
    const comments = await ImageComment.find({ 
      post: id,
      status: 'active',
      parentComment: null
    }).sort({ createdAt: -1 });
    
    res.json({
      post: {
        id: post._id,
        caption: post.caption,
        mediaType: post.mediaType,
        media: mediaData,
        thumbnail: thumbnailData,
        videoDuration: post.video?.duration,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        reactionCount: post.hideReactionCount ? null : post.reactionCount,
        commentCount: post.commentCount
      },
      comments
    });
  } catch (error) {
    console.error('Error fetching public post:', error);
    res.status(500).json({ message: error.message });
  }
});
// Like an image post (public)
router.post('/api/image-posts/:id/react', extractDeviceId, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    const deviceId = req.deviceId;
    
    // Validate inputs
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    
    // Check if post exists
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    // Check if user already reacted
    const existingReaction = await ImageReaction.findOne({
      post: id,
      $or: [
        { 'user.email': email },
        { 'user.deviceId': deviceId }
      ]
    });
    
    if (existingReaction) {
      // Remove reaction (toggle off)
      await ImageReaction.findByIdAndDelete(existingReaction._id);
      await ImagePost.findByIdAndUpdate(id, { $inc: { reactionCount: -1 } });
      
      return res.json({
        message: 'Reaction removed successfully',
        hasReacted: false
      });
    }
    
    // Create new reaction
    const newReaction = new ImageReaction({
      post: id,
      user: {
        name,
        email,
        deviceId
      }
    });
    
    await newReaction.save();
    await ImagePost.findByIdAndUpdate(id, { $inc: { reactionCount: 1 } });
    
    res.status(201).json({
      message: 'Reaction added successfully',
      hasReacted: true
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reacted to this post' });
    }
    
    res.status(500).json({ message: error.message });
  }
});

// Check if user has reacted to a post
router.get('/api/image-posts/:id/has-reacted', extractDeviceId, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;
    const deviceId = req.deviceId;
    
    // Need email or deviceId
    if (!email && !deviceId) {
      return res.status(400).json({ message: 'Email or device identification required' });
    }
    
    // Build query
    const query = { post: id };
    
    if (email) {
      query['user.email'] = email;
    } else {
      query['user.deviceId'] = deviceId;
    }
    
    // Check if reaction exists
    const reaction = await ImageReaction.findOne(query);
    
    res.json({
      hasReacted: !!reaction
    });
  } catch (error) {
    console.error('Error checking reaction status:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== PUBLIC ROUTES ====================

// Add a regular comment (public users)
router.post('/api/image-posts/:id/comments', 
  extractDeviceId,
  [
    body('name').trim().notEmpty().withMessage('Name is required')
      .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
    body('email').trim().isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('content').trim().notEmpty().withMessage('Comment content is required')
      .isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters'),
    body('parentCommentId').optional().isMongoId().withMessage('Invalid parent comment ID')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { name, email, content, parentCommentId } = req.body;
      const deviceId = req.deviceId;
      
      // Check if post exists
      const post = await ImagePost.findById(id);
      if (!post) {
        return res.status(404).json({ message: 'Image post not found' });
      }

      // If it's a reply, check if parent comment exists
      if (parentCommentId) {
        const parentComment = await ImageComment.findById(parentCommentId);
        if (!parentComment) {
          return res.status(404).json({ message: 'Parent comment not found' });
        }
        if (parentComment.post.toString() !== id) {
          return res.status(400).json({ message: 'Parent comment does not belong to this post' });
        }
      }
      
      // Create new comment
      const newComment = new ImageComment({
        post: id,
        user: {
          name,
          email,
          deviceId
        },
        content,
        isAuthorComment: false,
        parentComment: parentCommentId || null
      });
      
      await newComment.save();
      
      // Update post comment count (only for top-level comments)
      if (!parentCommentId) {
        await ImagePost.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });
      } else {
        // Update parent comment reply count
        await ImageComment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });
      }
      
      res.status(201).json({
        message: parentCommentId ? 'Reply added successfully' : 'Comment added successfully',
        comment: newComment
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Get comments for an image post (public - active comments only)
router.get('/api/image-posts/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Get only top-level active comments (no parent)
    const comments = await ImageComment.find({
      post: id,
      status: 'active',
      parentComment: null
    })
    .sort({ isAuthorComment: -1, createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .select('-user.deviceId -likes -dislikes')
    .lean();
    
    const total = await ImageComment.countDocuments({
      post: id,
      status: 'active',
      parentComment: null
    });
    
    res.json({
      comments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get replies for a comment (public)
router.get('/api/image-posts/comments/:commentId/replies', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Get active replies
    const replies = await ImageComment.find({
      parentComment: commentId,
      status: 'active'
    })
    .sort({ isAuthorComment: -1, createdAt: 1 }) // Author replies first, then chronological
    .skip(skip)
    .limit(limitNum)
    .select('-user.deviceId -likes -dislikes')
    .lean();
    
    const total = await ImageComment.countDocuments({
      parentComment: commentId,
      status: 'active'
    });
    
    res.json({
      replies,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Like a comment (public)
router.post('/api/image-posts/comments/:commentId/like',
  extractDeviceId,
  [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { email } = req.body;
      const deviceId = req.deviceId;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      // Check if already liked
      const alreadyLiked = comment.likes.some(
        like => like.email === email || like.deviceId === deviceId
      );

      if (alreadyLiked) {
        // Remove like
        comment.likes = comment.likes.filter(
          like => like.email !== email && like.deviceId !== deviceId
        );
      } else {
        // Remove dislike if exists
        comment.dislikes = comment.dislikes.filter(
          dislike => dislike.email !== email && dislike.deviceId !== deviceId
        );
        
        // Add like
        comment.likes.push({ email, deviceId });
      }

      await comment.save();

      res.json({
        message: alreadyLiked ? 'Like removed' : 'Comment liked',
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
        userLiked: !alreadyLiked
      });
    } catch (error) {
      console.error('Error liking comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Dislike a comment (public)
router.post('/api/image-posts/comments/:commentId/dislike',
  extractDeviceId,
  [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { email } = req.body;
      const deviceId = req.deviceId;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      // Check if already disliked
      const alreadyDisliked = comment.dislikes.some(
        dislike => dislike.email === email || dislike.deviceId === deviceId
      );

      if (alreadyDisliked) {
        // Remove dislike
        comment.dislikes = comment.dislikes.filter(
          dislike => dislike.email !== email && dislike.deviceId !== deviceId
        );
      } else {
        // Remove like if exists
        comment.likes = comment.likes.filter(
          like => like.email !== email && like.deviceId !== deviceId
        );
        
        // Add dislike
        comment.dislikes.push({ email, deviceId });
      }

      await comment.save();

      res.json({
        message: alreadyDisliked ? 'Dislike removed' : 'Comment disliked',
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
        userDisliked: !alreadyDisliked
      });
    } catch (error) {
      console.error('Error disliking comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Check user's reaction on a comment (public)
router.get('/api/image-posts/comments/:commentId/user-reaction',
  extractDeviceId,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      const { email } = req.query;
      const deviceId = req.deviceId;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const comment = await ImageComment.findById(commentId)
        .select('likes dislikes likeCount dislikeCount');
      
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      const userLiked = comment.likes.some(
        like => like.email === email || like.deviceId === deviceId
      );

      const userDisliked = comment.dislikes.some(
        dislike => dislike.email === email || dislike.deviceId === deviceId
      );

      res.json({
        userLiked,
        userDisliked,
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount
      });
    } catch (error) {
      console.error('Error checking user reaction:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Delete own comment (public users only - not author comments)
router.delete('/api/image-posts/comments/:commentId', 
  extractDeviceId,
  [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { email } = req.body;
      const deviceId = req.deviceId;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      if (comment.isAuthorComment) {
        return res.status(403).json({ message: 'Cannot delete author comments through this route' });
      }
      
      if (comment.user.email !== email && comment.user.deviceId !== deviceId) {
        return res.status(403).json({ message: 'Not authorized to delete this comment' });
      }

      // Delete all replies to this comment
      const replies = await ImageComment.find({ parentComment: commentId });
      const activeRepliesCount = replies.filter(r => r.status === 'active').length;
      
      await ImageComment.deleteMany({ parentComment: commentId });
      
      // Update post's comment count if comment is active
      if (comment.status === 'active') {
        if (!comment.parentComment) {
          // Top-level comment: decrement post comment count
          await ImagePost.findByIdAndUpdate(comment.post, { 
            $inc: { commentCount: -(1 + activeRepliesCount) }
          });
        } else {
          // Reply: decrement parent's reply count
          await ImageComment.findByIdAndUpdate(comment.parentComment, { 
            $inc: { replyCount: -1 }
          });
        }
      }
      
      await ImageComment.findByIdAndDelete(commentId);
      
      res.json({ 
        message: 'Comment deleted successfully',
        deletedReplies: replies.length
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// ==================== ADMIN ROUTES ====================

// Add author comment or reply (admin only)
router.post('/api/image-posts/:id/author-comment',
  authenticateToken,
  [
    body('content').trim().notEmpty().withMessage('Comment content is required')
      .isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters'),
    body('parentCommentId').optional().isMongoId().withMessage('Invalid parent comment ID')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { content, parentCommentId } = req.body;

      // Check if post exists
      const post = await ImagePost.findById(id);
      if (!post) {
        return res.status(404).json({ message: 'Image post not found' });
      }

      // If it's a reply, check if parent comment exists
      if (parentCommentId) {
        const parentComment = await ImageComment.findById(parentCommentId);
        if (!parentComment) {
          return res.status(404).json({ message: 'Parent comment not found' });
        }
        if (parentComment.post.toString() !== id) {
          return res.status(400).json({ message: 'Parent comment does not belong to this post' });
        }
      }

      // Create new author comment
      const newComment = new ImageComment({
        post: id,
        user: { 
          name: req.user.name || 'Admin',
          email: req.user.email
        },
        content,
        isAuthorComment: true,
        parentComment: parentCommentId || null,
        status: 'active'
      });

      await newComment.save();
      
      // Update counts
      if (!parentCommentId) {
        await ImagePost.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });
      } else {
        await ImageComment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });
      }

      res.status(201).json({ 
        message: parentCommentId ? 'Author reply added successfully' : 'Author comment added successfully',
        comment: newComment
      });
    } catch (error) {
      console.error('Error adding author comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Get all comments for admin (including hidden and with replies)
router.get('/api/admin/image-posts/:id/comments', 
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, status, includeReplies = 'true' } = req.query;
      
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;
      
      // Build filter for top-level comments
      const filter = { post: id, parentComment: null };
      if (status && ['active', 'hidden'].includes(status)) {
        filter.status = status;
      }
      
      const comments = await ImageComment.find(filter)
        .sort({ isAuthorComment: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();
      
      // If includeReplies, fetch replies for each comment
      if (includeReplies === 'true') {
        for (let comment of comments) {
          const replies = await ImageComment.find({ 
            parentComment: comment._id 
          })
          .sort({ isAuthorComment: -1, createdAt: 1 })
          .lean();
          
          comment.replies = replies;
        }
      }
      
      const total = await ImageComment.countDocuments(filter);
      
      res.json({
        comments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Error fetching admin comments:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Update author comment (admin only)
router.put('/api/admin/image-comments/:commentId',
  authenticateToken,
  [
    body('content').optional().trim().notEmpty()
      .isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { content } = req.body;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      if (!comment.isAuthorComment) {
        return res.status(403).json({ message: 'Can only edit author comments' });
      }
      
      if (comment.user.email !== req.user.email) {
        return res.status(403).json({ message: 'Not authorized to edit this comment' });
      }
      
      comment.content = content;
      comment.updatedAt = Date.now();
      await comment.save();
      
      res.json({
        message: 'Comment updated successfully',
        comment
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Hide/unhide comment status (admin only)
router.patch('/api/admin/image-comments/:commentId', 
  authenticateToken,
  [
    body('status').isIn(['active', 'hidden']).withMessage('Status must be active or hidden')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { status } = req.body;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      const oldStatus = comment.status;
      
      if (oldStatus !== status) {
        comment.status = status;
        comment.updatedAt = Date.now();
        await comment.save();
        
        // Update counts
        if (!comment.parentComment) {
          // Top-level comment
          if (oldStatus === 'active' && status === 'hidden') {
            await ImagePost.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });
          } else if (oldStatus === 'hidden' && status === 'active') {
            await ImagePost.findByIdAndUpdate(comment.post, { $inc: { commentCount: 1 } });
          }
        } else {
          // Reply
          if (oldStatus === 'active' && status === 'hidden') {
            await ImageComment.findByIdAndUpdate(comment.parentComment, { $inc: { replyCount: -1 } });
          } else if (oldStatus === 'hidden' && status === 'active') {
            await ImageComment.findByIdAndUpdate(comment.parentComment, { $inc: { replyCount: 1 } });
          }
        }
      }
      
      res.json({
        message: `Comment ${status === 'hidden' ? 'hidden' : 'unhidden'} successfully`,
        comment
      });
    } catch (error) {
      console.error('Error updating comment status:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Delete any comment (admin only)
router.delete('/api/admin/image-comments/:commentId',
  authenticateToken,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      // Delete all replies to this comment
      const replies = await ImageComment.find({ parentComment: commentId });
      const activeRepliesCount = replies.filter(r => r.status === 'active').length;
      
      await ImageComment.deleteMany({ parentComment: commentId });
      
      // Update counts if comment is active
      if (comment.status === 'active') {
        if (!comment.parentComment) {
          // Top-level comment
          await ImagePost.findByIdAndUpdate(comment.post, { 
            $inc: { commentCount: -(1 + activeRepliesCount) }
          });
        } else {
          // Reply
          await ImageComment.findByIdAndUpdate(comment.parentComment, { 
            $inc: { replyCount: -1 }
          });
        }
      }
      
      await ImageComment.findByIdAndDelete(commentId);
      
      res.json({ 
        message: 'Comment deleted successfully',
        deletedReplies: replies.length
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Get comment statistics (admin only)
router.get('/api/admin/image-posts/:id/comments/stats',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const stats = await ImageComment.aggregate([
        { $match: { post: mongoose.Types.ObjectId(id) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { 
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            hidden: { 
              $sum: { $cond: [{ $eq: ['$status', 'hidden'] }, 1, 0] }
            },
            authorComments: { 
              $sum: { $cond: ['$isAuthorComment', 1, 0] }
            },
            userComments: { 
              $sum: { $cond: [{ $not: '$isAuthorComment' }, 1, 0] }
            },
            topLevelComments: {
              $sum: { $cond: [{ $eq: ['$parentComment', null] }, 1, 0] }
            },
            replies: {
              $sum: { $cond: [{ $ne: ['$parentComment', null] }, 1, 0] }
            },
            totalLikes: { $sum: '$likeCount' },
            totalDislikes: { $sum: '$dislikeCount' }
          }
        }
      ]);
      
      res.json(stats[0] || {
        total: 0,
        active: 0,
        hidden: 0,
        authorComments: 0,
        userComments: 0,
        topLevelComments: 0,
        replies: 0,
        totalLikes: 0,
        totalDislikes: 0
      });
    } catch (error) {
      console.error('Error fetching comment stats:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Get all comments across all posts (admin dashboard)
router.get('/api/admin/image-comments',
  authenticateToken,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, status, isAuthorComment } = req.query;
      
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;
      
      const filter = {};
      if (status && ['active', 'hidden'].includes(status)) {
        filter.status = status;
      }
      if (isAuthorComment !== undefined) {
        filter.isAuthorComment = isAuthorComment === 'true';
      }
      
      const comments = await ImageComment.find(filter)
        .populate('post', 'caption createdAt')
        .populate('parentComment', 'content user.name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);
      
      const total = await ImageComment.countDocuments(filter);
      
      res.json({
        comments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Error fetching all comments:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Bulk delete comments (admin only)
router.post('/api/admin/image-comments/bulk-delete',
  authenticateToken,
  [
    body('commentIds').isArray({ min: 1 }).withMessage('commentIds must be a non-empty array'),
    body('commentIds.*').isMongoId().withMessage('Invalid comment ID format')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentIds } = req.body;
      
      const comments = await ImageComment.find({ _id: { $in: commentIds } });
      
      if (comments.length === 0) {
        return res.status(404).json({ message: 'No comments found' });
      }
      
      // Calculate counts to update
      const postUpdates = {};
      const parentUpdates = {};
      
      for (let comment of comments) {
        if (comment.status === 'active') {
          if (!comment.parentComment) {
            const postId = comment.post.toString();
            postUpdates[postId] = (postUpdates[postId] || 0) + 1;
          } else {
            const parentId = comment.parentComment.toString();
            parentUpdates[parentId] = (parentUpdates[parentId] || 0) + 1;
          }
        }
        
        // Delete replies
        const replies = await ImageComment.find({ parentComment: comment._id });
        await ImageComment.deleteMany({ parentComment: comment._id });
      }
      
      // Delete comments
      await ImageComment.deleteMany({ _id: { $in: commentIds } });
      
      // Update post counts
      const postUpdatePromises = Object.entries(postUpdates).map(([postId, count]) =>
        ImagePost.findByIdAndUpdate(postId, { $inc: { commentCount: -count } })
      );
      
      // Update parent comment counts
      const parentUpdatePromises = Object.entries(parentUpdates).map(([parentId, count]) =>
        ImageComment.findByIdAndUpdate(parentId, { $inc: { replyCount: -count } })
      );
      
      await Promise.all([...postUpdatePromises, ...parentUpdatePromises]);
      res.json({
        message: `${comments.length} comment(s) deleted successfully`,
        deletedCount: comments.length
      });
    } catch (error) {
      console.error('Error bulk deleting comments:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Bulk update comment status (admin only)
router.patch('/api/admin/image-comments/bulk-status',
  authenticateToken,
  [
    body('commentIds').isArray({ min: 1 }).withMessage('commentIds must be a non-empty array'),
    body('commentIds.*').isMongoId().withMessage('Invalid comment ID format'),
    body('status').isIn(['active', 'hidden']).withMessage('Status must be active or hidden')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentIds, status } = req.body;
      
      const comments = await ImageComment.find({ _id: { $in: commentIds } });
      
      if (comments.length === 0) {
        return res.status(404).json({ message: 'No comments found' });
      }
      
      // Calculate count changes
      const postUpdates = {};
      const parentUpdates = {};
      
      comments.forEach(comment => {
        if (comment.status !== status) {
          const change = status === 'active' ? 1 : -1;
          
          if (!comment.parentComment) {
            const postId = comment.post.toString();
            postUpdates[postId] = (postUpdates[postId] || 0) + change;
          } else {
            const parentId = comment.parentComment.toString();
            parentUpdates[parentId] = (parentUpdates[parentId] || 0) + change;
          }
        }
      });
      
      // Update comments
      await ImageComment.updateMany(
        { _id: { $in: commentIds } },
        { 
          $set: { 
            status,
            updatedAt: Date.now()
          }
        }
      );
      
      // Update post counts
      const postUpdatePromises = Object.entries(postUpdates)
        .filter(([_, count]) => count !== 0)
        .map(([postId, count]) =>
          ImagePost.findByIdAndUpdate(postId, { $inc: { commentCount: count } })
        );
      
      // Update parent comment counts
      const parentUpdatePromises = Object.entries(parentUpdates)
        .filter(([_, count]) => count !== 0)
        .map(([parentId, count]) =>
          ImageComment.findByIdAndUpdate(parentId, { $inc: { replyCount: count } })
        );
      
      await Promise.all([...postUpdatePromises, ...parentUpdatePromises]);
      
      res.json({
        message: `${comments.length} comment(s) updated successfully`,
        updatedCount: comments.length,
        newStatus: status
      });
    } catch (error) {
      console.error('Error bulk updating comments:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);
module.exports = router;