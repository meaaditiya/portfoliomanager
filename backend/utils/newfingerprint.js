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

// ============================================
// CLIENT-SIDE: Add to BlogPost.jsx or create utils/clientFingerprint.js
// ============================================

/**
 * CLIENT-SIDE FINGERPRINTING UTILITY
 * Add this to your React component or create a separate utility file
 */

// Canvas Fingerprinting
const getCanvasFingerprint = () => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    canvas.width = 200;
    canvas.height = 50;
    
    // Draw complex pattern
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('DeviceID 🎨 🔒', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('DeviceID 🎨 🔒', 4, 17);
    
    return canvas.toDataURL();
  } catch (e) {
    return null;
  }
};

// WebGL Fingerprinting
const getWebGLFingerprint = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return null;
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      return { vendor, renderer };
    }
    
    return null;
  } catch (e) {
    return null;
  }
};

// Audio Fingerprinting
const getAudioFingerprint = () => {
  return new Promise((resolve) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        resolve(null);
        return;
      }
      
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gainNode = context.createGain();
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
      
      gainNode.gain.value = 0;
      oscillator.type = 'triangle';
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(context.destination);
      
      scriptProcessor.onaudioprocess = function(event) {
        const output = event.outputBuffer.getChannelData(0);
        const hash = Array.from(output.slice(0, 100))
          .reduce((acc, val) => acc + Math.abs(val), 0);
        
        oscillator.disconnect();
        scriptProcessor.disconnect();
        analyser.disconnect();
        gainNode.disconnect();
        
        resolve(hash.toString());
      };
      
      oscillator.start(0);
      
      setTimeout(() => resolve(null), 1000);
    } catch (e) {
      resolve(null);
    }
  });
};

// Font Detection
const getFontFingerprint = () => {
  try {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
      'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
      'Impact', 'Lucida Console', 'Tahoma', 'Helvetica'
    ];
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    const testString = 'mmmmmmmmmmlli';
    const textSize = '72px';
    
    const baseMeasurements = baseFonts.map(font => {
      ctx.font = `${textSize} ${font}`;
      return ctx.measureText(testString).width;
    });
    
    const detectedFonts = testFonts.filter((font, index) => {
      const measurements = baseFonts.map((baseFont, i) => {
        ctx.font = `${textSize} '${font}', ${baseFont}`;
        return ctx.measureText(testString).width !== baseMeasurements[i];
      });
      
      return measurements.some(changed => changed);
    });
    
    return detectedFonts.join(',');
  } catch (e) {
    return null;
  }
};

// Screen Information
const getScreenFingerprint = () => {
  return {
    width: window.screen.width,
    height: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    colorDepth: window.screen.colorDepth,
    pixelDepth: window.screen.pixelDepth,
    pixelRatio: window.devicePixelRatio || 1
  };
};

// Plugin Detection
const getPluginsFingerprint = () => {
  try {
    if (!navigator.plugins) return null;
    
    const plugins = Array.from(navigator.plugins)
      .map(plugin => plugin.name)
      .sort()
      .join(',');
    
    return plugins;
  } catch (e) {
    return null;
  }
};

// Touch Support
const getTouchSupport = () => {
  return {
    maxTouchPoints: navigator.maxTouchPoints || 0,
    touchEvent: 'ontouchstart' in window,
    touchStart: 'TouchEvent' in window
  };
};

/**
 * MAIN CLIENT FINGERPRINT FUNCTION
 * Call this before making API requests
 */
const generateClientFingerprint = async () => {
  const canvas = getCanvasFingerprint();
  const webgl = getWebGLFingerprint();
  const audio = await getAudioFingerprint();
  const fonts = getFontFingerprint();
  const screen = getScreenFingerprint();
  const plugins = getPluginsFingerprint();
  const touchSupport = getTouchSupport();
  
  return {
    // Canvas & WebGL
    canvas: canvas ? canvas.substring(0, 100) : null,
    webgl: webgl?.renderer || null,
    
    // Audio
    audio,
    
    // Fonts & Plugins
    fonts,
    plugins,
    
    // Screen
    screen,
    colorDepth: window.screen.colorDepth,
    
    // Hardware
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemory: navigator.deviceMemory || null,
    
    // System
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    languages: navigator.languages?.join(',') || null,
    
    // Touch
    touchSupport: JSON.stringify(touchSupport),
    
    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    
    // Renderer
    renderer: webgl?.vendor || null
  };
};

// Export for use in React component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateClientFingerprint };
}