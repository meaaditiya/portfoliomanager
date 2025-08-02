const mongoose = require('mongoose');
const MessageSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Name is required']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    message: {
      type: String,
      required: [true, 'Message content is required']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'replied'],
      default: 'unread'
    },
    replied: {
      type: Boolean,
      default: false
    }
});

module.exports = mongoose.model('Message', mongoose.models.Message || MessageSchema);
