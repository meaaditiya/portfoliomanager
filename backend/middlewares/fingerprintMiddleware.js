const { generateRobustFingerprint, generateFallbackFingerprint } = require('../utils/newfingerprint');

const attachFingerprint = (req, res, next) => {
  try {
    // Parse fingerprint data from header
    let fingerprintData = {};
    //new fingerprint
    const fingerprintHeader = req.headers['x-fingerprint-data'];
    
    if (fingerprintHeader) {
      try {
        fingerprintData = JSON.parse(fingerprintHeader);
      } catch (e) {
        console.error('Error parsing fingerprint:', e);
      }
    }
    
    // Generate fingerprint
    req.deviceFingerprint = Object.keys(fingerprintData).length > 0
      ? generateRobustFingerprint(fingerprintData, req)
      : generateFallbackFingerprint(req);
    
    next();
  } catch (error) {
    console.error('Fingerprint middleware error:', error);
    next();
  }
};

module.exports = attachFingerprint;