const mongoose = require('mongoose');

const digestLogSchema = new mongoose.Schema({
  issueNumber: { type: Number, required: true },
  period: { type: String, enum: ['weekly', 'monthly'], required: true },
  sentAt: { type: Date, default: Date.now },
  blogIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Blog' }],
  blogCount: { type: Number, default: 0 },
  listId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionList' },
  recipientCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  triggeredBy: { type: String, default: 'cron' },
  status: { type: String, enum: ['sent', 'skipped', 'failed'], default: 'sent' },
  skipReason: { type: String, default: null }
});

digestLogSchema.index({ period: 1, sentAt: -1 });

module.exports = mongoose.model('DigestLog', digestLogSchema);