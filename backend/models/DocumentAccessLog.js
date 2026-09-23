const mongoose = require('mongoose');

const DocumentAccessLogSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    subjectId: { type: String, index: true },
    via: { type: String },
    grantId: { type: String },
    bytesServed: { type: Number, default: 0 },
    outcome: { type: String, enum: ['complete', 'aborted', 'denied'], required: true },
    ip: { type: String },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('DocumentAccessLog', DocumentAccessLogSchema);
