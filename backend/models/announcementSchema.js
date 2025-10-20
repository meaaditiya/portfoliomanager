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
  // Expiry fields
  expiresAt: {
    type: Date,
    default: null
  },
  isExpired: {
    type: Boolean,
    default: false
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
  
  // Auto-mark as expired if expiresAt is in the past
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.isExpired = true;
    this.isActive = false;
  }
  
  next();
});

// Method to check if announcement is expired
announcementSchema.methods.checkExpiry = function() {
  if (this.expiresAt && this.expiresAt < new Date() && !this.isExpired) {
    this.isExpired = true;
    this.isActive = false;
    return true;
  }
  return false;
};

// Static method to expire all announcements that have passed their expiry time
announcementSchema.statics.expireOldAnnouncements = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      expiresAt: { $lt: now },
      isExpired: false
    },
    {
      $set: { isExpired: true, isActive: false }
    }
  );
  return result;
};

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;