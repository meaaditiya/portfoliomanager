const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  purpose: { 
    type: String, 
    enum: ['registration', 'password_reset', 'contact_verification','audio_verification','project_verification'], 
    required: true 
  },
  createdAt: { type: Date, default: Date.now, expires: '10m' }
});

module.exports = mongoose.model('OTP', otpSchema);
