const express = require("express");
const router = express.Router();
const mongoose = require('mongoose');
const authenticateToken = require("../middlewares/authMiddleware");
const cleanupUnusedImages = require("../utils/cleanupUnusedImages");
const cleanupUnusedVideos = require("../utils/cleanupUnusedVideos");
const extractPlainText = require("../utils/extractPlainText");
const processContent = require("../utils/processContent");
const validateApiKey = require("../utils/validateApiKey");
const moderateContent = require("../utils/moderateContent");
const { body, validationResult } = require('express-validator');
const UserBlogSubmission = require("../models/userBlogSubmissionSchema.js");
const Blog = require("../models/blog.js");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);




router.post('/api/blog-submissions',
  [
    body('userName').trim().notEmpty().withMessage('Name is required'),
    body('userEmail').isEmail().withMessage('Valid email is required'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('featuredImage').notEmpty().withMessage('Featured image is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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

      
      console.log(`🔍 Moderating blog submission from ${userName}...`);
      
      
      const titleModeration = await moderateContent(title, userName);
      if (!titleModeration.approved) {
        console.log(`✅ Content moderation blocked title from ${userName}`);
        return res.status(422).json({
          message: 'Your blog title violates our community guidelines.',
          code: 'TITLE_POLICY_VIOLATION',
          field: 'title',
          severity: titleModeration.severity
        });
      }

      
      const plainTextContent = extractPlainText(content);
      const contentModeration = await moderateContent(plainTextContent, userName);
      if (!contentModeration.approved) {
        console.log(`✅ Content moderation blocked blog content from ${userName}`);
        return res.status(422).json({
          message: 'Your blog content violates our community guidelines. Please ensure your content is respectful and constructive.',
          code: 'CONTENT_POLICY_VIOLATION',
          field: 'content',
          severity: contentModeration.severity
        });
      }

      
      if (summary && summary.trim() !== '') {
        const summaryModeration = await moderateContent(summary, userName);
        if (!summaryModeration.approved) {
          console.log(`✅ Content moderation blocked summary from ${userName}`);
          return res.status(422).json({
            message: 'Your blog summary violates our community guidelines.',
            code: 'SUMMARY_POLICY_VIOLATION',
            field: 'summary',
            severity: summaryModeration.severity
          });
        }
      }

      console.log(`✅ All content approved for ${userName}`);

      
      const cleanedImages = cleanupUnusedImages(content, contentImages || []);
      const cleanedVideos = cleanupUnusedVideos(content, contentVideos || []);

      const newSubmission = new UserBlogSubmission({
        userName,
        userEmail,
        title,
        content,
        summary: summary || '',
        tags: tags || [],
        featuredImage,
        contentImages: cleanedImages,
        contentVideos: cleanedVideos
      });

      await newSubmission.save();

      res.status(201).json({
        message: 'Blog submission received successfully. Your submission is under review.',
        blogSubmissionId: newSubmission.blogSubmissionId,
        status: newSubmission.status,
        submission: {
          id: newSubmission._id,
          blogSubmissionId: newSubmission.blogSubmissionId,
          title: newSubmission.title,
          userName: newSubmission.userName,
          userEmail: newSubmission.userEmail,
          status: newSubmission.status,
          submittedAt: newSubmission.submittedAt
        }
      });
    } catch (error) {
      console.error('Error submitting blog:', error);
      res.status(500).json({ 
        message: 'Failed to submit blog',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
);


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
      changesSuggested: submission.changesSuggested,
      publishedBlogId: submission.publishedBlogId
    });
  } catch (error) {
    console.error('Error checking submission status:', error);
    res.status(500).json({ message: 'Failed to check submission status' });
  }
});


router.get('/api/blog-submissions/details/:blogSubmissionId', async (req, res) => {
  try {
    const { blogSubmissionId } = req.params;
    
    const submission = await UserBlogSubmission.findOne({ 
      blogSubmissionId: blogSubmissionId.toUpperCase() 
    }).populate('publishedBlogId', 'title slug status');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    
    const submissionObj = submission.toObject();
    submissionObj.processedContent = processContent(
      submissionObj.content, 
      submissionObj.contentImages, 
      submissionObj.contentVideos
    );
    
    res.status(200).json(submissionObj);
  } catch (error) {
    console.error('Error fetching submission details:', error);
    res.status(500).json({ message: 'Failed to fetch submission details' });
  }
});


