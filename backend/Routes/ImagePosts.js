const express = require("express");
const router = express.Router();
const ImageComment = require('../models/imageCommentSchema');
const ImagePost = require('../models/imagepost');
const ImageReaction = require('../models/imageReactionSchema');
const authenticateToken = require("../middlewares/authMiddleware");
const UserAuthMiddleware = require("../middlewares/UserAuthMiddleware");
const upload = require("../middlewares/upload");
const extractDeviceId = require("../middlewares/extractDeviceId");
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const apicache = require("apicache");
const User = require("../models/userSchema");

const clearPostCaches = (postId = null) => {
  
  apicache.clear();
  
  
  if (postId) {
    apicache.clear(`/api/image-posts/${postId}`);
    apicache.clear(`/api/image-posts/${postId}/comments`);
  }
  apicache.clear('/api/image-posts');
};

const cacheMiddleware = (req, res, next) => {
  if (req.method === 'GET') {
    
    if (req.query.bustCache) {
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return next();
    }
    return apicache.middleware('5 minutes')(req, res, next);
  }
  next();
};


router.get('/api/image-posts/:id/media', async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ImagePost.findById(id).select('image video mediaType');
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (post.mediaType === 'image' && post.image?.data) {
      res.set('Content-Type', post.image.contentType);
      res.set('Cache-Control', 'public, max-age=31536000'); 
      return res.send(post.image.data);
    } else if (post.mediaType === 'video' && post.video?.data) {
      res.set('Content-Type', post.video.contentType);
      res.set('Cache-Control', 'public, max-age=31536000');
      return res.send(post.video.data);
    }
    
    res.status(404).json({ message: 'Media not found' });
  } catch (error) {
    console.error('Error serving media:', error);
    res.status(500).json({ message: error.message });
  }
});
router.get('/api/image-posts/:id/thumbnail', async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ImagePost.findById(id).select('video.thumbnail');
    
    if (!post || !post.video?.thumbnail?.data) {
      return res.status(404).json({ message: 'Thumbnail not found' });
    }
    
    res.set('Content-Type', post.video.thumbnail.contentType);
    res.set('Cache-Control', 'public, max-age=31536000');
    res.send(post.video.thumbnail.data);
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).json({ message: error.message });
  }
});
router.post('/api/admin/image-posts', authenticateToken, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const { caption, hideReactionCount, mediaType, videoDuration } = req.body;
    
    if (!mediaType || !['image', 'video'].includes(mediaType)) {
      return res.status(400).json({ message: 'Valid mediaType (image or video) is required' });
    }
    
    if (mediaType === 'image' && !req.files?.image) {
      return res.status(400).json({ message: 'Image is required for image posts' });
    }
    
    if (mediaType === 'video' && !req.files?.video) {
      return res.status(400).json({ message: 'Video is required for video posts' });
    }
    
    const postData = {
      caption,
      mediaType,
      author: req.user.admin_id,
      hideReactionCount: hideReactionCount === 'true' || hideReactionCount === true
    };
    
    if (mediaType === 'image' && req.files.image) {
      postData.image = {
        data: req.files.image[0].buffer,
        contentType: req.files.image[0].mimetype
      };
    }
    
    if (mediaType === 'video' && req.files.video) {
      postData.video = {
        data: req.files.video[0].buffer,
        contentType: req.files.video[0].mimetype,
        duration: videoDuration ? parseFloat(videoDuration) : null
      };
      
      if (req.files.thumbnail) {
        postData.video.thumbnail = {
          data: req.files.thumbnail[0].buffer,
          contentType: req.files.thumbnail[0].mimetype
        };
      }
    }
    
    const newImagePost = new ImagePost(postData);
    await newImagePost.save();
    
    clearPostCaches();
    
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


router.put('/api/admin/image-posts/:id', authenticateToken, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, hideReactionCount, mediaType, videoDuration } = req.body;
    
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (post.author.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }
    
    if (caption) post.caption = caption;
    if (hideReactionCount !== undefined) {
      post.hideReactionCount = hideReactionCount === 'true' || hideReactionCount === true;
    }
    
    if (mediaType && ['image', 'video'].includes(mediaType)) {
      post.mediaType = mediaType;
    }
    
    if (req.files?.image && post.mediaType === 'image') {
      post.image = {
        data: req.files.image[0].buffer,
        contentType: req.files.image[0].mimetype
      };
      post.video = undefined;
    }
    
    if (req.files?.video && post.mediaType === 'video') {
      post.video = {
        data: req.files.video[0].buffer,
        contentType: req.files.video[0].mimetype,
        duration: videoDuration ? parseFloat(videoDuration) : post.video?.duration
      };
      
      if (req.files.thumbnail) {
        post.video.thumbnail = {
          data: req.files.thumbnail[0].buffer,
          contentType: req.files.thumbnail[0].mimetype
        };
      }
      
      post.image = undefined;
    }
    
    if (req.files?.thumbnail && post.mediaType === 'video' && !req.files.video) {
      if (!post.video) post.video = {};
      post.video.thumbnail = {
        data: req.files.thumbnail[0].buffer,
        contentType: req.files.thumbnail[0].mimetype
      };
    }
    
    post.updatedAt = new Date();
    await post.save();
    
    clearPostCaches(id);
    
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


router.delete('/api/admin/image-posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    if (post.author.toString() !== req.user.admin_id) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }
    
    await ImageReaction.deleteMany({ post: id });
    await ImageComment.deleteMany({ post: id });
    await ImagePost.findByIdAndDelete(id);
    
    clearPostCaches(id);
    
    res.json({ message: 'Image post and associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting image post:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/admin/image-posts', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, mediaType } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const filter = {};
    if (mediaType && ['image', 'video'].includes(mediaType)) {
      filter.mediaType = mediaType;
    }
    
    const posts = await ImagePost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-image.data -video.data -video.thumbnail.data')
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

router.get('/api/admin/image-posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ImagePost.findById(id)
      .populate('author', 'name email');
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    
    const mediaUrl = `/api/image-posts/${id}/media`;
    const thumbnailUrl = post.mediaType === 'video' && post.video?.thumbnail?.data 
      ? `/api/image-posts/${id}/thumbnail` 
      : null;
    
    const reactions = await ImageReaction.find({ post: id }).countDocuments();
    const comments = await ImageComment.find({ post: id }).sort({ createdAt: -1 });
    
    res.json({
      post: {
        ...post._doc,
        media: mediaUrl,  
        thumbnail: thumbnailUrl,  
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




router.get('/api/image-posts', cacheMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, mediaType } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    const filter = {};
    if (mediaType && ['image', 'video'].includes(mediaType)) {
      filter.mediaType = mediaType;
    }
    
    const total = await ImagePost.countDocuments(filter);
    
    
    if (limitNum > 3 && req.headers['accept'] !== 'application/json-stream') {
      
      const posts = await ImagePost.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-image.data -video.data -video.thumbnail.data')
        .lean();
      
      return res.json({
        posts: posts.map(post => ({
          ...post,
          reactionCount: post.hideReactionCount ? null : post.reactionCount
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    }
    
    
    if (limitNum > 3) {
      res.setHeader('Content-Type', 'application/json');
      
      
      const firstBatch = await ImagePost.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(3)
        .select('-image.data -video.data -video.thumbnail.data')
        .lean();
      
      
      res.write(JSON.stringify({
        streaming: true,
        batch: 1,
        posts: firstBatch.map(post => ({
          ...post,
          reactionCount: post.hideReactionCount ? null : post.reactionCount
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }));
      
      
      setTimeout(async () => {
        try {
          const remainingPosts = await ImagePost.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip + 3)
            .limit(limitNum - 3)
            .select('-image.data -video.data -video.thumbnail.data')
            .lean();
          
          res.write('\n' + JSON.stringify({
            streaming: true,
            batch: 2,
            posts: remainingPosts.map(post => ({
              ...post,
              reactionCount: post.hideReactionCount ? null : post.reactionCount
            }))
          }));
          
          res.end();
        } catch (error) {
          console.error('Error fetching remaining posts:', error);
          res.end();
        }
      }, 150);
    } else {
      
      const posts = await ImagePost.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-image.data -video.data -video.thumbnail.data')
        .lean();
      
      res.json({
        posts: posts.map(post => ({
          ...post,
          reactionCount: post.hideReactionCount ? null : post.reactionCount
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    }
    
  } catch (error) {
    console.error('Error fetching public posts:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
});


router.get('/api/image-posts/:id', cacheMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.query.bustCache) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    
    const mediaUrl = `/api/image-posts/${id}/media`;
    const thumbnailUrl = post.mediaType === 'video' && post.video?.thumbnail?.data 
      ? `/api/image-posts/${id}/thumbnail` 
      : null;
    
    const comments = await ImageComment.find({ 
      post: id,
      status: 'active',
      parentComment: null
    })
    .populate('authorAdminId', 'name email profileImage')
    .sort({ isAuthorComment: -1, createdAt: -1 })
    .select('-user.deviceId')
    .lean();
    for (let comment of comments) {
  if (comment.user?.userId) {
    try {
      const userData = await User.findById(comment.user.userId)
        .select('name email profilePicture googleId')
        .lean();
      
      if (userData) {
        comment.user.profilePicture = userData.profilePicture;
        comment.user.googleId = userData.googleId;
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  }
  
  if (comment.isAuthorComment && comment.authorAdminId) {
    comment.authorHasProfileImage = !!(
      comment.authorAdminId.profileImage && 
      comment.authorAdminId.profileImage.data
    );
  }
}
    res.json({
      post: {
        id: post._id,
        caption: post.caption,
        mediaType: post.mediaType,
        media: mediaUrl,  
        thumbnail: thumbnailUrl,  
        videoDuration: post.video?.duration,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        reactionCount: post.hideReactionCount ? null : post.reactionCount,
        commentCount: post.commentCount
      },
      comments,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching public post:', error);
    res.status(500).json({ message: error.message });
  }
});



router.get('/api/image-posts/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    let comments = await ImageComment.find({
      post: id,
      status: 'active',
      parentComment: null
    })
    .populate('authorAdminId', 'name email profileImage')
    .sort({ isAuthorComment: -1, createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();
    
    // ✅ ADD THIS SECTION - Fetch user profile data
    for (let comment of comments) {
      if (comment.user?.userId) {
        try {
          const userData = await User.findById(comment.user.userId)
            .select('name email profilePicture googleId')
            .lean();
          
          if (userData) {
            comment.user.profilePicture = userData.profilePicture;
            comment.user.googleId = userData.googleId;
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      }
      
      if (comment.isAuthorComment && comment.authorAdminId) {
        comment.authorHasProfileImage = !!(
          comment.authorAdminId.profileImage && 
          comment.authorAdminId.profileImage.data
        );
      }
    }
    
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



router.get('/api/image-posts/comments/:commentId/replies', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    let replies = await ImageComment.find({
      parentComment: commentId,
      status: 'active'
    })
    .populate('authorAdminId', 'name email profileImage')
    .sort({ isAuthorComment: -1, createdAt: 1 })
    .skip(skip)
    .limit(limitNum)
    .lean();
    
    // ✅ ADD THIS SECTION - Fetch user profile data for replies
    for (let reply of replies) {
      if (reply.user?.userId) {
        try {
          const userData = await User.findById(reply.user.userId)
            .select('name email profilePicture googleId')
            .lean();
          
          if (userData) {
            reply.user.profilePicture = userData.profilePicture;
            reply.user.googleId = userData.googleId;
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      }
      
      if (reply.isAuthorComment && reply.authorAdminId) {
        reply.authorHasProfileImage = !!(
          reply.authorAdminId.profileImage && 
          reply.authorAdminId.profileImage.data
        );
      }
    }
    
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

router.post('/api/image-posts/:id/react', UserAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const userEmail = req.user.email;
    const userName = req.user.name;
    
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    const existingReaction = await ImageReaction.findOne({
      post: id,
      'user.email': userEmail
    });
    
    if (existingReaction) {
      await ImageReaction.findByIdAndDelete(existingReaction._id);
      await ImagePost.findByIdAndUpdate(id, { $inc: { reactionCount: -1 } });
      
      clearPostCaches(id);
      
      return res.json({
        message: 'Reaction removed successfully',
        hasReacted: false
      });
    }
    
    const newReaction = new ImageReaction({
      post: id,
      user: {
        name: userName,
        email: userEmail,
        deviceId: userId
      }
    });
    
    await newReaction.save();
    await ImagePost.findByIdAndUpdate(id, { $inc: { reactionCount: 1 } });
    
    clearPostCaches(id);
    
    res.status(201).json({
      message: 'Reaction added successfully',
      hasReacted: true
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reacted to this post' });
    }
    
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/image-posts/:id/has-reacted', UserAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    const reaction = await ImageReaction.findOne({
      post: id,
      'user.email': userEmail
    });
    
    res.json({
      hasReacted: !!reaction
    });
  } catch (error) {
    console.error('Error checking reaction status:', error);
    res.status(500).json({ message: error.message });
  }
});



router.post('/api/image-posts/:id/comments', 
  UserAuthMiddleware,
  [
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
      const { content, parentCommentId } = req.body;
      const userName = req.user.name;
      const userEmail = req.user.email;
      const userId = req.user.user_id;
      
      const post = await ImagePost.findById(id);
      if (!post) {
        return res.status(404).json({ message: 'Image post not found' });
      }

      if (parentCommentId) {
        const parentComment = await ImageComment.findById(parentCommentId);
        if (!parentComment) {
          return res.status(404).json({ message: 'Parent comment not found' });
        }
        if (parentComment.post.toString() !== id) {
          return res.status(400).json({ message: 'Parent comment does not belong to this post' });
        }
      }
      
      const newComment = new ImageComment({
        post: id,
        user: {
          name: userName,
          email: userEmail,
          deviceId: userId,
          userId: userId
        },
        content,
        isAuthorComment: false,
        parentComment: parentCommentId || null
      });
      
      await newComment.save();
      
      if (!parentCommentId) {
        await ImagePost.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });
      } else {
        await ImageComment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });
      }
      
      clearPostCaches(id);
      
      const updatedComments = await ImageComment.find({ 
        post: id,
        status: 'active',
        parentComment: parentCommentId || null
      })
      .populate('authorAdminId', 'name email profileImage')
      .sort({ isAuthorComment: -1, createdAt: -1 })
      .lean();
      
      for (let comment of updatedComments) {
        if (comment.user.userId) {
          const userData = await User.findById(comment.user.userId)
            .select('name email profilePicture googleId')
            .lean();
          if (userData) {
            comment.user.profilePicture = userData.profilePicture;
            comment.user.googleId = userData.googleId;
          }
        }
      }
      
      res.status(201).json({
        message: parentCommentId ? 'Reply added successfully' : 'Comment added successfully',
        comment: newComment,
        updatedComments: parentCommentId ? null : updatedComments, 
        timestamp: Date.now() 
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


router.post('/api/image-posts/comments/:commentId/like',
  UserAuthMiddleware,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      const userEmail = req.user.email;
      const userId = req.user.user_id;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      const alreadyLiked = comment.likes.some(
        like => like.email === userEmail || like.userId?.toString() === userId
      );

      if (alreadyLiked) {
        comment.likes = comment.likes.filter(
          like => like.email !== userEmail && like.userId?.toString() !== userId
        );
      } else {
        comment.dislikes = comment.dislikes.filter(
          dislike => dislike.email !== userEmail && dislike.userId?.toString() !== userId
        );
        
        comment.likes.push({ email: userEmail, userId: userId });
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


// POST: Dislike comment with userId
router.post('/api/image-posts/comments/:commentId/dislike',
  UserAuthMiddleware,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      const userEmail = req.user.email;
      const userId = req.user.user_id;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      const alreadyDisliked = comment.dislikes.some(
        dislike => dislike.email === userEmail || dislike.userId?.toString() === userId
      );

      if (alreadyDisliked) {
        comment.dislikes = comment.dislikes.filter(
          dislike => dislike.email !== userEmail && dislike.userId?.toString() !== userId
        );
      } else {
        comment.likes = comment.likes.filter(
          like => like.email !== userEmail && like.userId?.toString() !== userId
        );
        
        comment.dislikes.push({ email: userEmail, userId: userId });
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
router.get('/api/image-posts/comments/:commentId/user-reaction',
  UserAuthMiddleware,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      const userEmail = req.user.email;
      const userId = req.user.user_id;

      const comment = await ImageComment.findById(commentId)
        .select('likes dislikes likeCount dislikeCount');
      
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      const userLiked = comment.likes.some(
        like => like.email === userEmail || like.userId?.toString() === userId
      );

      const userDisliked = comment.dislikes.some(
        dislike => dislike.email === userEmail || dislike.userId?.toString() === userId
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



router.delete('/api/image-posts/comments/:commentId', 
  UserAuthMiddleware,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      const userEmail = req.user.email;
      const userId = req.user.user_id;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      if (comment.isAuthorComment) {
        return res.status(403).json({ message: 'Cannot delete author comments through this route' });
      }
      
      if (comment.user.email !== userEmail && comment.user.deviceId !== userId) {
        return res.status(403).json({ message: 'Not authorized to delete this comment' });
      }

      const replies = await ImageComment.find({ parentComment: commentId });
      const activeRepliesCount = replies.filter(r => r.status === 'active').length;
      
      await ImageComment.deleteMany({ parentComment: commentId });
      
      if (comment.status === 'active') {
        if (!comment.parentComment) {
          await ImagePost.findByIdAndUpdate(comment.post, { 
            $inc: { commentCount: -(1 + activeRepliesCount) }
          });
        } else {
          await ImageComment.findByIdAndUpdate(comment.parentComment, { 
            $inc: { replyCount: -1 }
          });
        }
      }
      
      await ImageComment.findByIdAndDelete(commentId);
      
      clearPostCaches(comment.post);
      
      
      const updatedComments = await ImageComment.find({ 
        post: comment.post,
        status: 'active',
        parentComment: comment.parentComment || null
      })
      .sort({ isAuthorComment: -1, createdAt: -1 })
      .select('-user.deviceId')
      .lean();
      
      res.json({ 
        message: 'Comment deleted successfully',
        deletedReplies: replies.length,
        updatedComments,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


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

      const post = await ImagePost.findById(id);
      if (!post) {
        return res.status(404).json({ message: 'Image post not found' });
      }

      if (parentCommentId) {
        const parentComment = await ImageComment.findById(parentCommentId);
        if (!parentComment) {
          return res.status(404).json({ message: 'Parent comment not found' });
        }
        if (parentComment.post.toString() !== id) {
          return res.status(400).json({ message: 'Parent comment does not belong to this post' });
        }
      }

      const newComment = new ImageComment({
        post: id,
        user: { 
          name: req.user.name || 'Admin',
          email: req.user.email
        },
        content,
        isAuthorComment: true,
        authorAdminId: req.user.admin_id,
        parentComment: parentCommentId || null,
        status: 'active'
      });

      await newComment.save();
      
      if (!parentCommentId) {
        await ImagePost.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });
      } else {
        await ImageComment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });
      }

      clearPostCaches(id);

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



router.get('/api/admin/image-posts/:id/comments', 
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, status, includeReplies = 'true' } = req.query;
      
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;
      
      const filter = { post: id, parentComment: null };
      if (status && ['active', 'hidden'].includes(status)) {
        filter.status = status;
      }
      
      let comments = await ImageComment.find(filter)
        .populate('authorAdminId', 'name email profileImage')
        .sort({ isAuthorComment: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
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
      }
      
      if (includeReplies === 'true') {
        for (let comment of comments) {
          let replies = await ImageComment.find({ 
            parentComment: comment._id 
          })
          .populate('authorAdminId', 'name email profileImage')
          .sort({ isAuthorComment: -1, createdAt: 1 })
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
          }
          
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
      
      clearPostCaches(comment.post);
      
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
        
        if (!comment.parentComment) {
          if (oldStatus === 'active' && status === 'hidden') {
            await ImagePost.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });
          } else if (oldStatus === 'hidden' && status === 'active') {
            await ImagePost.findByIdAndUpdate(comment.post, { $inc: { commentCount: 1 } });
          }
        } else {
          if (oldStatus === 'active' && status === 'hidden') {
            await ImageComment.findByIdAndUpdate(comment.parentComment, { $inc: { replyCount: -1 } });
          } else if (oldStatus === 'hidden' && status === 'active') {
            await ImageComment.findByIdAndUpdate(comment.parentComment, { $inc: { replyCount: 1 } });
          }
        }
        
        clearPostCaches(comment.post);
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


router.delete('/api/admin/image-comments/:commentId',
  authenticateToken,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      
      const comment = await ImageComment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      const replies = await ImageComment.find({ parentComment: commentId });
      const activeRepliesCount = replies.filter(r => r.status === 'active').length;
      
      await ImageComment.deleteMany({ parentComment: commentId });
      
      if (comment.status === 'active') {
        if (!comment.parentComment) {
          await ImagePost.findByIdAndUpdate(comment.post, { 
            $inc: { commentCount: -(1 + activeRepliesCount) }
          });
        } else {
          await ImageComment.findByIdAndUpdate(comment.parentComment, { 
            $inc: { replyCount: -1 }
          });
        }
      }
      
      await ImageComment.findByIdAndDelete(commentId);
      
      clearPostCaches(comment.post);
      
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
      
      const postUpdates = {};
      const parentUpdates = {};
      const affectedPosts = new Set();
      
      for (let comment of comments) {
        affectedPosts.add(comment.post.toString());
        
        if (comment.status === 'active') {
          if (!comment.parentComment) {
            const postId = comment.post.toString();
            postUpdates[postId] = (postUpdates[postId] || 0) + 1;
          } else {
            const parentId = comment.parentComment.toString();
            parentUpdates[parentId] = (parentUpdates[parentId] || 0) + 1;
          }
        }
        
        const replies = await ImageComment.find({ parentComment: comment._id });
        await ImageComment.deleteMany({ parentComment: comment._id });
      }
      
      await ImageComment.deleteMany({ _id: { $in: commentIds } });
      
      const postUpdatePromises = Object.entries(postUpdates).map(([postId, count]) =>
        ImagePost.findByIdAndUpdate(postId, { $inc: { commentCount: -count } })
      );
      
      const parentUpdatePromises = Object.entries(parentUpdates).map(([parentId, count]) =>
        ImageComment.findByIdAndUpdate(parentId, { $inc: { replyCount: -count } })
      );
      
      await Promise.all([...postUpdatePromises, ...parentUpdatePromises]);
      
      affectedPosts.forEach(postId => clearPostCaches(postId));
      
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
      
      const postUpdates = {};
      const parentUpdates = {};
      const affectedPosts = new Set();
      
      comments.forEach(comment => {
        affectedPosts.add(comment.post.toString());
        
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
      
      await ImageComment.updateMany(
        { _id: { $in: commentIds } },
        { 
          $set: { 
            status,
            updatedAt: Date.now()
          }
        }
      );
      
      const postUpdatePromises = Object.entries(postUpdates)
        .filter(([_, count]) => count !== 0)
        .map(([postId, count]) =>
          ImagePost.findByIdAndUpdate(postId, { $inc: { commentCount: count } })
        );
      
      const parentUpdatePromises = Object.entries(parentUpdates)
        .filter(([_, count]) => count !== 0)
        .map(([parentId, count]) =>
          ImageComment.findByIdAndUpdate(parentId, { $inc: { replyCount: count } })
        );
      
      await Promise.all([...postUpdatePromises, ...parentUpdatePromises]);
      
      affectedPosts.forEach(postId => clearPostCaches(postId));
      
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