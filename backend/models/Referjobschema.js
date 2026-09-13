const mongoose = require('mongoose');
const crypto = require('crypto');

const QuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['text', 'textarea', 'number', 'email', 'date', 'radio', 'checkbox', 'select', 'file'],
    default: 'text',
    required: true
  },
  options: [{ type: String, trim: true }],
  placeholder: { type: String, trim: true },
  required: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
}, { _id: true });

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questionText: { type: String, required: true },
  questionType: { type: String, required: true },
  answer: { type: mongoose.Schema.Types.Mixed, required: true }
}, { _id: false });

const StatusLogSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  color: { type: String, default: '#6b7280' },
  note: { type: String, trim: true },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, trim: true }
}, { _id: false });

const ReferralPostingSchema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  companyLogo: { url: String, publicId: String },
  roleTitle: { type: String, required: true, trim: true },
  department: { type: String, trim: true },
  location: { type: String, trim: true },
  jobType: {
    type: String,
    enum: ['full-time', 'part-time', 'internship', 'contract', 'freelance'],
    default: 'full-time'
  },
  experienceLevel: { type: String, trim: true },
  description: { type: String, trim: true },
  externalJobLink: { type: String, trim: true },
  questions: [QuestionSchema],
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const JobPostingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  companyLogo: { url: String, publicId: String },
  location: { type: String, trim: true },
  jobType: {
    type: String,
    enum: ['full-time', 'part-time', 'internship', 'contract', 'freelance'],
    default: 'full-time'
  },
  experienceLevel: { type: String, trim: true },
  salaryRange: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'INR' },
    isDisclosed: { type: Boolean, default: false }
  },
  description: { type: String, trim: true },
  applyMode: { type: String, enum: ['external', 'onsite'], default: 'external' },
  applyLink: { type: String, trim: true },
  questions: [QuestionSchema],
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const StatusOptionSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  color: { type: String, default: '#6b7280' },
  appliesTo: { type: String, enum: ['referral', 'job', 'both'], default: 'both' },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const ApplicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true, index: true },
  applicationType: { type: String, enum: ['referral', 'job'], required: true },
  postingModel: { type: String, enum: ['ReferralPosting', 'JobPosting'], required: true },
  postingId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'postingModel' },
  postingSnapshot: {
    companyName: String,
    roleTitle: String
  },
  applicantName: { type: String, required: true, trim: true },
  applicantEmail: { type: String, required: true, trim: true },
  applicantPhone: { type: String, trim: true },
  resume: {
    url: String,
    publicId: String,
    originalName: String
  },
  answers: [AnswerSchema],
  currentStatus: {
    label: { type: String, default: 'Applied' },
    color: { type: String, default: '#3b82f6' },
    note: { type: String, trim: true },
    updatedAt: { type: Date, default: Date.now }
  },
  statusHistory: [StatusLogSchema],
  ipAddress: { type: String, trim: true }
}, { timestamps: true });

ApplicationSchema.index({ postingId: 1, applicantEmail: 1 });

ApplicationSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('currentStatus')) {
    this.statusHistory.push({
      label: this.currentStatus.label,
      color: this.currentStatus.color,
      note: this.currentStatus.note,
      updatedAt: this.currentStatus.updatedAt || new Date(),
      updatedBy: this._statusUpdatedBy || undefined
    });
  }
  next();
});

ApplicationSchema.statics.generateApplicationId = function (type) {
  const prefix = type === 'job' ? 'JOB' : 'REF';
  const code = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  return `${prefix}-${code}`;
};

module.exports = {
  ReferralPosting: mongoose.model('ReferralPosting', ReferralPostingSchema),
  JobPosting: mongoose.model('JobPosting', JobPostingSchema),
  Application: mongoose.model('Application', ApplicationSchema),
  StatusOption: mongoose.model('StatusOption', StatusOptionSchema)
};