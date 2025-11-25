const getEmailTemplate = (subject, message, senderName = 'Aaditiya Tyagi', receiverName) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f7f7f7;
      margin: 0;
      padding: 0;
      color: #1f2937;
      line-height: 1.6;
    }

    
    .email-container {
      width: 100%;
      background-color: #ffffff;
      border-left:2px solid  black;
      border-right: 2px solid  black;
      box-shadow: none;
      overflow: hidden;
      min-height: 100vh;
    }

    .email-header {
      background: linear-gradient(135deg, #111827, #1f2937);
      color: #ffffff;
      padding: 48px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .email-header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 10%, transparent 60%);
      transform: rotate(30deg);
    }

    .profile-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    .profile-image {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      margin-bottom: 16px;
      border: 4px solid #ffffff;
      display: block;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .profile-image:hover {
      transform: scale(1.05);
    }

    .avatar-fallback {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: linear-gradient(45deg, #6b7280, #9ca3af);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: 700;
      color: #ffffff;
      border: 4px solid #ffffff;
      text-transform: uppercase;
    }

    .profile-name {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      text-align: center;
      margin: 0;
    }

    .subject-section {
      flex: 1;
      text-align: right;
      position: relative;
      z-index: 1;
      margin-left: 32px;
    }

    .subject-section h1 {
      font-size: 32px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.025em;
      color: #ffffff;
    }

    .email-content {
      padding: 40px;
      background-color: #ffffff;
    }

    .email-content h2 {
      font-size: 22px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }

    .email-message {
      background-color: #f9fafb;
      border-left: 4px solid #374151;
      padding: 24px;
      border-radius: 0 12px 12px 0;
      color: #1f2937;
      margin: 24px 0;
      line-height: 1.8;
      font-size: 16px;
    }

    .email-message p {
      margin: 8px 0;
    }

    .contact-info {
      font-size: 15px;
      color: #374151;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }

    .contact-info p {
      margin: 8px 0;
    }

    .contact-info a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    .contact-info a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    .visit-site {
        color:inherit;
        background-color: white;
    
    }

    .visit-site:hover {
        color:black;
        
    }

    .email-footer {
      background: linear-gradient(180deg, #111827, #1f2937);
      padding: 32px;
      text-align: center;
      color: #d1d5db;
      font-size: 13px;
      border-top: 1px solid #374151;
    }

    .email-footer p {
      margin: 6px 0;
      line-height: 1.5;
    }

    .email-footer a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }

    .email-footer a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    .social-links {
      margin-top: 16px;
    }

    .social-links a {
      display: inline-block;
      margin: 0 8px;
      color: #d1d5db;
      font-size: 14px;
      transition: color 0.2s ease;
    }

    .social-links a:hover {
      color: #3b82f6;
    }

    @media (max-width: 768px) {
      .email-header {
        padding: 32px 20px;
        align-items: flex-start;
      }

      .profile-section {
        align-items: flex-start;
        min-width: 120px;
      }

      .subject-section {
        margin-left: 20px;
        text-align: left;
      }

      .subject-section h1 {
        font-size: 24px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }

      .email-content {
        padding: 24px;
      }

      .profile-name {
        font-size: 16px;
        text-align: left;
      }
    }

    @media (max-width: 480px) {
      .email-header {
        padding: 24px 16px;
        align-items: flex-start;
      }

      .profile-section {
        align-items: flex-start;
        min-width: 100px;
      }

      .subject-section {
        margin-left: 16px;
        text-align: left;
      }

      .subject-section h1 {
        font-size: 18px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
        line-height: 1.3;
      }

      .email-content {
        padding: 20px;
      }

      .profile-image, .avatar-fallback {
        width: 70px;
        height: 70px;
      }

      .avatar-fallback {
        font-size: 28px;
      }

      .profile-name {
        font-size: 14px;
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="profile-section">
        <img
          src="https://ik.imagekit.io/afi9t3xki/Screenshot%202025-06-10%20162118.png?updatedAt=1751634427555"
          alt="Profile"
          class="profile-image"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="avatar-fallback" style="display: none;">AT</div>
      
      </div>
      
      <div class="subject-section">
        <h1>${subject}</h1>
      </div>
    </div>

    <div class="email-content">
      <h2>Dear ${receiverName},</h2>
      <div >
        <p>${message.replace(/\n/g, '</p><p>')}</p>
      </div>

      <div class="contact-info">
        <p><strong>Best regards,</strong><br>${senderName}</p>
        <p><strong>Contact:</strong> <a href="tel:+917351102036">+91 73511 02036</a></p>
        <p>
          <a href="https://connectwithaaditiya.onrender.com" target="_blank" class="visit-site">
            Visit My Site
          </a>
        </p>
      </div>
    </div>

    <div class="email-footer">
      <p>This email was generated automatically. Please do not reply directly.</p>
      <p>For inquiries, contact <a href="mailto:aaditiyatyagi123@gmail.com">aaditiyatyagi123@gmail.com</a></p>
      <div class="social-links">
        <a href="https://x.com/aaditiya__tyagi" target="_blank">X</a> |
        <a href="https://www.linkedin.com/in/aaditiya-tyagi-babb26290/" target="_blank">LinkedIn</a> |
        <a href="https://github.com/meaaditiya" target="_blank">GitHub</a>
      </div>
      <p>© ${new Date().getFullYear()} Aaditiya Tyagi. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};
module.exports = getEmailTemplate;