const multer = require("multer");

// Store file in memory (suitable for MongoDB GridFS / Base64 / Buffer)
const storage = multer.memoryStorage();

const audioFileFilter = (req, file, cb) => {
  const allowedAudioTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac',
    'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-m4a'
  ];

  if (allowedAudioTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

const audioUpload = multer({
  storage: storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB audio limit
  }
});

module.exports = audioUpload;
