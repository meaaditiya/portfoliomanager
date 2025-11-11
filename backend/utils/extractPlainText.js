// Helper function to clean HTML tags and extract plain text
function extractPlainText(htmlContent) {
  
  return htmlContent
    .replace(/<[^>]*>/g, '') 
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'") 
    .replace(/\[IMAGE:[^\]]+\]/g, '') 
    .replace(/\[VIDEO:[^\]]+\]/g, '') 
    .replace(/\s+/g, ' ') 
    .trim();
}
module.exports = extractPlainText;