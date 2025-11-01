const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  // Authentication & Account Info
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  role: { type: String, default: 'admin' },
  isSuperAdmin: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'active', 'inactive'], default: 'pending' },
  lastLogin: { type: Date },
  
  // Profile Info
  profileImage: {
    data: Buffer,
    contentType: String
  },
  bio: { type: String, maxlength: 200 },
  designation: { type: String },
  
  // Social Links
  socialLinks: {
    twitter: { type: String },
    linkedin: { type: String },
    github: { type: String },
    portfolio: { type: String },
    instagram: { type: String },
    personalWebsite: { type: String },
    youtube: { type: String },
    medium: { type: String }
  },
  
  // Additional Info
  location: { type: String },
  expertise: [{ type: String }],
  interests: [{ type: String }],
  joinedDate: { type: Date, default: Date.now },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Admin', adminSchema);