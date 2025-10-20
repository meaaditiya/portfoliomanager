import React, { useState, useEffect } from 'react';
import { X, Upload, Eye, EyeOff, Pencil, Trash2, Plus, FileText, Image, Calendar, Clock } from 'lucide-react';
import './Announcement.css';

const AnnouncementAdmin = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    caption: '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formDataToSend = new FormData();
    formDataToSend.append('title', formData.title);
    formDataToSend.append('caption', formData.caption);
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
        formDataToSend.append('expiresAt', formData.expiresAt);
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
      expiresAt = new Date(announcement.expiresAt).toISOString().slice(0, 16);
    }
    
    setFormData({
      title: announcement.title,
      caption: announcement.caption || '',
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
      caption: '',
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
    <div className="announcement-admin">
      <div className="admin-header">
        <h1>Announcement Management</h1>
        <div className="header-actions">
          <button className="btn btn-danger" onClick={handleDeleteAll}>
            Delete All
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={20} /> Create Announcement
          </button>
        </div>
      </div>

      {loading && <div className="loading">Loading...</div>}

      <div className="announcements-grid">
        {announcements.map((announcement) => (
          <div key={announcement._id} className="announcement-card">
            <div className="card-header">
              <h3>{announcement.title}</h3>
              <div className="status-badges">
                <span className={`status-badge ${announcement.isActive ? 'active' : 'inactive'}`}>
                  {announcement.isActive ? 'Active' : 'Inactive'}
                </span>
                {announcement.isExpired && (
                  <span className="status-badge expired">Expired</span>
                )}
              </div>
            </div>

            {announcement.caption && (
              <p className="caption">{announcement.caption}</p>
            )}

            <div className="card-meta">
              <div className="meta-item">
                <strong>Priority:</strong> {announcement.priority}
              </div>
              {announcement.link && (
                <div className="meta-item">
                  <strong>Link:</strong> 
                  <a href={announcement.link} target="_blank" rel="noopener noreferrer">
                    View
                  </a>
                </div>
              )}
              {announcement.expiresAt && (
                <div className="meta-item expiry-info">
                  <Calendar size={14} />
                  <strong>Expires:</strong> {formatExpiryDate(announcement.expiresAt)}
                </div>
              )}
            </div>

            <div className="card-attachments">
              {announcement.hasImage && (
                <div className="attachment-badge">
                  <Image size={16} /> {announcement.imageFilename}
                </div>
              )}
              {announcement.hasDocument && (
                <div className="attachment-badge">
                  <FileText size={16} /> {announcement.documentFilename}
                </div>
              )}
            </div>

            <div className="card-footer">
              <small>Created: {new Date(announcement.createdAt).toLocaleDateString()}</small>
            </div>

            <div className="card-actions">
              <button 
                className="btn-icon btn-toggle" 
                onClick={() => handleToggleActive(announcement._id)}
                title={announcement.isActive ? 'Deactivate' : 'Activate'}
              >
                {announcement.isActive ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button 
                className="btn-icon btn-edit" 
                onClick={() => handleEdit(announcement)}
                title="Edit"
              >
                <Pencil size={18} />
              </button>
              <button 
                className="btn-icon btn-delete" 
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
        <div className="empty-state">
          <p>No announcements found. Create your first announcement!</p>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Announcement' : 'Create Announcement'}</h2>
              <button className="btn-close" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>

            <div className="announcement-form">
              <div className="form-group">
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

              <div className="form-group">
                <label htmlFor="caption">Caption</label>
                <textarea
                  id="caption"
                  name="caption"
                  value={formData.caption}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label htmlFor="link">Link</label>
                <input
                  type="url"
                  id="link"
                  name="link"
                  value={formData.link}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
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
                <div className="form-group checkbox-group">
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

              <div className="form-group">
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
                <div className="form-group">
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
                <div className="form-group">
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
                <div className="form-group checkbox-group">
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

              <div className="form-group">
                <label htmlFor="image">Image</label>
                <div className="file-input-wrapper">
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
                  <label className="checkbox-label">
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

              <div className="form-group">
                <label htmlFor="document">Document</label>
                <div className="file-input-wrapper">
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
                  <label className="checkbox-label">
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

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
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