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
    const isAudio = file.mimetype.startsWith('audio/');
    
    let folder = 'uploads';
    let resourceType = 'auto';
    let allowedFormats = [];
    
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
      
      
      const fileExt = path.extname(file.originalname).toLowerCase().substring(1); 
      const fileName = path.parse(file.originalname).name;
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      const params = {
        folder: folder,
        resource_type: resourceType,
        type: 'upload', 
        access_mode: 'public',
        public_id: `${sanitizedName}_${Date.now()}`, 
        format: fileExt, 
      };
      
      return params;
    } else if (isAudio) {
      folder = 'uploads/audio';
      resourceType = 'video'; 
      allowedFormats = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'webm', 'm4a', 'wma', 'aiff'];
    } else {
      folder = 'uploads/images';
      resourceType = 'image';
      allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'ico', 'heic', 'heif'];
    }
    
    const params = {
      folder: folder,
      resource_type: resourceType,
      type: 'upload',
      access_mode: 'public',
    };
    
    if (!isDocument && allowedFormats.length > 0) {
      params.allowed_formats = allowedFormats;
    }
    
    if (isThumbnail) {
      params.transformation = [{ width: 640, height: 360, crop: 'limit' }];
    }
    
    return params;
  },
});

module.exports = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});