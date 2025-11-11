function getOTPEmailTemplate(otp) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .otp-box { background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px; }
        .warning { color: #dc2626; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>OTP Verification</h2>
        <p>Hello,</p>
        <p>OTP is required to maintain authenticity of the sender so they can use the correct and their own E-mail account to send the messages. Please use the following OTP to verify your email address:</p>
        
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
        </div>
        
        <p><strong>This OTP will expire in 10 minutes.</strong></p>
        
        <div class="warning">
          <p>⚠️ If you didn't request this OTP, please ignore this email.</p>
        </div>
        
        <p>Best regards,<br>Aaditiya Tyagi</p>
      </div>
    </body>
    </html>
  `;
}
module.exports = getOTPEmailTemplate;