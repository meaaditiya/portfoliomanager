const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  attachments: [{
    filename: String,
    contentType: String,
    url: String,
    size: Number
  }],
  sentAt: { type: Date, default: Date.now },
  sentBy: { type: String, required: true },
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
  listId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionList' },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' }
});

const subscriptionListSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  subscribers: [{
    email: { type: String, required: true },
    subscribedAt: { type: Date, default: Date.now },
    unsubscribeToken: { type: String, required: true }
  }],
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  markdownContent: { type: String, required: true },
  htmlContent: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

subscriptionListSchema.index({ 'subscribers.email': 1 });
subscriptionListSchema.index({ name: 1 });
emailSchema.index({ listId: 1 });
emailSchema.index({ sentAt: -1 });

module.exports = {
  Email: mongoose.model('Email', emailSchema),
  SubscriptionList: mongoose.model('SubscriptionList', subscriptionListSchema),
  EmailTemplate: mongoose.model('EmailTemplate', emailTemplateSchema)
};