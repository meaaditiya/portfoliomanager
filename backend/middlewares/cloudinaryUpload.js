const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../Config/cloudinarystorage");
const path = require("path");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    const isThumbnail = file.fieldname === 'thumbnail';
    const isDocument = file.fieldname === 'document';
    
    let folder = 'uploads';
    let resourceType = 'auto';
    let allowedFormats = [];
    let format = undefined;
    
    if (isThumbnail) {
      folder = 'uploads/thumbnails';
      resourceType = 'image';
      allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
    } else if (isVideo) {
      folder = 'uploads/videos';
      resourceType = 'video';
      allowedFormats = ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv', 'mpeg', 'mpg', '3gp'];
    } else if (isDocument) {
      folder = 'uploads/documents';
      resourceType = 'raw';
      const ext = path.extname(file.originalname).substring(1).toLowerCase();
      format = ext;
    } else {
      folder = 'uploads/images';
      resourceType = 'image';
      allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'ico', 'heic', 'heif'];
    }
    
    return {
      folder: folder,
      resource_type: resourceType,
      allowed_formats: allowedFormats.length > 0 ? allowedFormats : undefined,
      format: format,
      transformation: isThumbnail ? [{ width: 640, height: 360, crop: 'limit' }] : undefined
    };
  },
});

module.exports = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});