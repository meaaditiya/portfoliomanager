const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Admin = require("../models/admin.js");
const OTP = require("../models/otp.js");
const BlacklistedToken = require("../models/blacklistedtoken.js");

const authenticateToken = require("../middlewares/authMiddleware");
const generateOTP = require("../utils/otp");
const sendEmail = require("../utils/email");
// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!admin.isEmailVerified) {
      return res.status(401).json({ message: 'Please complete verification process' });
    }
    if (admin.status !== 'active') {
      return res.status(401).json({ message: 'Your account is not active' });
    }
    admin.lastLogin = new Date();
    await admin.save();
    const token = jwt.sign(
      { 
        admin_id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction, 
      sameSite: isProduction ? 'None' : 'Lax', 
      maxAge: 24 * 60 * 60 * 1000, 
      path: '/'
    });
    res.json({
      message: 'Login successful',
      token: token, 
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ message: 'Token is valid', user: req.user });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'No account found with this email' });
    }
    const otp = generateOTP();
    const otpRecord = new OTP({
      email,
      otp,
      purpose: 'password_reset'
    });
    await otpRecord.save();
    const resetEmail = `
      <h1>Password Reset Request</h1>
      <p>Hello ${admin.name},</p>
      <p>Your password reset code is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    
    await sendEmail(email, 'Password Reset - Portfolio Admin', resetEmail);

    res.json({ 
      message: 'Password reset instructions sent to your email',
      email
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const otpRecord = await OTP.findOne({ 
      email,
      otp,
      purpose: 'password_reset'
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    admin.password = hashedPassword;
    await admin.save();
    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (token) {
      const blacklistedToken = new BlacklistedToken({ token });
      await blacklistedToken.save();
    }
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax',
      path: '/'
    });
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user.admin_id;
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    admin.password = hashedPassword;
    await admin.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.admin_id).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;
