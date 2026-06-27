const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function moderateContent(content, userName) {
  console.log('🔍 MODERATION START');
  console.log('📝 Content:', content);
  console.log('👤 User:', userName);
  
  try {
    console.log('🤖 Creating Gemini model...');
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    console.log('📤 Sending request to Gemini...');
    const prompt = `You are a strict content moderator for a professional blog platform. Analyze the following comment for ANY violations of community guidelines.

Community Guidelines (VERY STRICT):
- No hate speech, discrimination, or prejudice of any kind
- No harassment, bullying, or personal attacks
- No profanity, vulgar language, or inappropriate content
- No spam, promotional content, or irrelevant links
- No threats, violence, or harmful content
- No sexual content or inappropriate references
- No misinformation or deliberately false statements
- No trolling, baiting, or inflammatory remarks
- Must be respectful
- If content does not contain abusive language then approve it or if does not violate any of the above guidelines, approve it. If it violates any of the above guidelines, reject it.
- Don't reject any comment for relevence or opinion, only for violations of the above guidelines, whether it is constructive or not only respectful is enough.
- If it is just a gibberish and des not make any sense, reject it and mark it as low severity. If it is a serious violation of the above guidelines, mark it as high or critical severity. If it is a minor violation, mark it as low or medium severity.
User Name: "${userName}"
Comment Content: "${content}"

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "approved": true/false,
  "reason": "brief explanation if rejected",
  "severity": "low/medium/high/critical"
}`;

    const result = await model.generateContent(prompt);
    console.log('✅ Gemini responded');
    
    const response = await result.response;
    let jsonResponse = response.text().trim();
    
    console.log('📨 Raw Gemini response:', jsonResponse);
    
    // Clean up potential markdown formatting
    jsonResponse = jsonResponse
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    console.log('🧹 Cleaned response:', jsonResponse);
    
    const moderation = JSON.parse(jsonResponse);
    console.log('✅ Parsed moderation:', moderation);
    
    return {
      approved: moderation.approved === true,
      reason: moderation.reason || 'Content does not meet community guidelines',
      severity: moderation.severity || 'medium'
    };
    
  } catch (error) {
    console.error('❌❌❌ MODERATION ERROR ❌❌❌');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error status:', error.status);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    // On error, default to manual review (reject with specific code)
    return {
      approved: false,
      reason: 'Content pending manual review due to system error',
      severity: 'unknown',
      systemError: true
    };
  }
}

module.exports = moderateContent;
