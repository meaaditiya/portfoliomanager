const mongoose = require('mongoose');
const marked = require('marked');
const DOMPurify = require('isomorphic-dompurify');


marked.setOptions({
  breaks: true,
  gfm: true,
  sanitize: false
});

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  titleColor: {
    type: String,
    default: '#000000',
    trim: true
  },
  caption: {
    type: String,
    trim: true,
    required: true
  },
  captionFormat: {
    type: String,
    enum: ['markdown', 'plain'],
    default: 'markdown'
  },
  
  captionImages: [{
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
      
    }
  }],
  
  captionVideos: [{
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
      
    }
  }],
  
  link: {
    url: {
      type: String,
      trim: true
    },
    name: {
      type: String,
      trim: true,
      default: 'Learn More'
    },
    openInNewTab: {
      type: Boolean,
      default: true
    }
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
  expiresAt: {
    type: Date,
    default: null
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
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


announcementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  
  if (this.isModified('captionImages')) {
    this.captionImages.forEach(image => {
      if (!image.imageId) {
        image.imageId = 'ann_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    });
  }
  
  
  if (this.isModified('captionVideos')) {
    this.captionVideos.forEach(video => {
      if (!video.embedId) {
        video.embedId = 'ann_vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    });
  }
  
  
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.isExpired = true;
    this.isActive = false;
  }
  
  next();
});


announcementSchema.methods.getRenderedCaption = function() {
  if (this.captionFormat === 'markdown' && this.caption) {
    const rawHtml = marked.parse(this.caption);
    
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'a', 'span', 'div',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'mark', 'small', 'sub', 'sup'
      ],
      ALLOWED_ATTR: [
        'style', 'class', 'href', 'target', 'rel',
        'color', 'bgcolor'
      ],
      ALLOWED_STYLES: {
        '*': {
          'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
          'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
          'font-weight': [/^\d+$/, /^bold$/, /^normal$/],
          'font-style': [/^italic$/, /^normal$/],
          'text-decoration': [/^underline$/, /^line-through$/, /^none$/],
          'font-size': [/^\d+(?:px|em|rem|%)$/],
          'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/]
        }
      }
    });
    
    return cleanHtml;
  }
  return this.caption;
};


announcementSchema.methods.checkExpiry = function() {
  if (this.expiresAt && this.expiresAt < new Date() && !this.isExpired) {
    this.isExpired = true;
    this.isActive = false;
    return true;
  }
  return false;
};


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