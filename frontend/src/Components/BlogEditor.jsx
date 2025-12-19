import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../ComponentsCSS/blogeditor.css';
import BlogAnalytics from './BlogAnaLytics';

const BlogManagementPanel = () => {
  // State for blog list and pagination
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    tag: '',
    status: ''
  });
  
  // Editor state
  const [editMode, setEditMode] = useState(false);
  const [selectedBlog, setSelectedBlog] = useState(null);

// 1. ADD TO formData STATE (around line 25)

const [formData, setFormData] = useState({
  title: '',
  content: '',
  summary: '',
  tags: '',
  status: 'draft',
  featuredImage: '',
  contentImages: [],
  contentVideos: [],
  isSubscriberOnly: false,
  audioBlog: {
    audioFile: null,
    duration: '',
    bitrate: '',
    sampleRate: '',
    channels: 2,
    language: 'en',
    narrator: '',
    isSubscriberOnly: false
  }
});
// 2. ADD AUDIO MODAL STATE (after videoModal state, around line 95)

const [audioModal, setAudioModal] = useState({
  isOpen: false,
  file: null,
  duration: '',
  bitrate: '',
  sampleRate: '',
  channels: 2,
  language: 'en',
  narrator: ''
});
const [uploadingAudio, setUploadingAudio] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list', 'edit', 'analytics'
  const [analyticsId, setAnalyticsId] = useState(null);
  
  // Image embedding state
  const [imageModal, setImageModal] = useState({
    isOpen: false,
    url: '',
    alt: '',
    caption: '',
    position: 'center'
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Video embedding state
  const [videoModal, setVideoModal] = useState({
    isOpen: false,
    url: '',
    title: '',
    caption: '',
    position: 'center',
    autoplay: false,
    muted: false
  });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  // Image editing state
const [editImageModal, setEditImageModal] = useState({
  isOpen: false,
  imageId: null,
  url: '',
  alt: '',
  caption: '',
  position: 'center'
});

const [updatingImage, setUpdatingImage] = useState(false);
  // Fetch blogs from API
 const [editAudioModal, setEditAudioModal] = useState({
  isOpen: false,
  file: null,
  duration: '',
  bitrate: '',
  sampleRate: '',
  channels: 2,
  language: 'en',
  narrator: '',
  isSubscriberOnly: false,
  replaceFile: false
});
  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });

      const response = await axios.get(`https://aadibgmg.onrender.com/api/blogs?${params.toString()}`, {
        withCredentials: true
      });

      setBlogs(response.data.blogs || []);
      
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total || 0,
          pages: response.data.pagination.pages || 1
        }));
      } else {
        setPagination(prev => ({
          ...prev,
          total: response.data.blogs?.length || 0,
          pages: 1
        }));
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching blogs:', err);
      setError('Failed to load blog posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize component
  useEffect(() => {
    fetchBlogs();
  }, [pagination.page, pagination.limit, filters]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    // Reset to first page when filters change
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };
  

// 3. UPDATE handleInputChange FUNCTION (around line 155)

const handleInputChange = (e) => {
  const { name, value, type, checked } = e.target;
  
  if (name === 'content') {
    const updatedImages = cleanupContentImages(value, formData.contentImages);
    const updatedVideos = cleanupContentVideos(value, formData.contentVideos);
    setFormData(prev => ({
      ...prev,
      [name]: value,
      contentImages: updatedImages,
      contentVideos: updatedVideos
    }));
  } else if (name.startsWith('audio_')) {
    const audioFieldName = name.replace('audio_', '');
    setFormData(prev => ({
      ...prev,
      audioBlog: {
        ...prev.audioBlog,
        [audioFieldName]: type === 'checkbox' ? checked : value
      }
    }));
  } else {
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }
};
// 4. ADD AUDIO MODAL CHANGE HANDLER (after handleVideoModalChange)

const handleAudioModalChange = (e) => {
  const { name, value, type, checked, files } = e.target;
  
  if (name === 'audioFile') {
    setAudioModal(prev => ({
      ...prev,
      file: files[0] || null
    }));
  } else {
    setAudioModal(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }
};
// 5. ADD AUDIO UPLOAD HANDLER (after handleAddImage function)

const handleAddAudio = async () => {
  if (!audioModal.file) {
    setError('Please select an audio file');
    return;
  }

  const allowedFormats = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/flac'];
  if (!allowedFormats.includes(audioModal.file.type)) {
    setError('Invalid audio format. Supported: MP3, WAV, WebM, OGG, AAC, FLAC');
    return;
  }

  if (audioModal.file.size > 100 * 1024 * 1024) {
    setError('Audio file size cannot exceed 100MB');
    return;
  }

  try {
    setUploadingAudio(true);
    setError(null);

    const formDataAudio = new FormData();
    formDataAudio.append('audio', audioModal.file);
    formDataAudio.append('duration', audioModal.duration);
    formDataAudio.append('bitrate', audioModal.bitrate);
    formDataAudio.append('sampleRate', audioModal.sampleRate);
    formDataAudio.append('channels', audioModal.channels);
    formDataAudio.append('language', audioModal.language);
    formDataAudio.append('narrator', audioModal.narrator);
    formDataAudio.append('isSubscriberOnly', audioModal.isSubscriberOnly || false);

    if (selectedBlog) {
      const response = await axios.post(
        `https://aadibgmg.onrender.com/api/blogs/${selectedBlog._id}/audio`,
        formDataAudio,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      setFormData(prev => ({
        ...prev,
        audioBlog: {
          audioFile: response.data.audio,
          duration: response.data.audio.duration,
          bitrate: response.data.audio.bitrate,
          sampleRate: response.data.audio.sampleRate,
          channels: response.data.audio.channels,
          language: response.data.audio.language,
          narrator: response.data.audio.narrator,
          isSubscriberOnly: audioModal.isSubscriberOnly
        }
      }));

      setSuccessMessage('Audio uploaded successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setFormData(prev => ({
        ...prev,
        audioBlog: {
          audioFile: audioModal.file,
          duration: audioModal.duration,
          bitrate: audioModal.bitrate,
          sampleRate: audioModal.sampleRate,
          channels: audioModal.channels,
          language: audioModal.language,
          narrator: audioModal.narrator,
          isSubscriberOnly: audioModal.isSubscriberOnly
        }
      }));

      setSuccessMessage('Audio file selected successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    }

    setAudioModal({
      isOpen: false,
      file: null,
      duration: '',
      bitrate: '',
      sampleRate: '',
      channels: 2,
      language: 'en',
      narrator: ''
    });

  } catch (err) {
    console.error('Error uploading audio:', err);
    setError(err.response?.data?.message || 'Failed to upload audio. Please try again.');
  } finally {
    setUploadingAudio(false);
  }
};
// 10. ADD REMOVE AUDIO HANDLER (after handleAddAudio)

const handleRemoveAudio = async () => {
  if (!window.confirm('Are you sure you want to remove this audio? This action cannot be undone.')) {
    return;
  }

  try {
    // If editing existing blog with audio, call DELETE API
    if (selectedBlog && formData.audioBlog.audioFile) {
      setLoading(true);
      await axios.delete(
        `https://aadibgmg.onrender.com/api/blogs/${selectedBlog._id}/audio`,
        { withCredentials: true }
      );
      
      setSuccessMessage('Audio removed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
    
    // Clear audio from form state
    setFormData(prev => ({
      ...prev,
      audioBlog: {
        audioFile: null,
        duration: '',
        bitrate: '',
        sampleRate: '',
        channels: 2,
        language: 'en',
        narrator: '',
        isSubscriberOnly: false
      }
    }));
    
  } catch (err) {
    console.error('Error removing audio:', err);
    setError(err.response?.data?.message || 'Failed to remove audio. Please try again.');
  } finally {
    setLoading(false);
  }
};
const handleEditAudio = () => {
  setEditAudioModal({
    isOpen: true,
    file: null,
    duration: formData.audioBlog.duration || '',
    bitrate: formData.audioBlog.bitrate || '',
    sampleRate: formData.audioBlog.sampleRate || '',
    channels: formData.audioBlog.channels || 2,
    language: formData.audioBlog.language || 'en',
    narrator: formData.audioBlog.narrator || '',
    isSubscriberOnly: formData.audioBlog.isSubscriberOnly || false,
    replaceFile: false
  });
};

const handleEditAudioModalChange = (e) => {
  const { name, value, type, checked, files } = e.target;
  
  if (name === 'audioFile') {
    setEditAudioModal(prev => ({
      ...prev,
      file: files[0] || null,
      replaceFile: true
    }));
  } else {
    setEditAudioModal(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }
};

const handleUpdateAudio = async () => {
  try {
    setUploadingAudio(true);
    setError(null);

    const formDataAudio = new FormData();
    
    // Add file only if user wants to replace it
    if (editAudioModal.replaceFile && editAudioModal.file) {
      const allowedFormats = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/flac'];
      if (!allowedFormats.includes(editAudioModal.file.type)) {
        setError('Invalid audio format. Supported: MP3, WAV, WebM, OGG, AAC, FLAC');
        return;
      }

      if (editAudioModal.file.size > 100 * 1024 * 1024) {
        setError('Audio file size cannot exceed 100MB');
        return;
      }
      
      formDataAudio.append('audio', editAudioModal.file);
    }
    
    formDataAudio.append('duration', editAudioModal.duration);
    formDataAudio.append('bitrate', editAudioModal.bitrate);
    formDataAudio.append('sampleRate', editAudioModal.sampleRate);
    formDataAudio.append('channels', editAudioModal.channels);
    formDataAudio.append('language', editAudioModal.language);
    formDataAudio.append('narrator', editAudioModal.narrator);
    formDataAudio.append('isSubscriberOnly', editAudioModal.isSubscriberOnly);

    const response = await axios.put(
      `https://aadibgmg.onrender.com/api/blogs/${selectedBlog._id}/audio`,
      formDataAudio,
      {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    );

    setFormData(prev => ({
      ...prev,
      audioBlog: {
        audioFile: response.data.audio,
        duration: response.data.audio.duration,
        bitrate: response.data.audio.bitrate,
        sampleRate: response.data.audio.sampleRate,
        channels: response.data.audio.channels,
        language: response.data.audio.language,
        narrator: response.data.audio.narrator,
        isSubscriberOnly: response.data.audio.isSubscriberOnly
      }
    }));

    setSuccessMessage('Audio updated successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);

    setEditAudioModal({
      isOpen: false,
      file: null,
      duration: '',
      bitrate: '',
      sampleRate: '',
      channels: 2,
      language: 'en',
      narrator: '',
      isSubscriberOnly: false,
      replaceFile: false
    });

  } catch (err) {
    console.error('Error updating audio:', err);
    setError(err.response?.data?.message || 'Failed to update audio. Please try again.');
  } finally {
    setUploadingAudio(false);
  }
};
  const cleanupContentImages = (content, contentImages) => {
    if (!content || !Array.isArray(contentImages) || contentImages.length === 0) {
      return contentImages;
    }
    
    // Filter out images that are not referenced in content
    return contentImages.filter(image => {
      if (!image || !image.imageId) {
        return false; // Remove invalid images
      }
      
      const placeholder = `[IMAGE:${image.imageId}]`;
      return content.includes(placeholder);
    });
  };

  const cleanupContentVideos = (content, contentVideos) => {
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
  };

  const generateImagePreview = (contentImages, content) => {
    if (!Array.isArray(contentImages) || contentImages.length === 0) {
      return [];
    }
    
    // Only show images that are actually used in content
    return contentImages.filter(image => {
      if (!image || !image.imageId || !content) {
        return false;
      }
      
      const placeholder = `[IMAGE:${image.imageId}]`;
      return content.includes(placeholder);
    });
  };

  const generateVideoPreview = (contentVideos, content) => {
    if (!Array.isArray(contentVideos) || contentVideos.length === 0) {
      return [];
    }
    
    // Only show videos that are actually used in content
    return contentVideos.filter(video => {
      if (!video || !video.embedId || !content) {
        return false;
      }
      
      const placeholder = `[VIDEO:${video.embedId}]`;
      return content.includes(placeholder);
    });
  };

  // Handle image modal input changes
  const handleImageModalChange = (e) => {
    const { name, value } = e.target;
    setImageModal(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle video modal input changes
  const handleVideoModalChange = (e) => {
    const { name, value, type, checked } = e.target;
    setVideoModal(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Insert text at cursor position in textarea
  const insertTextAtCursor = (text) => {
    const textarea = document.getElementById('content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = formData.content.substring(0, start) + text + formData.content.substring(end);
    
    setFormData(prev => ({
      ...prev,
      content: newContent
    }));
    
    // Reset focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };
  
  // Create or update blog post
  const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    setLoading(true);
    setError(null);
    setSuccessMessage('');
    
    // Format tags
    const tagsArray = formData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag !== '');
    
    // Clean up contentImages and contentVideos
    const cleanedImages = cleanupContentImages(formData.content, formData.contentImages);
    const cleanedVideos = cleanupContentVideos(formData.content, formData.contentVideos);
    
    const blogData = {
      ...formData,
      tags: tagsArray,
      contentImages: cleanedImages,
      contentVideos: cleanedVideos,
      isSubscriberOnly: formData.isSubscriberOnly  // ADD THIS LINE
    };
    
    let response;
    
    if (selectedBlog) {
      response = await axios.put(`https://aadibgmg.onrender.com/api/blogs/${selectedBlog._id}`, blogData, {
        withCredentials: true
      });
      setSuccessMessage('Blog post updated successfully!');
    } else {
      response = await axios.post('https://aadibgmg.onrender.com/api/blogs', blogData, {
        withCredentials: true
      });
      setSuccessMessage('Blog post created successfully!');
    }
    
    fetchBlogs();
    
    setTimeout(() => {
      setSuccessMessage('');
      setEditMode(false);
      setSelectedBlog(null);
      setViewMode('list');
    }, 3000);
    
  } catch (err) {
    console.error('Error saving blog:', err);
    setError(err.response?.data?.message || 'Failed to save blog post. Please try again.');
  } finally {
    setLoading(false);
  }
};
  
  // Delete blog post
  const handleDelete = async (blogId) => {
    if (!window.confirm('Are you sure you want to delete this blog post? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      await axios.delete(`https://aadibgmg.onrender.com/api/blogs/${blogId}`, {
        withCredentials: true
      });
      
      // Refresh blog list
      fetchBlogs();
      setSuccessMessage('Blog post deleted successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (err) {
      console.error('Error deleting blog:', err);
      setError(err.response?.data?.message || 'Failed to delete blog post. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Format text in editor
  const formatText = (e, formatting) => {
    e.preventDefault();
    const textarea = document.getElementById('content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.content.substring(start, end);
    let formattedText = '';
    
    switch(formatting) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'heading':
        formattedText = `# ${selectedText}`;
        break;
      case 'subheading':
        formattedText = `## ${selectedText}`;
        break;
      case 'list':
        formattedText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
        break;
      case 'link':
        const url = prompt('Enter URL:', 'https://');
        if (url) {
          formattedText = `[${selectedText || 'link text'}](${url})`;
        } else {
          return; // User cancelled
        }
        break;
      case 'image':
        setImageModal(prev => ({ ...prev, isOpen: true }));
        return;
      case 'video':
        setVideoModal(prev => ({ ...prev, isOpen: true }));
        return;
      case 'audio':
        setAudioModal(prev => ({ ...prev, isOpen: true }));
        return;
      default:
        return;
    }
    
    // Insert the formatted text
    const newContent = formData.content.substring(0, start) + formattedText + formData.content.substring(end);
    setFormData(prev => ({
      ...prev,
      content: newContent
    }));
    
    // Reset focus to textarea after operation
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 0);
  };
  
  // Handle view analytics
  const handleViewAnalytics = (blog) => {
    setViewMode('analytics');
    setAnalyticsId(blog._id);
    // Scroll to top for better UX
    window.scrollTo(0, 0);
  };
  
  // Modify cancel function
// 6. UPDATE handleCancel FUNCTION (around line 330)


// 7. UPDATE handleEdit FUNCTION (around line 350)
const handleCancel = () => {
  setViewMode('list');
  setEditMode(false);
  setSelectedBlog(null);
  setAnalyticsId(null);
  setSuccessMessage('');
  setImageModal({
    isOpen: false,
    url: '',
    alt: '',
    caption: '',
    position: 'center'
  });
  setEditImageModal({
    isOpen: false,
    imageId: null,
    url: '',
    alt: '',
    caption: '',
    position: 'center'
  });
  setVideoModal({
    isOpen: false,
    url: '',
    title: '',
    caption: '',
    position: 'center',
    autoplay: false,
    muted: false
  });
  setAudioModal({
    isOpen: false,
    file: null,
    duration: '',
    bitrate: '',
    sampleRate: '',
    channels: 2,
    language: 'en',
    narrator: '',
    isSubscriberOnly: false
  });
  setEditAudioModal({
    isOpen: false,
    file: null,
    duration: '',
    bitrate: '',
    sampleRate: '',
    channels: 2,
    language: 'en',
    narrator: '',
    isSubscriberOnly: false,
    replaceFile: false
  });
};
const handleEdit = async (blog) => {
  setViewMode('edit');
  setEditMode(true);
  setSelectedBlog(blog);
  setFormData({
    title: blog.title,
    content: blog.content,
    summary: blog.summary,
    tags: blog.tags.join(', '),
    status: blog.status,
    featuredImage: blog.featuredImage || '',
    contentImages: blog.contentImages || [],
    contentVideos: blog.contentVideos || [],
    isSubscriberOnly: blog.isSubscriberOnly || false,
    audioBlog: blog.audioBlog || {
      audioFile: null,
      duration: '',
      bitrate: '',
      sampleRate: '',
      channels: 2,
      language: 'en',
      narrator: '',
      isSubscriberOnly: false
    }
  });
  
  window.scrollTo(0, 0);
};
// 8. UPDATE handleNew FUNCTION (around line 365)

const handleNew = () => {
  setViewMode('edit');
  setEditMode(true);
  setSelectedBlog(null);
  setFormData({
    title: '',
    content: '',
    summary: '',
    tags: '',
    status: 'draft',
    featuredImage: '',
    contentImages: [],
    contentVideos: [],
    isSubscriberOnly: false,
    audioBlog: {
      audioFile: null,
      duration: '',
      bitrate: '',
      sampleRate: '',
      channels: 2,
      language: 'en',
      narrator: '',
      isSubscriberOnly: false
    }
  });
  
  window.scrollTo(0, 0);
};
// 9. ADD AUDIO SECTION COMPONENT (after ContentVideosSection)

const AudioBlogSection = ({ audioBlog }) => {
  if (!audioBlog.audioFile) {
    return null;
  }

  return (
    <div className="form-group audio-section">
      <label>Audio Blog</label>
      <div className="audio-info">
        <div className="audio-details">
          <span className="audio-filename">
            📻 {audioBlog.audioFile.originalFileName || audioBlog.audioFile.name || 'Audio file'}
          </span>
          <div className="audio-metadata">
            {audioBlog.duration && (
              <span>Duration: {audioBlog.duration}s</span>
            )}
            {audioBlog.bitrate && (
              <span>Bitrate: {audioBlog.bitrate}</span>
            )}
            {audioBlog.language && (
              <span>Language: {audioBlog.language}</span>
            )}
            {audioBlog.narrator && (
              <span>Narrator: {audioBlog.narrator}</span>
            )}
            {audioBlog.isSubscriberOnly && (
              <span className="subscriber-badge">🔒 Subscriber Only</span>
            )}
          </div>
        </div>
        <div className="content-image-actions">
          <button
            type="button"
            className="img-edt-btn"
            onClick={() => handleEditAudio()}
            title="Edit audio metadata"
          >
            Edit
          </button>
          <button
            type="button"
            className="img-remv-btn"
            onClick={() => handleRemoveAudio()}
            title="Remove audio blog"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

  // Extract video information from URL
  const extractVideoInfo = (url) => {
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
  };
  
  // Handle video addition
  const handleAddVideo = async () => {
    if (!videoModal.url.trim()) {
      setError('Please enter a video URL');
      return;
    }
    
    // Basic URL validation
    try {
      new URL(videoModal.url);
      const videoInfo = extractVideoInfo(videoModal.url);
      if (!videoInfo) {
        setError('Invalid video URL. Currently supported: YouTube, Vimeo, Dailymotion');
        return;
      }
    } catch {
      setError('Please enter a valid URL');
      return;
    }
    
    try {
      setUploadingVideo(true);
      setError(null);
      
      // If we're editing an existing blog, add video via API
      if (selectedBlog) {
        const response = await axios.post(
          `https://aadibgmg.onrender.com/api/blogs/${selectedBlog._id}/videos`,
          {
            url: videoModal.url,
            title: videoModal.title,
            caption: videoModal.caption,
            position: videoModal.position,
            autoplay: videoModal.autoplay,
            muted: videoModal.muted
          },
          { withCredentials: true }
        );
        
        const { embedId, embedCode } = response.data;
        
        // Insert embed code at cursor position
        insertTextAtCursor(embedCode);
        
        // Update contentVideos in formData
        setFormData(prev => ({
          ...prev,
          contentVideos: [...prev.contentVideos, response.data.video]
        }));
      } else {
        // For new blogs, generate temporary embed ID and add to contentVideos
        const embedId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const embedCode = `[VIDEO:${embedId}]`;
        
        const videoInfo = extractVideoInfo(videoModal.url);
        const newVideo = {
          url: videoModal.url,
          title: videoModal.title,
          caption: videoModal.caption,
          position: videoModal.position,
          autoplay: videoModal.autoplay,
          muted: videoModal.muted,
          embedId: embedId,
          videoId: videoInfo.videoId,
          platform: videoInfo.platform
        };
        
        // Insert embed code at cursor position
        insertTextAtCursor(embedCode);
        
        // Update contentVideos in formData
        setFormData(prev => ({
          ...prev,
          contentVideos: [...prev.contentVideos, newVideo]
        }));
      }
      
      // Close modal and reset
      setVideoModal({
        isOpen: false,
        url: '',
        title: '',
        caption: '',
        position: 'center',
        autoplay: false,
        muted: false
      });
      
    } catch (err) {
      console.error('Error adding video:', err);
      setError(err.response?.data?.message || 'Failed to add video. Please try again.');
    } finally {
      setUploadingVideo(false);
    }
  };
// Handle edit image modal input changes
const handleEditImageModalChange = (e) => {
  const { name, value } = e.target;
  setEditImageModal(prev => ({
    ...prev,
    [name]: value
  }));
};
// Open edit modal for specific image
const handleEditImage = (image) => {
  setEditImageModal({
    isOpen: true,
    imageId: image.imageId,
    url: image.url,
    alt: image.alt || '',
    caption: image.caption || '',
    position: image.position || 'center'
  });
};
// Update existing image
const handleUpdateImage = async () => {
  if (!editImageModal.url.trim()) {
    setError('Please enter an image URL');
    return;
  }
  
  // Basic URL validation
  try {
    new URL(editImageModal.url);
  } catch {
    setError('Please enter a valid URL');
    return;
  }
  
  try {
    setUpdatingImage(true);
    setError(null);
    
    // If we're editing an existing blog, update image via API
    if (selectedBlog) {
      const response = await axios.put(
        `https://aadibgmg.onrender.com/api/blogs/${selectedBlog._id}/images/${editImageModal.imageId}`,
        {
          url: editImageModal.url,
          alt: editImageModal.alt,
          caption: editImageModal.caption,
          position: editImageModal.position
        },
        { withCredentials: true }
      );
      
      // Update contentImages in formData
      setFormData(prev => ({
        ...prev,
        contentImages: prev.contentImages.map(img => 
          img.imageId === editImageModal.imageId 
            ? response.data.image 
            : img
        )
      }));
      
      setSuccessMessage('Image updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      // For new blogs (not yet saved), update in local state
      setFormData(prev => ({
        ...prev,
        contentImages: prev.contentImages.map(img => 
          img.imageId === editImageModal.imageId 
            ? {
                ...img,
                url: editImageModal.url,
                alt: editImageModal.alt,
                caption: editImageModal.caption,
                position: editImageModal.position
              }
            : img
        )
      }));
      
      setSuccessMessage('Image updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
    
    // Close modal and reset
    setEditImageModal({
      isOpen: false,
      imageId: null,
      url: '',
      alt: '',
      caption: '',
      position: 'center'
    });
    
  } catch (err) {
    console.error('Error updating image:', err);
    setError(err.response?.data?.message || 'Failed to update image. Please try again.');
  } finally {
    setUpdatingImage(false);
  }
};
  // Content Images Section
const ContentImagesSection = ({ contentImages, content }) => {
  const activeImages = generateImagePreview(contentImages, content);
  
  if (!activeImages || activeImages.length === 0) {
    return null;
  }
  
  return (
    <div className="form-group">
      <label>Content Images ({activeImages.length})</label>
      <div className="content-images-list">
        {activeImages.map((image, index) => (
          <div key={image.imageId || index} className="content-image-item">
            <img 
              src={image.url} 
              alt={image.alt} 
              className="content-image-thumb"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/50x50?text=Error';
              }}
            />
            <div className="content-image-info">
              <span className="image-id">[IMAGE:{image.imageId}]</span>
              <span className="image-position">{image.position}</span>
              {image.caption && <span className="image-caption">{image.caption}</span>}
            </div>
            <div className="content-image-actions">
              <button
                type="button"
                className="img-edt-btn"
                onClick={() => handleEditImage(image)}
                title="Edit this image"
              >
                Edit
              </button>
              <button
                type="button"
                className="img-remv-btn"
                onClick={() => removeImageFromContent(image.imageId)}
                title="Remove this image from content"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="helper-text">
        Only images referenced in your content are shown above. 
        Click "Edit" to modify image properties or "Remove" to delete from content.
      </div>
    </div>
  );
};

  // Content Videos Section
  const ContentVideosSection = ({ contentVideos, content }) => {
    const activeVideos = generateVideoPreview(contentVideos, content);
    
    if (!activeVideos || activeVideos.length === 0) {
      return null;
    }
    
    return (
      <div className="form-group">
        <label>Content Videos ({activeVideos.length})</label>
        <div className="content-videos-list">
          {activeVideos.map((video, index) => (
            <div key={video.embedId || index} className="content-video-item">
              <div className="content-video-thumb">
                {video.platform === 'youtube' && (
                  <img
                    src={`https://img.youtube.com/vi/${video.videoId}/default.jpg`}
                    alt={video.title || 'Video thumbnail'}
                    className="content-video-thumb-img"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/50x50?text=Video';
                    }}
                  />
                )}
                {video.platform === 'vimeo' && (
                  <img
                    src={`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video.url)}&maxwidth=50`}
                    alt={video.title || 'Video thumbnail'}
                    className="content-video-thumb-img"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/50x50?text=Video';
                    }}
                  />
                )}
                {video.platform === 'dailymotion' && (
                  <img
                    src={`https://www.dailymotion.com/thumbnail/video/${video.videoId}`}
                    alt={video.title || 'Video thumbnail'}
                    className="content-video-thumb-img"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/50x50?text=Video';
                    }}
                  />
                )}
              </div>
              <div className="content-video-info">
                <span className="video-id">[VIDEO:{video.embedId}]</span>
                <span className="video-position">{video.position}</span>
                {video.title && <span className="video-title">{video.title}</span>}
                {video.caption && <span className="video-caption">{video.caption}</span>}
                <span className="video-options">
                  {video.autoplay ? 'Autoplay: On' : 'Autoplay: Off'}, {video.muted ? 'Muted: On' : 'Muted: Off'}
                </span>
              </div>
              <div className='content-image-actions'>
              <button
                type="button"
                className="img-remv-btn"
                onClick={() => removeVideoFromContent(video.embedId)}
                title="Remove this video from content"
              >
                Remove
              </button>
              </div>
            </div>
          ))}
        </div>
        <div className="helper-text">
          Only videos referenced in your content are shown above. 
          Remove the [VIDEO:embedId] placeholder from your content to remove a video.
        </div>
      </div>
    );
  };

  // Function to remove image placeholder from content
  const removeImageFromContent = (imageId) => {
    const placeholder = `[IMAGE:${imageId}]`;
    const newContent = formData.content.replace(new RegExp(escapeRegExp(placeholder), 'g'), '');
    
    // Update content and let handleInputChange clean up the images array
    const updatedImages = cleanupContentImages(newContent, formData.contentImages);
    
    setFormData(prev => ({
      ...prev,
      content: newContent,
      contentImages: updatedImages
    }));
  };

  // Function to remove video placeholder from content
  const removeVideoFromContent = (embedId) => {
    const placeholder = `[VIDEO:${embedId}]`;
    const newContent = formData.content.replace(new RegExp(escapeRegExp(placeholder), 'g'), '');
    
    // Update content and let handleInputChange clean up the videos array
    const updatedVideos = cleanupContentVideos(newContent, formData.contentVideos);
    
    setFormData(prev => ({
      ...prev,
      content: newContent,
      contentVideos: updatedVideos
    }));
  };

  // Helper function to escape regex special characters
  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Enhanced image modal with better error handling
  const handleAddImage = async () => {
    if (!imageModal.url.trim()) {
      setError('Please enter an image URL');
      return;
    }
    
    // Basic URL validation
    try {
      new URL(imageModal.url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }
    
    try {
      setUploadingImage(true);
      setError(null);
      
      // If we're editing an existing blog, add image via API
      if (selectedBlog) {
        const response = await axios.post(
          `https://aadibgmg.onrender.com/api/blogs/${selectedBlog._id}/images`,
          {
            url: imageModal.url,
            alt: imageModal.alt,
            caption: imageModal.caption,
            position: imageModal.position
          },
          { withCredentials: true }
        );
        
        const { imageId, embedCode } = response.data;
        
        // Insert embed code at cursor position
        insertTextAtCursor(embedCode);
        
        // Update contentImages in formData
        setFormData(prev => ({
          ...prev,
          contentImages: [...prev.contentImages, response.data.image]
        }));
      } else {
        // For new blogs, generate temporary image ID and add to contentImages
        const imageId = 'temp_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const embedCode = `[IMAGE:${imageId}]`;
        
        const newImage = {
          url: imageModal.url,
          alt: imageModal.alt,
          caption: imageModal.caption,
          position: imageModal.position,
          imageId: imageId
        };
        
        // Insert embed code at cursor position
        insertTextAtCursor(embedCode);
        
        // Update contentImages in formData
        setFormData(prev => ({
          ...prev,
          contentImages: [...prev.contentImages, newImage]
        }));
      }
      
      // Close modal and reset
      setImageModal({
        isOpen: false,
        url: '',
        alt: '',
        caption: '',
        position: 'center'
      });
      
    } catch (err) {
      console.error('Error adding image:', err);
      setError(err.response?.data?.message || 'Failed to add image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="blog-management-panel">
      <div className="container">
        {/* Header with title and create new button */}
        <div className="panel-header">
          {viewMode === 'list' && (
            <>
              <h1>Blog Management</h1>
              <button 
                className="btn3 btn-analytics1"
                onClick={handleNew}
              >
                Add New Post
              </button>
            </>
          )}
          
          {viewMode === 'edit' && (
            <>
              <h1>{selectedBlog ? 'Edit Blog Post' : 'Create New Blog Post'}</h1>
              <button 
                className="btn-back"
                onClick={handleCancel}
              >
                Back to Blog List
              </button>
            </>
          )}
          
          {viewMode === 'analytics' && (
            <h1>Blog Analytics</h1>
          )}
        </div>
        
        {/* Success message */}
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {/* Image Modal */}
        {imageModal.isOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add Image to Content</h3>
                <button 
                  className="modal-close"
                  onClick={() => setImageModal(prev => ({ ...prev, isOpen: false }))}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="imageUrl">Image URL *</label>
                  <input
                    type="url"
                    id="imageUrl"
                    name="url"
                    value={imageModal.url}
                    onChange={handleImageModalChange}
                    placeholder="https://example.com/image.jpg"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="imageAlt">Alt Text</label>
                  <input
                    type="text"
                    id="imageAlt"
                    name="alt"
                    value={imageModal.alt}
                    onChange={handleImageModalChange}
                    placeholder="Description of the image"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="imageCaption">Caption</label>
                  <input
                    type="text"
                    id="imageCaption"
                    name="caption"
                    value={imageModal.caption}
                    onChange={handleImageModalChange}
                    placeholder="Image caption (optional)"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="imagePosition">Position</label>
                  <select
                    id="imagePosition"
                    name="position"
                    value={imageModal.position}
                    onChange={handleImageModalChange}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                    <option value="full-width">Full Width</option>
                  </select>
                </div>
                {imageModal.url && (
                  <div className="image-preview">
                    <p>Preview:</p>
                    <img
                      src={imageModal.url}
                      alt="Preview"
                      style={{ maxWidth: '100%', maxHeight: '200px' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/400x200?text=Invalid+Image+URL';
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setImageModal(prev => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddImage}
                  disabled={uploadingImage || !imageModal.url.trim()}
                >
                  {uploadingImage && <span className="spinner"></span>}
                  Add Image
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Edit Image Modal */}
{editImageModal.isOpen && (
  <div className="modal-overlay">
    <div className="modal-content">
      <div className="modal-header">
        <h3>Edit Image</h3>
        <button 
          className="modal-close"
          onClick={() => setEditImageModal(prev => ({ ...prev, isOpen: false }))}
        >
          ×
        </button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label htmlFor="editImageUrl">Image URL *</label>
          <input
            type="url"
            id="editImageUrl"
            name="url"
            value={editImageModal.url}
            onChange={handleEditImageModalChange}
            placeholder="https://example.com/image.jpg"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="editImageAlt">Alt Text</label>
          <input
            type="text"
            id="editImageAlt"
            name="alt"
            value={editImageModal.alt}
            onChange={handleEditImageModalChange}
            placeholder="Description of the image"
          />
        </div>
        <div className="form-group">
          <label htmlFor="editImageCaption">Caption</label>
          <input
            type="text"
            id="editImageCaption"
            name="caption"
            value={editImageModal.caption}
            onChange={handleEditImageModalChange}
            placeholder="Image caption (optional)"
          />
        </div>
        <div className="form-group">
          <label htmlFor="editImagePosition">Position</label>
          <select
            id="editImagePosition"
            name="position"
            value={editImageModal.position}
            onChange={handleEditImageModalChange}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
            <option value="full-width">Full Width</option>
          </select>
        </div>
        {editImageModal.url && (
          <div className="image-preview">
            <p>Preview:</p>
            <img
              src={editImageModal.url}
              alt="Preview"
              style={{ maxWidth: '100%', maxHeight: '200px' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/400x200?text=Invalid+Image+URL';
              }}
            />
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setEditImageModal(prev => ({ ...prev, isOpen: false }))}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleUpdateImage}
          disabled={updatingImage || !editImageModal.url.trim()}
        >
          {updatingImage && <span className="spinner"></span>}
          Update Image
        </button>
      </div>
    </div>
  </div>
)}
        {/* Video Modal */}
        {videoModal.isOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add Video to Content</h3>
                <button 
                  className="modal-close"
                  onClick={() => setVideoModal(prev => ({ ...prev, isOpen: false }))}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="videoUrl">Video URL * (YouTube, Vimeo, Dailymotion)</label>
                  <input
                    type="url"
                    id="videoUrl"
                    name="url"
                    value={videoModal.url}
                    onChange={handleVideoModalChange}
                    placeholder="https://youtube.com/watch?v=videoId"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="videoTitle">Video Title</label>
                  <input
                    type="text"
                    id="videoTitle"
                    name="title"
                    value={videoModal.title}
                    onChange={handleVideoModalChange}
                    placeholder="Video title (optional)"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="videoCaption">Caption</label>
                  <input
                    type="text"
                    id="videoCaption"
                    name="caption"
                    value={videoModal.caption}
                    onChange={handleVideoModalChange}
                    placeholder="Video caption (optional)"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="videoPosition">Position</label>
                  <select
                    id="videoPosition"
                    name="position"
                    value={videoModal.position}
                    onChange={handleVideoModalChange}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                    <option value="full-width">Full Width</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      name="autoplay"
                      checked={videoModal.autoplay}
                      onChange={handleVideoModalChange}
                    />
                    Autoplay
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      name="muted"
                      checked={videoModal.muted}
                      onChange={handleVideoModalChange}
                    />
                    Muted
                  </label>
                </div>
                {videoModal.url && extractVideoInfo(videoModal.url) && (
                  <div className="video-preview">
                    <p>Preview:</p>
                    <div className="video-preview-wrapper">
                      {extractVideoInfo(videoModal.url).platform === 'youtube' && (
                        <img
                          src={`https://img.youtube.com/vi/${extractVideoInfo(videoModal.url).videoId}/default.jpg`}
                          alt="Video preview"
                          style={{ maxWidth: '100%', maxHeight: '200px' }}
                        />
                      )}
                      {extractVideoInfo(videoModal.url).platform === 'vimeo' && (
                        <img
                          src={`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoModal.url)}&maxwidth=200`}
                          alt="Video preview"
                          style={{ maxWidth: '100%', maxHeight: '200px' }}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://via.placeholder.com/400x200?text=Video+Preview';
                          }}
                        />
                      )}
                      {extractVideoInfo(videoModal.url).platform === 'dailymotion' && (
                        <img
                          src={`https://www.dailymotion.com/thumbnail/video/${extractVideoInfo(videoModal.url).videoId}`}
                          alt="Video preview"
                          style={{ maxWidth: '100%', maxHeight: '200px' }}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://via.placeholder.com/400x200?text=Video+Preview';
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setVideoModal(prev => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddVideo}
                  disabled={uploadingVideo || !videoModal.url.trim()}
                >
                  {uploadingVideo && <span className="spinner"></span>}
                  Add Video
                </button>
              </div>
            </div>
          </div>
        )}
      

{audioModal.isOpen && (
  <div className="modal-overlay">
    <div className="modal-content">
      <div className="modal-header">
        <h3>Add Audio Blog</h3>
        <button 
          className="modal-close"
          onClick={() => setAudioModal(prev => ({ ...prev, isOpen: false }))}
        >
          ×
        </button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label htmlFor="audioFile">Audio File * (MP3, WAV, WebM, OGG, AAC, FLAC)</label>
          <input
            type="file"
            id="audioFile"
            name="audioFile"
            accept="audio/*"
            onChange={handleAudioModalChange}
            required
          />
          {audioModal.file && (
            <div className="file-info">
              <p>Selected: {audioModal.file.name}</p>
              <p>Size: {(audioModal.file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="audioDuration">Duration (seconds)</label>
          <input
            type="number"
            id="audioDuration"
            name="duration"
            value={audioModal.duration}
            onChange={handleAudioModalChange}
            placeholder="e.g., 600"
          />
        </div>
        <div className="form-group">
          <label htmlFor="audioBitrate">Bitrate</label>
          <input
            type="text"
            id="audioBitrate"
            name="bitrate"
            value={audioModal.bitrate}
            onChange={handleAudioModalChange}
            placeholder="e.g., 128 kbps"
          />
        </div>
        <div className="form-group">
          <label htmlFor="audioSampleRate">Sample Rate (Hz)</label>
          <input
            type="number"
            id="audioSampleRate"
            name="sampleRate"
            value={audioModal.sampleRate}
            onChange={handleAudioModalChange}
            placeholder="e.g., 44100"
          />
        </div>
        <div className="form-group">
          <label htmlFor="audioChannels">Channels</label>
          <select
            id="audioChannels"
            name="channels"
            value={audioModal.channels}
            onChange={handleAudioModalChange}
          >
            <option value="1">Mono</option>
            <option value="2">Stereo</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="audioLanguage">Language</label>
          <select
            id="audioLanguage"
            name="language"
            value={audioModal.language}
            onChange={handleAudioModalChange}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="hi">Hindi</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
            <option value="ar">Arabic</option>
            <option value="pt">Portuguese</option>
            <option value="ru">Russian</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="audioNarrator">Narrator</label>
          <input
            type="text"
            id="audioNarrator"
            name="narrator"
            value={audioModal.narrator}
            onChange={handleAudioModalChange}
            placeholder="e.g., John Doe"
          />
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="isSubscriberOnly"
              checked={audioModal.isSubscriberOnly}
              onChange={handleAudioModalChange}
            />
            Audio is Subscriber Only
          </label>
        </div>
      </div>
      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setAudioModal(prev => ({ ...prev, isOpen: false }))}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAddAudio}
          disabled={uploadingAudio || !audioModal.file}
        >
          {uploadingAudio && <span className="spinner"></span>}
          Upload Audio
        </button>
      </div>
    </div>
  </div>
)}
{/* Edit Audio Modal */}
{editAudioModal.isOpen && (
  <div className="modal-overlay">
    <div className="modal-content">
      <div className="modal-header">
        <h3>Edit Audio Blog</h3>
        <button 
          className="modal-close"
          onClick={() => setEditAudioModal(prev => ({ ...prev, isOpen: false }))}
        >
          ×
        </button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label>Replace Audio File (Optional)</label>
          <input
            type="file"
            id="editAudioFile"
            name="audioFile"
            accept="audio/*"
            onChange={handleEditAudioModalChange}
          />
          {editAudioModal.file && (
            <div className="file-info">
              <p>New file: {editAudioModal.file.name}</p>
              <p>Size: {(editAudioModal.file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          )}
          {!editAudioModal.file && (
            <p className="helper-text">Leave empty to keep existing audio file</p>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="editAudioDuration">Duration (seconds)</label>
          <input
            type="number"
            id="editAudioDuration"
            name="duration"
            value={editAudioModal.duration}
            onChange={handleEditAudioModalChange}
            placeholder="e.g., 600"
          />
        </div>
        <div className="form-group">
          <label htmlFor="editAudioBitrate">Bitrate</label>
          <input
            type="text"
            id="editAudioBitrate"
            name="bitrate"
            value={editAudioModal.bitrate}
            onChange={handleEditAudioModalChange}
            placeholder="e.g., 128 kbps"
          />
        </div>
        <div className="form-group">
          <label htmlFor="editAudioSampleRate">Sample Rate (Hz)</label>
          <input
            type="number"
            id="editAudioSampleRate"
            name="sampleRate"
            value={editAudioModal.sampleRate}
            onChange={handleEditAudioModalChange}
            placeholder="e.g., 44100"
          />
        </div>
        <div className="form-group">
          <label htmlFor="editAudioChannels">Channels</label>
          <select
            id="editAudioChannels"
            name="channels"
            value={editAudioModal.channels}
            onChange={handleEditAudioModalChange}
          >
            <option value="1">Mono</option>
            <option value="2">Stereo</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="editAudioLanguage">Language</label>
          <select
            id="editAudioLanguage"
            name="language"
            value={editAudioModal.language}
            onChange={handleEditAudioModalChange}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="hi">Hindi</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
            <option value="ar">Arabic</option>
            <option value="pt">Portuguese</option>
            <option value="ru">Russian</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="editAudioNarrator">Narrator</label>
          <input
            type="text"
            id="editAudioNarrator"
            name="narrator"
            value={editAudioModal.narrator}
            onChange={handleEditAudioModalChange}
            placeholder="e.g., John Doe"
          />
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="isSubscriberOnly"
              checked={editAudioModal.isSubscriberOnly}
              onChange={handleEditAudioModalChange}
            />
            Audio is Subscriber Only
          </label>
        </div>
      </div>
      <div className="modal-footer">
        <button
          type="button"
          className="btn img-remv-btn"
          onClick={() => setEditAudioModal(prev => ({ ...prev, isOpen: false }))}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn img-edt-btn"
          onClick={handleUpdateAudio}
          disabled={uploadingAudio}
        >
          {uploadingAudio && <span className="spinner"></span>}
          Update Audio
        </button>
      </div>
    </div>
  </div>
)}
        {/* Blog editor */}
        {viewMode === 'edit' && (
          <div className="blog-editor-section">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter blog title"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="summary">Summary (max 200 characters) *</label>
                <textarea
                  id="summary"
                  name="summary"
                  value={formData.summary}
                  onChange={handleInputChange}
                  required
                  maxLength={200}
                  rows={3}
                  placeholder="Brief summary of the blog post"
                ></textarea>
                <span className="character-count">{formData.summary.length}/200 characters</span>
              </div>
              
              <div className="form-group">
                <label htmlFor="content">Content *</label>
                <div className="editor-toolbar">
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'heading')}
                    className="toolbar-btn"
                    title="Heading"
                  >
                    <strong>H1</strong>
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'subheading')}
                    className="toolbar-btn"
                    title="Subheading"
                  >
                    <strong>H2</strong>
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'bold')}
                    className="toolbar-btn"
                    title="Bold"
                  >
                    <strong>B</strong>
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'italic')}
                    className="toolbar-btn"
                    title="Italic"
                  >
                    <em>I</em>
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'list')}
                    className="toolbar-btn"
                    title="List"
                  >
                    <span>• List</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'link')}
                    className="toolbar-btn"
                    title="Insert Link"
                  >
                    <span>🔗 Link</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'image')}
                    className="toolbar-btn"
                    title="Insert Image"
                  >
                    <span>🖼️ Image</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'video')}
                    className="toolbar-btn"
                    title="Insert Video"
                  >
                    <span>🎥 Video</span>
                  </button>
                  <button 
  type="button" 
  onClick={(e) => formatText(e, 'audio')}
  className="toolbar-btn"
  title="Add Audio Blog"
>
  <span>🎙️ Audio</span>
</button>

                </div>
                <textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleInputChange}
                  required
                  rows={15}
                  placeholder="Write your blog content here... Use the toolbar to format your text or use Markdown directly. Click the Image or Video button to embed images or videos within your content."
                ></textarea>
                <span className="helper-text">
                  Markdown is supported. You can use **bold**, *italic*, # headings, etc. 
                  Use [IMAGE:imageId] or [VIDEO:embedId] placeholders to embed images or videos within content.
                </span>
              </div>
              
              <div className="form-group">
                <label htmlFor="featuredImage">Featured Image URL</label>
                <input
                  type="url"
                  id="featuredImage"
                  name="featuredImage"
                  value={formData.featuredImage}
                  onChange={handleInputChange}
                  placeholder="https://example.com/image.jpg"
                />
                {formData.featuredImage && (
                  <div className="image-preview">
                    <p>Preview:</p>
                    <img
                      src={formData.featuredImage}
                      alt="Featured"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/640x360?text=Invalid+Image+URL';
                      }}
                    />
                  </div>
                )}
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tags">Tags</label>
                  <input
                    type="text"
                    id="tags"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    placeholder="tag1, tag2, tag3"
                  />
                  <span className="helper-text">Separate tags with commas</span>
                </div>
                
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              <div className="form-group subscriber-only-section">
  <div className="subscriber-only-container">
    <div className="subscriber-only-checkbox">
      <label htmlFor="isSubscriberOnly" className="checkbox-label">
        <input
          type="checkbox"
          id="isSubscriberOnly"
          name="isSubscriberOnly"
          checked={formData.isSubscriberOnly}
          onChange={handleInputChange}
        />
        <span className="checkbox-text">Subscriber Only Content</span>
      </label>
      <span className="helper-text">
        If enabled, this blog will only be visible to logged-in subscribers. 
        Public users will see only the title, summary, featured image, and publish date.
      </span>
    </div>
    
    {formData.isSubscriberOnly && formData.status === 'published' && (
      <div className="subscriber-only-info">
        <div className="info-badge">
          <span className="info-icon">🔒</span>
          <span className="info-text">This is subscriber-only content</span>
        </div>
        <p className="info-description">
          Only authenticated users will be able to see the full article content.
        </p>
      </div>
    )}
  </div>
</div>
              {/* Content Images Summary */}
              {formData.contentImages && formData.contentImages.length > 0 && (
                <ContentImagesSection 
                  contentImages={formData.contentImages} 
                  content={formData.content} 
                />
              )}
              
              {/* Content Videos Summary */}
              {formData.contentVideos && formData.contentVideos.length > 0 && (
                <ContentVideosSection 
                  contentVideos={formData.contentVideos} 
                  content={formData.content} 
                />
              )}
              {formData.audioBlog && formData.audioBlog.audioFile && (
  <AudioBlogSection audioBlog={formData.audioBlog} />
)}
              
              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn img-remv-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn img-edt-btn ${loading ? 'btn-loading' : ''}`}
                >
                  {loading && <span className="spinner"></span>}
                  {selectedBlog ? 'Update Blog Post' : 'Create Blog Post'}
                </button>
              </div>
            </form>
          </div>
        )}
        
        {viewMode === 'analytics' && analyticsId && (
          <div className="blog-analytics-section">
            <div className="analytics-blog-header">
              <div className="analytics-blog-info">
                {blogs.find(blog => blog._id === analyticsId) && (
                  <>
                    {blogs.find(blog => blog._id === analyticsId).featuredImage && (
                      <div className="analytics-featured-image">
                        <img 
                          src={blogs.find(blog => blog._id === analyticsId).featuredImage} 
                          alt={blogs.find(blog => blog._id === analyticsId).title}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://via.placeholder.com/400x200?text=Image+Not+Found';
                          }}
                        />
                      </div>
                    )}
                    <div className="analytics-blog-title">
                      <h2>{blogs.find(blog => blog._id === analyticsId).title}</h2>
                      <span className={`status-badge ${blogs.find(blog => blog._id === analyticsId).status}`}>
                        {blogs.find(blog => blog._id === analyticsId).status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="section-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                Back to Blog List
              </button>
            </div>
            <BlogAnalytics blogId={analyticsId} />
          </div>
        )}
        
        {/* Blog list */}
        {viewMode === 'list' && (
          <div className="blog-list-section">
            {/* Filters */}
            <div className="filters-section">
              <div className="filter-group">
                <label>Search</label>
                <input
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search by title or content..."
                />
              </div>
              <div className="filter-group">
                <label>Tag</label>
                <input
                  type="text"
                  name="tag"
                  value={filters.tag}
                  onChange={handleFilterChange}
                  placeholder="Filter by tag..."
                />
              </div>
              <div className="filter-group">
                <label>Status</label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading blog posts...</p>
              </div>
            ) : blogs.length === 0 ? (
              <div className="empty-state">
                <p>No blog posts found.</p>
                <p>Try adjusting your filters or create a new post.</p>
              </div>
            ) : (
              <>
                <div className="blog-cards">
                  {blogs.map(blog => (
                    <div key={blog._id} className="blog-card">
                       {blog.isSubscriberOnly && (
      <div className="subscriber-badge">
        <span>🔒</span>
        <span>Subscriber Only</span>
      </div>
    )}
                      {blog.featuredImage && (
                        <div className="card-image">
                          <img 
                            src={blog.featuredImage} 
                            alt={blog.title} 
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/640x360?text=Image+Not+Found';
                            }}
                          />
                        </div>
                      )}
                      <div className="card-content">
                        <div className="card-meta">
                          <span className={`status-badge ${blog.status}`}>
                            {blog.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                           {blog.isSubscriberOnly && (
          <span className="subscription-badge">Subscriber Only</span>
        )}
                          {blog.publishedAt && (
                            <span className="publish-date">
                              {formatDate(blog.publishedAt)}
                            </span>
                          )}
                        </div>
                        <h2 className="card-title">{blog.title}</h2>
                        <p className="card-summary">{blog.summary}</p>
                        {blog.tags.length > 0 && (
                          <div className="card-tags">
                            {blog.tags.map(tag => (
                              <span key={tag} className="tag">{tag}</span>
                            ))}
                          </div>
                        )}
                        
                        {/* Content Images and Videos Count */}
                        {(blog.contentImages?.length > 0 || blog.contentVideos?.length > 0) && (
                          <div className="card-images-count">
                            {blog.contentImages?.length > 0 && (
                              <span className="images-count">
                                🖼️ {blog.contentImages.length} embedded image{blog.contentImages.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {blog.contentVideos?.length > 0 && (
                              <span className="videos-count">
                                🎥 {blog.contentVideos.length} embedded video{blog.contentVideos.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {blog.audioBlog?.isAudioAvailable && (
  <div className="card-audio-badge">
    <span>🎙️ Audio Available</span>
    {blog.audioBlog.audioAccess?.isSubscriberOnly && (
      <span className="audio-subscriber-badge">🔒</span>
    )}
  </div>
)}
                          </div>
                        )}
                        
                        <div className="card-footer">
                          <div className="card-actions">
                            <button 
                              onClick={() => handleViewAnalytics(blog)}
                              className="btn3 btn-analytics1"
                              title="View blog analytics"
                            >
                              Analytics
                            </button>
                            <button 
                              onClick={() => handleEdit(blog)}
                              className="btn3 btn-edit1"
                              title="Edit blog post"
                            >
                              Edit Blog
                            </button>
                            <button 
                              onClick={() => handleDelete(blog._id)}
                              className="btn3 btn-delete1"
                              title="Delete blog post"
                            >
                              Delete It
                            </button>
                          </div>
                        </div>
                        
                        {/* Display reaction and comment counts if available */}
                        <div className="card-stats">
                          <div className="stat-item">
                            <span className="stat-icon">👍</span>
                            <span className="stat-value">{blog.reactionCounts?.likes || 0}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-icon">👎</span>
                            <span className="stat-value">{blog.reactionCounts?.dislikes || 0}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-icon">💬</span>
                            <span className="stat-value">{blog.commentsCount || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="pagination-btn"
                    >
                      Previous
                    </button>
                    
                    {[...Array(pagination.pages).keys()].map(number => (
                      <button
                        key={number + 1}
                        onClick={() => handlePageChange(number + 1)}
                        className={`pagination-btn ${pagination.page === number + 1 ? 'active' : ''}`}
                      >
                        {number + 1}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="pagination-btn"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogManagementPanel;