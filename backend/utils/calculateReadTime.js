function calculateReadTime(content) {
  const plainText = extractPlainText(content);
  const wordCount = plainText.trim().split(/\s+/).length;
  const readTime = Math.ceil(wordCount / 200); // round up to nearest minute
  return readTime > 0 ? readTime : 1; // minimum 1 minute
}
module.exports = calculateReadTime;