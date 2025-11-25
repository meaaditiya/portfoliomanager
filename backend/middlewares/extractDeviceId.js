const crypto = require("crypto");
const extractDeviceId = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  req.deviceId = crypto
    .createHash('md5')
    .update(userAgent + ip)
    .digest('hex');

  next();
};

module.exports = extractDeviceId;
