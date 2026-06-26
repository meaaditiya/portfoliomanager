const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const { sendDigest } = require('../services/digestService');
const DigestLog = require('../models/digestLogSchema');

// Manually trigger a digest
router.post('/api/admin/digest/trigger', authenticateToken, async (req, res) => {
  try {
    const { period = 'weekly' } = req.body;

    if (!['weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ success: false, message: 'period must be "weekly" or "monthly"' });
    }

    console.log(`[Digest] Manual trigger by ${req.user.email || req.user.id} — period: ${period}`);
    const result = await sendDigest({ period, triggeredBy: req.user.email || req.user.id });

    if (result.skipped) {
      return res.json({ success: true, skipped: true, reason: result.reason });
    }

    res.json({
      success: true,
      issueNumber: result.issueNumber,
      blogCount: result.blogCount,
      successCount: result.successCount,
      failCount: result.failCount,
      message: `Digest #${result.issueNumber} sent to ${result.successCount} subscribers`
    });
  } catch (err) {
    console.error('[Digest] Trigger error:', err);
    res.status(500).json({ success: false, message: 'Failed to send digest', error: err.message });
  }
});

// Get digest send history
router.get('/api/admin/digest/history', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const logs = await DigestLog.find()
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('blogIds', 'title slug');
    const total = await DigestLog.countDocuments();
    res.json({ success: true, logs, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch digest history', error: err.message });
  }
});

// Get digest stats
router.get('/api/admin/digest/stats', authenticateToken, async (req, res) => {
  try {
    const totalIssues = await DigestLog.countDocuments({ status: 'sent' });
    const lastIssue = await DigestLog.findOne({ status: 'sent' }).sort({ sentAt: -1 });
    const totalRecipients = await DigestLog.aggregate([
      { $match: { status: 'sent' } },
      { $group: { _id: null, total: { $sum: '$recipientCount' } } }
    ]);
    res.json({
      success: true,
      stats: {
        totalIssues,
        lastSentAt: lastIssue?.sentAt || null,
        lastIssueNumber: lastIssue?.issueNumber || 0,
        totalEmailsSent: totalRecipients[0]?.total || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch digest stats', error: err.message });
  }
});

module.exports = router;