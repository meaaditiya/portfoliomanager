import React, { useState, useEffect } from 'react';
import { Upload, Edit, Save, X, Image, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import './Profile.css';

const AdminDashboard = () => {
  const [profileImage, setProfileImage] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [quoteData, setQuoteData] = useState({ content: '', author: 'Aaditiya Tyagi' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_BASE = 'https://connectwithaaditiyamg.onrender.com';
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchProfileImage();
    fetchQuote();
  }, []);

  const fetchProfileImage = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/profile-image/active`);
      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setProfileImage(imageUrl);
      }
    } catch (error) {
      console.error('Error fetching profile image:', error);
    }
  };

  const fetchQuote = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/quote`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setQuote(data.quote);
        setQuoteData({
          content: data.quote.content,
          author: data.quote.author
        });
      } else if (response.status === 404) {
        setQuote(null);
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('profileImage', file);
    formData.append('filename', file.name);

    try {
      const response = await fetch(`${API_BASE}/api/profile-image/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        setSuccess('Profile image uploaded successfully!');
        fetchProfileImage();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to upload image');
      }
    } catch (error) {
      setError('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveQuote = async () => {
    if (!quoteData.content.trim()) {
      setError('Quote content is required');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const url = quote ? `${API_BASE}/api/quote` : `${API_BASE}/api/quote`;
      const method = quote ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(quoteData)
      });

      if (response.ok) {
        setSuccess(quote ? 'Quote updated successfully!' : 'Quote created successfully!');
        setIsEditingQuote(false);
        fetchQuote();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to save quote');
      }
    } catch (error) {
      setError('Error saving quote: ' + error.message);
    }
  };

  const handleToggleQuoteStatus = async () => {
    if (!quote) return;

    try {
      const response = await fetch(`${API_BASE}/api/quote/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSuccess(`Quote ${quote.isActive ? 'deactivated' : 'activated'} successfully!`);
        fetchQuote();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to toggle quote status');
      }
    } catch (error) {
      setError('Error toggling quote status: ' + error.message);
    }
  };

  const handleDeleteQuote = async () => {
    if (!quote || !window.confirm('Are you sure you want to delete this quote?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/quote`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSuccess('Quote deleted successfully!');
        setQuote(null);
        setQuoteData({ content: '', author: 'Aaditiya Tyagi' });
        setIsEditingQuote(false);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete quote');
      }
    } catch (error) {
      setError('Error deleting quote: ' + error.message);
    }
  };

  const handleCancelEdit = () => {
    if (quote) {
      setQuoteData({
        content: quote.content,
        author: quote.author
      });
    }
    setIsEditingQuote(false);
  };

  if (loading) {
    return <div className="admin-dashboard loading">Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Manage profile image and quote</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError('')} className="alert-close">×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
          <button onClick={() => setSuccess('')} className="alert-close">×</button>
        </div>
      )}

      {/* Profile Image Section */}
      <div className="profile-section">
        <h2>Profile Image</h2>
        <div className="profile-image-container">
          {profileImage ? (
            <img src={profileImage} alt="Profile" className="profile-image" />
          ) : (
            <div className="profile-image-placeholder">
              <Image size={48} />
              <p>No profile image</p>
            </div>
          )}
          
          <div className="upload-controls">
            <label htmlFor="profile-upload" className="upload-button">
              <Upload size={20} />
              {uploading ? 'Uploading...' : 'Upload New Image'}
            </label>
            <input
              id="profile-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="file-input"
            />
          </div>
        </div>
      </div>

      {/* Quote Section */}
      <div className="quotes-section">
        <div className="quotes-header">
          <h2>Current Quote</h2>
          {quote && (
            <button
              onClick={handleToggleQuoteStatus}
              className={`toggle-button12 ${quote.isActive ? 'active' : 'inactive'}`}
            >
              {quote.isActive ? (
                <>
                  <ToggleRight size={16} />
                  Active
                </>
              ) : (
                <>
                  <ToggleLeft size={16} />
                  Inactive
                </>
              )}
            </button>
          )}
        </div>

        {quote && !isEditingQuote ? (
          <div className="quote-item">
            <div className="quote-content">
              <div className="quote-display">
                <p className="quote-text">"{quote.content}"</p>
                <p className="quote-author">— {quote.author}</p>
                <div className="quote-meta">
                  <span className={`status ${quote.isActive ? 'active' : 'inactive'}`}>
                    {quote.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="date">
                    Last updated: {new Date(quote.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="quote-actions">
              <div className="view-actions">
                <button 
                  onClick={() => setIsEditingQuote(true)}
                  className="edit-button12"
                >
                  <Edit size={16} />
                  Edit
                </button>
                <button 
                  onClick={handleDeleteQuote}
                  className="delete-button12"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : isEditingQuote ? (
          <div className="add-quote-form">
            <h3>{quote ? 'Edit Quote' : 'Create New Quote'}</h3>
            <textarea
              value={quoteData.content}
              onChange={(e) => setQuoteData({ ...quoteData, content: e.target.value })}
              placeholder="Enter quote content..."
              className="quote-textarea"
              rows="4"
              maxLength="500"
            />
            <p className="character-count">{quoteData.content.length}/500 characters</p>
            
            <input
              type="text"
              value={quoteData.author}
              onChange={(e) => setQuoteData({ ...quoteData, author: e.target.value })}
              placeholder="Author name"
              className="author-input"
              maxLength="100"
            />
            
            <div className="form-buttons">
              <button onClick={handleSaveQuote} className="save-button">
                <Save size={16} />
                {quote ? 'Update Quote' : 'Create Quote'}
              </button>
              {quote && (
                <button 
                  onClick={handleCancelEdit} 
                  className="cancel-button"
                >
                  <X size={16} />
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="no-quotes">
            <p>No quote has been created yet.</p>
            <button
              onClick={() => setIsEditingQuote(true)}
              className="add-quote-button"
            >
              Create First Quote
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;