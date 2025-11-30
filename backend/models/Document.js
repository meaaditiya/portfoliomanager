const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  originalName: String,        // user uploaded name
  storedName: String,          // name stored in GCS
  mimeType: String,
  size: Number,
  gcsPath: String,

  embedding: { type: [Number], default: [] },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Document", DocumentSchema);
