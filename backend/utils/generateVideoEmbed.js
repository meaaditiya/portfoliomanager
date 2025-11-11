function generateVideoEmbed(video) {
  const safeTitle = (video.title || '').replace(/"/g, '&quot;');
  const safeCaption = (video.caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safePosition = (video.position || 'center').replace(/[^a-zA-Z-]/g, '');
  
  let embedCode = '';
  
  switch (video.platform) {
    case 'youtube':
      const youtubeParams = new URLSearchParams({
        ...(video.autoplay && { autoplay: '1' }),
        ...(video.muted && { mute: '1' }),
        rel: '0',
        modestbranding: '1'
      });
      
      embedCode = `<iframe 
        width="560" 
        height="315" 
        src="https://www.youtube.com/embed/${video.videoId}?${youtubeParams}" 
        title="${safeTitle}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowfullscreen>
      </iframe>`;
      break;
      
    case 'vimeo':
      const vimeoParams = new URLSearchParams({
        ...(video.autoplay && { autoplay: '1' }),
        ...(video.muted && { muted: '1' }),
        title: '0',
        byline: '0',
        portrait: '0'
      });
      
      embedCode = `<iframe 
        width="560" 
        height="315" 
        src="https://player.vimeo.com/video/${video.videoId}?${vimeoParams}" 
        title="${safeTitle}" 
        frameborder="0" 
        allow="autoplay; fullscreen; picture-in-picture" 
        allowfullscreen>
      </iframe>`;
      break;
      
    case 'dailymotion':
      const dailymotionParams = new URLSearchParams({
        ...(video.autoplay && { autoplay: '1' }),
        ...(video.muted && { mute: '1' }),
        'ui-highlight': '444444',
        'ui-logo': '0'
      });
      
      embedCode = `<iframe 
        width="560" 
        height="315" 
        src="https://www.dailymotion.com/embed/video/${video.videoId}?${dailymotionParams}" 
        title="${safeTitle}" 
        frameborder="0" 
        allow="autoplay; fullscreen" 
        allowfullscreen>
      </iframe>`;
      break;
      
    default:
      return `<p class="video-error">Unsupported video platform: ${video.platform}</p>`;
  }
  
  return `<div class="blog-video blog-video-${safePosition}">
    <div class="video-wrapper">
      ${embedCode}
    </div>
    ${safeCaption ? `<p class="video-caption">${safeCaption}</p>` : ''}
  </div>`;
}
module.exports = generateVideoEmbed;