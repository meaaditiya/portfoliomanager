const { getEmailLayout, escapeHtml } = require('./emailLayout');

const getAdminFollowUpResponseTemplate = (applicantName, applicantEmail, roleTitle, companyName, applicationId) =>
  getEmailLayout({
    title: 'Additional information received',
    heading: 'Additional information received',
    bodyHtml: `
      <h2>Dear Admin,</h2>
      <p><strong>${escapeHtml(applicantName)}</strong> has answered your additional questions for <strong>${escapeHtml(roleTitle)}</strong> at <strong>${escapeHtml(companyName)}</strong>.</p>
      <p><strong>Applicant email:</strong> ${escapeHtml(applicantEmail)}</p>
      <p><strong>Application ID:</strong> ${escapeHtml(applicationId)}</p>
      <p>Log in to the admin panel to review the responses and update the status.</p>
    `
  });

module.exports = getAdminFollowUpResponseTemplate;