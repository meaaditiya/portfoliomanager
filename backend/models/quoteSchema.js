const mongoose = require('mongoose');
const quoteSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxLength: 500
  },
  author: {
    type: String,
    default: 'Aaditiya Tyagi',
    trim: true,
    maxLength: 100
  },
  addedBy: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
module.exports = mongoose.model('Quote', quoteSchema);