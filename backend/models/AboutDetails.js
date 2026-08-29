const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String },
    publicId: { type: String }
  },
  { _id: false }
);

const skillSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  logo: imageSchema,
  order: { type: Number, default: 0 }
});

const experienceSchema = new mongoose.Schema({
  role: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  companyLogo: imageSchema,
  startDate: { type: String, required: true, trim: true }, // free text e.g. "21 Jul 2026"
  endDate: { type: String, default: 'Present', trim: true },
  order: { type: Number, default: 0 }
});

const educationSchema = new mongoose.Schema({
  degree: { type: String, required: true, trim: true },
  school: { type: String, required: true, trim: true },
  schoolLogo: imageSchema,
  duration: { type: String, required: true, trim: true },
  grade: { type: String, trim: true },
  order: { type: Number, default: 0 }
});

// The "open to work" style rotating badges shown behind the resume button
const jobStatusSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  color: { type: String, default: '#22c55e' },
  order: { type: Number, default: 0 }
});

const aboutDetailsSchema = new mongoose.Schema(
  {
    heroTitlePrefix: { type: String, default: 'Full-Stack' },
    heroTitleHighlight: { type: String, default: 'Developer' },

    summaryPoints: [{ type: String, trim: true }],

    skills: [skillSchema],
    experience: [experienceSchema],
    education: [educationSchema],
    jobStatuses: [jobStatusSchema],

    resume: {
      url: String,
      publicId: String,
      originalName: String,
      uploadedAt: Date
    }
  },
  { timestamps: true }
);

// This document is a singleton (one "About" record for the whole site),
// the same pattern your Quote model already uses.
module.exports = mongoose.model('AboutDetails', aboutDetailsSchema);