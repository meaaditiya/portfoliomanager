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
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', 'https://connectwithaaditiya.onrender.com', 'https://connectwithaaditiyamg.onrender.com','https://connectwithaaditiyaadmin.onrender.com','http://192.168.1.33:5173','http://192.168.1.33:5174'];
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




// Blog Model
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
  
  // Create slug from title
  blogSchema.pre('save', function(next) {
    if (this.isModified('title')) {
      this.slug = this.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '-');
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
      const { title, content, summary, status, tags, featuredImage } = req.body;
      
      // Validate required fields
      if (!title || !content || !summary) {
        return res.status(400).json({ message: 'Title, content, and summary are required' });
      }
      
      const newBlog = new Blog({
        title,
        content,
        summary,
        author: req.user.admin_id,
        status: status || 'draft',
        tags: tags || [],
        featuredImage
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
      
      // Get total count for pagination info
      const total = await Blog.countDocuments(filter);
      
      res.json({
        blogs,
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
      
      res.json(blog);
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
      const allowedUpdates = ['title', 'content', 'summary', 'status', 'tags', 'featuredImage'];
      
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          blog[field] = updates[field];
        }
      });
      
      await blog.save();
      
      res.json({
        message: 'Blog post updated successfully',
        blog
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
  
  // Contact Routes to add to your app.js
  // Submit a new contact message
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
      
      // Send confirmation email to user
      const confirmationEmail = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thank You for Reaching Out</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #007bff;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .greeting {
              font-size: 18px;
              color: #495057;
              margin-bottom: 20px;
            }
            .message-content {
              background-color: #f8f9fa;
              padding: 20px;
              border-left: 4px solid #007bff;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #dee2e6;
              text-align: center;
              color: #6c757d;
            }
            .signature {
              margin-top: 25px;
              font-weight: 500;
              color: #495057;
            }
            .icon {
              display: inline-block;
              width: 20px;
              height: 20px;
              margin-right: 8px;
              vertical-align: middle;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✨ Thank You for Reaching Out!</h1>
            </div>
            
            <div class="greeting">
              Hello <strong>${name}</strong>,
            </div>
            
            <p>Thank you for taking the time to contact me! I truly appreciate you reaching out and I'm excited to connect with you.</p>
            
            <p>I have successfully received your message and I will get back to you very soon. I make it a priority to respond to all inquiries within 24-48 hours.</p>
            
            <div class="message-content">
              <p><strong>📝 Your Message:</strong></p>
              <p><em>${message}</em></p>
            </div>
            
            <p>In the meantime, feel free to explore more of my work or connect with me on social media. I look forward to our conversation!</p>
            
            <div class="footer">
              <p>This is an automated confirmation. Please do not reply to this email.</p>
              <div class="signature">
                <p>Best regards,<br/>
                <strong>Aditya Tyagi</strong><br/>
                <em>Looking forward to connecting with you!</em></p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      await sendEmail(email, 'Thank You for Reaching Out - I\'ll Be in Touch Soon!', confirmationEmail);
      
      // Send notification to admin
      const adminNotification = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contact Message</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #28a745, #20c997);
              color: white;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin-bottom: 25px;
            }
            .contact-info {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 15px 0;
            }
            .message-box {
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .label {
              font-weight: 600;
              color: #495057;
              margin-bottom: 5px;
            }
            .action-note {
              background-color: #d1ecf1;
              border: 1px solid #bee5eb;
              padding: 15px;
              border-radius: 6px;
              margin-top: 20px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🔔 New Contact Message Received</h2>
            </div>
            
            <div class="contact-info">
              <div class="label">👤 From:</div>
              <p><strong>${name}</strong></p>
              
              <div class="label">📧 Email:</div>
              <p><strong>${email}</strong></p>
            </div>
            
            <div class="message-box">
              <div class="label">💬 Message:</div>
              <p>${message}</p>
            </div>
            
            <div class="action-note">
              <p><strong>Action Required:</strong> Please log in to the admin panel to respond to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Find admin email - assuming first admin or use a dedicated notifications email
      const admin = await Admin.findOne();
      if (admin) {
        await sendEmail(admin.email, '🔔 New Contact Message Received', adminNotification);
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
  // Get all messages (for admin)
  app.get('/api/admin/messages', authenticateToken, async (req, res) => {
    try {
      const messages = await Message.find().sort({ createdAt: -1 });
      res.json(messages);
    } catch (error) {
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
      
      res.json({ message, replies });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Reply to a message (for admin)
  app.post('/api/admin/messages/:id/reply', authenticateToken, async (req, res) => {
    try {
      const { replyContent } = req.body;
      const messageId = req.params.id;
      const adminId = req.user.admin_id;
      
      // Find the message
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }
      
      // Create the reply
      const newReply = new Reply({
        messageId,
        replyContent,
        repliedBy: adminId
      });
      
      await newReply.save();
      
      // Update message status
      message.status = 'replied';
      message.replied = true;
      await message.save();
      
      // Send reply email to user - ONLY the reply content
      const replyEmail = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Response from Aditya Tyagi</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #007bff;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .greeting {
              font-size: 18px;
              color: #495057;
              margin-bottom: 25px;
            }
            .reply-content {
              background-color: #f8f9fa;
              padding: 25px;
              border-left: 4px solid #007bff;
              margin: 25px 0;
              border-radius: 6px;
              font-size: 16px;
              line-height: 1.7;
            }
            .footer {
              margin-top: 35px;
              padding-top: 25px;
              border-top: 1px solid #dee2e6;
              text-align: center;
            }
            .signature {
              color: #495057;
              font-weight: 500;
            }
            .contact-info {
              background-color: #e7f3ff;
              padding: 20px;
              border-radius: 8px;
              margin-top: 25px;
              text-align: center;
              font-size: 14px;
              color: #6c757d;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 Response from Aditya Tyagi</h1>
            </div>
            
            <div class="greeting">
              Hello <strong>${message.name}</strong>,
            </div>
            
            <div class="reply-content">
              ${replyContent}
            </div>
            
            <div class="footer">
              <div class="signature">
                <p>Best regards,<br/>
                <strong>Aditya Tyagi</strong></p>
              </div>
              
              <div class="contact-info">
                <p>If you have any further questions, feel free to reach out again. I'm always happy to help!</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      await sendEmail(message.email, 'Response from Aditya Tyagi', replyEmail);
      
      res.json({ 
        success: true, 
        message: 'Reply sent successfully',
        reply: newReply
      });
    } catch (error) {
      console.error('Reply error:', error);
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
      await Reply.deleteMany({ messageId: message._id });
      
      // Delete the message
      await Message.deleteOne({ _id: message._id });
      
      res.json({ message: 'Message and its replies deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get message stats (counts by status)
  app.get('/api/admin/message-stats', authenticateToken, async (req, res) => {
    try {
      const totalCount = await Message.countDocuments();
      const unreadCount = await Message.countDocuments({ status: 'unread' });
      const readCount = await Message.countDocuments({ status: 'read' });
      const repliedCount = await Message.countDocuments({ status: 'replied' });
      
      res.json({
        total: totalCount,
        unread: unreadCount,
        read: readCount,
        replied: repliedCount
      });
    } catch (error) {
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
      default: 'approved' // You can change to 'pending' if you want moderation
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  const Comment = mongoose.model('Comment', CommentSchema);
  
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
  
  // Get comments for a blog (public)
  app.get('/api/blogs/:blogId/comments', async (req, res) => {
    try {
      const { blogId } = req.params;
      
      // Pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Only get approved comments for public view
      const comments = await Comment.find({ 
        blog: blogId,
        status: 'approved'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
      const total = await Comment.countDocuments({
        blog: blogId,
        status: 'approved'
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
// Add these at the top of your app.js file
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
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

// Project Request Schema
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
  image: {
    type: Buffer,
    default: null
  },
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
// Submit project request (accessible to anyone)
app.post('/api/project/submit', upload.single('image'), async (req, res) => {
  try {
    const { name, email, projectType, description, budget, timeline, features, techPreferences, additionalInfo } = req.body;

    // Validate required inputs
    if (!name || !email || !projectType || !description) {
      return res.status(400).json({ message: 'Name, email, project type, and description are required' });
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
      image: req.file ? req.file.buffer : null
    });

    await newRequest.save();

    // Send confirmation email to user
    const confirmationEmail = `
      <h1>Project Request Received</h1>
      <p>Hello ${name},</p>
      <p>Your project request of type "${projectType}" has been received.</p>
      <p>We will review your request and get back to you soon.</p>
    `;

    await sendEmail(email, 'Project Request Confirmation', confirmationEmail);

    res.status(201).json({
      message: 'Project request submitted successfully. Check your email for confirmation.'
    });
  } catch (error) {
    console.error('Project submission error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all project requests (admin only)
app.get('/api/admin/project/requests', authenticateToken, async (req, res) => {
  try {
    const requests = await ProjectRequest.find()
      .sort({ createdAt: -1 })
      .select('-image'); // Exclude image data for list view

    res.json({ requests });
  } catch (error) {
    console.error('Error fetching project requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single project request with image (admin only)
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
// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  keepAlive(); // Start the enhanced keep-alive mechanism
});