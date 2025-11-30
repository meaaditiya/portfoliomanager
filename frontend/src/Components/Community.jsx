import React, { useState, useEffect } from 'react';
import './Community.css';

const AdminCommunity = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [postTypeFilter, setPostTypeFilter] = useState('');
  const [selectedPosts, setSelectedPosts] = useState([]); // For bulk delete
  const [showComments, setShowComments] = useState({}); // Track comment visibility per post

  // Form state
  const [formData, setFormData] = useState({
    postType: 'image',
    description: '',
    caption: '',
    pollOptions: ['', ''],
    pollExpiresAt: '',
    quizQuestions: [{ question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' }],
    linkUrl: '',
    linkTitle: '',
    linkDescription: ''
  });

  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const API_BASE = 'https://connectwithaaditiyamg2.onrender.com/api'; // Adjust as needed

  const getToken = () => localStorage.getItem('token');

  const apiCall = async (url, options = {}) => {
    const token = getToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  };

  // Fetch posts
  const fetchPosts = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '10' });
      if (postTypeFilter) params.append('postType', postTypeFilter);

      const data = await apiCall(`/community/posts?${params}`);
      setPosts(data.posts);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (error) {
      setError('Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch comments for a post
  const fetchComments = async (postId) => {
    try {
      const data = await apiCall(`/community/posts/${postId}/comments`);
      return data.comments;
    } catch (error) {
      setError('Failed to fetch comments');
      return [];
    }
  };

  // Create post
  const createPost = async () => {
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('postType', formData.postType);
      if (formData.description) formDataToSend.append('description', formData.description);

      if (formData.postType === 'image' && selectedImages.length > 0) {
        selectedImages.forEach(image => formDataToSend.append('images', image));
      } else if (formData.postType === 'image') {
        throw new Error('At least one image is required');
      }

      if (formData.postType === 'video' && selectedVideo) {
        formDataToSend.append('video', selectedVideo);
        if (formData.caption) formDataToSend.append('caption', formData.caption);
      } else if (formData.postType === 'video') {
        throw new Error('A video is required');
      }

      if (formData.postType === 'poll') {
        const validOptions = formData.pollOptions.filter(opt => opt.trim());
        if (validOptions.length < 2) throw new Error('At least 2 poll options are required');
        formDataToSend.append('pollOptions', JSON.stringify(validOptions));
        if (formData.pollExpiresAt) formDataToSend.append('pollExpiresAt', formData.pollExpiresAt);
      }

      if (formData.postType === 'quiz') {
        if (formData.quizQuestions.length === 0) throw new Error('At least one quiz question is required');
        formDataToSend.append('quizQuestions', JSON.stringify(formData.quizQuestions));
      }

      if (formData.postType === 'link') {
        if (!formData.linkUrl) throw new Error('Link URL is required');
        formDataToSend.append('linkUrl', formData.linkUrl);
        if (formData.linkTitle) formDataToSend.append('linkTitle', formData.linkTitle);
        if (formData.linkDescription) formDataToSend.append('linkDescription', formData.linkDescription);
      }

      await apiCall('/community/posts', { method: 'POST', body: formDataToSend });
      setSuccess('Post created successfully!');
      setShowCreateForm(false);
      resetForm();
      fetchPosts();
    } catch (error) {
      setError(error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  // Update post
  const updatePost = async () => {
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('description', formData.description || '');

      if (formData.postType === 'image' && selectedImages.length > 0) {
        selectedImages.forEach(image => formDataToSend.append('images', image));
      }

      if (formData.postType === 'video' && selectedVideo) {
        formDataToSend.append('video', selectedVideo);
      }
      formDataToSend.append('caption', formData.caption || '');

      if (formData.postType === 'poll') {
        const validOptions = formData.pollOptions.filter(opt => opt.trim());
        if (validOptions.length >= 2) {
          formDataToSend.append('pollOptions', JSON.stringify(validOptions));
        }
        if (formData.pollExpiresAt) formDataToSend.append('pollExpiresAt', formData.pollExpiresAt);
      }

      if (formData.postType === 'quiz') {
        formDataToSend.append('quizQuestions', JSON.stringify(formData.quizQuestions));
      }

      if (formData.postType === 'link') {
        formDataToSend.append('linkUrl', formData.linkUrl || '');
        formDataToSend.append('linkTitle', formData.linkTitle || '');
        formDataToSend.append('linkDescription', formData.linkDescription || '');
      }

      await apiCall(`/community/posts/${selectedPost._id}`, { method: 'PUT', body: formDataToSend });
      setSuccess('Post updated successfully!');
      setShowEditForm(false);
      setSelectedPost(null);
      resetForm();
      fetchPosts();
    } catch (error) {
      setError(error.message || 'Failed to update post');
    } finally {
      setLoading(false);
    }
  };

  // Delete post
  const deletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setLoading(true);
    try {
      await apiCall(`/community/posts/${postId}`, { method: 'DELETE' });
      setSuccess('Post deleted successfully!');
      fetchPosts();
    } catch (error) {
      setError('Failed to delete post');
    } finally {
      setLoading(false);
    }
  };

  // Bulk delete posts
  const bulkDeletePosts = async () => {
    if (selectedPosts.length === 0) {
      setError('No posts selected for deletion');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedPosts.length} posts?`)) return;
    setLoading(true);
    try {
      await apiCall('/community/admin/posts/bulk', {
        method: 'DELETE',
        body: JSON.stringify({ postIds: selectedPosts }),
      });
      setSuccess(`Successfully deleted ${selectedPosts.length} posts!`);
      setSelectedPosts([]);
      fetchPosts();
    } catch (error) {
      setError('Failed to bulk delete posts');
    } finally {
      setLoading(false);
    }
  };

  // Delete comment
  const deleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    setLoading(true);
    try {
      await apiCall(`/community/admin/comments/${commentId}`, { method: 'DELETE' });
      setSuccess('Comment deleted successfully!');
      setShowComments({});
      fetchPosts();
    } catch (error) {
      setError('Failed to delete comment');
    } finally {
      setLoading(false);
    }
  };

  // Toggle post selection for bulk delete
  const togglePostSelection = (postId) => {
    setSelectedPosts((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      postType: 'image',
      description: '',
      caption: '',
      pollOptions: ['', ''],
      pollExpiresAt: '',
      quizQuestions: [{ question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' }],
      linkUrl: '',
      linkTitle: '',
      linkDescription: '',
    });
    setSelectedImages([]);
    setSelectedVideo(null);
    setError('');
    setSuccess('');
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle poll options
  const updatePollOption = (index, value) => {
    const newOptions = [...formData.pollOptions];
    newOptions[index] = value;
    setFormData((prev) => ({ ...prev, pollOptions: newOptions }));
  };

  const addPollOption = () => {
    setFormData((prev) => ({ ...prev, pollOptions: [...prev.pollOptions, ''] }));
  };

  const removePollOption = (index) => {
    if (formData.pollOptions.length > 2) {
      const newOptions = formData.pollOptions.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, pollOptions: newOptions }));
    }
  };

  // Handle quiz questions
  const updateQuizQuestion = (questionIndex, field, value) => {
    const newQuestions = [...formData.quizQuestions];
    newQuestions[questionIndex] = { ...newQuestions[questionIndex], [field]: value };
    setFormData((prev) => ({ ...prev, quizQuestions: newQuestions }));
  };

  const updateQuizOption = (questionIndex, optionIndex, value) => {
    const newQuestions = [...formData.quizQuestions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setFormData((prev) => ({ ...prev, quizQuestions: newQuestions }));
  };

  const addQuizQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      quizQuestions: [
        ...prev.quizQuestions,
        { question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' },
      ],
    }));
  };

  const removeQuizQuestion = (index) => {
    if (formData.quizQuestions.length > 1) {
      const newQuestions = formData.quizQuestions.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, quizQuestions: newQuestions }));
    }
  };

  // Handle file selection
  const handleImageSelect = (e) => {
    setSelectedImages(Array.from(e.target.files));
  };

  const handleVideoSelect = (e) => {
    setSelectedVideo(e.target.files[0]);
  };

  // Edit post handler
  const handleEditPost = (post) => {
    setSelectedPost(post);
    setFormData({
      postType: post.postType,
      description: post.description || '',
      caption: post.caption || '',
      pollOptions: post.pollOptions?.map((opt) => opt.option) || ['', ''],
      pollExpiresAt: post.pollExpiresAt ? new Date(post.pollExpiresAt).toISOString().slice(0, 16) : '',
      quizQuestions:
        post.quizQuestions?.length > 0
          ? post.quizQuestions
          : [{ question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' }],
      linkUrl: post.linkUrl || '',
      linkTitle: post.linkTitle || '',
      linkDescription: post.linkDescription || '',
    });
    setSelectedImages([]);
    setSelectedVideo(null);
    setShowEditForm(true);
  };

  // Toggle comments visibility
  const toggleComments = async (postId) => {
    if (showComments[postId]) {
      setShowComments((prev) => ({ ...prev, [postId]: null }));
    } else {
      const comments = await fetchComments(postId);
      setShowComments((prev) => ({ ...prev, [postId]: comments }));
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get post type badge color
  const getPostTypeBadge = (type) => {
    const colors = { image: 'blue', video: 'green', poll: 'purple', quiz: 'orange', link: 'red' };
    return colors[type] || 'gray';
  };

  useEffect(() => {
    fetchPosts();
  }, [postTypeFilter]);

  useEffect(() => {
  if (error || success) {
    const timer = setTimeout(() => {
      setError('');
      setSuccess('');
    }, 3000); // optional delay, e.g., 3 seconds

    return () => clearTimeout(timer); // cleanup
  }
}, [error, success]);


  return (
 <div className="jk-container">
  <div className="jk-header">
    <h1 className="jk-title">Community Management</h1>
    <div className="jk-button-group">
      {selectedPosts.length > 0 && (
        <button
          className="jk-button-delete"
          onClick={bulkDeletePosts}
          disabled={loading}
        >
          Delete Selected ({selectedPosts.length})
        </button>
      )}
      <button
        className="jk-button-create"
        onClick={() => setShowCreateForm(true)}
      >
        Create New Post
      </button>
    </div>
  </div>

  {/* Alerts */}
  {error && <div className="jk-error">{error}</div>}
  {success && <div className="jk-success">{success}</div>}

  {/* Filters */}
  <div className="jk-filter">
    <select
      value={postTypeFilter}
      onChange={(e) => setPostTypeFilter(e.target.value)}
      className="jk-select"
    >
      <option value="">All Post Types</option>
      <option value="image">Image</option>
      <option value="video">Video</option>
      <option value="poll">Poll</option>
      <option value="quiz">Quiz</option>
      <option value="link">Link</option>
    </select>
  </div>

  {/* Posts List */}
  <div className="jk-post-list">
    {loading && <div className="jk-loading">Loading...</div>}
    {posts.map((post) => (
      <div key={post._id} className="jk-post">
        <div className="jk-post-header">
          <div className="jk-post-meta">
            <input
              type="checkbox"
              checked={selectedPosts.includes(post._id)}
              onChange={() => togglePostSelection(post._id)}
              className="jk-checkbox"
            />
            <span className={`jk-badge jk-badge-${getPostTypeBadge(post.postType)}`}>
              {post.postType.toUpperCase()}
            </span>
            <span className="jk-date">{formatDate(post.createdAt)}</span>
          </div>
          <div className="jk-post-actions">
            <button
              className="jk-button-edit"
              onClick={() => handleEditPost(post)}
            >
              Edit
            </button>
            <button
              className="jk-button-delete"
              onClick={() => deletePost(post._id)}
            >
              Delete
            </button>
            <button
              className="jk-button-comments"
              onClick={() => toggleComments(post._id)}
            >
              {showComments[post._id] ? 'Hide Comments' : 'Show Comments'}
            </button>
          </div>
        </div>

        <div className="jk-post-content">
          <p className="jk-text">{post.description}</p>

          {post.postType === 'image' && post.images?.length > 0 && (
            <div className="jk-image-gallery">
              {post.images.map((image, index) => (
                <img
                  key={index}
                  src={`${API_BASE}/community/posts/${post._id}/media/image/${index}`}
                  alt={`Image ${index + 1}`}
                  className="jk-image"
                />
              ))}
            </div>
          )}

          {post.postType === 'video' && post.video && (
            <div className="jk-video-container">
              <video
                src={`${API_BASE}/community/posts/${post._id}/media/video/0`}
                controls
                className="jk-video"
              />
              {post.caption && <p className="jk-caption">{post.caption}</p>}
            </div>
          )}

          {post.postType === 'poll' && (
            <div className="jk-poll">
              <h4 className="jk-poll-title">Poll Options:</h4>
              {post.pollOptions.map((option, index) => (
                <div key={index} className="jk-poll-option">
                  <span>{option.option}</span>
                  <span>({option.votes.length} votes)</span>
                </div>
              ))}
              {post.pollExpiresAt && (
                <p className="jk-poll-expiry">Expires: {formatDate(post.pollExpiresAt)}</p>
              )}
            </div>
          )}

          {post.postType === 'quiz' && (
            <div className="jk-quiz">
              <h4 className="jk-quiz-title">Quiz Questions: {post.quizQuestions.length}</h4>
              {post.quizQuestions.map((q, index) => (
                <div key={index} className="jk-quiz-question">
                  <p className="jk-question">{q.question}</p>
                  {q.options.map((opt, i) => (
                    <p key={i} className={i === q.correctAnswer ? 'jk-correct-answer' : 'jk-option'}>
                      {i + 1}. {opt}
                    </p>
                  ))}
                  <p className="jk-explanation">Explanation: {q.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {post.postType === 'link' && (
            <div className="jk-link">
              <h4 className="jk-link-title">{post.linkTitle}</h4>
              <p className="jk-link-description">{post.linkDescription}</p>
              <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="jk-link-url">
                {post.linkUrl}
              </a>
            </div>
          )}
        </div>

        <div className="jk-post-stats">
          <span>Likes: {post.likes.length}</span>
          <span>Comments: {post.comments.length}</span>
          <span>Shares: {post.shares.length}</span>
        </div>

        {/* Comments Section */}
        {showComments[post._id] && (
          <div className="jk-comments">
            <h4 className="jk-comments-title">Comments:</h4>
            {showComments[post._id].length === 0 ? (
              <p className="jk-no-comments">No comments</p>
            ) : (
              showComments[post._id].map((comment) => (
                <div key={comment._id} className="jk-comment">
                  <div className="jk-comment-content">
                    <div>
                      <p className="jk-comment-user">{comment.userName}</p>
                      <p className="jk-comment-text">{comment.comment}</p>
                      <p className="jk-comment-date">{formatDate(comment.createdAt)}</p>
                      {comment.replies?.length > 0 && (
                        <div className="jk-replies">
                          {comment.replies.map((reply) => (
                            <div key={reply._id} className="jk-reply">
                              <p className="jk-reply-user">{reply.userName}</p>
                              <p className="jk-reply-text">{reply.comment}</p>
                              <p className="jk-reply-date">{formatDate(reply.createdAt)}</p>
                              <button
                                className="jk-button-delete-reply"
                                onClick={() => deleteComment(reply._id)}
                              >
                                Delete Reply
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="jk-button-delete-comment"
                      onClick={() => deleteComment(comment._id)}
                    >
                      Delete Comment
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    ))}
  </div>

  {/* Pagination */}
  {totalPages > 1 && (
    <div className="jk-pagination">
      <button
        onClick={() => fetchPosts(currentPage - 1)}
        disabled={currentPage === 1}
        className="jk-button-prev"
      >
        Previous
      </button>
      <span className="jk-page-info">Page {currentPage} of {totalPages}</span>
      <button
        onClick={() => fetchPosts(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="jk-button-next"
      >
        Next
      </button>
    </div>
  )}

  {/* Create Post Modal */}
  {(showCreateForm || showEditForm) && (
    <div className="jk-modal">
      <div className="jk-modal-content">
        <div className="jk-modal-header">
          <h2 className="jk-modal-title">{showEditForm ? 'Edit Post' : 'Create New Post'}</h2>
          <button
            className="jk-button-close"
            onClick={() => {
              setShowCreateForm(false);
              setShowEditForm(false);
              setSelectedPost(null);
              resetForm();
            }}
          >
            ×
          </button>
        </div>
        <div className="jk-modal-body">
          <PostForm
            formData={formData}
            handleInputChange={handleInputChange}
            updatePollOption={updatePollOption}
            addPollOption={addPollOption}
            removePollOption={removePollOption}
            updateQuizQuestion={updateQuizQuestion}
            updateQuizOption={updateQuizOption}
            addQuizQuestion={addQuizQuestion}
            removeQuizQuestion={removeQuizQuestion}
            handleImageSelect={handleImageSelect}
            handleVideoSelect={handleVideoSelect}
            selectedImages={selectedImages}
            selectedVideo={selectedVideo}
            isEdit={showEditForm}
          />
        </div>
        <div className="jk-modal-footer">
          <button
            className="jk-button-cancel"
            onClick={() => {
              setShowCreateForm(false);
              setShowEditForm(false);
              setSelectedPost(null);
              resetForm();
            }}
          >
            Cancel
          </button>
          <button
            className="jk-button-submit"
            onClick={showEditForm ? updatePost : createPost}
            disabled={loading}
          >
            {loading ? 'Processing...' : showEditForm ? 'Update Post' : 'Create Post'}
          </button>
        </div>
      </div>
    </div>
  )}
</div>
  );
};
// Post Form Component
const PostForm = ({
  formData,
  handleInputChange,
  updatePollOption,
  addPollOption,
  removePollOption,
  updateQuizQuestion,
  updateQuizOption,
  addQuizQuestion,
  removeQuizQuestion,
  handleImageSelect,
  handleVideoSelect,
  selectedImages,
  selectedVideo,
  isEdit = false,
}) => {
  return (
    <div className="jk-form">
      {!isEdit && (
        <div className="jk-form-group">
          <label className="jk-label">Post Type</label>
          <select
            value={formData.postType}
            onChange={(e) => handleInputChange('postType', e.target.value)}
            className="jk-select"
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="poll">Poll</option>
            <option value="quiz">Quiz</option>
            <option value="link">Link</option>
          </select>
        </div>
      )}

      <div className="jk-form-group">
        <label className="jk-label">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          className="jk-textarea"
          rows="3"
        />
      </div>

      {formData.postType === 'image' && (
        <div className="jk-form-group">
          <label className="jk-label">Select Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageSelect}
            className="jk-file-input"
          />
          {selectedImages.length > 0 && (
            <div className="jk-file-list">
              {selectedImages.map((file, index) => (
                <span key={index} className="jk-file-item">{file.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {formData.postType === 'video' && (
        <>
          <div className="jk-form-group">
            <label className="jk-label">Select Video</label>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              className="jk-file-input"
            />
            {selectedVideo && <span className="jk-file-item">{selectedVideo.name}</span>}
          </div>
          <div className="jk-form-group">
            <label className="jk-label">Caption</label>
            <input
              type="text"
              value={formData.caption}
              onChange={(e) => handleInputChange('caption', e.target.value)}
              className="jk-input"
            />
          </div>
        </>
      )}

      {formData.postType === 'poll' && (
        <>
          <div className="jk-form-group">
            <label className="jk-label">Poll Options</label>
            {formData.pollOptions.map((option, index) => (
              <div key={index} className="jk-poll-option-group">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updatePollOption(index, e.target.value)}
                  className="jk-input"
                  placeholder={`Option ${index + 1}`}
                />
                {formData.pollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removePollOption(index)}
                    className="jk-button-remove"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addPollOption}
              className="jk-button-add"
            >
              Add Option
            </button>
          </div>
          <div className="jk-form-group">
            <label className="jk-label">Poll Expiry (Optional)</label>
            <input
              type="datetime-local"
              value={formData.pollExpiresAt}
              onChange={(e) => handleInputChange('pollExpiresAt', e.target.value)}
              className="jk-input"
            />
          </div>
        </>
      )}

      {formData.postType === 'quiz' && (
        <div className="jk-form-group">
          <label className="jk-label">Quiz Questions</label>
          {formData.quizQuestions.map((question, qIndex) => (
            <div key={qIndex} className="jk-quiz-question-group">
              <div className="jk-quiz-question-header">
                <h4 className="jk-question-title">Question {qIndex + 1}</h4>
                {formData.quizQuestions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuizQuestion(qIndex)}
                    className="jk-button-remove"
                  >
                    Remove Question
                  </button>
                )}
              </div>
              <input
                type="text"
                value={question.question}
                onChange={(e) => updateQuizQuestion(qIndex, 'question', e.target.value)}
                className="jk-input"
                placeholder="Question"
              />
              {question.options.map((option, oIndex) => (
                <div key={oIndex} className="jk-quiz-option-group">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateQuizOption(qIndex, oIndex, e.target.value)}
                    className="jk-input"
                    placeholder={`Option ${oIndex + 1}`}
                  />
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={question.correctAnswer === oIndex}
                    onChange={() => updateQuizQuestion(qIndex, 'correctAnswer', oIndex)}
                    className="jk-radio"
                  />
                  <label className="jk-radio-label">Correct</label>
                </div>
              ))}
              <textarea
                value={question.explanation}
                onChange={(e) => updateQuizQuestion(qIndex, 'explanation', e.target.value)}
                className="jk-textarea"
                placeholder="Explanation (optional)"
                rows="2"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addQuizQuestion}
            className="jk-button-add"
          >
            Add Question
          </button>
        </div>
      )}

      {formData.postType === 'link' && (
        <>
          <div className="jk-form-group">
            <label className="jk-label">Link URL</label>
            <input
              type="url"
              value={formData.linkUrl}
              onChange={(e) => handleInputChange('linkUrl', e.target.value)}
              className="jk-input"
              required
            />
          </div>
          <div className="jk-form-group">
            <label className="jk-label">Link Title</label>
            <input
              type="text"
              value={formData.linkTitle}
              onChange={(e) => handleInputChange('linkTitle', e.target.value)}
              className="jk-input"
            />
          </div>
          <div className="jk-form-group">
            <label className="jk-label">Link Description</label>
            <textarea
              value={formData.linkDescription}
              onChange={(e) => handleInputChange('linkDescription', e.target.value)}
              className="jk-textarea"
              rows="2"
            />
          </div>
        </>
      )}
    </div>
  );
};
export default AdminCommunity;