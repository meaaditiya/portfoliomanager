const mongoose = require('mongoose');
const ReplySchema = new mongoose.Schema({
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true
    },
    replyContent: {
      type: String,
      required: [true, 'Reply content is required']
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

module.exports = mongoose.model('Reply', mongoose.models.Reply || ReplySchema);