import React, { useState, useEffect } from 'react';
import './Admins.css';

const SuperAdminPanel = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false); // FIX: Track if image should be removed
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalAdmins: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    role: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    isSuperAdmin: false,
    status: 'active',
    bio: '',
    designation: '',
    location: '',
    expertise: '',
    interests: '',
    socialLinks: {
      twitter: '',
      linkedin: '',
      github: '',
      portfolio: '',
      instagram: '',
      personalWebsite: '',
      youtube: '',
      medium: ''
    }
  });

  const API_URL = 'https://connectwithaaditiyamg2.onrender.com/api';

  const getToken = () => {
    return localStorage.getItem('token');
  };

  const getHeaders = () => ({
    'Authorization': `Bearer ${getToken()}`
  });

  const getImageUrl = (adminId) => {
    return `${API_URL}/admins/${adminId}/image`;
  };

  useEffect(() => {
    fetchAdmins();
  }, [pagination.currentPage, filters]);

  const fetchAdmins = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: pagination.currentPage,
        limit: 10,
        ...(filters.status && { status: filters.status }),
        ...(filters.role && { role: filters.role })
      });

      const response = await fetch(`${API_URL}/admins?${params}`, {
        headers: getHeaders()
      });
      const data = await response.json();
      
      if (response.ok) {
        setAdmins(data.admins);
        setPagination({
          currentPage: data.currentPage,
          totalPages: data.totalPages,
          totalAdmins: data.totalAdmins
        });
      } else {
        setError(data.message || 'Failed to fetch admins');
      }
    } catch (err) {
      setError('Failed to fetch admins');
      console.error('Fetch error:', err);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('socialLinks.')) {
      const socialField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        socialLinks: {
          ...prev.socialLinks,
          [socialField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

 

 
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      isSuperAdmin: false,
      status: 'active',
      bio: '',
      designation: '',
      location: '',
      expertise: '',
      interests: '',
      socialLinks: {
        twitter: '',
        linkedin: '',
        github: '',
        portfolio: '',
        instagram: '',
        personalWebsite: '',
        youtube: '',
        medium: ''
      }
    });
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false); // FIX: Reset remove flag
    setEditingAdmin(null);
    setShowCreateForm(false);
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const formDataToSend = new FormData();
    
    // Append all form fields
    formDataToSend.append('name', formData.name);
    formDataToSend.append('email', formData.email);
    formDataToSend.append('password', formData.password);
    formDataToSend.append('role', formData.role);
    formDataToSend.append('isSuperAdmin', formData.isSuperAdmin);
    formDataToSend.append('status', formData.status);
    if (formData.bio) formDataToSend.append('bio', formData.bio);
    if (formData.designation) formDataToSend.append('designation', formData.designation);
    if (formData.location) formDataToSend.append('location', formData.location);
    
    // Append arrays as JSON strings
    const expertise = formData.expertise ? formData.expertise.split(',').map(s => s.trim()).filter(s => s) : [];
    const interests = formData.interests ? formData.interests.split(',').map(s => s.trim()).filter(s => s) : [];
    formDataToSend.append('expertise', JSON.stringify(expertise));
    formDataToSend.append('interests', JSON.stringify(interests));
    formDataToSend.append('socialLinks', JSON.stringify(formData.socialLinks));
    
    // Append image if selected
    if (imageFile) {
      formDataToSend.append('profileImage', imageFile);
    }

    try {
      const response = await fetch(`${API_URL}/admins`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formDataToSend
      });
      const data = await response.json();
      
      if (response.ok) {
        setSuccess('Admin created successfully');
        resetForm();
        fetchAdmins();
      } else {
        setError(data.message || 'Failed to create admin');
      }
    } catch (err) {
      setError('Failed to create admin');
      console.error('Create error:', err);
    }
    setLoading(false);
  };

  

  const handleDeleteAdmin = async (id) => {
    if (!window.confirm('Are you sure you want to delete this admin?')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/admins/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await response.json();
      
      if (response.ok) {
        setSuccess('Admin deleted successfully');
        fetchAdmins();
      } else {
        setError(data.message || 'Failed to delete admin');
      }
    } catch (err) {
      setError('Failed to delete admin');
      console.error('Delete error:', err);
    }
    setLoading(false);
  };

 
  const handleUpdateAdmin = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  setSuccess('');

  const formDataToSend = new FormData();
  
  // Append all form fields
  formDataToSend.append('name', formData.name);
  formDataToSend.append('email', formData.email);
  if (formData.password) formDataToSend.append('password', formData.password);
  formDataToSend.append('role', formData.role);
  formDataToSend.append('isSuperAdmin', formData.isSuperAdmin);
  formDataToSend.append('status', formData.status);
  formDataToSend.append('bio', formData.bio || '');
  formDataToSend.append('designation', formData.designation || '');
  formDataToSend.append('location', formData.location || '');
  
  // Append arrays as JSON strings
  const expertise = formData.expertise ? formData.expertise.split(',').map(s => s.trim()).filter(s => s) : [];
  const interests = formData.interests ? formData.interests.split(',').map(s => s.trim()).filter(s => s) : [];
  formDataToSend.append('expertise', JSON.stringify(expertise));
  formDataToSend.append('interests', JSON.stringify(interests));
  formDataToSend.append('socialLinks', JSON.stringify(formData.socialLinks));
  
  // DEBUG: Log what we're sending for image
  console.log('=== IMAGE UPDATE DEBUG ===');
  console.log('imageFile:', imageFile);
  console.log('removeImage:', removeImage);
  console.log('imagePreview:', imagePreview);
  
  // Handle image upload/removal
  if (imageFile) {
    console.log('Appending new image file:', imageFile.name);
    formDataToSend.append('profileImage', imageFile);
  } else if (removeImage) {
    console.log('Appending removeImage flag');
    formDataToSend.append('removeImage', 'true');
  } else {
    console.log('No image changes - keeping existing');
  }
  
  // DEBUG: Log all FormData entries
  console.log('=== FormData Contents ===');
  for (let [key, value] of formDataToSend.entries()) {
    if (key === 'profileImage') {
      console.log(key, ': File -', value.name);
    } else {
      console.log(key, ':', value);
    }
  }

  try {
    const response = await fetch(`${API_URL}/admins/${editingAdmin._id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getToken()}`
        // Don't set Content-Type - FormData handles it
      },
      body: formDataToSend
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      setSuccess('Admin updated successfully');
      resetForm();
      fetchAdmins();
    } else {
      setError(data.message || 'Failed to update admin');
    }
  } catch (err) {
    setError('Failed to update admin');
    console.error('Update error:', err);
  }
  setLoading(false);
};

