const mongoose = require('mongoose');

const imagePostSchema = new mongoose.Schema({
  caption: {
    type: String,
    required: true,
    trim: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: true,
    default: 'image'
  },
  image: {
    url: String,
    publicId: String,
    contentType: String
  },
  video: {
    url: String,
    publicId: String,
    contentType: String,
    duration: Number,
    thumbnail: {
      url: String,
      publicId: String,
      contentType: String
    }
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  hideReactionCount: {
    type: Boolean,
    default: false
  },
  reactionCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
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

module.exports = mongoose.model('ImagePost', imagePostSchema);