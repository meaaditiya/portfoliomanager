const mongoose = require('mongoose');

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
      required: false
    }
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isAuthorComment: {
    type: Boolean,
    default: false
  },
  // Parent comment ID for replies
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImageComment',
    default: null
  },
  // Likes and dislikes
  likes: [{
    deviceId: String,
    email: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  dislikes: [{
    deviceId: String,
    email: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  likeCount: {
    type: Number,
    default: 0
  },
  dislikeCount: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'hidden'],
    default: 'active'
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

// Indexes
imageCommentSchema.index({ post: 1, status: 1, parentComment: 1, createdAt: -1 });
imageCommentSchema.index({ parentComment: 1 });
imageCommentSchema.index({ 'user.email': 1 });

// Pre-save middleware to update counts
imageCommentSchema.pre('save', function(next) {
  this.likeCount = this.likes.length;
  this.dislikeCount = this.dislikes.length;
  next();
});

module.exports = mongoose.model('ImageComment', imageCommentSchema);