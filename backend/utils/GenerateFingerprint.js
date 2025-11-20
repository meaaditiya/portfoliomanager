// utils/generateFingerprint.js
const crypto = require('crypto');

/**
 * Generate a unique fingerprint based on IP and User-Agent
 * @param {string} ip - Client IP address
 * @param {string} userAgent - Client User-Agent string
 * @returns {string} - Hashed fingerprint
 */
const generateFingerprint = (ip, userAgent) => {
  if (!ip || !userAgent) {
    throw new Error('IP and User-Agent are required to generate fingerprint');
  }

  // Create a unique combination
  const fingerprint = `${ip}:${userAgent}`;
  
  // Hash it using SHA-256
  const hash = crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex');
  
  return hash;
};

/**
 * Extract client IP from Express request
 * Handles proxies and various network configurations
 * @param {object} req - Express request object
 * @returns {string} - Client IP address
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress ||
    'unknown'
  );
};

/**
 * Extract User-Agent from Express request
 * @param {object} req - Express request object
 * @returns {string} - User-Agent string
 */
const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Complete fingerprint generation from request
 * @param {object} req - Express request object
 * @returns {string} - Hashed fingerprint
 */
const getFingerprintFromRequest = (req) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  return generateFingerprint(ip, userAgent);
};

module.exports = {
  generateFingerprint,
  getClientIp,
  getUserAgent,
  getFingerprintFromRequest
};