const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');
const CommunityPost = require('../models/communityPostSchema');
const CommunityComment = require('../models/communityCommentSchema');
const CommunityLike = require('../models/communityLikeSchema');
const CommunityShare = require('../models/communityShareSchema');

router.post('/api/community/posts', authenticateToken, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create community posts' });
    }

    const { postType, description, caption, pollOptions, pollExpiresAt, quizQuestions, linkUrl, linkTitle, linkDescription } = req.body;
    
    
    if (!postType) {
      return res.status(400).json({ message: 'Post type is required' });
    }

    const postData = {
      author: req.user.admin_id,
      postType
    };

    
    if (description && description.trim()) {
      postData.description = description.trim();
    }

    
    switch (postType) {
      case 'image':
        if (!req.files || !req.files.images || req.files.images.length === 0) {
          return res.status(400).json({ message: 'At least one image is required for image posts' });
        }
        postData.images = req.files.images.map(file => ({
          data: file.buffer,
          contentType: file.mimetype,
          filename: file.originalname
        }));
        break;

      case 'video':
        if (!req.files || !req.files.video || req.files.video.length === 0) {
          return res.status(400).json({ message: 'Video is required for video posts' });
        }
        postData.video = {
          data: req.files.video[0].buffer,
          contentType: req.files.video[0].mimetype,
          filename: req.files.video[0].originalname
        };
        
        if (caption && caption.trim()) {
          postData.caption = caption.trim();
        }
        break;

      case 'poll':
        if (!pollOptions) {
          return res.status(400).json({ message: 'Poll options are required for poll posts' });
        }
        let parsedPollOptions;
        try {
          parsedPollOptions = typeof pollOptions === 'string' ? JSON.parse(pollOptions) : pollOptions;
        } catch (error) {
          return res.status(400).json({ message: 'Invalid poll options format' });
        }
        
        if (!Array.isArray(parsedPollOptions) || parsedPollOptions.length < 2) {
          return res.status(400).json({ message: 'At least 2 poll options are required' });
        }
        
        postData.pollOptions = parsedPollOptions.map(option => ({
          option: option.trim(),
          votes: []
        }));
        
        if (pollExpiresAt) {
          postData.pollExpiresAt = new Date(pollExpiresAt);
        }
        
        
        if (description && description.trim()) {
          postData.description = description.trim();
        }
        break;

      case 'quiz':
        if (!quizQuestions) {
          return res.status(400).json({ message: 'Quiz questions are required for quiz posts' });
        }
        let parsedQuizQuestions;
        try {
          parsedQuizQuestions = typeof quizQuestions === 'string' ? JSON.parse(quizQuestions) : quizQuestions;
        } catch (error) {
          return res.status(400).json({ message: 'Invalid quiz questions format' });
        }
        
        if (!Array.isArray(parsedQuizQuestions) || parsedQuizQuestions.length === 0) {
          return res.status(400).json({ message: 'At least one quiz question is required' });
        }
        
        postData.quizQuestions = parsedQuizQuestions;
        break;

      case 'link':
        if (!linkUrl || !linkUrl.trim()) {
          return res.status(400).json({ message: 'Link URL is required for link posts' });
        }
        postData.linkUrl = linkUrl.trim();
        if (linkTitle && linkTitle.trim()) {
          postData.linkTitle = linkTitle.trim();
        }
        if (linkDescription && linkDescription.trim()) {
          postData.linkDescription = linkDescription.trim();
        }
        break;

      default:
        return res.status(400).json({ message: 'Invalid post type' });
    }

    const post = new CommunityPost(postData);
    await post.save();

    
    const populatedPost = await CommunityPost.findById(post._id)
      .populate('author', 'name email');

    res.status(201).json({
      message: 'Community post created successfully',
      post: populatedPost
    });
  } catch (error) {
    console.error('Error creating community post:', error);
    res.status(500).json({ message: error.message });
  }
});
router.get('/api/community/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10, postType } = req.query;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };
    if (postType) {
      filter.postType = postType;
    }

    const posts = await CommunityPost.find(filter)
      .populate('author', 'name email')
      .populate({
        path: 'likes',
        
      })
      .populate({
        path: 'comments',
        match: { isActive: true }, 
      })
      .populate({
        path: 'shares',
        
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalPosts = await CommunityPost.countDocuments(filter);

    res.json({
      posts,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts
    });
  } catch (error) {
    console.error('Error fetching community posts:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/community/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await CommunityPost.findOne({ _id: id, isActive: true }) 
      .populate('author', 'name email')
      .populate({
        path: 'likes',
        
      })
      .populate({
        path: 'comments',
        match: { isActive: true }, 
      })
      .populate({
        path: 'shares',
        
      });

    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching community post:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/api/community/posts/:id', authenticateToken, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const post = await CommunityPost.findById(id);

    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    
    if (post.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }

    const { description, caption, pollOptions, pollExpiresAt, quizQuestions, linkUrl, linkTitle, linkDescription } = req.body;

    
    if (description !== undefined) {
      post.description = description.trim();
    }

    
    switch (post.postType) {
      case 'image':
        
        if (req.files && req.files.images && req.files.images.length > 0) {
          post.images = req.files.images.map(file => ({
            data: file.buffer,
            contentType: file.mimetype,
            filename: file.originalname
          }));
        }
        break;

      case 'video':
        
        if (req.files && req.files.video && req.files.video.length > 0) {
          post.video = {
            data: req.files.video[0].buffer,
            contentType: req.files.video[0].mimetype,
            filename: req.files.video[0].originalname
          };
        }
        
        if (caption !== undefined) {
          post.caption = caption.trim();
        }
        break;

      case 'poll':
        if (pollOptions) {
          try {
            const parsedOptions = typeof pollOptions === 'string' ? JSON.parse(pollOptions) : pollOptions;
            if (Array.isArray(parsedOptions) && parsedOptions.length >= 2) {
              
              const existingVotes = {};
              post.pollOptions.forEach((option, index) => {
                existingVotes[option.option] = option.votes;
              });

              post.pollOptions = parsedOptions.map(option => ({
                option: option.trim(),
                votes: existingVotes[option.trim()] || []
              }));
            }
          } catch (error) {
            return res.status(400).json({ message: 'Invalid poll options format' });
          }
        }
        if (pollExpiresAt !== undefined) {
          post.pollExpiresAt = pollExpiresAt ? new Date(pollExpiresAt) : null;
        }
        break;

      case 'quiz':
        if (quizQuestions) {
          try {
            const parsedQuestions = typeof quizQuestions === 'string' ? JSON.parse(quizQuestions) : quizQuestions;
            if (Array.isArray(parsedQuestions)) {
              post.quizQuestions = parsedQuestions;
            }
          } catch (error) {
            return res.status(400).json({ message: 'Invalid quiz questions format' });
          }
        }
        break;

      case 'link':
        if (linkUrl !== undefined) post.linkUrl = linkUrl.trim();
        if (linkTitle !== undefined) post.linkTitle = linkTitle.trim();
        if (linkDescription !== undefined) post.linkDescription = linkDescription.trim();
        break;
    }

    post.updatedAt = new Date();
    await post.save();

    
    const updatedPost = await CommunityPost.findById(post._id)
      .populate('author', 'name email')
      .populate('likes')
      .populate('comments')
      .populate('shares');

    res.json({
      message: 'Community post updated successfully',
      post: updatedPost
    });
  } catch (error) {
    console.error('Error updating community post:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/community/posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const post = await CommunityPost.findById(id);

    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    
    if (post.author.toString() !== req.user.admin_id ) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    
    
    
    await CommunityLike.deleteMany({ post: id });

    
    await CommunityComment.deleteMany({ post: id });

    
    await CommunityShare.deleteMany({ post: id });

    
    await CommunityPost.findByIdAndDelete(id);

    res.json({ message: 'Community post permanently deleted successfully' });
  } catch (error) {
    console.error('Error deleting community post:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/community/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    const comment = await CommunityComment.findById(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    
    if (comment.userEmail !== userEmail) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    
    
    
    await CommunityComment.deleteMany({ parentComment: id });

    
    await CommunityPost.updateOne(
      { _id: comment.post },
      { $pull: { comments: id } }
    );

    
    if (comment.parentComment) {
      await CommunityComment.updateOne(
        { _id: comment.parentComment },
        { $pull: { replies: id } }
      );
    }

    
    await CommunityComment.findByIdAndDelete(id);

    res.json({ message: 'Comment permanently deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/community/comments/:commentId/replies/:replyId', async (req, res) => {
  try {
    const { commentId, replyId } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    
    const reply = await CommunityComment.findById(replyId);
    if (!reply) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    
    if (reply.parentComment?.toString() !== commentId) {
      return res.status(400).json({ message: 'Reply does not belong to the specified comment' });
    }

    
    if (reply.userEmail !== userEmail) {
      return res.status(403).json({ message: 'Not authorized to delete this reply' });
    }

    
    
    
    await CommunityComment.updateOne(
      { _id: commentId },
      { $pull: { replies: replyId } }
    );

    
    await CommunityPost.updateOne(
      { _id: reply.post },
      { $pull: { comments: replyId } }
    );

    
    await CommunityComment.findByIdAndDelete(replyId);

    res.json({ message: 'Reply permanently deleted successfully' });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/community/posts/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    
    const post = await CommunityPost.findOne({ _id: id, isActive: true });
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    const comments = await CommunityComment.find({ 
      post: id, 
      isActive: true, 
      parentComment: null 
    })
      .populate({
        path: 'replies',
        match: { isActive: true } 
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalComments = await CommunityComment.countDocuments({ 
      post: id, 
      isActive: true, 
      parentComment: null 
    });

    res.json({
      comments,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalComments / limit),
      totalComments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: error.message });
  }
});



router.get('/api/community/posts/:id/media/:type/:index', async (req, res) => {
  try {
    const { id, type, index } = req.params;
    
    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    let media;
    if (type === 'image' && post.images && post.images[index]) {
      media = post.images[index];
    } else if (type === 'video' && post.video) {
      media = post.video;
    } else {
      return res.status(404).json({ message: 'Media not found' });
    }

    res.set('Content-Type', media.contentType);
    res.send(media.data);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ message: error.message });
  }
});


router.post('/api/community/posts/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); 
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    
    const existingLike = await CommunityLike.findOne({ post: id, userEmail });
        
    if (existingLike) {
      
      await CommunityLike.findByIdAndDelete(existingLike._id);
      post.likes.pull(existingLike._id);
      await post.save();
            
      res.json({ message: 'Post unliked successfully', liked: false });
    } else {
      
      const newLike = new CommunityLike({
        post: id,
        userEmail,
        userName
      });
      await newLike.save();
            
      post.likes.push(newLike._id);
      await post.save();
            
      res.json({ message: 'Post liked successfully', liked: true });
    }
  } catch (error) {
    console.error('Error liking/unliking community post:', error);
    res.status(500).json({ message: error.message });
  }
});


router.post('/api/community/posts/:id/comment', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, parentComment, userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); 
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    
    if (parentComment) {
      const parentCommentDoc = await CommunityComment.findOne({ 
        _id: parentComment, 
        isActive: true 
      });
      if (!parentCommentDoc) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }
    }

    const newComment = new CommunityComment({
      post: id,
      userEmail,
      userName,
      comment: comment.trim(),
      parentComment: parentComment || null
    });

    await newComment.save();
        
    
    post.comments.push(newComment._id);
    await post.save();

    
    if (parentComment) {
      const parentCommentDoc = await CommunityComment.findOne({ 
        _id: parentComment, 
        isActive: true 
      });
      if (parentCommentDoc) {
        parentCommentDoc.replies.push(newComment._id);
        await parentCommentDoc.save();
      }
    }

    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: error.message });
  }
});


