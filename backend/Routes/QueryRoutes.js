const express = require("express");
const router = express.Router();
const Query = require("../models/querySchema.js");         
const authenticateToken = require("../middlewares/authMiddleware"); 
router.post('/api/queries/create', async (req, res) => {
  try {
    const { name, email, queryText } = req.body;

    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!queryText || !queryText.trim()) {
      return res.status(400).json({ message: 'Query text is required' });
    }

    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    
    const ticketId = await Query.generateTicketId();

    
    const query = new Query({
      ticketId,
      name: name.trim(),
      email: email.trim(),
      queryText: queryText.trim()
    });

    await query.save();

    res.status(201).json({
      message: 'Query submitted successfully',
      ticketId: query.ticketId,
      status: query.status
    });
  } catch (error) {
    console.error('Error creating query:', error);
    res.status(500).json({ message: 'Failed to submit query. Please try again.' });
  }
});


router.get('/api/queries/check/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;

    
    if (!/^QRY\d{12}$/.test(ticketId)) {
      return res.status(400).json({ message: 'Invalid ticket ID format. Must be 15 digits.' });
    }

    const query = await Query.findOne({ ticketId })
      .select('ticketId name email queryText status adminReply repliedAt createdAt');

    if (!query) {
      return res.status(404).json({ message: 'Query not found with this ticket ID' });
    }

    
    if (!query.adminReply) {
      return res.status(200).json({
        ticketId: query.ticketId,
        name: query.name,
        email: query.email,
        queryText: query.queryText,
        status: query.status,
        submittedAt: query.createdAt,
        message: 'No reply to your query as of now'
      });
    }

    
    res.status(200).json({
      ticketId: query.ticketId,
      name: query.name,
      email: query.email,
      queryText: query.queryText,
      status: query.status,
      adminReply: query.adminReply,
      repliedAt: query.repliedAt,
      submittedAt: query.createdAt
    });
  } catch (error) {
    console.error('Error checking query:', error);
    res.status(500).json({ message: 'Failed to check query status' });
  }
});

router.get('/api/admin/queries', authenticateToken, async (req, res) => {
  try {
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const query = {};

    
    if (status && ['pending', 'replied', 'closed'].includes(status)) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const queries = await Query.find(query)
      .populate('repliedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Query.countDocuments(query);

    res.status(200).json({
      queries,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalQueries: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching queries:', error);
    res.status(500).json({ message: 'Failed to fetch queries' });
  }
});


router.get('/api/admin/queries/:ticketId', authenticateToken, async (req, res) => {
  try {
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { ticketId } = req.params;

    const query = await Query.findOne({ ticketId })
      .populate('repliedBy', 'username email');

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    res.status(200).json({ query });
  } catch (error) {
    console.error('Error fetching query:', error);
    res.status(500).json({ message: 'Failed to fetch query' });
  }
});


router.put('/api/admin/queries/:ticketId/reply', authenticateToken, async (req, res) => {
  try {
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { ticketId } = req.params;
    const { adminReply } = req.body;

    
    if (!adminReply || !adminReply.trim()) {
      return res.status(400).json({ message: 'Reply text is required' });
    }

    const query = await Query.findOne({ ticketId });

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    
    query.adminReply = adminReply.trim();
    query.repliedBy = req.user.admin_id;
    query.repliedAt = new Date();
    query.status = 'replied';

    await query.save();

    const updatedQuery = await Query.findOne({ ticketId })
      .populate('repliedBy', 'username email');

    res.status(200).json({
      message: 'Reply added successfully',
      query: updatedQuery
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ message: 'Failed to add reply' });
  }
});


router.put('/api/admin/queries/:ticketId/status', authenticateToken, async (req, res) => {
  try {
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { ticketId } = req.params;
    const { status } = req.body;

    
    if (!['pending', 'replied', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be: pending, replied, or closed' });
    }

    const query = await Query.findOneAndUpdate(
      { ticketId },
      { status },
      { new: true }
    ).populate('repliedBy', 'username email');

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    res.status(200).json({
      message: 'Status updated successfully',
      query
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});


router.delete('/api/admin/queries/:ticketId', authenticateToken, async (req, res) => {
  try {
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { ticketId } = req.params;

    const query = await Query.findOneAndDelete({ ticketId });

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    res.status(200).json({
      message: 'Query deleted successfully',
      ticketId: query.ticketId
    });
  } catch (error) {
    console.error('Error deleting query:', error);
    res.status(500).json({ message: 'Failed to delete query' });
  }
});
router.post('/api/admin/queries/bulk-delete', authenticateToken, async (req, res) => {
  try {
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { ticketIds } = req.body;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ message: 'Ticket IDs array is required' });
    }

    const result = await Query.deleteMany({ ticketId: { $in: ticketIds } });

    res.status(200).json({
      message: `${result.deletedCount} queries deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting queries:', error);
    res.status(500).json({ message: 'Failed to delete queries' });
  }
});

module.exports = router;
