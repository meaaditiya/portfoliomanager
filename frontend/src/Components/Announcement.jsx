import React, { useState, useEffect } from 'react';
import { X, Upload, Eye, EyeOff, Pencil, Trash2, Plus, FileText, Image as ImageIcon, Calendar, Clock, Palette, Type, Bold, Italic, List, Code, Video, Link as LinkIcon } from 'lucide-react';
import './Announcement.css';

const AnnouncementAdmin = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showMarkdownHelper, setShowMarkdownHelper] = useState(false);
  
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
  
  const [formData, setFormData] = useState({
    title: '',
    titleColor: '#000000',
    caption: '',
    captionFormat: 'markdown',
    captionImages: [],
    captionVideos: [],
    linkUrl: '',
    linkName: 'Learn More',
    linkOpenInNewTab: true,
    priority: 0,
    isActive: true,
    image: null,
    document: null,
    removeImage: false,
    removeDocument: false,
    expiryType: 'none',
    expiryValue: '',
    expiresAt: '',
    removeExpiry: false
  });

  const API_BASE = 'https://aadibgmg.onrender.com/api';
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/announcement`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setAnnouncements(data.announcements || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      setError('Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'caption') {
      // Clean up captionImages and captionVideos when content changes
      const updatedImages = cleanupCaptionImages(value, formData.captionImages);
      const updatedVideos = cleanupCaptionVideos(value, formData.captionVideos);
      setFormData(prev => ({
        ...prev,
        [name]: value,
        captionImages: updatedImages,
        captionVideos: updatedVideos
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      setFormData(prev => ({
        ...prev,
        [name]: files[0]
      }));
    }
  };

  // Cleanup functions for images and videos
  const cleanupCaptionImages = (caption, captionImages) => {
    if (!caption || !Array.isArray(captionImages) || captionImages.length === 0) {
      return captionImages;
    }
    
    return captionImages.filter(image => {
      if (!image || !image.imageId) {
        return false;
      }
      const placeholder = `[IMAGE:${image.imageId}]`;
      return caption.includes(placeholder);
    });
  };

  const cleanupCaptionVideos = (caption, captionVideos) => {
    if (!caption || !Array.isArray(captionVideos) || captionVideos.length === 0) {
      return captionVideos;
    }
    
    return captionVideos.filter(video => {
      if (!video || !video.embedId) {
        return false;
      }
      const placeholder = `[VIDEO:${video.embedId}]`;
      return caption.includes(placeholder);
    });
  };

  const generateImagePreview = (captionImages, caption) => {
    if (!Array.isArray(captionImages) || captionImages.length === 0) {
      return [];
    }
    
    return captionImages.filter(image => {
      if (!image || !image.imageId || !caption) {
        return false;
      }
      const placeholder = `[IMAGE:${image.imageId}]`;
      return caption.includes(placeholder);
    });
  };

  const generateVideoPreview = (captionVideos, caption) => {
    if (!Array.isArray(captionVideos) || captionVideos.length === 0) {
      return [];
    }
    
    return captionVideos.filter(video => {
      if (!video || !video.embedId || !caption) {
        return false;
      }
      const placeholder = `[VIDEO:${video.embedId}]`;
      return caption.includes(placeholder);
    });
  };

  // Extract video information from URL
  const extractVideoInfo = (url) => {
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    
    if (youtubeMatch) {
      return {
        platform: 'youtube',
        videoId: youtubeMatch[1],
        url: url
      };
    }
    
    const vimeoRegex = /(?:vimeo\.com\/)([0-9]+)/;
    const vimeoMatch = url.match(vimeoRegex);
    
    if (vimeoMatch) {
      return {
        platform: 'vimeo',
        videoId: vimeoMatch[1],
        url: url
      };
    }
    
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

  // Insert text at cursor position
  const insertTextAtCursor = (text) => {
    const textarea = document.getElementById('caption');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newCaption = formData.caption.substring(0, start) + text + formData.caption.substring(end);
    
    setFormData(prev => ({
      ...prev,
      caption: newCaption
    }));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  // Handle image modal
  const handleImageModalChange = (e) => {
    const { name, value } = e.target;
    setImageModal(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddImage = async () => {
    if (!imageModal.url.trim()) {
      setError('Please enter an image URL');
      return;
    }
    
    try {
      new URL(imageModal.url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }
    
    try {
      setUploadingImage(true);
      setError(null);
      
      if (currentAnnouncement) {
        const response = await fetch(
          `${API_BASE}/admin/announcement/${currentAnnouncement._id}/caption-images`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: imageModal.url,
              alt: imageModal.alt,
              caption: imageModal.caption,
              position: imageModal.position
            })
          }
        );
        
        const data = await response.json();
        
        if (response.ok) {
          const { imageId, embedCode } = data;
          insertTextAtCursor(embedCode);
          setFormData(prev => ({
            ...prev,
            captionImages: [...prev.captionImages, data.image]
          }));
        } else {
          setError(data.message || 'Failed to add image');
          return;
        }
      } else {
        const imageId = 'temp_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const embedCode = `[IMAGE:${imageId}]`;
        
        const newImage = {
          url: imageModal.url,
          alt: imageModal.alt,
          caption: imageModal.caption,
          position: imageModal.position,
          imageId: imageId
        };
        
        insertTextAtCursor(embedCode);
        setFormData(prev => ({
          ...prev,
          captionImages: [...prev.captionImages, newImage]
        }));
      }
      
      setImageModal({
        isOpen: false,
        url: '',
        alt: '',
        caption: '',
        position: 'center'
      });
      
    } catch (err) {
      console.error('Error adding image:', err);
      setError('Failed to add image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle video modal
  const handleVideoModalChange = (e) => {
    const { name, value, type, checked } = e.target;
    setVideoModal(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddVideo = async () => {
    if (!videoModal.url.trim()) {
      setError('Please enter a video URL');
      return;
    }
    
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
      
      if (currentAnnouncement) {
        const response = await fetch(
          `${API_BASE}/admin/announcement/${currentAnnouncement._id}/caption-videos`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: videoModal.url,
              title: videoModal.title,
              caption: videoModal.caption,
              position: videoModal.position,
              autoplay: videoModal.autoplay,
              muted: videoModal.muted
            })
          }
        );
        
        const data = await response.json();
        
        if (response.ok) {
          const { embedId, embedCode } = data;
          insertTextAtCursor(embedCode);
          setFormData(prev => ({
            ...prev,
            captionVideos: [...prev.captionVideos, data.video]
          }));
        } else {
          setError(data.message || 'Failed to add video');
          return;
        }
      } else {
        const embedId = 'temp_vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
        
        insertTextAtCursor(embedCode);
        setFormData(prev => ({
          ...prev,
          captionVideos: [...prev.captionVideos, newVideo]
        }));
      }
      
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
      setError('Failed to add video. Please try again.');
    } finally {
      setUploadingVideo(false);
    }
  };

  // Remove media from content
  const removeImageFromContent = (imageId) => {
    const placeholder = `[IMAGE:${imageId}]`;
    const newCaption = formData.caption.replace(new RegExp(escapeRegExp(placeholder), 'g'), '');
    const updatedImages = cleanupCaptionImages(newCaption, formData.captionImages);
    
    setFormData(prev => ({
      ...prev,
      caption: newCaption,
      captionImages: updatedImages
    }));
  };

  const removeVideoFromContent = (embedId) => {
    const placeholder = `[VIDEO:${embedId}]`;
    const newCaption = formData.caption.replace(new RegExp(escapeRegExp(placeholder), 'g'), '');
    const updatedVideos = cleanupCaptionVideos(newCaption, formData.captionVideos);
    
    setFormData(prev => ({
      ...prev,
      caption: newCaption,
      captionVideos: updatedVideos
    }));
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const insertMarkdownSyntax = (syntax) => {
    const textarea = document.getElementById('caption');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.caption;
    const selectedText = text.substring(start, end);
    
    let newText = '';
    let cursorPos = start;

    switch(syntax) {
      case 'bold':
        newText = text.substring(0, start) + `**${selectedText || 'bold text'}**` + text.substring(end);
        cursorPos = start + 2;
        break;
      case 'italic':
        newText = text.substring(0, start) + `*${selectedText || 'italic text'}*` + text.substring(end);
        cursorPos = start + 1;
        break;
      case 'heading':
        newText = text.substring(0, start) + `## ${selectedText || 'Heading'}` + text.substring(end);
        cursorPos = start + 3;
        break;
      case 'list':
        newText = text.substring(0, start) + `- ${selectedText || 'List item'}` + text.substring(end);
        cursorPos = start + 2;
        break;
      case 'numberedList':
        newText = text.substring(0, start) + `1. ${selectedText || 'List item'}` + text.substring(end);
        cursorPos = start + 3;
        break;
      case 'link':
        newText = text.substring(0, start) + `[${selectedText || 'link text'}](url)` + text.substring(end);
        cursorPos = start + 1;
        break;
      case 'code':
        newText = text.substring(0, start) + `\`${selectedText || 'code'}\`` + text.substring(end);
        cursorPos = start + 1;
        break;
      case 'table':
        newText = text.substring(0, start) + `\n| Column 1 | Column 2 |\n|----------|----------|\n| Data 1   | Data 2   |\n` + text.substring(end);
        cursorPos = start + 1;
        break;
      case 'image':
        setImageModal(prev => ({ ...prev, isOpen: true }));
        return;
      case 'video':
        setVideoModal(prev => ({ ...prev, isOpen: true }));
        return;
      default:
        newText = text;
    }

    setFormData(prev => ({
      ...prev,
      caption: newText
    }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const insertColorSpan = () => {
    const textarea = document.getElementById('caption');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.caption;
    const selectedText = text.substring(start, end);
    
    const colorInput = prompt('Enter color (hex code like #FF5733 or color name):', '#FF5733');
    if (!colorInput) return;

    const newText = text.substring(0, start) + 
      `<span style="color: ${colorInput}">${selectedText || 'colored text'}</span>` + 
      text.substring(end);

    setFormData(prev => ({
      ...prev,
      caption: newText
    }));

    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  const insertBackgroundColor = () => {
    const textarea = document.getElementById('caption');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.caption;
    const selectedText = text.substring(start, end);
    
    const colorInput = prompt('Enter background color (hex code like #FFEB3B):', '#FFEB3B');
    if (!colorInput) return;

    const newText = text.substring(0, start) + 
      `<span style="background-color: ${colorInput}">${selectedText || 'highlighted text'}</span>` + 
      text.substring(end);

    setFormData(prev => ({
      ...prev,
      caption: newText
    }));

    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formDataToSend = new FormData();
    formDataToSend.append('title', formData.title);
    formDataToSend.append('titleColor', formData.titleColor);
    formDataToSend.append('caption', formData.caption);
    formDataToSend.append('captionFormat', formData.captionFormat);
    
    // Clean up media arrays
    const cleanedImages = cleanupCaptionImages(formData.caption, formData.captionImages);
    const cleanedVideos = cleanupCaptionVideos(formData.caption, formData.captionVideos);
    
    formDataToSend.append('captionImages', JSON.stringify(cleanedImages));
    formDataToSend.append('captionVideos', JSON.stringify(cleanedVideos));
    
    formDataToSend.append('linkUrl', formData.linkUrl);
    formDataToSend.append('linkName', formData.linkName);
    formDataToSend.append('linkOpenInNewTab', formData.linkOpenInNewTab);
    formDataToSend.append('priority', formData.priority);
    
    if (editMode) {
      formDataToSend.append('isActive', formData.isActive);
      formDataToSend.append('removeImage', formData.removeImage);
      formDataToSend.append('removeDocument', formData.removeDocument);
      formDataToSend.append('removeExpiry', formData.removeExpiry);
    }

    if (formData.expiryType !== 'none' && !formData.removeExpiry) {
      formDataToSend.append('expiryType', formData.expiryType);
      if (formData.expiryType === 'duration' && formData.expiryValue) {
        formDataToSend.append('expiryValue', formData.expiryValue);
      } else if (formData.expiryType === 'custom' && formData.expiresAt) {
        const localDate = new Date(formData.expiresAt);
        formDataToSend.append('expiresAt', localDate.toISOString());
      }
    }
    
    if (formData.image) {
      formDataToSend.append('image', formData.image);
    }
    
    if (formData.document) {
      formDataToSend.append('document', formData.document);
    }

    try {
      setLoading(true);
      setError(null);
      
      const url = editMode 
        ? `${API_BASE}/admin/announcement/${currentAnnouncement._id}`
        : `${API_BASE}/admin/announcement`;
      
      const method = editMode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(data.message);
        fetchAnnouncements();
        
        setTimeout(() => {
          setSuccessMessage('');
          closeModal();
        }, 3000);
      } else {
        setError(data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (announcement) => {
    setCurrentAnnouncement(announcement);
  
    let expiryType = 'none';
    let expiryValue = '';
    let expiresAt = '';
  
    if (announcement.expiresAt) {
      expiryType = 'custom';
      const date = new Date(announcement.expiresAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      expiresAt = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    setFormData({
      title: announcement.title,
      titleColor: announcement.titleColor || '#000000',
      caption: announcement.caption || '',
      captionFormat: announcement.captionFormat || 'markdown',
      captionImages: announcement.captionImages || [],
      captionVideos: announcement.captionVideos || [],
      linkUrl: announcement.link?.url || '',
      linkName: announcement.link?.name || 'Learn More',
      linkOpenInNewTab: announcement.link?.openInNewTab !== false,
      priority: announcement.priority || 0,
      isActive: announcement.isActive,
      image: null,
      document: null,
      removeImage: false,
      removeDocument: false,
      expiryType,
      expiryValue,
      expiresAt,
      removeExpiry: false
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleToggleActive = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/admin/announcement/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(data.message);
        fetchAnnouncements();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.error || 'Toggle failed');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Toggle failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/announcement/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(data.message);
        fetchAnnouncements();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Delete failed');
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL announcements? This action cannot be undone!')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/announcement`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(data.message);
        fetchAnnouncements();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.error || 'Delete all failed');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Delete all failed');
    }
  };

  const openCreateModal = () => {
    setFormData({
      title: '',
      titleColor: '#000000',
      caption: '',
      captionFormat: 'markdown',
      captionImages: [],
      captionVideos: [],
      linkUrl: '',
      linkName: 'Learn More',
      linkOpenInNewTab: true,
      priority: 0,
      isActive: true,
      image: null,
      document: null,
      removeImage: false,
      removeDocument: false,
      expiryType: 'none',
      expiryValue: '',
      expiresAt: '',
      removeExpiry: false
    });
    setEditMode(false);
    setCurrentAnnouncement(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditMode(false);
    setCurrentAnnouncement(null);
    setShowMarkdownHelper(false);
    setImageModal({
      isOpen: false,
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
    setError(null);
  };

  const formatExpiryDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Caption Images Section Component
  const CaptionImagesSection = ({ captionImages, caption }) => {
    const activeImages = generateImagePreview(captionImages, caption);
    
    if (!activeImages || activeImages.length === 0) {
      return null;
    }
    
    return (
      <div className="annc-admin-form-field-group">
        <label>Caption Images ({activeImages.length})</label>
        <div className="annc-admin-content-images-list">
          {activeImages.map((image, index) => (
            <div key={image.imageId || index} className="annc-admin-content-image-item">
              <img 
                src={image.url} 
                alt={image.alt} 
                className="annc-admin-content-image-thumb"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/50x50?text=Error';
                }}
              />
              <div className="annc-admin-content-image-info">
                <span className="annc-admin-image-id">[IMAGE:{image.imageId}]</span>
                <span className="annc-admin-image-position">{image.position}</span>
                {image.caption && <span className="annc-admin-image-caption">{image.caption}</span>}
              </div>
              <button
                type="button"
                className="annc-admin-btn-icon annc-admin-btn-delete-item"
                onClick={() => removeImageFromContent(image.imageId)}
                title="Remove this image from content"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="annc-admin-helper-text">
          Only images referenced in your caption are shown above. 
          Remove the [IMAGE:id] placeholder from your caption to remove an image.
        </div>
      </div>
    );
  };

  // Caption Videos Section Component
  const CaptionVideosSection = ({ captionVideos, caption }) => {
    const activeVideos = generateVideoPreview(captionVideos, caption);
    
    if (!activeVideos || activeVideos.length === 0) {
      return null;
    }
    
    return (
      <div className="annc-admin-form-field-group">
        <label>Caption Videos ({activeVideos.length})</label>
        <div className="annc-admin-content-videos-list">
          {activeVideos.map((video, index) => (
            <div key={video.embedId || index} className="annc-admin-content-video-item">
              <div className="annc-admin-content-video-thumb">
                {video.platform === 'youtube' && (
                  <img
                    src={`https://img.youtube.com/vi/${video.videoId}/default.jpg`}
                    alt={video.title || 'Video thumbnail'}
                    className="annc-admin-content-video-thumb-img"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/50x50?text=Video';
                    }}
                  />
                )}
                {video.platform === 'vimeo' && (
                  <div className="annc-admin-video-placeholder">Vimeo</div>
                )}
                {video.platform === 'dailymotion' && (
                  <img
                    src={`https://www.dailymotion.com/thumbnail/video/${video.videoId}`}
                    alt={video.title || 'Video thumbnail'}
                    className="annc-admin-content-video-thumb-img"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/50x50?text=Video';
                    }}
                  />
                )}
              </div>
              <div className="annc-admin-content-video-info">
                <span className="annc-admin-video-id">[VIDEO:{video.embedId}]</span>
                <span className="annc-admin-video-position">{video.position}</span>
                {video.title && <span className="annc-admin-video-title">{video.title}</span>}
                {video.caption && <span className="annc-admin-video-caption">{video.caption}</span>}
                <span className="annc-admin-video-options">
                  {video.autoplay ? 'Autoplay: On' : 'Autoplay: Off'}, {video.muted ? 'Muted: On' : 'Muted: Off'}
                </span>
              </div>
              <button
                type="button"
                className="annc-admin-btn-icon annc-admin-btn-delete-item"
                onClick={() => removeVideoFromContent(video.embedId)}
                title="Remove this video from content"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="annc-admin-helper-text">
          Only videos referenced in your caption are shown above. 
          Remove the [VIDEO:embedId] placeholder from your caption to remove a video.
        </div>
      </div>
    );
  };

  return (
    <div className="annc-admin-main-wrapper">
      <div className="annc-admin-top-header">
        <h1>Announcement Management</h1>
        <div className="annc-admin-header-actions">
          <button className="annc-admin-btn annc-admin-btn-danger" onClick={handleDeleteAll}>
            Delete All
          </button>
          <button className="annc-admin-btn annc-admin-btn-primary" onClick={openCreateModal}>
            <Plus size={20} /> Create Announcement
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="annc-admin-success-message">
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="annc-admin-error-message">
          {error}
          <button onClick={() => setError(null)} className="annc-admin-close-error">×</button>
        </div>
      )}

      {loading && <div className="annc-admin-loading-state">Loading...</div>}

      <div className="annc-admin-cards-grid">
        {announcements.map((announcement) => (
          <div key={announcement._id} className="annc-admin-single-card">
            <div className="annc-admin-card-top-section">
              <h3 style={{ color: announcement.titleColor }}>{announcement.title}</h3>
              <div className="annc-admin-status-badges-group">
                <span className={`annc-admin-status-badge ${announcement.isActive ? 'annc-admin-active' : 'annc-admin-inactive'}`}>
                  {announcement.isActive ? 'Active' : 'Inactive'}
                </span>
                {announcement.isExpired && (
                  <span className="annc-admin-status-badge annc-admin-expired">Expired</span>
                )}
              </div>
            </div>

            {announcement.caption && (
              <div className="annc-admin-card-caption">
                {announcement.captionFormat === 'markdown' ? (
                  <div dangerouslySetInnerHTML={{ __html: announcement.renderedCaption }} />
                ) : (
                  <p>{announcement.caption}</p>
                )}
              </div>
            )}

            <div className="annc-admin-card-metadata">
              <div className="annc-admin-meta-single-item">
                <strong>Priority:</strong> {announcement.priority}
              </div>
              <div className="annc-admin-meta-single-item">
                <strong>Format:</strong> {announcement.captionFormat}
              </div>
              {announcement.link?.url && (
                <div className="annc-admin-meta-single-item">
                  <strong>Link:</strong> 
                  <a href={announcement.link.url} target="_blank" rel="noopener noreferrer">
                    {announcement.link.name}
                  </a>
                </div>
              )}
              {announcement.expiresAt && (
                <div className="annc-admin-meta-single-item annc-admin-expiry-display">
                  <Calendar size={14} />
                  <strong>Expires:</strong> {formatExpiryDate(announcement.expiresAt)}
                </div>
              )}
            </div>

            <div className="annc-admin-card-attachments-list">
              {announcement.hasImage && (
                <div className="annc-admin-attachment-item-badge">
                  <ImageIcon size={16} /> {announcement.imageFilename}
                </div>
              )}
              {announcement.hasDocument && (
                <div className="annc-admin-attachment-item-badge">
                  <FileText size={16} /> {announcement.documentFilename}
                </div>
              )}
              {announcement.captionImagesCount > 0 && (
                <div className="annc-admin-attachment-item-badge">
                  <ImageIcon size={16} /> {announcement.captionImagesCount} inline image{announcement.captionImagesCount !== 1 ? 's' : ''}
                </div>
              )}
              {announcement.captionVideosCount > 0 && (
                <div className="annc-admin-attachment-item-badge">
                  <Video size={16} /> {announcement.captionVideosCount} embedded video{announcement.captionVideosCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            <div className="annc-admin-card-bottom-footer">
              <small>Created: {new Date(announcement.createdAt).toLocaleDateString()}</small>
            </div>

            <div className="annc-admin-card-action-buttons">
              <button 
                className="annc-admin-btn-icon annc-admin-btn-toggle-visibility" 
                onClick={() => handleToggleActive(announcement._id)}
                title={announcement.isActive ? 'Deactivate' : 'Activate'}
              >
                {announcement.isActive ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button 
                className="annc-admin-btn-icon annc-admin-btn-edit-item" 
                onClick={() => handleEdit(announcement)}
                title="Edit"
              >
                <Pencil size={18} />
              </button>
              <button 
                className="annc-admin-btn-icon annc-admin-btn-delete-item" 
                onClick={() => handleDelete(announcement._id)}
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {announcements.length === 0 && !loading && (
        <div className="annc-admin-empty-placeholder">
          <p>No announcements found. Create your first announcement!</p>
        </div>
      )}

      {/* Image Modal */}
      {imageModal.isOpen && (
      <div className="annc-admin-modal-backdrop annc-admin-modal-high-z" onClick={() => setImageModal(prev => ({ ...prev, isOpen: false }))}>
    <div className="annc-admin-modal-dialog" onClick={(e) => e.stopPropagation()}>
      {/* ... rest of modal */}
            <div className="annc-admin-modal-top-bar">
              <h3>Add Image to Caption</h3>
              <button 
                className="annc-admin-btn-close-modal"
                onClick={() => setImageModal(prev => ({ ...prev, isOpen: false }))}
              >
                <X size={24} />
              </button>
            </div>
            <div className="annc-admin-form-container">
          
              <div className="annc-admin-form-field-group">
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
              <div className="annc-admin-form-field-group">
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
              <div className="annc-admin-form-field-group">
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
              <div className="annc-admin-form-field-group">
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
                <div className="annc-admin-image-preview">
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
              <div className="annc-admin-form-actions-bar">
                <button
                  type="button"
                  className="annc-admin-btn annc-admin-btn-secondary"
                  onClick={() => setImageModal(prev => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="annc-admin-btn annc-admin-btn-primary"
                  onClick={handleAddImage}
                  disabled={uploadingImage || !imageModal.url.trim()}
                >
                  {uploadingImage ? 'Adding...' : 'Add Image'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {videoModal.isOpen && (
      <div className="annc-admin-modal-backdrop annc-admin-modal-high-z" onClick={() => setVideoModal(prev => ({ ...prev, isOpen: false }))}>
    <div className="annc-admin-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="annc-admin-modal-top-bar">
              <h3>Add Video to Caption</h3>
              <button 
                className="annc-admin-btn-close-modal"
                onClick={() => setVideoModal(prev => ({ ...prev, isOpen: false }))}
              >
                <X size={24} />
              </button>
            </div>
            <div className="annc-admin-form-container">
              <div className="annc-admin-form-field-group">
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
              <div className="annc-admin-form-field-group">
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
              <div className="annc-admin-form-field-group">
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
              <div className="annc-admin-form-field-group">
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
              <div className="annc-admin-form-field-group">
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
              <div className="annc-admin-form-field-group">
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
                <div className="annc-admin-video-preview">
                  <p>Preview:</p>
                  <div className="annc-admin-video-preview-wrapper">
                    {extractVideoInfo(videoModal.url).platform === 'youtube' && (
                      <img
                        src={`https://img.youtube.com/vi/${extractVideoInfo(videoModal.url).videoId}/default.jpg`}
                        alt="Video preview"
                        style={{ maxWidth: '100%', maxHeight: '200px' }}
                      />
                    )}
                    {extractVideoInfo(videoModal.url).platform === 'vimeo' && (
                      <div style={{ padding: '20px', background: '#f0f0f0', textAlign: 'center' }}>
                        Vimeo Video
                      </div>
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
              <div className="annc-admin-form-actions-bar">
                <button
                  type="button"
                  className="annc-admin-btn annc-admin-btn-secondary"
                  onClick={() => setVideoModal(prev => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="annc-admin-btn annc-admin-btn-primary"
                  onClick={handleAddVideo}
                  disabled={uploadingVideo || !videoModal.url.trim()}
                >
                  {uploadingVideo ? 'Adding...' : 'Add Video'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Create/Edit Modal */}
     {showModal && (
  <div className="annc-admin-modal-backdrop" onClick={closeModal}>
    <div className="annc-admin-modal-dialog annc-admin-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="annc-admin-modal-top-bar">
              <h2>{editMode ? 'Edit Announcement' : 'Create Announcement'}</h2>
              <button className="annc-admin-btn-close-modal" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>

            <div className="annc-admin-form-container">
              <form onSubmit={handleSubmit}>
              <div className="annc-admin-form-row">
                <div className="annc-admin-form-field-group annc-admin-flex-grow">
                  <label htmlFor="title">Title *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="annc-admin-form-field-group annc-admin-color-picker-group">
                  <label htmlFor="titleColor">
                    <Palette size={16} /> Title Color
                  </label>
                  <div className="annc-admin-color-input-wrapper">
                    <input
                      type="color"
                      id="titleColor"
                      name="titleColor"
                      value={formData.titleColor}
                      onChange={handleInputChange}
                      className="annc-admin-color-picker"
                    />
                    <input
                      type="text"
                      value={formData.titleColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, titleColor: e.target.value }))}
                      className="annc-admin-color-text-input"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              <div className="annc-admin-form-field-group">
                <div className="annc-admin-caption-header">
                  <label htmlFor="caption">Caption</label>
                  <div className="annc-admin-format-switch">
                    <label>
                      <input
                        type="radio"
                        name="captionFormat"
                        value="markdown"
                        checked={formData.captionFormat === 'markdown'}
                        onChange={handleInputChange}
                      />
                      Markdown
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="captionFormat"
                        value="plain"
                        checked={formData.captionFormat === 'plain'}
                        onChange={handleInputChange}
                      />
                      Plain Text
                    </label>
                  </div>
                </div>

                {formData.captionFormat === 'markdown' && (
                  <div className="annc-admin-markdown-toolbar">
                    <button type="button" onClick={() => insertMarkdownSyntax('bold')} title="Bold">
                      <Bold size={16} />
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('italic')} title="Italic">
                      <Italic size={16} />
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('heading')} title="Heading">
                      <Type size={16} />
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('list')} title="Bullet List">
                      <List size={16} />
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('numberedList')} title="Numbered List">
                      1.
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('link')} title="Link">
                      <LinkIcon size={16} />
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('code')} title="Code">
                      <Code size={16} />
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('table')} title="Table">
                      ⊞
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('image')} title="Insert Image" className="annc-admin-media-btn">
                      <ImageIcon size={16} />
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('video')} title="Insert Video" className="annc-admin-media-btn">
                      <Video size={16} />
                    </button>
                    <button type="button" onClick={insertColorSpan} title="Text Color" className="annc-admin-color-btn">
                      <Palette size={16} /> Color
                    </button>
                    <button type="button" onClick={insertBackgroundColor} title="Background Color" className="annc-admin-highlight-btn">
                      🎨 Highlight
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowMarkdownHelper(!showMarkdownHelper)} 
                      className="annc-admin-help-btn"
                    >
                      ?
                    </button>
                  </div>
                )}

                {showMarkdownHelper && formData.captionFormat === 'markdown' && (
                  <div className="annc-admin-markdown-helper">
                    <h4>Markdown & Styling Guide:</h4>
                    <ul>
                      <li><strong>Bold:</strong> **text** or __text__</li>
                      <li><strong>Italic:</strong> *text* or _text_</li>
                      <li><strong>Heading:</strong> # H1, ## H2, ### H3</li>
                      <li><strong>List:</strong> - item or 1. item</li>
                      <li><strong>Link:</strong> [text](url)</li>
                      <li><strong>Code:</strong> `code` or ```block```</li>
                      <li><strong>Image:</strong> Use image button to insert [IMAGE:id]</li>
                      <li><strong>Video:</strong> Use video button to insert [VIDEO:id]</li>
                      <li><strong>Color Text:</strong> &lt;span style="color: #FF5733"&gt;text&lt;/span&gt;</li>
                      <li><strong>Background:</strong> &lt;span style="background-color: #FFEB3B"&gt;text&lt;/span&gt;</li>
                      <li><strong>Multiple Styles:</strong> &lt;span style="color: #E74C3C; font-weight: bold; font-size: 18px"&gt;text&lt;/span&gt;</li>
                    </ul>
                  </div>
                )}

                <textarea
                  id="caption"
                  name="caption"
                  value={formData.caption}
                  onChange={handleInputChange}
                  rows="8"
                  placeholder={formData.captionFormat === 'markdown' 
                    ? 'Enter markdown text with inline HTML for colors...\nExample: This is **bold** and this is <span style="color: #FF5733">red text</span>\nUse the toolbar to insert images and videos.'
                    : 'Enter plain text...'
                  }
                />
              </div>

              {/* Caption Images Summary */}
              {formData.captionImages && formData.captionImages.length > 0 && (
                <CaptionImagesSection 
                  captionImages={formData.captionImages} 
                  caption={formData.caption} 
                />
              )}

              {/* Caption Videos Summary */}
              {formData.captionVideos && formData.captionVideos.length > 0 && (
                <CaptionVideosSection 
                  captionVideos={formData.captionVideos} 
                  caption={formData.caption} 
                />
              )}

              <div className="annc-admin-form-row">
                <div className="annc-admin-form-field-group annc-admin-flex-grow">
                  <label htmlFor="linkUrl">Link URL</label>
                  <input
                    type="url"
                    id="linkUrl"
                    name="linkUrl"
                    value={formData.linkUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="annc-admin-form-field-group">
                  <label htmlFor="linkName">Link Text</label>
                  <input
                    type="text"
                    id="linkName"
                    name="linkName"
                    value={formData.linkName}
                    onChange={handleInputChange}
                    placeholder="Learn More"
                  />
                </div>

                <div className="annc-admin-form-field-group annc-admin-checkbox-wrapper">
                  <label>
                    <input
                      type="checkbox"
                      name="linkOpenInNewTab"
                      checked={formData.linkOpenInNewTab}
                      onChange={handleInputChange}
                    />
                    Open in new tab
                  </label>
                </div>
              </div>

              <div className="annc-admin-form-field-group">
                <label htmlFor="priority">Priority</label>
                <input
                  type="number"
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                />
              </div>

              {editMode && (
                <div className="annc-admin-form-field-group annc-admin-checkbox-wrapper">
                  <label>
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                    />
                    Active
                  </label>
                </div>
              )}

              <div className="annc-admin-form-field-group">
                <label htmlFor="expiryType">Expiry Type</label>
                <select
                  id="expiryType"
                  name="expiryType"
                  value={formData.expiryType}
                  onChange={handleInputChange}
                >
                  <option value="none">No Expiry</option>
                  <option value="duration">Duration (Hours)</option>
                  <option value="custom">Custom Date</option>
                </select>
              </div>

              {formData.expiryType === 'duration' && (
                <div className="annc-admin-form-field-group">
                  <label htmlFor="expiryValue">
                    <Clock size={16} /> Duration (Hours)
                  </label>
                  <input
                    type="number"
                    id="expiryValue"
                    name="expiryValue"
                    value={formData.expiryValue}
                    onChange={handleInputChange}
                    placeholder="Enter hours"
                    min="1"
                  />
                </div>
              )}

              {formData.expiryType === 'custom' && (
                <div className="annc-admin-form-field-group">
                  <label htmlFor="expiresAt">
                    <Calendar size={16} /> Expiry Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    id="expiresAt"
                    name="expiresAt"
                    value={formData.expiresAt}
                    onChange={handleInputChange}
                  />
                </div>
              )}

              {editMode && currentAnnouncement?.expiresAt && (
                <div className="annc-admin-form-field-group annc-admin-checkbox-wrapper">
                  <label>
                    <input
                      type="checkbox"
                      name="removeExpiry"
                      checked={formData.removeExpiry}
                      onChange={handleInputChange}
                    />
                    Remove expiry date
                  </label>
                </div>
              )}

              <div className="annc-admin-form-field-group">
                <label htmlFor="image">Featured Image</label>
                <div className="annc-admin-file-upload-wrapper">
                  <input
                    type="file"
                    id="image"
                    name="image"
                    onChange={handleFileChange}
                    accept="image/*"
                  />
                  <Upload size={20} />
                </div>
                {editMode && currentAnnouncement?.hasImage && (
                  <label className="annc-admin-checkbox-label-inline">
                    <input
                      type="checkbox"
                      name="removeImage"
                      checked={formData.removeImage}
                      onChange={handleInputChange}
                    />
                    Remove existing featured image
                  </label>
                )}
              </div>

              <div className="annc-admin-form-field-group">
                <label htmlFor="document">Document</label>
                <div className="annc-admin-file-upload-wrapper">
                  <input
                    type="file"
                    id="document"
                    name="document"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt"
                  />
                  <Upload size={20} />
                </div>
                {editMode && currentAnnouncement?.hasDocument && (
                  <label className="annc-admin-checkbox-label-inline">
                    <input
                      type="checkbox"
                      name="removeDocument"
                      checked={formData.removeDocument}
                      onChange={handleInputChange}
                    />
                    Remove existing document
                  </label>
                )}
              </div>

              <div className="annc-admin-form-actions-bar">
                <button
                  type="button"
                  className="annc-admin-btn annc-admin-btn-secondary"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="annc-admin-btn annc-admin-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (editMode ? 'Update Announcement' : 'Create Announcement')}
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementAdmin;