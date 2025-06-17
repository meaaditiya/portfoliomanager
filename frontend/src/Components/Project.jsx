import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCheckCircle, FaEye, FaSpinner } from 'react-icons/fa';
import './adminProjectRequests.css';

const AdminProjectRequests = () => {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch all project requests on mount
  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get('https://connectwithaaditiyamg.onrender.com/api/admin/project/requests', {
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
      const response = await axios.get(`https://connectwithaaditiyamg.onrender.com/api/admin/project/requests/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setSelectedRequest(response.data.request || null);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch request details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id) => {
    setActionLoading(true);
    try {
      const response = await axios.put(`https://connectwithaaditiyamg.onrender.com/api/admin/project/requests/${id}/acknowledge`, {}, {
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

  // Convert binary image data to base64 in the browser
  const toBase64 = (data) => {
    try {
      if (!data) return null;
      if (typeof data === 'string' && data.startsWith('data:image')) {
        return data;
      }
      const binary = new Uint8Array(data.data || data);
      let binaryString = '';
      for (let i = 0; i < binary.length; i++) {
        binaryString += String.fromCharCode(binary[i]);
      }
      return `data:image/jpeg;base64,${btoa(binaryString)}`;
    } catch (err) {
      console.error('Error converting image to base64:', err);
      return null;
    }
  };

  const renderRequestDetails = () => (
    <div className="pr-modal-overlay">
      <div className="pr-modal-content">
        <div className="pr-modal-header">
          <h3 className="pr-modal-title">Project Request Details</h3>
          <button
            className="pr-close-button"
            onClick={() => setSelectedRequest(null)}
          >
            ×
          </button>
        </div>
        <div className="pr-modal-body">
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Name</h4>
            <p className="pr-modal-text">{selectedRequest?.name || 'N/A'}</p>
          </div>
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Email</h4>
            <p className="pr-modal-text">{selectedRequest?.email || 'N/A'}</p>
          </div>
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Project Type</h4>
            <p className="pr-modal-text">{selectedRequest?.projectType || 'N/A'}</p>
          </div>
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Description</h4>
            <p className="pr-modal-text">{selectedRequest?.description || 'N/A'}</p>
          </div>
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Budget</h4>
            <p className="pr-modal-text">{selectedRequest?.budget || 'Not specified'}</p>
          </div>
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Timeline</h4>
            <p className="pr-modal-text">{selectedRequest?.timeline || 'Not specified'}</p>
          </div>
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Features</h4>
            <p className="pr-modal-text">{selectedRequest?.features || 'Not specified'}</p>
          </div>
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Tech Preferences</h4>
            <p className="pr-modal-text">{selectedRequest?.techPreferences || 'Not specified'}</p>
          </div>
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Additional Info</h4>
            <p className="pr-modal-text">{selectedRequest?.additionalInfo || 'Not specified'}</p>
          </div>
          {selectedRequest?.image && (
            <div className="pr-modal-section">
              <h4 className="pr-modal-label">Attached Image</h4>
              {toBase64(selectedRequest.image) ? (
                <img
                  src={toBase64(selectedRequest.image)}
                  alt="Project attachment"
                  className="pr-modal-image"
                />
              ) : (
                <p className="pr-error-text">Unable to display image</p>
              )}
            </div>
          )}
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Status</h4>
            <p className={`pr-modal-text ${selectedRequest?.status === 'acknowledged' ? 'pr-status-acknowledged' : 'pr-status-pending'}`}>
              {selectedRequest?.status || 'N/A'}
            </p>
          </div>
          <div className="pr-modal-section">
            <h4 className="pr-modal-label">Submitted At</h4>
            <p className="pr-modal-text">
              {selectedRequest?.createdAt ? new Date(selectedRequest.createdAt).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
        {selectedRequest?.status === 'pending' && (
          <button
            className="pr-acknowledge-button"
            onClick={() => handleAcknowledge(selectedRequest._id)}
            disabled={actionLoading}
          >
            <FaCheckCircle className="pr-button-icon" />
            {actionLoading ? 'Acknowledging...' : 'Acknowledge Request'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <section className="pr-main-container">
      <h2 className="pr-section-title">Project Requests</h2>
      <div className="pr-card">
        {success && (
          <div className="pr-notification pr-notification-success">
            {success}
          </div>
        )}
        {error && (
          <div className="pr-notification pr-notification-error">
            {error}
          </div>
        )}
        {loading ? (
          <div className="pr-loading-container">
            <FaSpinner className="pr-spinner" />
          </div>
        ) : requests.length === 0 ? (
          <p className="pr-empty-text">No project requests found.</p>
        ) : (
          <div className="pr-table-container">
            <table className="pr-data-table">
              <thead>
                <tr className="pr-table-header">
                  <th className="pr-table-header-cell">Name</th>
                  <th className="pr-table-header-cell">Email</th>
                  <th className="pr-table-header-cell">Project Type</th>
                  <th className="pr-table-header-cell">Status</th>
                  <th className="pr-table-header-cell">Submitted At</th>
                  <th className="pr-table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request._id} className="pr-table-row">
                    <td className="pr-table-cell">{request.name || 'N/A'}</td>
                    <td className="pr-table-cell">{request.email || 'N/A'}</td>
                    <td className="pr-table-cell">{request.projectType || 'N/A'}</td>
                    <td className="pr-table-cell">
                      <span className={request.status === 'acknowledged' ? 'pr-status-acknowledged' : 'pr-status-pending'}>
                        {request.status || 'N/A'}
                      </span>
                    </td>
                    <td className="pr-table-cell">
                      {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="pr-table-cell">
                      <button
                        className="pr-view-button"
                        onClick={() => fetchRequestDetails(request._id)}
                      >
                        <FaEye className="pr-button-icon" />
                        View
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
    </section>
  );
};

export default AdminProjectRequests;