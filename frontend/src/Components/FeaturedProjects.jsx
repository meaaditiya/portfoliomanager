import React, { useState, useEffect } from 'react';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const cleanedData = {
      ...formData,
      detailedDescription: formData.detailedDescription.filter(item => item.trim() !== ''),
      tech: formData.tech.filter(item => item.trim() !== ''),
      outcomes: formData.outcomes.filter(item => item.trim() !== '')
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
    return <div style={styles.loading}>Loading projects...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Admin Projects Dashboard</h1>
        <button style={styles.addButton} onClick={() => openModal()}>
          + Add New Project
        </button>
      </div>

      {error && <div style={styles.errorMessage}>{error}</div>}
      {successMessage && <div style={styles.successMessage}>{successMessage}</div>}

      <div style={styles.projectsGrid}>
        {projects.map(project => (
          <div key={project._id} style={styles.projectCard}>
            <div style={styles.projectHeader}>
              <h3 style={styles.projectTitle}>{project.title}</h3>
              <span style={{
                ...styles.statusBadge,
                backgroundColor: project.isActive ? '#10b981' : '#ef4444'
              }}>
                {project.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <p style={styles.period}>{project.period}</p>
            <p style={styles.teamSize}>Team Size: {project.teamSize}</p>
            <p style={styles.description}>{project.description}</p>
            
            <div style={styles.techStack}>
              {project.tech.map((tech, idx) => (
                <span key={idx} style={styles.techBadge}>{tech}</span>
              ))}
            </div>

            <div style={styles.links}>
              {project.link && (
                <a href={project.link} target="_blank" rel="noopener noreferrer" style={styles.link}>
                  Live Demo
                </a>
              )}
              {project.githubUrl && (
                <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                  GitHub
                </a>
              )}
            </div>

            <div style={styles.actions}>
              <button style={styles.editButton} onClick={() => openModal(project)}>
                Edit
              </button>
              <button style={styles.toggleButton} onClick={() => handleToggle(project._id)}>
                {project.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button style={styles.deleteButton} onClick={() => handleDelete(project._id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingProject ? 'Edit Project' : 'Add New Project'}
              </h2>
              <button style={styles.closeButton} onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Period *</label>
                  <input
                    type="text"
                    name="period"
                    value={formData.period}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="30 May, 2025 - 23 Jul, 2024"
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Team Size *</label>
                  <input
                    type="number"
                    name="teamSize"
                    value={formData.teamSize}
                    onChange={handleInputChange}
                    style={styles.input}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  style={styles.textarea}
                  rows="3"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Detailed Description *</label>
                {formData.detailedDescription.map((item, index) => (
                  <div key={index} style={styles.arrayInputGroup}>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayInputChange('detailedDescription', index, e.target.value)}
                      style={styles.input}
                      placeholder={`Point ${index + 1}`}
                    />
                    {formData.detailedDescription.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('detailedDescription', index)}
                        style={styles.removeButton}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('detailedDescription')}
                  style={styles.addFieldButton}
                >
                  + Add Point
                </button>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Tech Stack *</label>
                {formData.tech.map((item, index) => (
                  <div key={index} style={styles.arrayInputGroup}>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayInputChange('tech', index, e.target.value)}
                      style={styles.input}
                      placeholder={`Technology ${index + 1}`}
                    />
                    {formData.tech.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('tech', index)}
                        style={styles.removeButton}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('tech')}
                  style={styles.addFieldButton}
                >
                  + Add Technology
                </button>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Outcomes *</label>
                {formData.outcomes.map((item, index) => (
                  <div key={index} style={styles.arrayInputGroup}>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayInputChange('outcomes', index, e.target.value)}
                      style={styles.input}
                      placeholder={`Outcome ${index + 1}`}
                    />
                    {formData.outcomes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('outcomes', index)}
                        style={styles.removeButton}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('outcomes')}
                  style={styles.addFieldButton}
                >
                  + Add Outcome
                </button>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Live Link</label>
                  <input
                    type="url"
                    name="link"
                    value={formData.link}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="https://..."
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>GitHub URL</label>
                  <input
                    type="url"
                    name="githubUrl"
                    value={formData.githubUrl}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="https://github.com/..."
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Color</label>
                  <input
                    type="text"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="purple, blue, etc."
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Order</label>
                  <input
                    type="number"
                    name="order"
                    value={formData.order}
                    onChange={handleInputChange}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Image URL</label>
                <input
                  type="url"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="https://..."
                />
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={closeModal} style={styles.cancelButton}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitButton}>
                  {editingProject ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f9fafb',
    minHeight: '100vh'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  addButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    fontSize: '18px',
    color: '#6b7280'
  },
  errorMessage: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
    border: '1px solid #fecaca'
  },
  successMessage: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
    border: '1px solid #6ee7b7'
  },
  projectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '24px'
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: 'box-shadow 0.2s'
  },
  projectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  projectTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
    flex: 1
  },
  statusBadge: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '999px',
    marginLeft: '8px'
  },
  period: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '8px'
  },
  teamSize: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '12px'
  },
  description: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.6',
    marginBottom: '16px'
  },
  techStack: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px'
  },
  techBadge: {
    fontSize: '12px',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    padding: '4px 12px',
    borderRadius: '999px',
    fontWeight: '500'
  },
  links: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  link: {
    fontSize: '14px',
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: '500'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb'
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  toggleButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '24px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '1px solid #e5e7eb'
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '32px',
    color: '#6b7280',
    cursor: 'pointer',
    padding: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  form: {
    padding: '24px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  arrayInputGroup: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px'
  },
  removeButton: {
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 16px',
    fontSize: '18px',
    cursor: 'pointer',
    flexShrink: 0
  },
  addFieldButton: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '4px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb'
  },
  cancelButton: {
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }
};

export default AdminProjects;