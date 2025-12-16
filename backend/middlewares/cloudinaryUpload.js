const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../Config/cloudinarystorage");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    const isThumbnail = file.fieldname === 'thumbnail';
    
    let folder = 'uploads';
    if (isThumbnail) folder = 'uploads/thumbnails';
    else if (isVideo) folder = 'uploads/videos';
    else folder = 'uploads/images';
    
    return {
      folder: folder,
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'],
      transformation: isThumbnail ? [{ width: 640, height: 360, crop: 'limit' }] : undefined
    };
  },
});

module.exports = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});