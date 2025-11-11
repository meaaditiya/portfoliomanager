function cleanupUnusedVideos(content, contentVideos) {
  if (!content || !Array.isArray(contentVideos) || contentVideos.length === 0) {
    return contentVideos;
  }
  
  // Filter out videos that are not referenced in content
  return contentVideos.filter(video => {
    if (!video || !video.embedId) {
      return false; // Remove invalid videos
    }
    
    const placeholder = `[VIDEO:${video.embedId}]`;
    return content.includes(placeholder);
  });
}
module.exports = cleanupUnusedVideos;