import React, { useState, useEffect } from 'react';
import './AdminProjects.css';

const AdminProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    period: '',
    teamSize: 1,
    description: '',
    detailedDescription: [''],
    tech: [''],
    outcomes: [''],
    link: '',
    githubUrl: '',
    color: '',
    imageUrl: '',        
    galleryImages: [],   
    order: 0
  });

  const API_URL = 'https://connectwithaaditiyamg2.onrender.com';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/admin/projects`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setProjects(data.projects);
      } else {
        setError(data.message || 'Failed to fetch projects');
      }
    } catch (err) {
      setError('Error fetching projects');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleArrayInputChange = (field, index, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addArrayField = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayField = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const openModal = (project = null) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        title: project.title,
        period: project.period,
        teamSize: project.teamSize,
        description: project.description,
        detailedDescription: project.detailedDescription || [''],
        tech: project.tech || [''],
        outcomes: project.outcomes || [''],
        link: project.link || '',
        githubUrl: project.githubUrl || '',
        color: project.color || '',
        imageUrl: project.imageUrl || '',
        galleryImages: project.galleryImages || [],
        order: project.order || 0
      });
    } else {
      setEditingProject(null);
      setFormData({
        title: '',
        period: '',
        teamSize: 1,
        description: '',
        detailedDescription: [''],
        tech: [''],
        outcomes: [''],
        link: '',
        githubUrl: '',
        color: '',
        imageUrl: '',
        galleryImages: [], 
        order: 0
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProject(null);
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    const cleanedData = {
      ...formData,
      detailedDescription: formData.detailedDescription.filter(item => item.trim() !== ''),
      tech: formData.tech.filter(item => item.trim() !== ''),
      outcomes: formData.outcomes.filter(item => item.trim() !== ''),
      galleryImages: formData.galleryImages.filter(item => item.trim() !== '') 
    };

    try {
      const url = editingProject 
        ? `${API_URL}/api/projects/${editingProject._id}`
        : `${API_URL}/api/projects`;
      
      const method = editingProject ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(cleanedData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message);
        closeModal();
        fetchProjects();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.message || 'Operation failed');
      }
    } catch (err) {
      setError('Error submitting project');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      const response = await fetch(`${API_URL}/api/projects/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message);
        fetchProjects();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.message || 'Delete failed');
      }
    } catch (err) {
      setError('Error deleting project');
    }
  };

  const handleToggle = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/projects/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message);
        fetchProjects();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.message || 'Toggle failed');
      }
    } catch (err) {
      setError('Error toggling project status');
    }
  };

  if (loading) {
    return <div className="ap-loading">Loading projects...</div>;
  }

  return (
    <div className="ap-container">
      <div className="ap-header">
        <h1 className="ap-title">Admin Projects Dashboard</h1>
        <button className="ap-add-button" onClick={() => openModal()}>
          + Add New Project
        </button>
      </div>

      {error && <div className="ap-error-message">{error}</div>}
      {successMessage && <div className="ap-success-message">{successMessage}</div>}

      <div className="ap-projects-grid">
        {projects.map(project => (
          <div key={project._id} className="ap-project-card">
            <div className="ap-project-header">
              <h3 className="ap-project-title">{project.title}</h3>
              <span className={`ap-status-badge ${project.isActive ? 'ap-status-active' : 'ap-status-inactive'}`}>
                {project.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <p className="ap-period">{project.period}</p>
            <p className="ap-team-size">Team Size: {project.teamSize}</p>
            <p className="ap-description">{project.description}</p>
            
            <div className="ap-tech-stack">
              {project.tech.map((tech, idx) => (
                <span key={idx} className="ap-tech-badge">{tech}</span>
              ))}
            </div>

            <div className="ap-links">
              {project.link && (
                <a href={project.link} target="_blank" rel="noopener noreferrer" className="ap-link">
                  Live Demo
                </a>
              )}
              {project.githubUrl && (
                <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="ap-link">
                  GitHub
                </a>
              )}
            </div>

            <div className="ap-actions">
              <button className="ap-edit-button" onClick={() => openModal(project)}>
                Edit
              </button>
              <button className="ap-toggle-button" onClick={() => handleToggle(project._id)}>
                {project.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button className="ap-delete-button" onClick={() => handleDelete(project._id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="ap-modal-overlay" onClick={closeModal}>
          <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ap-modal-header">
              <h2 className="ap-modal-title">
                {editingProject ? 'Edit Project' : 'Add New Project'}
              </h2>
              <button className="ap-close-button" onClick={closeModal}>×</button>
            </div>

            <div className="ap-form">
              <div className="ap-form-group">
                <label className="ap-label">Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="ap-input"
                  required
                />
              </div>

              <div className="ap-form-row">
                <div className="ap-form-group">
                  <label className="ap-label">Period *</label>
                  <input
                    type="text"
                    name="period"
                    value={formData.period}
                    onChange={handleInputChange}
                    className="ap-input"
                    placeholder="30 May, 2025 - 23 Jul, 2024"
                    required
                  />
                </div>

                <div className="ap-form-group">
                  <label className="ap-label">Team Size *</label>
                  <input
                    type="number"
                    name="teamSize"
                    value={formData.teamSize}
                    onChange={handleInputChange}
                    className="ap-input"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="ap-form-group">
                <label className="ap-label">Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="ap-textarea"
                  rows="3"
                  required
                />
              </div>

              <div className="ap-form-group">
                <label className="ap-label">Detailed Description *</label>
                {formData.detailedDescription.map((item, index) => (
                  <div key={index} className="ap-array-input-group">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayInputChange('detailedDescription', index, e.target.value)}
                      className="ap-input"
                      placeholder={`Point ${index + 1}`}
                    />
                    {formData.detailedDescription.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('detailedDescription', index)}
                        className="ap-remove-button"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('detailedDescription')}
                  className="ap-add-field-button"
                >
                  + Add Point
                </button>
              </div>

              <div className="ap-form-group">
                <label className="ap-label">Tech Stack *</label>
                {formData.tech.map((item, index) => (
                  <div key={index} className="ap-array-input-group">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayInputChange('tech', index, e.target.value)}
                      className="ap-input"
                      placeholder={`Technology ${index + 1}`}
                    />
                    {formData.tech.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('tech', index)}
                        className="ap-remove-button"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('tech')}
                  className="ap-add-field-button"
                >
                  + Add Technology
                </button>
              </div>

              <div className="ap-form-group">
                <label className="ap-label">Outcomes *</label>
                {formData.outcomes.map((item, index) => (
                  <div key={index} className="ap-array-input-group">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayInputChange('outcomes', index, e.target.value)}
                      className="ap-input"
                      placeholder={`Outcome ${index + 1}`}
                    />
                    {formData.outcomes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('outcomes', index)}
                        className="ap-remove-button"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('outcomes')}
                  className="ap-add-field-button"
                >
                  + Add Outcome
                </button>
              </div>

              <div className="ap-form-row">
                <div className="ap-form-group">
                  <label className="ap-label">Live Link</label>
                  <input
                    type="url"
                    name="link"
                    value={formData.link}
                    onChange={handleInputChange}
                    className="ap-input"
                    placeholder="https://..."
                  />
                </div>

                <div className="ap-form-group">
                  <label className="ap-label">GitHub URL</label>
                  <input
                    type="url"
                    name="githubUrl"
                    value={formData.githubUrl}
                    onChange={handleInputChange}
                    className="ap-input"
                    placeholder="https://github.com/..."
                  />
                </div>
              </div>

              <div className="ap-form-row">
                <div className="ap-form-group">
                  <label className="ap-label">Color</label>
                  <input
                    type="text"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    className="ap-input"
                    placeholder="purple, blue, etc."
                  />
                </div>

                <div className="ap-form-group">
                  <label className="ap-label">Order</label>
                  <input
                    type="number"
                    name="order"
                    value={formData.order}
                    onChange={handleInputChange}
                    className="ap-input"
                  />
                </div>
              </div>

              <div className="ap-form-group">
                <label className="ap-label">Image URL</label>
                <input
                  type="url"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleInputChange}
                  className="ap-input"
                  placeholder="https://..."
                />
              </div>

              <div className="ap-form-group">
                <label className="ap-label">Gallery Images</label>
                {formData.galleryImages.map((item, index) => (
                  <div key={index} className="ap-array-input-group">
                    <input
                      type="url"
                      value={item}
                      onChange={(e) => handleArrayInputChange('galleryImages', index, e.target.value)}
                      className="ap-input"
                      placeholder={`Image URL ${index + 1}`}
                    />
                    {formData.galleryImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('galleryImages', index)}
                        className="ap-remove-button"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('galleryImages')}
                  className="ap-add-field-button"
                >
                  + Add Gallery Image
                </button>
              </div>

              <div className="ap-modal-actions">
                <button type="button" onClick={closeModal} className="ap-cancel-button">
                  Cancel
                </button>
                <button type="button" onClick={handleSubmit} className="ap-submit-button">
                  {editingProject ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProjects;