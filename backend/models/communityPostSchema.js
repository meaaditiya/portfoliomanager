const mongoose = require('mongoose');
const communityPostSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  postType: {
    type: String,
    enum: ['image', 'poll', 'video', 'quiz', 'link'],
    required: true
  },
  description: {
    type: String,
    required: false
  },
  // For image posts
  images: [{
    data: Buffer,
    contentType: String,
    filename: String
  }],
  // For video posts
  video: {
    data: Buffer,
    contentType: String,
    filename: String
  },
  caption:{
     type: String,
    required: false
  } ,
  // For poll posts
  pollOptions: [{
    option: String,
    votes: [{
      userEmail: String,
      userName: String,
      votedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  pollExpiresAt: Date,
  // For quiz posts
  quizQuestions: [{
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String
  }],
  // For link posts
  linkUrl: String,
  linkTitle: String,
  linkDescription: String,
  linkThumbnail: {
    data: Buffer,
    contentType: String
  },
  // Common fields
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityLike'
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityComment'
  }],
  shares: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityShare'
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
module.exports = mongoose.model('CommunityPost', communityPostSchema);