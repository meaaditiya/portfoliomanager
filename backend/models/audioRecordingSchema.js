const mongoose = require('mongoose');
const audioRecordingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  audioData: {
    type: Buffer,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  transcription: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied'],
    default: 'unread'
  },
  replied: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
module.exports= mongoose.model('AudioRecording', audioRecordingSchema);