// Save this as: EmailTemplates/accessRequestTemplate.js

const getAccessRequestEmailTemplate = (recipientName, documentName, requesterName, requesterEmail, requestMessage, requestId) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                🔐 Access Request
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hello <strong>${recipientName}</strong>,
              </p>
              
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 15px; line-height: 1.6;">
                A new access request has been received for a restricted document in your portal.
              </p>
              
              <!-- Request Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-left: 4px solid #2c2c2c; border-radius: 4px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #2c2c2c; font-size: 18px; font-weight: 600;">
                      Document Details
                    </h3>
                    
                    <p style="margin: 0 0 10px 0; color: #333333; font-size: 14px;">
                      <strong>Document Name:</strong><br>
                      <span style="color: #666666;">${documentName}</span>
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 15px 0;">
                    
                    <h3 style="margin: 0 0 15px 0; color: #2c2c2c; font-size: 18px; font-weight: 600;">
                      Requester Information
                    </h3>
                    
                    <p style="margin: 0 0 10px 0; color: #333333; font-size: 14px;">
                      <strong>Name:</strong> <span style="color: #666666;">${requesterName}</span>
                    </p>
                    
                    <p style="margin: 0 0 10px 0; color: #333333; font-size: 14px;">
                      <strong>Email:</strong> <span style="color: #666666;">${requesterEmail}</span>
                    </p>
                    
                    <p style="margin: 0 0 10px 0; color: #333333; font-size: 14px;">
                      <strong>Request ID:</strong> <span style="color: #666666; font-family: monospace;">${requestId}</span>
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 15px 0;">
                    
                    <h3 style="margin: 0 0 10px 0; color: #2c2c2c; font-size: 18px; font-weight: 600;">
                      Request Message
                    </h3>
                    
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; border: 1px solid #e0e0e0;">
                      <p style="margin: 0; color: #444444; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
${requestMessage}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Action Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/access-requests" 
                       style="display: inline-block; padding: 14px 35px; background-color: #2c2c2c; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: 600; margin: 0 10px 10px 0;">
                      Review Request
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                You can approve or reject this request from your admin dashboard. If approved, a private access link will be automatically generated and sent to the requester.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; color: #999999; font-size: 12px;">
                This is an automated notification from your Document Portal
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Document Portal. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

module.exports = getAccessRequestEmailTemplate;