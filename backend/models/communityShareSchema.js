const mongoose = require('mongoose');
const communityShareSchema = new mongoose.Schema({
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
  sharedAt: {
    type: Date,
    default: Date.now
  }
});
module.exports =  mongoose.model('CommunityShare', communityShareSchema);
