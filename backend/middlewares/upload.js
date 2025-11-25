const multer = require('multer');
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/json', 'application/xml'
  ];

  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`File type ${file.mimetype} is not supported`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }
});

module.exports = upload;
