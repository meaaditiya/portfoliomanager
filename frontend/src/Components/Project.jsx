import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Project.css';

const AdminProjectRequests = () => {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filePreviewUrls, setFilePreviewUrls] = useState({});

  // Fetch all project requests on mount
  useEffect(() => {
    fetchRequests();
  }, []);

  // Clean up preview URLs when component unmounts or selectedRequest changes
  useEffect(() => {
    return () => {
      Object.values(filePreviewUrls).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [selectedRequest]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get('https://connectwithaaditiyamg2.onrender.com/api/admin/project/requests', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setRequests(response.data.requests || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch project requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestDetails = async (id) => {
    setLoading(true);
    try {
      const response = await axios.get(`https://connectwithaaditiyamg2.onrender.com/api/admin/project/requests/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setSelectedRequest(response.data.request || null);
      
      // Generate preview URLs for images
      if (response.data.request?.files) {
        const newPreviewUrls = {};
        response.data.request.files.forEach((file, index) => {
          if (file.mimetype && file.mimetype.startsWith('image/')) {
            // For images, we'll fetch them separately to create preview URLs
            fetchFilePreview(id, index, file.mimetype).then(url => {
              setFilePreviewUrls(prev => ({
                ...prev,
                [`${id}_${index}`]: url
              }));
            });
          }
        });
      }
      
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch request details');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilePreview = async (requestId, fileIndex, mimetype) => {
    try {
      const response = await axios.get(
        `https://connectwithaaditiyamg2.onrender.com/api/admin/project/requests/${requestId}/files/${fileIndex}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          responseType: 'blob'
        }
      );
      
      return URL.createObjectURL(new Blob([response.data], { type: mimetype }));
    } catch (err) {
      console.error('Failed to fetch file preview:', err);
      return null;
    }
  };

  const handleAcknowledge = async (id) => {
    setActionLoading(true);
    try {
      const response = await axios.put(`https://connectwithaaditiyamg2.onrender.com/api/admin/project/requests/${id}/acknowledge`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setSuccess(response.data.message);
      setRequests(requests.map(req => req._id === id ? response.data.request : req));
      if (selectedRequest?._id === id) {
        setSelectedRequest(response.data.request);
      }
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to acknowledge request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRequest = async (id) => {
    if (!window.confirm('Are you sure you want to delete this request?')) {
      return;
    }
    
    setActionLoading(true);
    try {
      await axios.delete(`https://connectwithaaditiyamg2.onrender.com/api/admin/project/requests/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setSuccess('Request deleted successfully');
      setRequests(requests.filter(req => req._id !== id));
      if (selectedRequest?._id === id) {
        setSelectedRequest(null);
      }
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAllRequests = async () => {
    if (!window.confirm('Are you sure you want to delete ALL requests? This action cannot be undone.')) {
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await axios.delete('https://connectwithaaditiyamg2.onrender.com/api/admin/project/requests', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setSuccess(`${response.data.deletedCount} requests deleted successfully`);
      setRequests([]);
      setSelectedRequest(null);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete all requests');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadFile = async (requestId, fileIndex, fileName) => {
    try {
      const response = await axios.get(
        `https://connectwithaaditiyamg2.onrender.com/api/admin/project/requests/${requestId}/files/${fileIndex}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          responseType: 'blob'
        }
      );

      // Create blob link to download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download file');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimetype) => {
    if (mimetype.includes('pdf')) return '📄';
    if (mimetype.includes('word') || mimetype.includes('document')) return '📝';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return '📊';
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return '📈';
    if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('7z')) return '📦';
    if (mimetype.includes('text')) return '📋';
    if (mimetype.includes('json') || mimetype.includes('xml')) return '⚙️';
    return '📎';
  };

  const isImageFile = (mimetype) => {
    return mimetype && mimetype.startsWith('image/');
  };

  const renderFileItem = (file, index, requestId) => {
    const isImage = isImageFile(file.mimetype);
    const previewUrl = filePreviewUrls[`${requestId}_${index}`];

    return (
      <div key={index} className="proj-file-card">
        <div className="proj-file-preview-wrapper">
          {isImage ? (
            <div className="proj-image-preview-box">
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt={file.originalName}
                  className="proj-preview-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : (
                <div className="proj-loading-preview">Loading...</div>
              )}
              <div className="proj-image-fallback" style={{ display: 'none' }}>
                <span className="proj-file-icon">🖼️</span>
                <span className="proj-file-error">Preview not available</span>
              </div>
            </div>
          ) : (
            <div className="proj-file-icon-wrapper">
              <span className="proj-file-icon">{getFileIcon(file.mimetype)}</span>
            </div>
          )}
        </div>
        
        <div className="proj-file-info-section">
          <span className="proj-file-name" title={file.originalName}>
            {file.originalName}
          </span>
          <span className="proj-file-meta">
            {file.mimetype} • {formatFileSize(file.size)}
          </span>
          <span className="proj-file-timestamp">
            Uploaded: {new Date(file.uploadedAt).toLocaleString()}
          </span>
        </div>
        
        <div className="proj-file-actions-group">
          {isImage && previewUrl && (
            <button
              className="proj-preview-btn"
              onClick={() => window.open(previewUrl, '_blank')}
              title="Open in new tab"
            >
              👁️ View
            </button>
          )}
          <button
            className="proj-download-btn"
            onClick={() => handleDownloadFile(requestId, index, file.originalName)}
            title="Download file"
          >
            ⬇️ Download
          </button>
        </div>
      </div>
    );
  };

  const renderRequestDetails = () => (
    <div className="proj-modal-overlay">
      <div className="proj-modal-container">
        <div className="proj-modal-header">
          <h2>Project Request Details</h2>
          <button
            className="proj-close-btn"
            onClick={() => {
              setSelectedRequest(null);
              // Clean up preview URLs
              Object.values(filePreviewUrls).forEach(url => {
                if (url && url.startsWith('blob:')) {
                  URL.revokeObjectURL(url);
                }
              });
              setFilePreviewUrls({});
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="proj-modal-body">
          <div className="proj-details-grid">
            <div className="proj-detail-field">
              <strong>Name:</strong>
              <span>{selectedRequest?.name || 'N/A'}</span>
            </div>
            
            <div className="proj-detail-field">
              <strong>Email:</strong>
              <span>{selectedRequest?.email || 'N/A'}</span>
            </div>
            
            <div className="proj-detail-field">
              <strong>Project Type:</strong>
              <span>{selectedRequest?.projectType || 'N/A'}</span>
            </div>
            
            <div className="proj-detail-field">
              <strong>Budget:</strong>
              <span>{selectedRequest?.budget || 'Not specified'}</span>
            </div>
            
            <div className="proj-detail-field">
              <strong>Timeline:</strong>
              <span>{selectedRequest?.timeline || 'Not specified'}</span>
            </div>
            
            <div className="proj-detail-field">
              <strong>Status:</strong>
              <span className={`proj-status-badge ${selectedRequest?.status}`}>
                {selectedRequest?.status || 'N/A'}
              </span>
            </div>
            
            <div className="proj-detail-field proj-field-full">
              <strong>Description:</strong>
              <p>{selectedRequest?.description || 'N/A'}</p>
            </div>
            
            <div className="proj-detail-field proj-field-full">
              <strong>Features:</strong>
              <p>{selectedRequest?.features || 'Not specified'}</p>
            </div>
            
            <div className="proj-detail-field proj-field-full">
              <strong>Tech Preferences:</strong>
              <p>{selectedRequest?.techPreferences || 'Not specified'}</p>
            </div>
            
            <div className="proj-detail-field proj-field-full">
              <strong>Additional Info:</strong>
              <p>{selectedRequest?.additionalInfo || 'Not specified'}</p>
            </div>
            
            {/* Enhanced File Display Section */}
            {selectedRequest?.files && selectedRequest.files.length > 0 ? (
              <div className="proj-detail-field proj-field-full">
                <strong>Uploaded Files ({selectedRequest.files.length}):</strong>
                <div className="proj-files-list">
                  {selectedRequest.files.map((file, index) => 
                    renderFileItem(file, index, selectedRequest._id)
                  )}
                </div>
              </div>
            ) : (
              <div className="proj-detail-field proj-field-full">
                <strong>Uploaded Files:</strong>
                <p className="proj-no-files">No files uploaded with this request.</p>
              </div>
            )}
            
            <div className="proj-detail-field">
              <strong>Submitted At:</strong>
              <span>
                {selectedRequest?.createdAt ? new Date(selectedRequest.createdAt).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="proj-modal-footer">
          {selectedRequest?.status === 'pending' && (
            <button
              className="proj-action-btn proj-acknowledge-btn"
              onClick={() => handleAcknowledge(selectedRequest._id)}
              disabled={actionLoading}
            >
              {actionLoading ? 'Acknowledging...' : 'Acknowledge Request'}
            </button>
          )}
          <button
            className="proj-action-btn proj-delete-btn"
            onClick={() => handleDeleteRequest(selectedRequest._id)}
            disabled={actionLoading}
          >
            {actionLoading ? 'Deleting...' : 'Delete Request'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="proj-main-wrapper">
      <div className="proj-header-section">
        <div className="proj-header-actions">
          <button
            className="proj-refresh-btn"
            onClick={fetchRequests}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {requests.length > 0 && (
            <button
              className="proj-delete-all-btn"
              onClick={handleDeleteAllRequests}
              disabled={actionLoading}
            >
              {actionLoading ? 'Deleting All...' : 'Delete All'}
            </button>
          )}
        </div>
      </div>

      {success && (
        <div className="proj-notification proj-notification-success">
          {success}
        </div>
      )}

      {error && (
        <div className="proj-notification proj-notification-error">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="proj-loading-state">
          <div className="proj-spinner"></div>
          Loading project requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="proj-empty-state">
          No project requests found.
        </div>
      ) : (
        <div className="proj-table-wrapper">
          <table className="proj-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Project Type</th>
                <th>Files</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(request => (
                <tr key={request._id}>
                  <td>{request.name || 'N/A'}</td>
                  <td>{request.email || 'N/A'}</td>
                  <td>{request.projectType || 'N/A'}</td>
                  <td>{request.files?.length || 0}</td>
                  <td>
                    <span className={`proj-status-badge ${request.status}`}>
                      {request.status || 'N/A'}
                    </span>
                  </td>
                  <td>
                    {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td>
                    <button
                      className="proj-view-btn"
                      onClick={() => fetchRequestDetails(request._id)}
                    >
                      View 
                    </button>
                    <button
                      className="proj-table-delete-btn"
                      onClick={() => handleDeleteRequest(request._id)}
                      disabled={actionLoading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRequest && renderRequestDetails()}
    </div>
  );
};

export default AdminProjectRequests;