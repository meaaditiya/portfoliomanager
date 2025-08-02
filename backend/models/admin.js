const mongoose = require('mongoose');
const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  role: { type: String, default: 'admin' },
  status: { type: String, enum: ['pending', 'active', 'inactive'], default: 'pending' },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Admin', adminSchema);