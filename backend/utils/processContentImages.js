const escapeRegExp = require("../utils/escapeRegExp");
function processContentImages(content, contentImages) {
  // Add safety checks
  if (!content || typeof content !== 'string') {
    return content || '';
  }
  
  if (!contentImages || !Array.isArray(contentImages) || contentImages.length === 0) {
    return content;
  }
  
  let processedContent = content;
  
  try {
    contentImages.forEach(image => {
      // Safety checks for image object
      if (!image || !image.imageId) {
        return; // Skip invalid image objects
      }
      
      const placeholder = `[IMAGE:${image.imageId}]`;
      
      // Check if placeholder exists in content before attempting replacement
      if (!processedContent.includes(placeholder)) {
        return; // Skip if placeholder doesn't exist
      }
      
      // Sanitize image properties to prevent injection
      const safeUrl = (image.url || '').replace(/"/g, '&quot;');
      const safeAlt = (image.alt || '').replace(/"/g, '&quot;');
      const safeCaption = (image.caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safePosition = (image.position || 'center').replace(/[^a-zA-Z-]/g, '');
      
      const imageHtml = `<div class="blog-image blog-image-${safePosition}">
  <img src="${safeUrl}" alt="${safeAlt}" loading="lazy" />
  ${safeCaption ? `<p class="image-caption">${safeCaption}</p>` : ''}
</div>`;
      
      // Replace ALL occurrences of the placeholder
      processedContent = processedContent.replace(new RegExp(escapeRegExp(placeholder), 'g'), imageHtml);
    });
    
    return processedContent;
    
  } catch (error) {
    console.error('Error processing content images:', error);
    // Return original content if processing fails
    return content;
  }
}
module.exports= processContentImages;