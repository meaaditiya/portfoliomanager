const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    content: { 
      type: String, 
      required: true 
    },
    contentImages: [{
      url: {
        type: String,
        required: true
      },
      alt: {
        type: String,
        default: ''
      },
      caption: {
        type: String,
        default: ''
      },
      position: {
        type: String,
        enum: ['left', 'right', 'center', 'full-width'],
        default: 'center'
      },
      imageId: {
        type: String,
        required: true,
        unique: true
      }
    }],
    contentVideos: [{
      url: {
        type: String,
        required: true
      },
      videoId: {
        type: String,
        required: true
      },
      platform: {
        type: String,
        enum: ['youtube', 'vimeo', 'dailymotion'],
        default: 'youtube'
      },
      title: {
        type: String,
        default: ''
      },
      caption: {
        type: String,
        default: ''
      },
      position: {
        type: String,
        enum: ['left', 'right', 'center', 'full-width'],
        default: 'center'
      },
      autoplay: {
        type: Boolean,
        default: false
      },
      muted: {
        type: Boolean,
        default: false
      },
      embedId: {
        type: String,
        required: true,
        unique: true
      }
    }],
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Admin',
      required: true
    },
    slug: {
      type: String,
      required: false,
      unique: true,
      lowercase: true
    },
    status: { 
      type: String, 
      enum: ['draft', 'published'], 
      default: 'draft' 
    },
    tags: [{ 
      type: String, 
      trim: true 
    }],
    featuredImage: { 
      type: String 
    },
    publishedAt: { 
      type: Date 
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    },
    reactionCounts: {
      likes: {
        type: Number,
        default: 0
      },
      dislikes: {
        type: Number,
        default: 0
      }
    },
    commentsCount: {
      type: Number,
      default: 0
    },
    // UPDATED: Total reads (accurate count)
    totalReads: {
      type: Number,
      default: 0
    },
    // NEW: Array of unique fingerprints that have read this blog
    readFingerprints: [{
      fingerprint: {
        type: String,
        required: true
      },
      readAt: {
        type: Date,
        default: Date.now
      },
      readCount: {
        type: Number,
        default: 1
      }
    }],
    reports: [{
      userEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
      },
      reason: {
        type: String,
        required: true,
        trim: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    totalReports: {
      type: Number,
      default: 0
    }
});

// Index for faster fingerprint lookups
blogSchema.index({ 'readFingerprints.fingerprint': 1 });

blogSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '-');
  }
  
  if (this.isModified('contentImages')) {
    this.contentImages.forEach(image => {
      if (!image.imageId) {
        image.imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    });
  }
  
  if (this.isModified('contentVideos')) {
    this.contentVideos.forEach(video => {
      if (!video.embedId) {
        video.embedId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    });
  }
  
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  if (this.isModified('reports')) {
    this.totalReports = this.reports.length;
  }
  
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Blog', blogSchema);