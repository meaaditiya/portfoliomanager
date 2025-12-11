
import React, { useState, useEffect } from 'react';
import { Upload, Edit, Save, X, Image, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import './Profile.css';

const AdminDashboard = () => {
  const [profileImage, setProfileImage] = useState(null);
  const [profileImages, setProfileImages] = useState([]);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [quoteData, setQuoteData] = useState({ content: '', author: 'Aaditiya Tyagi' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_BASE = 'https://connectwithaaditiyamg2.onrender.com';
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchProfileImage();
    fetchAllProfileImages();
    fetchQuote();
  }, []);

  const fetchProfileImage = async () => {
    try {
      // Add cache-busting query parameter to prevent stale images
      const response = await fetch(`${API_BASE}/api/profile-image/active?t=${Date.now()}`);
      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setProfileImage(imageUrl);
      } else {
        setProfileImage(null);
      }
    } catch (error) {
      console.error('Error fetching profile image:', error);
      setError('Failed to load profile image');
    }
  };

  const fetchAllProfileImages = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/profile-images`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProfileImages(data.profileImages);
      } else {
        setError('Failed to fetch profile images');
      }
    } catch (error) {
      console.error('Error fetching all profile images:', error);
      setError('Failed to load profile images list');
    }
  };

  const fetchQuote = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/quote`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setQuote(data.quote);
        setQuoteData({
          content: data.quote?.content || '',
          author: data.quote?.author || 'Aaditiya Tyagi',
        });
      } else if (response.status === 404) {
        setQuote(null);
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
      setError('Failed to load quote');
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
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        setSuccess('Profile image uploaded successfully!');
        await Promise.all([fetchProfileImage(), fetchAllProfileImages()]);
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

  const handleDeleteProfileImage = async (id) => {
    if (!window.confirm('Are you sure you want to delete this profile image?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/profile-image/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setSuccess('Profile image deleted successfully!');
        await Promise.all([fetchProfileImage(), fetchAllProfileImages()]);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete profile image');
      }
    } catch (error) {
      setError('Error deleting profile image: ' + error.message);
    }
  };

  const handleSetActiveProfileImage = async (id) => {
    try {
      // Note: The backend doesn't have a direct route to set an existing image as active.
      // For this to work, you'd need to modify the backend to add a PATCH route like `/api/profile-image/:id/activate`.
      // Below is a placeholder implementation assuming such a route exists.
      const response = await fetch(`${API_BASE}/api/profile-image/${id}/activate`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setSuccess('Profile image set as active!');
        await Promise.all([fetchProfileImage(), fetchAllProfileImages()]);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to set active profile image');
      }
    } catch (error) {
      setError('Error setting active profile image: ' + error.message);
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
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(quoteData),
      });

      if (response.ok) {
        setSuccess(quote ? 'Quote updated successfully!' : 'Quote created successfully!');
        setIsEditingQuote(false);
        await fetchQuote();
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
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setSuccess(`Quote ${quote.isActive ? 'deactivated' : 'activated'} successfully!`);
        await fetchQuote();
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
          'Authorization': `Bearer ${token}`,
        },
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
        author: quote.author,
      });
    } else {
      setQuoteData({ content: '', author: 'Aaditiya Tyagi' });
    }
    setIsEditingQuote(false);
  };

  if (loading) {
    return <div className="admin-dashboard loading">Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
    

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
            <div className="profile-image-wrapper">
              <img src={profileImage} alt="Profile" className="profile-image" />
              <div className="profile-actions">
                <button
                  onClick={() => handleDeleteProfileImage(profileImages.find(img => img.isActive)?._id)}
                  className="delete-button12"
                  disabled={!profileImages.find(img => img.isActive)}
                >
                  <Trash2 size={16} />
                  Delete Active Image
                </button>
              </div>
            </div>
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

        {/* Profile Images History */}
        <div className="profile-images-history">
          <h3>Uploaded Images</h3>
          {profileImages.length > 0 ? (
            <div className="profile-images-grid">
              {profileImages.map((img) => (
                <div key={img._id} className="profile-image-item">
                  <img
                    src={`${API_BASE}/api/profile-image/${img._id}?t=${Date.now()}`}
                    alt={img.filename}
                    className="profile-image-thumbnail"
                  />
                  <div className="image-meta">
                    <p>{img.filename}</p>
                    <p>Size: {(img.size / 1024).toFixed(2)} KB</p>
                    <p>Uploaded: {new Date(img.uploadedAt).toLocaleDateString()}</p>
                    <p>Status: {img.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div className="image-actions">
                    {!img.isActive && (
                      <button
                        onClick={() => handleSetActiveProfileImage(img._id)}
                        className="set-active-button"
                      >
                        Set as Active
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteProfileImage(img._id)}
                      className="delete-button12"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No images uploaded yet.</p>
          )}
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