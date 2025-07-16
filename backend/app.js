require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');


// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const PORT = process.env.PORT || 5000;

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', 
      'https://connectwithaaditiya.onrender.com', 'https://connectwithaaditiyamg.onrender.com',
      'https://connectwithaaditiyaadmin.onrender.com',
      'http://192.168.1.33:5174','http://192.168.1.33:5173','https://aaditiyatyagi.vercel.app'];
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));



// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connection to Database Successful, MongoDB connected!'))
  .catch(err => console.error('MongoDB connection error:', err));

// MongoDB Schemas
const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  role: { type: String, default: 'admin' },
  status: { type: String, enum: ['pending', 'active', 'inactive'], default: 'pending' },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['registration', 'password_reset'], required: true },
  createdAt: { type: Date, default: Date.now, expires: '10m' } // OTP expires after 10 minutes
});

const blacklistedTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '24h' } // Tokens expire after 24 hours
});

// Create models
const Admin = mongoose.model('Admin', adminSchema);
const OTP = mongoose.model('OTP', otpSchema);
const BlacklistedToken = mongoose.model('BlacklistedToken', blacklistedTokenSchema);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from cookies first
    let token = req.cookies.token;
    
    // If no token in cookies, check Authorization header (Bearer token)
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if token is blacklisted
    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been invalidated' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};


// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to send emails
const sendEmail = async (email, subject, html, attachments = []) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not set. Email would have been sent to:', email);
    return true;
  }

  const msg = {
    to: email,
    from: process.env.FROM_EMAIL || 'your-email@example.com',
    subject,
    html
  };

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    msg.attachments = attachments.map(att => ({
      content: att.data.toString('base64'),
      filename: att.filename,
      type: att.contentType,
      disposition: 'attachment'
    }));
  }

  try {
    await sgMail.send(msg);
    console.log(`Email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('SendGrid Error:', error);
    if (error.response) {
      console.error('Error response body:', error.response.body);
    }
    throw error;
  }
};
// Routes
// Register new admin
app.post('/api/admin/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate inputs
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if email already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new admin
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword
    });
    await newAdmin.save();

    // Generate and save OTP
    const otp = generateOTP();
    const otpRecord = new OTP({
      email,
      otp,
      purpose: 'registration'
    });
    await otpRecord.save();

    // Send verification email
    const otpEmail = `
      <h1>Email Verification</h1>
      <p>Hello ${name},</p>
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `;
    
    await sendEmail(email, 'Verification Code - Portfolio Admin', otpEmail);

    res.status(201).json({ 
      message: 'Registration successful. Please check your email for verification code.',
      email
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Verify OTP for registration
app.post('/api/admin/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find OTP record
    const otpRecord = await OTP.findOne({ 
      email,
      otp,
      purpose: 'registration'
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Update admin status
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    admin.isEmailVerified = true;
    admin.status = 'active'; // Automatically activate on verification
    await admin.save();

    // Delete OTP after use
    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({ message: 'Email verified successfully. You can now login.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!admin.isEmailVerified) {
      return res.status(401).json({ message: 'Please complete verification process' });
    }

    // Check if account is active
    if (admin.status !== 'active') {
      return res.status(401).json({ message: 'Your account is not active' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        admin_id: admin._id,
        email: admin.email,
        role: admin.role
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    // Set cookie options based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Set token in HTTP-only cookie with appropriate settings
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction, // Only use secure in production
      sameSite: isProduction ? 'None' : 'Lax', // Use 'None' for cross-site in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });
    
    // Also add the token to the response body as a fallback
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
app.get('/api/admin/verify', authenticateToken, (req, res) => {
  res.json({ message: 'Token is valid', user: req.user });
});
// Forgot password
app.post('/api/admin/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    // Generate and save OTP
    const otp = generateOTP();
    const otpRecord = new OTP({
      email,
      otp,
      purpose: 'password_reset'
    });
    await otpRecord.save();

    // Send password reset email
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

// Reset password with OTP
app.post('/api/admin/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Find OTP record
    const otpRecord = await OTP.findOne({ 
      email,
      otp,
      purpose: 'password_reset'
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Update admin password
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    admin.password = hashedPassword;
    await admin.save();

    // Delete OTP after use
    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Logout
app.post('/api/admin/logout', authenticateToken, async (req, res) => {
  try {
    // Get token from cookies or authorization header
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    // Blacklist token
    if (token) {
      const blacklistedToken = new BlacklistedToken({ token });
      await blacklistedToken.save();
    }
    
    // Clear cookie with matching settings
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

// Change password
app.post('/api/admin/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user.admin_id;

    // Find admin
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    admin.password = hashedPassword;
    await admin.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Protected route example
app.get('/api/admin/profile', authenticateToken, async (req, res) => {
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

// Updated Blog Schema with Video Support
const blogSchema = new mongoose.Schema({
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    content: { 
      type: String, 
      required: true 
    },
    // Array to store inline images used in content
    contentImages: [{
      url: {
        type: String,
        required: true
      },
      alt: {
        type: String,
        default: ''
      },
      caption: {
        type: String,
        default: ''
      },
      position: {
        type: String,
        enum: ['left', 'right', 'center', 'full-width'],
        default: 'center'
      },
      imageId: {
        type: String,
        required: true,
        unique: true
      }
    }],
    // Array to store inline videos used in content
    contentVideos: [{
      url: {
        type: String,
        required: true
      },
      videoId: {
        type: String,
        required: true
      },
      platform: {
        type: String,
        enum: ['youtube', 'vimeo', 'dailymotion'],
        default: 'youtube'
      },
      title: {
        type: String,
        default: ''
      },
      caption: {
        type: String,
        default: ''
      },
      position: {
        type: String,
        enum: ['left', 'right', 'center', 'full-width'],
        default: 'center'
      },
      autoplay: {
        type: Boolean,
        default: false
      },
      muted: {
        type: Boolean,
        default: false
      },
      // Unique identifier to reference in content
      embedId: {
        type: String,
        required: true,
        unique: true
      }
    }],
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Admin',
      required: true
    },
    slug: {
      type: String,
      required: false,
      unique: true,
      lowercase: true
    },
    status: { 
      type: String, 
      enum: ['draft', 'published'], 
      default: 'draft' 
    },
    tags: [{ 
      type: String, 
      trim: true 
    }],
    featuredImage: { 
      type: String 
    },
    publishedAt: { 
      type: Date 
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    },
    reactionCounts: {
      likes: {
        type: Number,
        default: 0
      },
      dislikes: {
        type: Number,
        default: 0
      }
    },
    commentsCount: {
      type: Number,
      default: 0
    }
});

// Updated pre-save middleware to handle videos
blogSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '-');
  }
  
  // Generate unique IDs for new content images
  if (this.isModified('contentImages')) {
    this.contentImages.forEach(image => {
      if (!image.imageId) {
        image.imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    });
  }
  
  // Generate unique IDs for new content videos
  if (this.isModified('contentVideos')) {
    this.contentVideos.forEach(video => {
      if (!video.embedId) {
        video.embedId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    });
  }
  
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  this.updatedAt = new Date();
  next();
});

const Blog = mongoose.model('Blog', blogSchema);
  
  // Blog Routes
  // Create a new blog post
app.post('/api/blogs', authenticateToken, async (req, res) => {
  try {
    const { title, content, summary, status, tags, featuredImage, contentImages, contentVideos } = req.body;
    
    // Validate required fields
    if (!title || !content || !summary) {
      return res.status(400).json({ message: 'Title, content, and summary are required' });
    }
    
    // Clean up unused images and videos
    const cleanedImages = cleanupUnusedImages(content, contentImages || []);
    const cleanedVideos = cleanupUnusedVideos(content, contentVideos || []);
    
    const newBlog = new Blog({
      title,
      content,
      summary,
      author: req.user.admin_id,
      status: status || 'draft',
      tags: tags || [],
      featuredImage,
      contentImages: cleanedImages,
      contentVideos: cleanedVideos
    });
    
    await newBlog.save();
    
    res.status(201).json({
      message: 'Blog post created successfully',
      blog: newBlog
    });
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({ message: error.message });
  }
});

  // Add image to blog content
  app.post('/api/blogs/:id/images', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { url, alt, caption, position } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: 'Image URL is required' });
      }
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check authorization
      if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to modify this blog post' });
      }
      
      // Generate unique image ID
      const imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      const newImage = {
        url,
        alt: alt || '',
        caption: caption || '',
        position: position || 'center',
        imageId
      };
      
      blog.contentImages.push(newImage);
      await blog.save();
      
      res.status(201).json({
        message: 'Image added successfully',
        image: newImage,
        imageId: imageId,
        embedCode: `[IMAGE:${imageId}]`
      });
    } catch (error) {
      console.error('Error adding image:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update content image
  app.put('/api/blogs/:id/images/:imageId', authenticateToken, async (req, res) => {
    try {
      const { id, imageId } = req.params;
      const { url, alt, caption, position } = req.body;
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check authorization
      if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to modify this blog post' });
      }
      
      const imageIndex = blog.contentImages.findIndex(img => img.imageId === imageId);
      
      if (imageIndex === -1) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      // Update image properties
      if (url) blog.contentImages[imageIndex].url = url;
      if (alt !== undefined) blog.contentImages[imageIndex].alt = alt;
      if (caption !== undefined) blog.contentImages[imageIndex].caption = caption;
      if (position) blog.contentImages[imageIndex].position = position;
      
      await blog.save();
      
      res.json({
        message: 'Image updated successfully',
        image: blog.contentImages[imageIndex]
      });
    } catch (error) {
      console.error('Error updating image:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete content image
  app.delete('/api/blogs/:id/images/:imageId', authenticateToken, async (req, res) => {
    try {
      const { id, imageId } = req.params;
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check authorization
      if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to modify this blog post' });
      }
      
      const imageIndex = blog.contentImages.findIndex(img => img.imageId === imageId);
      
      if (imageIndex === -1) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      blog.contentImages.splice(imageIndex, 1);
      await blog.save();
      
      res.json({ message: 'Image deleted successfully' });
    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all blog posts (with pagination and filtering)
app.get('/api/blogs', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      tag,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (status) {
      filter.status = status;
    } else {
      const isAuthenticated = req.user?.admin_id;
      if (!isAuthenticated) {
        filter.status = 'published';
      }
    }
    
    if (tag) {
      filter.tags = tag;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } }
      ];
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const blogs = await Blog.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'name email')
      .exec();
    
    // Process content to replace both image and video placeholders
    const processedBlogs = blogs.map(blog => {
      const blogObj = blog.toObject();
      blogObj.processedContent = processContent(blogObj.content, blogObj.contentImages, blogObj.contentVideos);
      return blogObj;
    });
    
    const total = await Blog.countDocuments(filter);
    
    res.json({
      blogs: processedBlogs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ message: error.message });
  }
});
  
  // Get a single blog post (updated to process videos)
app.get('/api/blogs/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    
    const query = isObjectId 
      ? { _id: identifier }
      : { slug: identifier };
    
    const isAuthenticated = req.user?.admin_id;
    if (!isAuthenticated) {
      query.status = 'published';
    }
    
    const blog = await Blog.findOne(query)
      .populate('author', 'name email')
      .exec();
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    const blogObj = blog.toObject();
    blogObj.processedContent = processContent(blogObj.content, blogObj.contentImages, blogObj.contentVideos);
    
    res.json(blogObj);
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update a blog post (updated to handle videos)
app.put('/api/blogs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this blog post' });
    }
    
    const allowedUpdates = ['title', 'content', 'summary', 'status', 'tags', 'featuredImage', 'contentImages', 'contentVideos'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        blog[field] = updates[field];
      }
    });
    
    // Clean up unused media if content was updated
    if (updates.content !== undefined) {
      blog.contentImages = cleanupUnusedImages(updates.content, blog.contentImages);
      blog.contentVideos = cleanupUnusedVideos(updates.content, blog.contentVideos);
    }
    
    await blog.save();
    
    const blogObj = blog.toObject();
    blogObj.processedContent = processContent(blogObj.content, blogObj.contentImages, blogObj.contentVideos);
    
    res.json({
      message: 'Blog post updated successfully',
      blog: blogObj
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({ message: error.message });
  }
});
  
  
  // Delete a blog post
  app.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find blog post
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check if user is the author or has admin rights
      if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to delete this blog post' });
      }
      
      await Blog.findByIdAndDelete(id);
      
      res.json({ message: 'Blog post deleted successfully' });
    } catch (error) {
      console.error('Error deleting blog:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
 function processContentImages(content, contentImages) {
  // Add safety checks
  if (!content || typeof content !== 'string') {
    return content || '';
  }
  
  if (!contentImages || !Array.isArray(contentImages) || contentImages.length === 0) {
    return content;
  }
  
  let processedContent = content;
  
  try {
    contentImages.forEach(image => {
      // Safety checks for image object
      if (!image || !image.imageId) {
        return; // Skip invalid image objects
      }
      
      const placeholder = `[IMAGE:${image.imageId}]`;
      
      // Check if placeholder exists in content before attempting replacement
      if (!processedContent.includes(placeholder)) {
        return; // Skip if placeholder doesn't exist
      }
      
      // Sanitize image properties to prevent injection
      const safeUrl = (image.url || '').replace(/"/g, '&quot;');
      const safeAlt = (image.alt || '').replace(/"/g, '&quot;');
      const safeCaption = (image.caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safePosition = (image.position || 'center').replace(/[^a-zA-Z-]/g, '');
      
      const imageHtml = `<div class="blog-image blog-image-${safePosition}">
  <img src="${safeUrl}" alt="${safeAlt}" loading="lazy" />
  ${safeCaption ? `<p class="image-caption">${safeCaption}</p>` : ''}
</div>`;
      
      // Replace ALL occurrences of the placeholder
      processedContent = processedContent.replace(new RegExp(escapeRegExp(placeholder), 'g'), imageHtml);
    });
    
    return processedContent;
    
  } catch (error) {
    console.error('Error processing content images:', error);
    // Return original content if processing fails
    return content;
  }
}

// Helper function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Enhanced function to clean up unused images
function cleanupUnusedImages(content, contentImages) {
  if (!content || !Array.isArray(contentImages) || contentImages.length === 0) {
    return contentImages;
  }
  
  // Filter out images that are not referenced in content
  return contentImages.filter(image => {
    if (!image || !image.imageId) {
      return false; // Remove invalid images
    }
    
    const placeholder = `[IMAGE:${image.imageId}]`;
    return content.includes(placeholder);
  });
}

  
  // Get all images for a specific blog post
  app.get('/api/blogs/:id/images', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      const blog = await Blog.findById(id);
      
      if (!blog) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      // Check authorization
      if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to view this blog post images' });
      }
      
      res.json({
        images: blog.contentImages,
        totalImages: blog.contentImages.length
      });
    } catch (error) {
      console.error('Error fetching blog images:', error);
      res.status(500).json({ message: error.message });
    }
  });




  // Video Routes for Blog Posts

// Add video to blog content
app.post('/api/blogs/:id/videos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { url, title, caption, position, autoplay, muted } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'Video URL is required' });
    }
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check authorization
    if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this blog post' });
    }
    
    // Extract video info from URL
    const videoInfo = extractVideoInfo(url);
    
    if (!videoInfo) {
      return res.status(400).json({ message: 'Invalid video URL. Currently supported: YouTube, Vimeo, Dailymotion' });
    }
    
    // Generate unique embed ID
    const embedId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const newVideo = {
      url: videoInfo.url,
      videoId: videoInfo.videoId,
      platform: videoInfo.platform,
      title: title || '',
      caption: caption || '',
      position: position || 'center',
      autoplay: autoplay || false,
      muted: muted || false,
      embedId
    };
    
    blog.contentVideos.push(newVideo);
    await blog.save();
    
    res.status(201).json({
      message: 'Video added successfully',
      video: newVideo,
      embedId: embedId,
      embedCode: `[VIDEO:${embedId}]`
    });
  } catch (error) {
    console.error('Error adding video:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update content video
app.put('/api/blogs/:id/videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, embedId } = req.params;
    const { url, title, caption, position, autoplay, muted } = req.body;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check authorization
    if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this blog post' });
    }
    
    const videoIndex = blog.contentVideos.findIndex(vid => vid.embedId === embedId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Update video properties
    if (url) {
      const videoInfo = extractVideoInfo(url);
      if (!videoInfo) {
        return res.status(400).json({ message: 'Invalid video URL' });
      }
      blog.contentVideos[videoIndex].url = videoInfo.url;
      blog.contentVideos[videoIndex].videoId = videoInfo.videoId;
      blog.contentVideos[videoIndex].platform = videoInfo.platform;
    }
    
    if (title !== undefined) blog.contentVideos[videoIndex].title = title;
    if (caption !== undefined) blog.contentVideos[videoIndex].caption = caption;
    if (position) blog.contentVideos[videoIndex].position = position;
    if (autoplay !== undefined) blog.contentVideos[videoIndex].autoplay = autoplay;
    if (muted !== undefined) blog.contentVideos[videoIndex].muted = muted;
    
    await blog.save();
    
    res.json({
      message: 'Video updated successfully',
      video: blog.contentVideos[videoIndex]
    });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete content video
app.delete('/api/blogs/:id/videos/:embedId', authenticateToken, async (req, res) => {
  try {
    const { id, embedId } = req.params;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check authorization
    if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this blog post' });
    }
    
    const videoIndex = blog.contentVideos.findIndex(vid => vid.embedId === embedId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    blog.contentVideos.splice(videoIndex, 1);
    await blog.save();
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all videos for a specific blog post
app.get('/api/blogs/:id/videos', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check authorization
    if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this blog post videos' });
    }
    
    res.json({
      videos: blog.contentVideos,
      totalVideos: blog.contentVideos.length
    });
  } catch (error) {
    console.error('Error fetching blog videos:', error);
    res.status(500).json({ message: error.message });
  }
});
// Helper Functions for Video Processing

// Extract video information from URL
function extractVideoInfo(url) {
  // YouTube URL patterns
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  
  if (youtubeMatch) {
    return {
      platform: 'youtube',
      videoId: youtubeMatch[1],
      url: url
    };
  }
  
  // Vimeo URL patterns
  const vimeoRegex = /(?:vimeo\.com\/)([0-9]+)/;
  const vimeoMatch = url.match(vimeoRegex);
  
  if (vimeoMatch) {
    return {
      platform: 'vimeo',
      videoId: vimeoMatch[1],
      url: url
    };
  }
  
  // Dailymotion URL patterns
  const dailymotionRegex = /(?:dailymotion\.com\/video\/)([a-zA-Z0-9]+)/;
  const dailymotionMatch = url.match(dailymotionRegex);
  
  if (dailymotionMatch) {
    return {
      platform: 'dailymotion',
      videoId: dailymotionMatch[1],
      url: url
    };
  }
  
  return null;
}

// Process content to replace video placeholders with embeds
function processContentVideos(content, contentVideos) {
  // Add safety checks
  if (!content || typeof content !== 'string') {
    return content || '';
  }
  
  if (!contentVideos || !Array.isArray(contentVideos) || contentVideos.length === 0) {
    return content;
  }
  
  let processedContent = content;
  
  try {
    contentVideos.forEach(video => {
      // Safety checks for video object
      if (!video || !video.embedId) {
        return; // Skip invalid video objects
      }
      
      const placeholder = `[VIDEO:${video.embedId}]`;
      
      // Check if placeholder exists in content before attempting replacement
      if (!processedContent.includes(placeholder)) {
        return; // Skip if placeholder doesn't exist
      }
      
      // Generate embed HTML based on platform
      const embedHtml = generateVideoEmbed(video);
      
      // Replace ALL occurrences of the placeholder
      processedContent = processedContent.replace(new RegExp(escapeRegExp(placeholder), 'g'), embedHtml);
    });
    
    return processedContent;
    
  } catch (error) {
    console.error('Error processing content videos:', error);
    // Return original content if processing fails
    return content;
  }
}

// Generate video embed HTML
function generateVideoEmbed(video) {
  const safeTitle = (video.title || '').replace(/"/g, '&quot;');
  const safeCaption = (video.caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safePosition = (video.position || 'center').replace(/[^a-zA-Z-]/g, '');
  
  let embedCode = '';
  
  switch (video.platform) {
    case 'youtube':
      const youtubeParams = new URLSearchParams({
        ...(video.autoplay && { autoplay: '1' }),
        ...(video.muted && { mute: '1' }),
        rel: '0',
        modestbranding: '1'
      });
      
      embedCode = `<iframe 
        width="560" 
        height="315" 
        src="https://www.youtube.com/embed/${video.videoId}?${youtubeParams}" 
        title="${safeTitle}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowfullscreen>
      </iframe>`;
      break;
      
    case 'vimeo':
      const vimeoParams = new URLSearchParams({
        ...(video.autoplay && { autoplay: '1' }),
        ...(video.muted && { muted: '1' }),
        title: '0',
        byline: '0',
        portrait: '0'
      });
      
      embedCode = `<iframe 
        width="560" 
        height="315" 
        src="https://player.vimeo.com/video/${video.videoId}?${vimeoParams}" 
        title="${safeTitle}" 
        frameborder="0" 
        allow="autoplay; fullscreen; picture-in-picture" 
        allowfullscreen>
      </iframe>`;
      break;
      
    case 'dailymotion':
      const dailymotionParams = new URLSearchParams({
        ...(video.autoplay && { autoplay: '1' }),
        ...(video.muted && { mute: '1' }),
        'ui-highlight': '444444',
        'ui-logo': '0'
      });
      
      embedCode = `<iframe 
        width="560" 
        height="315" 
        src="https://www.dailymotion.com/embed/video/${video.videoId}?${dailymotionParams}" 
        title="${safeTitle}" 
        frameborder="0" 
        allow="autoplay; fullscreen" 
        allowfullscreen>
      </iframe>`;
      break;
      
    default:
      return `<p class="video-error">Unsupported video platform: ${video.platform}</p>`;
  }
  
  return `<div class="blog-video blog-video-${safePosition}">
    <div class="video-wrapper">
      ${embedCode}
    </div>
    ${safeCaption ? `<p class="video-caption">${safeCaption}</p>` : ''}
  </div>`;
}

// Clean up unused videos
function cleanupUnusedVideos(content, contentVideos) {
  if (!content || !Array.isArray(contentVideos) || contentVideos.length === 0) {
    return contentVideos;
  }
  
  // Filter out videos that are not referenced in content
  return contentVideos.filter(video => {
    if (!video || !video.embedId) {
      return false; // Remove invalid videos
    }
    
    const placeholder = `[VIDEO:${video.embedId}]`;
    return content.includes(placeholder);
  });
}

// Updated processContent function to handle both images and videos
function processContent(content, contentImages, contentVideos) {
  let processedContent = content;
  
  // Process images first
  processedContent = processContentImages(processedContent, contentImages);
  
  // Process videos
  processedContent = processContentVideos(processedContent, contentVideos);
  
  return processedContent;
}

const MessageSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Name is required']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    message: {
      type: String,
      required: [true, 'Message content is required']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'replied'],
      default: 'unread'
    },
    replied: {
      type: Boolean,
      default: false
    }
});

const Message = mongoose.model('Message', mongoose.models.Message || MessageSchema);

// Reply Schema
const ReplySchema = new mongoose.Schema({
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true
    },
    replyContent: {
      type: String,
      required: [true, 'Reply content is required']
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    repliedAt: {
      type: Date,
      default: Date.now
    }
});

const Reply = mongoose.model('Reply', mongoose.models.Reply || ReplySchema);

// Professional Email Templates
const getConfirmationEmailTemplate = (name, message) => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Message Confirmation - Thank You</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background-color: #ecf0f1;
            padding: 20px;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #bdc3c7;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
          }
          .header h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: 1px;
          }
          .header p {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 300;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 25px;
          }
          .main-text {
            font-size: 16px;
            color: #34495e;
            margin-bottom: 25px;
            line-height: 1.7;
          }
          .message-preview {
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 25px;
            margin: 25px 0;
          }
          .message-preview h3 {
            font-size: 16px;
            margin-bottom: 15px;
            font-weight: 600;
            color: #2c3e50;
          }
          .message-text {
            font-style: italic;
            line-height: 1.7;
            color: #5d6d7e;
          }
          .info-section {
            background-color: #f1f2f6;
            border: 1px solid #ddd;
            padding: 25px;
            margin: 30px 0;
          }
          .info-item {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            padding: 15px;
            background-color: white;
            border-left: 3px solid #3498db;
          }
          .info-item:last-child {
            margin-bottom: 0;
          }
          .info-icon {
            width: 40px;
            height: 40px;
            background-color: #3498db;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-weight: bold;
          }
          .info-content h4 {
            color: #2c3e50;
            margin-bottom: 5px;
            font-weight: 600;
          }
          .info-content p {
            color: #7f8c8d;
            font-size: 14px;
          }
          .cta-section {
            background-color: #ecf0f1;
            padding: 30px;
            text-align: center;
            margin: 25px 0;
            border: 1px solid #bdc3c7;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 15px;
            transition: all 0.3s ease;
          }
          .cta-button:hover {
            background: linear-gradient(135deg, #2980b9 0%, #21618c 100%);
          }
          .footer {
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }
          .signature {
            color: #2c3e50;
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 10px;
          }
          .disclaimer {
            color: #95a5a6;
            font-size: 12px;
            margin-top: 20px;
            line-height: 1.4;
          }
          @media (max-width: 600px) {
            .email-container {
              margin: 10px;
            }
            .header, .content, .footer {
              padding: 25px 20px;
            }
            .header h1 {
              font-size: 24px;
            }
            .info-item {
              flex-direction: column;
              text-align: center;
            }
            .info-icon {
              margin-right: 0;
              margin-bottom: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>MESSAGE CONFIRMATION</h1>
            <p>Your inquiry has been successfully received</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Dear ${name},
            </div>
            
            <p class="main-text">Thank you for contacting me. I have received your message and appreciate your interest. I will review your inquiry and respond as soon as possible.</p>
            
            <div class="message-preview">
              <h3>Your Message Summary:</h3>
              <div class="message-text">"${message}"</div>
            </div>
            
            <div class="info-section">
             
                
                <div class="info-content">
                  <h4>Response Timeline</h4>
                  <p>You can expect a response within 24-48 business hours</p>
                </div>
              
             
            </div>
          </div>
          
          <div class="footer">
            <div class="signature">
              <p>Best regards,<br/>
              <strong>Aaditiya Tyagi</strong><br/>
            <p class="disclaimer">
              This is an automated confirmation email. Please do not reply to this message.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
};

const getAdminNotificationTemplate = (name, email, message) => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Form Submission</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #ecf0f1;
            padding: 20px;
            line-height: 1.6;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border: 1px solid #bdc3c7;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: 1px;
          }
          .priority-badge {
            background-color: rgba(255, 255, 255, 0.2);
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.5px;
          }
          .content {
            padding: 40px 30px;
          }
          .alert-section {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin-bottom: 25px;
          }
          .alert-section p {
            color: #856404;
            font-weight: 500;
          }
          .contact-card {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 25px;
            margin: 20px 0;
          }
          .contact-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
          }
          .contact-avatar {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
            margin-right: 15px;
          }
          .contact-details h3 {
            color: #2c3e50;
            font-size: 18px;
            margin-bottom: 5px;
          }
          .contact-details p {
            color: #7f8c8d;
            font-size: 14px;
          }
          .message-section {
            background-color: #ffffff;
            border: 1px solid #e9ecef;
            padding: 25px;
            margin: 20px 0;
          }
          .message-header {
            color: #2c3e50;
            font-weight: 600;
            margin-bottom: 15px;
            font-size: 16px;
            border-bottom: 1px solid #ecf0f1;
            padding-bottom: 10px;
          }
          .message-content {
            color: #34495e;
            line-height: 1.7;
            font-size: 15px;
            background-color: #f8f9fa;
            padding: 20px;
            border-left: 4px solid #3498db;
          }
          .metadata {
            background-color: #e9ecef;
            padding: 15px;
            margin: 20px 0;
            font-size: 12px;
            color: #6c757d;
          }
          .metadata-item {
            margin-bottom: 5px;
          }
          .metadata-item:last-child {
            margin-bottom: 0;
          }
          .action-section {
            background-color: #f1f3f4;
            padding: 25px;
            margin: 25px 0;
            text-align: center;
          }
          .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 20px;
          }
          .btn {
            padding: 12px 20px;
            border: none;
            font-weight: 600;
            text-decoration: none;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
          }
          .btn-primary {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
          }
          .btn-secondary {
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
            color: white;
          }
          .btn:hover {
            opacity: 0.9;
          }
          .footer {
            background-color: #2c3e50;
            color: white;
            padding: 25px;
            text-align: center;
          }
          .footer h3 {
            margin-bottom: 10px;
            font-size: 16px;
          }
          .footer p {
            opacity: 0.8;
            font-size: 14px;
          }
          @media (max-width: 600px) {
            .action-buttons {
              grid-template-columns: 1fr;
            }
            .contact-header {
              flex-direction: column;
              text-align: center;
            }
            .contact-avatar {
              margin: 0 0 15px 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>NEW MESSAGE RECEIVED</h1>
            <div class="priority-badge">ACTION REQUIRED</div>
          </div>
          
          <div class="content">
            <div class="alert-section">
              <p><strong>New Contact:</strong> A new message has been submitted through your contact form and requires your attention.</p>
            </div>
            
            <div class="contact-card">
              <div class="contact-header">
                <div class="contact-avatar">${name.charAt(0).toUpperCase()}</div>
                <div class="contact-details">
                  <h3>${name}</h3>
                  <p>Email: ${email}</p>
                </div>
              </div>
            </div>
            
            <div class="message-section">
              <div class="message-header">Message Content</div>
              <div class="message-content">${message}</div>
            </div>
            
            <div class="metadata">
              <div class="metadata-item"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</div>
              <div class="metadata-item"><strong>Source:</strong> Contact Form</div>
              <div class="metadata-item"><strong>Status:</strong> Pending Response</div>
            </div>
            
            <div class="action-section">
              <h3>Required Actions</h3>
              <div class="action-buttons">
                <a href="https://connectwithaaditiyaadmin.onrender.com/message" class="btn btn-primary">View in Admin Panel</a>
                <a href="mailto:${email}" class="btn btn-secondary">Reply via Email</a>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <h3>System Notification</h3>
            <p>Please log in to your admin panel to manage this message and update its status.</p>
          </div>
        </div>
      </body>
      </html>
    `;
};

const getReplyEmailTemplate = (name, originalMessage, replyContent) => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Response from Aaditiya Tyagi</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #ecf0f1;
            padding: 20px;
            line-height: 1.6;
          }
          .email-container {
            max-width: 650px;
            margin: 0 auto;
            background: white;
            border: 1px solid #bdc3c7;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #34495e;
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 26px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: 1px;
          }
          .header p {
            opacity: 0.9;
            font-size: 16px;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 25px;
          }
          .intro-text {
            font-size: 16px;
            color: #34495e;
            margin-bottom: 30px;
            line-height: 1.7;
          }
          .conversation-section {
            margin: 30px 0;
          }
          .message-block {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            padding: 25px;
            margin: 20px 0;
          }
          .original-message {
            border-left: 4px solid #34495e;
          }
          .reply-message {
            border-left: 4px solid  #34495e;
          }
          .message-header {
            color: #2c3e50;
            font-weight: 600;
            margin-bottom: 15px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #ecf0f1;
            padding-bottom: 8px;
          }
          .message-content {
            color: #34495e;
            line-height: 1.8;
            font-size: 15px;
          }
          .signature-section {
            background-color: #f1f2f6;
            padding: 30px;
            margin: 3px 0;
            border: 1px solid #ddd;
          }
          .signature {
            color: #2c3e50;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
          }
          .title {
            color: #7f8c8d;
            font-style: italic;
            margin-top: 5px;
            font-size: 14px;
          }
          .contact-section {
            background-color: #ecf0f1;
            padding: 25px;
            margin: 25px 0;
            text-align: center;
            border: 1px solid #bdc3c7;
          }
          .contact-section h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 16px;
          }
          .contact-info {
            color:#ddd;
            font-size: 14px;
            line-height: 1.6;
          }
          .footer {
            background-color: #34495e;
            color: white;
            padding: 30px;
            text-align: center;
          }
          .footer-content {
            max-width: 400px;
            margin: 0 auto;
          }
          .footer h3 {
            margin-bottom: 15px;
            font-size: 18px;
            font-weight: 600;
          }
          .footer p {
            opacity: 0.9;
            line-height: 1.6;
            font-size: 14px;
          }
          .divider {
            height: 1px;
            background-color: #bdc3c7;
            margin: 30px 0;
          }
          @media (max-width: 600px) {
            .email-container {
              margin: 10px;
            }
            .header, .content {
              padding: 25px 20px;
            }
            .header h1 {
              font-size: 22px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>RESPONSE TO YOUR QUERY</h1>
            <p>Thank you for your patience</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Dear ${name},
            </div>
            
            <p class="intro-text">
              Thank you for reaching out to me. I have carefully reviewed your message and am pleased to provide you with a detailed response below.
            </p>
            
            <div class="conversation-section">
              <div class="message-block original-message">
                <div class="message-header">Your Original Message</div>
                <div class="message-content">${originalMessage}</div>
              </div>
              
              <div class="message-block reply-message">
                <div class="message-header">My Response</div>
                <div class="message-content">${replyContent}</div>
              </div>
            </div>
            
            <div class="divider"></div>
            
            <p class="intro-text">
              If you have any follow-up questions or would like to discuss this matter further, please don't hesitate to contact me.
            </p>
          </div>
          
          <div class="signature-section">
            <div class="signature">
              <strong>Best Regards</strong>
              <div class="title">Aaditiya Tyagi</div>
            </div>
          </div>
          
         
          
          <div class="footer">
            <div class="footer-content">
              <h3>Thank You</h3>
              <p>I appreciate your time and interest. I look forward to any future opportunities to assist you with your inquiries or discuss potential collaborations.</p>
            <div class="contact-info">
              For future correspondence, please use the same contact method<br/>
              or visit my website for additional contact options.
            </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
};
  // Contact Routes to add to your app.js
  // Submit a new contact message (unchanged for non-admin users)
 app.post('/api/contact', async (req, res) => {
    try {
      const { name, email, message } = req.body;
      
      // Validate inputs
      if (!name || !email || !message) {
        return res.status(400).json({ message: 'All fields are required' });
      }
      
      // Validate email format
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please provide a valid email' });
      }
      
      // Create new message
      const newMessage = new Message({
        name,
        email,
        message
      });
      
      await newMessage.save();
      
      // Send enhanced confirmation email to user
      const confirmationEmail = getConfirmationEmailTemplate(name, message);
      await sendEmail(email, 'Thank You for Reaching Out - I\'ll Be in Touch Soon!', confirmationEmail);
      
      // Send enhanced notification to admin
      const adminNotification = getAdminNotificationTemplate(name, email, message);
      
      // Find admin email - assuming first admin or use a dedicated notifications email
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
  app.get('/api/admin/messages', authenticateToken, async (req, res) => {
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
  app.get('/api/admin/messages/:id', authenticateToken, async (req, res) => {
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
  app.get('/api/admin/messages/email/:email', authenticateToken, async (req, res) => {
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
  
  app.post('/api/admin/messages/:id/reply', authenticateToken, async (req, res) => {
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
  app.put('/api/admin/messages/:id/status', authenticateToken, async (req, res) => {
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
  app.delete('/api/admin/messages/:id', authenticateToken, async (req, res) => {
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
  app.put('/api/admin/messages/mark-all-read', authenticateToken, async (req, res) => {
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
  app.put('/api/admin/messages/mark-all-unread', authenticateToken, async (req, res) => {
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
  app.delete('/api/admin/messages', authenticateToken, async (req, res) => {
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
  app.delete('/api/admin/messages/email/:email', authenticateToken, async (req, res) => {
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
  app.put('/api/admin/messages/email/:email/mark-read', authenticateToken, async (req, res) => {
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
  app.put('/api/admin/messages/email/:email/mark-unread', authenticateToken, async (req, res) => {
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
  app.get('/api/admin/message-stats', authenticateToken, async (req, res) => {
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
 app.get('/api/admin/message-analytics', authenticateToken, async (req, res) => {
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
  app.post('/api/admin/messages/bulk-action', authenticateToken, async (req, res) => {
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
  app.get('/api/admin/messages/search', authenticateToken, async (req, res) => {
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

  

  const ReactionSchema = new mongoose.Schema({
    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Blog',
      required: true
    },
    type: {
      type: String,
      enum: ['like', 'dislike'],
      required: true
    },
    user: {
      name: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  // Compound index to prevent multiple reactions from the same user on the same blog
  ReactionSchema.index({ blog: 1, 'user.email': 1 }, { unique: true });
  
  const Reaction = mongoose.model('Reaction', ReactionSchema);
  
  const CommentSchema = new mongoose.Schema({
  blog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    required: true
  },
  user: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  // New field to identify author comments
  isAuthorComment: {
    type: Boolean,
    default: false
  },
  // New fields for replies
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null // null means it's a top-level comment
  },
  repliesCount: {
    type: Number,
    default: 0
  },
  // New fields for comment reactions
  reactionCounts: {
    likes: {
      type: Number,
      default: 0
    },
    dislikes: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Comment = mongoose.model('Comment', CommentSchema);
  const CommentReactionSchema = new mongoose.Schema({
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'dislike'],
    required: true
  },
  user: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent multiple reactions from the same user on the same comment
CommentReactionSchema.index({ comment: 1, 'user.email': 1 }, { unique: true });

const CommentReaction = mongoose.model('CommentReaction', CommentReactionSchema);
// PUBLIC ROUTE: Add reply to a comment
app.post(
  '/api/comments/:commentId/replies',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('content').trim().notEmpty().withMessage('Reply content is required')
      .isLength({ max: 1000 }).withMessage('Reply cannot exceed 1000 characters')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { name, email, content } = req.body;

      // Check if parent comment exists
      const parentComment = await Comment.findById(commentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }

      // Check if parent comment is approved
      if (parentComment.status !== 'approved') {
        return res.status(400).json({ message: 'Cannot reply to unapproved comment' });
      }

      // Create new reply
      const newReply = new Comment({
        blog: parentComment.blog,
        user: { name, email },
        content,
        parentComment: commentId
      });

      await newReply.save();
      
      // Update parent comment's replies count
      await Comment.findByIdAndUpdate(commentId, { $inc: { repliesCount: 1 } });

      res.status(201).json({ 
        message: 'Reply added successfully',
        reply: newReply
      });
    } catch (error) {
      console.error('Error adding reply:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// AUTHOR ROUTE: Add author reply to a comment
app.post(
  '/api/comments/:commentId/author-reply',
  authenticateToken,
  [
    body('content').trim().notEmpty().withMessage('Reply content is required')
      .isLength({ max: 1000 }).withMessage('Reply cannot exceed 1000 characters')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { content } = req.body;

      // Check if parent comment exists
      const parentComment = await Comment.findById(commentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }

      // Check if parent comment is approved
      if (parentComment.status !== 'approved') {
        return res.status(400).json({ message: 'Cannot reply to unapproved comment' });
      }

      // Create new author reply
      const newReply = new Comment({
        blog: parentComment.blog,
        user: { 
          name: req.user.name || 'Aaditiya Tyagi',
          email: req.user.email
        },
        content,
        parentComment: commentId,
        isAuthorComment: true,
        status: 'approved' // Author replies are auto-approved
      });

      await newReply.save();
      
      // Update parent comment's replies count
      await Comment.findByIdAndUpdate(commentId, { $inc: { repliesCount: 1 } });

      res.status(201).json({ 
        message: 'Author reply added successfully',
        reply: newReply
      });
    } catch (error) {
      console.error('Error adding author reply:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Get replies for a comment
app.get('/api/comments/:commentId/replies', async (req, res) => {
  try {
    const { commentId } = req.params;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get approved replies
    const replies = await Comment.find({ 
      parentComment: commentId,
      status: 'approved'
    })
    .sort({ createdAt: 1 }) // Replies in chronological order
    .skip(skip)
    .limit(limit);
    
    const total = await Comment.countDocuments({
      parentComment: commentId,
      status: 'approved'
    });
    
    res.status(200).json({
      replies,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Add/Remove reaction to a comment
app.post(
  '/api/comments/:commentId/reactions',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('type').isIn(['like', 'dislike']).withMessage('Type must be like or dislike')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { name, email, type } = req.body;

      // Check if comment exists and is approved
      const comment = await Comment.findOne({ _id: commentId, status: 'approved' });
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found or not approved' });
      }

      // Check if user already reacted to this comment
      const existingReaction = await CommentReaction.findOne({
        comment: commentId,
        'user.email': email
      });

      // If reaction exists but is of different type, update it
      if (existingReaction) {
        if (existingReaction.type === type) {
          // User is toggling off their reaction
          await CommentReaction.deleteOne({ _id: existingReaction._id });
          
          // Update comment reaction counts
          if (type === 'like') {
            await Comment.findByIdAndUpdate(commentId, { $inc: { 'reactionCounts.likes': -1 } });
          } else {
            await Comment.findByIdAndUpdate(commentId, { $inc: { 'reactionCounts.dislikes': -1 } });
          }
          
          return res.status(200).json({ 
            message: `${type} removed successfully`,
            reactionRemoved: true
          });
        } else {
          // User is changing reaction type
          existingReaction.type = type;
          await existingReaction.save();
          
          // Update comment reaction counts
          if (type === 'like') {
            await Comment.findByIdAndUpdate(commentId, { 
              $inc: { 
                'reactionCounts.likes': 1,
                'reactionCounts.dislikes': -1
              } 
            });
          } else {
            await Comment.findByIdAndUpdate(commentId, { 
              $inc: { 
                'reactionCounts.likes': -1,
                'reactionCounts.dislikes': 1
              } 
            });
          }
          
          return res.status(200).json({
            message: `Reaction changed to ${type}`,
            reaction: existingReaction
          });
        }
      }

      // Create new reaction
      const newReaction = new CommentReaction({
        comment: commentId,
        type,
        user: { name, email }
      });

      await newReaction.save();
      
      // Update comment reaction counts
      if (type === 'like') {
        await Comment.findByIdAndUpdate(commentId, { $inc: { 'reactionCounts.likes': 1 } });
      } else {
        await Comment.findByIdAndUpdate(commentId, { $inc: { 'reactionCounts.dislikes': 1 } });
      }

      res.status(201).json({ 
        message: `${type} added successfully`,
        reaction: newReaction
      });
    } catch (error) {
      if (error.code === 11000) {
        // Handle duplicate key error
        return res.status(400).json({ message: 'You have already reacted to this comment' });
      }
      console.error('Error adding comment reaction:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Get user's reaction to a comment
app.get('/api/comments/:commentId/reactions/user', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const reaction = await CommentReaction.findOne({
      comment: commentId,
      'user.email': email
    });
    
    if (!reaction) {
      return res.status(200).json({ hasReacted: false });
    }
    
    res.status(200).json({
      hasReacted: true,
      reactionType: reaction.type
    });
  } catch (error) {
    console.error('Error fetching user comment reaction:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get reaction counts for a comment
app.get('/api/comments/:commentId/reactions/count', async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const comment = await Comment.findById(commentId, 'reactionCounts');
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    res.status(200).json({
      likes: comment.reactionCounts.likes || 0,
      dislikes: comment.reactionCounts.dislikes || 0
    });
  } catch (error) {
    console.error('Error fetching comment reaction counts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
  // Author route: Add author comment (requires authentication)
app.post(
  '/api/blogs/:blogId/author-comment',
  authenticateToken, // Assuming you have auth middleware
  [
    body('content').trim().notEmpty().withMessage('Comment content is required')
      .isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { blogId } = req.params;
      const { content } = req.body;

      // Check if blog exists
      const blog = await Blog.findById(blogId);
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }

      // Create new author comment
      const newComment = new Comment({
        blog: blogId,
        user: { 
          name: req.user.name || 'Aaditiya Tyagi', // Get from authenticated user
          email: req.user.email // Get from authenticated user
        },
        content,
        isAuthorComment: true,
        status: 'approved' // Author comments are auto-approved
      });

      await newComment.save();
      
      // Update blog comments count
      await Blog.findByIdAndUpdate(blogId, { $inc: { commentsCount: 1 } });

      res.status(201).json({ 
        message: 'Author comment added successfully',
        comment: newComment
      });
    } catch (error) {
      console.error('Error adding author comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Author route: Get author comments for a blog
app.get('/api/blogs/:blogId/author-comments', authenticateToken, async (req, res) => {
  try {
    const { blogId } = req.params;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get only author comments
    const comments = await Comment.find({ 
      blog: blogId,
      isAuthorComment: true
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Comment.countDocuments({
      blog: blogId,
      isAuthorComment: true
    });
    
    res.status(200).json({
      comments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching author comments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Author route: Delete author comment
app.delete('/api/author-comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if it's an author comment
    if (!comment.isAuthorComment) {
      return res.status(403).json({ message: 'Not an author comment' });
    }

    // If it's a reply, update parent comment's replies count
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });
    }
    
    // If it's a top-level comment, update blog comments count
    if (!comment.parentComment) {
      await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      
      // Delete all replies to this comment
      const repliesToDelete = await Comment.find({ parentComment: commentId });
      for (const reply of repliesToDelete) {
        // Delete reactions for each reply
        await CommentReaction.deleteMany({ comment: reply._id });
      }
      await Comment.deleteMany({ parentComment: commentId });
    }

    // Delete reactions for this comment
    await CommentReaction.deleteMany({ comment: commentId });
    
    await Comment.deleteOne({ _id: commentId });
    
    res.status(200).json({ message: 'Author comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting author comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
  app.post(
    '/api/blogs/:blogId/reactions',
    [
      body('name').trim().notEmpty().withMessage('Name is required'),
      body('email').isEmail().withMessage('Valid email is required'),
      body('type').isIn(['like', 'dislike']).withMessage('Type must be like or dislike')
    ],
    async (req, res) => {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      try {
        const { blogId } = req.params;
        const { name, email, type } = req.body;
  
        // Check if blog exists
        const blog = await Blog.findById(blogId);
        if (!blog) {
          return res.status(404).json({ message: 'Blog not found' });
        }
  
        // Check if user already reacted to this blog
        const existingReaction = await Reaction.findOne({
          blog: blogId,
          'user.email': email
        });
  
        // If reaction exists but is of different type, update it
        if (existingReaction) {
          if (existingReaction.type === type) {
            // User is toggling off their reaction
            await Reaction.deleteOne({ _id: existingReaction._id });
            
            // Update blog reaction counts
            if (type === 'like') {
              await Blog.findByIdAndUpdate(blogId, { $inc: { 'reactionCounts.likes': -1 } });
            } else {
              await Blog.findByIdAndUpdate(blogId, { $inc: { 'reactionCounts.dislikes': -1 } });
            }
            
            return res.status(200).json({ 
              message: `${type} removed successfully`,
              reactionRemoved: true
            });
          } else {
            // User is changing reaction type
            existingReaction.type = type;
            await existingReaction.save();
            
            // Update blog reaction counts
            if (type === 'like') {
              await Blog.findByIdAndUpdate(blogId, { 
                $inc: { 
                  'reactionCounts.likes': 1,
                  'reactionCounts.dislikes': -1
                } 
              });
            } else {
              await Blog.findByIdAndUpdate(blogId, { 
                $inc: { 
                  'reactionCounts.likes': -1,
                  'reactionCounts.dislikes': 1
                } 
              });
            }
            
            return res.status(200).json({
              message: `Reaction changed to ${type}`,
              reaction: existingReaction
            });
          }
        }
  
        // Create new reaction
        const newReaction = new Reaction({
          blog: blogId,
          type,
          user: { name, email }
        });
  
        await newReaction.save();
        
        // Update blog reaction counts
        if (type === 'like') {
          await Blog.findByIdAndUpdate(blogId, { $inc: { 'reactionCounts.likes': 1 } });
        } else {
          await Blog.findByIdAndUpdate(blogId, { $inc: { 'reactionCounts.dislikes': 1 } });
        }
  
        res.status(201).json({ 
          message: `${type} added successfully`,
          reaction: newReaction
        });
      } catch (error) {
        if (error.code === 11000) {
          // Handle duplicate key error
          return res.status(400).json({ message: 'You have already reacted to this blog post' });
        }
        console.error('Error adding reaction:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
      }
    }
  );
  
  // Get user's reaction to a blog
  app.get('/api/blogs/:blogId/reactions/user', async (req, res) => {
    try {
      const { blogId } = req.params;
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      const reaction = await Reaction.findOne({
        blog: blogId,
        'user.email': email
      });
      
      if (!reaction) {
        return res.status(200).json({ hasReacted: false });
      }
      
      res.status(200).json({
        hasReacted: true,
        reactionType: reaction.type
      });
    } catch (error) {
      console.error('Error fetching user reaction:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Get reaction counts for a blog
  app.get('/api/blogs/:blogId/reactions/count', async (req, res) => {
    try {
      const { blogId } = req.params;
      
      const blog = await Blog.findById(blogId, 'reactionCounts');
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }
      
      res.status(200).json({
        likes: blog.reactionCounts.likes || 0,
        dislikes: blog.reactionCounts.dislikes || 0
      });
    } catch (error) {
      console.error('Error fetching reaction counts:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Admin route: Get detailed reactions data (requires authentication)
  app.get('/api/admin/blogs/:blogId/reactions', authenticateToken, async (req, res) => {
    try {
      const { blogId } = req.params;
      
      const reactions = await Reaction.find({ blog: blogId })
        .sort({ createdAt: -1 });
      
      const counts = {
        likes: reactions.filter(r => r.type === 'like').length,
        dislikes: reactions.filter(r => r.type === 'dislike').length,
        total: reactions.length
      };
      
      res.status(200).json({
        counts,
        reactions
      });
    } catch (error) {
      console.error('Error fetching reactions:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  

  
  // routes/commentRoutes.js
  // Add a comment
  app.post(
    '/api/blogs/:blogId/comments',
    [
      body('name').trim().notEmpty().withMessage('Name is required'),
      body('email').isEmail().withMessage('Valid email is required'),
      body('content').trim().notEmpty().withMessage('Comment content is required')
        .isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
    ],
    async (req, res) => {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      try {
        const { blogId } = req.params;
        const { name, email, content } = req.body;
  
        // Check if blog exists
        const blog = await Blog.findById(blogId);
        if (!blog) {
          return res.status(404).json({ message: 'Blog not found' });
        }
  
        // Create new comment
        const newComment = new Comment({
          blog: blogId,
          user: { name, email },
          content
        });
  
        await newComment.save();
        
        // Update blog comments count
        await Blog.findByIdAndUpdate(blogId, { $inc: { commentsCount: 1 } });
  
        res.status(201).json({ 
          message: 'Comment added successfully',
          comment: newComment
        });
      } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
      }
    }
  );
  app.get('/api/blogs/:blogId/comments', async (req, res) => {
  try {
    const { blogId } = req.params;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get only top-level approved comments (not replies)
    const comments = await Comment.find({ 
      blog: blogId,
      status: 'approved',
      parentComment: null // Only top-level comments
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Comment.countDocuments({
      blog: blogId,
      status: 'approved',
      parentComment: null
    });
    
    res.status(200).json({
      comments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
 
// Public route: Delete user's own comment
app.delete('/api/comments/:commentId/user', 
  [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { commentId } = req.params;
      const { email } = req.body;
      
      // Find the comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      // Check if the email matches the comment owner
      if (comment.user.email !== email) {
        return res.status(403).json({ message: 'You can only delete your own comments' });
      }

      // Prevent deletion of author comments through this route
      if (comment.isAuthorComment) {
        return res.status(403).json({ message: 'Author comments cannot be deleted through this route' });
      }

      // If it's a reply, update parent comment's replies count
      if (comment.parentComment) {
        await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });
      }
      
      // If comment was approved and is a top-level comment, update the blog comments count
      if (comment.status === 'approved' && !comment.parentComment) {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      }

      // Delete all replies to this comment if it's a top-level comment
      if (!comment.parentComment) {
        const repliesToDelete = await Comment.find({ parentComment: commentId });
        for (const reply of repliesToDelete) {
          // Delete reactions for each reply
          await CommentReaction.deleteMany({ comment: reply._id });
        }
        await Comment.deleteMany({ parentComment: commentId });
      }

      // Delete reactions for this comment
      await CommentReaction.deleteMany({ comment: commentId });
      
      await Comment.deleteOne({ _id: commentId });
      
      res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Error deleting user comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);
  
  // Admin route: Get all comments for a blog (including pending/rejected)
  app.get('/api/admin/blogs/:blogId/comments', authenticateToken, async (req, res) => {
    try {
      const { blogId } = req.params;
      
      // Pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Get all comments (status filter optional)
      const statusFilter = req.query.status ? { status: req.query.status } : {};
      
      const comments = await Comment.find({ 
        blog: blogId,
        ...statusFilter
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
      const total = await Comment.countDocuments({
        blog: blogId,
        ...statusFilter
      });
      
      res.status(200).json({
        comments,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching admin comments:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Admin route: Update comment status
  app.patch('/api/admin/comments/:commentId', authenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      const { status } = req.body;
      
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      // If comment was not approved before but is now being approved, increment the count
      if (comment.status !== 'approved' && status === 'approved') {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: 1 } });
      }
      
      // If comment was approved before but is now being unapproved, decrement the count
      if (comment.status === 'approved' && status !== 'approved') {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      }
      
      comment.status = status;
      await comment.save();
      
      res.status(200).json({ 
        message: 'Comment status updated',
        comment
      });
    } catch (error) {
      console.error('Error updating comment status:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Admin route: Delete comment
  app.delete('/api/admin/comments/:commentId', authenticateToken, async (req, res) => {
    try {
      const { commentId } = req.params;
      
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }
      
      // If comment was approved, update the count on blog
      if (comment.status === 'approved') {
        await Blog.findByIdAndUpdate(comment.blog, { $inc: { commentsCount: -1 } });
      }
      
      await Comment.deleteOne({ _id: commentId });
      
      res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
// Add these packages at the top if not already present
const axios = require('axios');
const https = require('https');

// Enhanced keep-alive function
const keepAlive = () => {
  const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const appUrl = process.env.APP_URL || 'connectwithaaditiya.onrender.com';
  const urls = [
    `https://${appUrl}/api/ping`,
    // Add any other URLs you want to ping, like:
    `https://${appUrl}/api/blogs?limit=1`,
  ];
  
  console.log(`Setting up keep-alive pings every ${PING_INTERVAL/60000} minutes to prevent sleep`);

  // Create an interval that rotates through different endpoints
  setInterval(async () => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] Sending keep-alive pings...`);
    
    // Internal ping - won't go out to the network but keeps the process active
    const internalRes = await axios.get(`http://localhost:${PORT}/api/ping`, {
      headers: { 'Connection': 'keep-alive' }
    }).catch(err => {
      console.error('Internal ping failed:', err.message);
      return { status: 'error' };
    });
    
    console.log(`Internal ping status: ${internalRes.status || 'failed'}`);
    
    // External ping using multiple strategies
    for (const url of urls) {
      try {
        // Strategy 1: Using axios
        const res = await axios.get(url, {
          headers: { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
          timeout: 10000 // 10 second timeout
        });
        console.log(`Ping to ${url} succeeded with status ${res.status}`);
      } catch (err) {
        console.error(`Axios ping to ${url} failed:`, err.message);
        
        // Strategy 2: Fallback to native https request
        try {
          await new Promise((resolve, reject) => {
            const req = https.get(url, {
              headers: { 'User-Agent': 'KeepAliveBot/1.0', 'Connection': 'keep-alive' },
              timeout: 10000
            }, (res) => {
              console.log(`Native ping to ${url} succeeded with status ${res.statusCode}`);
              res.on('data', () => {}); // Drain the response
              res.on('end', resolve);
            });
            
            req.on('error', (e) => {
              console.error(`Native ping to ${url} failed:`, e.message);
              reject(e);
            });
            
            req.on('timeout', () => {
              req.destroy();
              reject(new Error('Timeout'));
            });
          });
        } catch (e) {
          console.error(`All ping strategies to ${url} failed`);
        }
      }
    }
  }, PING_INTERVAL);
  
  // Also add an immediate ping to wake up right away
  setTimeout(() => {
    console.log('Sending initial wake-up ping...');
    axios.get(`https://${appUrl}/api/ping`).catch(err => {
      console.log('Initial ping failed, but process will continue');
    });
  }, 5000); // Wait 5 seconds after server start
};

// Add a ping endpoint
app.get('/api/ping', (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Ping received from ${req.ip}`);
  res.status(200).json({ message: 'Server is alive!', timestamp });
});
const multer = require('multer');

// Configure multer for file uploads - store in memory
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Videos
    'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm',
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Spreadsheets
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Presentations
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text files
    'text/plain', 'text/csv',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    // Others
    'application/json', 'application/xml'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not supported`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file for videos
    files: 10 // Maximum 10 files
  }
});
// Image Post Schema
const imagePostSchema = new mongoose.Schema({
  caption: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    data: Buffer,
    contentType: String
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  hideReactionCount: {
    type: Boolean,
    default: false
  },
  reactionCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Image Post Reaction Schema
const imageReactionSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImagePost',
    required: true
  },
  user: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    deviceId: {
      type: String,
      required: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent multiple reactions from the same user/device on the same post
imageReactionSchema.index({ post: 1, 'user.email': 1 }, { unique: true });
imageReactionSchema.index({ post: 1, 'user.deviceId': 1 }, { unique: true });

// Image Post Comment Schema
const imageCommentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImagePost',
    required: true
  },
  user: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    deviceId: {
      type: String,
      required: true
    }
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['active', 'hidden'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create models
const ImagePost = mongoose.model('ImagePost', imagePostSchema);
const ImageReaction = mongoose.model('ImageReaction', imageReactionSchema);
const ImageComment = mongoose.model('ImageComment', imageCommentSchema);

// Helper middleware to extract device ID
const extractDeviceId = (req, res, next) => {
  // Use user-agent and IP as a simple device identifier
  // In production, you might use a more sophisticated approach
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Create a hash of these values to use as device ID
  const deviceId = require('crypto')
    .createHash('md5')
    .update(userAgent + ip)
    .digest('hex');
  
  req.deviceId = deviceId;
  next();
};

// ADMIN ROUTES
// Create a new image post (admin only)
app.post('/api/admin/image-posts', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { caption, hideReactionCount } = req.body;
    
    // Validate image is provided
    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }
    
    // Create new image post
    const newImagePost = new ImagePost({
      caption,
      image: {
        data: req.file.buffer,
        contentType: req.file.mimetype
      },
      author: req.user.admin_id,
      hideReactionCount: hideReactionCount === 'true' || hideReactionCount === true
    });
    
    await newImagePost.save();
    
    res.status(201).json({
      message: 'Image post created successfully',
      post: {
        id: newImagePost._id,
        caption: newImagePost.caption,
        hideReactionCount: newImagePost.hideReactionCount,
        createdAt: newImagePost.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating image post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update an image post (admin only)
app.put('/api/admin/image-posts/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, hideReactionCount } = req.body;
    
    // Find post
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    // Check if user is authorized (author or admin)
    if (post.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }
    
    // Update fields
    if (caption) post.caption = caption;
    if (hideReactionCount !== undefined) {
      post.hideReactionCount = hideReactionCount === 'true' || hideReactionCount === true;
    }
    
    // Update image if provided
    if (req.file) {
      post.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype
      };
    }
    
    post.updatedAt = new Date();
    await post.save();
    
    res.json({
      message: 'Image post updated successfully',
      post: {
        id: post._id,
        caption: post.caption,
        hideReactionCount: post.hideReactionCount,
        updatedAt: post.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating image post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete an image post (admin only)
app.delete('/api/admin/image-posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find post
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    // Check if user is authorized (author or admin)
    if (post.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }
    
    // Delete post and associated reactions and comments
    await ImageReaction.deleteMany({ post: id });
    await ImageComment.deleteMany({ post: id });
    await ImagePost.findByIdAndDelete(id);
    
    res.json({ message: 'Image post and associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting image post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all image posts for admin dashboard
app.get('/api/admin/image-posts', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get posts with reaction and comment counts
    const posts = await ImagePost.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-image.data') // Exclude binary data for listing
      .populate('author', 'name email');
    
    const total = await ImagePost.countDocuments();
    
    res.json({
      posts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching image posts for admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single image post with admin details
app.get('/api/admin/image-posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ImagePost.findById(id)
      .populate('author', 'name email');
    
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    // Convert Buffer to Base64 for easy display
    const imageData = post.image.data
      ? `data:${post.image.contentType};base64,${post.image.data.toString('base64')}`
      : null;
    
    // Get reactions and comments
    const reactions = await ImageReaction.find({ post: id }).countDocuments();
    const comments = await ImageComment.find({ post: id }).sort({ createdAt: -1 });
    
    res.json({
      post: {
        ...post._doc,
        image: imageData
      },
      reactions,
      comments
    });
  } catch (error) {
    console.error('Error fetching image post details for admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Admin manage comments
app.patch('/api/admin/image-comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'hidden'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    const comment = await ImageComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    comment.status = status;
    await comment.save();
    
    // Update the post's comment count if comment is hidden
    if (status === 'hidden' && comment.status === 'active') {
      await ImagePost.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });
    } else if (status === 'active' && comment.status === 'hidden') {
      await ImagePost.findByIdAndUpdate(comment.post, { $inc: { commentCount: 1 } });
    }
    
    res.json({
      message: 'Comment status updated successfully',
      comment
    });
  } catch (error) {
    console.error('Error updating comment status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Admin delete comment
app.delete('/api/admin/image-comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const comment = await ImageComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Update post's comment count if comment is active
    if (comment.status === 'active') {
      await ImagePost.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });
    }
    
    await ImageComment.findByIdAndDelete(commentId);
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUBLIC ROUTES
// Get all published image posts (public)
app.get('/api/image-posts', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get posts for public view
    const posts = await ImagePost.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-image.data') // Exclude binary data for listing
      .lean();
    
    const total = await ImagePost.countDocuments();
    
    res.json({
      posts: posts.map(post => ({
        ...post,
        // Only include reaction count if not hidden
        reactionCount: post.hideReactionCount ? null : post.reactionCount
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching public image posts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single image post (public)
app.get('/api/image-posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    // Convert Buffer to Base64 for easy display
    const imageData = post.image.data
      ? `data:${post.image.contentType};base64,${post.image.data.toString('base64')}`
      : null;
    
    // Get active comments
    const comments = await ImageComment.find({ 
      post: id,
      status: 'active'
    }).sort({ createdAt: -1 });
    
    res.json({
      post: {
        id: post._id,
        caption: post.caption,
        image: imageData,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        // Only include reaction count if not hidden
        reactionCount: post.hideReactionCount ? null : post.reactionCount,
        commentCount: post.commentCount
      },
      comments
    });
  } catch (error) {
    console.error('Error fetching public image post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Like an image post (public)
app.post('/api/image-posts/:id/react', extractDeviceId, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    const deviceId = req.deviceId;
    
    // Validate inputs
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    
    // Check if post exists
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    // Check if user already reacted
    const existingReaction = await ImageReaction.findOne({
      post: id,
      $or: [
        { 'user.email': email },
        { 'user.deviceId': deviceId }
      ]
    });
    
    if (existingReaction) {
      // Remove reaction (toggle off)
      await ImageReaction.findByIdAndDelete(existingReaction._id);
      await ImagePost.findByIdAndUpdate(id, { $inc: { reactionCount: -1 } });
      
      return res.json({
        message: 'Reaction removed successfully',
        hasReacted: false
      });
    }
    
    // Create new reaction
    const newReaction = new ImageReaction({
      post: id,
      user: {
        name,
        email,
        deviceId
      }
    });
    
    await newReaction.save();
    await ImagePost.findByIdAndUpdate(id, { $inc: { reactionCount: 1 } });
    
    res.status(201).json({
      message: 'Reaction added successfully',
      hasReacted: true
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reacted to this post' });
    }
    
    res.status(500).json({ message: error.message });
  }
});

// Check if user has reacted to a post
app.get('/api/image-posts/:id/has-reacted', extractDeviceId, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;
    const deviceId = req.deviceId;
    
    // Need email or deviceId
    if (!email && !deviceId) {
      return res.status(400).json({ message: 'Email or device identification required' });
    }
    
    // Build query
    const query = { post: id };
    
    if (email) {
      query['user.email'] = email;
    } else {
      query['user.deviceId'] = deviceId;
    }
    
    // Check if reaction exists
    const reaction = await ImageReaction.findOne(query);
    
    res.json({
      hasReacted: !!reaction
    });
  } catch (error) {
    console.error('Error checking reaction status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add a comment to an image post (public)
app.post('/api/image-posts/:id/comments', extractDeviceId, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, content } = req.body;
    const deviceId = req.deviceId;
    
    // Validate inputs
    if (!name || !email || !content) {
      return res.status(400).json({ message: 'Name, email, and content are required' });
    }
    
    if (content.length > 500) {
      return res.status(400).json({ message: 'Comment cannot exceed 500 characters' });
    }
    
    // Check if post exists
    const post = await ImagePost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Image post not found' });
    }
    
    // Create new comment
    const newComment = new ImageComment({
      post: id,
      user: {
        name,
        email,
        deviceId
      },
      content
    });
    
    await newComment.save();
    await ImagePost.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });
    
    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete own comment (public)
app.delete('/api/image-posts/comments/:commentId', extractDeviceId, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { email } = req.body;
    const deviceId = req.deviceId;
    
    // Validate inputs
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Find the comment
    const comment = await ImageComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Verify ownership (device ID or email)
    if (comment.user.email !== email && comment.user.deviceId !== deviceId) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    // Update post's comment count if comment is active
    if (comment.status === 'active') {
      await ImagePost.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });
    }
    
    await ImageComment.findByIdAndDelete(commentId);
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting own comment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get comments for an image post (public)
app.get('/api/image-posts/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get active comments only
    const comments = await ImageComment.find({
      post: id,
      status: 'active'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
    const total = await ImageComment.countDocuments({
      post: id,
      status: 'active'
    });
    
    res.json({
      comments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: error.message });
  }
});


// Social Posts 

// Social Media Embed Schema
const socialMediaEmbedSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  platform: {
    type: String,
    enum: ['twitter', 'facebook', 'linkedin'],
    required: true
  },
  embedUrl: {
    type: String,
    required: true,
    trim: true
  },
  embedCode: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create model
const SocialMediaEmbed = mongoose.model('SocialMediaEmbed', socialMediaEmbedSchema);

// ADMIN ROUTES
// Create a new social media embed (admin only)
app.post('/api/admin/social-embeds', authenticateToken, async (req, res) => {
  try {
    const { title, platform, embedUrl, embedCode, description } = req.body;
    
    // Validate required fields
    if (!title || !platform || !embedUrl || !embedCode) {
      return res.status(400).json({ 
        message: 'Title, platform, embed URL and embed code are required' 
      });
    }
    
    // Validate platform
    if (!['twitter', 'facebook', 'linkedin'].includes(platform)) {
      return res.status(400).json({ 
        message: 'Platform must be twitter, facebook, or linkedin' 
      });
    }
    
    // Create new social media embed
    const newEmbed = new SocialMediaEmbed({
      title,
      platform,
      embedUrl,
      embedCode,
      description,
      author: req.user.admin_id
    });
    
    await newEmbed.save();
    
    res.status(201).json({
      message: 'Social media embed created successfully',
      embed: {
        id: newEmbed._id,
        title: newEmbed.title,
        platform: newEmbed.platform,
        embedUrl: newEmbed.embedUrl,
        description: newEmbed.description,
        isActive: newEmbed.isActive,
        createdAt: newEmbed.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating social media embed:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update a social media embed (admin only)
app.put('/api/admin/social-embeds/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, platform, embedUrl, embedCode, description, isActive } = req.body;
    
    // Find embed
    const embed = await SocialMediaEmbed.findById(id);
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found' });
    }
    
    // Check if user is authorized (author or admin)
    if (embed.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this embed' });
    }
    
    // Update fields
    if (title) embed.title = title;
    if (platform && ['twitter', 'facebook', 'linkedin'].includes(platform)) {
      embed.platform = platform;
    }
    if (embedUrl) embed.embedUrl = embedUrl;
    if (embedCode) embed.embedCode = embedCode;
    if (description !== undefined) embed.description = description;
    if (isActive !== undefined) embed.isActive = isActive;
    
    embed.updatedAt = new Date();
    await embed.save();
    
    res.json({
      message: 'Social media embed updated successfully',
      embed: {
        id: embed._id,
        title: embed.title,
        platform: embed.platform,
        embedUrl: embed.embedUrl,
        description: embed.description,
        isActive: embed.isActive,
        updatedAt: embed.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating social media embed:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a social media embed (admin only)
app.delete('/api/admin/social-embeds/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find embed
    const embed = await SocialMediaEmbed.findById(id);
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found' });
    }
    
    // Check if user is authorized (author or admin)
    if (embed.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this embed' });
    }
    
    await SocialMediaEmbed.findByIdAndDelete(id);
    
    res.json({ message: 'Social media embed deleted successfully' });
  } catch (error) {
    console.error('Error deleting social media embed:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all social media embeds for admin dashboard
app.get('/api/admin/social-embeds', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, platform } = req.query;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter
    const filter = {};
    if (platform && ['twitter', 'facebook', 'linkedin'].includes(platform)) {
      filter.platform = platform;
    }
    
    // Get embeds
    const embeds = await SocialMediaEmbed.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'name email');
    
    const total = await SocialMediaEmbed.countDocuments(filter);
    
    res.json({
      embeds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching social media embeds for admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single social media embed with admin details
app.get('/api/admin/social-embeds/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const embed = await SocialMediaEmbed.findById(id)
      .populate('author', 'name email');
    
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found' });
    }
    
    res.json({ embed });
  } catch (error) {
    console.error('Error fetching social media embed details for admin:', error);
    res.status(500).json({ message: error.message });
  }
});

// Toggle embed active status (admin only)
app.patch('/api/admin/social-embeds/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const embed = await SocialMediaEmbed.findById(id);
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found' });
    }
    
    // Check if user is authorized
    if (embed.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this embed' });
    }
    
    embed.isActive = !embed.isActive;
    embed.updatedAt = new Date();
    await embed.save();
    
    res.json({
      message: `Embed ${embed.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: embed.isActive
    });
  } catch (error) {
    console.error('Error toggling embed status:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUBLIC ROUTES
// Get all active social media embeds (public)
app.get('/api/social-embeds', async (req, res) => {
  try {
    const { page = 1, limit = 10, platform } = req.query;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter - only active embeds
    const filter = { isActive: true };
    if (platform && ['twitter', 'facebook', 'linkedin'].includes(platform)) {
      filter.platform = platform;
    }
    
    // Get active embeds for public view
    const embeds = await SocialMediaEmbed.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('title platform embedUrl embedCode description createdAt updatedAt')
      .lean();
    
    const total = await SocialMediaEmbed.countDocuments(filter);
    
    res.json({
      embeds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching public social media embeds:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single social media embed (public)
app.get('/api/social-embeds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const embed = await SocialMediaEmbed.findOne({ 
      _id: id, 
      isActive: true 
    }).select('title platform embedUrl embedCode description createdAt updatedAt');
    
    if (!embed) {
      return res.status(404).json({ message: 'Social media embed not found or inactive' });
    }
    
    res.json({ embed });
  } catch (error) {
    console.error('Error fetching public social media embed:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get embeds by platform (public)
app.get('/api/social-embeds/platform/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Validate platform
    if (!['twitter', 'facebook', 'linkedin'].includes(platform)) {
      return res.status(400).json({ message: 'Invalid platform' });
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get embeds for specific platform
    const embeds = await SocialMediaEmbed.find({ 
      platform, 
      isActive: true 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('title platform embedUrl embedCode description createdAt updatedAt')
      .lean();
    
    const total = await SocialMediaEmbed.countDocuments({ 
      platform, 
      isActive: true 
    });
    
    res.json({
      embeds,
      platform,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching embeds by platform:', error);
    res.status(500).json({ message: error.message });
  }
});


// Updated Project Request Schema with multiple files support
const projectRequestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  projectType: {
    type: String,
    required: true,
    trim: true
  },
  budget: {
    type: String,
    trim: true,
    default: null
  },
  timeline: {
    type: String,
    trim: true,
    default: null
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  features: {
    type: String,
    trim: true,
    default: null
  },
  techPreferences: {
    type: String,
    trim: true,
    default: null
  },
  additionalInfo: {
    type: String,
    trim: true,
    default: null
  },
  files: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    data: {
      type: Buffer,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'acknowledged'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ProjectRequest = mongoose.model('ProjectRequest', projectRequestSchema);

// Routes
// Submit project request with multiple files (accessible to anyone)
app.post('/api/project/submit', upload.array('files', 5), async (req, res) => {
  try {
    const { name, email, projectType, description, budget, timeline, features, techPreferences, additionalInfo } = req.body;

    // Validate required inputs
    if (!name || !email || !projectType || !description) {
      return res.status(400).json({ message: 'Name, email, project type, and description are required' });
    }

    // Process uploaded files
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

    // Create new project request
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

    // Send confirmation email to user
    const fileList = files.length > 0 ? 
      `<p><strong>Uploaded files:</strong></p><ul>${files.map(f => `<li>${f.originalName} (${(f.size / 1024).toFixed(2)} KB)</li>`).join('')}</ul>` : 
      '<p>No files uploaded.</p>';

    const confirmationEmail = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your project request hs been received successfully</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f7f7f7;
      margin: 0;
      padding: 0;
      color: #1f2937;
      line-height: 1.6;
    }

    .email-container {
      width: 100%;
      background-color: #ffffff;
      border-left:2px solid  black;
      border-right: 2px solid  black;
      box-shadow: none;
      overflow: hidden;
      min-height: 100vh;
    }

    .email-header {
      background: linear-gradient(135deg, #111827, #1f2937);
      color: #ffffff;
      padding: 48px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .email-header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 10%, transparent 60%);
      transform: rotate(30deg);
    }

    .profile-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    .profile-image {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      margin-bottom: 16px;
      border: 4px solid #ffffff;
      display: block;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .profile-image:hover {
      transform: scale(1.05);
    }

    .avatar-fallback {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: linear-gradient(45deg, #6b7280, #9ca3af);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: 700;
      color: #ffffff;
      border: 4px solid #ffffff;
      text-transform: uppercase;
    }

    .profile-name {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      text-align: center;
      margin: 0;
    }

    .subject-section {
      flex: 1;
      text-align: right;
      position: relative;
      z-index: 1;
      margin-left: 32px;
    }

    .subject-section h1 {
      font-size: 32px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.025em;
      color: #ffffff;
    }

    .email-content {
      padding: 40px;
      background-color: #ffffff;
    }

    .email-content h2 {
      font-size: 22px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }

    .email-message {
      background-color: #f9fafb;
      border-left: 4px solid #374151;
      padding: 24px;
      border-radius: 0 12px 12px 0;
      color: #1f2937;
      margin: 24px 0;
      line-height: 1.8;
      font-size: 16px;
    }

    .email-message p {
      margin: 8px 0;
    }

    .contact-info {
      font-size: 15px;
      color: #374151;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }

    .contact-info p {
      margin: 8px 0;
    }

    .contact-info a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    .contact-info a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    .visit-site {
        color:inherit;
        background-color: white;
    
    }

    .visit-site:hover {
        color:black;
        
    }

    .email-footer {
      background: linear-gradient(180deg, #111827, #1f2937);
      padding: 32px;
      text-align: center;
      color: #d1d5db;
      font-size: 13px;
      border-top: 1px solid #374151;
    }

    .email-footer p {
      margin: 6px 0;
      line-height: 1.5;
    }

    .email-footer a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }

    .email-footer a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    .social-links {
      margin-top: 16px;
    }

    .social-links a {
      display: inline-block;
      margin: 0 8px;
      color: #d1d5db;
      font-size: 14px;
      transition: color 0.2s ease;
    }

    .social-links a:hover {
      color: #3b82f6;
    }

    @media (max-width: 768px) {
      .email-header {
        padding: 32px 20px;
        align-items: flex-start;
      }

      .profile-section {
        align-items: flex-start;
        min-width: 120px;
      }

      .subject-section {
        margin-left: 20px;
        text-align: left;
      }

      .subject-section h1 {
        font-size: 24px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }

      .email-content {
        padding: 24px;
      }

      .profile-name {
        font-size: 16px;
        text-align: left;
      }
    }

    @media (max-width: 480px) {
      .email-header {
        padding: 24px 16px;
        align-items: flex-start;
      }

      .profile-section {
        align-items: flex-start;
        min-width: 100px;
      }

      .subject-section {
        margin-left: 16px;
        text-align: left;
      }

      .subject-section h1 {
        font-size: 18px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
        line-height: 1.3;
      }

      .email-content {
        padding: 20px;
      }

      .profile-image, .avatar-fallback {
        width: 70px;
        height: 70px;
      }

      .avatar-fallback {
        font-size: 28px;
      }

      .profile-name {
        font-size: 14px;
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="profile-section">
        <img
          src="https://ik.imagekit.io/afi9t3xki/Screenshot%202025-06-10%20162118.png?updatedAt=1751634427555"
          alt="Profile"
          class="profile-image"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="avatar-fallback" style="display: none;">AT</div>
        
      </div>
      
      <div class="subject-section">
        <h1>Project request received successfully</h1>
      </div>
    </div>

    <div class="email-content">
      <h2>Dear Recipient,</h2>
      <h1>Project Request Received</h1>
      <p>Hello ${name},</p>
      <p>Your project request of type "${projectType}" has been received.</p>
      ${fileList}
      <p>We will review your request and get back to you soon.</p>
      <div class="contact-info">
        <p><strong>Best regards,</strong><br>Aaditiya Tyagi</p>
        <p><strong>Contact:</strong> <a href="tel:+917351102036">+91 73511 02036</a></p>
        <p>
          <a href="https://connectwithaaditiya.onrender.com" target="_blank" class="visit-site">
            Visit My Site
          </a>
        </p>
      </div>
    </div>

    <div class="email-footer">
      <p>This email was generated automatically. Please do not reply directly.</p>
      <p>For inquiries, contact <a href="mailto:aaditiyatyagi123@gmail.com">aaditiyatyagi123@gmail.com</a></p>
      <div class="social-links">
        <a href="https://x.com/aaditiya__tyagi" target="_blank">X</a> |
        <a href="https://www.linkedin.com/in/aaditiya-tyagi-babb26290/" target="_blank">LinkedIn</a> |
        <a href="https://github.com/meaaditiya" target="_blank">GitHub</a>
      </div>
      <p>© ${new Date().getFullYear()} Aaditiya Tyagi. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
 await sendEmail(email, 'Project Request Confirmation', confirmationEmail);

    res.status(201).json({
      message: 'Project request submitted successfully. Check your email for confirmation.',
      filesUploaded: files.length
    });
  } catch (error) {
    console.error('Project submission error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all project requests (admin only) - exclude file data for performance
app.get('/api/admin/project/requests', authenticateToken, async (req, res) => {
  try {
    const requests = await ProjectRequest.find()
      .sort({ createdAt: -1 })
      .select('-files.data'); // Exclude file data for list view

    res.json({ requests });
  } catch (error) {
    console.error('Error fetching project requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single project request with files (admin only)
app.get('/api/admin/project/requests/:id', authenticateToken, async (req, res) => {
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

// Download specific file from project request (admin only)
app.get('/api/admin/project/requests/:id/files/:fileIndex', authenticateToken, async (req, res) => {
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

// Acknowledge project request (admin only)
app.put('/api/admin/project/requests/:id/acknowledge', authenticateToken, async (req, res) => {
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

    // Send acknowledgment email to user
    const acknowledgmentEmail = `
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your project request has been acknowledged</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f7f7f7;
      margin: 0;
      padding: 0;
      color: #1f2937;
      line-height: 1.6;
    }

    .email-container {
      width: 100%;
      background-color: #ffffff;
       border-left:2px solid  black;
      border-right: 2px solid  black;
      box-shadow: none;
      overflow: hidden;
      min-height: 100vh;
    }

    .email-header {
      background: linear-gradient(135deg, #111827, #1f2937);
      color: #ffffff;
      padding: 48px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .email-header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 10%, transparent 60%);
      transform: rotate(30deg);
    }

    .profile-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    .profile-image {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      margin-bottom: 16px;
      border: 4px solid #ffffff;
      display: block;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .profile-image:hover {
      transform: scale(1.05);
    }

    .avatar-fallback {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: linear-gradient(45deg, #6b7280, #9ca3af);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: 700;
      color: #ffffff;
      border: 4px solid #ffffff;
      text-transform: uppercase;
    }

    .profile-name {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      text-align: center;
      margin: 0;
    }

    .subject-section {
      flex: 1;
      text-align: right;
      position: relative;
      z-index: 1;
      margin-left: 32px;
    }

    .subject-section h1 {
      font-size: 32px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.025em;
      color: #ffffff;
    }

    .email-content {
      padding: 40px;
      background-color: #ffffff;
    }

    .email-content h2 {
      font-size: 22px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }

    .email-message {
      background-color: #f9fafb;
      border-left: 4px solid #374151;
      padding: 24px;
      border-radius: 0 12px 12px 0;
      color: #1f2937;
      margin: 24px 0;
      line-height: 1.8;
      font-size: 16px;
    }

    .email-message p {
      margin: 8px 0;
    }

    .contact-info {
      font-size: 15px;
      color: #374151;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }

    .contact-info p {
      margin: 8px 0;
    }

    .contact-info a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    .contact-info a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    .visit-site {
        color:inherit;
        background-color: white;
    
    }

    .visit-site:hover {
        color:black;
        
    }

    .email-footer {
      background: linear-gradient(180deg, #111827, #1f2937);
      padding: 32px;
      text-align: center;
      color: #d1d5db;
      font-size: 13px;
      border-top: 1px solid #374151;
    }

    .email-footer p {
      margin: 6px 0;
      line-height: 1.5;
    }

    .email-footer a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }

    .email-footer a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    .social-links {
      margin-top: 16px;
    }

    .social-links a {
      display: inline-block;
      margin: 0 8px;
      color: #d1d5db;
      font-size: 14px;
      transition: color 0.2s ease;
    }

    .social-links a:hover {
      color: #3b82f6;
    }

    @media (max-width: 768px) {
      .email-header {
        padding: 32px 20px;
        align-items: flex-start;
      }

      .profile-section {
        align-items: flex-start;
        min-width: 120px;
      }

      .subject-section {
        margin-left: 20px;
        text-align: left;
      }

      .subject-section h1 {
        font-size: 24px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }

      .email-content {
        padding: 24px;
      }

      .profile-name {
        font-size: 16px;
        text-align: left;
      }
    }

    @media (max-width: 480px) {
      .email-header {
        padding: 24px 16px;
        align-items: flex-start;
      }

      .profile-section {
        align-items: flex-start;
        min-width: 100px;
      }

      .subject-section {
        margin-left: 16px;
        text-align: left;
      }

      .subject-section h1 {
        font-size: 18px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
        line-height: 1.3;
      }

      .email-content {
        padding: 20px;
      }

      .profile-image, .avatar-fallback {
        width: 70px;
        height: 70px;
      }

      .avatar-fallback {
        font-size: 28px;
      }

      .profile-name {
        font-size: 14px;
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="profile-section">
        <img
          src="https://ik.imagekit.io/afi9t3xki/Screenshot%202025-06-10%20162118.png?updatedAt=1751634427555"
          alt="Profile"
          class="profile-image"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="avatar-fallback" style="display: none;">AT</div>
        
      </div>
      
      <div class="subject-section">
        <h1>Project request has been acknowledged!</h1>
      </div>
    </div>

    <div class="email-content">
      <h2>Dear Recipient,</h2>
     <div>
        <p> <h1>Project Request Acknowledged</h1>
      <p>Hello ${request.name},</p>
      <p>Your project request of type "${request.projectType}" has been acknowledged.</p>
      <p>Thank you for your submission!</p></p>
      </div>
      <div class="contact-info">
        <p><strong>Best regards,</strong><br>Aaditiya Tyagi</p>
        <p><strong>Contact:</strong> <a href="tel:+917351102036">+91 73511 02036</a></p>
        <p>
          <a href="https://connectwithaaditiya.onrender.com" target="_blank" class="visit-site">
            Visit My Site
          </a>
        </p>
      </div>
    </div>

    <div class="email-footer">
      <p>This email was generated automatically. Please do not reply directly.</p>
      <p>For inquiries, contact <a href="mailto:aaditiyatyagi123@gmail.com">aaditiyatyagi123@gmail.com</a></p>
      <div class="social-links">
        <a href="https://x.com/aaditiya__tyagi" target="_blank">X</a> |
        <a href="https://www.linkedin.com/in/aaditiya-tyagi-babb26290/" target="_blank">LinkedIn</a> |
        <a href="https://github.com/meaaditiya" target="_blank">GitHub</a>
      </div>
      <p>© ${new Date().getFullYear()} Aaditiya Tyagi. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

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

// Delete specific project request (admin only)
app.delete('/api/admin/project/requests/:id', authenticateToken, async (req, res) => {
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

// Delete all project requests (admin only)
app.delete('/api/admin/project/requests', authenticateToken, async (req, res) => {
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

// Email Schema for MongoDB (add this to your models)
const emailSchema = new mongoose.Schema({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  attachments: [{
    filename: String,
    contentType: String,
    data: Buffer,
    size: Number
  }],
  sentAt: { type: Date, default: Date.now },
  sentBy: { type: String, required: true }, // admin email or ID
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' }
});

const Email = mongoose.model('Email', emailSchema);
app.use('/public', express.static(path.join(__dirname, 'public')));
const getEmailTemplate = (subject, message, senderName = 'Aaditiya Tyagi', receiverName) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f7f7f7;
      margin: 0;
      padding: 0;
      color: #1f2937;
      line-height: 1.6;
    }

    .email-container {
      width: 100%;
      background-color: #ffffff;
      border-left:2px solid  black;
      border-right: 2px solid  black;
      box-shadow: none;
      overflow: hidden;
      min-height: 100vh;
    }

    .email-header {
      background: linear-gradient(135deg, #111827, #1f2937);
      color: #ffffff;
      padding: 48px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .email-header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 10%, transparent 60%);
      transform: rotate(30deg);
    }

    .profile-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    .profile-image {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      margin-bottom: 16px;
      border: 4px solid #ffffff;
      display: block;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .profile-image:hover {
      transform: scale(1.05);
    }

    .avatar-fallback {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: linear-gradient(45deg, #6b7280, #9ca3af);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: 700;
      color: #ffffff;
      border: 4px solid #ffffff;
      text-transform: uppercase;
    }

    .profile-name {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      text-align: center;
      margin: 0;
    }

    .subject-section {
      flex: 1;
      text-align: right;
      position: relative;
      z-index: 1;
      margin-left: 32px;
    }

    .subject-section h1 {
      font-size: 32px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.025em;
      color: #ffffff;
    }

    .email-content {
      padding: 40px;
      background-color: #ffffff;
    }

    .email-content h2 {
      font-size: 22px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }

    .email-message {
      background-color: #f9fafb;
      border-left: 4px solid #374151;
      padding: 24px;
      border-radius: 0 12px 12px 0;
      color: #1f2937;
      margin: 24px 0;
      line-height: 1.8;
      font-size: 16px;
    }

    .email-message p {
      margin: 8px 0;
    }

    .contact-info {
      font-size: 15px;
      color: #374151;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }

    .contact-info p {
      margin: 8px 0;
    }

    .contact-info a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    .contact-info a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    .visit-site {
        color:inherit;
        background-color: white;
    
    }

    .visit-site:hover {
        color:black;
        
    }

    .email-footer {
      background: linear-gradient(180deg, #111827, #1f2937);
      padding: 32px;
      text-align: center;
      color: #d1d5db;
      font-size: 13px;
      border-top: 1px solid #374151;
    }

    .email-footer p {
      margin: 6px 0;
      line-height: 1.5;
    }

    .email-footer a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }

    .email-footer a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    .social-links {
      margin-top: 16px;
    }

    .social-links a {
      display: inline-block;
      margin: 0 8px;
      color: #d1d5db;
      font-size: 14px;
      transition: color 0.2s ease;
    }

    .social-links a:hover {
      color: #3b82f6;
    }

    @media (max-width: 768px) {
      .email-header {
        padding: 32px 20px;
        align-items: flex-start;
      }

      .profile-section {
        align-items: flex-start;
        min-width: 120px;
      }

      .subject-section {
        margin-left: 20px;
        text-align: left;
      }

      .subject-section h1 {
        font-size: 24px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }

      .email-content {
        padding: 24px;
      }

      .profile-name {
        font-size: 16px;
        text-align: left;
      }
    }

    @media (max-width: 480px) {
      .email-header {
        padding: 24px 16px;
        align-items: flex-start;
      }

      .profile-section {
        align-items: flex-start;
        min-width: 100px;
      }

      .subject-section {
        margin-left: 16px;
        text-align: left;
      }

      .subject-section h1 {
        font-size: 18px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
        line-height: 1.3;
      }

      .email-content {
        padding: 20px;
      }

      .profile-image, .avatar-fallback {
        width: 70px;
        height: 70px;
      }

      .avatar-fallback {
        font-size: 28px;
      }

      .profile-name {
        font-size: 14px;
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="profile-section">
        <img
          src="https://ik.imagekit.io/afi9t3xki/Screenshot%202025-06-10%20162118.png?updatedAt=1751634427555"
          alt="Profile"
          class="profile-image"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="avatar-fallback" style="display: none;">AT</div>
      
      </div>
      
      <div class="subject-section">
        <h1>${subject}</h1>
      </div>
    </div>

    <div class="email-content">
      <h2>${recepient},</h2>
      <div >
        <p>${message.replace(/\n/g, '</p><p>')}</p>
      </div>

      <div class="contact-info">
        <p><strong>Best regards,</strong><br>${senderName}</p>
        <p><strong>Contact:</strong> <a href="tel:+917351102036">+91 73511 02036</a></p>
        <p>
          <a href="https://connectwithaaditiya.onrender.com" target="_blank" class="visit-site">
            Visit My Site
          </a>
        </p>
      </div>
    </div>

    <div class="email-footer">
      <p>This email was generated automatically. Please do not reply directly.</p>
      <p>For inquiries, contact <a href="mailto:aaditiyatyagi123@gmail.com">aaditiyatyagi123@gmail.com</a></p>
      <div class="social-links">
        <a href="https://x.com/aaditiya__tyagi" target="_blank">X</a> |
        <a href="https://www.linkedin.com/in/aaditiya-tyagi-babb26290/" target="_blank">LinkedIn</a> |
        <a href="https://github.com/meaaditiya" target="_blank">GitHub</a>
      </div>
      <p>© ${new Date().getFullYear()} Aaditiya Tyagi. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

// Route 1: Send single email with attachments
app.post('/api/admin/send-email', authenticateToken, upload.array('attachments', 10), async (req, res) => {
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

app.post('/api/admin/send-bulk-email', authenticateToken, upload.array('attachments', 10), async (req, res) => {
  try {
    let { recipients, subject, message, senderName } = req.body;
    
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
    const htmlTemplate = getEmailTemplate(subject, message, senderName);
    
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
app.get('/api/admin/email-history', authenticateToken, async (req, res) => {
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
app.get('/api/admin/email/:id', authenticateToken, async (req, res) => {
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
app.get('/api/admin/email/:id/attachment/:attachmentId', authenticateToken, async (req, res) => {
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
app.delete('/api/admin/email/:id', authenticateToken, async (req, res) => {
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
app.get('/api/admin/email-stats', authenticateToken, async (req, res) => {
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

const profileImageSchema = new mongoose.Schema({
  imageData: {
    type: Buffer,
    required: true
  },
  contentType: {
    type: String,
    required: true,
    enum: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  },
  filename: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  uploadedBy: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const ProfileImage = mongoose.model('ProfileImage', profileImageSchema);

app.post(
  '/api/profile-image/upload',
  authenticateToken,
  upload.single('profileImage'),
  [
    body('filename').optional().trim().isLength({ min: 1, max: 100 })
      .withMessage('Filename must be between 1 and 100 characters')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'Profile image file is required' });
      }

      // Validate file type
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedImageTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type. Only images are allowed.' });
      }

      // Deactivate previous active profile image
      await ProfileImage.updateMany(
        { isActive: true },
        { isActive: false }
      );

      // Create new profile image
      const newProfileImage = new ProfileImage({
        imageData: req.file.buffer,
        contentType: req.file.mimetype,
        filename: req.body.filename || req.file.originalname,
        size: req.file.size,
        uploadedBy: {
          name: req.user.name || 'Aaditiya Tyagi',
          email: req.user.email
        },
        isActive: true
      });

      await newProfileImage.save();

      res.status(201).json({
        message: 'Profile image uploaded successfully',
        profileImage: {
          id: newProfileImage._id,
          filename: newProfileImage.filename,
          contentType: newProfileImage.contentType,
          size: newProfileImage.size,
          uploadedAt: newProfileImage.uploadedAt
        }
      });

    } catch (error) {
      console.error('Error uploading profile image:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// PUBLIC ROUTE: Get active profile image
app.get('/api/profile-image/active', async (req, res) => {
  try {
    const profileImage = await ProfileImage.findOne({ isActive: true });
    
    if (!profileImage) {
      return res.status(404).json({ message: 'No active profile image found' });
    }

    res.set({
      'Content-Type': profileImage.contentType,
      'Content-Length': profileImage.imageData.length,
      'Cache-Control': 'public, max-age=3600'
    });

    res.send(profileImage.imageData);

  } catch (error) {
    console.error('Error fetching profile image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUBLIC ROUTE: Get profile image by ID
app.get('/api/profile-image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const profileImage = await ProfileImage.findById(id);
    
    if (!profileImage) {
      return res.status(404).json({ message: 'Profile image not found' });
    }

    res.set({
      'Content-Type': profileImage.contentType,
      'Content-Length': profileImage.imageData.length,
      'Cache-Control': 'public, max-age=3600'
    });

    res.send(profileImage.imageData);

  } catch (error) {
    console.error('Error fetching profile image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ADMIN ROUTE: Get all profile images info
app.get('/api/profile-images', authenticateToken, async (req, res) => {
  try {
    const profileImages = await ProfileImage.find()
      .select('-imageData') // Exclude binary data
      .sort({ uploadedAt: -1 });

    res.json({
      message: 'Profile images retrieved successfully',
      profileImages
    });

  } catch (error) {
    console.error('Error fetching profile images:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ADMIN ROUTE: Delete profile image
app.delete('/api/profile-image/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const profileImage = await ProfileImage.findByIdAndDelete(id);
    
    if (!profileImage) {
      return res.status(404).json({ message: 'Profile image not found' });
    }

    res.json({
      message: 'Profile image deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting profile image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// ADMIN ROUTE: Set profile image as active
app.patch('/api/profile-image/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Deactivate all images
    await ProfileImage.updateMany(
      { isActive: true },
      { isActive: false }
    );

    // Activate the selected image
    const profileImage = await ProfileImage.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );

    if (!profileImage) {
      return res.status(404).json({ message: 'Profile image not found' });
    }

    res.json({
      message: 'Profile image set as active successfully',
      profileImage: {
        id: profileImage._id,
        filename: profileImage.filename,
        contentType: profileImage.contentType,
        size: profileImage.size,
        uploadedAt: profileImage.uploadedAt,
        isActive: profileImage.isActive,
      },
    });
  } catch (error) {
    console.error('Error setting active profile image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
const quoteSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxLength: 500
  },
  author: {
    type: String,
    default: 'Aaditiya Tyagi',
    trim: true,
    maxLength: 100
  },
  addedBy: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
const Quote = mongoose.model('Quote', quoteSchema);

//==================== QUOTE ROUTES (SINGLE QUOTE SYSTEM) ====================

// ADMIN ROUTE: Set/Update the single quote
app.post(
  '/api/quote',
  authenticateToken,
  [
    body('content').trim().notEmpty().withMessage('Quote content is required')
      .isLength({ max: 500 }).withMessage('Quote cannot exceed 500 characters'),
    body('author').optional().trim().isLength({ max: 100 })
      .withMessage('Author name cannot exceed 100 characters')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { content, author } = req.body;

      // Delete existing quote and create new one
      await Quote.deleteMany({});
      
      const newQuote = new Quote({
        content,
        author: author || 'Aaditiya Tyagi',
        addedBy: {
          name: req.user.name || 'Aaditiya Tyagi',
          email: req.user.email
        }
      });

      await newQuote.save();

      res.status(201).json({
        message: 'Quote updated successfully',
        quote: newQuote
      });

    } catch (error) {
      console.error('Error updating quote:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// PUBLIC ROUTE: Get the current quote
app.get('/api/quote', async (req, res) => {
  try {
    const quote = await Quote.findOne({ isActive: true })
      .select('-addedBy'); // Don't expose admin info publicly

    if (!quote) {
      return res.status(404).json({ message: 'No quote found' });
    }

    res.json({
      message: 'Quote retrieved successfully',
      quote
    });

  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ADMIN ROUTE: Get quote with admin info
app.get('/api/admin/quote', authenticateToken, async (req, res) => {
  try {
    const quote = await Quote.findOne();

    if (!quote) {
      return res.status(404).json({ message: 'No quote found' });
    }

    res.json({
      message: 'Quote retrieved successfully',
      quote
    });

  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ADMIN ROUTE: Update the current quote
app.put(
  '/api/quote',
  authenticateToken,
  [
    body('content').optional().trim().notEmpty().withMessage('Quote content cannot be empty')
      .isLength({ max: 500 }).withMessage('Quote cannot exceed 500 characters'),
    body('author').optional().trim().isLength({ max: 100 })
      .withMessage('Author name cannot exceed 100 characters'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updateData = { ...req.body, updatedAt: Date.now() };

      const updatedQuote = await Quote.findOneAndUpdate(
        {},
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedQuote) {
        return res.status(404).json({ message: 'Quote not found' });
      }

      res.json({
        message: 'Quote updated successfully',
        quote: updatedQuote
      });

    } catch (error) {
      console.error('Error updating quote:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// ADMIN ROUTE: Delete the current quote
app.delete('/api/quote', authenticateToken, async (req, res) => {
  try {
    const deletedQuote = await Quote.findOneAndDelete({});
    
    if (!deletedQuote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    res.json({
      message: 'Quote deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ADMIN ROUTE: Toggle quote active status
app.patch('/api/quote/toggle', authenticateToken, async (req, res) => {
  try {
    const quote = await Quote.findOne();
    
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    quote.isActive = !quote.isActive;
    quote.updatedAt = Date.now();
    await quote.save();

    res.json({
      message: `Quote ${quote.isActive ? 'activated' : 'deactivated'} successfully`,
      quote
    });

  } catch (error) {
    console.error('Error toggling quote status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});





// Updated MongoDB Schemas - Fixed to match email/name approach
const communityPostSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  postType: {
    type: String,
    enum: ['image', 'poll', 'video', 'quiz', 'link'],
    required: true
  },
  description: {
    type: String,
    required: false
  },
  // For image posts
  images: [{
    data: Buffer,
    contentType: String,
    filename: String
  }],
  // For video posts
  video: {
    data: Buffer,
    contentType: String,
    filename: String
  },
  caption:{
     type: String,
    required: false
  } ,
  // For poll posts
  pollOptions: [{
    option: String,
    votes: [{
      userEmail: String,
      userName: String,
      votedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  pollExpiresAt: Date,
  // For quiz posts
  quizQuestions: [{
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String
  }],
  // For link posts
  linkUrl: String,
  linkTitle: String,
  linkDescription: String,
  linkThumbnail: {
    data: Buffer,
    contentType: String
  },
  // Common fields
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityLike'
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityComment'
  }],
  shares: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityShare'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Fixed CommunityLike schema
const communityLikeSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityPost',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  likedAt: {
    type: Date,
    default: Date.now
  }
});

// Fixed CommunityComment schema
const communityCommentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityPost',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityComment'
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityComment'
  }],
  likes: [{
    userEmail: String,
    userName: String,
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Fixed CommunityShare schema
const communityShareSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityPost',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  sharedAt: {
    type: Date,
    default: Date.now
  }
});

// Create models
const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);
const CommunityLike = mongoose.model('CommunityLike', communityLikeSchema);
const CommunityComment = mongoose.model('CommunityComment', communityCommentSchema);
const CommunityShare = mongoose.model('CommunityShare', communityShareSchema);

// ROUTES

// Create a new community post - FIXED
app.post('/api/community/posts', authenticateToken, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create community posts' });
    }

    const { postType, description, caption, pollOptions, pollExpiresAt, quizQuestions, linkUrl, linkTitle, linkDescription } = req.body;
    
    // Validate required fields
    if (!postType) {
      return res.status(400).json({ message: 'Post type is required' });
    }

    const postData = {
      author: req.user.admin_id,
      postType
    };

    // Add description only if provided
    if (description && description.trim()) {
      postData.description = description.trim();
    }

    // Handle different post types
    switch (postType) {
      case 'image':
        if (!req.files || !req.files.images || req.files.images.length === 0) {
          return res.status(400).json({ message: 'At least one image is required for image posts' });
        }
        postData.images = req.files.images.map(file => ({
          data: file.buffer,
          contentType: file.mimetype,
          filename: file.originalname
        }));
        break;

      case 'video':
        if (!req.files || !req.files.video || req.files.video.length === 0) {
          return res.status(400).json({ message: 'Video is required for video posts' });
        }
        postData.video = {
          data: req.files.video[0].buffer,
          contentType: req.files.video[0].mimetype,
          filename: req.files.video[0].originalname
        };
        // Caption is optional for video posts
        if (caption && caption.trim()) {
          postData.caption = caption.trim();
        }
        break;

      case 'poll':
        if (!pollOptions) {
          return res.status(400).json({ message: 'Poll options are required for poll posts' });
        }
        let parsedPollOptions;
        try {
          parsedPollOptions = typeof pollOptions === 'string' ? JSON.parse(pollOptions) : pollOptions;
        } catch (error) {
          return res.status(400).json({ message: 'Invalid poll options format' });
        }
        
        if (!Array.isArray(parsedPollOptions) || parsedPollOptions.length < 2) {
          return res.status(400).json({ message: 'At least 2 poll options are required' });
        }
        
        postData.pollOptions = parsedPollOptions.map(option => ({
          option: option.trim(),
          votes: []
        }));
        
        if (pollExpiresAt) {
          postData.pollExpiresAt = new Date(pollExpiresAt);
        }
        
        // Add description for poll posts if provided
        if (description && description.trim()) {
          postData.description = description.trim();
        }
        break;

      case 'quiz':
        if (!quizQuestions) {
          return res.status(400).json({ message: 'Quiz questions are required for quiz posts' });
        }
        let parsedQuizQuestions;
        try {
          parsedQuizQuestions = typeof quizQuestions === 'string' ? JSON.parse(quizQuestions) : quizQuestions;
        } catch (error) {
          return res.status(400).json({ message: 'Invalid quiz questions format' });
        }
        
        if (!Array.isArray(parsedQuizQuestions) || parsedQuizQuestions.length === 0) {
          return res.status(400).json({ message: 'At least one quiz question is required' });
        }
        
        postData.quizQuestions = parsedQuizQuestions;
        break;

      case 'link':
        if (!linkUrl || !linkUrl.trim()) {
          return res.status(400).json({ message: 'Link URL is required for link posts' });
        }
        postData.linkUrl = linkUrl.trim();
        if (linkTitle && linkTitle.trim()) {
          postData.linkTitle = linkTitle.trim();
        }
        if (linkDescription && linkDescription.trim()) {
          postData.linkDescription = linkDescription.trim();
        }
        break;

      default:
        return res.status(400).json({ message: 'Invalid post type' });
    }

    const post = new CommunityPost(postData);
    await post.save();

    // Populate author details for response
    const populatedPost = await CommunityPost.findById(post._id)
      .populate('author', 'username email');

    res.status(201).json({
      message: 'Community post created successfully',
      post: populatedPost
    });
  } catch (error) {
    console.error('Error creating community post:', error);
    res.status(500).json({ message: error.message });
  }
});
app.get('/api/community/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10, postType } = req.query;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };
    if (postType) {
      filter.postType = postType;
    }

    const posts = await CommunityPost.find(filter)
      .populate('author', 'username email')
      .populate({
        path: 'likes',
        // No additional filtering needed for likes since they don't have isActive
      })
      .populate({
        path: 'comments',
        match: { isActive: true }, // FIXED: Only populate active comments
      })
      .populate({
        path: 'shares',
        // No additional filtering needed for shares since they don't have isActive
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalPosts = await CommunityPost.countDocuments(filter);

    res.json({
      posts,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts
    });
  } catch (error) {
    console.error('Error fetching community posts:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/community/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await CommunityPost.findOne({ _id: id, isActive: true }) // FIXED: Only get active posts
      .populate('author', 'username email')
      .populate({
        path: 'likes',
        // No additional filtering needed for likes
      })
      .populate({
        path: 'comments',
        match: { isActive: true }, // FIXED: Only populate active comments
      })
      .populate({
        path: 'shares',
        // No additional filtering needed for shares
      });

    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching community post:', error);
    res.status(500).json({ message: error.message });
  }
});
// Replace your PUT route with this corrected version:
app.put('/api/community/posts/:id', authenticateToken, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const post = await CommunityPost.findById(id);

    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    // Check authorization
    if (post.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }

    const { description, caption, pollOptions, pollExpiresAt, quizQuestions, linkUrl, linkTitle, linkDescription } = req.body;

    // Update description - always update this field
    if (description !== undefined) {
      post.description = description.trim();
    }

    // Update type-specific fields
    switch (post.postType) {
      case 'image':
        // Only update images if new ones are provided
        if (req.files && req.files.images && req.files.images.length > 0) {
          post.images = req.files.images.map(file => ({
            data: file.buffer,
            contentType: file.mimetype,
            filename: file.originalname
          }));
        }
        break;

      case 'video':
        // Only update video if new one is provided
        if (req.files && req.files.video && req.files.video.length > 0) {
          post.video = {
            data: req.files.video[0].buffer,
            contentType: req.files.video[0].mimetype,
            filename: req.files.video[0].originalname
          };
        }
        // Always update caption for video posts
        if (caption !== undefined) {
          post.caption = caption.trim();
        }
        break;

      case 'poll':
        if (pollOptions) {
          try {
            const parsedOptions = typeof pollOptions === 'string' ? JSON.parse(pollOptions) : pollOptions;
            if (Array.isArray(parsedOptions) && parsedOptions.length >= 2) {
              // Preserve existing votes when updating options
              const existingVotes = {};
              post.pollOptions.forEach((option, index) => {
                existingVotes[option.option] = option.votes;
              });

              post.pollOptions = parsedOptions.map(option => ({
                option: option.trim(),
                votes: existingVotes[option.trim()] || []
              }));
            }
          } catch (error) {
            return res.status(400).json({ message: 'Invalid poll options format' });
          }
        }
        if (pollExpiresAt !== undefined) {
          post.pollExpiresAt = pollExpiresAt ? new Date(pollExpiresAt) : null;
        }
        break;

      case 'quiz':
        if (quizQuestions) {
          try {
            const parsedQuestions = typeof quizQuestions === 'string' ? JSON.parse(quizQuestions) : quizQuestions;
            if (Array.isArray(parsedQuestions)) {
              post.quizQuestions = parsedQuestions;
            }
          } catch (error) {
            return res.status(400).json({ message: 'Invalid quiz questions format' });
          }
        }
        break;

      case 'link':
        if (linkUrl !== undefined) post.linkUrl = linkUrl.trim();
        if (linkTitle !== undefined) post.linkTitle = linkTitle.trim();
        if (linkDescription !== undefined) post.linkDescription = linkDescription.trim();
        break;
    }

    post.updatedAt = new Date();
    await post.save();

    // Populate and return the updated post
    const updatedPost = await CommunityPost.findById(post._id)
      .populate('author', 'username email')
      .populate('likes')
      .populate('comments')
      .populate('shares');

    res.json({
      message: 'Community post updated successfully',
      post: updatedPost
    });
  } catch (error) {
    console.error('Error updating community post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a community post - PERMANENT DELETION
app.delete('/api/community/posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const post = await CommunityPost.findById(id);

    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    // Check authorization
    if (post.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // PERMANENT DELETE: Remove all associated data first
    
    // 1. Delete all likes for this post
    await CommunityLike.deleteMany({ post: id });

    // 2. Delete all comments and replies for this post
    await CommunityComment.deleteMany({ post: id });

    // 3. Delete all shares for this post
    await CommunityShare.deleteMany({ post: id });

    // 4. Finally delete the post itself
    await CommunityPost.findByIdAndDelete(id);

    res.json({ message: 'Community post permanently deleted successfully' });
  } catch (error) {
    console.error('Error deleting community post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a comment - PERMANENT DELETION
app.delete('/api/community/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    const comment = await CommunityComment.findById(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check authorization - only comment owner can delete
    if (comment.userEmail !== userEmail) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // PERMANENT DELETE: Remove all associated data
    
    // 1. Delete all replies to this comment
    await CommunityComment.deleteMany({ parentComment: id });

    // 2. Remove this comment from the post's comments array
    await CommunityPost.updateOne(
      { _id: comment.post },
      { $pull: { comments: id } }
    );

    // 3. Remove this comment from parent comment's replies array (if it's a reply)
    if (comment.parentComment) {
      await CommunityComment.updateOne(
        { _id: comment.parentComment },
        { $pull: { replies: id } }
      );
    }

    // 4. Finally delete the comment itself
    await CommunityComment.findByIdAndDelete(id);

    res.json({ message: 'Comment permanently deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a reply - PERMANENT DELETION
app.delete('/api/community/comments/:commentId/replies/:replyId', async (req, res) => {
  try {
    const { commentId, replyId } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    // Find the reply
    const reply = await CommunityComment.findById(replyId);
    if (!reply) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    // Check if this is actually a reply to the specified comment
    if (reply.parentComment?.toString() !== commentId) {
      return res.status(400).json({ message: 'Reply does not belong to the specified comment' });
    }

    // Check authorization - only reply owner can delete
    if (reply.userEmail !== userEmail) {
      return res.status(403).json({ message: 'Not authorized to delete this reply' });
    }

    // PERMANENT DELETE: Remove all references
    
    // 1. Remove the reply from parent comment's replies array
    await CommunityComment.updateOne(
      { _id: commentId },
      { $pull: { replies: replyId } }
    );

    // 2. Remove from post's comments array
    await CommunityPost.updateOne(
      { _id: reply.post },
      { $pull: { comments: replyId } }
    );

    // 3. Finally delete the reply itself
    await CommunityComment.findByIdAndDelete(replyId);

    res.json({ message: 'Reply permanently deleted successfully' });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ message: error.message });
  }
});
// FIXED: Get comments for a community post - Already correctly filtered
app.get('/api/community/posts/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // First check if the post exists and is active
    const post = await CommunityPost.findOne({ _id: id, isActive: true });
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    const comments = await CommunityComment.find({ 
      post: id, 
      isActive: true, 
      parentComment: null 
    })
      .populate({
        path: 'replies',
        match: { isActive: true } // FIXED: Only populate active replies
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalComments = await CommunityComment.countDocuments({ 
      post: id, 
      isActive: true, 
      parentComment: null 
    });

    res.json({
      comments,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalComments / limit),
      totalComments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: error.message });
  }
});


// Get community post media (images/videos)
app.get('/api/community/posts/:id/media/:type/:index', async (req, res) => {
  try {
    const { id, type, index } = req.params;
    
    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    let media;
    if (type === 'image' && post.images && post.images[index]) {
      media = post.images[index];
    } else if (type === 'video' && post.video) {
      media = post.video;
    } else {
      return res.status(404).json({ message: 'Media not found' });
    }

    res.set('Content-Type', media.contentType);
    res.send(media.data);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ message: error.message });
  }
});

// FIXED: Like a community post - Check if post is active
app.post('/api/community/posts/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); // FIXED: Only allow liking active posts
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    // Check if user already liked the post
    const existingLike = await CommunityLike.findOne({ post: id, userEmail });
        
    if (existingLike) {
      // Unlike the post
      await CommunityLike.findByIdAndDelete(existingLike._id);
      post.likes.pull(existingLike._id);
      await post.save();
            
      res.json({ message: 'Post unliked successfully', liked: false });
    } else {
      // Like the post
      const newLike = new CommunityLike({
        post: id,
        userEmail,
        userName
      });
      await newLike.save();
            
      post.likes.push(newLike._id);
      await post.save();
            
      res.json({ message: 'Post liked successfully', liked: true });
    }
  } catch (error) {
    console.error('Error liking/unliking community post:', error);
    res.status(500).json({ message: error.message });
  }
});

// FIXED: Comment on a community post - Check if post is active
app.post('/api/community/posts/:id/comment', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, parentComment, userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); // FIXED: Only allow commenting on active posts
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    // FIXED: If replying to a comment, check if parent comment is active
    if (parentComment) {
      const parentCommentDoc = await CommunityComment.findOne({ 
        _id: parentComment, 
        isActive: true 
      });
      if (!parentCommentDoc) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }
    }

    const newComment = new CommunityComment({
      post: id,
      userEmail,
      userName,
      comment: comment.trim(),
      parentComment: parentComment || null
    });

    await newComment.save();
        
    // Add comment to post
    post.comments.push(newComment._id);
    await post.save();

    // If this is a reply, add to parent comment's replies
    if (parentComment) {
      const parentCommentDoc = await CommunityComment.findOne({ 
        _id: parentComment, 
        isActive: true 
      });
      if (parentCommentDoc) {
        parentCommentDoc.replies.push(newComment._id);
        await parentCommentDoc.save();
      }
    }

    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: error.message });
  }
});

// FIXED: Share a community post - Check if post is active
app.post('/api/community/posts/:id/share', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); // FIXED: Only allow sharing active posts
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    // Check if user already shared the post
    const existingShare = await CommunityShare.findOne({ post: id, userEmail });
        
    if (existingShare) {
      return res.status(400).json({ message: 'Post already shared' });
    }

    const newShare = new CommunityShare({
      post: id,
      userEmail,
      userName
    });

    await newShare.save();
        
    post.shares.push(newShare._id);
    await post.save();

    res.json({ message: 'Post shared successfully' });
  } catch (error) {
    console.error('Error sharing community post:', error);
    res.status(500).json({ message: error.message });
  }
});

// FIXED: Vote on a poll - Check if post is active
app.post('/api/community/posts/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { optionIndex, userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); // FIXED: Only allow voting on active posts
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    if (post.postType !== 'poll') {
      return res.status(400).json({ message: 'This post is not a poll' });
    }

    // Check if poll has expired
    if (post.pollExpiresAt && new Date() > post.pollExpiresAt) {
      return res.status(400).json({ message: 'Poll has expired' });
    }

    // Check if user already voted
    const hasVoted = post.pollOptions.some(option => 
      option.votes.some(vote => vote.userEmail === userEmail)
    );

    if (hasVoted) {
      return res.status(400).json({ message: 'You have already voted on this poll' });
    }

    if (optionIndex < 0 || optionIndex >= post.pollOptions.length) {
      return res.status(400).json({ message: 'Invalid option index' });
    }

    post.pollOptions[optionIndex].votes.push({
      userEmail,
      userName,
      votedAt: new Date()
    });

    await post.save();

    res.json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error voting on poll:', error);
    res.status(500).json({ message: error.message });
  }
});

// FIXED: Submit quiz answer - Check if post is active
app.post('/api/community/posts/:id/quiz-answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const post = await CommunityPost.findOne({ _id: id, isActive: true }); // FIXED: Only allow quiz submission on active posts
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    if (post.postType !== 'quiz') {
      return res.status(400).json({ message: 'This post is not a quiz' });
    }

    let score = 0;
    const results = post.quizQuestions.map((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      if (isCorrect) score++;

      return {
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation
      };
    });

    res.json({
      message: 'Quiz submitted successfully',
      score,
      totalQuestions: post.quizQuestions.length,
      results
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: error.message });
  }
});

// BONUS: Unlike a post (removes like from database)
app.delete('/api/community/posts/:id/unlike', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    // Find and delete the like
    const like = await CommunityLike.findOneAndDelete({ post: id, userEmail });
    
    if (!like) {
      return res.status(404).json({ message: 'Like not found' });
    }

    // Remove like reference from post
    post.likes.pull(like._id);
    await post.save();

    res.json({ message: 'Like permanently removed' });
  } catch (error) {
    console.error('Error removing like:', error);
    res.status(500).json({ message: error.message });
  }
});

// BONUS: Remove share (permanent deletion)
app.delete('/api/community/posts/:id/unshare', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: 'User email is required' });
    }

    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Community post not found' });
    }

    // Find and delete the share
    const share = await CommunityShare.findOneAndDelete({ post: id, userEmail });
    
    if (!share) {
      return res.status(404).json({ message: 'Share not found' });
    }

    // Remove share reference from post
    post.shares.pull(share._id);
    await post.save();

    res.json({ message: 'Share permanently removed' });
  } catch (error) {
    console.error('Error removing share:', error);
    res.status(500).json({ message: error.message });
  }
});

// BONUS: Admin route to permanently delete any user's comment
app.delete('/api/community/admin/comments/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete any comment' });
    }

    const { id } = req.params;
    const comment = await CommunityComment.findById(id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // PERMANENT DELETE: Remove all associated data
    
    // 1. Delete all replies to this comment
    await CommunityComment.deleteMany({ parentComment: id });

    // 2. Remove this comment from the post's comments array
    await CommunityPost.updateOne(
      { _id: comment.post },
      { $pull: { comments: id } }
    );

    // 3. Remove this comment from parent comment's replies array (if it's a reply)
    if (comment.parentComment) {
      await CommunityComment.updateOne(
        { _id: comment.parentComment },
        { $pull: { replies: id } }
      );
    }

    // 4. Finally delete the comment itself
    await CommunityComment.findByIdAndDelete(id);

    res.json({ message: 'Comment permanently deleted by admin' });
  } catch (error) {
    console.error('Error deleting comment (admin):', error);
    res.status(500).json({ message: error.message });
  }
});

// BONUS: Bulk delete - Admin can delete multiple posts at once
app.delete('/api/community/admin/posts/bulk', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can bulk delete posts' });
    }

    const { postIds } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({ message: 'Post IDs array is required' });
    }

    // PERMANENT DELETE: Remove all associated data for all posts
    
    // 1. Delete all likes for these posts
    await CommunityLike.deleteMany({ post: { $in: postIds } });

    // 2. Delete all comments and replies for these posts
    await CommunityComment.deleteMany({ post: { $in: postIds } });

    // 3. Delete all shares for these posts
    await CommunityShare.deleteMany({ post: { $in: postIds } });

    // 4. Finally delete the posts themselves
    const result = await CommunityPost.deleteMany({ _id: { $in: postIds } });

    res.json({ 
      message: 'Posts permanently deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting posts:', error);
    res.status(500).json({ message: error.message });
  }
});

// FIXED: Like a comment - Check if comment is active
app.post('/api/community/comments/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, userName } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ message: 'User email and name are required' });
    }

    const comment = await CommunityComment.findOne({ _id: id, isActive: true }); // FIXED: Only allow liking active comments
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user already liked the comment
    const existingLikeIndex = comment.likes.findIndex(
      like => like.userEmail === userEmail
    );

    if (existingLikeIndex > -1) {
      // Unlike the comment
      comment.likes.splice(existingLikeIndex, 1);
      await comment.save();
            
      res.json({ message: 'Comment unliked successfully', liked: false });
    } else {
      // Like the comment
      comment.likes.push({
        userEmail,
        userName,
        likedAt: new Date()
      });
      await comment.save();
            
      res.json({ message: 'Comment liked successfully', liked: true });
    }
  } catch (error) {
    console.error('Error liking/unliking comment:', error);
    res.status(500).json({ message: error.message });
  }
});
// FIXED: Get user's activity - Filter out deleted items
app.get('/api/community/user/:userEmail/activity', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Get user's likes (only for active posts)
    const likes = await CommunityLike.find({ userEmail })
      .populate({
        path: 'post',
        match: { isActive: true }, // FIXED: Only populate active posts
        select: 'description postType createdAt'
      })
      .sort({ likedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter out likes where post is null (deleted posts)
    const activeLikes = likes.filter(like => like.post !== null);

    // Get user's comments (only active comments on active posts)
    const comments = await CommunityComment.find({ userEmail, isActive: true })
      .populate({
        path: 'post',
        match: { isActive: true }, // FIXED: Only populate active posts
        select: 'description postType createdAt'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter out comments where post is null (deleted posts)
    const activeComments = comments.filter(comment => comment.post !== null);

    // Get user's shares (only for active posts)
    const shares = await CommunityShare.find({ userEmail })
      .populate({
        path: 'post',
        match: { isActive: true }, // FIXED: Only populate active posts
        select: 'description postType createdAt'
      })
      .sort({ sharedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter out shares where post is null (deleted posts)
    const activeShares = shares.filter(share => share.post !== null);

    res.json({
      likes: activeLikes,
      comments: activeComments,
      shares: activeShares,
      currentPage: parseInt(page),
      totalPages: Math.ceil(Math.max(activeLikes.length, activeComments.length, activeShares.length) / limit)
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  keepAlive(); // Start the enhanced keep-alive mechanism
});
