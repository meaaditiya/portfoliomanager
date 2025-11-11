  const express = require("express");
  const router = express.Router();
  const Message = require("../models/message");
  const OTP = require("../models/otp");
  const crypto = require('crypto');
 const getAdminNotificationTemplate = require("../EmailTemplates/getAdminNotificationTemplate.js");
 const getConfirmationEmailTemplate = require("../EmailTemplates/getConfirmationEmailTemplate.js");
 const getReplyEmailTemplate = require("../EmailTemplates/getReplyEmailTemplate.js");
 const getOTPEmailTemplate = require("../EmailTemplates/getOTPEmailTemplate.js");
const authenticateToken = require("../middlewares/authMiddleware.js");
const Reply = require("../models/reply");
const mongoose = require('mongoose');
const sendEmail = require("../utils/email.js");
const Admin = require("../models/admin.js");
  router.post('/api/contact/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email' });
    }
    
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Delete any existing OTP for this email and purpose
    await OTP.deleteMany({ email, purpose: 'contact_verification' });
    
    // Save new OTP
    const newOTP = new OTP({
      email,
      otp,
      purpose: 'contact_verification'
    });
    await newOTP.save();
    
    // Send OTP via email
    const otpEmailTemplate = getOTPEmailTemplate(otp);
    await sendEmail(email, 'Your Contact Form Verification Code', otpEmailTemplate);
    
    res.status(200).json({ 
      success: true,
      message: 'OTP sent successfully to your email. Please check your inbox.'
    });
  } catch (error) {
    console.error('OTP sending error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});
router.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message, otp } = req.body;
    
    // Validate inputs
    if (!name || !email || !message || !otp) {
      return res.status(400).json({ message: 'All fields including OTP are required' });
    }
    
    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email' });
    }
    
    // Verify OTP
    const otpRecord = await OTP.findOne({ 
      email, 
      otp, 
      purpose: 'contact_verification' 
    });
    
    if (!otpRecord) {
      return res.status(400).json({ 
        message: 'Invalid or expired OTP. Please request a new one.' 
      });
    }
    
    // Create new message
    const newMessage = new Message({
      name,
      email,
      message
    });
    
    await newMessage.save();
    
    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });
    
    // Send enhanced confirmation email to user
    const confirmationEmail = getConfirmationEmailTemplate(name, message);
    await sendEmail(email, 'Thank You for Reaching Out - I\'ll Be in Touch Soon!', confirmationEmail);
    
    // Send enhanced notification to admin
    const adminNotification = getAdminNotificationTemplate(name, email, message);
    
    const admin = await Admin.findOne();
    if (admin) {
      await sendEmail(admin.email, '🔔 New Contact Message from ' + name, adminNotification);
    }
    
    res.status(201).json({ 
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon!'
    });
  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({ message: 'Failed to send your message. Please try again later.' });
  }
});
  
  // Admin Routes for Messages
  // Get all messages (for admin) - Enhanced with grouping by email
  router.get('/api/admin/messages', authenticateToken, async (req, res) => {
    try {
      const { grouped = false, email } = req.query;
      if (grouped === 'true') {
  // Fetch all messages and group them in JavaScript
  const messages = await Message.find().sort({ createdAt: -1 }).lean();
  
  // Group messages by email manually
  const groupedMessages = messages.reduce((acc, msg) => {
    const { email, name, _id, message, createdAt, status, replied } = msg;
    
    if (!acc[email]) {
      acc[email] = {
        _id: email,
        name,
        email,
        messages: [],
        totalMessages: 0,
        latestMessage: createdAt,
        firstMessage: createdAt,
        unreadCount: 0,
        readCount: 0,
        repliedCount: 0,
        overallStatus: 'replied', // Default
        priority: 3 // Default for replied
      };
    }
    
    // Update group data
    acc[email].messages.push({ _id, message, createdAt, status, replied });
    acc[email].totalMessages += 1;
    acc[email].latestMessage = new Date(acc[email].latestMessage) > new Date(createdAt) ? acc[email].latestMessage : createdAt;
    acc[email].firstMessage = new Date(acc[email].firstMessage) < new Date(createdAt) ? acc[email].firstMessage : createdAt;
    
    // Update status counts
    if (status === 'unread') acc[email].unreadCount += 1;
    if (status === 'read') acc[email].readCount += 1;
    if (status === 'replied') acc[email].repliedCount += 1;
    
    // Determine overallStatus and priority
    if (acc[email].unreadCount > 0) {
      acc[email].overallStatus = 'unread';
      acc[email].priority = 1;
    } else if (acc[email].readCount > 0) {
      acc[email].overallStatus = 'read';
      acc[email].priority = 2;
    }
    
    return acc;
  }, {});
  
  // Convert to array and sort by priority and latestMessage
  const sortedMessages = Object.values(groupedMessages).sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.latestMessage) - new Date(a.latestMessage);
  });
  
  res.json({
    success: true,
    data: sortedMessages,
    totalGroups: sortedMessages.length
  });
}
     else if (email) {
        // Get all messages from specific email
        const messages = await Message.find({ email }).sort({ createdAt: -1 });
        res.json({
          success: true,
          data: messages,
          email: email
        });
      } else {
        // Regular view - all messages individually
        const messages = await Message.find().sort({ createdAt: -1 });
        res.json({
          success: true,
          data: messages
        });
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get message details (for admin)
  router.get('/api/admin/messages/:id', authenticateToken, async (req, res) => {
    try {
      const message = await Message.findById(req.params.id);
      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }
      
      // Mark as read if it's unread
      if (message.status === 'unread') {
        message.status = 'read';
        await message.save();
      }
      
      // Get any replies
      const replies = await Reply.find({ messageId: message._id })
        .populate('repliedBy', 'name email')
        .sort({ repliedAt: -1 });
      
      res.json({ 
        success: true,
        message, 
        replies 
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all messages from specific email (for admin)
  router.get('/api/admin/messages/email/:email', authenticateToken, async (req, res) => {
    try {
      const { email } = req.params;
      const messages = await Message.find({ email }).sort({ createdAt: -1 });
      
      if (messages.length === 0) {
        return res.status(404).json({ message: 'No messages found for this email' });
      }
      
      // Get replies for all messages from this email
      const messageIds = messages.map(msg => msg._id);
      const replies = await Reply.find({ messageId: { $in: messageIds } })
        .populate('repliedBy', 'name email')
        .sort({ repliedAt: -1 });
      
      // Group replies by messageId
      const repliesByMessage = replies.reduce((acc, reply) => {
        if (!acc[reply.messageId]) {
          acc[reply.messageId] = [];
        }
        acc[reply.messageId].push(reply);
        return acc;
      }, {});
      
     

      // Add replies to corresponding messages
      const messagesWithReplies = messages.map(message => ({
        ...message.toObject(),
        replies: repliesByMessage[message._id] || []
      }));
      
      res.json({
        success: true,
        email,
        name: messages[0].name,
        totalMessages: messages.length,
        unreadCount: messages.filter(msg => msg.status === 'unread').length,
        readCount: messages.filter(msg => msg.status === 'read').length,
        repliedCount: messages.filter(msg => msg.status === 'replied').length,
        messages: messagesWithReplies
      });
    } catch (error) {
      console.error('Fetch messages by email error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  router.post('/api/admin/messages/:id/reply', authenticateToken, async (req, res) => {
  try {
    const { replyContent } = req.body; // Remove originalMessage from destructuring
    const messageId = req.params.id;
    const adminId = req.user.admin_id;

    // Validate inputs
    if (!replyContent || replyContent.trim() === '') {
      return res.status(400).json({ message: 'Reply content is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized: Invalid admin credentials' });
    }

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Create the reply
    const newReply = new Reply({
      messageId,
      replyContent: replyContent.trim(),
      repliedBy: adminId
    });

    await newReply.save();

    // Update message status
    message.status = 'replied';
    message.replied = true;
    await message.save();

    // Send enhanced reply email using the original message from the Message document
    const replyEmail = getReplyEmailTemplate(message.name, message.message, replyContent);

    await sendEmail(
      message.email,
      'Response from Aaditiya Tyagi',
      replyEmail
    );

    // Populate the reply with admin info for response
    const populatedReply = await Reply.findById(newReply._id).populate('repliedBy', 'name email');

    res.json({
      success: true,
      message: 'Reply sent successfully',
      reply: populatedReply
    });
  } catch (error) {
    console.error('Reply error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
  
  // Update message status (for admin)
  router.put('/api/admin/messages/:id/status', authenticateToken, async (req, res) => {
    try {
      const { status } = req.body;
      const messageId = req.params.id;
      
      if (!['unread', 'read', 'replied'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be unread, read, or replied' });
      }
      
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }
      
      message.status = status;
      message.replied = (status === 'replied');
      await message.save();
      
      res.json({ 
        success: true, 
        message: `Message status updated to ${status}`,
        updatedMessage: message
      });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete a message (for admin)
  router.delete('/api/admin/messages/:id', authenticateToken, async (req, res) => {
    try {
      const message = await Message.findById(req.params.id);
      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }
      
      // Delete associated replies
      const deletedReplies = await Reply.deleteMany({ messageId: message._id });
      
      // Delete the message
      await Message.deleteOne({ _id: message._id });
      
      res.json({ 
        success: true,
        message: 'Message deleted successfully',
        deletedRepliesCount: deletedReplies.deletedCount
      });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // NEW: Mark all messages as read (for admin)
  router.put('/api/admin/messages/mark-all-read', authenticateToken, async (req, res) => {
    try {
      const updateResult = await Message.updateMany(
        { status: 'unread' }, // Only update unread messages
        { status: 'read' }
      );
      
      res.json({ 
        success: true,
        message: `Successfully marked ${updateResult.modifiedCount} messages as read`,
        modifiedCount: updateResult.modifiedCount
      });
    } catch (error) {
      console.error('Mark all read error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // NEW: Mark all messages as unread (for admin)
  router.put('/api/admin/messages/mark-all-unread', authenticateToken, async (req, res) => {
    try {
      const updateResult = await Message.updateMany(
        { status: { $ne: 'unread' } }, // Only update messages that are not already unread
        { 
          status: 'unread',
          replied: false
        }
      );
      
      res.json({ 
        success: true,
        message: `Successfully marked ${updateResult.modifiedCount} messages as unread`,
        modifiedCount: updateResult.modifiedCount
      });
    } catch (error) {
      console.error('Mark all unread error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // NEW: Delete all messages (for admin)
  router.delete('/api/admin/messages', authenticateToken, async (req, res) => {
    try {
      // Get all message IDs first
      const messages = await Message.find({}, '_id');
      const messageIds = messages.map(msg => msg._id);
      
      if (messageIds.length === 0) {
        return res.json({ 
          success: true,
          message: 'No messages to delete'
        });
      }
      
      // Delete all replies first
      const deletedReplies = await Reply.deleteMany({ messageId: { $in: messageIds } });
      
      // Delete all messages
      const deleteResult = await Message.deleteMany({});
      
      res.json({ 
        success: true,
        message: `Successfully deleted ${deleteResult.deletedCount} messages and ${deletedReplies.deletedCount} associated replies`,
        deletedMessages: deleteResult.deletedCount,
        deletedReplies: deletedReplies.deletedCount
      });
    } catch (error) {
      console.error('Delete all messages error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // NEW: Delete all messages from specific email (for admin)
  router.delete('/api/admin/messages/email/:email', authenticateToken, async (req, res) => {
    try {
      const { email } = req.params;
      
      // Find all messages from this email
      const messages = await Message.find({ email }, '_id');
      
      if (messages.length === 0) {
        return res.status(404).json({ 
          success: false,
          message: 'No messages found for this email' 
        });
      }
      
      const messageIds = messages.map(msg => msg._id);
      
      // Delete all replies for these messages
      const deletedReplies = await Reply.deleteMany({ messageId: { $in: messageIds } });
      
      // Delete all messages from this email
      const deleteResult = await Message.deleteMany({ email });
      
      res.json({ 
        success: true,
        message: `Successfully deleted ${deleteResult.deletedCount} messages from ${email} and ${deletedReplies.deletedCount} associated replies`,
        email,
        deletedMessages: deleteResult.deletedCount,
        deletedReplies: deletedReplies.deletedCount
      });
    } catch (error) {
      console.error('Delete messages by email error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // NEW: Mark all messages from specific email as read (for admin)
  router.put('/api/admin/messages/email/:email/mark-read', authenticateToken, async (req, res) => {
    try {
      const { email } = req.params;
      
      const updateResult = await Message.updateMany(
        { 
          email,
          status: 'unread'
        },
        { status: 'read' }
      );
      
      if (updateResult.matchedCount === 0) {
        return res.status(404).json({ 
          success: false,
          message: 'No unread messages found for this email' 
        });
      }
      
      res.json({ 
        success: true,
        message: `Successfully marked ${updateResult.modifiedCount} messages from ${email} as read`,
        email,
        modifiedCount: updateResult.modifiedCount
      });
    } catch (error) {
      console.error('Mark email messages read error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // NEW: Mark all messages from specific email as unread (for admin)
  router.put('/api/admin/messages/email/:email/mark-unread', authenticateToken, async (req, res) => {
    try {
      const { email } = req.params;
      
      const updateResult = await Message.updateMany(
        { 
          email,
          status: { $ne: 'unread' }
        },
        { 
          status: 'unread',
          replied: false
        }
      );
      
      if (updateResult.matchedCount === 0) {
        return res.status(404).json({ 
          success: false,
          message: 'No messages found for this email or all are already unread' 
        });
      }
      
      res.json({ 
        success: true,
        message: `Successfully marked ${updateResult.modifiedCount} messages from ${email} as unread`,
        email,
        modifiedCount: updateResult.modifiedCount
      });
    } catch (error) {
      console.error('Mark email messages unread error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get message stats (counts by status) - Enhanced with more detailed statistics
  router.get('/api/admin/message-stats', authenticateToken, async (req, res) => {
    try {
      const totalCount = await Message.countDocuments();
      const unreadCount = await Message.countDocuments({ status: 'unread' });
      const readCount = await Message.countDocuments({ status: 'read' });
      const repliedCount = await Message.countDocuments({ status: 'replied' });
      
      // Get unique email count
      const uniqueEmailsCount = await Message.distinct('email').then(emails => emails.length);
      
      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentCount = await Message.countDocuments({ 
        createdAt: { $gte: sevenDaysAgo } 
      });
      
      // Get today's messages
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = await Message.countDocuments({
        createdAt: { $gte: today }
      });
      
      // Get this month's messages
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const thisMonthCount = await Message.countDocuments({
        createdAt: { $gte: thisMonth }
      });
      
      // Get total replies count
      const totalRepliesCount = await Reply.countDocuments();
      
      // Get messages per status with percentage
      const stats = {
        total: totalCount,
        unread: unreadCount,
        read: readCount,
        replied: repliedCount,
        uniqueEmails: uniqueEmailsCount,
        recentMessages: recentCount,
        todayMessages: todayCount,
        thisMonthMessages: thisMonthCount,
        totalReplies: totalRepliesCount,
        percentages: {
          unread: totalCount > 0 ? Math.round((unreadCount / totalCount) * 100) : 0,
          read: totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0,
          replied: totalCount > 0 ? Math.round((repliedCount / totalCount) * 100) : 0
        }
      };
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Message stats error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // NEW: Get message analytics (for admin dashboard)
 router.get('/api/admin/message-analytics', authenticateToken, async (req, res) => {
  try {
    const { period = '7' } = req.query; // Default to 7 days
    const days = parseInt(period);
    
    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ message: 'Invalid period. Must be between 1 and 365 days' });
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    // Fetch messages within the period
    const messages = await Message.find({ createdAt: { $gte: startDate } }).lean();
    
    // Daily stats
    const dailyStats = messages.reduce((acc, msg) => {
      const date = new Date(msg.createdAt);
      const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          _id: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() },
          count: 0,
          unread: 0,
          read: 0,
          replied: 0
        };
      }
      
      acc[dateKey].count += 1;
      if (msg.status === 'unread') acc[dateKey].unread += 1;
      if (msg.status === 'read') acc[dateKey].read += 1;
      if (msg.status === 'replied') acc[dateKey].replied += 1;
      
      return acc;
    }, {});
    
    // Convert to array and sort by date
    const sortedDailyStats = Object.values(dailyStats).sort((a, b) => {
      const dateA = new Date(a._id.year, a._id.month - 1, a._id.day);
      const dateB = new Date(b._id.year, b._id.month - 1, b._id.day);
      return dateA - dateB;
    });
    
    // Top senders
    const senderStats = messages.reduce((acc, msg) => {
      const { email, name, createdAt, status } = msg;
      
      if (!acc[email]) {
        acc[email] = {
          _id: email,
          name,
          count: 0,
          latestMessage: createdAt,
          unreadCount: 0
        };
      }
      
      acc[email].count += 1;
      acc[email].latestMessage = new Date(acc[email].latestMessage) > new Date(createdAt) ? acc[email].latestMessage : createdAt;
      if (status === 'unread') acc[email].unreadCount += 1;
      
      return acc;
    }, {});
    
    // Convert to array, sort by count, and limit to 10
    const topSenders = Object.values(senderStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Response rate
    const totalMessages = await Message.countDocuments();
    const repliedMessages = await Message.countDocuments({ status: 'replied' });
    const responseRate = totalMessages > 0 ? Math.round((repliedMessages / totalMessages) * 100) : 0;
    
    // Summary
    const totalInPeriod = messages.length;
    const avgPerDay = days > 0 ? Math.round((totalInPeriod / days) * 10) / 10 : 0;
    
    res.json({
      success: true,
      period: `${days} days`,
      dailyStats: sortedDailyStats,
      topSenders,
      responseRate,
      summary: {
        totalInPeriod,
        avgPerDay
      }
    });
  } catch (error) {
    console.error('Message analytics error:', error);
    res.status(500).json({ message: error.message });
  }
});
  
  // NEW: Bulk operations for messages (for admin)
  router.post('/api/admin/messages/bulk-action', authenticateToken, async (req, res) => {
    try {
      const { action, messageIds, email } = req.body;
      
      if (!action || !['mark-read', 'mark-unread', 'delete', 'mark-replied'].includes(action)) {
        return res.status(400).json({ message: 'Invalid action. Must be mark-read, mark-unread, delete, or mark-replied' });
      }
      
      let filter = {};
      
      if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
        // Validate ObjectId format
        const validIds = messageIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
          return res.status(400).json({ message: 'No valid message IDs provided' });
        }
        filter._id = { $in: validIds };
      } else if (email) {
        filter.email = email;
      } else {
        return res.status(400).json({ message: 'Either messageIds array or email must be provided' });
      }
      
      let result = {};
      
      switch (action) {
        case 'mark-read':
          result = await Message.updateMany(filter, { status: 'read' });
          break;
        case 'mark-unread':
          result = await Message.updateMany(filter, { status: 'unread', replied: false });
          break;
        case 'mark-replied':
          result = await Message.updateMany(filter, { status: 'replied', replied: true });
          break;
        case 'delete':
          // First find messages to get their IDs for reply deletion
          const messagesToDelete = await Message.find(filter, '_id');
          const messageIdsToDelete = messagesToDelete.map(msg => msg._id);
          
          // Delete associated replies
          const deletedReplies = await Reply.deleteMany({ messageId: { $in: messageIdsToDelete } });
          
          // Delete messages
          result = await Message.deleteMany(filter);
          result.deletedReplies = deletedReplies.deletedCount;
          break;
      }
      
      const actionPastTense = {
        'mark-read': 'marked as read',
        'mark-unread': 'marked as unread',
        'mark-replied': 'marked as replied',
        'delete': 'deleted'
      };
      
      res.json({
        success: true,
        message: `Successfully ${actionPastTense[action]} ${result.modifiedCount || result.deletedCount} messages`,
        result: {
          affected: result.modifiedCount || result.deletedCount,
          deletedReplies: result.deletedReplies || 0
        }
      });
    } catch (error) {
      console.error('Bulk action error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // NEW: Search messages (for admin)
  router.get('/api/admin/messages/search', authenticateToken, async (req, res) => {
    try {
      const { q, status, email, startDate, endDate, page = 1, limit = 20 } = req.query;
      
      if (!q && !status && !email && !startDate) {
        return res.status(400).json({ message: 'At least one search parameter is required' });
      }
      
      let filter = {};
      
      // Text search
      if (q) {
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { message: { $regex: q, $options: 'i' } }
        ];
      }
      
      // Status filter
      if (status && ['unread', 'read', 'replied'].includes(status)) {
        filter.status = status;
      }
      
      // Email filter
      if (email) {
        filter.email = { $regex: email, $options: 'i' };
      }
      
      // Date range filter
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = endDateTime;
        }
      }
      
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;
      
      const messages = await Message.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);
      
      const totalCount = await Message.countDocuments(filter);
      const totalPages = Math.ceil(totalCount / limitNum);
      
      res.json({
        success: true,
        data: messages,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
          limit: limitNum
        },
        searchParams: { q, status, email, startDate, endDate }
      });
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json({ message: error.message });
    }
  });
module.exports = router;