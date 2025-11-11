const escapeRegExp = require("../utils/escapeRegExp");
const generateVideoEmbed = require("../utils/generateVideoEmbed");
function processContentVideos(content, contentVideos) {
  // Add safety checks
  if (!content || typeof content !== 'string') {
    return content || '';
  }
  
  if (!contentVideos || !Array.isArray(contentVideos) || contentVideos.length === 0) {
    return content;
  }
  
  let processedContent = content;
  
  try {
    contentVideos.forEach(video => {
      // Safety checks for video object
      if (!video || !video.embedId) {
        return; // Skip invalid video objects
      }
      
      const placeholder = `[VIDEO:${video.embedId}]`;
      
      // Check if placeholder exists in content before attempting replacement
      if (!processedContent.includes(placeholder)) {
        return; // Skip if placeholder doesn't exist
      }
      
      // Generate embed HTML based on platform
      const embedHtml = generateVideoEmbed(video);
      
      // Replace ALL occurrences of the placeholder
      processedContent = processedContent.replace(new RegExp(escapeRegExp(placeholder), 'g'), embedHtml);
    });
    
    return processedContent;
    
  } catch (error) {
    console.error('Error processing content videos:', error);
    // Return original content if processing fails
    return content;
  }
}
module.exports = processContentVideos;