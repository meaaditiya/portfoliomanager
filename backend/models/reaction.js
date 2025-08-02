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
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  // Compound index to prevent multiple reactions from the same user on the same blog
  ReactionSchema.index({ blog: 1, 'user.email': 1 }, { unique: true });
  
  module.exports = mongoose.model('Reaction', ReactionSchema);