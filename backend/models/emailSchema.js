const mongoose = require('mongoose');
const emailSchema = new mongoose.Schema({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  attachments: [{
    filename: String,
    contentType: String,
    data: Buffer,
    size: Number
  }],
  sentAt: { type: Date, default: Date.now },
  sentBy: { type: String, required: true }, // admin email or ID
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' }
});

module.exports = mongoose.model('Email', emailSchema);