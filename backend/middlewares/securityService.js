const crypto = require('crypto');
const logger = require('../services/security/securityLogger');
const ipIntelligence = require('../services/security/ipIntelligence');
const threatDetector = require('../services/security/threatDetector');
const rateLimiter = require('../services/security/rateLimiter');
const requestAnalyzer = require('../services/security/requestAnalyzer');
const securityResponse = require('../services/security/securityResponse');

class SecurityService {
  constructor() {
    this.config = this.loadConfig();
    this.startCleanupInterval();
  }

  loadConfig() {
    try {
      const config = require('../Config/securityConfig');
      
      return {
        cleanup: {
          intervalMs: config.cleanup?.intervalMs ?? (60 * 60 * 1000)
        },
        actionThresholds: {
          block: config.actionThresholds?.block ?? 25,      // Increased from 10
          warn: config.actionThresholds?.warn ?? 12,        // Increased from 5
          banDuration: config.actionThresholds?.banDuration ?? (24 * 60 * 60 * 1000)
        },
        // ===== NEW: Load whitelisted endpoints =====
        whitelistedEndpoints: config.whitelist?.endpoints ?? [
          '/health',
          '/api/health',
          '/ping',
          '/status',
          '/metrics'
        ]
      };
    } catch (error) {
      console.warn('Failed to load securityConfig, using defaults:', error.message);
      
      return {
        cleanup: {
          intervalMs: 60 * 60 * 1000
        },
        actionThresholds: {
          block: 25,
          warn: 12,
          banDuration: 24 * 60 * 60 * 1000
        },
        whitelistedEndpoints: ['/health', '/api/health', '/ping', '/status', '/metrics']
      };
    }
  }

  // ===== NEW: Check if endpoint is whitelisted =====
  isWhitelistedEndpoint(path) {
    return this.config.whitelistedEndpoints.some(whitelisted => 
      path.startsWith(whitelisted)
    );
  }

  generateFingerprint(req) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'unknown';
    const acceptLanguage = req.get('accept-language') || '';
    const acceptEncoding = req.get('accept-encoding') || '';
    
    const fingerprintString = `${ip}:${userAgent}:${acceptLanguage}:${acceptEncoding}`;
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  startCleanupInterval() {
    setInterval(() => {
      try {
        ipIntelligence.cleanup();
        rateLimiter.cleanup();
        requestAnalyzer.cleanup();
        logger.log('info', 'Security service cleanup completed');
      } catch (error) {
        logger.log('error', 'Cleanup error', { error: error.message });
      }
    }, this.config.cleanup.intervalMs);
  }

