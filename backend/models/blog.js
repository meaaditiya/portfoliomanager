const mongoose = require('mongoose');
// Updated Blog Schema with Video Support
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
    // Array to store inline images used in content
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
    // Array to store inline videos used in content
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
      // Unique identifier to reference in content
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
    }
});

// Updated pre-save middleware to handle videos
blogSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '-');
  }
  
  // Generate unique IDs for new content images
  if (this.isModified('contentImages')) {
    this.contentImages.forEach(image => {
      if (!image.imageId) {
        image.imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    });
  }
  
  // Generate unique IDs for new content videos
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
  
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Blog', blogSchema);
