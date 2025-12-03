const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  
  name: { type: String, required: true },  
  type: { type: String, enum: ["file", "folder", "link"], required: true },
  
  
  originalName: String,        
  storedName: String,          
  mimeType: String,
  size: Number,
  gcsPath: String,
  embedding: { type: [Number], default: [] },
  
  // Link-specific fields
  url: String,  // The actual URL for link type
  
  
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
  path: { type: String, default: "/" },  
  
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});


DocumentSchema.index({ parent: 1 });
DocumentSchema.index({ type: 1 });
DocumentSchema.index({ path: 1 });


DocumentSchema.methods.getFullPath = async function() {
  if (!this.parent) return "/" + this.name;
  
  const parentDoc = await mongoose.model("Document").findById(this.parent);
  if (!parentDoc) return "/" + this.name;
  
  const parentPath = await parentDoc.getFullPath();
  return parentPath + "/" + this.name;
};


DocumentSchema.pre("save", async function(next) {
  if (this.isModified("parent") || this.isModified("name")) {
    this.path = await this.getFullPath();
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Document", DocumentSchema);