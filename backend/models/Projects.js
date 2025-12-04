const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  period: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  teamSize: {
    type: Number,
    required: true,
    min: 1
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  detailedDescription: [{
    type: String,
    trim: true,
    maxlength: 500
  }],
  tech: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  outcomes: [{
    type: String,
    trim: true,
    maxlength: 500
  }],
  link: {
    type: String,
    trim: true,
    maxlength: 500
  },
  githubUrl: {
    type: String,
    trim: true,
    maxlength: 500
  },
  color: {
    type: String,
    trim: true,
    maxlength: 50
  },
  imageUrl: {
    type: String,
    trim: true,
    maxlength: 500
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Project', projectSchema);