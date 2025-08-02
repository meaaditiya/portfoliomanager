const mongoose = require('mongoose');
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['registration', 'password_reset'], required: true },
  createdAt: { type: Date, default: Date.now, expires: '10m' } // OTP expires after 10 minutes
});
module.exports =  mongoose.model('OTP', otpSchema);
