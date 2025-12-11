// src/components/BlogAnalytics.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaThumbsUp, FaThumbsDown, FaCommentAlt, FaCheck, FaTimes, FaClock, FaCrown, FaPlus, FaTrash, FaReply, FaHeart, FaHeartBroken, FaFlag, FaChartBar, FaEye, FaExclamationTriangle, FaUsers, FaBook, FaFireAlt, FaUserFriends, FaCalendarAlt, FaChartLine } from 'react-icons/fa';
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
  
  // Reports state
  const [reports, setReports] = useState({
    list: [],
    total: 0,
    blogTitle: '',
    blogSlug: ''
  });
  
  // Statistics state
  const [stats, setStats] = useState({
    totalReads: 0,
    uniqueReaders: 0,
    totalReports: 0,
    likes: 0,
    dislikes: 0,
    commentsCount: 0,
    status: '',
    author: null,
    publishedAt: null,
    createdAt: null
  });

  // NEW: Read Statistics state
  const [readStats, setReadStats] = useState({
    totalReads: 0,
    uniqueReaders: 0,
    averageReadsPerReader: 0,
    topReaders: [],
    recentReadsLast30Days: 0
  });

  // NEW: Summary Generation state
  const [summaryGeneration, setSummaryGeneration] = useState({
    currentSummary: '',
    isGenerating: false,
    generatedSummary: '',
    wordCount: 0,
    targetWordLimit: 300
  });

  // NEW: Content Images state
  const [contentImages, setContentImages] = useState([]);
  
  // NEW: Content Videos state
  const [contentVideos, setContentVideos] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('stats');
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
        `http://localhost:5000/api/admin/blogs/${blogId}/reactions`,
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
      // Fetch reports
      await fetchReports();
      // Fetch statistics
      await fetchStatistics();
      // NEW: Fetch read statistics
      await fetchReadStatistics();
      // NEW: Fetch content images
      await fetchContentImages();
      // NEW: Fetch content videos
      await fetchContentVideos();
      
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch reports
  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/blogs/${blogId}/reports`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      setReports({
        list: response.data.reports || [],
        total: response.data.totalReports || 0,
        blogTitle: response.data.title,
        blogSlug: response.data.slug
      });
      
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };
  
  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/blogs/${blogId}/stats`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      setStats({
        totalReads: response.data.stats.totalReads || 0,
        uniqueReaders: response.data.stats.uniqueReaders || 0,
        totalReports: response.data.stats.totalReports || 0,
        likes: response.data.stats.likes || 0,
        dislikes: response.data.stats.dislikes || 0,
        commentsCount: response.data.stats.commentsCount || 0,
        status: response.data.status,
        author: response.data.author,
        publishedAt: response.data.publishedAt,
        createdAt: response.data.createdAt
      });
      
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  // NEW: Fetch read statistics
  const fetchReadStatistics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/admin/blogs/${blogId}/read-stats`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      setReadStats({
        totalReads: response.data.readStats.totalReads || 0,
        uniqueReaders: response.data.readStats.uniqueReaders || 0,
        averageReadsPerReader: response.data.readStats.averageReadsPerReader || 0,
        topReaders: response.data.readStats.topReaders || [],
        recentReadsLast30Days: response.data.readStats.recentReadsLast30Days || 0
      });
      
    } catch (err) {
      console.error('Error fetching read statistics:', err);
    }
  };

  // NEW: Fetch content images
  const fetchContentImages = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/blogs/${blogId}/images`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      setContentImages(response.data.images || []);
      
    } catch (err) {
      console.error('Error fetching content images:', err);
    }
  };

  // NEW: Fetch content videos
  const fetchContentVideos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/blogs/${blogId}/videos`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      setContentVideos(response.data.videos || []);
      
    } catch (err) {
      console.error('Error fetching content videos:', err);
    }
  };

  // NEW: Generate Summary
  const handleGenerateSummary = async () => {
    setSummaryGeneration(prev => ({ ...prev, isGenerating: true }));
    
    try {
      const response = await axios.post(
        `http://localhost:5000/api/blogs/${blogId}/generate-summary`,
        {
          wordLimit: summaryGeneration.targetWordLimit,
          temperature: 0.7
        }
      );
      
      setSummaryGeneration(prev => ({
        ...prev,
        generatedSummary: response.data.summary,
        wordCount: response.data.wordCount,
        isGenerating: false
      }));
      
      alert('Summary generated successfully!');
      
    } catch (err) {
      console.error('Error generating summary:', err);
      alert(err.response?.data?.message || 'Failed to generate summary');
      setSummaryGeneration(prev => ({ ...prev, isGenerating: false }));
    }
  };

  // NEW: Update Summary
  const handleUpdateSummary = async () => {
    if (!summaryGeneration.generatedSummary.trim()) {
      alert('No summary to update');
      return;
    }
    
    try {
      await axios.put(
        `http://localhost:5000/api/blogs/${blogId}/update-summary`,
        {
          summary: summaryGeneration.generatedSummary,
          replaceExisting: true
        }
      );
      
      alert('Summary updated successfully!');
      setSummaryGeneration(prev => ({
        ...prev,
        currentSummary: prev.generatedSummary,
        generatedSummary: ''
      }));
      
    } catch (err) {
      console.error('Error updating summary:', err);
      alert(err.response?.data?.message || 'Failed to update summary');
    }
  };

  // NEW: Auto-generate and update summary
  const handleAutoSummary = async () => {
    if (!window.confirm('This will automatically generate and update the blog summary. Continue?')) {
      return;
    }
    
    setSummaryGeneration(prev => ({ ...prev, isGenerating: true }));
    
    try {
      const response = await axios.post(
        `http://localhost:5000/api/blogs/${blogId}/auto-summary`,
        {
          wordLimit: summaryGeneration.targetWordLimit,
          forceUpdate: true,
          temperature: 0.7
        }
      );
      
      setSummaryGeneration(prev => ({
        ...prev,
        currentSummary: response.data.blog.summary,
        generatedSummary: '',
        wordCount: response.data.blog.summaryWordCount,
        isGenerating: false
      }));
      
      alert('Summary generated and updated successfully!');
      
    } catch (err) {
      console.error('Error auto-generating summary:', err);
      alert(err.response?.data?.message || 'Failed to auto-generate summary');
      setSummaryGeneration(prev => ({ ...prev, isGenerating: false }));
    }
  };
  
  // Delete a specific report
  const deleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `http://localhost:5000/api/blogs/${blogId}/reports/${reportId}`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      // Refresh reports and statistics
      await fetchReports();
      await fetchStatistics();
      
    } catch (err) {
      console.error('Error deleting report:', err);
      alert(err.response?.data?.message || 'Failed to delete report');
    }
  };
  
  // Clear all reports
  const clearAllReports = async () => {
    if (!window.confirm('Are you sure you want to clear ALL reports for this blog? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `http://localhost:5000/api/blogs/${blogId}/reports`,
        {
          withCredentials: true,
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      );
      
      // Refresh reports and statistics
      await fetchReports();
      await fetchStatistics();
      
    } catch (err) {
      console.error('Error clearing reports:', err);
      alert(err.response?.data?.message || 'Failed to clear reports');
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
        `http://localhost:5000/api/blogs/${blogId}/author-comments`,
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
        axios.get(`http://localhost:5000/api/comments/${commentId}/reactions/count`),
        axios.get(`http://localhost:5000/api/comments/${commentId}/reactions/user`, {
          params: { email: 'admin@example.com' }
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
        `http://localhost:5000/api/comments/${commentId}/replies`
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
        `http://localhost:5000/api/comments/${commentId}/reactions`,
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
        `http://localhost:5000/api/comments/${commentId}/author-reply`,
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
        `http://localhost:5000/api/blogs/${blogId}/author-comment`,
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
        `http://localhost:5000/api/author-comments/${commentId}`,
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
        `http://localhost:5000/api/admin/comments/${commentId}`,
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
        `http://localhost:5000/api/admin/comments/${commentId}`,
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
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <FaChartBar /> Statistics
        </button>
        <button 
          className={`tab-btn ${activeTab === 'readstats' ? 'active' : ''}`}
          onClick={() => setActiveTab('readstats')}
        >
          <FaEye /> Read Analytics
        </button>
        <button 
          className={`tab-btn ${activeTab === 'reactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('reactions')}
        >
          <FaThumbsUp /> Reactions
        </button>
        <button className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          <FaCommentAlt /> Comments
        </button>
        <button 
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <FaFlag /> Reports {reports.total > 0 && <span className="badge-count">{reports.total}</span>}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <FaBook /> AI Summary
        </button>
        <button 
          className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`}
          onClick={() => setActiveTab('media')}
        >
          <FaFireAlt /> Media
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
          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <div className="statistics-analytics">
              <h3>Blog Statistics Overview</h3>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">
                    <FaEye />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.totalReads}</div>
                    <div className="stat-label">Total Reads</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <FaUsers />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.uniqueReaders}</div>
                    <div className="stat-label">Unique Readers</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">
                    <FaThumbsUp />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.likes}</div>
                    <div className="stat-label">Likes</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">
                    <FaThumbsDown />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.dislikes}</div>
                    <div className="stat-label">Dislikes</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">
                    <FaCommentAlt />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.commentsCount}</div>
                    <div className="stat-label">Comments</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">
                    <FaFlag />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.totalReports}</div>
                    <div className="stat-label">Reports</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon">
                    <FaCheck />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.status}</div>
                    <div className="stat-label">Status</div>
                  </div>
                </div>
              </div>
              
              {stats.author && (
                <div className="stats-metadata">
                  <h4>Blog Metadata</h4>
                  <div className="metadata-grid">
                    <div className="metadata-item">
                      <strong>Author:</strong> {stats.author.name} ({stats.author.email})
                    </div>
                    {stats.publishedAt && (
                      <div className="metadata-item">
                        <strong>Published:</strong> {formatDate(stats.publishedAt)}
                      </div>
                    )}
                    <div className="metadata-item">
                      <strong>Created:</strong> {formatDate(stats.createdAt)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NEW: Read Statistics Tab */}
          {activeTab === 'readstats' && (
            <div className="read-statistics-analytics">
              <h3>Detailed Read Analytics</h3>
              
              <div className="stats-grid">
                <div className="stat-card stat-card-large">
                  <div className="stat-icon">
                    <FaEye />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{readStats.totalReads}</div>
                    <div className="stat-label">Total Reads</div>
                    <div className="stat-description">All-time page views</div>
                  </div>
                </div>

                <div className="stat-card stat-card-large">
                  <div className="stat-icon">
                    <FaUserFriends />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{readStats.uniqueReaders}</div>
                    <div className="stat-label">Unique Readers</div>
                    <div className="stat-description">Distinct visitors</div>
                  </div>
                </div>

                <div className="stat-card stat-card-large">
                  <div className="stat-icon">
                    <FaChartLine />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{readStats.averageReadsPerReader}</div>
                    <div className="stat-label">Avg Reads/Reader</div>
                    <div className="stat-description">Engagement metric</div>
                  </div>
                </div>

                <div className="stat-card stat-card-large">
                  <div className="stat-icon">
                    <FaCalendarAlt />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{readStats.recentReadsLast30Days}</div>
                    <div className="stat-label">Last 30 Days</div>
                    <div className="stat-description">Recent activity</div>
                  </div>
                </div>
              </div>

              {/* Top Readers Section */}
              {readStats.topReaders && readStats.topReaders.length > 0 && (
                <div className="top-readers-section">
                  <h4>Top 10 Most Engaged Readers</h4>
                  <div className="top-readers-table-container">
                    <table className="top-readers-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Read Count</th>
                          <th>Last Read</th>
                          <th>Engagement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readStats.topReaders.map((reader, index) => (
                          <tr key={index}>
                            <td>
                              <span className={`rank-badge rank-${reader.rank}`}>
                                #{reader.rank}
                              </span>
                            </td>
                            <td>
                              <strong>{reader.readCount}</strong> reads
                            </td>
                            <td>{formatDate(reader.lastReadAt)}</td>
                            <td>
                              <div className="engagement-bar">
                                <div 
                                  className="engagement-fill"
                                  style={{ 
                                    width: `${(reader.readCount / readStats.topReaders[0].readCount) * 100}%` 
                                  }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NEW: AI Summary Tab */}
          {activeTab === 'summary' && (
            <div className="summary-analytics">
              <h3>AI-Powered Summary Generation</h3>
              
              <div className="summary-controls">
                <div className="form-group">
                  <label htmlFor="wordLimit">Target Word Limit:</label>
                  <input
                    type="number"
                    id="wordLimit"
                    min="100"
                    max="500"
                    value={summaryGeneration.targetWordLimit}
                    onChange={(e) => setSummaryGeneration(prev => ({
                      ...prev,
                      targetWordLimit: parseInt(e.target.value) || 300
                    }))}
                    className="word-limit-input"
                  />
                </div>

                <div className="summary-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerateSummary}
                    disabled={summaryGeneration.isGenerating}
                  >
                    {summaryGeneration.isGenerating ? (
                      <>
                        <span className="spinner-small"></span> Generating...
                      </>
                    ) : (
                      <>
                        <FaBook /> Generate Summary
                      </>
                    )}
                  </button>

                  <button
                    className="btn btn-success"
                    onClick={handleAutoSummary}
                    disabled={summaryGeneration.isGenerating}
                  >
                    {summaryGeneration.isGenerating ? (
                      <>
                        <span className="spinner-small"></span> Processing...
                      </>
                    ) : (
                      <>
                        <FaCheck /> Auto Generate & Update
                      </>
                    )}
                  </button>
                </div>
              </div>

              {summaryGeneration.generatedSummary && (
                <div className="generated-summary-section">
                  <h4>Generated Summary ({summaryGeneration.wordCount} words)</h4>
                  <div className="summary-preview">
                    {summaryGeneration.generatedSummary}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleUpdateSummary}
                  >
                    <FaCheck /> Update Blog Summary
                  </button>
                </div>
              )}

              <div className="summary-info">
                <div className="info-card">
                  <FaExclamationTriangle className="info-icon" />
                  <div className="info-content">
                    <h5>How It Works</h5>
                    <ul>
                      <li><strong>Generate Summary:</strong> Creates a new summary without saving</li>
                      <li><strong>Auto Generate & Update:</strong> Generates and immediately updates the blog</li>
                      <li><strong>Update Blog Summary:</strong> Saves the generated summary to your blog</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NEW: Media Tab */}
          {activeTab === 'media' && (
            <div className="media-analytics">
              <h3>Blog Media Content</h3>

              {/* Content Images Section */}
              <div className="media-section">
                <div className="media-section-header">
                  <h4>Content Images ({contentImages.length})</h4>
                </div>
                
                {contentImages.length === 0 ? (
                  renderEmptyState('content images')
                ) : (
                  <div className="media-grid">
                    {contentImages.map((image, index) => (
                      <div key={image.imageId || index} className="media-card">
                        <div className="media-thumbnail">
                          <img 
                            src={image.url} 
                            alt={image.alt || 'Content image'} 
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/300x200?text=Image+Error';
                            }}
                          />
                        </div>
                        <div className="media-info">
                          <div className="media-id">
                            <code>[IMAGE:{image.imageId}]</code>
                          </div>
                          {image.alt && (
                            <div className="media-detail">
                              <strong>Alt:</strong> {image.alt}
                            </div>
                          )}
                          {image.caption && (
                            <div className="media-detail">
                              <strong>Caption:</strong> {image.caption}
                            </div>
                          )}
                          <div className="media-detail">
                            <strong>Position:</strong> 
                            <span className={`position-badge ${image.position}`}>
                              {image.position}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Content Videos Section */}
              <div className="media-section">
                <div className="media-section-header">
                  <h4>Content Videos ({contentVideos.length})</h4>
                </div>
                
                {contentVideos.length === 0 ? (
                  renderEmptyState('content videos')
                ) : (
                  <div className="media-grid">
                    {contentVideos.map((video, index) => (
                      <div key={video.embedId || index} className="media-card">
                        <div className="media-thumbnail video-thumbnail">
                          {video.platform === 'youtube' && (
                            <img
                              src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
                              alt={video.title || 'Video thumbnail'}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/300x200?text=Video';
                              }}
                            />
                          )}
                          {video.platform === 'vimeo' && (
                            <div className="video-platform-badge">
                              Vimeo Video
                            </div>
                          )}
                          {video.platform === 'dailymotion' && (
                            <img
                              src={`https://www.dailymotion.com/thumbnail/video/${video.videoId}`}
                              alt={video.title || 'Video thumbnail'}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/300x200?text=Video';
                              }}
                            />
                          )}
                          <span className={`platform-badge ${video.platform}`}>
                            {video.platform}
                          </span>
                        </div>
                        <div className="media-info">
                          <div className="media-id">
                            <code>[VIDEO:{video.embedId}]</code>
                          </div>
                          {video.title && (
                            <div className="media-detail">
                              <strong>Title:</strong> {video.title}
                            </div>
                          )}
                          {video.caption && (
                            <div className="media-detail">
                              <strong>Caption:</strong> {video.caption}
                            </div>
                          )}
                          <div className="media-detail">
                            <strong>Position:</strong> 
                            <span className={`position-badge ${video.position}`}>
                              {video.position}
                            </span>
                          </div>
                          <div className="media-detail">
                            <strong>Settings:</strong>
                            <div className="video-settings">
                              <span className={`setting-badge ${video.autoplay ? 'active' : ''}`}>
                                Autoplay: {video.autoplay ? 'On' : 'Off'}
                              </span>
                              <span className={`setting-badge ${video.muted ? 'active' : ''}`}>
                                Muted: {video.muted ? 'On' : 'Off'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="reports-analytics">
              <div className="reports-header">
                <h3>Blog Reports ({reports.total})</h3>
                {reports.total > 0 && (
                  <button 
                    className="img-edt-btn"
                    onClick={clearAllReports}
                  >
                    <FaTrash /> Clear All Reports
                  </button>
                )}
              </div>
              
              {reports.list.length === 0 ? (
                renderEmptyState('reports')
              ) : (
                <div className="reports-list">
                  {reports.list.map(report => (
                    <div key={report._id} className="report-card">
                      <div className="report-header">
                        <div className="report-user-info">
                          <FaExclamationTriangle className="report-icon" />
                          <a href={`mailto:${report.userEmail}`}>{report.userEmail}</a>
                        </div>
                        <span className="report-date">{formatDate(report.timestamp)}</span>
                      </div>
                      
                      <div className="report-reason">
                        <strong>Reason:</strong> 
                        <p className="reason-text">{report.reason}</p>
                      </div>
                      
                      <div className="report-actions">
                        <button 
                          className="img-edt-btn"
                          onClick={() => deleteReport(report._id)}
                          title="Delete this report"
                        >
                          <FaTrash /> Delete Report
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Reactions Tab */}
          {activeTab === 'reactions' && (
            <div className="reactions-analytics">
              <div className="analytics-summary">
                <div className='blog-summary-card'>
                  <h3>
                    <p className="summary-stat">{reactions.counts.likes} <FaThumbsUp /> Likes</p>
                    <p className="summary-stat">{reactions.counts.dislikes} <FaThumbsDown /> Dislikes</p>
                    <p className="summary-stat">{reactions.counts.total} <FaCommentAlt /> Total</p>
                  </h3>
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
          
          {/* Comments Tab */}
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
                      className="add-author-comment-btn1"
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
                                className="img-edt-btn"
                                onClick={() => updateCommentStatus(comment._id, 'approved')}
                                title="Approve comment"
                              >
                                <FaCheck /> Approve
                              </button>
                            )}
                            {commentTab !== 'pending' && (
                              <button 
                                className="img-edt-btn"
                                onClick={() => updateCommentStatus(comment._id, 'pending')}
                                title="Mark as pending"
                              >
                                <FaClock /> Pending
                              </button>
                            )}
                            {commentTab !== 'rejected' && (
                              <button 
                                className="img-edt-btn"
                                onClick={() => updateCommentStatus(comment._id, 'rejected')}
                                title="Reject comment"
                              >
                                <FaTimes /> Reject
                              </button>
                            )}
                            <button 
                              className="img-dlt-btn"
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