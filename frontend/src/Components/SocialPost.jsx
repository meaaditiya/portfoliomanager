import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Search, Filter, X, Save } from 'lucide-react';
import './SocialPost.css'
const SocialMediaAdmin = () => {
  const [embeds, setEmbeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEmbed, setEditingEmbed] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    platform: 'twitter',
    embedUrl: '',
    embedCode: '',
    description: '',
    isActive: true
  });

  const API_BASE_URL = 'https://aadibgmg.onrender.com';

  // Get auth token from localStorage or context
  const getAuthToken = () => {
    return localStorage.getItem('token') || '';
  };

  const apiHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
  };

  // Fetch embeds from API
  const fetchEmbeds = async (page = 1, platform = '') => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (platform) params.append('platform', platform);

      const response = await fetch(`${API_BASE_URL}/api/admin/social-embeds?${params}`, {
        headers: apiHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setEmbeds(data.embeds);
      setTotalPages(data.pagination.pages);
      setCurrentPage(data.pagination.page);
    } catch (error) {
      console.error('Error fetching embeds:', error);
      setError('Failed to fetch social media embeds. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Create new embed
  const createEmbed = async (data) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/social-embeds`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create embed');
      }

      const result = await response.json();
      setSuccess('Social media embed created successfully!');
      return { success: true, data: result };
    } catch (error) {
      console.error('Error creating embed:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  };

  // Update embed
  const updateEmbed = async (id, data) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/social-embeds/${id}`, {
        method: 'PUT',
        headers: apiHeaders,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update embed');
      }

      const result = await response.json();
      setSuccess('Social media embed updated successfully!');
      return { success: true, data: result };
    } catch (error) {
      console.error('Error updating embed:', error);
      setError(error.message);
      return { success: false, error: error.message };
    }
  };

  // Delete embed
  const deleteEmbed = async (id) => {
    if (!window.confirm('Are you sure you want to delete this embed?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/social-embeds/${id}`, {
        method: 'DELETE',
        headers: apiHeaders
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete embed');
      }

      setEmbeds(prev => prev.filter(embed => embed._id !== id));
      setSuccess('Social media embed deleted successfully!');
    } catch (error) {
      console.error('Error deleting embed:', error);
      setError(error.message);
    }
  };

  // Toggle embed active status
  const toggleEmbedStatus = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/social-embeds/${id}/toggle`, {
        method: 'PATCH',
        headers: apiHeaders
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to toggle embed status');
      }

      const result = await response.json();
      setEmbeds(prev => prev.map(embed => 
        embed._id === id ? { ...embed, isActive: result.isActive } : embed
      ));
      setSuccess(result.message);
    } catch (error) {
      console.error('Error toggling embed status:', error);
      setError(error.message);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    let result;
    if (editingEmbed) {
      result = await updateEmbed(editingEmbed._id, formData);
    } else {
      result = await createEmbed(formData);
    }

    if (result.success) {
      setShowModal(false);
      setEditingEmbed(null);
      setFormData({
        title: '',
        platform: 'twitter',
        embedUrl: '',
        embedCode: '',
        description: '',
        isActive: true
      });
      fetchEmbeds(currentPage, filterPlatform);
    }
  };

  // Open modal for editing
  const openEditModal = (embed) => {
    setEditingEmbed(embed);
    setFormData({
      title: embed.title,
      platform: embed.platform,
      embedUrl: embed.embedUrl,
      embedCode: embed.embedCode,
      description: embed.description || '',
      isActive: embed.isActive
    });
    setShowModal(true);
  };

  // Open modal for creating
  const openCreateModal = () => {
    setEditingEmbed(null);
    setFormData({
      title: '',
      platform: 'twitter',
      embedUrl: '',
      embedCode: '',
      description: '',
      isActive: true
    });
    setShowModal(true);
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Initial load
  useEffect(() => {
    fetchEmbeds(1, filterPlatform);
  }, [filterPlatform]);

 
  return (
    <>
      
      <div className="tyagi12-container">
        <div className="tyagi12-max-width">
          {/* Header */}
          <div className="tyagi12-header">
            <h1 className="tyagi12-header-title">Social Media Admin Dashboard</h1>
            <p className="tyagi12-header-subtitle">Manage social media embeds for your website</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="tyagi12-alert-error">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          {success && (
            <div className="tyagi12-alert-success">
              <strong>Success:</strong> {success}
            </div>
          )}

          {/* Controls */}
          <div className="tyagi12-controls-container">
            <div className="tyagi12-controls-flex">
              <div className="tyagi12-controls-left">
                <div className="tyagi12-search-container">
                  <Search className="tyagi12-search-icon" />
                  <input
                    type="text"
                    placeholder="Search embeds..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="tyagi12-search-input"
                  />
                </div>
                
                <div className="tyagi12-filter-container">
                  <Filter className="tyagi12-filter-icon" />
                  <select
                    value={filterPlatform}
                    onChange={(e) => setFilterPlatform(e.target.value)}
                    className="tyagi12-filter-select"
                  >
                    <option value="">All Platforms</option>
                    <option value="twitter">Twitter</option>
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                </div>
              </div>
              
              <button
                onClick={openCreateModal}
                className="tyagi12-add-button"
              >
                <Plus className="tyagi12-action-icon" />
                Add New Embed
              </button>
            </div>
          </div>

          {/* Embeds Table */}
          <div className="tyagi12-table-container">
            {loading ? (
              <div className="tyagi12-loading-container">
                <div className="tyagi12-spinner"></div>
                <span className="tyagi12-loading-text">Loading embeds...</span>
              </div>
            ) : embeds.length === 0 ? (
              <div className="tyagi12-empty-state">
                <p className="tyagi12-empty-text">No social media embeds found</p>
                <button
                  onClick={openCreateModal}
                  className="tyagi12-empty-button"
                >
                  Create Your First Embed
                </button>
              </div>
            ) : (
              <>
                <div className="tyagi12-table-wrapper">
                  <table className="tyagi12-table">
                    <thead className="tyagi12-table-header">
                      <tr>
                        <th className="tyagi12-table-th">
                          Title & Platform
                        </th>
                        <th className="tyagi12-table-th">
                          URL
                        </th>
                        <th className="tyagi12-table-th">
                          Status
                        </th>
                        <th className="tyagi12-table-th">
                          Created
                        </th>
                        <th className="tyagi12-table-th">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tyagi12-table-body">
                      {embeds.map((embed) => (
                        <tr key={embed._id} className="tyagi12-table-row">
                          <td className="tyagi12-table-td">
                            <div className="tyagi12-title-container">
                              <div className="tyagi12-title-text">
                                {embed.title}
                              </div>
                              <div className="tyagi12-platform-text">
                                <span className={`tyagi12-platform-badge ${
                                  embed.platform === 'twitter' ? 'tyagi12-platform-twitter' :
                                  embed.platform === 'facebook' ? 'tyagi12-platform-facebook' :
                                  'tyagi12-platform-linkedin'
                                }`}>
                                  {embed.platform}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="tyagi12-table-td">
                            <a 
                              href={embed.embedUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="tyagi12-url-link"
                            >
                              {embed.embedUrl}
                            </a>
                          </td>
                          <td className="tyagi12-table-td">
                            <button
                              onClick={() => toggleEmbedStatus(embed._id)}
                              className={`tyagi12-status-button ${
                                embed.isActive 
                                  ? 'tyagi12-status-active' 
                                  : 'tyagi12-status-inactive'
                              }`}
                            >
                              {embed.isActive ? (
                                <>
                                  <Eye className="tyagi12-status-icon" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <EyeOff className="tyagi12-status-icon" />
                                  Inactive
                                </>
                              )}
                            </button>
                          </td>
                          <td className="tyagi12-table-td">
                            <span className="tyagi12-date-text">
                              {new Date(embed.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="tyagi12-table-td">
                            <div className="tyagi12-actions-container">
                              <button
                                onClick={() => openEditModal(embed)}
                                className="tyagi12-action-button tyagi12-edit-button"
                                title="Edit"
                              >
                                <Edit2 className="tyagi12-action-icon" />
                              </button>
                              <button
                                onClick={() => deleteEmbed(embed._id)}
                                className="tyagi12-action-button tyagi12-delete-button"
                                title="Delete"
                              >
                                <Trash2 className="tyagi12-action-icon" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="tyagi12-pagination-container">
                    <div className="tyagi12-pagination-flex">
                      <div className="tyagi12-pagination-info">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="tyagi12-pagination-buttons">
                        <button
                          onClick={() => fetchEmbeds(currentPage - 1, filterPlatform)}
                          disabled={currentPage === 1}
                          className="tyagi12-pagination-button"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => fetchEmbeds(currentPage + 1, filterPlatform)}
                          disabled={currentPage === totalPages}
                          className="tyagi12-pagination-button"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Modal */}
          {showModal && (
            <div className="tyagi12-modal-overlay">
              <div className="tyagi12-modal-container">
                <div className="tyagi12-modal-header">
                  <h2 className="tyagi12-modal-title">
                    {editingEmbed ? 'Edit Social Media Embed' : 'Add New Social Media Embed'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="tyagi12-modal-close"
                  >
                    <X className="tyagi12-modal-close-icon" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="tyagi12-form-container">
                  <div className="tyagi12-form-group">
                    <label className="tyagi12-form-label">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={200}
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="tyagi12-form-input"
                      placeholder="Enter embed title"
                    />
                  </div>

                  <div className="tyagi12-form-group">
                    <label className="tyagi12-form-label">
                      Platform *
                    </label>
                    <select
                      required
                      value={formData.platform}
                      onChange={(e) => setFormData({...formData, platform: e.target.value})}
                      className="tyagi12-form-select"
                    >
                      <option value="twitter">Twitter</option>
                      <option value="facebook">Facebook</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>

                  <div className="tyagi12-form-group">
                    <label className="tyagi12-form-label">
                      Embed URL *
                    </label>
                    <input
                      type="url"
                      required
                      value={formData.embedUrl}
                      onChange={(e) => setFormData({...formData, embedUrl: e.target.value})}
                      className="tyagi12-form-input"
                      placeholder="https://twitter.com/user/status/123456789"
                    />
                  </div>

                  <div className="tyagi12-form-group">
                    <label className="tyagi12-form-label">
                      Embed Code *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formData.embedCode}
                      onChange={(e) => setFormData({...formData, embedCode: e.target.value})}
                      className="tyagi12-form-textarea"
                      placeholder="<blockquote class='twitter-tweet'>...</blockquote>"
                    />
                    <p className="tyagi12-form-help">
                      Paste the embed code provided by the social platform
                    </p>
                  </div>

                  <div className="tyagi12-form-group">
                    <label className="tyagi12-form-label">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="tyagi12-form-textarea"
                      placeholder="Optional description for this embed"
                    />
                  </div>

                  <div className="tyagi12-checkbox-container">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                      className="tyagi12-checkbox-input"
                    />
                    <label htmlFor="isActive" className="tyagi12-checkbox-label">
                      Active (visible on website)
                    </label>
                  </div>

                  <div className="tyagi12-form-buttons">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="tyagi12-cancel-button"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="tyagi12-submit-button"
                    >
                      <Save className="tyagi12-submit-icon" />
                      {editingEmbed ? 'Update Embed' : 'Create Embed'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SocialMediaAdmin;