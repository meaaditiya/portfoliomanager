const mongoose = require('mongoose');
const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  caption: {
    type: String,
    trim: true
  },
  link: {
    type: String,
    trim: true
  },
  image: {
    data: Buffer,
    contentType: String,
    filename: String
  },
  document: {
    data: Buffer,
    contentType: String,
    filename: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0
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

// Update the updatedAt timestamp before saving
announcementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Announcement = mongoose.model('Announcement', announcementSchema);
module.exports = Announcement;
