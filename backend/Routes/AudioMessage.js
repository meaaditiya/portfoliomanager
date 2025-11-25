const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const authenticateToken = require('../middlewares/authMiddleware');
const audioUpload = require('../middlewares/audioUpload');
const OTP = require('../models/otp');
const AudioRecording = require('../models/audioRecordingSchema');
const AudioReply = require('../models/audioReplySchema');
const Admin = require('../models/admin');
const sendEmail = require('../utils/email');
const getOTPEmailTemplate = require('../EmailTemplates/getOTPEmailTemplate');
const getEmailTemplate = require('../EmailTemplates/getEmailTemplate');
router.post('/api/audio-contact/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email' });
    }
    
    
    const otp = crypto.randomInt(100000, 999999).toString();
    
    
    await OTP.deleteMany({ email, purpose: 'audio_verification' });
    
    
    const newOTP = new OTP({
      email,
      otp,
      purpose: 'audio_verification'
    });
    await newOTP.save();
    
    
    const otpEmailTemplate = getOTPEmailTemplate(otp);
    await sendEmail(email, 'Your Audio Message Verification Code', otpEmailTemplate);
    
    res.status(200).json({ 
      success: true,
      message: 'OTP sent successfully to your email. Please check your inbox.'
    });
  } catch (error) {
    console.error('OTP sending error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});


router.post('/api/audio-contact', audioUpload.single('audioFile'), async (req, res) => {
  try {
    const { name, email, duration, transcription = '', otp } = req.body;
    
    
    if (!name || !email || !duration || !req.file || !otp) {
      return res.status(400).json({ 
        message: 'Name, email, duration, audio file, and OTP are required' 
      });
    }
    
    
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email' });
    }
    
    
    const otpRecord = await OTP.findOne({ 
      email, 
      otp, 
      purpose: 'audio_verification' 
    });
    
    if (!otpRecord) {
      return res.status(400).json({ 
        message: 'Invalid or expired OTP. Please request a new one.' 
      });
    }
    
    
    const newRecording = new AudioRecording({
      name,
      email,
      audioData: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      duration: parseFloat(duration),
      transcription
    });
    
    await newRecording.save();
    
    
    await OTP.deleteOne({ _id: otpRecord._id });
    
    
    const confirmationMessage = `Thank you for your audio message! I've received your recording and will listen to it shortly. I'll get back to you via email soon.

Duration: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')} minutes
File Size: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB

I appreciate you taking the time to reach out through this personal medium.`;

    const confirmationEmail = getEmailTemplate(
      'Audio Message Received - Thank You!',
      confirmationMessage,
      'Aaditiya Tyagi',
      name
    );
    
    await sendEmail(email, 'Audio Message Received - Thank You!', confirmationEmail);
    
    
    const admin = await Admin.findOne();
    if (admin) {
      const adminMessage = `New audio message received from ${name} (${email}).

Duration: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')} minutes
File Size: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB
${transcription ? `Transcription: ${transcription}` : 'No transcription provided'}

Please check the admin panel to listen and respond.`;

      const adminEmail = getEmailTemplate(
        '🎙️ New Audio Message Received',
        adminMessage,
        'System Notification',
        'Admin'
      );
      
      await sendEmail(admin.email, '🎙️ New Audio Message from ' + name, adminEmail);
    }
    
    res.status(201).json({ 
      success: true,
      message: 'Your audio message has been sent successfully. I will get back to you soon!',
      recordingId: newRecording._id
    });
  } catch (error) {
    console.error('Audio submission error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'Audio file is too large. Please upload a file smaller than 50MB.' 
      });
    }
    if (error.message === 'Only audio files are allowed') {
      return res.status(400).json({ 
        message: 'Please upload a valid audio file.' 
      });
    }
    res.status(500).json({ 
      message: 'Failed to send your audio message. Please try again later.' 
    });
  }
});


router.get('/api/admin/audio-recordings/:id/audio', authenticateToken, async (req, res) => {
  try {
    const recording = await AudioRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ message: 'Audio recording not found' });
    }
    
    res.set({
      'Content-Type': recording.mimeType,
      'Content-Length': recording.audioData.length,
      'Content-Disposition': `inline; filename="${recording.originalName}"`
    });
    
    res.send(recording.audioData);
  } catch (error) {
    console.error('Audio serve error:', error);
    res.status(500).json({ message: 'Failed to load audio file' });
  }
});




