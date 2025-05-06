import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../ComponentsCSS/blogeditor.css';
import BlogAnalytics from './BlogAnaLytics';
const BlogManagementPanel = () => {
  // State for blog list and pagination
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    tag: '',
    status: ''
  });
  
  // Editor state
  const [editMode, setEditMode] = useState(false);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    tags: '',
    status: 'draft',
    featuredImage: ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list', 'edit', 'analytics'
  const [analyticsId, setAnalyticsId] = useState(null);
  // Fetch blogs from API
  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });

      const response = await axios.get(`https://connectwithaaditiyamg.onrender.com/api/blogs?${params.toString()}`, {
        withCredentials: true
      });

      setBlogs(response.data.blogs || []);
      
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total || 0,
          pages: response.data.pagination.pages || 1
        }));
      } else {
        setPagination(prev => ({
          ...prev,
          total: response.data.blogs?.length || 0,
          pages: 1
        }));
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching blogs:', err);
      setError('Failed to load blog posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize component
  useEffect(() => {
    fetchBlogs();
  }, [pagination.page, pagination.limit, filters]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    // Reset to first page when filters change
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Create or update blog post
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');
      
      // Format tags
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '');
      
      const blogData = {
        ...formData,
        tags: tagsArray
      };
      
      let response;
      
      if (selectedBlog) {
        // Update existing blog
        response = await axios.put(`https://connectwithaaditiyamg.onrender.com/api/blogs/${selectedBlog._id}`, blogData, {
          withCredentials: true
        });
        setSuccessMessage('Blog post updated successfully!');
      } else {
        // Create new blog
        response = await axios.post('https://connectwithaaditiyamg.onrender.com/api/blogs', blogData, {
          withCredentials: true
        });
        setSuccessMessage('Blog post created successfully!');
      }
      
      // Refresh blog list and reset form
      fetchBlogs();
      
      // Show success message for 3 seconds then close editor
      setTimeout(() => {
        setSuccessMessage('');
        setEditMode(false);
        setSelectedBlog(null);
      }, 3000);
      
    } catch (err) {
      console.error('Error saving blog:', err);
      setError(err.response?.data?.message || 'Failed to save blog post. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete blog post
  const handleDelete = async (blogId) => {
    if (!window.confirm('Are you sure you want to delete this blog post? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      await axios.delete(`https://connectwithaaditiyamg.onrender.com/api/blogs/${blogId}`, {
        withCredentials: true
      });
      
      // Refresh blog list
      fetchBlogs();
      setSuccessMessage('Blog post deleted successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (err) {
      console.error('Error deleting blog:', err);
      setError(err.response?.data?.message || 'Failed to delete blog post. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Edit blog post
  
  // Start creating new blog
 
  
  
  // Format text in editor
  const formatText = (e, formatting) => {
    e.preventDefault();
    const textarea = document.getElementById('content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.content.substring(start, end);
    let formattedText = '';
    
    switch(formatting) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'heading':
        formattedText = `# ${selectedText}`;
        break;
      case 'subheading':
        formattedText = `## ${selectedText}`;
        break;
      case 'list':
        formattedText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
        break;
      case 'link':
        const url = prompt('Enter URL:', 'https://');
        if (url) {
          formattedText = `[${selectedText || 'link text'}](${url})`;
        } else {
          return; // User cancelled
        }
        break;
      default:
        return;
    }
    
    // Insert the formatted text
    const newContent = formData.content.substring(0, start) + formattedText + formData.content.substring(end);
    setFormData(prev => ({
      ...prev,
      content: newContent
    }));
    
    // Reset focus to textarea after operation
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 0);
  };
  const handleViewAnalytics = (blog) => {
    setViewMode('analytics');
    setAnalyticsId(blog._id);
    // Scroll to top for better UX
    window.scrollTo(0, 0);
  };
  
  // Modify cancel function
  const handleCancel = () => {
    setViewMode('list');
    setEditMode(false);
    setSelectedBlog(null);
    setAnalyticsId(null);
    setSuccessMessage('');
  };
  const handleEdit = async (blog) => {
    setViewMode('edit');
    setEditMode(true);
    setSelectedBlog(blog);
    setFormData({
      title: blog.title,
      content: blog.content,
      summary: blog.summary,
      tags: blog.tags.join(', '),
      status: blog.status,
      featuredImage: blog.featuredImage || ''
    });
    
    // Scroll to top for better UX
    window.scrollTo(0, 0);
  };
  const handleNew = () => {
    setViewMode('edit');
    setEditMode(true);
    setSelectedBlog(null);
    setFormData({
      title: '',
      content: '',
      summary: '',
      tags: '',
      status: 'draft',
      featuredImage: ''
    });
    
    // Scroll to top for better UX
    window.scrollTo(0, 0);
  };
  return (
    <div className="blog-management-panel">
      <div className="container">
        {/* Header with title and create new button */}
        <div className="panel-header">
          {viewMode === 'list' && (
            <>
              <h1>Blog Management</h1>
              <button 
                className="btn btn-primary"
                onClick={handleNew}
              >
                Add New Post
              </button>
            </>
          )}
          
          {viewMode === 'edit' && (
            <h1>{selectedBlog ? 'Edit Blog Post' : 'Create New Blog Post'}</h1>
          )}
          
          {viewMode === 'analytics' && (
            <h1>Blog Analytics</h1>
          )}
        </div>
        
        {/* Success message */}
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {/* Blog editor */}
        {viewMode === 'edit' && (
          <div className="blog-editor-section">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter blog title"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="summary">Summary (max 200 characters) *</label>
                <textarea
                  id="summary"
                  name="summary"
                  value={formData.summary}
                  onChange={handleInputChange}
                  required
                  maxLength={200}
                  rows={3}
                  placeholder="Brief summary of the blog post"
                ></textarea>
                <span className="character-count">{formData.summary.length}/200 characters</span>
              </div>
              
              <div className="form-group">
                <label htmlFor="content">Content *</label>
                <div className="editor-toolbar">
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'heading')}
                    className="toolbar-btn"
                    title="Heading"
                  >
                    H1
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'subheading')}
                    className="toolbar-btn"
                    title="Subheading"
                  >
                    H2
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'bold')}
                    className="toolbar-btn"
                    title="Bold"
                  >
                    B
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'italic')}
                    className="toolbar-btn"
                    title="Italic"
                  >
                    I
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'list')}
                    className="toolbar-btn"
                    title="List"
                  >
                    • List
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => formatText(e, 'link')}
                    className="toolbar-btn"
                    title="Insert Link"
                  >
                    🔗 Link
                  </button>
                </div>
                <textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleInputChange}
                  required
                  rows={15}
                  placeholder="Write your blog content here... Use the toolbar to format your text or use Markdown directly."
                ></textarea>
                <span className="helper-text">Markdown is supported. You can use **bold**, *italic*, # headings, etc.</span>
              </div>
              
              <div className="form-group">
                <label htmlFor="featuredImage">Featured Image URL</label>
                <input
                  type="url"
                  id="featuredImage"
                  name="featuredImage"
                  value={formData.featuredImage}
                  onChange={handleInputChange}
                  placeholder="https://example.com/image.jpg"
                />
                {formData.featuredImage && (
                  <div className="image-preview">
                    <p>Preview:</p>
                    <img
                      src={formData.featuredImage}
                      alt="Featured"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/640x360?text=Invalid+Image+URL';
                      }}
                    />
                  </div>
                )}
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tags">Tags</label>
                  <input
                    type="text"
                    id="tags"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    placeholder="tag1, tag2, tag3"
                  />
                  <span className="helper-text">Separate tags with commas</span>
                </div>
                
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              
              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
                >
                  {loading && <span className="spinner"></span>}
                  {selectedBlog ? 'Update Blog Post' : 'Create Blog Post'}
                </button>
              </div>
            </form>
          </div>
        )}
        
      
        {viewMode === 'analytics' && analyticsId && (
          <div className="blog-analytics-section">
            <div className="section-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                Back to Blog List
              </button>
            </div>
            <BlogAnalytics blogId={analyticsId} />
          </div>
        )}
        
        {/* Blog list */}
        {viewMode === 'list' && (
          <div className="blog-list-section">
            {/* Filters */}
            <div className="filters-section">
              <div className="filter-group">
                <label>Search</label>
                <input
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search by title or content..."
                />
              </div>
              <div className="filter-group">
                <label>Tag</label>
                <input
                  type="text"
                  name="tag"
                  value={filters.tag}
                  onChange={handleFilterChange}
                  placeholder="Filter by tag..."
                />
              </div>
              <div className="filter-group">
                <label>Status</label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading blog posts...</p>
              </div>
            ) : blogs.length === 0 ? (
              <div className="empty-state">
                <p>No blog posts found.</p>
                <p>Try adjusting your filters or create a new post.</p>
              </div>
            ) : (
              <>
                <div className="blog-cards">
                  {blogs.map(blog => (
                    <div key={blog._id} className="blog-card">
                      {blog.featuredImage && (
                        <div className="card-image">
                          <img 
                            src={blog.featuredImage} 
                            alt={blog.title} 
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/640x360?text=Image+Not+Found';
                            }}
                          />
                        </div>
                      )}
                      <div className="card-content">
                        <div className="card-meta">
                          <span className={`status-badge ${blog.status}`}>
                            {blog.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                          {blog.publishedAt && (
                            <span className="publish-date">
                              {formatDate(blog.publishedAt)}
                            </span>
                          )}
                        </div>
                        <h2 className="card-title">{blog.title}</h2>
                        <p className="card-summary">{blog.summary}</p>
                        {blog.tags.length > 0 && (
                          <div className="card-tags">
                            {blog.tags.map(tag => (
                              <span key={tag} className="tag">{tag}</span>
                            ))}
                          </div>
                        )}
                        
                        <div className="card-footer">
                          <div className="author-info">
                            {blog.author?.name || 'Unknown Author'}
                          </div>
                          <div className="card-actions">
                            <button 
                              onClick={() => handleViewAnalytics(blog)}
                              className="btn btn-analytics"
                              title="View blog analytics"
                            >
                              Analytics
                            </button>
                            <button 
                              onClick={() => handleEdit(blog)}
                              className="btn btn-edit"
                              title="Edit blog post"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDelete(blog._id)}
                              className="btn btn-delete"
                              title="Delete blog post"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        
                        {/* Display reaction and comment counts if available */}
                        <div className="card-stats">
                          <div className="stat-item">
                            <span className="stat-icon">👍</span>
                            <span className="stat-value">{blog.reactionCounts?.likes || 0}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-icon">👎</span>
                            <span className="stat-value">{blog.reactionCounts?.dislikes || 0}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-icon">💬</span>
                            <span className="stat-value">{blog.commentsCount || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="pagination-btn"
                    >
                      Previous
                    </button>
                    
                    {[...Array(pagination.pages).keys()].map(number => (
                      <button
                        key={number + 1}
                        onClick={() => handlePageChange(number + 1)}
                        className={`pagination-btn ${pagination.page === number + 1 ? 'active' : ''}`}
                      >
                        {number + 1}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="pagination-btn"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogManagementPanel;