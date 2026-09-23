const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID2,
  process.env.GOOGLE_CLIENT_SECRET2,
  process.env.GOOGLE_REDIRECT_URI2 
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

async function getFileStream(fileId, range) {
  const headers = {};
  if (range) {
    const end = range.end !== undefined && range.end !== null ? range.end : '';
    headers.Range = `bytes=${range.start}-${end}`;
  }

  let attempt = 0;
  const maxAttempts = 4;

  while (true) {
    try {
      const resp = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream', headers }
      );
      return {
        stream: resp.data,
        status: resp.status,
        headers: resp.headers || {}
      };
    } catch (err) {
      const reason = err?.errors?.[0]?.reason || err?.code;
      const isRateLimited = reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded' || err?.code === 403 && /rateLimit/i.test(String(err?.message));
      attempt += 1;
      if (isRateLimited && attempt < maxAttempts) {
        const delay = Math.min(200 * 2 ** attempt, 3000) + Math.floor(Math.random() * 150);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (err?.code === 404) {
        const notFound = new Error('source_file_missing');
        notFound.statusCode = 404;
        throw notFound;
      }
      throw err;
    }
  }
}

async function uploadFile({ name, mimeType, buffer, parentFolderId }) {
  const { Readable } = require('stream');
  const { data } = await drive.files.create({
    requestBody: {
      name,
      parents: parentFolderId ? [parentFolderId] : undefined
    },
    media: {
      mimeType,
      body: Readable.from(buffer)
    },
    fields: 'id, size, mimeType'
  });

  return {
    driveFileId: data.id,
    size: data.size ? Number(data.size) : buffer.length,
    mimeType: data.mimeType || mimeType
  };
}

drive.getFileStream = getFileStream;
drive.uploadFile = uploadFile;

module.exports = drive;
