const mongoose = require('mongoose');
const marked = require('marked');
const DOMPurify = require('isomorphic-dompurify');

marked.setOptions({
  breaks: true,
  gfm: true,
  sanitize: false
});

const policyTabSchema = new mongoose.Schema({
  tabId: {
    type: String,
    required: true,
    trim: true
  },
  tabName: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: false
  },
  contentFormat: {
    type: String,
    enum: ['markdown', 'plain'],
    default: 'markdown'
  },
  images: [{
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
      required: true
    },
    publicId: String,
    filename: String
  }],
  videos: [{
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
      required: true
    },
    publicId: String,
    filename: String
  }],
  documents: [{
    url: {
      type: String,
      required: true
    },
    filename: String,
    publicId: String,
    documentId: {
      type: String,
      required: true
    }
  }],
  tabOrder: {
    type: Number,
    default: 0
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
}, { _id: true });

const policySchema = new mongoose.Schema({
  policyType: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  tabs: [policyTabSchema],
  isActive: {
    type: Boolean,
    default: true
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

policySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  this.tabs.forEach(tab => {
    tab.updatedAt = Date.now();
    
    if (tab.isModified && tab.isModified('images')) {
      tab.images.forEach(image => {
        if (!image.imageId) {
          image.imageId = 'pol_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
      });
    }
    
    if (tab.isModified && tab.isModified('videos')) {
      tab.videos.forEach(video => {
        if (!video.embedId) {
          video.embedId = 'pol_vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
      });
    }
    
    if (tab.isModified && tab.isModified('documents')) {
      tab.documents.forEach(doc => {
        if (!doc.documentId) {
          doc.documentId = 'pol_doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
      });
    }
  });
  
  next();
});

policySchema.methods.getRenderedTabContent = function(tabId) {
  const tab = this.tabs.find(t => t.tabId === tabId);
  
  if (!tab) {
    return null;
  }
  
  if (tab.contentFormat === 'markdown' && tab.content) {
    const rawHtml = marked.parse(tab.content);
    
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
  
  return tab.content;
};

policySchema.methods.getAllTabs = function() {
  return this.tabs.filter(tab => tab.isActive).sort((a, b) => a.tabOrder - b.tabOrder);
};

policySchema.methods.addTab = function(tabId, tabName, tabOrder = this.tabs.length) {
  const newTab = {
    tabId,
    tabName,
    content: '',
    contentFormat: 'markdown',
    images: [],
    videos: [],
    documents: [],
    tabOrder,
    isActive: true
  };
  
  this.tabs.push(newTab);
  return this;
};

policySchema.methods.updateTab = function(tabId, updates) {
  const tab = this.tabs.find(t => t.tabId === tabId);
  
  if (tab) {
    Object.assign(tab, updates);
    tab.updatedAt = Date.now();
    return true;
  }
  
  return false;
};

policySchema.methods.deleteTab = function(tabId) {
  const index = this.tabs.findIndex(t => t.tabId === tabId);
  
  if (index > -1) {
    this.tabs.splice(index, 1);
    return true;
  }
  
  return false;
};

policySchema.statics.findByPolicyType = function(policyType) {
  return this.findOne({ policyType });
};

const Policy = mongoose.model('Policy', policySchema);

module.exports = Policy;