router.get('/api/admin/audio-recordings', authenticateToken, async (req, res) => {
  try {
    const { email } = req.query;
    
    
    const projection = { audioData: 0 };
    
    if (email) {
      
      const recordings = await AudioRecording.find({ email }, projection)
        .sort({ createdAt: -1 });
      res.json({
        success: true,
        data: recordings,
        email: email
      });
    } else {
      
      const recordings = await AudioRecording.find({}, projection)
        .sort({ createdAt: -1 });
      res.json({
        success: true,
        data: recordings
      });
    }
  } catch (error) {
    console.error('Fetch audio recordings error:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/admin/audio-recordings/:id', authenticateToken, async (req, res) => {
  try {
    const recording = await AudioRecording.findById(req.params.id, { audioData: 0 });
    if (!recording) {
      return res.status(404).json({ message: 'Audio recording not found' });
    }
    
    
    if (recording.status === 'unread') {
      recording.status = 'read';
      await recording.save();
    }
    
    
    const replies = await AudioReply.find({ recordingId: recording._id })
      .populate('repliedBy', 'name email')
      .sort({ repliedAt: -1 });
    
    res.json({ 
      success: true,
      recording, 
      replies 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.post('/api/admin/audio-recordings/:id/reply', authenticateToken, async (req, res) => {
  try {
    const { replyContent } = req.body;
    const recordingId = req.params.id;
    const adminId = req.user.admin_id;

    
    if (!replyContent || replyContent.trim() === '') {
      return res.status(400).json({ message: 'Reply content is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(recordingId)) {
      return res.status(400).json({ message: 'Invalid recording ID' });
    }
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized: Invalid admin credentials' });
    }

    
    const recording = await AudioRecording.findById(recordingId, { audioData: 0 });
    if (!recording) {
      return res.status(404).json({ message: 'Audio recording not found' });
    }

    
    const newReply = new AudioReply({
      recordingId,
      replyContent: replyContent.trim(),
      repliedBy: adminId
    });

    await newReply.save();

    
    recording.status = 'replied';
    recording.replied = true;
    await recording.save();

    
    const replyMessage = `Thank you for your audio message! 
${replyContent}

I really appreciate you taking the time to share your thoughts through audio. It's always great to hear directly from people who visit my site.`;

    const replyEmail = getEmailTemplate(
      'Response to Your Audio Message',
      replyMessage,
      'Aaditiya Tyagi',
      recording.name
    );

    await sendEmail(
      recording.email,
      'Response to Your Audio Message - Aaditiya Tyagi',
      replyEmail
    );

    
    const populatedReply = await AudioReply.findById(newReply._id).populate('repliedBy', 'name email');

    res.json({
      success: true,
      message: 'Reply sent successfully',
      reply: populatedReply
    });
  } catch (error) {
    console.error('Audio reply error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.put('/api/admin/audio-recordings/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const recordingId = req.params.id;
    
    if (!['unread', 'read', 'replied'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be unread, read, or replied' });
    }
    
    const recording = await AudioRecording.findById(recordingId, { audioData: 0 });
    if (!recording) {
      return res.status(404).json({ message: 'Audio recording not found' });
    }
    
    recording.status = status;
    recording.replied = (status === 'replied');
    await recording.save();
    
    res.json({ 
      success: true, 
      message: `Audio recording status updated to ${status}`,
      updatedRecording: recording
    });
  } catch (error) {
    console.error('Update audio status error:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/admin/audio-recordings/:id', authenticateToken, async (req, res) => {
  try {
    const recording = await AudioRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ message: 'Audio recording not found' });
    }
    
    
    const deletedReplies = await AudioReply.deleteMany({ recordingId: recording._id });
    
    
    await AudioRecording.deleteOne({ _id: recording._id });
    
    res.json({ 
      success: true,
      message: 'Audio recording deleted successfully',
      deletedRepliesCount: deletedReplies.deletedCount
    });
  } catch (error) {
    console.error('Delete audio recording error:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/admin/audio-recordings', authenticateToken, async (req, res) => {
  try {
    
    const recordings = await AudioRecording.find({}, '_id');
    const recordingIds = recordings.map(rec => rec._id);
    
    if (recordingIds.length === 0) {
      return res.json({ 
        success: true,
        message: 'No audio recordings to delete'
      });
    }
    
    
    const deletedReplies = await AudioReply.deleteMany({ recordingId: { $in: recordingIds } });
    
    
    const deleteResult = await AudioRecording.deleteMany({});
    
    res.json({ 
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} audio recordings and ${deletedReplies.deletedCount} associated replies`,
      deletedRecordings: deleteResult.deletedCount,
      deletedReplies: deletedReplies.deletedCount
    });
  } catch (error) {
    console.error('Delete all audio recordings error:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/admin/audio-stats', authenticateToken, async (req, res) => {
  try {
    const totalRecordings = await AudioRecording.countDocuments();
    const unreadCount = await AudioRecording.countDocuments({ status: 'unread' });
    const readCount = await AudioRecording.countDocuments({ status: 'read' });
    const repliedCount = await AudioRecording.countDocuments({ status: 'replied' });
    
    
    const recordings = await AudioRecording.find({}, 'fileSize');
    const totalStorage = recordings.reduce((sum, recording) => sum + recording.fileSize, 0);
    const totalStorageMB = (totalStorage / (1024 * 1024)).toFixed(2);
    
    res.json({
      success: true,
      stats: {
        total: totalRecordings,
        unread: unreadCount,
        read: readCount,
        replied: repliedCount,
        totalStorageMB: parseFloat(totalStorageMB)
      }
    });
  } catch (error) {
    console.error('Audio stats error:', error);
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;