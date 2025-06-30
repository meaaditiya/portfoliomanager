import { useState, useEffect } from 'react';
import './Adminpost.css';
const ImagePostManager = () => {
  // State for posts and selected post
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // State for form fields
  const [formData, setFormData] = useState({
    caption: '',
    hideReactionCount: false,
    image: null
  });

  // State for image preview
  const [imagePreview, setImagePreview] = useState(null);
  
  // State for handling comments
  const [comments, setComments] = useState([]);
  
  // State for form mode (create or edit)
  const [formMode, setFormMode] = useState('create');
  
  // State for alerts
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });

  // Fetch token from localStorage
  const token = localStorage.getItem('token');

  // Fetch posts on mount and when pagination changes
  useEffect(() => {
    fetchPosts();
  }, [pagination.page]);

  // Fetch all posts
  const fetchPosts = async () => {
    try {
      const response = await fetch(`https://connectwithaaditiyamg.onrender.com/api/admin/image-posts?page=${pagination.page}&limit=${pagination.limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();
      setPosts(data.posts);
      setPagination({
        ...pagination,
        total: data.pagination.total,
        pages: data.pagination.pages
      });
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Fetch a single post
  const fetchPost = async (id) => {
    try {
      const response = await fetch(`https://connectwithaaditiyamg.onrender.com/api/admin/image-posts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch post');
      }

      const data = await response.json();
      setSelectedPost(data.post);
      setComments(data.comments || []);
      
      // Set form data for editing
      setFormData({
        caption: data.post.caption,
        hideReactionCount: data.post.hideReactionCount,
        image: null
      });
      
      setImagePreview(data.post.image);
      setFormMode('edit');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Create a new post
  const createPost = async (e) => {
    e.preventDefault();
    
    try {
      const formPayload = new FormData();
      formPayload.append('caption', formData.caption);
      formPayload.append('hideReactionCount', formData.hideReactionCount);
      
      if (formData.image) {
        formPayload.append('image', formData.image);
      } else {
        showAlert('Please select an image', 'error');
        return;
      }

      const response = await fetch('https://connectwithaaditiyamg.onrender.com/api/admin/image-posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formPayload
      });

      if (!response.ok) {
        throw new Error('Failed to create post');
      }

      resetForm();
      fetchPosts();
      showAlert('Post created successfully', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Update a post
  const updatePost = async (e) => {
    e.preventDefault();
    
    if (!selectedPost) return;
    
    try {
      const formPayload = new FormData();
      formPayload.append('caption', formData.caption);
      formPayload.append('hideReactionCount', formData.hideReactionCount);
      
      if (formData.image) {
        formPayload.append('image', formData.image);
      }

      const response = await fetch(`https://connectwithaaditiyamg.onrender.com/api/admin/image-posts/${selectedPost._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formPayload
      });

      if (!response.ok) {
        throw new Error('Failed to update post');
      }

      resetForm();
      fetchPosts();
      showAlert('Post updated successfully', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Delete a post
  const deletePost = async (id) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }
    
    try {
      const response = await fetch(`https://connectwithaaditiyamg.onrender.com/api/admin/image-posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      resetForm();
      fetchPosts();
      showAlert('Post deleted successfully', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === 'file') {
      if (files && files[0]) {
        const file = files[0];
        
        // Check file type
        if (!file.type.startsWith('image/')) {
          showAlert('Only image files are allowed', 'error');
          return;
        }
        
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          showAlert('Image size must be less than 5MB', 'error');
          return;
        }
        
        setFormData({ ...formData, image: file });
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      caption: '',
      hideReactionCount: false,
      image: null
    });
    setImagePreview(null);
    setSelectedPost(null);
    setComments([]);
    setFormMode('create');
  };

  // Show alert
  const showAlert = (message, type) => {
    setAlert({ show: true, message, type });
    setTimeout(() => {
      setAlert({ show: false, message: '', type: '' });
    }, 5000);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination({ ...pagination, page: newPage });
    }
  };

  // Toggle comment status (active/hidden)
  const toggleCommentStatus = async (commentId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'hidden' : 'active';
      
      const response = await fetch(`https://connectwithaaditiyamg.onrender.com/api/admin/image-comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update comment status');
      }

      // Update comments list
      setComments(comments.map(comment => 
        comment._id === commentId ? { ...comment, status: newStatus } : comment
      ));
      
      showAlert(`Comment ${newStatus === 'active' ? 'activated' : 'hidden'} successfully`, 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Delete comment
  const deleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    
    try {
      const response = await fetch(`https://connectwithaaditiyamg.onrender.com/api/admin/image-comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Remove from comments list
      setComments(comments.filter(comment => comment._id !== commentId));
      showAlert('Comment deleted successfully', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  return (
    <div className="container">
      <h1 className="text-large bold mb-6">Posts</h1>
      
      {/* Alert */}
      {alert.show && (
        <div className={`alert ${alert.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {alert.message}
        </div>
      )}
      
      <div className="grid">
        {/* Form Section */}
        <div className="card">
          <h2 className="text-medium bold mb-4">{formMode === 'create' ? 'Create New Post' : 'Edit Post'}</h2>
          
          <form onSubmit={formMode === 'create' ? createPost : updatePost} className="form">
            <div className="form-group">
              <label className="label">Caption:</label>
              <textarea 
                name="caption"
                value={formData.caption}
                onChange={handleInputChange}
                className="textarea"
                rows="3"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="label">Image:</label>
              <input 
                type="file" 
                name="image"
                onChange={handleInputChange}
                className="file-input"
                accept="image/*"
                required={formMode === 'create'}
              />
              {imagePreview && (
                <div className="image-preview">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="image"
                  />
                </div>
              )}
            </div>
            
            <div className="checkbox-group">
              <input 
                type="checkbox" 
                id="hideReactionCount"
                name="hideReactionCount"
                checked={formData.hideReactionCount}
                onChange={handleInputChange}
                className="checkbox"
              />
              <label htmlFor="hideReactionCount" className="label-inline">Hide Reaction Count</label>
            </div>
            
            <div className="button-group">
              <button 
                type="submit" 
                className="button button-primary"
              >
                {formMode === 'create' ? 'Create Post' : 'Update Post'}
              </button>
              
              {formMode === 'edit' && (
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="button button-secondary"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
        
        {/* Selected Post Details */}
        {selectedPost && (
          <div className="card">
            <h2 className="text-medium bold mb-4">Post Details</h2>
            
            <div className="detail-group">
              <h3 className="text-small bold">Caption:</h3>
              <p>{selectedPost.caption}</p>
            </div>
            
            <div className="detail-group">
              <h3 className="text-small bold">Image:</h3>
              {selectedPost.image && (
                <img 
                  src={selectedPost.image} 
                  alt="Post" 
                  className="image"
                />
              )}
            </div>
            
            <div className="detail-group">
              <h3 className="text-small bold">Settings:</h3>
              <p>Hide Reaction Count: {selectedPost.hideReactionCount ? 'Yes' : 'No'}</p>
              <p>Reactions: {selectedPost.reactionCount || 0}</p>
              <p>Comments: {selectedPost.commentCount || 0}</p>
            </div>
            
            <div className="detail-group">
              <h3 className="text-small bold">Created:</h3>
              <p>{new Date(selectedPost.createdAt).toLocaleString()}</p>
            </div>
            
            {selectedPost.updatedAt !== selectedPost.createdAt && (
              <div className="detail-group">
                <h3 className="text-small bold">Last Updated:</h3>
                <p>{new Date(selectedPost.updatedAt).toLocaleString()}</p>
              </div>
            )}
            
            <div className="detail-group">
              <h3 className="text-small bold mb-2">Comments ({comments.length}):</h3>
              
              {comments.length > 0 ? (
                <div className="comments">
                  {comments.map(comment => (
                    <div key={comment._id} className={`comment ${comment.status === 'active' ? 'comment-active' : 'comment-hidden'}`}>
                      <div className="comment-header">
                        <div className="comment-user bold">{comment.user.name}</div>
                        <div className="comment-date">{new Date(comment.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="comment-content">{comment.content}</div>
                      <div className="comment-actions">
                        <button 
                          onClick={() => toggleCommentStatus(comment._id, comment.status)}
                          className={`button button-small ${comment.status === 'active' ? 'button-warning' : 'button-success'}`}
                        >
                          {comment.status === 'active' ? 'Hide' : 'Show'}
                        </button>
                        <button 
                          onClick={() => deleteComment(comment._id)}
                          className="button button-small button-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No comments yet</p>
              )}
            </div>
            
            <div className="button-group">
              <button 
                onClick={() => deletePost(selectedPost._id)}
                className="button button-danger"
              >
                Delete Post
              </button>
            </div>
          </div>
        )}
        
        {/* Posts List */}
        <div className="posts-section">
          <h2 className="text-medium bold mb-4">All Posts</h2>
          
          {posts.length > 0 ? (
            <div>
              <div className="posts-grid">
                {posts.map(post => (
                  <div key={post._id} className="post-card" onClick={() => fetchPost(post._id)}>
                    <div className="post-title bold mb-2">{post.caption}</div>
                    <div className="post-meta">
                      <div>Reactions: {post.hideReactionCount ? 'Hidden' : (post.reactionCount || 0)}</div>
                      <div>Comments: {post.commentCount || 0}</div>
                      <div>Created: {new Date(post.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="pagination">
                  <div className="pagination-controls">
                    <button 
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className={`button button-small ${pagination.page === 1 ? 'button-disabled' : 'button-primary'}`}
                    >
                      Prev
                    </button>
                    
                    <div className="pagination-info">
                      Page {pagination.page} of {pagination.pages}
                    </div>
                    
                    <button 
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className={`button button-small ${pagination.page === pagination.pages ? 'button-disabled' : 'button-primary'}`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>No posts found. Create your first post!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImagePostManager;