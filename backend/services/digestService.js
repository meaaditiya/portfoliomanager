const Blog = require('../models/blog');
const { SubscriptionList } = require('../models/emailSchema');
const DigestLog = require('../models/digestLogSchema');
const sendEmail = require('../utils/email');
const getDigestTemplate = require('../EmailTemplates/digestTemplate');

const SITE_URL = process.env.SITE_URL || 'https://aaditiya.dev';
const DIGEST_LIST_NAME = process.env.DIGEST_LIST_NAME || 'blog-newsletter';

async function getNextIssueNumber() {
  const last = await DigestLog.findOne({ status: 'sent' }).sort({ issueNumber: -1 });
  return last ? last.issueNumber + 1 : 1;
}

async function getNewBlogsSince(date) {
  return Blog.find({
    status: 'published',
    publishedAt: { $gte: date }
  })
    .select('title summary slug tags featuredImage readTime totalReads publishedAt')
    .sort({ publishedAt: -1 })
    .limit(10);
}

async function sendDigest({ period = 'weekly', triggeredBy = 'cron' }) {
  const now = new Date();
  const since = period === 'weekly'
    ? new Date(now - 30 * 24 * 60 * 60 * 1000)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const blogs = await getNewBlogsSince(since);

  if (blogs.length === 0) {
    const log = await DigestLog.create({
      issueNumber: await getNextIssueNumber(),
      period,
      blogIds: [],
      blogCount: 0,
      recipientCount: 0,
      failedCount: 0,
      triggeredBy,
      status: 'skipped',
      skipReason: 'No new blogs published in this period'
    });
    console.log(`[Digest] Skipped — no new posts since ${since.toISOString()}`);
    return { skipped: true, reason: 'No new posts', log };
  }

  const list = await SubscriptionList.findOne({ name: DIGEST_LIST_NAME, isActive: true });

  if (!list || list.subscribers.length === 0) {
    const log = await DigestLog.create({
      issueNumber: await getNextIssueNumber(),
      period,
      blogIds: blogs.map(b => b._id),
      blogCount: blogs.length,
      recipientCount: 0,
      failedCount: 0,
      triggeredBy,
      status: 'skipped',
      skipReason: 'No active subscribers found'
    });
    console.log('[Digest] Skipped — no subscribers on list:', DIGEST_LIST_NAME);
    return { skipped: true, reason: 'No subscribers', log };
  }

  const issueNumber = await getNextIssueNumber();
  const subject = period === 'weekly'
    ? `📬 ${blogs.length} new posts this week — The 1% Better Dev`
    : `📬 Monthly digest: ${blogs.length} posts from the blog`;

  let successCount = 0;
  let failCount = 0;

  for (const subscriber of list.subscribers) {
    try {
      const unsubscribeUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/public/unsubscribe/${subscriber.unsubscribeToken}`;
      const html = getDigestTemplate({ issueNumber, period, blogs, unsubscribeUrl, siteUrl: SITE_URL });
      await sendEmail(subscriber.email, subject, html);
      successCount++;
    } catch (err) {
      console.error(`[Digest] Failed to send to ${subscriber.email}:`, err.message);
      failCount++;
    }
  }

  const log = await DigestLog.create({
    issueNumber,
    period,
    blogIds: blogs.map(b => b._id),
    blogCount: blogs.length,
    listId: list._id,
    recipientCount: successCount,
    failedCount: failCount,
    triggeredBy,
    status: 'sent'
  });

  console.log(`[Digest] Issue #${issueNumber} sent — ${successCount} ok, ${failCount} failed`);
  return { sent: true, issueNumber, blogCount: blogs.length, successCount, failCount, log };
}

module.exports = { sendDigest };