const { getEmailLayout, escapeHtml } = require('./emailLayout');

const getApplicationMoreInfoTemplate = (applicantName, roleTitle, companyName, applicationId, message) => {
  const messageBlock = message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : '';

  return getEmailLayout({
    title: 'More information needed for your application',
    heading: 'More information needed',
    bodyHtml: `
      <h2>Dear ${escapeHtml(applicantName)},</h2>
      <p>I need some more information to move forward with your application for <strong>${escapeHtml(roleTitle)}</strong> at <strong>${escapeHtml(companyName)}</strong>.</p>
      <p><strong>Application ID:</strong> ${escapeHtml(applicationId)}</p>
      ${messageBlock}
      <p>Please sign in to the site, open <strong>My Applications</strong> and answer the additional questions listed under your application.</p>
    `
  });
};

module.exports = getApplicationMoreInfoTemplate;