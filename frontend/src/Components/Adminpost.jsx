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
  const [commentStats, setCommentStats] = useState(null);
  
  // State for author comment form
  const [authorComment, setAuthorComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  
  // State for replies
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [expandedReplies, setExpandedReplies] = useState({});
  
  // State for form mode (create or edit)
  const [formMode, setFormMode] = useState('create');
  
  // State for alerts
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });

  // State for loading
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState({});

  // Fetch token from localStorage
  const token = localStorage.getItem('token');

  // API Base URL
  const API_BASE_URL = 'https://connectwithaaditiyamg.onrender.com';

  // Fetch posts on mount and when pagination changes
  useEffect(() => {
    fetchPosts();
  }, [pagination.page]);

  // Fetch all posts
  const fetchPosts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/image-posts?page=${pagination.page}&limit=${pagination.limit}`, {
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

  // Fetch a single post with comments
  const fetchPost = async (id) => {
    try {
      setIsLoadingComments(true);
      
      const response = await fetch(`${API_BASE_URL}/api/admin/image-posts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch post');
      }

      const data = await response.json();
      setSelectedPost(data.post);
      
      // Fetch comments with replies
      await fetchCommentsWithReplies(id);
      
      // Fetch comment stats
      await fetchCommentStats(id);
      
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
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Fetch comments with their replies
  const fetchCommentsWithReplies = async (postId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/image-posts/${postId}/comments?includeReplies=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data.comments);
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Fetch replies for a specific comment
  const fetchReplies = async (commentId) => {
    try {
      setLoadingReplies(prev => ({ ...prev, [commentId]: true }));
      
      const response = await fetch(`${API_BASE_URL}/api/image-posts/comments/${commentId}/replies`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch replies');
      }

      const data = await response.json();
      
      // Update the comment with its replies
      setComments(prevComments => 
        prevComments.map(comment => 
          comment._id === commentId 
            ? { ...comment, replies: data.replies }
            : comment
        )
      );
      
      setExpandedReplies(prev => ({ ...prev, [commentId]: true }));
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      setLoadingReplies(prev => ({ ...prev, [commentId]: false }));
    }
  };

  // Toggle replies visibility
  const toggleReplies = async (commentId, hasReplies) => {
    if (expandedReplies[commentId]) {
      // Collapse replies
      setExpandedReplies(prev => ({ ...prev, [commentId]: false }));
    } else {
      // Expand replies - fetch if not already loaded
      const comment = comments.find(c => c._id === commentId);
      if (!comment.replies || comment.replies.length === 0) {
        await fetchReplies(commentId);
      } else {
        setExpandedReplies(prev => ({ ...prev, [commentId]: true }));
      }
    }
  };

  // Fetch comment statistics
  const fetchCommentStats = async (postId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/image-posts/${postId}/comments/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comment stats');
      }

      const data = await response.json();
      setCommentStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
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

      const response = await fetch(`${API_BASE_URL}/api/admin/image-posts`, {
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

      const response = await fetch(`${API_BASE_URL}/api/admin/image-posts/${selectedPost._id}`, {
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
      const response = await fetch(`${API_BASE_URL}/api/admin/image-posts/${id}`, {
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

  // Add author comment
  const addAuthorComment = async (e) => {
    e.preventDefault();
    
    if (!selectedPost || !authorComment.trim()) {
      showAlert('Please enter a comment', 'error');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/image-posts/${selectedPost._id}/author-comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: authorComment })
      });

      if (!response.ok) {
        throw new Error('Failed to add author comment');
      }

      const data = await response.json();
      
      // Add new comment to the list
      setComments([data.comment, ...comments]);
      setAuthorComment('');
      
      // Refresh stats
      await fetchCommentStats(selectedPost._id);
      
      showAlert('Author comment added successfully', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Add author reply
  const addAuthorReply = async (parentCommentId) => {
    if (!replyContent.trim()) {
      showAlert('Please enter a reply', 'error');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/image-posts/${selectedPost._id}/author-comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          content: replyContent,
          parentCommentId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add reply');
      }

      const data = await response.json();
      
      // Update the comment with the new reply
      setComments(prevComments => 
        prevComments.map(comment => {
          if (comment._id === parentCommentId) {
            return {
              ...comment,
              replies: comment.replies ? [data.comment, ...comment.replies] : [data.comment],
              replyCount: (comment.replyCount || 0) + 1
            };
          }
          return comment;
        })
      );
      
      setReplyContent('');
      setReplyingTo(null);
      
      // Expand replies to show the new reply
      setExpandedReplies(prev => ({ ...prev, [parentCommentId]: true }));
      
      // Refresh stats
      await fetchCommentStats(selectedPost._id);
      
      showAlert('Reply added successfully', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Start editing a comment
  const startEditingComment = (comment) => {
    if (!comment.isAuthorComment) {
      showAlert('Only author comments can be edited', 'error');
      return;
    }
    setEditingCommentId(comment._id);
    setEditingCommentContent(comment.content);
  };

  // Cancel editing comment
  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentContent('');
  };

  // Update author comment
  const updateAuthorComment = async (commentId) => {
    if (!editingCommentContent.trim()) {
      showAlert('Comment content cannot be empty', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/image-comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: editingCommentContent })
      });

      if (!response.ok) {
        throw new Error('Failed to update comment');
      }

      const data = await response.json();
      
      // Update comment in list (could be in main comments or replies)
      setComments(prevComments => 
        prevComments.map(comment => {
          if (comment._id === commentId) {
            return data.comment;
          }
          // Check replies
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map(reply => 
                reply._id === commentId ? data.comment : reply
              )
            };
          }
          return comment;
        })
      );
      
      cancelEditingComment();
      showAlert('Comment updated successfully', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Toggle comment status (active/hidden)
  const toggleCommentStatus = async (commentId, currentStatus, isReply = false, parentCommentId = null) => {
    try {
      const newStatus = currentStatus === 'active' ? 'hidden' : 'active';
      
      const response = await fetch(`${API_BASE_URL}/api/admin/image-comments/${commentId}`, {
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
      if (isReply) {
        setComments(prevComments => 
          prevComments.map(comment => {
            if (comment._id === parentCommentId && comment.replies) {
              return {
                ...comment,
                replies: comment.replies.map(reply => 
                  reply._id === commentId ? { ...reply, status: newStatus } : reply
                )
              };
            }
            return comment;
          })
        );
      } else {
        setComments(prevComments => 
          prevComments.map(comment => 
            comment._id === commentId ? { ...comment, status: newStatus } : comment
          )
        );
      }
      
      // Refresh stats
      await fetchCommentStats(selectedPost._id);
      
      showAlert(`Comment ${newStatus === 'active' ? 'activated' : 'hidden'} successfully`, 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Delete comment
  const deleteComment = async (commentId, isReply = false, parentCommentId = null) => {
    if (!window.confirm('Are you sure you want to delete this comment? All replies will also be deleted.')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/image-comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Remove from comments list
      if (isReply) {
        setComments(prevComments => 
          prevComments.map(comment => {
            if (comment._id === parentCommentId && comment.replies) {
              return {
                ...comment,
                replies: comment.replies.filter(reply => reply._id !== commentId),
                replyCount: Math.max(0, (comment.replyCount || 1) - 1)
              };
            }
            return comment;
          })
        );
      } else {
        setComments(prevComments => 
          prevComments.filter(comment => comment._id !== commentId)
        );
      }
      
      // Refresh stats
      await fetchCommentStats(selectedPost._id);
      
      showAlert('Comment deleted successfully', 'success');
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
    setCommentStats(null);
    setAuthorComment('');
    setReplyContent('');
    setReplyingTo(null);
    setExpandedReplies({});
    setFormMode('create');
    cancelEditingComment();
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

  // Render a single comment or reply
  const renderComment = (comment, isReply = false, parentCommentId = null) => {
    const isEditing = editingCommentId === comment._id;
    const isReplying = replyingTo === comment._id;
    const hasReplies = comment.replyCount > 0 || (comment.replies && comment.replies.length > 0);
    const repliesExpanded = expandedReplies[comment._id];

    return (
      <div 
        key={comment._id} 
        className={`comment ${comment.status === 'active' ? 'comment-active' : 'comment-hidden'} ${comment.isAuthorComment ? 'comment-author' : ''} ${isReply ? 'comment-reply' : ''}`}
      >
        <div className="comment-header">
          <div className="comment-user-info">
            <span className="comment-user bold">{comment.user.name}</span>
            {comment.isAuthorComment && (
              <span className="author-badge">Author</span>
            )}
          </div>
          <div className="comment-meta">
            <span className="comment-date">{new Date(comment.createdAt).toLocaleString()}</span>
          </div>
        </div>
        
        {isEditing ? (
          <div className="comment-edit-form">
            <textarea
              value={editingCommentContent}
              onChange={(e) => setEditingCommentContent(e.target.value)}
              className="textarea"
              rows="3"
              maxLength="1000"
            />
            <div className="char-count">
              {editingCommentContent.length} / 1000 characters
            </div>
            <div className="comment-actions">
              <button 
                onClick={() => updateAuthorComment(comment._id)}
                className="button button-small button-success"
              >
                Save
              </button>
              <button 
                onClick={cancelEditingComment}
                className="button button-small button-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="comment-content">{comment.content}</div>
            {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
              <div className="comment-edited">(Edited: {new Date(comment.updatedAt).toLocaleString()})</div>
            )}
            
            {/* Engagement metrics */}
            <div className="comment-engagement">
              <span className="engagement-item">
                <span className="engagement-icon">👍</span> {comment.likeCount || 0}
              </span>
              <span className="engagement-item">
                <span className="engagement-icon">👎</span> {comment.dislikeCount || 0}
              </span>
              {!isReply && hasReplies && (
                <span className="engagement-item">
                  <span className="engagement-icon">💬</span> {comment.replyCount || 0} {comment.replyCount === 1 ? 'reply' : 'replies'}
                </span>
              )}
            </div>
            
            <div className="comment-actions">
              {comment.isAuthorComment && (
                <button 
                  onClick={() => startEditingComment(comment)}
                  className="button button-small button-info"
                >
                  Edit
                </button>
              )}
              {!isReply && (
                <button 
                  onClick={() => setReplyingTo(isReplying ? null : comment._id)}
                  className="button button-small button-info"
                >
                  {isReplying ? 'Cancel Reply' : 'Reply'}
                </button>
              )}
              <button 
                onClick={() => toggleCommentStatus(comment._id, comment.status, isReply, parentCommentId)}
                className={`button button-small ${comment.status === 'active' ? 'button-warning' : 'button-success'}`}
              >
                {comment.status === 'active' ? 'Hide' : 'Show'}
              </button>
              <button 
                onClick={() => deleteComment(comment._id, isReply, parentCommentId)}
                className="button button-small button-danger"
              >
                Delete
              </button>
            </div>
          </>
        )}

        {/* Reply form */}
        {isReplying && !isReply && (
          <div className="reply-form">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write your reply (max 1000 characters)..."
              className="textarea"
              rows="3"
              maxLength="1000"
            />
            <div className="char-count">
              {replyContent.length} / 1000 characters
            </div>
            <div className="reply-actions">
              <button 
                onClick={() => addAuthorReply(comment._id)}
                className="button button-small button-primary"
                disabled={!replyContent.trim()}
              >
                Add Reply
              </button>
              <button 
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent('');
                }}
                className="button button-small button-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Show/Hide Replies Button */}
        {!isReply && hasReplies && (
          <div className="replies-toggle">
            <button
              onClick={() => toggleReplies(comment._id, hasReplies)}
              className="button button-small button-secondary"
              disabled={loadingReplies[comment._id]}
            >
              {loadingReplies[comment._id] ? 'Loading...' : repliesExpanded ? '▼ Hide Replies' : `▶ Show ${comment.replyCount} ${comment.replyCount === 1 ? 'Reply' : 'Replies'}`}
            </button>
          </div>
        )}

        {/* Replies Section */}
        {!isReply && repliesExpanded && comment.replies && comment.replies.length > 0 && (
          <div className="replies-section">
            {comment.replies.map(reply => renderComment(reply, true, comment._id))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container">
      <h1 className="text-large bold mb-6">Image Posts Manager</h1>
      
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
                id="singleFileInput"
                name="image"
                onChange={handleInputChange}
                className="file-input"
                accept="image/*"
                required={formMode === 'create'}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => document.getElementById('singleFileInput').click()}
                className="file-button"
              >
                Choose Image
              </button>

              {imagePreview && (
                <div className="image-preview" style={{ marginTop: '10px' }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="image"
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
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
                {formMode === 'create' ? 'Create Post' :'Update Post'}
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
            
            {/* Comment Statistics */}
            {commentStats && (
              <div className="detail-group">
                <h3 className="text-small bold mb-2">Comment Statistics:</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{commentStats.total}</div>
                    <div className="stat-label">Total</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{commentStats.active}</div>
                    <div className="stat-label">Active</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{commentStats.hidden}</div>
                    <div className="stat-label">Hidden</div>
                  </div>
                  <div className="stat-card stat-author">
                    <div className="stat-value">{commentStats.authorComments}</div>
                    <div className="stat-label">Author</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{commentStats.userComments}</div>
                    <div className="stat-label">User</div>
                  </div>
                  <div className="stat-card stat-replies">
                    <div className="stat-value">{commentStats.replies}</div>
                    <div className="stat-label">Replies</div>
                  </div>
                  <div className="stat-card stat-likes">
                    <div className="stat-value">{commentStats.totalLikes}</div>
                    <div className="stat-label">Likes</div>
                  </div>
                  <div className="stat-card stat-dislikes">
                    <div className="stat-value">{commentStats.totalDislikes}</div>
                    <div className="stat-label">Dislikes</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Add Author Comment Form */}
            <div className="detail-group">
              <h3 className="text-small bold mb-2">Add Author Comment:</h3>
              <form onSubmit={addAuthorComment} className="author-comment-form">
                <textarea
                  value={authorComment}
                  onChange={(e) => setAuthorComment(e.target.value)}
                  placeholder="Write your author comment here (max 1000 characters)..."
                  className="textarea"
                  rows="4"
                  maxLength="1000"
                />
                <div className="char-count">
                  {authorComment.length} / 1000 characters
                </div>
                <button 
                  type="submit" 
                  className="button button-primary"
                  disabled={!authorComment.trim()}
                >
                  Add Author Comment
                </button>
              </form>
            </div>
            
            {/* Comments List */}
            <div className="detail-group">
              <h3 className="text-small bold mb-2">Comments & Replies ({comments.length}):</h3>
              
              {isLoadingComments ? (
                <div className="loading">Loading comments...</div>
              ) : comments.length > 0 ? (
                <div className="comments">
                  {comments.map(comment => renderComment(comment))}
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