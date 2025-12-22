const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { marked } = require('marked');
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');
const { Email, SubscriptionList, EmailTemplate } = require('../models/emailSchema');
const sendEmail = require('../utils/email');
const getEmailTemplate = require('../EmailTemplates/getEmailTemplate');

router.post('/api/admin/subscription-lists', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'List name is required' 
      });
    }

    const existingList = await SubscriptionList.findOne({ name });
    if (existingList) {
      return res.status(400).json({ 
        success: false, 
        message: 'List with this name already exists' 
      });
    }

    const subscriptionList = new SubscriptionList({
      name,
      description,
      createdBy: req.user.email || req.user.id
    });
    
    await subscriptionList.save();
    
    res.json({
      success: true,
      message: 'Subscription list created successfully',
      list: subscriptionList
    });
    
  } catch (error) {
    console.error('Create list error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create subscription list', 
      error: error.message 
    });
  }
});

router.get('/api/admin/subscription-lists', authenticateToken, async (req, res) => {
  try {
    const lists = await SubscriptionList.find()
      .select('-subscribers.unsubscribeToken')
      .sort({ createdAt: -1 });
    
    const listsWithCount = lists.map(list => ({
      ...list.toObject(),
      subscriberCount: list.subscribers.length
    }));
    
    res.json({
      success: true,
      lists: listsWithCount
    });
    
  } catch (error) {
    console.error('Get lists error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve subscription lists', 
      error: error.message 
    });
  }
});

router.get('/api/admin/subscription-lists/:id', authenticateToken, async (req, res) => {
  try {
    const list = await SubscriptionList.findById(req.params.id)
      .select('-subscribers.unsubscribeToken');
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'List not found' 
      });
    }
    
    res.json({
      success: true,
      list
    });
    
  } catch (error) {
    console.error('Get list error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve list', 
      error: error.message 
    });
  }
});

router.put('/api/admin/subscription-lists/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    
    const list = await SubscriptionList.findById(req.params.id);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'List not found' 
      });
    }

    if (name) list.name = name;
    if (description !== undefined) list.description = description;
    if (isActive !== undefined) list.isActive = isActive;
    list.updatedAt = Date.now();
    
    await list.save();
    
    res.json({
      success: true,
      message: 'List updated successfully',
      list
    });
    
  } catch (error) {
    console.error('Update list error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update list', 
      error: error.message 
    });
  }
});

router.delete('/api/admin/subscription-lists/:id', authenticateToken, async (req, res) => {
  try {
    const list = await SubscriptionList.findByIdAndDelete(req.params.id);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'List not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'List deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete list error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete list', 
      error: error.message 
    });
  }
});

router.post('/api/public/subscribe', async (req, res) => {
  try {
    const { email, listName } = req.body;
    
    if (!email || !listName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and list name are required' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    const list = await SubscriptionList.findOne({ name: listName, isActive: true });
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscription list not found or inactive' 
      });
    }

    const existingSubscriber = list.subscribers.find(sub => sub.email === email.trim());
    
    if (existingSubscriber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already subscribed to this list' 
      });
    }

    const unsubscribeToken = crypto.randomBytes(32).toString('hex');
    
    list.subscribers.push({
      email: email.trim(),
      unsubscribeToken
    });
    
    await list.save();
    
    res.json({
      success: true,
      message: 'Successfully subscribed to the list'
    });
    
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to subscribe', 
      error: error.message 
    });
  }
});

router.get('/api/public/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const list = await SubscriptionList.findOne({ 
      'subscribers.unsubscribeToken': token 
    });
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid unsubscribe link' 
      });
    }

    list.subscribers = list.subscribers.filter(sub => sub.unsubscribeToken !== token);
    await list.save();
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed from the list'
    });
    
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to unsubscribe', 
      error: error.message 
    });
  }
});

