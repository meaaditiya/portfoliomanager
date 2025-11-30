const { Storage } = require("@google-cloud/storage");

const storage = new Storage({
  keyFilename: process.env.GCS_KEY_PATH,
});

module.exports = storage.bucket(process.env.GCS_BUCKET_NAME);
