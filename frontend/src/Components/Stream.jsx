import React, { useState, useEffect } from 'react';
import './Stream.css';

const StreamAdmin = () => {
  const token = localStorage.getItem('token');
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStream, setEditingStream] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledDate: '',
    scheduledTime: '',
    youtubeLink: '',
    status: 'scheduled',
    password: ''
  });

  const BASE_URL = 'https://connectwithaaditiyamg2.onrender.com';

  useEffect(() => {
    if (token) {
      fetchStreams();
    }
  }, [token]);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/admin/streams`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStreams(data.streams);
      } else {
        setError('Failed to fetch streams');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const url = editingStream 
        ? `${BASE_URL}/api/admin/streams/${editingStream._id}`
        : `${BASE_URL}/api/admin/streams`;
      
      const method = editingStream ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message);
        resetForm();
        fetchStreams();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Operation failed');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (stream) => {
    setEditingStream(stream);
    setFormData({
      title: stream.title,
      description: stream.description,
      scheduledDate: stream.scheduledDate,
      scheduledTime: stream.scheduledTime,
      youtubeLink: stream.youtubeLink,
      status: stream.status,
      password: stream.password || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (streamId) => {
    if (!window.confirm('Are you sure you want to delete this stream?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/admin/streams/${streamId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message);
        fetchStreams();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Delete failed');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      scheduledDate: '',
      scheduledTime: '',
      youtubeLink: '',
      status: 'scheduled',
      password: ''
    });
    setEditingStream(null);
    setShowForm(false);
  };

  const formatDateTime = (date, time) => {
    return `${date} at ${time}`;
  };

  if (!token) {
    return (
      <div className="tyagi-admin-container">
        <div className="tyagi-login-message">
          <h2>Please log in to access the admin panel</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="tyagi-admin-container">
      <div className="tyagi-admin-header">
        <h1>Stream Admin Dashboard</h1>
        <button 
          className="tyagi-btn tyagi-btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add New Stream'}
        </button>
      </div>

      {error && (
        <div className="tyagi-alert tyagi-alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="tyagi-alert tyagi-alert-success">
          {success}
        </div>
      )}

      {showForm && (
        <div className="tyagi-form-container">
          <h2>{editingStream ? 'Edit Stream' : 'Add New Stream'}</h2>
          <form onSubmit={handleSubmit} className="tyagi-stream-form">
            <div className="tyagi-form-group">
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="tyagi-form-input"
              />
            </div>

            <div className="tyagi-form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="tyagi-form-textarea"
                rows="3"
              />
            </div>

            <div className="tyagi-form-row">
              <div className="tyagi-form-group">
                <label htmlFor="scheduledDate">Date *</label>
                <input
                  type="date"
                  id="scheduledDate"
                  name="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={handleInputChange}
                  required
                  className="tyagi-form-input"
                />
              </div>

              <div className="tyagi-form-group">
                <label htmlFor="scheduledTime">Time *</label>
                <input
                  type="time"
                  id="scheduledTime"
                  name="scheduledTime"
                  value={formData.scheduledTime}
                  onChange={handleInputChange}
                  required
                  className="tyagi-form-input"
                />
              </div>
            </div>

            <div className="tyagi-form-group">
              <label htmlFor="youtubeLink">YouTube Link *</label>
              <input
                type="url"
                id="youtubeLink"
                name="youtubeLink"
                value={formData.youtubeLink}
                onChange={handleInputChange}
                required
                className="tyagi-form-input"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>

            <div className="tyagi-form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="tyagi-form-select"
              >
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
              </select>
            </div>

            <div className="tyagi-form-group">
              <label htmlFor="password">Password (Optional)</label>
              <input
                type="text"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="tyagi-form-input"
                placeholder="Leave empty for public stream"
              />
              <small className="tyagi-form-hint">
                Set a password to make this stream private. Users will need this password to access the stream.
              </small>
            </div>

            <div className="tyagi-form-actions">
              <button
                type="submit"
                disabled={loading}
                className="tyagi-btn tyagi-btn-primary"
              >
                {loading ? 'Saving...' : (editingStream ? 'Update Stream' : 'Create Stream')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="tyagi-btn tyagi-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="tyagi-streams-container">
        <h2>All Streams</h2>
        {loading && <div className="tyagi-loading">Loading streams...</div>}
        
        {streams.length === 0 && !loading && (
          <div className="tyagi-no-streams">
            <p>No streams found. Create your first stream!</p>
          </div>
        )}

        <div className="tyagi-streams-grid">
          {streams.map((stream) => (
            <div key={stream._id} className="tyagi-stream-card">
              <div className="tyagi-stream-header">
                <h3>{stream.title}</h3>
                <div className="tyagi-stream-badges">
                  <div className={`tyagi-status tyagi-status-${stream.status}`}>
                    {stream.status}
                  </div>
                  {stream.password && (
                    <div className="tyagi-status tyagi-status-protected">
                      🔒 Protected
                    </div>
                  )}
                </div>
              </div>
              
              {stream.description && (
                <p className="tyagi-stream-description">{stream.description}</p>
              )}
              
              <div className="tyagi-stream-details">
                <div className="tyagi-stream-datetime">
                  <strong>Scheduled:</strong> {formatDateTime(stream.scheduledDate, stream.scheduledTime)}
                </div>
                <div className="tyagi-stream-link">
                  <strong>YouTube:</strong> 
                  <a 
                    href={stream.youtubeLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="tyagi-youtube-link"
                  >
                    View on YouTube
                  </a>
                </div>
                {stream.password && (
                  <div className="tyagi-stream-password">
                    <strong>Password:</strong> {stream.password}
                  </div>
                )}
              </div>

              <div className="tyagi-stream-actions">
                <button
                  onClick={() => handleEdit(stream)}
                  className="tyagi-btn tyagi-btn-edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(stream._id)}
                  className="tyagi-btn tyagi-btn-delete"
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StreamAdmin;