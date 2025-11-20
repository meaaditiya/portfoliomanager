const mongoose = require('mongoose');

const CommentReactionSchema = new mongoose.Schema({
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'dislike'],
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
    }
  },
  // NEW: Fingerprint for tracking unique users
  fingerprint: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

CommentReactionSchema.index({ comment: 1, 'user.email': 1 }, { unique: true });

module.exports = mongoose.model('CommentReaction', CommentReactionSchema);