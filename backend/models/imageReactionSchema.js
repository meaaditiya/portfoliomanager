const mongoose = require('mongoose');
const imageReactionSchema = new mongoose.Schema({
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
      required: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
imageReactionSchema.index({ post: 1, 'user.email': 1 }, { unique: true });
imageReactionSchema.index({ post: 1, 'user.deviceId': 1 }, { unique: true });
module.exports= mongoose.model('ImageReaction', imageReactionSchema);