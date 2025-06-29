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
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', 'https://connectwithaaditiya.onrender.com', 'https://connectwithaaditiyamg.onrender.com','https://connectwithaaditiyaadmin.onrender.com','http://192.168.1.33:5173','http://192.168.1.33:5174','http://192.168.1.34:5173'];
    // Allow requests with no origin (like mobile apps or curl requests)
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
const sendEmail = async (email, subject, html) => {
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




// Blog Model with Inline Image Support
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
      // Unique identifier to reference in content
      imageId: {
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
  
  // Create slug from title and generate unique image IDs
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
    const { title, content, summary, status, tags, featuredImage, contentImages } = req.body;
    
    // Validate required fields
    if (!title || !content || !summary) {
      return res.status(400).json({ message: 'Title, content, and summary are required' });
    }
    
    // Clean up contentImages to only include those referenced in content
    const cleanedImages = cleanupUnusedImages(content, contentImages || []);
    
    const newBlog = new Blog({
      title,
      content,
      summary,
      author: req.user.admin_id,
      status: status || 'draft',
      tags: tags || [],
      featuredImage,
      contentImages: cleanedImages
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
      
      // Add status filter if specified
      if (status) {
        filter.status = status;
      } else {
        // By default, public API only shows published posts
        const isAuthenticated = req.user?.admin_id;
        if (!isAuthenticated) {
          filter.status = 'published';
        }
      }
      
      // Add tag filter if specified
      if (tag) {
        filter.tags = tag;
      }
      
      // Add search filter if specified
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { summary: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Execute query with pagination
      const blogs = await Blog.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author', 'name email')
        .exec();
      
      // Process content to replace image placeholders with actual images
      const processedBlogs = blogs.map(blog => {
        const blogObj = blog.toObject();
        blogObj.processedContent = processContentImages(blogObj.content, blogObj.contentImages);
        return blogObj;
      });
      
      // Get total count for pagination info
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
  
  // Get a single blog post by ID or slug
  app.get('/api/blogs/:identifier', async (req, res) => {
    try {
      const { identifier } = req.params;
      
      // Determine if identifier is ObjectId or slug
      const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
      
      // Build query based on identifier type
      const query = isObjectId 
        ? { _id: identifier }
        : { slug: identifier };
      
      // Add status check for non-authenticated users
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
      blogObj.processedContent = processContentImages(blogObj.content, blogObj.contentImages);
      
      res.json(blogObj);
    } catch (error) {
      console.error('Error fetching blog:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update a blog post
 app.put('/api/blogs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Find blog post
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    // Check if user is the author or has admin rights
    if (blog.author.toString() !== req.user.admin_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this blog post' });
    }
    
    // Update only allowed fields
    const allowedUpdates = ['title', 'content', 'summary', 'status', 'tags', 'featuredImage', 'contentImages'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        blog[field] = updates[field];
      }
    });
    
    // Clean up unused images if content was updated
    if (updates.content !== undefined) {
      blog.contentImages = cleanupUnusedImages(updates.content, blog.contentImages);
    }
    
    await blog.save();
    
    const blogObj = blog.toObject();
    blogObj.processedContent = processContentImages(blogObj.content, blogObj.contentImages);
    
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

// Enhanced Email Templates
const getConfirmationEmailTemplate = (name, message) => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thank You for Reaching Out</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #2d3748;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
          }
          .header h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 25px;
          }
          .message-preview {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 25px;
            border-radius: 15px;
            margin: 25px 0;
            box-shadow: 0 10px 20px rgba(240, 147, 251, 0.3);
          }
          .message-preview h3 {
            font-size: 16px;
            margin-bottom: 15px;
            font-weight: 600;
          }
          .message-text {
            font-style: italic;
            line-height: 1.7;
            opacity: 0.95;
          }
          .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
          }
          .feature {
            background: #f8fafc;
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #4facfe;
          }
          .feature-icon {
            font-size: 24px;
            margin-bottom: 10px;
          }
          .feature h4 {
            color: #2d3748;
            margin-bottom: 8px;
            font-weight: 600;
          }
          .feature p {
            color: #718096;
            font-size: 14px;
          }
          .cta-section {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            margin: 25px 0;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            margin-top: 15px;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
          }
          .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          .social-links {
            margin: 20px 0;
          }
          .social-link {
            display: inline-block;
            margin: 0 10px;
            color: #4facfe;
            text-decoration: none;
            font-weight: 500;
          }
          .signature {
            color: #4a5568;
            font-weight: 600;
            font-size: 18px;
          }
          @media (max-width: 600px) {
            .email-container {
              margin: 10px;
              border-radius: 15px;
            }
            .header, .content, .footer {
              padding: 25px 20px;
            }
            .header h1 {
              font-size: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🚀 Thank You for Reaching Out!</h1>
            <p>Your message has been received and I'm excited to connect with you</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Hello <strong>${name}</strong>,
            </div>
            
            <p>Thank you for taking the time to contact me! I truly appreciate your interest and I'm thrilled to hear from you.</p>
            
            <div class="message-preview">
              <h3>📝 Your Message:</h3>
              <div class="message-text">"${message}"</div>
            </div>
            
            <div class="features">
              <div class="feature">
                <div class="feature-icon">⚡</div>
                <h4>Quick Response</h4>
                <p>I aim to respond within 24-48 hours</p>
              </div>
             
            </div>
            
            
          </div>
          
          <div class="footer">
            
            <div class="signature">
              <p>Best regards,<br/>
              <strong>Aditya Tyagi</strong><br/>
              <em style="color: #718096;">Looking forward to our conversation!</em></p>
            </div>
            <p style="color: #a0aec0; font-size: 12px; margin-top: 20px;">
              This is an automated confirmation. Please do not reply to this email.
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
        <title>New Contact Message</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            padding: 20px;
            line-height: 1.6;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
          }
          .header {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
          }
          .badge {
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
          }
          .content {
            padding: 40px 30px;
          }
          .contact-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border: 2px solid #dee2e6;
            border-radius: 15px;
            padding: 25px;
            margin: 20px 0;
          }
          .contact-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #dee2e6;
          }
          .avatar {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 20px;
            margin-right: 15px;
          }
          .contact-info h3 {
            color: #2d3748;
            font-size: 18px;
            margin-bottom: 5px;
          }
          .contact-info p {
            color: #718096;
            font-size: 14px;
          }
          .message-section {
            background: #fff;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 25px;
            margin: 20px 0;
          }
          .message-header {
            color: #4a5568;
            font-weight: 600;
            margin-bottom: 15px;
            font-size: 16px;
          }
          .message-content {
            color: #2d3748;
            line-height: 1.7;
            font-size: 15px;
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #4facfe;
          }
          .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 30px 0;
          }
          .btn {
            padding: 15px 25px;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            text-decoration: none;
            text-align: center;
            transition: all 0.3s ease;
          }
          .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
          }
          .btn-secondary {
            background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
            color: #2d3748;
            box-shadow: 0 5px 15px rgba(255, 234, 167, 0.4);
          }
          .timestamp {
            background: #e2e8f0;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 12px;
            color: #4a5568;
            text-align: center;
            margin: 20px 0;
          }
          .footer {
            background: #f8fafc;
            padding: 25px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            color: #718096;
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
            .avatar {
              margin: 0 0 15px 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🔔 New Contact Message</h1>
            <div class="badge">Requires Your Attention</div>
          </div>
          
          <div class="content">
            <div class="contact-card">
              <div class="contact-header">
                <div class="avatar">${name.charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                  <h3>${name}</h3>
                  <p>📧 ${email}</p>
                </div>
              </div>
            </div>
            
            <div class="message-section">
              <div class="message-header">💬 Message Content:</div>
              <div class="message-content">${message}</div>
            </div>
            
            <div class="timestamp">
              ⏰ Received: ${new Date().toLocaleString()}
            </div>
            
            <div class="action-buttons">
              <a href="#" class="btn btn-primary">📋 View in Admin Panel</a>
              <a href="mailto:${email}" class="btn btn-secondary">📧 Reply Directly</a>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Action Required:</strong> Please log in to the admin panel to manage this message.</p>
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
        <title>Response from Aditya Tyagi</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            line-height: 1.6;
          }
          .email-container {
            max-width: 650px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
          }
          .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 30px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header p {
            opacity: 0.9;
            font-size: 16px;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 22px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 30px;
            text-align: center;
          }
          .message-section {
            background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
            border: 2px solid #e2e8f0;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            position: relative;
            overflow: hidden;
          }
          .message-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 5px;
            height: 100%;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          }
          .reply-section {
            background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
            border: 2px solid #e2e8f0;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            position: relative;
            overflow: hidden;
          }
          .reply-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 5px;
            height: 100%;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          }
          .message-header, .reply-header {
            color: #4a5568;
            font-weight: 600;
            margin-bottom: 20px;
            font-size: 16px;
            display: flex;
            align-items: center;
          }
          .message-content, .reply-content {
            color: #2d3748;
            line-height: 1.8;
            font-size: 16px;
          }
          .signature-section {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            margin: 30px 0;
          }
          .signature {
            color: #2d3748;
            font-weight: 600;
            font-size: 18px;
          }
          .role {
            color: #718096;
            font-style: italic;
            margin-top: 5px;
          }
          .contact-section {
            background: #f8fafc;
            padding: 25px;
            border-radius: 12px;
            margin: 25px 0;
            text-align: center;
          }
          .contact-section h3 {
            color: #2d3748;
            margin-bottom: 15px;
          }
          .contact-links {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
          }
          .contact-link {
            color: #4facfe;
            text-decoration: none;
            font-weight: 500;
            padding: 8px 16px;
            border: 2px solid #4facfe;
            border-radius: 25px;
            transition: all 0.3s ease;
          }
          .footer {
            background: #2d3748;
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
          }
          .footer p {
            opacity: 0.8;
            line-height: 1.6;
          }
          @media (max-width: 600px) {
            .email-container {
              margin: 10px;
            }
            .header, .content {
              padding: 25px 20px;
            }
            .contact-links {
              flex-direction: column;
              align-items: center;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>📧 Personal Response</h1>
            <p>Thank you for your patience</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Hello <strong>${name}</strong> 👋
            </div>
            
            <div class="message-section">
              <div class="message-header">
                📝 Your Original Message:
              </div>
              <div class="message-content">
                ${originalMessage}
              </div>
            </div>
            
            <div class="reply-section">
              <div class="reply-header">
                💬 My Response:
              </div>
              <div class="reply-content">
                ${replyContent}
              </div>
            </div>
            
           
          </div>
          
          <div class="signature-section">
            <div class="signature">
              Best regards,<br/>
              <strong>Aditya Tyagi</strong>
            </div>
           
          </div>
          
          <div class="footer">
            <div class="footer-content">
              <h3>Thank You!</h3>
              <p>I appreciate your time and interest. Feel free to reach out anytime if you have more questions or just want to chat about technology, projects, or collaborations!</p>
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
      await sendEmail(email, '🚀 Thank You for Reaching Out - I\'ll Be in Touch Soon!', confirmationEmail);
      
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
      '📧 Personal Response from Aditya Tyagi',
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
  // Allow various file types
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
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
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 5 // Maximum 5 files
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
// Multer configuration for multiple file types (store in memory)

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
      <h1>Project Request Received</h1>
      <p>Hello ${name},</p>
      <p>Your project request of type "${projectType}" has been received.</p>
      ${fileList}
      <p>We will review your request and get back to you soon.</p>
    `;

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
      <h1>Project Request Acknowledged</h1>
      <p>Hello ${request.name},</p>
      <p>Your project request of type "${request.projectType}" has been acknowledged.</p>
      <p>Thank you for your submission!</p>
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  keepAlive(); // Start the enhanced keep-alive mechanism
});