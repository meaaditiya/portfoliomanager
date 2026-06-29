const cron = require('node-cron');
const { sendDigest } = require('../services/digestService');

function initDigestCron() {
  // Weekly: every Monday at 8:00 AM
 cron.schedule('35 1 * * 1', async () => {
    console.log('[Cron] Running weekly digest...');
    try {
      const result = await sendDigest({ period: 'weekly', triggeredBy: 'cron' });
      console.log('[Cron] Weekly digest result:', result.skipped ? `Skipped — ${result.reason}` : `Sent issue #${result.issueNumber} to ${result.successCount} subscribers`);
    } catch (err) {
      console.error('[Cron] Weekly digest error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  // Monthly: 1st of every month at 9:00 AM
  cron.schedule('0 9 1 * *', async () => {
    console.log('[Cron] Running monthly digest...');
    try {
      const result = await sendDigest({ period: 'monthly', triggeredBy: 'cron' });
      console.log('[Cron] Monthly digest result:', result.skipped ? `Skipped — ${result.reason}` : `Sent issue #${result.issueNumber} to ${result.successCount} subscribers`);
    } catch (err) {
      console.error('[Cron] Monthly digest error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[Digest Cron] Scheduled — weekly (Mon 8AM IST) + monthly (1st 9AM IST)');
}

module.exports = { initDigestCron };