router.post('/api/community/posts/:id/share', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); 
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    
    const existingShare = await CommunityShare.findOne({ post: id, userEmail });
        
    if (existingShare) {
      return res.status(400).json({ message: 'Post already shared' });
    }

    const newShare = new CommunityShare({
      post: id,
      userEmail,
      userName
    });

    await newShare.save();
        
    post.shares.push(newShare._id);
    await post.save();

    res.json({ message: 'Post shared successfully' });
  } catch (error) {
    console.error('Error sharing community post:', error);
    res.status(500).json({ message: error.message });
  }
});


router.post('/api/community/posts/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { optionIndex, userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); 
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    if (post.postType !== 'poll') {
      return res.status(400).json({ message: 'This post is not a poll' });
    }

    
    if (post.pollExpiresAt && new Date() > post.pollExpiresAt) {
      return res.status(400).json({ message: 'Poll has expired' });
    }

    
    const hasVoted = post.pollOptions.some(option => 
      option.votes.some(vote => vote.userEmail === userEmail)
    );

    if (hasVoted) {
      return res.status(400).json({ message: 'You have already voted on this poll' });
    }

    if (optionIndex < 0 || optionIndex >= post.pollOptions.length) {
      return res.status(400).json({ message: 'Invalid option index' });
    }

    post.pollOptions[optionIndex].votes.push({
      userEmail,
      userName,
      votedAt: new Date()
    });

    await post.save();

    res.json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error voting on poll:', error);
    res.status(500).json({ message: error.message });
  }
});


