// Separate from your existing `cloudinaryUpload` middleware because PDFs need
// resource_type: 'raw' on Cloudinary, unlike images/video.
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../Config/cloudinarystorage');

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'portfolio/resume',
    resource_type: 'raw',
    format: 'pdf',
    public_id: `resume-${Date.now()}`
  })
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed for the resume'), false);
  }
};

const cloudinaryUploadDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = cloudinaryUploadDocument;