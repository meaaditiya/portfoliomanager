const getReplyEmailTemplate = (name, originalMessage, replyContent) => {
    return `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Response from Aaditiya Tyagi</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
      
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.4;
      color: #2c2c2c;
      padding: 30px 20px;
    }
    .email-container {
      max-width: 580px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      padding: 20px 0 15px;
      border-bottom: 1px solid #3a3a3a;
      margin-bottom: 25px;
    }
    .logo {
      max-width: 65px;
      height: 65px;
      margin-bottom: 15px;
      filter: grayscale(20%);
    }
    .header h1 {
      font-size: 28px;
      font-weight: 400;
      color: #2c2c2c;
      margin-bottom: 5px;
      letter-spacing: 1px;
    }
    .header p {
      font-size: 14px;
      color: #5a5a5a;
      font-style: italic;
    }
    .content {
      padding: 15px 0;
    }
    .greeting {
      font-size: 17px;
      color: #2c2c2c;
      margin-bottom: 12px;
      font-weight: 500;
    }
    .main-text {
      font-size: 15px;
      color: #3a3a3a;
      margin-bottom: 15px;
      line-height: 1.5;
    }
    .conversation-section {
      margin: 20px 0;
    }
    .message-label {
      font-size: 11px;
      margin-bottom: 8px;
      margin-top: 15px;
      font-weight: 600;
      color: #2c2c2c;
      text-transform: uppercase;
      letter-spacing: 1.5px;
     
      padding-bottom: 6px;
    }
    .message-content {
      padding: 12px 0 12px 15px;
     
      background: #fafafa;
      line-height: 1.5;
      color: #3a3a3a;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .signature-section {
      padding: 20px 0 15px;
      text-align: center;
      border-top: 1px solid #d0d0d0;
      margin-top: 25px;
    }
    .signature {
      color: #2c2c2c;
      font-size: 14px;
    }
    .signature strong {
      font-weight: 600;
      color: #2c2c2c;
    }
    .title {
      color: #5a5a5a;
      margin-top: 5px;
      font-size: 14px;
    }
    .contact-info {
      padding: 20px 0 15px;
      text-align: center;
      border-top: 1px solid #d0d0d0;
      margin-top: 25px;
    }
    .contact-info p {
      margin-bottom: 8px;
      color: #3a3a3a;
      font-size: 14px;
      line-height: 1.4;
    }
    .contact-info a {
      color: #4a4a4a;
      text-decoration: none;
      font-weight: 500;
      border-bottom: 1px solid #4a4a4a;
      padding-bottom: 1px;
      transition: all 0.2s;
    }
    .contact-info a:hover {
      color: #2c2c2c;
      border-bottom-color: #2c2c2c;
    }
  .visit-site {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 36px;
  background: linear-gradient(180deg, #444444 0%, #1f1f1f 100%);
  color: #ffffff !important;
  text-decoration: none !important;
  border: none !important;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.visit-site:hover {
  background: linear-gradient(180deg, #555555 0%, #2b2b2b 100%);
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

    .visit-site:hover {
      background: linear-gradient(135deg, #3a3a3a 0%, #1c1c1c 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(58, 58, 58, 0.35);
    }
    .email-footer {
      padding: 20px 0 12px;
      text-align: center;
      border-top: 1px solid #d0d0d0;
      margin-top: 25px;
    }
    .email-footer p {
      color: #6a6a6a;
      font-size: 12px;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    .email-footer a {
      color: #4a4a4a;
      text-decoration: none;
      font-weight: 500;
      border-bottom: 1px solid #4a4a4a;
      padding-bottom: 1px;
    }
    .email-footer a:hover {
      color: #2c2c2c;
      border-bottom-color: #2c2c2c;
    }
    .social-links {
      margin: 12px 0 8px;
      font-size: 13px;
    }
    .social-links a {
      color: #5a5a5a;
      text-decoration: none;
      margin: 0 8px;
      font-weight: 500;
      border-bottom: 1px solid #5a5a5a;
      padding-bottom: 1px;
      transition: all 0.2s;
    }
    .social-links a:hover {
      color: #3a3a3a;
      border-bottom-color: #3a3a3a;
    }
    strong {
      color: #2c2c2c;
      font-weight: 600;
    }
    @media (max-width: 600px) {
      body {
        padding: 20px 12px;
      }
      .header h1 {
        font-size: 24px;
      }
      .logo {
        max-width: 55px;
        height: 55px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <img src="https://ik.imagekit.io/afi9t3xki/Screenshot%202025-06-10%20162118.png?updatedAt=1751634427555" alt="Logo" class="logo">
      <h1>Response to Your Query</h1>
      <p>Thank you for your patience</p>
    </div>
    
    <div class="content">
      <div class="greeting">
        Dear ${name},
      </div>
      
      <p class="main-text">
        Thank you for reaching out to me. I have carefully reviewed your message and am pleased to provide you with a detailed response below.
      </p>
      
      <div class="conversation-section">
        <div class="message-label">Your Original Message:</div>
        <div class="message-content">${originalMessage}</div>
        
        <div class="message-label">My Response:</div>
        <div class="message-content">${replyContent}</div>
      </div>
      
      <p class="main-text">
        If you have any follow-up questions or would like to discuss this matter further, please don't hesitate to contact me.
      </p>
    </div>
    
    <div class="signature-section">
      <div class="signature">
        <strong>Best Regards</strong>
        <div class="title">Aaditiya Tyagi</div>
      </div>
    </div>
    
    <div class="contact-info">
      <p><strong>Contact:</strong> <a href="tel:+917351102036">+91 73511 02036</a></p>
      <p>
        <a href="https://connectwithaaditiya.onrender.com" target="_blank" class="visit-site">
          Visit My Site
        </a>
      </p>
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
</html>
    `;
};
module.exports = getReplyEmailTemplate;
