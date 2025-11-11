function cleanupUnusedImages(content, contentImages) {
  if (!content || !Array.isArray(contentImages) || contentImages.length === 0) {
    return contentImages;
  }
  
  // Filter out images that are not referenced in content
  return contentImages.filter(image => {
    if (!image || !image.imageId) {
      return false; // Remove invalid images
    }
    
    const placeholder = `[IMAGE:${image.imageId}]`;
    return content.includes(placeholder);
  });
}
module.exports = cleanupUnusedImages;