const mongoose = require('mongoose');
const streamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  scheduledDate: {
    type: String,
    required: true 
  },
  scheduledTime: {
    type: String,
    required: true 
  },
  youtubeLink: {
    type: String,
    required: true
  },
  embedId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'ended'],
    default: 'scheduled'
  },
  password: {
    type: String,
    default: null,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Stream', streamSchema);