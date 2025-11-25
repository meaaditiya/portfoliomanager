const mongoose = require('mongoose');
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
module.exports = mongoose.model('CommunityComment', communityCommentSchema);