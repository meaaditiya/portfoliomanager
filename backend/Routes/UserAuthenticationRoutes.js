const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require('passport');
const User = require("../models/userSchema");
const BlacklistedToken = require("../models/blacklistedtoken.js");
const UserAuthMiddleware = require("../middlewares/UserAuthMiddleware");
const sendEmail = require("../utils/email");
const getReplyEmailTemplate2 = require("../EmailTemplates/getReplyTemplate2");
const authenticateToken = require("../middlewares/authMiddleware.js")
router.post('/user/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      isVerified: false
    });

    await user.save();

    const verificationToken = jwt.sign(
      { user_id: user._id, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    const verificationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    const verificationMessage = `Thank you for registering! Please verify your email by clicking the link below to activate your account.`;
    
    const verificationResponse = `
      <p>Click the link below to verify your email:</p>
      <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #2c2c2c; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">Verify Your Email</a>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create this account, please ignore this email.</p>
    `;

    const emailHtml = getReplyEmailTemplate2(
      user.name,
      verificationMessage,
      verificationResponse
    );

    await sendEmail(email, 'Verify Your Email - Portfolio', emailHtml);

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/user/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const user = await User.findById(decoded.user_id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    user.isVerified = true;
    await user.save();

    res.json({ message: 'Email verified successfully. You can now login.' });
  } catch (error) {
    res.status(400).json({ message: 'Invalid or expired verification link' });
  }
});

router.post('/user/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: 'Please verify your email first' });
    }

    const token = jwt.sign(
      {
        user_id: user._id,
        email: user.email,
        name: user.name,
        isPremium: user.isPremium 
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium 
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/user/logout', UserAuthMiddleware, async (req, res) => {
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

router.post('/user/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    const resetToken = jwt.sign(
      { user_id: user._id, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const resetMessage = `You have requested to reset your password. Please follow the instructions below to create a new password for your account.`;
    
    const resetResponse = `
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #2c2c2c; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p><strong>Important:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
    `;

    const emailHtml = getReplyEmailTemplate2(
      user.name,
      resetMessage,
      resetResponse
    );

    await sendEmail(email, 'Password Reset - Portfolio', emailHtml);

    res.json({
      message: 'Password reset instructions sent to your email',
      email
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/user/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const user = await User.findById(decoded.user_id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    // Send confirmation email
    const confirmationMessage = `Your password has been successfully reset. You can now login with your new password.`;
    const confirmationResponse = `
      <p>Your password was changed successfully at ${new Date().toLocaleString()}.</p>
      <p>If you did not make this change, please contact us immediately.</p>
      <p>For security reasons, we recommend that you:</p>
      <ul style="text-align: left; margin: 15px 0; padding-left: 20px;">
        <li>Use a strong, unique password</li>
        <li>Enable two-factor authentication if available</li>
        <li>Keep your login credentials secure</li>
      </ul>
    `;

    const emailHtml = getReplyEmailTemplate2(
      user.name,
      confirmationMessage,
      confirmationResponse
    );

    await sendEmail(user.email, 'Password Reset Successful - Portfolio', emailHtml);

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    res.status(400).json({ message: 'Invalid or expired reset link' });
  }
});

router.get('/user/verify', UserAuthMiddleware, (req, res) => {
  res.json({ message: 'Token is valid', user: req.user });
});

router.get('/user/profile', UserAuthMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        message: 'No token provided',
        isValid: false 
      });
    }

    // Check if token is blacklisted
    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      return res.status(403).json({ 
        message: 'Token has been revoked',
        isValid: false 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const user = await User.findById(decoded.user_id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        isValid: false 
      });
    }

    res.json({ 
      isValid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        isPremium: user.isPremium
      }
    });
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(403).json({ 
      message: 'Invalid token',
      isValid: false 
    });
  }
});

router.put('/user/update-name', UserAuthMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldName = user.name;
    user.name = name.trim();
    await user.save();

    // Send confirmation email
    const updateMessage = `Your profile name has been successfully updated from "${oldName}" to "${name.trim()}".`;
    const updateResponse = `
      <p>Your profile information was updated at ${new Date().toLocaleString()}.</p>
      <p><strong>New Name:</strong> ${name.trim()}</p>
      <p>If you did not make this change, please contact us immediately to secure your account.</p>
    `;

    const emailHtml = getReplyEmailTemplate2(
      user.name,
      updateMessage,
      updateResponse
    );

    await sendEmail(user.email, 'Profile Updated - Portfolio', emailHtml);

    res.json({ 
      message: 'Name updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=google_auth_failed`,
    session: false 
  }),
  async (req, res) => {
    try {
      if (req.user.profilePicture) {
        await User.findByIdAndUpdate(req.user._id, {
          profilePicture: req.user.profilePicture
        });
      }

      const token = jwt.sign(
        {
          user_id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          isPremium: req.user.isPremium 
          
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

      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?token=${token}&google_login=success`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=auth_failed`);
    }
  }
);
router.get('/admin/users', authenticateToken, async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { page = 1, limit = 10, search = '' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    let searchQuery = {};
    if (search) {
      searchQuery = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const totalUsers = await User.countDocuments(searchQuery);
    const users = await User.find(searchQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      message: 'Users retrieved successfully',
      users,
      pagination: {
        total: totalUsers,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalUsers / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.patch('/admin/users/:id/verify', authenticateToken, async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { isVerified } = req.body;

    if (typeof isVerified !== 'boolean') {
      return res.status(400).json({ message: 'isVerified must be true or false' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isVerified = isVerified;
    await user.save();

    res.json({
      message: `User verification status updated to ${isVerified}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.patch('/admin/users/:id/premium', authenticateToken, async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { isPremium } = req.body;

    if (typeof isPremium !== 'boolean') {
      return res.status(400).json({ message: 'isPremium must be true or false' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isPremium = isPremium;
    await user.save();

    res.json({
      message: `User premium status updated to ${isPremium}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.delete('/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const deletedUserEmail = user.email;
    const deletedUserName = user.name;

    await User.findByIdAndDelete(req.params.id);

    res.json({
      message: 'User account deleted successfully',
      deletedUser: {
        id: user._id,
        name: deletedUserName,
        email: deletedUserEmail
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/auth/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=github_auth_failed`,
    session: false
  }),
  async (req, res) => {
    try {
      if (req.user.profilePicture) {
        await User.findByIdAndUpdate(req.user._id, {
          profilePicture: req.user.profilePicture
        });
      }

      const token = jwt.sign(
        {
          user_id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          isPremium: req.user.isPremium
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

      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?token=${token}&github_login=success`);
    } catch (error) {
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=auth_failed`);
    }
  }
);

router.get(
  '/auth/discord',
  passport.authenticate('discord')
);

router.get(
  '/auth/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=discord_auth_failed`,
    session: false
  }),
  async (req, res) => {
    try {
      if (req.user.profilePicture) {
        await User.findByIdAndUpdate(req.user._id, {
          profilePicture: req.user.profilePicture
        });
      }

      const token = jwt.sign(
        {
          user_id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          isPremium: req.user.isPremium
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

      res.redirect(
        `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?token=${token}&discord_login=success`
      );
    } catch (error) {
      res.redirect(
        `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=auth_failed`
      );
    }
  }
);
module.exports = router;