const mongoose = require('mongoose');
// Fixed CommunityLike schema
const communityLikeSchema = new mongoose.Schema({
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
  likedAt: {
    type: Date,
    default: Date.now
  }
});
module.exports = mongoose.model('CommunityLike', communityLikeSchema);