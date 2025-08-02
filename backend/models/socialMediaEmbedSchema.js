const mongoose = require('mongoose');
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
module.exports = mongoose.model('SocialMediaEmbed', socialMediaEmbedSchema);