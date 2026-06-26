const getDigestTemplate = ({ issueNumber, period, blogs, unsubscribeUrl, siteUrl = 'https://aaditiya.dev' }) => {
  const periodLabel = period === 'weekly' ? 'Weekly Digest' : 'Monthly Digest';
  const blogCount = blogs.length;
  const weekLabel = getWeekLabel(period);

  const blogCards = blogs.map((blog) => {
    const tag = blog.tags?.[0] || '';
    const tagStyle = getTagStyle(tag);
    const blogUrl = `${siteUrl}/blog/${blog.slug}`;
    const summary = (blog.summary || '').slice(0, 130) + ((blog.summary || '').length > 130 ? '...' : '');
    const imageBlock = blog.featuredImage
      ? `<img src="${blog.featuredImage}" alt="${escapeHtml(blog.title)}" style="width:100%;height:160px;object-fit:cover;display:block;border-bottom:1px solid #e5e7eb;" />`
      : `<div style="width:100%;height:140px;background:linear-gradient(135deg,#111827,#1f2937);display:flex;align-items:center;justify-content:center;border-bottom:1px solid #e5e7eb;">
           <span style="font-size:36px;color:rgba(255,255,255,0.15);">&#9632;</span>
         </div>`;

    return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px;">
      ${imageBlock}
      <div style="padding:18px;">
        ${tag ? `<span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;background:${tagStyle.bg};color:${tagStyle.color};">${escapeHtml(tag)}</span>` : ''}
        <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 8px;line-height:1.35;">${escapeHtml(blog.title)}</p>
        <p style="font-size:13px;color:#6b7280;margin:0 0 14px;line-height:1.6;">${escapeHtml(summary)}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:12px;color:#9ca3af;">
            ${blog.readTime ? `${blog.readTime} min read` : ''}
            ${blog.readTime && blog.totalReads ? '&nbsp;&middot;&nbsp;' : ''}
            ${blog.totalReads ? `${blog.totalReads} reads` : ''}
          </span>
          <a href="${blogUrl}" style="font-size:13px;font-weight:600;color:#111827;text-decoration:none;border:1.5px solid #111827;padding:7px 18px;border-radius:6px;display:inline-block;">Read post</a>
        </div>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${periodLabel} — The 1% Better Dev</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f7f7;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;line-height:1.6;">

  <div style="width:100%;background-color:#ffffff;border-left:2px solid #111827;border-right:2px solid #111827;box-shadow:none;overflow:hidden;min-height:100vh;max-width:600px;margin:0 auto;">

    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#111827,#1f2937);padding:36px 32px;display:flex;align-items:center;gap:20px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle,rgba(255,255,255,0.05) 10%,transparent 60%);transform:rotate(30deg);"></div>
      <img
        src="https://ik.imagekit.io/afi9t3xki/Screenshot%202025-06-10%20162118.png?updatedAt=1751634427555"
        alt="Aaditiya Tyagi"
        style="width:64px;height:64px;border-radius:50%;border:3px solid #ffffff;object-fit:cover;flex-shrink:0;position:relative;z-index:1;display:block;"
        onerror="this.style.display='none'"
      />
      <div style="position:relative;z-index:1;">
        <p style="margin:0;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">The 1% Better Dev</p>
        <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.2;">${periodLabel}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${blogCount} new post${blogCount !== 1 ? 's' : ''}&nbsp;&middot;&nbsp;${weekLabel}</p>
      </div>
    </div>

    <!-- BODY -->
    <div style="padding:32px 32px 8px;background-color:#ffffff;">
      <p style="font-size:15px;color:#374151;margin:0 0 24px;line-height:1.7;">
        Here's what dropped on the blog this ${period === 'weekly' ? 'week' : 'month'}. Each post is a focused tip to sharpen your dev workflow — no fluff.
      </p>

      ${blogCards}
    </div>

    <!-- CTA -->
    <div style="padding:8px 32px 36px;background:#ffffff;">
      <a href="${siteUrl}/blog" style="display:block;text-align:center;background:#111827;color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Browse all posts on aaditiya.dev
      </a>
    </div>

    <!-- FOOTER -->
    <div style="background:linear-gradient(180deg,#111827,#1f2937);padding:28px 32px;text-align:center;border-top:1px solid #374151;">
      <p style="margin:0 0 6px;font-size:13px;color:#d1d5db;line-height:1.5;">You're receiving this because you subscribed to The 1% Better Dev.</p>
      <p style="margin:0 0 14px;font-size:13px;">
        <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
        &nbsp;&middot;&nbsp;
        <a href="${siteUrl}" style="color:#9ca3af;text-decoration:underline;">Visit site</a>
      </p>
      <div style="margin-bottom:14px;">
        <a href="https://x.com/aaditiya__tyagi" style="display:inline-block;margin:0 6px;color:#9ca3af;font-size:12px;text-decoration:none;">X</a> |
        <a href="https://www.linkedin.com/in/aaditiya-tyagi-babb26290/" style="display:inline-block;margin:0 6px;color:#9ca3af;font-size:12px;text-decoration:none;">LinkedIn</a> |
        <a href="https://github.com/meaaditiya" style="display:inline-block;margin:0 6px;color:#9ca3af;font-size:12px;text-decoration:none;">GitHub</a>
      </div>
      <p style="margin:0;font-size:12px;color:#4b5563;">© ${new Date().getFullYear()} Aaditiya Tyagi. All rights reserved.</p>
    </div>

  </div>
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
    return `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getTagStyle(tag) {
  const t = (tag || '').toLowerCase();
  if (['git', 'github'].includes(t))               return { bg: '#e1f5ee', color: '#085041' };
  if (['terminal', 'zsh', 'bash', 'shell'].includes(t)) return { bg: '#eeedfe', color: '#3c3489' };
  if (['editor', 'vscode', 'vim'].includes(t))     return { bg: '#e6f1fb', color: '#0c447c' };
  if (['productivity', 'workflow'].includes(t))    return { bg: '#faeeda', color: '#633806' };
  if (['backend', 'node', 'api'].includes(t))      return { bg: '#faece7', color: '#4a1b0c' };
  if (['javascript', 'js', 'typescript', 'ts'].includes(t)) return { bg: '#fef9c3', color: '#713f12' };
  return { bg: '#f1efe8', color: '#2c2c2a' };
}

module.exports = getDigestTemplate;