// ============================================
// SERVER-SIDE: utils/GenerateFingerprint.js
// ============================================
const crypto = require('crypto');

/**
 * Generate a robust device fingerprint combining multiple factors
 * @param {object} clientData - Client fingerprint data from browser
 * @param {object} req - Express request object
 * @returns {string} - Hashed fingerprint
 */
const generateRobustFingerprint = (clientData, req) => {
  // Server-side data
  //new fingerprint
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  
  // Client-side data (from browser fingerprinting)
  const {
    canvas,
    webgl,
    fonts,
    audio,
    screen,
    timezone,
    language,
    platform,
    hardwareConcurrency,
    deviceMemory,
    plugins,
    colorDepth,
    touchSupport,
    vendor,
    renderer
  } = clientData || {};

  // Create fingerprint components array
  const components = [
    // Network layer
    ip,
    
    // Browser/User Agent
    userAgent,
    
    // Hardware identifiers
    canvas || '',
    webgl || '',
    audio || '',
    renderer || '',
    
    // System information
    platform || '',
    hardwareConcurrency || '',
    deviceMemory || '',
    
    // Display information
    screen?.width || '',
    screen?.height || '',
    screen?.colorDepth || '',
    colorDepth || '',
    screen?.pixelRatio || '',
    
    // Browser capabilities
    fonts || '',
    plugins || '',
    touchSupport || '',
    vendor || '',
    
    // Locale information
    timezone || '',
    language || ''
  ];

  // Filter out empty values and join
  const fingerprintString = components
    .filter(component => component && component !== '')
    .join('|');
  
  // Generate multiple hashes for better entropy
  const primaryHash = crypto
    .createHash('sha256')
    .update(fingerprintString)
    .digest('hex');
  
  // Create a secondary hash using different algorithm for verification
  const secondaryHash = crypto
    .createHash('sha512')
    .update(fingerprintString)
    .digest('hex')
    .substring(0, 32);
  
  // Combine both hashes
  const combinedFingerprint = `${primaryHash.substring(0, 32)}-${secondaryHash}`;
  
  return combinedFingerprint;
};

/**
 * Extract client IP from Express request
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.headers['cf-connecting-ip'] || // Cloudflare
    req.headers['x-client-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress ||
    'unknown'
  );
};

/**
 * Extract User-Agent from Express request
 */
const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Complete fingerprint generation from request
 * Expects clientData to be sent from frontend
 */
const getFingerprintFromRequest = (req) => {
  // Get client fingerprint data from request body or query
  const clientData = req.body?.fingerprintData || req.query?.fingerprintData || {};
  
  return generateRobustFingerprint(clientData, req);
};

/**
 * Fallback fingerprint for compatibility
 * Uses only server-side data if client data not available
 */
const generateFallbackFingerprint = (req) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  
  const fingerprint = `${ip}:${userAgent}`;
  
  return crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex');
};

module.exports = {
  generateRobustFingerprint,
  getClientIp,
  getUserAgent,
  getFingerprintFromRequest,
  generateFallbackFingerprint
};