router.delete('/api/admin/subscription-lists/:listId/subscribers/:email', authenticateToken, async (req, res) => {
  try {
    const { listId, email } = req.params;
    
    const list = await SubscriptionList.findById(listId);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'List not found' 
      });
    }

    const initialCount = list.subscribers.length;
    list.subscribers = list.subscribers.filter(sub => sub.email !== email);
    
    if (list.subscribers.length === initialCount) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscriber not found in this list' 
      });
    }
    
    await list.save();
    
    res.json({
      success: true,
      message: 'Subscriber removed successfully'
    });
    
  } catch (error) {
    console.error('Remove subscriber error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove subscriber', 
      error: error.message 
    });
  }
});

router.post('/api/admin/email-templates', authenticateToken, async (req, res) => {
  try {
    const { name, markdownContent, isDefault } = req.body;
    
    if (!name || !markdownContent) {
      return res.status(400).json({ 
        success: false, 
        message: 'Template name and markdown content are required' 
      });
    }

    if (isDefault) {
      await EmailTemplate.updateMany({}, { isDefault: false });
    }

    const htmlContent = marked(markdownContent);

    const template = new EmailTemplate({
      name,
      markdownContent,
      htmlContent,
      isDefault: isDefault || false,
      createdBy: req.user.email || req.user.id
    });
    
    await template.save();
    
    res.json({
      success: true,
      message: 'Email template created successfully',
      template
    });
    
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create email template', 
      error: error.message 
    });
  }
});

router.get('/api/admin/email-templates', authenticateToken, async (req, res) => {
  try {
    const templates = await EmailTemplate.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      templates
    });
    
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve email templates', 
      error: error.message 
    });
  }
});

router.get('/api/admin/email-templates/:id', authenticateToken, async (req, res) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }
    
    res.json({
      success: true,
      template
    });
    
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve template', 
      error: error.message 
    });
  }
});

router.put('/api/admin/email-templates/:id', authenticateToken, async (req, res) => {
  try {
    const { name, markdownContent, isDefault } = req.body;
    
    const template = await EmailTemplate.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }

    if (name) template.name = name;
    if (markdownContent) {
      template.markdownContent = markdownContent;
      template.htmlContent = marked(markdownContent);
    }
    if (isDefault !== undefined) {
      if (isDefault) {
        await EmailTemplate.updateMany({ _id: { $ne: template._id } }, { isDefault: false });
      }
      template.isDefault = isDefault;
    }
    template.updatedAt = Date.now();
    
    await template.save();
    
    res.json({
      success: true,
      message: 'Template updated successfully',
      template
    });
    
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update template', 
      error: error.message 
    });
  }
});

router.delete('/api/admin/email-templates/:id', authenticateToken, async (req, res) => {
  try {
    const template = await EmailTemplate.findByIdAndDelete(req.params.id);
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete template', 
      error: error.message 
    });
  }
});

