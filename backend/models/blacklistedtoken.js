const mongoose = require('mongoose');
const blacklistedTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '24h' } // Tokens expire after 24 hours
});
module.exports = mongoose.model('BlacklistedToken', blacklistedTokenSchema);
