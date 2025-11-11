const express = require("express");
const router = express.Router();
const authenticateToken = require("../middlewares/authMiddleware");  
const UserBlogSubmission = require("../models/userBlogSubmissionSchema.js");
const Blog = require("../models/blog.js");             
router.post('/api/blog-submissions', async (req, res) => {
  try {
    const { 
      userName, 
      userEmail, 
      title, 
      content, 
      summary, 
      tags, 
      featuredImage, 
      contentImages, 
      contentVideos 
    } = req.body;
    
    // Validate required fields
    if (!userName || !userEmail || !title || !content || !featuredImage) {
      return res.status(400).json({ 
        message: 'Name, email, title, content, and featured image are required' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    const newSubmission = new UserBlogSubmission({
      userName,
      userEmail,
      title,
      content,
      summary: summary || '',
      tags: tags || [],
      featuredImage,
      contentImages: contentImages || [],
      contentVideos: contentVideos || []
    });
    
    await newSubmission.save();
    
    res.status(201).json({
      message: 'Blog submission received successfully',
      blogSubmissionId: newSubmission.blogSubmissionId,
      status: newSubmission.status
    });
  } catch (error) {
    console.error('Error submitting blog:', error);
    res.status(500).json({ message: 'Failed to submit blog' });
  }
});

// Check status of blog submission using blogSubmissionId
router.get('/api/blog-submissions/status/:blogSubmissionId', async (req, res) => {
  try {
    const { blogSubmissionId } = req.params;
    
    const submission = await UserBlogSubmission.findOne({ 
      blogSubmissionId: blogSubmissionId.toUpperCase() 
    }).select('-contentImages -contentVideos -content');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    res.status(200).json({
      blogSubmissionId: submission.blogSubmissionId,
      title: submission.title,
      status: submission.status,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
      rejectionReason: submission.rejectionReason,
      changesSuggested: submission.changesSuggested
    });
  } catch (error) {
    console.error('Error checking submission status:', error);
    res.status(500).json({ message: 'Failed to check submission status' });
  }
});

// Get full submission details using blogSubmissionId
router.get('/api/blog-submissions/details/:blogSubmissionId', async (req, res) => {
  try {
    const { blogSubmissionId } = req.params;
    
    const submission = await UserBlogSubmission.findOne({ 
      blogSubmissionId: blogSubmissionId.toUpperCase() 
    });
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    res.status(200).json(submission);
  } catch (error) {
    console.error('Error fetching submission details:', error);
    res.status(500).json({ message: 'Failed to fetch submission details' });
  }
});

// ==================== ADMIN ROUTES (Authentication Required) ====================

// Get all blog submissions with filters
router.get('/api/admin/blog-submissions', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { status, page = 1, limit = 20, search } = req.query;
    const query = {};

    // Filter by status if provided
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    // Search by title, userName, or userEmail
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { blogSubmissionId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const submissions = await UserBlogSubmission.find(query)
      .populate('reviewedBy', 'username email')
      .populate('publishedBlogId', 'title slug')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UserBlogSubmission.countDocuments(query);

    // Get statistics
    const stats = {
      total: await UserBlogSubmission.countDocuments(),
      pending: await UserBlogSubmission.countDocuments({ status: 'pending' }),
      approved: await UserBlogSubmission.countDocuments({ status: 'approved' }),
      rejected: await UserBlogSubmission.countDocuments({ status: 'rejected' })
    };

    res.status(200).json({
      submissions,
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalSubmissions: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching blog submissions:', error);
    res.status(500).json({ message: 'Failed to fetch blog submissions' });
  }
});

// Get single blog submission by ID (for admin review)
router.get('/api/admin/blog-submissions/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const submission = await UserBlogSubmission.findById(req.params.id)
      .populate('reviewedBy', 'username email')
      .populate('publishedBlogId', 'title slug');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.status(200).json(submission);
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ message: 'Failed to fetch submission' });
  }
});

// Approve blog submission
router.post('/api/admin/blog-submissions/:id/approve', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const submission = await UserBlogSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (submission.status === 'approved') {
      return res.status(400).json({ message: 'Submission already approved' });
    }

    // Create actual blog post
    const newBlog = new Blog({
      title: submission.title,
      content: submission.content,
      summary: submission.summary,
      author: req.user.admin_id,
      status: 'draft',
      tags: submission.tags,
      featuredImage: submission.featuredImage,
      contentImages: submission.contentImages,
      contentVideos: submission.contentVideos,
      publishedAt: new Date()
    });

    await newBlog.save();

    // Update submission status
    submission.status = 'approved';
    submission.reviewedBy = req.user.admin_id;
    submission.reviewedAt = new Date();
    submission.publishedBlogId = newBlog._id;

    await submission.save();

    res.status(200).json({
      message: 'Blog submission approved and published successfully',
      submission,
      blog: newBlog
    });
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ message: 'Failed to approve submission' });
  }
});

