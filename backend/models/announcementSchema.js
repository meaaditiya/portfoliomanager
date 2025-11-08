const mongoose = require('mongoose');
const marked = require('marked');
const DOMPurify = require('isomorphic-dompurify'); // npm install isomorphic-dompurify

// Configure marked to allow HTML
marked.setOptions({
  breaks: true,
  gfm: true,
  sanitize: false // We'll use DOMPurify instead for better control
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
    trim: true
  },
  captionFormat: {
    type: String,
    enum: ['markdown', 'plain'],
    default: 'markdown'
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

// Method to get rendered HTML from markdown with inline styles
announcementSchema.methods.getRenderedCaption = function() {
  if (this.captionFormat === 'markdown' && this.caption) {
    // Parse markdown to HTML
    const rawHtml = marked.parse(this.caption);
    
    // Sanitize HTML but allow style attributes and color-related tags
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