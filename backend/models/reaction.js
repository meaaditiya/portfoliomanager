const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
  blog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
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

ReactionSchema.index({ blog: 1, 'user.email': 1 }, { unique: true });

module.exports = mongoose.model('Reaction', ReactionSchema);