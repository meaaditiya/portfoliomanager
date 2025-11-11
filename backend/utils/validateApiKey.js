function validateApiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  if (process.env.GEMINI_API_KEY.length < 20) {
    throw new Error('GEMINI_API_KEY appears to be invalid (too short)');
  }
}
module.exports = validateApiKey;