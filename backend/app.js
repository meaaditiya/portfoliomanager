require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

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
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', 'https://connectwithaaditiya.onrender.com', 'https://connectwithaaditiyamg.onrender.com'];
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
        <h1>Thank You for Contacting Us</h1>
        <p>Hello ${name},</p>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p>Your message:</p>
        <blockquote>${message}</blockquote>
        <p>Best regards,<br/>Aditya Tyagi</p>
      `;
      
      await sendEmail(email, 'Thank You for Your Message', confirmationEmail);
      
      // Send notification to admin
      const adminNotification = `
        <h1>New Contact Message</h1>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Message:</strong></p>
        <blockquote>${message}</blockquote>
        <p>Please log in to the admin panel to respond.</p>
      `;
      
      // Find admin email - assuming first admin or use a dedicated notifications email
      const admin = await Admin.findOne();
      if (admin) {
        await sendEmail(admin.email, 'New Contact Message Received', adminNotification);
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
      
      // Send reply email to user
      const replyEmail = `
        <h1>Response to Your Inquiry</h1>
        <p>Hello ${message.name},</p>
        <p>Thank you for reaching out. Here is our response to your message:</p>
        <p><strong>Your original message:</strong></p>
        <blockquote>${message.message}</blockquote>
        <p><strong>Our response:</strong></p>
        <div>${replyContent}</div>
        <p>If you have any further questions, please don't hesitate to contact us again.</p>
        <p>Best regards,<br/>Aditya Tyagi</p>
      `;
      
      await sendEmail(message.email, 'Response to Your Inquiry', replyEmail);
      
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


// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});