router.post('/api/admin/send-email', authenticateToken, upload.array('attachments', 10), async (req, res) => {
  try {
    const { to, subject, message, senderName, receiverName, templateId } = req.body;
    
    if (!to || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, subject, and message are required' 
      });
    }

    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      contentType: file.mimetype,
      url: file.path,
      size: file.size
    })) : [];

    let htmlTemplate;
    if (templateId) {
      const template = await EmailTemplate.findById(templateId);
      if (template) {
        htmlTemplate = template.htmlContent.replace('{{subject}}', subject).replace('{{message}}', message).replace('{{senderName}}', senderName || 'Aaditiya Tyagi').replace('{{receiverName}}', receiverName || 'Valued User');
      } else {
        htmlTemplate = getEmailTemplate(subject, message, senderName, receiverName);
      }
    } else {
      htmlTemplate = getEmailTemplate(subject, message, senderName, receiverName);
    }
    
    await sendEmail(to, subject, htmlTemplate, attachments);
    
    const emailRecord = new Email({
      to,
      subject,
      message,
      attachments,
      sentBy: req.user.email || req.user.id,
      status: 'sent',
      templateId: templateId || null
    });
    
    await emailRecord.save();
    
    res.json({
      success: true,
      message: 'Email sent successfully',
      emailId: emailRecord._id
    });
    
  } catch (error) {
    console.error('Send email error:', error);
    try {
      const failedEmailRecord = new Email({
        to: req.body.to,
        subject: req.body.subject,
        message: req.body.message,
        attachments: req.files ? req.files.map(file => ({
          filename: file.originalname,
          contentType: file.mimetype,
          url: file.path,
          size: file.size
        })) : [],
        sentBy: req.user.email || req.user.id,
        status: 'failed',
        templateId: req.body.templateId || null
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

router.post('/api/admin/send-to-list', authenticateToken, upload.array('attachments', 10), async (req, res) => {
  try {
    const { listId, subject, message, senderName, receiverName, templateId } = req.body;
    
    if (!listId || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'List ID, subject, and message are required' 
      });
    }

    const list = await SubscriptionList.findById(listId);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscription list not found' 
      });
    }

    if (!list.isActive) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot send emails to inactive list' 
      });
    }

    if (list.subscribers.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No subscribers in this list' 
      });
    }

    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      contentType: file.mimetype,
      url: file.path,
      size: file.size
    })) : [];

    let baseHtmlTemplate;
    if (templateId) {
      const template = await EmailTemplate.findById(templateId);
      if (template) {
        baseHtmlTemplate = template.htmlContent;
      } else {
        baseHtmlTemplate = null;
      }
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const subscriber of list.subscribers) {
      try {
        const unsubscribeUrl = `${req.protocol}://${req.get('host')}/api/public/unsubscribe/${subscriber.unsubscribeToken}`;
        
        let htmlTemplate;
        if (baseHtmlTemplate) {
          htmlTemplate = baseHtmlTemplate
            .replace('{{subject}}', subject)
            .replace('{{message}}', message)
            .replace('{{senderName}}', senderName || 'Aaditiya Tyagi')
            .replace('{{receiverName}}', receiverName || 'Valued Subscriber');
          htmlTemplate += `<div style="text-align: center; margin-top: 20px; padding: 20px; border-top: 1px solid #ccc;"><a href="${unsubscribeUrl}" style="color: #666; text-decoration: none;">Unsubscribe from this list</a></div>`;
        } else {
          htmlTemplate = getEmailTemplate(subject, message, senderName, receiverName);
          htmlTemplate = htmlTemplate.replace('</body>', `<div style="text-align: center; margin-top: 20px; padding: 20px; border-top: 1px solid #ccc;"><a href="${unsubscribeUrl}" style="color: #666; text-decoration: none;">Unsubscribe from this list</a></div></body>`);
        }

        await sendEmail(subscriber.email, subject, htmlTemplate, attachments);
        results.successful.push(subscriber.email);
        
        const emailRecord = new Email({
          to: subscriber.email,
          subject,
          message,
          attachments,
          sentBy: req.user.email || req.user.id,
          status: 'sent',
          listId: list._id,
          templateId: templateId || null
        });
        
        await emailRecord.save();
        
      } catch (error) {
        console.error(`Failed to send email to ${subscriber.email}:`, error);
        results.failed.push({ email: subscriber.email, error: error.message });
        
        const failedEmailRecord = new Email({
          to: subscriber.email,
          subject,
          message,
          attachments,
          sentBy: req.user.email || req.user.id,
          status: 'failed',
          listId: list._id,
          templateId: templateId || null
        });
        
        await failedEmailRecord.save();
      }
    }
    
    res.json({
      success: true,
      message: `Email sent to list. ${results.successful.length} sent, ${results.failed.length} failed`,
      results
    });
    
  } catch (error) {
    console.error('Send to list error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send emails to list', 
      error: error.message 
    });
  }
});

