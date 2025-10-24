const mongoose = require('mongoose');

const querySchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  queryText: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'replied', 'closed'],
    default: 'pending'
  },
  adminReply: {
    type: String,
    trim: true,
    default: null
  },
  repliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  repliedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Generate unique 6-digit ticket ID
querySchema.statics.generateTicketId = async function () {
  let ticketId;
  let exists = true;

  while (exists) {
    const timestampPart = Date.now().toString().slice(-9); // last 9 digits of timestamp
    const randomPart = Math.floor(100 + Math.random() * 900).toString(); // 3-digit random
    
    ticketId = `QRY${timestampPart}${randomPart}`; // final ID
    
    exists = await this.findOne({ ticketId });
  }

  return ticketId;
};

const Query = mongoose.model('Query', querySchema);

module.exports = Query;