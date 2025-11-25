const getAdminNotificationTemplate = (name, email, message) => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Form Submission</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #ecf0f1;
            padding: 20px;
            line-height: 1.6;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border: 1px solid #bdc3c7;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: 1px;
          }
          .priority-badge {
            background-color: rgba(255, 255, 255, 0.2);
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.5px;
          }
          .content {
            padding: 40px 30px;
          }
          .alert-section {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin-bottom: 25px;
          }
          .alert-section p {
            color: #856404;
            font-weight: 500;
          }
          .contact-card {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 25px;
            margin: 20px 0;
          }
          .contact-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
          }
          .contact-avatar {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
            margin-right: 15px;
          }
          .contact-details h3 {
            color: #2c3e50;
            font-size: 18px;
            margin-bottom: 5px;
          }
          .contact-details p {
            color: #7f8c8d;
            font-size: 14px;
          }
          .message-section {
            background-color: #ffffff;
            border: 1px solid #e9ecef;
            padding: 25px;
            margin: 20px 0;
          }
          .message-header {
            color: #2c3e50;
            font-weight: 600;
            margin-bottom: 15px;
            font-size: 16px;
            border-bottom: 1px solid #ecf0f1;
            padding-bottom: 10px;
          }
          .message-content {
            color: #34495e;
            line-height: 1.7;
            font-size: 15px;
            background-color: #f8f9fa;
            padding: 20px;
            border-left: 4px solid #3498db;
          }
          .metadata {
            background-color: #e9ecef;
            padding: 15px;
            margin: 20px 0;
            font-size: 12px;
            color: #6c757d;
          }
          .metadata-item {
            margin-bottom: 5px;
          }
          .metadata-item:last-child {
            margin-bottom: 0;
          }
          .action-section {
            background-color: #f1f3f4;
            padding: 25px;
            margin: 25px 0;
            text-align: center;
          }
          .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 20px;
          }
          .btn {
            padding: 12px 20px;
            border: none;
            font-weight: 600;
            text-decoration: none;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
          }
          .btn-primary {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
          }
          .btn-secondary {
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
            color: white;
          }
          .btn:hover {
            opacity: 0.9;
          }
          .footer {
            background-color: #2c3e50;
            color: white;
            padding: 25px;
            text-align: center;
          }
          .footer h3 {
            margin-bottom: 10px;
            font-size: 16px;
          }
          .footer p {
            opacity: 0.8;
            font-size: 14px;
          }
          @media (max-width: 600px) {
            .action-buttons {
              grid-template-columns: 1fr;
            }
            .contact-header {
              flex-direction: column;
              text-align: center;
            }
            .contact-avatar {
              margin: 0 0 15px 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>NEW MESSAGE RECEIVED</h1>
            <div class="priority-badge">ACTION REQUIRED</div>
          </div>
          
          <div class="content">
            <div class="alert-section">
              <p><strong>New Contact:</strong> A new message has been submitted through your contact form and requires your attention.</p>
            </div>
            
            <div class="contact-card">
              <div class="contact-header">
                <div class="contact-avatar">${name.charAt(0).toUpperCase()}</div>
                <div class="contact-details">
                  <h3>${name}</h3>
                  <p>Email: ${email}</p>
                </div>
              </div>
            </div>
            
            <div class="message-section">
              <div class="message-header">Message Content</div>
              <div class="message-content">${message}</div>
            </div>
            
            <div class="metadata">
              <div class="metadata-item"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</div>
              <div class="metadata-item"><strong>Source:</strong> Contact Form</div>
              <div class="metadata-item"><strong>Status:</strong> Pending Response</div>
            </div>
            
            <div class="action-section">
              <h3>Required Actions</h3>
              <div class="action-buttons">
                <a href="https://connectwithaaditiyaadmin.onrender.com/message" class="btn btn-primary">View in Admin Panel</a>
                <a href="mailto:${email}" class="btn btn-secondary">Reply via Email</a>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <h3>System Notification</h3>
            <p>Please log in to your admin panel to manage this message and update its status.</p>
          </div>
        </div>
      </body>
      </html>
    `;
};
module.exports = getAdminNotificationTemplate;

