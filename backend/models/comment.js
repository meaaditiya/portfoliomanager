const mongoose = require('mongoose');

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
    },
    // ✅ ADD THIS - Link to User collection
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  fingerprint: {
    type: String,
    default: null
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
  isAuthorComment: {
    type: Boolean,
    default: false
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  repliesCount: {
    type: Number,
    default: 0
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Comment', CommentSchema);