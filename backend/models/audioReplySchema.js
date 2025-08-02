const mongoose = require('mongoose');
const audioReplySchema = new mongoose.Schema({
  recordingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AudioRecording',
    required: true
  },
  replyContent: {
    type: String,
    required: true
  },
  repliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  repliedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AudioReply', audioReplySchema);