router.post('/api/community/posts/:id/quiz-answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); 
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    if (post.postType !== 'quiz') {
      return res.status(400).json({ message: 'This post is not a quiz' });
    }

    let score = 0;
    const results = post.quizQuestions.map((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      if (isCorrect) score++;

      return {
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation
      };
    });

    res.json({
      message: 'Quiz submitted successfully',
      score,
      totalQuestions: post.quizQuestions.length,
      results
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/community/posts/:id/unlike', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    
    const like = await CommunityLike.findOneAndDelete({ post: id, userEmail });
    
    if (!like) {
      return res.status(404).json({ message: 'Like not found' });
    }

    
    post.likes.pull(like._id);
    await post.save();

    res.json({ message: 'Like permanently removed' });
  } catch (error) {
    console.error('Error removing like:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/community/posts/:id/unshare', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    
    const share = await CommunityShare.findOneAndDelete({ post: id, userEmail });
    
    if (!share) {
      return res.status(404).json({ message: 'Share not found' });
    }

    
    post.shares.pull(share._id);
    await post.save();

    res.json({ message: 'Share permanently removed' });
  } catch (error) {
    console.error('Error removing share:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/community/admin/comments/:id', authenticateToken, async (req, res) => {
  try {
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete any comment' });
    }

    const { id } = req.params;
    const comment = await CommunityComment.findById(id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    
    
    
    await CommunityComment.deleteMany({ parentComment: id });

    
    await CommunityPost.updateOne(
      { _id: comment.post },
      { $pull: { comments: id } }
    );

    
    if (comment.parentComment) {
      await CommunityComment.updateOne(
        { _id: comment.parentComment },
        { $pull: { replies: id } }
      );
    }

    
    await CommunityComment.findByIdAndDelete(id);

    res.json({ message: 'Comment permanently deleted by admin' });
  } catch (error) {
    console.error('Error deleting comment (admin):', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/community/admin/posts/bulk', authenticateToken, async (req, res) => {
  try {
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can bulk delete posts' });
    }

    const { postIds } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({ message: 'Post IDs array is required' });
    }

    
    
    
    await CommunityLike.deleteMany({ post: { $in: postIds } });

    
    await CommunityComment.deleteMany({ post: { $in: postIds } });

    
    await CommunityShare.deleteMany({ post: { $in: postIds } });

    
    const result = await CommunityPost.deleteMany({ _id: { $in: postIds } });

    res.json({ 
      message: 'Posts permanently deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting posts:', error);
    res.status(500).json({ message: error.message });
  }
});


router.post('/api/community/comments/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const comment = await CommunityComment.findOne({ _id: id, isActive: true }); 
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    
    const existingLikeIndex = comment.likes.findIndex(
      like => like.userEmail === userEmail
    );

    if (existingLikeIndex > -1) {
      
      comment.likes.splice(existingLikeIndex, 1);
      await comment.save();
            
      res.json({ message: 'Comment unliked successfully', liked: false });
    } else {
      
      comment.likes.push({
        userEmail,
        userName,
        likedAt: new Date()
      });
      await comment.save();
            
      res.json({ message: 'Comment liked successfully', liked: true });
    }
  } catch (error) {
    console.error('Error liking/unliking comment:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/community/user/:userEmail/activity', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    
    const likes = await CommunityLike.find({ userEmail })
      .populate({
        path: 'post',
        match: { isActive: true }, 
        select: 'description postType createdAt'
      })
      .sort({ likedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    
    const activeLikes = likes.filter(like => like.post !== null);

    
    const comments = await CommunityComment.find({ userEmail, isActive: true })
      .populate({
        path: 'post',
        match: { isActive: true }, 
        select: 'description postType createdAt'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    
    const activeComments = comments.filter(comment => comment.post !== null);

    
    const shares = await CommunityShare.find({ userEmail })
      .populate({
        path: 'post',
        match: { isActive: true }, 
        select: 'description postType createdAt'
      })
      .sort({ sharedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    
    const activeShares = shares.filter(share => share.post !== null);

    res.json({
      likes: activeLikes,
      comments: activeComments,
      shares: activeShares,
      currentPage: parseInt(page),
      totalPages: Math.ceil(Math.max(activeLikes.length, activeComments.length, activeShares.length) / limit)
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;