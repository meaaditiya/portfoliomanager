import React, { useState, useEffect } from 'react';
import { X, Upload, Eye, EyeOff, Pencil, Trash2, Plus, FileText, Image, Calendar, Clock, Palette, Type, Bold, Italic, List, Code } from 'lucide-react';
import './Announcement.css';

const AnnouncementAdmin = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMarkdownHelper, setShowMarkdownHelper] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    titleColor: '#000000',
    caption: '',
    captionFormat: 'markdown',
    link: '',
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

  const API_BASE = 'https://connectwithaaditiyamg.onrender.com/api';
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
      alert('Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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
    formDataToSend.append('link', formData.link);
    formDataToSend.append('priority', formData.priority);
    
    if (editMode) {
      formDataToSend.append('isActive', formData.isActive);
      formDataToSend.append('removeImage', formData.removeImage);
      formDataToSend.append('removeDocument', formData.removeDocument);
      formDataToSend.append('removeExpiry', formData.removeExpiry);
    }

    // Handle expiry fields
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
        alert(data.message);
        fetchAnnouncements();
        closeModal();
      } else {
        alert(data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Operation failed');
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
      link: announcement.link || '',
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
        alert(data.message);
        fetchAnnouncements();
      } else {
        alert(data.error || 'Toggle failed');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Toggle failed');
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
        alert(data.message);
        fetchAnnouncements();
      } else {
        alert(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Delete failed');
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
        alert(data.message);
        fetchAnnouncements();
      } else {
        alert(data.error || 'Delete all failed');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Delete all failed');
    }
  };

  const openCreateModal = () => {
    setFormData({
      title: '',
      titleColor: '#000000',
      caption: '',
      captionFormat: 'markdown',
      link: '',
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
              {announcement.link && (
                <div className="annc-admin-meta-single-item">
                  <strong>Link:</strong> 
                  <a href={announcement.link} target="_blank" rel="noopener noreferrer">
                    View
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
                  <Image size={16} /> {announcement.imageFilename}
                </div>
              )}
              {announcement.hasDocument && (
                <div className="annc-admin-attachment-item-badge">
                  <FileText size={16} /> {announcement.documentFilename}
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
                      🔗
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('code')} title="Code">
                      <Code size={16} />
                    </button>
                    <button type="button" onClick={() => insertMarkdownSyntax('table')} title="Table">
                      ⊞
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
                    ? 'Enter markdown text with inline HTML for colors...\nExample: This is **bold** and this is <span style="color: #FF5733">red text</span>'
                    : 'Enter plain text...'
                  }
                />
              </div>

              <div className="annc-admin-form-field-group">
                <label htmlFor="link">Link</label>
                <input
                  type="url"
                  id="link"
                  name="link"
                  value={formData.link}
                  onChange={handleInputChange}
                  placeholder="https://example.com"
                />
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
                <label htmlFor="image">Image</label>
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
                    Remove existing image
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
                <button type="button" className="annc-admin-btn annc-admin-btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="button" className="annc-admin-btn annc-admin-btn-primary" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Saving...' : (editMode ? 'Update' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementAdmin;