
const express = require('express');
const router = express.Router();
const Blog = require('../models/blog');
const { 
  generateBlogEmbedding,
  batchGenerateEmbeddings 
} = require('../services/embeddingService');

/**
 * Generate embedding for a single blog
 * POST /api/ai/blogs/:id/generate-embedding
 */
router.post('/api/ai/blogs/:id/generate-embedding', async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.body;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    
    if (!force && blog.embedding && blog.embeddingMetadata) {
      return res.json({
        message: 'Embedding already exists',
        blogId: blog._id,
        blogTitle: blog.title,
        embeddingMetadata: blog.embeddingMetadata,
        regenerate: false
      });
    }
    
    
    await generateBlogEmbedding(blog);
    await blog.save();
    
    res.json({
      message: 'Embedding generated successfully',
      blogId: blog._id,
      blogTitle: blog.title,
      embeddingMetadata: blog.embeddingMetadata,
      regenerate: force
    });
    
  } catch (error) {
    console.error('Error generating embedding:', error);
    res.status(500).json({ 
      message: 'Failed to generate embedding',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/api/ai/blogs/batch-generate-embeddings', async (req, res) => {
  try {
    const { 
      force = false,
      status = 'published',
      limit = null
    } = req.body;
    
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (!force) {
      
      query.$or = [
        { embedding: { $exists: false } },
        { embedding: null },
        { 'embeddingMetadata.generatedAt': { $exists: false } }
      ];
    }
    
    
    let blogsQuery = Blog.find(query).sort({ createdAt: -1 });
    
    if (limit) {
      blogsQuery = blogsQuery.limit(limit);
    }
    
    const blogs = await blogsQuery;
    
    if (blogs.length === 0) {
      return res.json({
        message: 'No blogs need embedding generation',
        processed: 0,
        total: 0,
        results: []
      });
    }
    
    console.log(`Starting batch embedding generation for ${blogs.length} blogs...`);
    
    
    const results = await batchGenerateEmbeddings(blogs, (progress) => {
      console.log(`Progress: ${progress.processed}/${progress.total} (${progress.percentage}%)`);
    });
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    res.json({
      message: 'Batch embedding generation completed',
      processed: results.length,
      successful: successCount,
      failed: failureCount,
      total: blogs.length,
      results: results.map(r => ({
        blogId: r.blogId,
        title: r.title,
        success: r.success,
        error: r.error || null
      }))
    });
    
  } catch (error) {
    console.error('Error in batch embedding generation:', error);
    res.status(500).json({ 
      message: 'Batch embedding generation failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.get('/api/ai/blogs/embedding-status', async (req, res) => {
  try {
    const totalBlogs = await Blog.countDocuments();
    const publishedBlogs = await Blog.countDocuments({ status: 'published' });
    const draftBlogs = await Blog.countDocuments({ status: 'draft' });
    
    const blogsWithEmbeddings = await Blog.countDocuments({ 
      embedding: { $exists: true, $ne: null }
    });
    
    const publishedWithEmbeddings = await Blog.countDocuments({ 
      status: 'published',
      embedding: { $exists: true, $ne: null }
    });
    
    const blogsWithoutEmbeddings = totalBlogs - blogsWithEmbeddings;
    const publishedWithoutEmbeddings = publishedBlogs - publishedWithEmbeddings;
    
    
    const blogsNeedingEmbeddings = await Blog.find({
      $or: [
        { embedding: { $exists: false } },
        { embedding: null }
      ]
    })
    .select('_id title status createdAt')
    .limit(10)
    .lean();
    
    res.json({
      overview: {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        blogsWithEmbeddings,
        blogsWithoutEmbeddings,
        publishedWithEmbeddings,
        publishedWithoutEmbeddings,
        embeddingCoverage: totalBlogs > 0 
          ? `${((blogsWithEmbeddings / totalBlogs) * 100).toFixed(2)}%`
          : '0%',
        publishedCoverage: publishedBlogs > 0
          ? `${((publishedWithEmbeddings / publishedBlogs) * 100).toFixed(2)}%`
          : '0%'
      },
      blogsNeedingEmbeddings: blogsNeedingEmbeddings.map(blog => ({
        _id: blog._id,
        title: blog.title,
        status: blog.status,
        createdAt: blog.createdAt
      })),
      recommendations: getRecommendations(blogsWithoutEmbeddings, totalBlogs)
    });
    
  } catch (error) {
    console.error('Error checking embedding status:', error);
    res.status(500).json({ 
      message: 'Failed to check embedding status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

function getRecommendations(blogsWithoutEmbeddings, totalBlogs) {
  const recommendations = [];
  
  if (blogsWithoutEmbeddings === 0) {
    recommendations.push('All blogs have embeddings. Vector search is fully operational!');
  } else if (blogsWithoutEmbeddings < 10) {
    recommendations.push(`Only ${blogsWithoutEmbeddings} blogs need embeddings. Run batch generation to complete.`);
  } else if (blogsWithoutEmbeddings < totalBlogs * 0.3) {
    recommendations.push(`${blogsWithoutEmbeddings} blogs need embeddings. Consider running batch generation.`);
  } else {
    recommendations.push(`${blogsWithoutEmbeddings} blogs need embeddings. Run batch generation with appropriate limits.`);
    recommendations.push('Consider generating embeddings for published blogs first.');
  }
  
  return recommendations;
}

router.post('/api/ai/blogs/regenerate-outdated-embeddings', async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    
    
    const blogs = await Blog.find({
      embedding: { $exists: true, $ne: null },
      'embeddingMetadata.contentHash': { $exists: true }
    })
    .limit(limit);
    
    const outdatedBlogs = [];
    
    for (const blog of blogs) {
      const { prepareTextForEmbedding } = require('../services/embeddingService');
      const crypto = require('crypto');
      
      const currentText = prepareTextForEmbedding(blog);
      const currentHash = crypto.createHash('sha256').update(currentText).digest('hex');
      
      if (currentHash !== blog.embeddingMetadata.contentHash) {
        outdatedBlogs.push(blog);
      }
    }
    
    if (outdatedBlogs.length === 0) {
      return res.json({
        message: 'No outdated embeddings found',
        checked: blogs.length,
        outdated: 0
      });
    }
    
    
    const results = await batchGenerateEmbeddings(outdatedBlogs);
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      message: 'Outdated embeddings regenerated',
      checked: blogs.length,
      outdated: outdatedBlogs.length,
      regenerated: successCount,
      results: results.map(r => ({
        blogId: r.blogId,
        title: r.title,
        success: r.success,
        error: r.error || null
      }))
    });
    
  } catch (error) {
    console.error('Error regenerating outdated embeddings:', error);
    res.status(500).json({ 
      message: 'Failed to regenerate embeddings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.delete('/api/ai/blogs/embeddings', async (req, res) => {
  try {
    const { confirm = false } = req.body;
    
    if (!confirm) {
      return res.status(400).json({
        message: 'Please confirm deletion by sending { "confirm": true }',
        warning: 'This will remove all embeddings from the database'
      });
    }
    
    const result = await Blog.updateMany(
      {},
      { 
        $unset: { 
          embedding: "",
          embeddingMetadata: ""
        }
      }
    );
    
    res.json({
      message: 'All embeddings deleted successfully',
      blogsModified: result.modifiedCount
    });
    
  } catch (error) {
    console.error('Error deleting embeddings:', error);
    res.status(500).json({ 
      message: 'Failed to delete embeddings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;