const handleRemoveImage = () => {
  console.log('Remove image button clicked');
  setImageFile(null);
  setImagePreview(null);
  setRemoveImage(true);
};

const handleImageChange = (e) => {
  const file = e.target.files[0];
  console.log('Image selected:', file);
  
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }
    setImageFile(file);
    setRemoveImage(false);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      console.log('Image preview created');
    };
    reader.readAsDataURL(file);
  }
};

const handleEditClick = (admin) => {
  console.log('Editing admin:', admin._id);
  setEditingAdmin(admin);
  setFormData({
    name: admin.name || '',
    email: admin.email || '',
    password: '',
    role: admin.role || 'admin',
    isSuperAdmin: admin.isSuperAdmin || false,
    status: admin.status || 'active',
    bio: admin.bio || '',
    designation: admin.designation || '',
    location: admin.location || '',
    expertise: admin.expertise ? admin.expertise.join(', ') : '',
    interests: admin.interests ? admin.interests.join(', ') : '',
    socialLinks: {
      twitter: admin.socialLinks?.twitter || '',
      linkedin: admin.socialLinks?.linkedin || '',
      github: admin.socialLinks?.github || '',
      portfolio: admin.socialLinks?.portfolio || '',
      instagram: admin.socialLinks?.instagram || '',
      personalWebsite: admin.socialLinks?.personalWebsite || '',
      youtube: admin.socialLinks?.youtube || '',
      medium: admin.socialLinks?.medium || ''
    }
  });
  
  // Set image preview
  if (admin.profileImage?.hasImage) {
    console.log('Admin has existing image');
    setImagePreview(getImageUrl(admin._id));
  } else {
    console.log('Admin has no existing image');
    setImagePreview(null);
  }
  
  // Reset file and remove flags
  setImageFile(null);
  setRemoveImage(false);
  setShowCreateForm(true);
};
  const handleToggleStatus = async (admin) => {
    const newStatus = admin.status === 'active' ? 'inactive' : 'active';
    setLoading(true);
    setError('');
    setSuccess('');

    const formDataToSend = new FormData();
    formDataToSend.append('status', newStatus);

    try {
      const response = await fetch(`${API_URL}/admins/${admin._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formDataToSend
      });
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(`Admin status changed to ${newStatus}`);
        fetchAdmins();
      } else {
        setError(data.message || 'Failed to update status');
      }
    } catch (err) {
      setError('Failed to update status');
      console.error('Status update error:', err);
    }
    setLoading(false);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  return (
    <div className="super-admin-panel">
      <div className="panel-header">
        <h1>Super Admin Panel</h1>
        <button 
          className="btn-primary"
          onClick={() => {
            resetForm();
            setShowCreateForm(!showCreateForm);
          }}
        >
          {showCreateForm ? 'Cancel' : 'Create New Admin'}
        </button>
      </div>

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {showCreateForm && (
        <div className="form-container">
          <h2>{editingAdmin ? 'Edit Admin' : 'Create New Admin'}</h2>
          <form onSubmit={editingAdmin ? handleUpdateAdmin : handleCreateAdmin}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Profile Image</label>
                <div className="image-upload-container">
                  {imagePreview ? (
                    <div className="image-preview">
                      <img src={imagePreview} alt="Preview" />
                      <button type="button" onClick={handleRemoveImage} className="btn-remove-image">
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <p>Click to upload image</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file-input-hidden"
                    id="profileImageInput"
                  />
                  <label htmlFor="profileImageInput" className="btn-upload">
                    {imagePreview ? 'Change Image' : 'Choose Image'}
                  </label>
                </div>
                <small>Max size: 5MB. Formats: JPG, PNG, GIF, WebP</small>
              </div>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password {editingAdmin && '(leave blank to keep current)'}</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingAdmin}
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  placeholder="e.g., admin, editor, moderator"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleInputChange}>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="isSuperAdmin"
                    checked={formData.isSuperAdmin}
                    onChange={handleInputChange}
                  />
                  Super Admin
                </label>
              </div>

              <div className="form-group">
                <label>Designation</label>
                <input
                  type="text"
                  name="designation"
                  value={formData.designation}
                  onChange={handleInputChange}
                  placeholder="e.g., Tech Writer, Software Engineer"
                />
              </div>

              <div className="form-group full-width">
                <label>Bio (max 200 characters)</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows="3"
                  maxLength={200}
                  placeholder="Short introduction..."
                />
                <small>{formData.bio.length}/200 characters</small>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g., San Francisco, CA"
                />
              </div>

              <div className="form-group">
                <label>Expertise (comma-separated)</label>
                <input
                  type="text"
                  name="expertise"
                  value={formData.expertise}
                  onChange={handleInputChange}
                  placeholder="JavaScript, React, Node.js"
                />
              </div>

              <div className="form-group full-width">
                <label>Interests (comma-separated)</label>
                <input
                  type="text"
                  name="interests"
                  value={formData.interests}
                  onChange={handleInputChange}
                  placeholder="Web Development, AI, Open Source"
                />
              </div>
            </div>

            <h3>Social Links</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Twitter</label>
                <input
                  type="url"
                  name="socialLinks.twitter"
                  value={formData.socialLinks.twitter}
                  onChange={handleInputChange}
                  placeholder="https://twitter.com/username"
                />
              </div>

              <div className="form-group">
                <label>LinkedIn</label>
                <input
                  type="url"
                  name="socialLinks.linkedin"
                  value={formData.socialLinks.linkedin}
                  onChange={handleInputChange}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>

              <div className="form-group">
                <label>GitHub</label>
                <input
                  type="url"
                  name="socialLinks.github"
                  value={formData.socialLinks.github}
                  onChange={handleInputChange}
                  placeholder="https://github.com/username"
                />
              </div>

              <div className="form-group">
                <label>Portfolio</label>
                <input
                  type="url"
                  name="socialLinks.portfolio"
                  value={formData.socialLinks.portfolio}
                  onChange={handleInputChange}
                  placeholder="https://portfolio.com"
                />
              </div>

              <div className="form-group">
                <label>Instagram</label>
                <input
                  type="url"
                  name="socialLinks.instagram"
                  value={formData.socialLinks.instagram}
                  onChange={handleInputChange}
                  placeholder="https://instagram.com/username"
                />
              </div>

              <div className="form-group">
                <label>Personal Website</label>
                <input
                  type="url"
                  name="socialLinks.personalWebsite"
                  value={formData.socialLinks.personalWebsite}
                  onChange={handleInputChange}
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div className="form-group">
                <label>YouTube</label>
                <input
                  type="url"
                  name="socialLinks.youtube"
                  value={formData.socialLinks.youtube}
                  onChange={handleInputChange}
                  placeholder="https://youtube.com/@username"
                />
              </div>

              <div className="form-group">
                <label>Medium</label>
                <input
                  type="url"
                  name="socialLinks.medium"
                  value={formData.socialLinks.medium}
                  onChange={handleInputChange}
                  placeholder="https://medium.com/@username"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving...' : editingAdmin ? 'Update Admin' : 'Create Admin'}
              </button>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admins-list">
        <div className="list-header">
          <h2>All Admins ({pagination.totalAdmins})</h2>
          <div className="filters">
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select name="role" value={filters.role} onChange={handleFilterChange}>
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>
        </div>

        {loading && <p className="loading">Loading...</p>}
        
        {admins.length === 0 && !loading && (
          <p className="no-data">No admins found</p>
        )}

        <div className="admins-grid">
          {admins.map(admin => (
            <div key={admin._id} className="admin-card">
              <div className="admin-header">
                {admin.profileImage?.hasImage ? (
                  <img 
                    src={getImageUrl(admin._id)} 
                    alt={admin.name} 
                    className="admin-avatar"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="admin-avatar-placeholder"
                  style={{ display: admin.profileImage?.hasImage ? 'none' : 'flex' }}
                >
                  {admin.name.charAt(0).toUpperCase()}
                </div>
                <div className="admin-info">
                  <h3>{admin.name}</h3>
                  <p className="admin-email">{admin.email}</p>
                  {admin.designation && <p className="admin-designation">{admin.designation}</p>}
                </div>
              </div>

              <div className="admin-details">
                {admin.bio && <p className="admin-bio">{admin.bio}</p>}
                
                <div className="admin-meta">
                  <span className={`badge status-${admin.status}`}>{admin.status}</span>
                  <span className="badge">{admin.role}</span>
                  {admin.isSuperAdmin && <span className="badge super-admin">Super Admin</span>}
                </div>

                {admin.location && <p className="admin-location">📍 {admin.location}</p>}

                {admin.expertise && admin.expertise.length > 0 && (
                  <div className="admin-tags">
                    <strong>Expertise:</strong>
                    <div className="tags">
                      {admin.expertise.map((skill, index) => (
                        <span key={index} className="tag">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {admin.interests && admin.interests.length > 0 && (
                  <div className="admin-tags">
                    <strong>Interests:</strong>
                    <div className="tags">
                      {admin.interests.slice(0, 3).map((interest, index) => (
                        <span key={index} className="tag">{interest}</span>
                      ))}
                      {admin.interests.length > 3 && (
                        <span className="tag">+{admin.interests.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                {admin.socialLinks && Object.values(admin.socialLinks).some(link => link) && (
                  <div className="admin-social">
                    {admin.socialLinks.twitter && <a href={admin.socialLinks.twitter} target="_blank" rel="noopener noreferrer">Twitter</a>}
                    {admin.socialLinks.linkedin && <a href={admin.socialLinks.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
                    {admin.socialLinks.github && <a href={admin.socialLinks.github} target="_blank" rel="noopener noreferrer">GitHub</a>}
                    {admin.socialLinks.portfolio && <a href={admin.socialLinks.portfolio} target="_blank" rel="noopener noreferrer">Portfolio</a>}
                  </div>
                )}

                {admin.joinedDate && (
                  <p className="admin-joined">
                    Joined: {new Date(admin.joinedDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="admin-actions">
                <button className="btn-edit" onClick={() => handleEditClick(admin)}>Edit</button>
                <button 
                  className="btn-status" 
                  onClick={() => handleToggleStatus(admin)}
                >
                  {admin.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button className="btn-delete" onClick={() => handleDeleteAdmin(admin._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button 
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="btn-pagination"
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button 
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="btn-pagination"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminPanel;