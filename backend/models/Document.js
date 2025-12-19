const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  
  name: { type: String, required: true },
  type: { type: String, enum: ["file", "folder", "link", "excel"], required: true },
  
  
  originalName: String,
  storedName: String,
  mimeType: String,
  size: Number,
  gcsPath: String,
  driveFileId: String,
storageProvider: {
  type: String,
  enum: ["gcs", "drive"],
  default: "drive"
},

  embedding: { type: [Number], default: [] },
  
  
  url: String,
  
  
  jsonData: { type: mongoose.Schema.Types.Mixed, default: null },
  sheetNames: [String],
  rowCount: Number,
  columnCount: Number,
  
  
  excelCheckmarkFields: [{
    fieldName: String,
    fieldId: String,
    checkmarkType: {
      type: String,
      enum: ['checkbox', 'check', 'circle', 'star', 'heart'],
      default: 'checkbox'
    },
    createdAt: Date
  }],
  
  
  rowCheckmarks: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
  path: { type: String, default: "/" },
  
  
  bookmarkEnabled: { type: Boolean, default: false },
  bookmarks: [{
    userId: { type: String, required: true },
    bookmarkedAt: { type: Date, default: Date.now }
  }],
  
  
  
  
  accessLevel: {
    type: String,
    enum: ['public', 'private', 'locked'],
    default: 'public'
  },
  
  
  
  
  
  privateAccessLinks: [{
    linkId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    accessCount: { type: Number, default: 0 },
    maxAccessCount: { type: Number, default: null }, 
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    isActive: { type: Boolean, default: true }
  }],
  
  
  grantedUsers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    grantedAt: { type: Date, default: Date.now },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
  }],
  
  
  inheritParentAccess: { type: Boolean, default: false },
  
  
  isGlobalLock: { type: Boolean, default: false },
  
  
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});


const AccessRequestSchema = new mongoose.Schema({
  documentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Document", 
    required: true 
  },
  
  
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
  
  
  requestMessage: { type: String, required: true },
  requestedAt: { type: Date, default: Date.now },
  
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  
  adminResponse: String,
  respondedAt: Date,
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  
  
  accessLink: String,
  accessLinkId: String,
  accessLinkExpiry: Date,
  
  
  requestEmailSent: { type: Boolean, default: false },
  responseEmailSent: { type: Boolean, default: false }
});


DocumentSchema.index({ parent: 1 });
DocumentSchema.index({ type: 1 });
DocumentSchema.index({ path: 1 });
DocumentSchema.index({ "bookmarks.userId": 1 });
DocumentSchema.index({ accessLevel: 1 });
DocumentSchema.index({ "privateAccessLinks.linkId": 1 });
DocumentSchema.index({ "grantedUsers.userId": 1 });


AccessRequestSchema.index({ documentId: 1 });
AccessRequestSchema.index({ status: 1 });
AccessRequestSchema.index({ userEmail: 1 });
AccessRequestSchema.index({ requestedAt: -1 });


DocumentSchema.methods.getFullPath = async function() {
  if (!this.parent) return "/" + this.name;
  
  const parentDoc = await mongoose.model("Document").findById(this.parent);
  if (!parentDoc) return "/" + this.name;
  
  const parentPath = await parentDoc.getFullPath();
  return parentPath + "/" + this.name;
};


DocumentSchema.methods.hasAccess = async function(userId, linkId = null) {
  
  const checkAncestorAccess = async (docId) => {
    const doc = await mongoose.model("Document").findById(docId);
    if (!doc) return { allowed: false, reason: 'Document not found' };

    if (doc.accessLevel === 'locked') {
      return { allowed: false, reason: 'Document or parent folder is locked' };
    }

    if (doc.accessLevel === 'private') {
      let hasPrivateAccess = false;

      if (linkId) {
        const link = doc.privateAccessLinks.find(l => 
          l.linkId === linkId && 
          l.isActive && 
          (!l.expiresAt || l.expiresAt > new Date()) &&
          (!l.maxAccessCount || l.accessCount < l.maxAccessCount)
        );
        if (link) hasPrivateAccess = true;
      }

      if (!hasPrivateAccess && userId) {
        const granted = doc.grantedUsers.find(g => 
          g.userId.toString() === userId.toString()
        );
        if (granted) hasPrivateAccess = true;
      }

      if (!hasPrivateAccess) {
        return { allowed: false, reason: 'Document or parent folder is private' };
      }
    }

    if (doc.parent) {
      return await checkAncestorAccess(doc.parent);
    }

    return { allowed: true };
  };

  const result = await checkAncestorAccess(this._id);
  return result.allowed;
};

DocumentSchema.pre("save", async function(next) {
  if (this.isModified("parent") || this.isModified("name")) {
    this.path = await this.getFullPath();
  }
  this.updatedAt = new Date();
  next();
});

const Document = mongoose.model("Document", DocumentSchema);
const AccessRequest = mongoose.model("AccessRequest", AccessRequestSchema);

module.exports = { Document, AccessRequest };