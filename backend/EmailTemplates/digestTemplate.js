const getDigestTemplate = ({ issueNumber, period, blogs, unsubscribeUrl, siteUrl = 'https://aaditiya.dev' }) => {
  const periodLabel = period === 'weekly' ? 'Weekly Digest' : 'Monthly Digest';
  const blogCount = blogs.length;
  const weekLabel = getWeekLabel(period);

  const blogRows = blogs.map((blog, i) => {
    const tag = blog.tags?.[0] || '';
    const blogUrl = `${siteUrl}/blog/${blog.slug}`;
    const summary = (blog.summary || '').slice(0, 130) + ((blog.summary || '').length > 130 ? '…' : '');
    const isLast = i === blogs.length - 1;

    const imageBlock = blog.featuredImage
      ? `<img src="${blog.featuredImage}" alt="${escapeHtml(blog.title)}" width="120" height="90" style="display:block;width:120px;height:90px;border-radius:6px;object-fit:cover;" />`
      : `<div style="width:120px;height:90px;border-radius:6px;background-color:#f3f4f6;border:1px solid #e5e7eb;"></div>`;

    const metaBits = [
      blog.readTime ? `${blog.readTime} min read` : '',
      blog.totalReads ? `${blog.totalReads} reads` : '',
    ].filter(Boolean).join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;');

    return `
    <tr>
      <td style="padding:0 0 ${isLast ? '0' : '28px'};border-bottom:${isLast ? 'none' : '1px solid #ececec'};padding-bottom:${isLast ? '0' : '28px'};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <!-- Mobile: stacks via class hooks some clients honor; degrades gracefully as inline table otherwise -->
            <td class="thumb-cell" width="120" valign="top" style="padding-right:18px;width:120px;">
              <a href="${blogUrl}" style="text-decoration:none;">${imageBlock}</a>
            </td>
            <td valign="top" style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              ${tag ? `<p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(tag)}</p>` : ''}
              <a href="${blogUrl}" style="text-decoration:none;">
                <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#111111;line-height:1.4;">${escapeHtml(blog.title)}</p>
              </a>
              <p style="margin:0 0 10px;font-size:13px;color:#6b7280;line-height:1.6;">${escapeHtml(summary)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${metaBits ? `<td style="font-size:12px;color:#9ca3af;padding-right:14px;">${metaBits}</td>` : ''}
                  <td>
                    <a href="${blogUrl}" style="font-size:12px;font-weight:600;color:#111111;text-decoration:none;">Read →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${periodLabel} — The 1% Better Dev</title>
  <style>
    body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse !important; }
    img { border:0; outline:none; text-decoration:none; }
    a { color:#111111; }
    @media only screen and (max-width:600px) {
      .container { width:100% !important; }
      .px { padding-left:20px !important; padding-right:20px !important; }
      .thumb-cell { display:block !important; width:100% !important; padding-right:0 !important; padding-bottom:12px !important; }
      .thumb-cell img, .thumb-cell div { width:100% !important; height:auto !important; aspect-ratio:16/10; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td class="px" style="padding:36px 40px 24px;border-bottom:1px solid #ececec;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">The 1% Better Dev</p>
                    <p style="margin:0;font-size:21px;font-weight:700;color:#111111;">${periodLabel}</p>
                  </td>
                  <td valign="middle" align="right" style="font-size:12px;color:#9ca3af;white-space:nowrap;">
                    ${blogCount} new post${blogCount !== 1 ? 's' : ''}<br />${weekLabel}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- INTRO -->
          <tr>
            <td class="px" style="padding:28px 40px 8px;">
              <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.7;">
                Here's what dropped on the blog this ${period === 'weekly' ? 'week' : 'month'} — a focused tip to sharpen your dev workflow, no fluff.
              </p>
            </td>
          </tr>

          <!-- POSTS -->
          <tr>
            <td class="px" style="padding:20px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${blogRows}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td class="px" style="padding:32px 40px 40px;">
              <a href="${siteUrl}/blog" style="display:block;text-align:center;background-color:#111111;color:#ffffff;font-size:13px;font-weight:600;padding:13px 24px;border-radius:6px;text-decoration:none;">
                Browse all posts
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td class="px" style="padding:24px 40px;border-top:1px solid #ececec;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.6;">You're receiving this because you subscribed to The 1% Better Dev.</p>
                    <p style="margin:0 0 12px;font-size:12px;">
                      <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${siteUrl}" style="color:#6b7280;text-decoration:underline;">Visit site</a>
                    </p>
                    <p style="margin:0 0 12px;font-size:12px;">
                      <a href="https://x.com/aaditiya__tyagi" style="color:#6b7280;text-decoration:none;margin-right:10px;">X</a>
                      <a href="https://www.linkedin.com/in/aaditiya-tyagi-babb26290/" style="color:#6b7280;text-decoration:none;margin-right:10px;">LinkedIn</a>
                      <a href="https://github.com/meaaditiya" style="color:#6b7280;text-decoration:none;">GitHub</a>
                    </p>
                    <p style="margin:0;font-size:11px;color:#c1c5cb;">© ${new Date().getFullYear()} Aaditiya Tyagi. All rights reserved.</p>
                  </td>
                </tr>
              </table>
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getWeekLabel(period) {
  const now = new Date();
  if (period === 'weekly') {
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    return `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getTagStyle(tag) {
  // Kept for backward compatibility with any callers, but the new template
  // uses a single monochrome tag treatment for a cleaner, minimal look.
  return { bg: '#f3f4f6', color: '#6b7280' };
}

module.exports = getDigestTemplate;