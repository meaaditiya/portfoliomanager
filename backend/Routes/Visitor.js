const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');

// Helper function to get IP address
const getIpAddress = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         'unknown';
};

// POST: Track new visitor or update existing
router.post('/track', async (req, res) => {
  try {
    const { sessionId, page, socketId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const ipAddress = getIpAddress(req);
    const userAgent = req.headers['user-agent'] || '';

    let visitor = await Visitor.findOne({ sessionId });

    if (visitor) {
      visitor.lastActivity = Date.now();
      visitor.isActive = true;
      visitor.page = page || '/';
      if (socketId) visitor.socketId = socketId;
      await visitor.save();
    } else {
      visitor = new Visitor({
        sessionId,
        socketId: socketId || null,
        ipAddress,
        userAgent,
        page: page || '/',
        isActive: true
      });
      await visitor.save();
    }

    const liveCount = await Visitor.getLiveCount();

    res.json({ 
      success: true, 
      message: 'Visitor tracked successfully',
      sessionId: visitor.sessionId,
      liveCount
    });
  } catch (error) {
    console.error('Error tracking visitor:', error);
    res.status(500).json({ error: 'Failed to track visitor' });
  }
});

// POST: Mark visitor as inactive
router.post('/leave', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    await Visitor.markInactive(sessionId);
    const liveCount = await Visitor.getLiveCount();
    
    res.json({ 
      success: true, 
      message: 'Visitor marked as inactive',
      liveCount
    });
  } catch (error) {
    console.error('Error marking visitor inactive:', error);
    res.status(500).json({ error: 'Failed to mark visitor inactive' });
  }
});

// GET: Get all stats at once
router.get('/stats/all', async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [liveCount, hourCount, todayCount, monthCount, totalCount] = await Promise.all([
      Visitor.getLiveCount(),
      Visitor.countDocuments({ firstVisit: { $gte: oneHourAgo } }),
      Visitor.countDocuments({ firstVisit: { $gte: startOfDay } }),
      Visitor.countDocuments({ firstVisit: { $gte: startOfMonth } }),
      Visitor.countDocuments({})
    ]);

    res.json({
      liveViewers: liveCount,
      visitorsLastHour: hourCount,
      visitorsToday: todayCount,
      visitorsThisMonth: monthCount,
      totalVisitors: totalCount,
      timestamp: now
    });
  } catch (error) {
    console.error('Error getting all stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;