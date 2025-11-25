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
  
  images: [{
    data: Buffer,
    contentType: String,
    filename: String
  }],
  
  video: {
    data: Buffer,
    contentType: String,
    filename: String
  },
  caption:{
     type: String,
    required: false
  } ,
  
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
  
  quizQuestions: [{
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String
  }],
  
  linkUrl: String,
  linkTitle: String,
  linkDescription: String,
  linkThumbnail: {
    data: Buffer,
    contentType: String
  },
  
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