router.post('/api/blog-submissions/:identifier/generate-summary', async (req, res) => {
  try {
    validateApiKey();
    
    const { identifier } = req.params;
    const { wordLimit = 300, temperature = 0.7 } = req.body;
    
    
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    const query = isObjectId 
      ? { _id: identifier }
      : { blogSubmissionId: identifier.toUpperCase() };
    
    const submission = await UserBlogSubmission.findOne(query);
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    
    const plainTextContent = extractPlainText(submission.content);
    
    if (plainTextContent.length < 100) {
      return res.status(400).json({ 
        message: 'Submission content is too short to generate a meaningful summary' 
      });
    }
    
    const prompt = `Please create a comprehensive summary of the following blog post. The summary should:
    - Be approximately ${wordLimit} words long
    - Capture the main points and key insights
    - Be engaging and well-structured with clear paragraphs
    - Maintain the tone and style of the original content
    - Be suitable for readers who want a quick overview
    - Focus on the most important information and actionable insights
    - Generate different answer every time but same meaning
    
    Blog Title: "${submission.title}"
    
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
    
    res.json({
      message: 'Summary generated successfully',
      summary: generatedSummary,
      wordCount: wordCount,
      targetWordLimit: wordLimit,
      submissionId: submission._id,
      blogSubmissionId: submission.blogSubmissionId,
      title: submission.title,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error generating submission summary:', error);
    
    if (error.message.includes('API_KEY') || error.message.includes('key')) {
      return res.status(500).json({ 
        message: 'Gemini API configuration error.',
        code: 'API_KEY_ERROR'
      });
    }
    
    if (error.message.includes('quota') || error.message.includes('limit') || error.status === 429) {
      return res.status(429).json({ 
        message: 'API quota exceeded. Please try again later.',
        code: 'QUOTA_EXCEEDED'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to generate summary. Please try again.',
      code: 'GENERATION_FAILED'
    });
  }
});




router.get('/api/admin/blog-submissions', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { status, page = 1, limit = 20, search } = req.query;
    const query = {};

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

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


router.get('/api/admin/blog-submissions/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const submission = await UserBlogSubmission.findById(req.params.id)
      .populate('reviewedBy', 'username email')
      .populate('publishedBlogId', 'title slug');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    
    const submissionObj = submission.toObject();
    submissionObj.processedContent = processContent(
      submissionObj.content, 
      submissionObj.contentImages, 
      submissionObj.contentVideos
    );

    res.status(200).json(submissionObj);
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ message: 'Failed to fetch submission' });
  }
});


router.post('/api/admin/blog-submissions/:id/approve', authenticateToken, async (req, res) => {
  try {
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


router.post('/api/admin/blog-submissions/:id/reject', authenticateToken, async (req, res) => {
  try {
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


router.post('/api/admin/blog-submissions/:id/suggest-changes', authenticateToken, async (req, res) => {
  try {
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


router.delete('/api/admin/blog-submissions/:id', authenticateToken, async (req, res) => {
  try {
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


router.get('/api/admin/blog-submissions/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const stats = {
      total: await UserBlogSubmission.countDocuments(),
      pending: await UserBlogSubmission.countDocuments({ status: 'pending' }),
      approved: await UserBlogSubmission.countDocuments({ status: 'approved' }),
      rejected: await UserBlogSubmission.countDocuments({ status: 'rejected' })
    };

    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    stats.recentSubmissions = await UserBlogSubmission.countDocuments({
      submittedAt: { $gte: sevenDaysAgo }
    });

    
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


router.post('/api/admin/blog-submissions/bulk/approve', authenticateToken, async (req, res) => {
  try {
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


router.post('/api/admin/blog-submissions/bulk/reject', authenticateToken, async (req, res) => {
  try {
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