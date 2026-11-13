const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

bookmarkSchema.index({ user: 1, blog: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);