// src/components/BlogAnalytics.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaThumbsUp, FaThumbsDown, FaCommentAlt, FaCheck, FaTimes, FaClock } from 'react-icons/fa';
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
      // Fetch reactions
      const token = localStorage.getItem('token');
      const reactionsResponse = await axios.get(
       
        `http://localhost:5000/api/admin/blogs/${blogId}/reactions`,
        {
            withCredentials: true, // Still try to send cookies
            headers: {
              Authorization: token ? `Bearer ${token}` : '' // Also send token in header
            }
          }
       
      );
      
      setReactions({
        counts: reactionsResponse.data.counts,
        reactionsList: reactionsResponse.data.reactions
      });
      
      // Fetch approved comments
      await fetchCommentsByStatus('approved');
      
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
        `http://localhost:5000/api/admin/blogs/${blogId}/comments`,
        { 
          params: { status, page, limit: 10 },
          withCredentials: true ,
          // Still try to send cookies
            headers: {
              Authorization: token ? `Bearer ${token}` : '' // Also send token in header
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
      
    } catch (err) {
      console.error(`Error fetching ${status} comments:`, err);
      setError(err.response?.data?.message || `Failed to load ${status} comments`);
    }
  };
  
  // Change comments tab
  const handleCommentTabChange = (status) => {
    setCommentTab(status);
    fetchCommentsByStatus(status);
  };
  
  // Handle comment pagination
  const handleCommentPageChange = (newPage) => {
    fetchCommentsByStatus(commentTab, newPage);
  };
  
  // Update comment status
  const updateCommentStatus = async (commentId, newStatus) => {
    try {
        const token = localStorage.getItem('token');
      await axios.patch(
        `http://localhost:5000/api/admin/comments/${commentId}`,
        { status: newStatus },
        {
            withCredentials: true, // Still try to send cookies
            headers: {
              Authorization: token ? `Bearer ${token}` : '' // Also send token in header
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
        `http://localhost:5000/api/admin/comments/${commentId}`,
        {
            withCredentials: true, // Still try to send cookies
            headers: {
              Authorization: token ? `Bearer ${token}` : '' // Also send token in header
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
              </div>
              
              {comments[commentTab].length === 0 ? (
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BlogAnalytics;