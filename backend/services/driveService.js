const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID2,
  process.env.GOOGLE_CLIENT_SECRET2,
  process.env.GOOGLE_REDIRECT_URI2 // same one you used
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

module.exports = drive;
