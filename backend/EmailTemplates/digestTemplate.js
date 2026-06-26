const getDigestTemplate = ({ issueNumber, period, blogs, unsubscribeUrl, siteUrl = 'https://aaditiya.dev' }) => {
  const periodLabel = period === 'weekly' ? 'Weekly Digest' : 'Monthly Digest';
  const blogCount = blogs.length;

  const blogRows = blogs.map((blog) => {
    const tagColor = getTagColor(blog.tags?.[0]);
    const blogUrl = `${siteUrl}/blog/${blog.slug}`;
    return `
      <div style="padding: 1.125rem 0; border-bottom: 1px solid #e5e7eb; display: flex; gap: 14px; align-items: flex-start;">
        <div style="width: 4px; min-height: 52px; background: ${tagColor.accent}; border-radius: 4px; flex-shrink: 0; margin-top: 2px;"></div>
        <div style="flex: 1;">
          ${blog.tags?.[0] ? `<span style="display:inline-block;font-size:11px;font-weight:500;padding:2px 9px;border-radius:20px;background:${tagColor.bg};color:${tagColor.text};margin-bottom:6px;">${blog.tags[0]}</span>` : ''}
          <p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px; line-height: 1.4;">${escapeHtml(blog.title)}</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px; line-height: 1.5;">${escapeHtml(blog.summary?.slice(0, 120))}${blog.summary?.length > 120 ? '…' : ''}</p>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 12px; color: #9ca3af;">⏱ ${blog.readTime || '3'} min read</span>
            ${blog.totalReads ? `<span style="font-size: 12px; color: #9ca3af;">👁 ${blog.totalReads} reads</span>` : ''}
            <a href="${blogUrl}" style="font-size: 12px; font-weight: 500; color: #1d9e75; text-decoration: none;">Read post →</a>
          </div>
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${periodLabel} — Aaditiya.dev</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#1d9e75,#378add);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background:#1d9e75;border-radius:8px;text-align:center;vertical-align:middle;">
                          <span style="font-size:18px;line-height:36px;color:#fff;">✦</span>
                        </td>
                        <td style="padding-left:10px;">
                          <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">The 1% Better Dev</p>
                          <p style="margin:0;font-size:12px;color:#6b7280;">by Aaditiya Tyagi</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;background:#e1f5ee;color:#085041;padding:4px 12px;border-radius:20px;font-weight:500;">Issue #${issueNumber}</span>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background:#e5e7eb;margin:20px 0;"></div>

              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#0f6e56;text-transform:uppercase;letter-spacing:0.07em;">${periodLabel}</p>
              <p style="margin:0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${blogCount} post${blogCount !== 1 ? 's' : ''} to make you 1% better</p>
              <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${formatPeriodDate(period)}</p>
            </td>
          </tr>

          <!-- Blog list -->
          <tr>
            <td style="padding:0 32px;">
              ${blogRows}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:24px 32px 32px;">
              <a href="${siteUrl}/blog" style="display:inline-block;background:#1d9e75;color:#fff;font-size:14px;font-weight:600;padding:11px 24px;border-radius:8px;text-decoration:none;">Browse all posts →</a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="height:1px;background:#f3f4f6;"></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#f9fafb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                You're receiving this because you subscribed to The 1% Better Dev.<br/>
                <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a> · 
                <a href="${siteUrl}" style="color:#6b7280;text-decoration:underline;">Visit site</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
};

function escapeHtml(str = '') {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatPeriodDate(period) {
  const now = new Date();
  if (period === 'weekly') {
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    return `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getTagColor(tag = '') {
  const t = tag.toLowerCase();
  if (['git', 'github'].includes(t)) return { accent: '#1d9e75', bg: '#e1f5ee', text: '#085041' };
  if (['terminal', 'zsh', 'bash', 'shell'].includes(t)) return { accent: '#534ab7', bg: '#eeedfe', text: '#3c3489' };
  if (['editor', 'vscode', 'vim'].includes(t)) return { accent: '#378add', bg: '#e6f1fb', text: '#0c447c' };
  if (['productivity', 'workflow'].includes(t)) return { accent: '#ba7517', bg: '#faeeda', text: '#633806' };
  if (['backend', 'node', 'api'].includes(t)) return { accent: '#d85a30', bg: '#faece7', text: '#4a1b0c' };
  return { accent: '#888780', bg: '#f1efe8', text: '#2c2c2a' };
}

module.exports = getDigestTemplate;