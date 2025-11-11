const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');
const Email = require('../models/emailSchema');
const sendEmail = require('../utils/email');
const getEmailTemplate = require('../EmailTemplates/getEmailTemplate');


router.post('/api/admin/send-email', authenticateToken, upload.array('attachments', 10), async (req, res) => {
  try {
    const { to, subject, message, senderName, receiverName } = req.body;
    
    // Validation
    if (!to || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, subject, and message are required' 
      });
    }

    // Process attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
      size: file.size
    })) : [];
     const imageUrl = `${req.protocol}://${req.get('host')}/public/profile.png`;
    // Generate professional HTML template
    const htmlTemplate = getEmailTemplate(subject, message, senderName, receiverName);
    
    // Send email
    await sendEmail(to, subject, htmlTemplate, attachments);
    
    // Save email record to MongoDB
    const emailRecord = new Email({
      to,
      subject,
      message,
      attachments,
      sentBy: req.user.email || req.user.id,
      status: 'sent'
    });
    
    await emailRecord.save();
    
    res.json({
      success: true,
      message: 'Email sent successfully',
      emailId: emailRecord._id
    });
    
  } catch (error) {
    console.error('Send email error:', error);
    
    // Save failed email record
    try {
      const failedEmailRecord = new Email({
        to: req.body.to,
        subject: req.body.subject,
        message: req.body.message,
        attachments: req.files ? req.files.map(file => ({
          filename: file.originalname,
          contentType: file.mimetype,
          data: file.buffer,
          size: file.size
        })) : [],
        sentBy: req.user.email || req.user.id,
        status: 'failed'
      });
      
      await failedEmailRecord.save();
    } catch (saveError) {
      console.error('Failed to save email record:', saveError);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email', 
      error: error.message 
    });
  }
});

// Route 2: Send bulk emails with attachments

router.post('/api/admin/send-bulk-email', authenticateToken, upload.array('attachments', 10), async (req, res) => {
  try {
    let { recipients, subject, message, senderName ,receiverName} = req.body;
    
    // Parse recipients if it's a JSON string
    if (typeof recipients === 'string') {
      try {
        recipients = JSON.parse(recipients);
      } catch (parseError) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid recipients format' 
        });
      }
    }
    
    // Validation
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipients array is required and must contain at least one email' 
      });
    }
    
    if (!subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subject and message are required' 
      });
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email.trim()));
    
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid email format(s): ${invalidEmails.join(', ')}` 
      });
    }

    // Process attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
      size: file.size
    })) : [];

    // Generate professional HTML template
    const htmlTemplate = getEmailTemplate(subject, message, senderName,receiverName);
    
    const results = {
      successful: [],
      failed: []
    };
    
    // Send emails to all recipients
    for (const recipient of recipients) {
      try {
        await sendEmail(recipient.trim(), subject, htmlTemplate, attachments);
        results.successful.push(recipient);
        
        // Save successful email record
        const emailRecord = new Email({
          to: recipient.trim(),
          subject,
          message,
          attachments,
          sentBy: req.user.email || req.user.id,
          status: 'sent'
        });
        
        await emailRecord.save();
        
      } catch (error) {
        console.error(`Failed to send email to ${recipient}:`, error);
        results.failed.push({ email: recipient, error: error.message });
        
        // Save failed email record
        const failedEmailRecord = new Email({
          to: recipient.trim(),
          subject,
          message,
          attachments,
          sentBy: req.user.email || req.user.id,
          status: 'failed'
        });
        
        await failedEmailRecord.save();
      }
    }
    
    res.json({
      success: true,
      message: `Bulk email completed. ${results.successful.length} sent, ${results.failed.length} failed`,
      results
    });
    
  } catch (error) {
    console.error('Bulk email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send bulk emails', 
      error: error.message 
    });
  }
});

// Route 3: Get email history
router.get('/api/admin/email-history', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const emails = await Email.find()
      .select('-attachments.data') // Exclude attachment data for performance
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Email.countDocuments();
    
    res.json({
      success: true,
      emails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Email history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve email history', 
      error: error.message 
    });
  }
});

// Route 4: Get specific email with attachments
router.get('/api/admin/email/:id', authenticateToken, async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);
    
    if (!email) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email not found' 
      });
    }
    
    res.json({
      success: true,
      email
    });
    
  } catch (error) {
    console.error('Get email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve email', 
      error: error.message 
    });
  }
});

// Route 5: Download attachment
router.get('/api/admin/email/:id/attachment/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);
    
    if (!email) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email not found' 
      });
    }
    
    const attachment = email.attachments.id(req.params.attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Attachment not found' 
      });
    }
    
    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.send(attachment.data);
    
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to download attachment', 
      error: error.message 
    });
  }
});

// Route 6: Delete email
router.delete('/api/admin/email/:id', authenticateToken, async (req, res) => {
  try {
    const email = await Email.findByIdAndDelete(req.params.id);
    
    if (!email) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Email deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete email', 
      error: error.message 
    });
  }
});

// Route 7: Get email statistics
router.get('/api/admin/email-stats', authenticateToken, async (req, res) => {
  try {
    const stats = await Email.aggregate([
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          sentEmails: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          failedEmails: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
        }
      }
    ]);
    
    const recentEmails = await Email.countDocuments({
      sentAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    res.json({
      success: true,
      stats: {
        total: stats[0]?.totalEmails || 0,
        sent: stats[0]?.sentEmails || 0,
        failed: stats[0]?.failedEmails || 0,
        last24Hours: recentEmails
      }
    });
    
  } catch (error) {
    console.error('Email stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve email statistics', 
      error: error.message 
    });
  }
});
module.exports = router;