  async securityMiddleware(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const fingerprint = this.generateFingerprint(req);

      // ===== CRITICAL FIX: Skip security checks for whitelisted endpoints =====
      if (this.isWhitelistedEndpoint(req.originalUrl)) {
        logger.logClean(req, fingerprint);
        return next();
      }

      // Check if IP is whitelisted
      if (ipIntelligence.isWhitelisted(ip)) {
        return next();
      }

      // Check if IP is blocked
      if (ipIntelligence.isBlocked(ip)) {
        const blockInfo = ipIntelligence.getBlockInfo(ip);
        const retryAfter = Math.ceil((blockInfo.until - Date.now()) / 1000);
        logger.logBlocked(req, fingerprint, blockInfo.reason, blockInfo.score);
        return securityResponse.sendBlockedResponse(res, blockInfo.reason, blockInfo.score, retryAfter);
      }

      // Track IP request
      ipIntelligence.trackIPRequest(ip);

      // Check global rate limit
      const globalLimit = rateLimiter.checkGlobalLimit();
      if (globalLimit.limited) {
        logger.log('warn', 'Global rate limit exceeded');
        return securityResponse.sendRateLimitResponse(res, globalLimit.message, globalLimit.retryAfter);
      }

      // Check IP rate limit
      const ipLimit = rateLimiter.checkIPLimit(ip);
      if (ipLimit.limited) {
        logger.log('warn', 'IP rate limit exceeded', { ip });
        return securityResponse.sendRateLimitResponse(res, ipLimit.message, ipLimit.retryAfter);
      }

      // Check fingerprint rate limit
      const fingerprintLimit = rateLimiter.checkFingerprintLimit(fingerprint);
      if (fingerprintLimit.limited) {
        logger.log('warn', 'Fingerprint rate limit exceeded', { fingerprint });
        return securityResponse.sendRateLimitResponse(res, fingerprintLimit.message, fingerprintLimit.retryAfter);
      }

      // Check sensitive route limit
      const sensitiveLimit = rateLimiter.checkSensitiveRoute(fingerprint, req.path);
      if (sensitiveLimit.limited) {
        logger.log('warn', 'Sensitive route rate limit exceeded', { fingerprint, path: req.path });
        return securityResponse.sendRateLimitResponse(res, sensitiveLimit.message, sensitiveLimit.retryAfter);
      }

      // Check download route limit
      const downloadLimit = rateLimiter.checkDownloadRoute(fingerprint, req.path);
      if (downloadLimit.limited) {
        logger.log('warn', 'Download route rate limit exceeded', { fingerprint, path: req.path });
        return securityResponse.sendRateLimitResponse(res, downloadLimit.message, downloadLimit.retryAfter);
      }

      // Track request for later analysis
      rateLimiter.trackRequest(fingerprint, req.originalUrl);

      // Threat detection
      const threatAnalysis = threatDetector.detectThreats(req);
      if (threatAnalysis.detected) {
        const primaryThreat = threatAnalysis.threats[0];
        logger.logThreat(req, fingerprint, primaryThreat.type, primaryThreat.pattern, threatAnalysis.totalScore);
        
        // Block only if threshold exceeded
        if (threatAnalysis.totalScore >= this.config.actionThresholds.block) {
          ipIntelligence.blockIP(ip, primaryThreat.type, this.config.actionThresholds.banDuration);
          return securityResponse.sendThreatResponse(res, primaryThreat.type, threatAnalysis.totalScore);
        }
      }

      // Behavior analysis
      const behaviorAnalysis = requestAnalyzer.analyzeRequest(req, fingerprint);
      
      // Calculate total score
      const totalScore = (threatAnalysis.totalScore || 0) + (behaviorAnalysis.score || 0);

      // ===== CRITICAL FIX: Increased threshold from 10 to 25 =====
      if (totalScore >= this.config.actionThresholds.block) {
        
        const reason = [
          ...threatAnalysis.threats.map(t => t.type),
          ...behaviorAnalysis.reasons
        ].join(', ');
        
        ipIntelligence.blockIP(ip, reason, this.config.actionThresholds.banDuration);
        logger.logBlocked(req, fingerprint, reason, totalScore);
        
        return securityResponse.sendBlockedResponse(
          res, 
          reason, 
          totalScore, 
          Math.ceil(this.config.actionThresholds.banDuration / 1000)
        );
      } else if (totalScore >= this.config.actionThresholds.warn) {
        
        const reasons = [
          ...threatAnalysis.threats.map(t => t.message),
          ...behaviorAnalysis.reasons
        ];
        
        logger.logSuspicious(req, fingerprint, reasons.join(', '), totalScore);
        securityResponse.sendSuspiciousWarning(res, reasons, totalScore);
        
        // Continue to next middleware (allow request)
        return next();
      } else {
        
        securityResponse.sendCleanResponse(res);
        logger.logClean(req, fingerprint);
        return next();
      }

    } catch (error) {
      
      logger.log('error', 'Security middleware error', { error: error.message, stack: error.stack });
      return next();  // Continue on error (don't break app)
    }
  }
}

const securityService = new SecurityService();

module.exports = securityService.securityMiddleware.bind(securityService);