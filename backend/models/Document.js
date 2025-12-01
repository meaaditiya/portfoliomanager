const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  // Basic info
  name: { type: String, required: true },  // name for both files and folders
  type: { type: String, enum: ["file", "folder"], required: true },
  
  // File-specific fields (only for type: "file")
  originalName: String,        // user uploaded name
  storedName: String,          // name stored in GCS
  mimeType: String,
  size: Number,
  gcsPath: String,
  embedding: { type: [Number], default: [] },
  
  // Folder structure
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
  path: { type: String, default: "/" },  // full path like "/folder1/folder2"
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for faster queries
DocumentSchema.index({ parent: 1 });
DocumentSchema.index({ type: 1 });
DocumentSchema.index({ path: 1 });

// Method to get full path
DocumentSchema.methods.getFullPath = async function() {
  if (!this.parent) return "/" + this.name;
  
  const parentDoc = await mongoose.model("Document").findById(this.parent);
  if (!parentDoc) return "/" + this.name;
  
  const parentPath = await parentDoc.getFullPath();
  return parentPath + "/" + this.name;
};

// Pre-save hook to update path
DocumentSchema.pre("save", async function(next) {
  if (this.isModified("parent") || this.isModified("name")) {
    this.path = await this.getFullPath();
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Document", DocumentSchema);