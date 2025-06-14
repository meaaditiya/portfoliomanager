import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Search, Filter, X, Save } from 'lucide-react';

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

  const API_BASE_URL = 'http://localhost:5000';

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

  const styles = `
    .tyagi12-container {
      min-height: 100vh;
      background-color: #f9fafb;
      padding: 2rem 1rem;
    }

    .tyagi12-max-width {
      max-width: 80rem;
      margin: 0 auto;
    }

    .tyagi12-header {
      background: linear-gradient(to right, #2563eb, #9333ea);
      color: white;
      padding: 2rem;
      border-radius: 0.5rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .tyagi12-header-title {
      font-size: 1.875rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .tyagi12-header-subtitle {
      color: #dbeafe;
    }

    .tyagi12-alert-error {
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .tyagi12-alert-success {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #16a34a;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .tyagi12-controls-container {
      background-color: white;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .tyagi12-controls-flex {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }

    @media (min-width: 768px) {
      .tyagi12-controls-flex {
        flex-direction: row;
      }
    }

    .tyagi12-controls-left {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 1;
    }

    @media (min-width: 768px) {
      .tyagi12-controls-left {
        flex-direction: row;
      }
    }

    .tyagi12-search-container {
      position: relative;
    }

    .tyagi12-search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      width: 1rem;
      height: 1rem;
    }

    .tyagi12-search-input {
      padding-left: 2.5rem;
      padding-right: 1rem;
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
    }

    .tyagi12-search-input:focus {
      outline: none;
      ring: 2px;
      ring-color: #3b82f6;
      border-color: transparent;
    }

    .tyagi12-filter-container {
      position: relative;
    }

    .tyagi12-filter-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      width: 1rem;
      height: 1rem;
    }

    .tyagi12-filter-select {
      padding-left: 2.5rem;
      padding-right: 2rem;
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      appearance: none;
      background-color: white;
    }

    .tyagi12-filter-select:focus {
      outline: none;
      ring: 2px;
      ring-color: #3b82f6;
      border-color: transparent;
    }

    .tyagi12-add-button {
      background-color: #2563eb;
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: background-color 0.2s;
      border: none;
      cursor: pointer;
    }

    .tyagi12-add-button:hover {
      background-color: #1d4ed8;
    }

    .tyagi12-table-container {
      background-color: white;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .tyagi12-loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 0;
    }

    .tyagi12-spinner {
      animation: spin 1s linear infinite;
      border-radius: 50%;
      height: 2rem;
      width: 2rem;
      border: 2px solid transparent;
      border-bottom: 2px solid #2563eb;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .tyagi12-loading-text {
      margin-left: 0.75rem;
      color: #6b7280;
    }

    .tyagi12-empty-state {
      text-align: center;
      padding: 3rem 0;
    }

    .tyagi12-empty-text {
      color: #6b7280;
      font-size: 1.125rem;
    }

    .tyagi12-empty-button {
      margin-top: 1rem;
      background-color: #2563eb;
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 500;
      transition: background-color 0.2s;
      border: none;
      cursor: pointer;
    }

    .tyagi12-empty-button:hover {
      background-color: #1d4ed8;
    }

    .tyagi12-table-wrapper {
      overflow-x: auto;
    }

    .tyagi12-table {
      width: 100%;
    }

    .tyagi12-table-header {
      background-color: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .tyagi12-table-th {
      padding: 1rem 1.5rem;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .tyagi12-table-body {
      background-color: white;
      divide-y: 1px solid #e5e7eb;
    }

    .tyagi12-table-row {
      background-color: white;
    }

    .tyagi12-table-row:hover {
      background-color: #f9fafb;
    }

    .tyagi12-table-td {
      padding: 1rem 1.5rem;
    }

    .tyagi12-title-container {
      display: block;
    }

    .tyagi12-title-text {
      font-size: 0.875rem;
      font-weight: 500;
      color: #111827;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 20rem;
    }

    .tyagi12-platform-text {
      font-size: 0.875rem;
      color: #6b7280;
      text-transform: capitalize;
    }

    .tyagi12-platform-badge {
      display: inline-flex;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 9999px;
    }

    .tyagi12-platform-twitter {
      background-color: #dbeafe;
      color: #1e40af;
    }

    .tyagi12-platform-facebook {
      background-color: #dbeafe;
      color: #1e40af;
    }

    .tyagi12-platform-linkedin {
      background-color: #dbeafe;
      color: #1e40af;
    }

    .tyagi12-url-link {
      color: #2563eb;
      font-size: 0.875rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 20rem;
      display: block;
      text-decoration: none;
    }

    .tyagi12-url-link:hover {
      color: #1e40af;
    }

    .tyagi12-status-button {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      border: none;
      cursor: pointer;
    }

    .tyagi12-status-active {
      background-color: #dcfce7;
      color: #16a34a;
    }

    .tyagi12-status-inactive {
      background-color: #fee2e2;
      color: #dc2626;
    }

    .tyagi12-status-icon {
      width: 0.75rem;
      height: 0.75rem;
      margin-right: 0.25rem;
    }

    .tyagi12-date-text {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .tyagi12-actions-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .tyagi12-action-button {
      padding: 0.25rem;
      border-radius: 0.25rem;
      transition: color 0.2s;
      border: none;
      background: none;
      cursor: pointer;
    }

    .tyagi12-edit-button {
      color: #2563eb;
    }

    .tyagi12-edit-button:hover {
      color: #1e40af;
    }

    .tyagi12-delete-button {
      color: #dc2626;
    }

    .tyagi12-delete-button:hover {
      color: #b91c1c;
    }

    .tyagi12-action-icon {
      width: 1rem;
      height: 1rem;
    }

    .tyagi12-pagination-container {
      background-color: #f9fafb;
      padding: 1rem 1.5rem;
      border-top: 1px solid #e5e7eb;
    }

    .tyagi12-pagination-flex {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .tyagi12-pagination-info {
      font-size: 0.875rem;
      color: #374151;
    }

    .tyagi12-pagination-buttons {
      display: flex;
      gap: 0.5rem;
    }

    .tyagi12-pagination-button {
      padding: 0.25rem 0.75rem;
      font-size: 0.875rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      background: white;
      cursor: pointer;
    }

    .tyagi12-pagination-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .tyagi12-pagination-button:hover:not(:disabled) {
      background-color: #f3f4f6;
    }

    .tyagi12-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      z-index: 50;
    }

    .tyagi12-modal-container {
      background-color: white;
      border-radius: 0.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-width: 42rem;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
    }

    .tyagi12-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .tyagi12-modal-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
    }

    .tyagi12-modal-close {
      color: #9ca3af;
      transition: color 0.2s;
      border: none;
      background: none;
      cursor: pointer;
    }

    .tyagi12-modal-close:hover {
      color: #6b7280;
    }

    .tyagi12-modal-close-icon {
      width: 1.5rem;
      height: 1.5rem;
    }

    .tyagi12-form-container {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .tyagi12-form-group {
      display: block;
    }

    .tyagi12-form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .tyagi12-form-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
    }

    .tyagi12-form-input:focus {
      outline: none;
      ring: 2px;
      ring-color: #3b82f6;
      border-color: transparent;
    }

    .tyagi12-form-select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
    }

    .tyagi12-form-select:focus {
      outline: none;
      ring: 2px;
      ring-color: #3b82f6;
      border-color: transparent;
    }

    .tyagi12-form-textarea {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      resize: vertical;
    }

    .tyagi12-form-textarea:focus {
      outline: none;
      ring: 2px;
      ring-color: #3b82f6;
      border-color: transparent;
    }

    .tyagi12-form-help {
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: #6b7280;
    }

    .tyagi12-checkbox-container {
      display: flex;
      align-items: center;
    }

    .tyagi12-checkbox-input {
      width: 1rem;
      height: 1rem;
      color: #2563eb;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
    }

    .tyagi12-checkbox-input:focus {
      ring: 2px;
      ring-color: #3b82f6;
    }

    .tyagi12-checkbox-label {
      margin-left: 0.5rem;
      font-size: 0.875rem;
      color: #374151;
    }

    .tyagi12-form-buttons {
      display: flex;
      gap: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
    }

    .tyagi12-cancel-button {
      flex: 1;
      padding: 0.5rem 1rem;
      color: #374151;
      background-color: #f3f4f6;
      border-radius: 0.5rem;
      font-weight: 500;
      transition: background-color 0.2s;
      border: none;
      cursor: pointer;
    }

    .tyagi12-cancel-button:hover {
      background-color: #e5e7eb;
    }

    .tyagi12-submit-button {
      flex: 1;
      padding: 0.5rem 1rem;
      background-color: #2563eb;
      color: white;
      border-radius: 0.5rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background-color 0.2s;
      border: none;
      cursor: pointer;
    }

    .tyagi12-submit-button:hover {
      background-color: #1d4ed8;
    }

    .tyagi12-submit-icon {
      width: 1rem;
      height: 1rem;
    }
  `;

  return (
    <>
      <style>{styles}</style>
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