const mongoose = require('mongoose');
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


module.exports = mongoose.model('ProjectRequest', projectRequestSchema);