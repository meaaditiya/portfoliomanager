const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  socketId: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  page: {
    type: String,
    default: '/'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  firstVisit: {
    type: Date,
    default: Date.now
  },
  country: {
    type: String,
    default: 'Unknown'
  },
  city: {
    type: String,
    default: 'Unknown'
  }
}, {
  timestamps: true
});


visitorSchema.index({ sessionId: 1 }, { unique: true });
visitorSchema.index({ socketId: 1 });
visitorSchema.index({ isActive: 1 });
visitorSchema.index({ lastActivity: 1, isActive: 1 });
visitorSchema.index({ firstVisit: 1 });


visitorSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 });


visitorSchema.statics.getLiveCount = async function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.countDocuments({
    lastActivity: { $gte: fiveMinutesAgo },
    isActive: true
  });
};


visitorSchema.statics.markInactive = async function(sessionId) {
  return this.updateOne(
    { sessionId },
    { isActive: false, socketId: null }
  );
};


visitorSchema.statics.markInactiveBySocket = async function(socketId) {
  return this.updateOne(
    { socketId },
    { isActive: false, socketId: null }
  );
};


visitorSchema.statics.updateActivity = async function(sessionId, page, socketId = null) {
  const update = { 
    lastActivity: Date.now(),
    isActive: true,
    page: page || '/'
  };
  
  if (socketId) {
    update.socketId = socketId;
  }
  
  return this.findOneAndUpdate(
    { sessionId },
    update,
    { upsert: false, new: true }
  );
};

module.exports = mongoose.model('Visitor', visitorSchema);