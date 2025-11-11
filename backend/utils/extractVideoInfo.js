function extractVideoInfo(url) {
  // YouTube URL patterns
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  
  if (youtubeMatch) {
    return {
      platform: 'youtube',
      videoId: youtubeMatch[1],
      url: url
    };
  }
  
  // Vimeo URL patterns
  const vimeoRegex = /(?:vimeo\.com\/)([0-9]+)/;
  const vimeoMatch = url.match(vimeoRegex);
  
  if (vimeoMatch) {
    return {
      platform: 'vimeo',
      videoId: vimeoMatch[1],
      url: url
    };
  }
  
  // Dailymotion URL patterns
  const dailymotionRegex = /(?:dailymotion\.com\/video\/)([a-zA-Z0-9]+)/;
  const dailymotionMatch = url.match(dailymotionRegex);
  
  if (dailymotionMatch) {
    return {
      platform: 'dailymotion',
      videoId: dailymotionMatch[1],
      url: url
    };
  }
  
  return null;
}
module.exports= extractVideoInfo;