// Reject blog submission
router.post('/api/admin/blog-submissions/:id/reject', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const submission = await UserBlogSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (submission.status === 'rejected') {
      return res.status(400).json({ message: 'Submission already rejected' });
    }

    submission.status = 'rejected';
    submission.rejectionReason = rejectionReason;
    submission.reviewedBy = req.user.admin_id;
    submission.reviewedAt = new Date();

    await submission.save();

    res.status(200).json({
      message: 'Blog submission rejected',
      submission
    });
  } catch (error) {
    console.error('Error rejecting submission:', error);
    res.status(500).json({ message: 'Failed to reject submission' });
  }
});

// Suggest changes to blog submission
router.post('/api/admin/blog-submissions/:id/suggest-changes', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { changesSuggested } = req.body;

    if (!changesSuggested) {
      return res.status(400).json({ message: 'Changes suggestion is required' });
    }

    const submission = await UserBlogSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    submission.changesSuggested = changesSuggested;
    submission.reviewedBy = req.user.admin_id;
    submission.reviewedAt = new Date();

    await submission.save();

    res.status(200).json({
      message: 'Changes suggested successfully',
      submission
    });
  } catch (error) {
    console.error('Error suggesting changes:', error);
    res.status(500).json({ message: 'Failed to suggest changes' });
  }
});

// Delete blog submission
router.delete('/api/admin/blog-submissions/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const submission = await UserBlogSubmission.findByIdAndDelete(req.params.id);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.status(200).json({
      message: 'Blog submission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ message: 'Failed to delete submission' });
  }
});

// Get dashboard statistics
router.get('/api/admin/blog-submissions/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const stats = {
      total: await UserBlogSubmission.countDocuments(),
      pending: await UserBlogSubmission.countDocuments({ status: 'pending' }),
      approved: await UserBlogSubmission.countDocuments({ status: 'approved' }),
      rejected: await UserBlogSubmission.countDocuments({ status: 'rejected' })
    };

    // Get recent submissions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    stats.recentSubmissions = await UserBlogSubmission.countDocuments({
      submittedAt: { $gte: sevenDaysAgo }
    });

    // Get top contributors (users with most submissions)
    const topContributors = await UserBlogSubmission.aggregate([
      {
        $group: {
          _id: '$userEmail',
          userName: { $first: '$userName' },
          count: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    stats.topContributors = topContributors;

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
});

// Bulk approve submissions
router.post('/api/admin/blog-submissions/bulk/approve', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { submissionIds } = req.body;

    if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({ message: 'Submission IDs array is required' });
    }

    const results = {
      approved: [],
      failed: []
    };

    for (const id of submissionIds) {
      try {
        const submission = await UserBlogSubmission.findById(id);
        
        if (!submission || submission.status === 'approved') {
          results.failed.push(id);
          continue;
        }

        // Create blog post
        const newBlog = new Blog({
          title: submission.title,
          content: submission.content,
          summary: submission.summary,
          author: req.user.admin_id,
          status: 'published',
          tags: submission.tags,
          featuredImage: submission.featuredImage,
          contentImages: submission.contentImages,
          contentVideos: submission.contentVideos,
          publishedAt: new Date()
        });

        await newBlog.save();

        // Update submission
        submission.status = 'approved';
        submission.reviewedBy = req.user.admin_id;
        submission.reviewedAt = new Date();
        submission.publishedBlogId = newBlog._id;
        await submission.save();

        results.approved.push(id);
      } catch (error) {
        console.error(`Error approving submission ${id}:`, error);
        results.failed.push(id);
      }
    }

    res.status(200).json({
      message: 'Bulk approval completed',
      results
    });
  } catch (error) {
    console.error('Error in bulk approval:', error);
    res.status(500).json({ message: 'Failed to perform bulk approval' });
  }
});

// Bulk reject submissions
router.post('/api/admin/blog-submissions/bulk/reject', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { submissionIds, rejectionReason } = req.body;

    if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({ message: 'Submission IDs array is required' });
    }

    if (!rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const result = await UserBlogSubmission.updateMany(
      { 
        _id: { $in: submissionIds },
        status: { $ne: 'rejected' }
      },
      {
        $set: {
          status: 'rejected',
          rejectionReason: rejectionReason,
          reviewedBy: req.user.admin_id,
          reviewedAt: new Date()
        }
      }
    );

    res.status(200).json({
      message: 'Bulk rejection completed',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in bulk rejection:', error);
    res.status(500).json({ message: 'Failed to perform bulk rejection' });
  }
});
module.exports = router;