const cron = require('node-cron');
const { sendDigest } = require('../services/digestService');

function initDigestCron() {
  cron.schedule('17 20 * * *', async () => {
    console.log('[Cron] Running weekly digest...');
    try {
      const result = await sendDigest({ period: 'weekly', triggeredBy: 'cron' });
      console.log('[Cron] Weekly digest result:', result.skipped ? `Skipped — ${result.reason}` : `Sent issue #${result.issueNumber} to ${result.successCount} subscribers`);
    } catch (err) {
      console.error('[Cron] Weekly digest error:', err.message);
    }
  });

  cron.schedule('30 3 1 * *', async () => {
    console.log('[Cron] Running monthly digest...');
    try {
      const result = await sendDigest({ period: 'monthly', triggeredBy: 'cron' });
      console.log('[Cron] Monthly digest result:', result.skipped ? `Skipped — ${result.reason}` : `Sent issue #${result.issueNumber} to ${result.successCount} subscribers`);
    } catch (err) {
      console.error('[Cron] Monthly digest error:', err.message);
    }
  });

  console.log('[Digest Cron] Scheduled');
}

module.exports = { initDigestCron };