router.post('/api/admin/send-bulk-email', authenticateToken, upload.array('attachments', 10), async (req, res) => {
  try {
    let { recipients, subject, message, senderName, receiverName, templateId } = req.body;
   
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email.trim()));
    
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid email format(s): ${invalidEmails.join(', ')}` 
      });
    }

    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      contentType: file.mimetype,
      url: file.path,
      size: file.size
    })) : [];

    let htmlTemplate;
    if (templateId) {
      const template = await EmailTemplate.findById(templateId);
      if (template) {
        htmlTemplate = template.htmlContent
          .replace('{{subject}}', subject)
          .replace('{{message}}', message)
          .replace('{{senderName}}', senderName || 'Aaditiya Tyagi')
          .replace('{{receiverName}}', receiverName || 'Valued User');
      } else {
        htmlTemplate = getEmailTemplate(subject, message, senderName, receiverName);
      }
    } else {
      htmlTemplate = getEmailTemplate(subject, message, senderName, receiverName);
    }
    
    const results = {
      successful: [],
      failed: []
    };

    for (const recipient of recipients) {
      try {
        await sendEmail(recipient.trim(), subject, htmlTemplate, attachments);
        results.successful.push(recipient);
        
        const emailRecord = new Email({
          to: recipient.trim(),
          subject,
          message,
          attachments,
          sentBy: req.user.email || req.user.id,
          status: 'sent',
          templateId: templateId || null
        });
        
        await emailRecord.save();
        
      } catch (error) {
        console.error(`Failed to send email to ${recipient}:`, error);
        results.failed.push({ email: recipient, error: error.message });
        
        const failedEmailRecord = new Email({
          to: recipient.trim(),
          subject,
          message,
          attachments,
          sentBy: req.user.email || req.user.id,
          status: 'failed',
          templateId: templateId || null
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

router.get('/api/admin/email-history', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const listId = req.query.listId;
    
    const filter = listId ? { listId } : {};
    
    const emails = await Email.find(filter)
      .select('-attachments.data')
      .populate('listId', 'name')
      .populate('templateId', 'name')
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Email.countDocuments(filter);
    
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

router.get('/api/admin/email/:id', authenticateToken, async (req, res) => {
  try {
    const email = await Email.findById(req.params.id)
      .populate('listId', 'name')
      .populate('templateId', 'name');
    
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
    
    const totalLists = await SubscriptionList.countDocuments();
    const activeLists = await SubscriptionList.countDocuments({ isActive: true });
    const totalSubscribers = await SubscriptionList.aggregate([
      { $unwind: '$subscribers' },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        total: stats[0]?.totalEmails || 0,
        sent: stats[0]?.sentEmails || 0,
        failed: stats[0]?.failedEmails || 0,
        last24Hours: recentEmails,
        totalLists,
        activeLists,
        totalSubscribers: totalSubscribers[0]?.count || 0
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
router.post('/api/admin/subscription-lists/:listId/subscribers', authenticateToken, async (req, res) => {
  try {
    const { listId } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    const list = await SubscriptionList.findById(listId);
    
    if (!list) {
      return res.status(404).json({ 
        success: false, 
        message: 'List not found' 
      });
    }

    const existingSubscriber = list.subscribers.find(sub => sub.email === email.trim());
    
    if (existingSubscriber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already subscribed to this list' 
      });
    }

    const unsubscribeToken = crypto.randomBytes(32).toString('hex');
    
    list.subscribers.push({
      email: email.trim(),
      unsubscribeToken,
      subscribedAt: Date.now()
    });
    
    await list.save();
    
    res.json({
      success: true,
      message: 'Subscriber added successfully',
      subscriber: {
        email: email.trim(),
        subscribedAt: Date.now()
      }
    });
    
  } catch (error) {
    console.error('Add subscriber error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add subscriber', 
      error: error.message 
    });
  }
});
module.exports = router;