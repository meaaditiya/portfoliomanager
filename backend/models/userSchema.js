const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    isVerified: {
      type: Boolean,
      
      default: false
    },
    googleId: {
      type: String,
      default: null
    },
  
    profilePicture: {
      type: String,
      default: null
    },
    isPremium: {
  type: Boolean,
  default: false
}
  },
  
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
