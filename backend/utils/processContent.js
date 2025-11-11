// Updated processContent function to handle both images and videos
const processContentImages = require("../utils/processContentImages");
const processContentVideos = require("../utils/processContentVideos");
function processContent(content, contentImages, contentVideos) {
  let processedContent = content;
  
  // Process images first
  processedContent = processContentImages(processedContent, contentImages);
  
  // Process videos
  processedContent = processContentVideos(processedContent, contentVideos);
  
  return processedContent;
}
module.exports =  processContent;