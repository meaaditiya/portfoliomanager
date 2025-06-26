// src/components/BlogAnalytics.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaThumbsUp, FaThumbsDown, FaCommentAlt, FaCheck, FaTimes, FaClock, FaCrown, FaPlus, FaTrash, FaReply, FaHeart, FaHeartBroken } from 'react-icons/fa';
import './Analytics.css';

const BlogAnalytics = ({ blogId }) => {
  // States for analytics data
  const [reactions, setReactions] = useState({
    counts: { likes: 0, dislikes: 0, total: 0 },
    reactionsList: []
  });
  const [comments, setComments] = useState({
    approved: [],
    pending: [],
    rejected: []
  });
  
  // Author comments state
  const [authorComments, setAuthorComments] = useState([]);
  const [authorCommentForm, setAuthorCommentForm] = useState({
    content: '',
    isSubmitting: false
  });
  const [showAuthorCommentForm, setShowAuthorCommentForm] = useState(false);
  
  // Comment replies state
  const [commentReplies, setCommentReplies] = useState({});
  const [showReplies, setShowReplies] = useState({});
  const [replyForms, setReplyForms] = useState({});
  const [showReplyForms, setShowReplyForms] = useState({});
  
  // Comment reactions state
  const [commentReactions, setCommentReactions] = useState({});
  const [userCommentReactions, setUserCommentReactions] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('reactions');
  const [commentTab, setCommentTab] = useState('approved');
  
  // Comment pagination
  const [commentPagination, setCommentPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });
  
  // Author comment pagination
  const [authorCommentPagination, setAuthorCommentPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });
  
  // Fetch data on component mount
  useEffect(() => {
    if (blogId) {
      fetchAnalytics();
    }
  }, [blogId]);
  
  // Fetch reactions and comments data
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const reactionsResponse = await axios.get(
        `https://connectwithaaditiyamg.onrender.com/api/admin/blogs/${blogId}/reactions`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      setReactions({
        counts: reactionsResponse.data.counts,
        reactionsList: reactionsResponse.data.reactions
      });
      
      // Fetch approved comments
      await fetchCommentsByStatus('approved');
      // Fetch author comments
      await fetchAuthorComments();
      
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch comments by status
  const fetchCommentsByStatus = async (status, page = 1) => {
    try {
      const token = localStorage.getItem('token');
      const commentsResponse = await axios.get(
        `https://connectwithaaditiyamg.onrender.com/api/admin/blogs/${blogId}/comments`,
        { 
          params: { status, page, limit: 10 },
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      setComments(prev => ({
        ...prev,
        [status]: commentsResponse.data.comments
      }));
      
      setCommentPagination({
        page: commentsResponse.data.pagination.page,
        pages: commentsResponse.data.pagination.pages,
        total: commentsResponse.data.pagination.total
      });
      
      // Fetch comment reactions for each comment
      for (const comment of commentsResponse.data.comments) {
        await fetchCommentReactions(comment._id);
      }
      
    } catch (err) {
      console.error(`Error fetching ${status} comments:`, err);
      setError(err.response?.data?.message || `Failed to load ${status} comments`);
    }
  };
  
  // Fetch author comments
  const fetchAuthorComments = async (page = 1) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `https://connectwithaaditiyamg.onrender.com/api/blogs/${blogId}/author-comments`,
        {
          params: { page, limit: 10 },
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      setAuthorComments(response.data.comments);
      setAuthorCommentPagination({
        page: response.data.pagination.page,
        pages: response.data.pagination.pages,
        total: response.data.pagination.total
      });
      
      // Fetch comment reactions for author comments
      for (const comment of response.data.comments) {
        await fetchCommentReactions(comment._id);
      }
      
    } catch (err) {
      console.error('Error fetching author comments:', err);
    }
  };
  
  // Fetch comment reactions
  const fetchCommentReactions = async (commentId) => {
    try {
      const [countsResponse, userReactionResponse] = await Promise.all([
        axios.get(`https://connectwithaaditiyamg.onrender.com/api/comments/${commentId}/reactions/count`),
        axios.get(`https://connectwithaaditiyamg.onrender.com/api/comments/${commentId}/reactions/user`, {
          params: { email: 'admin@example.com' } // Use admin email or get from token
        })
      ]);
      
      setCommentReactions(prev => ({
        ...prev,
        [commentId]: countsResponse.data
      }));
      
      setUserCommentReactions(prev => ({
        ...prev,
        [commentId]: userReactionResponse.data
      }));
      
    } catch (err) {
      console.error('Error fetching comment reactions:', err);
    }
  };
  
  // Fetch comment replies
  const fetchCommentReplies = async (commentId) => {
    try {
      const response = await axios.get(
        `https://connectwithaaditiyamg.onrender.com/api/comments/${commentId}/replies`
      );
      
      setCommentReplies(prev => ({
        ...prev,
        [commentId]: response.data.replies
      }));
      
      // Fetch reactions for each reply
      for (const reply of response.data.replies) {
        await fetchCommentReactions(reply._id);
      }
      
    } catch (err) {
      console.error('Error fetching comment replies:', err);
    }
  };
  
  // Toggle show replies
  const toggleShowReplies = async (commentId) => {
    setShowReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
    
    if (!showReplies[commentId] && !commentReplies[commentId]) {
      await fetchCommentReplies(commentId);
    }
  };
  
  // Handle comment reaction
  const handleCommentReaction = async (commentId, type) => {
    try {
      const token = localStorage.getItem('token');
      const userInfo = JSON.parse(localStorage.getItem('userInfo')) || { name: 'Admin', email: 'admin@example.com' };
      
      await axios.post(
        `https://connectwithaaditiyamg.onrender.com/api/comments/${commentId}/reactions`,
        {
          name: userInfo.name,
          email: userInfo.email,
          type: type
        }
      );
      
      // Refresh comment reactions
      await fetchCommentReactions(commentId);
      
    } catch (err) {
      console.error('Error handling comment reaction:', err);
      alert(err.response?.data?.message || 'Failed to update reaction');
    }
  };
  
  // Add author reply to comment
  const handleAddAuthorReply = async (commentId) => {
    const replyContent = replyForms[commentId]?.content;
    
    if (!replyContent?.trim()) {
      alert('Please enter a reply');
      return;
    }
    
    setReplyForms(prev => ({
      ...prev,
      [commentId]: { ...prev[commentId], isSubmitting: true }
    }));
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `https://connectwithaaditiyamg.onrender.com/api/comments/${commentId}/author-reply`,
        { content: replyContent },
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      // Reset form and refresh replies
      setReplyForms(prev => ({
        ...prev,
        [commentId]: { content: '', isSubmitting: false }
      }));
      setShowReplyForms(prev => ({
        ...prev,
        [commentId]: false
      }));
      
      await fetchCommentReplies(commentId);
      
    } catch (err) {
      console.error('Error adding author reply:', err);
      alert(err.response?.data?.message || 'Failed to add reply');
      setReplyForms(prev => ({
        ...prev,
        [commentId]: { ...prev[commentId], isSubmitting: false }
      }));
    }
  };
  
  // Add author comment
  const handleAddAuthorComment = async (e) => {
    e.preventDefault();
    
    if (!authorCommentForm.content.trim()) {
      alert('Please enter a comment');
      return;
    }
    
    setAuthorCommentForm(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `https://connectwithaaditiyamg.onrender.com/api/blogs/${blogId}/author-comment`,
        { content: authorCommentForm.content },
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      // Reset form and refresh author comments
      setAuthorCommentForm({ content: '', isSubmitting: false });
      setShowAuthorCommentForm(false);
      await fetchAuthorComments();
      
    } catch (err) {
      console.error('Error adding author comment:', err);
      alert(err.response?.data?.message || 'Failed to add author comment');
      setAuthorCommentForm(prev => ({ ...prev, isSubmitting: false }));
    }
  };
  
  // Delete author comment
  const deleteAuthorComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this author comment?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `https://connectwithaaditiyamg.onrender.com/api/author-comments/${commentId}`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      // Refresh author comments
      await fetchAuthorComments();
      
    } catch (err) {
      console.error('Error deleting author comment:', err);
      alert(err.response?.data?.message || 'Failed to delete author comment');
    }
  };
  
  // Change comments tab
  const handleCommentTabChange = (status) => {
    setCommentTab(status);
    if (status === 'author') {
      fetchAuthorComments();
    } else {
      fetchCommentsByStatus(status);
    }
  };
  
  // Handle comment pagination
  const handleCommentPageChange = (newPage) => {
    if (commentTab === 'author') {
      fetchAuthorComments(newPage);
    } else {
      fetchCommentsByStatus(commentTab, newPage);
    }
  };
  
  // Update comment status
  const updateCommentStatus = async (commentId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `https://connectwithaaditiyamg.onrender.com/api/admin/comments/${commentId}`,
        { status: newStatus },
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      // Refresh all comment lists
      fetchCommentsByStatus('approved');
      fetchCommentsByStatus('pending');
      fetchCommentsByStatus('rejected');
      
    } catch (err) {
      console.error('Error updating comment status:', err);
      alert(err.response?.data?.message || 'Failed to update comment status');
    }
  };
  
  // Delete comment
  const deleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `https://connectwithaaditiyamg.onrender.com/api/admin/comments/${commentId}`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      // Refresh all comment lists
      fetchCommentsByStatus('approved');
      fetchCommentsByStatus('pending');
      fetchCommentsByStatus('rejected');
      
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert(err.response?.data?.message || 'Failed to delete comment');
    }
  };
  
  // Format date
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
  
  // Show empty state message
  const renderEmptyState = (type) => {
    return (
      <div className="empty-state">
        <p>No {type} found for this blog post.</p>
      </div>
    );
  };

  // Render comment reactions
  const renderCommentReactions = (commentId) => {
    const reactions = commentReactions[commentId] || { likes: 0, dislikes: 0 };
    const userReaction = userCommentReactions[commentId];
    
    return (
      <div className="comment-reactions">
        <button 
          className={`comment-reaction-btn like-btn ${userReaction?.hasReacted && userReaction?.reactionType === 'like' ? 'active' : ''}`}
          onClick={() => handleCommentReaction(commentId, 'like')}
          title="Like this comment"
        >
          <FaThumbsUp /> {reactions.likes}
        </button>
        <button 
          className={`comment-reaction-btn dislike-btn ${userReaction?.hasReacted && userReaction?.reactionType === 'dislike' ? 'active' : ''}`}
          onClick={() => handleCommentReaction(commentId, 'dislike')}
          title="Dislike this comment"
        >
          <FaThumbsDown /> {reactions.dislikes}
        </button>
      </div>
    );
  };

  // Render comment replies
  const renderCommentReplies = (commentId, comment) => {
    const replies = commentReplies[commentId] || [];
    const showRepliesForComment = showReplies[commentId];
    
    return (
      <div className="comment-replies-section">
        {comment.repliesCount > 0 && (
          <button 
            className="show-replies-btn"
            onClick={() => toggleShowReplies(commentId)}
          >
            {showRepliesForComment ? 'Hide' : 'Show'} {comment.repliesCount} replies
          </button>
        )}
        
        {showRepliesForComment && (
          <div className="comment-replies">
            {replies.map(reply => (
              <div key={reply._id} className={`comment-reply ${reply.isAuthorComment ? 'author-reply' : ''}`}>
                <div className="reply-header">
                  <div className="reply-user-info">
                    {reply.isAuthorComment ? (
                      <div className="author-badge">
                        <FaCrown /> <strong>{reply.user.name}</strong> <span className="author-tag">Author</span>
                      </div>
                    ) : (
                      <strong>{reply.user.name}</strong>
                    )}
                  </div>
                  <span className="reply-date">{formatDate(reply.createdAt)}</span>
                </div>
                <div className="reply-content">{reply.content}</div>
                {renderCommentReactions(reply._id)}
              </div>
            ))}
          </div>
        )}
        
        {/* Author Reply Form */}
        <div className="author-reply-section">
          <button 
            className="show-reply-form-btn"
            onClick={() => setShowReplyForms(prev => ({
              ...prev,
              [commentId]: !prev[commentId]
            }))}
          >
            <FaReply /> Reply as Author
          </button>
          
          {showReplyForms[commentId] && (
            <div className="author-reply-form">
              <textarea
                value={replyForms[commentId]?.content || ''}
                onChange={(e) => setReplyForms(prev => ({
                  ...prev,
                  [commentId]: { ...prev[commentId], content: e.target.value }
                }))}
                placeholder="Write your reply as author..."
                rows="3"
                maxLength="1000"
                className="author-reply-textarea"
                disabled={replyForms[commentId]?.isSubmitting}
              />
              <div className="reply-form-actions">
                <button 
                  className="btn btn-success btn-sm"
                  onClick={() => handleAddAuthorReply(commentId)}
                  disabled={replyForms[commentId]?.isSubmitting || !replyForms[commentId]?.content?.trim()}
                >
                  {replyForms[commentId]?.isSubmitting ? 'Adding...' : 'Add Reply'}
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowReplyForms(prev => ({
                      ...prev,
                      [commentId]: false
                    }));
                    setReplyForms(prev => ({
                      ...prev,
                      [commentId]: { content: '', isSubmitting: false }
                    }));
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="blog-analytics">
      <div className="analytics-tabs">
        <button 
          className={`tab-btn ${activeTab === 'reactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('reactions')}
        >
          Reactions
        </button>
        <button 
          className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          Comments
        </button>
      </div>
      
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="analytics-content">
          {activeTab === 'reactions' && (
            <div className="reactions-analytics">
              <div className="analytics-summary">
                <div className="summary-card">
                  <div className="summary-icon like-icon">
                    <FaThumbsUp />
                  </div>
                  <div className="summary-data">
                    <h3>{reactions.counts.likes}</h3>
                    <p>Likes</p>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="summary-icon dislike-icon">
                    <FaThumbsDown />
                  </div>
                  <div className="summary-data">
                    <h3>{reactions.counts.dislikes}</h3>
                    <p>Dislikes</p>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="summary-icon total-icon">
                    <FaCommentAlt />
                  </div>
                  <div className="summary-data">
                    <h3>{reactions.counts.total}</h3>
                    <p>Total Reactions</p>
                  </div>
                </div>
              </div>
              
              <h3>Reaction Details</h3>
              {reactions.reactionsList.length === 0 ? (
                renderEmptyState('reactions')
              ) : (
                <div className="reactions-table-container">
                  <table className="reactions-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Reaction</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reactions.reactionsList.map(reaction => (
                        <tr key={reaction._id}>
                          <td>{reaction.user.name}</td>
                          <td><a href={`mailto:${reaction.user.email}`}>{reaction.user.email}</a></td>
                          <td>
                            <span className={`reaction-badge ${reaction.type}`}>
                              {reaction.type === 'like' ? (
                                <><FaThumbsUp /> Like</>
                              ) : (
                                <><FaThumbsDown /> Dislike</>
                              )}
                            </span>
                          </td>
                          <td>{formatDate(reaction.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'comments' && (
            <div className="comments-analytics">
              <div className="comments-tabs">
                <button 
                  className={`comment-tab-btn ${commentTab === 'approved' ? 'active' : ''}`}
                  onClick={() => handleCommentTabChange('approved')}
                >
                  <FaCheck /> Approved
                </button>
                <button 
                  className={`comment-tab-btn ${commentTab === 'pending' ? 'active' : ''}`}
                  onClick={() => handleCommentTabChange('pending')}
                >
                  <FaClock /> Pending
                </button>
                <button 
                  className={`comment-tab-btn ${commentTab === 'rejected' ? 'active' : ''}`}
                  onClick={() => handleCommentTabChange('rejected')}
                >
                  <FaTimes /> Rejected
                </button>
                <button 
                  className={`comment-tab-btn ${commentTab === 'author' ? 'active' : ''}`}
                  onClick={() => handleCommentTabChange('author')}
                >
                  <FaCrown /> Author Comments
                </button>
              </div>
              
              {/* Author Comment Form */}
              {commentTab === 'author' && (
                <div className="author-comment-section">
                  <div className="author-comment-header">
                    <h3>Author Comments ({authorCommentPagination.total})</h3>
                    <button 
                      className="btn btn-primary add-author-comment-btn"
                      onClick={() => setShowAuthorCommentForm(!showAuthorCommentForm)}
                    >
                      <FaPlus /> Add Author Comment
                    </button>
                  </div>
                  
                  {showAuthorCommentForm && (
                    <form onSubmit={handleAddAuthorComment} className="author-comment-form">
                      <div className="form-group">
                        <textarea
                          value={authorCommentForm.content}
                          onChange={(e) => setAuthorCommentForm(prev => ({ ...prev, content: e.target.value }))}
                          placeholder="Write your author comment here..."
                          rows="4"
                          maxLength="1000"
                          className="author-comment-textarea"
                          disabled={authorCommentForm.isSubmitting}
                        />
                        <div className="character-count">
                          {authorCommentForm.content.length}/1000
                        </div>
                      </div>
                      <div className="form-actions">
                        <button 
                          type="submit" 
                          className="btn btn-success"
                          disabled={authorCommentForm.isSubmitting || !authorCommentForm.content.trim()}
                        >
                          {authorCommentForm.isSubmitting ? 'Adding...' : 'Add Comment'}
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowAuthorCommentForm(false);
                            setAuthorCommentForm({ content: '', isSubmitting: false });
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
              
              {/* Render Comments */}
              {commentTab === 'author' ? (
                // Author Comments
                authorComments.length === 0 ? (
                  renderEmptyState('author comments')
                ) : (
                  <>
                    <div className="comments-list admin-comments author-comments-list">
                      {authorComments.map(comment => (
                        <div className="comment-card admin-comment author-comment-card" key={comment._id}>
                          <div className="comment-header">
                            <div className="comment-user-info">
                              <div className="author-badge">
                                <FaCrown /> <strong>{comment.user.name}</strong> <span className="author-tag">Author</span>
                              </div>
                              <a href={`mailto:${comment.user.email}`}>{comment.user.email}</a>
                            </div>
                            <span className="comment-date">{formatDate(comment.createdAt)}</span>
                          </div>
                          <div className="comment-content">{comment.content}</div>
                          
                          {/* Comment Reactions */}
                          {renderCommentReactions(comment._id)}
                          
                          {/* Comment Replies */}
                          {renderCommentReplies(comment._id, comment)}
                          
                          <div className="comment-actions">
                            <button 
                              className="btn btn-sm btn-delete author-delete-btn"
                              onClick={() => deleteAuthorComment(comment._id)}
                              title="Delete author comment"
                            >
                              <FaTrash /> Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Author Comment pagination */}
                    {authorCommentPagination.pages > 1 && (
                      <div className="pagination">
                        <button
                          onClick={() => handleCommentPageChange(authorCommentPagination.page - 1)}
                          disabled={authorCommentPagination.page === 1}
                          className="pagination-btn"
                        >
                          Previous
                        </button>
                        
                        {[...Array(authorCommentPagination.pages).keys()].map(number => (
                          <button
                            key={number + 1}
                            onClick={() => handleCommentPageChange(number + 1)}
                            className={`pagination-btn ${authorCommentPagination.page === number + 1 ? 'active' : ''}`}
                          >
                            {number + 1}
                          </button>
                        ))}
                        
                        <button
                          onClick={() => handleCommentPageChange(authorCommentPagination.page + 1)}
                          disabled={authorCommentPagination.page === authorCommentPagination.pages}
                          className="pagination-btn"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )
              ) : (
                // Regular Comments
                comments[commentTab].length === 0 ? (
                  renderEmptyState(`${commentTab} comments`)
                ) : (
                  <>
                    <div className="comments-list admin-comments">
                      {comments[commentTab].map(comment => (
                        <div className="comment-card admin-comment" key={comment._id}>
                          <div className="comment-header">
                            <div className="comment-user-info">
                              <strong>{comment.user.name}</strong>
                              <a href={`mailto:${comment.user.email}`}>{comment.user.email}</a>
                            </div>
                            <span className="comment-date">{formatDate(comment.createdAt)}</span>
                          </div>
                          <div className="comment-content">{comment.content}</div>
                          
                          {/* Comment Reactions */}
                          {renderCommentReactions(comment._id)}
                          
                          {/* Comment Replies */}
                          {renderCommentReplies(comment._id, comment)}
                          
                          <div className="comment-actions">
                            {commentTab !== 'approved' && (
                              <button 
                                className="btn btn-sm btn-approve"
                                onClick={() => updateCommentStatus(comment._id, 'approved')}
                                title="Approve comment"
                              >
                                <FaCheck /> Approve
                              </button>
                            )}
                            {commentTab !== 'pending' && (
                              <button 
                                className="btn btn-sm btn-pending"
                                onClick={() => updateCommentStatus(comment._id, 'pending')}
                                title="Mark as pending"
                              >
                                <FaClock /> Pending
                              </button>
                            )}
                            {commentTab !== 'rejected' && (
                              <button 
                                className="btn btn-sm btn-reject"
                                onClick={() => updateCommentStatus(comment._id, 'rejected')}
                                title="Reject comment"
                              >
                                <FaTimes /> Reject
                              </button>
                            )}
                            <button 
                              className="btn btn-sm btn-delete"
                              onClick={() => deleteComment(comment._id)}
                              title="Delete comment"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Comment pagination */}
                    {commentPagination.pages > 1 && (
                      <div className="pagination">
                        <button
                          onClick={() => handleCommentPageChange(commentPagination.page - 1)}
                          disabled={commentPagination.page === 1}
                          className="pagination-btn"
                        >
                          Previous
                        </button>
                        
                        {[...Array(commentPagination.pages).keys()].map(number => (
                          <button
                            key={number + 1}
                            onClick={() => handleCommentPageChange(number + 1)}
                            className={`pagination-btn ${commentPagination.page === number + 1 ? 'active' : ''}`}
                          >
                            {number + 1}
                          </button>
                        ))}
                        
                        <button
                          onClick={() => handleCommentPageChange(commentPagination.page + 1)}
                          disabled={commentPagination.page === commentPagination.pages}
                          className="pagination-btn"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BlogAnalytics;