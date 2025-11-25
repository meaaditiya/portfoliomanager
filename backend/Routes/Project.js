const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const upload = require('../middlewares/upload');
const authenticateToken = require('../middlewares/authMiddleware');
const OTP = require('../models/otp');
const ProjectRequest = require('../models/projectRequestSchema');
const sendEmail = require("../utils/email.js");
const confirmationTemplate = require('../EmailTemplates/confirmationTemplate');
const acknowledgeTemplate = require('../EmailTemplates/acknowledgeTemplate');
const getOTPEmailTemplate = require('../EmailTemplates/getOTPEmailTemplate');
router.post('/api/project/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email' });
    }
    
    
    const otp = crypto.randomInt(100000, 999999).toString();
    
    
    await OTP.deleteMany({ email, purpose: 'project_verification' });
    
    
    const newOTP = new OTP({
      email,
      otp,
      purpose: 'project_verification'
    });
    await newOTP.save();
    
    
    const otpEmailTemplate = getOTPEmailTemplate(otp);
    await sendEmail(email, 'Your Project Submission Verification Code', otpEmailTemplate);
    
    res.status(200).json({ 
      success: true,
      message: 'OTP sent successfully to your email. Please check your inbox.'
    });
  } catch (error) {
    console.error('OTP sending error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

router.post('/api/project/submit', upload.array('files', 5), async (req, res) => {
  try {
    const { name, email, projectType, description, budget, timeline, features, techPreferences, additionalInfo, otp } = req.body;

    if (!name || !email || !projectType || !description || !otp) {
      return res.status(400).json({ message: 'Name, email, project type, description, and OTP are required' });
    }

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email' });
    }

    const otpRecord = await OTP.findOne({ email, otp, purpose: 'project_verification' });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new one.' });
    }

    const files = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        files.push({
          filename: `${Date.now()}_${index}_${file.originalname}`,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          data: file.buffer
        });
      });
    }

    const newRequest = new ProjectRequest({
      name,
      email,
      projectType,
      description,
      budget: budget || null,
      timeline: timeline || null,
      features: features || null,
      techPreferences: techPreferences || null,
      additionalInfo: additionalInfo || null,
      files: files
    });

    await newRequest.save();
    await OTP.deleteOne({ _id: otpRecord._id });

    const confirmationEmail = confirmationTemplate(name, projectType, files);
    await sendEmail(email, 'Project Request Confirmation', confirmationEmail);

    res.status(201).json({
      success: true,
      message: 'Project request submitted successfully. Check your email for confirmation.',
      filesUploaded: files.length
    });
  } catch (error) {
    console.error('Project submission error:', error);
    res.status(500).json({ message: 'Failed to submit project request. Please try again later.' });
  }
});

router.get('/api/admin/project/requests', authenticateToken, async (req, res) => {
  try {
    const requests = await ProjectRequest.find()
      .sort({ createdAt: -1 })
      .select('-files.data'); 

    res.json({ requests });
  } catch (error) {
    console.error('Error fetching project requests:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/admin/project/requests/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ProjectRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Project request not found' });
    }

    res.json({ request });
  } catch (error) {
    console.error('Error fetching project request details:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/api/admin/project/requests/:id/files/:fileIndex', authenticateToken, async (req, res) => {
  try {
    const { id, fileIndex } = req.params;

    const request = await ProjectRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Project request not found' });
    }

    const fileIdx = parseInt(fileIndex);
    if (fileIdx < 0 || fileIdx >= request.files.length) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = request.files[fileIdx];
    
    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
      'Content-Length': file.size
    });

    res.send(file.data);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/api/admin/project/requests/:id/acknowledge', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ProjectRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Project request not found' });
    }

    if (request.status === 'acknowledged') {
      return res.status(400).json({ message: 'Request already acknowledged' });
    }

    request.status = 'acknowledged';
    await request.save();

    const acknowledgmentEmail = acknowledgeTemplate(request.name, request.projectType);
    await sendEmail(request.email, 'Project Request Acknowledged', acknowledgmentEmail);

    res.json({
      message: 'Project request acknowledged successfully',
      request
    });
  } catch (error) {
    console.error('Acknowledge project request error:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/admin/project/requests/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedRequest = await ProjectRequest.findByIdAndDelete(id);
    if (!deletedRequest) {
      return res.status(404).json({ message: 'Project request not found' });
    }
    
    res.json({ message: 'Project request deleted successfully' });
  } catch (error) {
    console.error('Error deleting project request:', error);
    res.status(500).json({ message: error.message });
  }
});


router.delete('/api/admin/project/requests', authenticateToken, async (req, res) => {
  try {
    const result = await ProjectRequest.deleteMany({});
    
    res.json({ 
      message: 'All project requests deleted successfully',
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error deleting all project requests:', error);
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;