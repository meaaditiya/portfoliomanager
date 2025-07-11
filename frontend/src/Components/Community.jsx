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

  const API_BASE = 'https://connectwithaaditiyamg.onrender.com/api'; // Adjust based on your backend URL

  const getToken = () => {
    return localStorage.getItem('token');
  };

  const apiCall = async (url, options = {}) => {
    const token = getToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
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

  // Create post
  const createPost = async () => {
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('postType', formData.postType);
      formDataToSend.append('description', formData.description);

      if (formData.postType === 'image' && selectedImages.length > 0) {
        selectedImages.forEach(image => {
          formDataToSend.append('images', image);
        });
      }

      if (formData.postType === 'video' && selectedVideo) {
        formDataToSend.append('video', selectedVideo);
        formDataToSend.append('caption', formData.caption);
      }

      if (formData.postType === 'poll') {
        formDataToSend.append('pollOptions', JSON.stringify(formData.pollOptions.filter(opt => opt.trim())));
        if (formData.pollExpiresAt) {
          formDataToSend.append('pollExpiresAt', formData.pollExpiresAt);
        }
      }

      if (formData.postType === 'quiz') {
        formDataToSend.append('quizQuestions', JSON.stringify(formData.quizQuestions));
      }

      if (formData.postType === 'link') {
        formDataToSend.append('linkUrl', formData.linkUrl);
        formDataToSend.append('linkTitle', formData.linkTitle);
        formDataToSend.append('linkDescription', formData.linkDescription);
      }

      await apiCall('/community/posts', {
        method: 'POST',
        body: formDataToSend
      });

      setSuccess('Post created successfully!');
      setShowCreateForm(false);
      resetForm();
      fetchPosts();
    } catch (error) {
      setError('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  // Update post
  const updatePost = async () => {
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('description', formData.description);

      if (formData.postType === 'image' && selectedImages.length > 0) {
        selectedImages.forEach(image => {
          formDataToSend.append('images', image);
        });
      }

      if (formData.postType === 'video' && selectedVideo) {
        formDataToSend.append('video', selectedVideo);
        formDataToSend.append('caption', formData.caption);
      }

      if (formData.postType === 'poll') {
        formDataToSend.append('pollOptions', JSON.stringify(formData.pollOptions.filter(opt => opt.trim())));
        if (formData.pollExpiresAt) {
          formDataToSend.append('pollExpiresAt', formData.pollExpiresAt);
        }
      }

      if (formData.postType === 'quiz') {
        formDataToSend.append('quizQuestions', JSON.stringify(formData.quizQuestions));
      }

      if (formData.postType === 'link') {
        formDataToSend.append('linkUrl', formData.linkUrl);
        formDataToSend.append('linkTitle', formData.linkTitle);
        formDataToSend.append('linkDescription', formData.linkDescription);
      }

      await apiCall(`/community/posts/${selectedPost._id}`, {
        method: 'PUT',
        body: formDataToSend
      });

      setSuccess('Post updated successfully!');
      setShowEditForm(false);
      setSelectedPost(null);
      resetForm();
      fetchPosts();
    } catch (error) {
      setError('Failed to update post');
    } finally {
      setLoading(false);
    }
  };

  // Delete post
  const deletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    setLoading(true);
    try {
      await apiCall(`/community/posts/${postId}`, {
        method: 'DELETE'
      });
      setSuccess('Post deleted successfully!');
      fetchPosts();
    } catch (error) {
      setError('Failed to delete post');
    } finally {
      setLoading(false);
    }
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
      linkDescription: ''
    });
    setSelectedImages([]);
    setSelectedVideo(null);
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle poll options
  const updatePollOption = (index, value) => {
    const newOptions = [...formData.pollOptions];
    newOptions[index] = value;
    setFormData(prev => ({
      ...prev,
      pollOptions: newOptions
    }));
  };

  const addPollOption = () => {
    setFormData(prev => ({
      ...prev,
      pollOptions: [...prev.pollOptions, '']
    }));
  };

  const removePollOption = (index) => {
    if (formData.pollOptions.length > 2) {
      const newOptions = formData.pollOptions.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        pollOptions: newOptions
      }));
    }
  };

  // Handle quiz questions
  const updateQuizQuestion = (questionIndex, field, value) => {
    const newQuestions = [...formData.quizQuestions];
    newQuestions[questionIndex] = {
      ...newQuestions[questionIndex],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      quizQuestions: newQuestions
    }));
  };

  const updateQuizOption = (questionIndex, optionIndex, value) => {
    const newQuestions = [...formData.quizQuestions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setFormData(prev => ({
      ...prev,
      quizQuestions: newQuestions
    }));
  };

  const addQuizQuestion = () => {
    setFormData(prev => ({
      ...prev,
      quizQuestions: [...prev.quizQuestions, { question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' }]
    }));
  };

  const removeQuizQuestion = (index) => {
    if (formData.quizQuestions.length > 1) {
      const newQuestions = formData.quizQuestions.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        quizQuestions: newQuestions
      }));
    }
  };

  // Handle file selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedImages(files);
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    setSelectedVideo(file);
  };

  // Edit post handler
  const handleEditPost = (post) => {
    setSelectedPost(post);
    setFormData({
      postType: post.postType,
      description: post.description,
      caption: post.caption || '',
      pollOptions: post.pollOptions?.map(opt => opt.option) || ['', ''],
      pollExpiresAt: post.pollExpiresAt ? new Date(post.pollExpiresAt).toISOString().slice(0, 16) : '',
      quizQuestions: post.quizQuestions || [{ question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' }],
      linkUrl: post.linkUrl || '',
      linkTitle: post.linkTitle || '',
      linkDescription: post.linkDescription || ''
    });
    setShowEditForm(true);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get post type badge color
  const getPostTypeBadge = (type) => {
    const colors = {
      image: 'blue',
      video: 'green',
      poll: 'purple',
      quiz: 'orange',
      link: 'red'
    };
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
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="tyagi-admin-community">
      <div className="tyagi-header">
        <h1>Community Management</h1>
        <button 
          className="tyagi-btn tyagi-btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          Create New Post
        </button>
      </div>

      {/* Alerts */}
      {error && <div className="tyagi-alert tyagi-alert-error">{error}</div>}
      {success && <div className="tyagi-alert tyagi-alert-success">{success}</div>}

      {/* Filters */}
      <div className="tyagi-filters">
        <select 
          value={postTypeFilter} 
          onChange={(e) => setPostTypeFilter(e.target.value)}
          className="tyagi-filter-select"
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
      <div className="tyagi-posts-container">
        {loading && <div className="tyagi-loading">Loading...</div>}
        
        {posts.map((post) => (
          <div key={post._id} className="tyagi-post-card">
            <div className="tyagi-post-header">
              <div className="tyagi-post-info">
                <span className={`tyagi-post-type-badge tyagi-${getPostTypeBadge(post.postType)}`}>
                  {post.postType.toUpperCase()}
                </span>
                <span className="tyagi-post-date">{formatDate(post.createdAt)}</span>
              </div>
              <div className="tyagi-post-actions">
                <button 
                  className="tyagi-btn tyagi-btn-sm tyagi-btn-secondary"
                  onClick={() => handleEditPost(post)}
                >
                  Edit
                </button>
                <button 
                  className="tyagi-btn tyagi-btn-sm tyagi-btn-danger"
                  onClick={() => deletePost(post._id)}
                >
                  Delete
                </button>
              </div>
            </div>
            
            <div className="tyagi-post-content">
              <p className="tyagi-post-description">{post.description}</p>
              
              {post.postType === 'poll' && (
                <div className="tyagi-poll-preview">
                  <h4>Poll Options:</h4>
                  {post.pollOptions.map((option, index) => (
                    <div key={index} className="tyagi-poll-option">
                      <span>{option.option}</span>
                      <span className="tyagi-vote-count">({option.votes.length} votes)</span>
                    </div>
                  ))}
                  {post.pollExpiresAt && (
                    <p className="tyagi-poll-expiry">Expires: {formatDate(post.pollExpiresAt)}</p>
                  )}
                </div>
              )}

              {post.postType === 'quiz' && (
                <div className="tyagi-quiz-preview">
                  <h4>Quiz Questions: {post.quizQuestions.length}</h4>
                </div>
              )}

              {post.postType === 'link' && (
                <div className="tyagi-link-preview">
                  <h4>{post.linkTitle}</h4>
                  <p>{post.linkDescription}</p>
                  <a href={post.linkUrl} target="_blank" rel="noopener noreferrer">
                    {post.linkUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="tyagi-post-stats">
              <span>Likes: {post.likes.length}</span>
              <span>Comments: {post.comments.length}</span>
              <span>Shares: {post.shares.length}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="tyagi-pagination">
          <button 
            onClick={() => fetchPosts(currentPage - 1)}
            disabled={currentPage === 1}
            className="tyagi-btn tyagi-btn-secondary"
          >
            Previous
          </button>
          <span className="tyagi-page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            onClick={() => fetchPosts(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="tyagi-btn tyagi-btn-secondary"
          >
            Next
          </button>
        </div>
      )}

      {/* Create Post Modal */}
      {showCreateForm && (
        <div className="tyagi-modal-overlay">
          <div className="tyagi-modal">
            <div className="tyagi-modal-header">
              <h2>Create New Post</h2>
              <button 
                className="tyagi-btn tyagi-btn-close"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>
            <div className="tyagi-modal-body">
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
              />
            </div>
            <div className="tyagi-modal-footer">
              <button 
                className="tyagi-btn tyagi-btn-secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button 
                className="tyagi-btn tyagi-btn-primary"
                onClick={createPost}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {showEditForm && selectedPost && (
        <div className="tyagi-modal-overlay">
          <div className="tyagi-modal">
            <div className="tyagi-modal-header">
              <h2>Edit Post</h2>
              <button 
                className="tyagi-btn tyagi-btn-close"
                onClick={() => {
                  setShowEditForm(false);
                  setSelectedPost(null);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>
            <div className="tyagi-modal-body">
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
                isEdit={true}
              />
            </div>
            <div className="tyagi-modal-footer">
              <button 
                className="tyagi-btn tyagi-btn-secondary"
                onClick={() => {
                  setShowEditForm(false);
                  setSelectedPost(null);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button 
                className="tyagi-btn tyagi-btn-primary"
                onClick={updatePost}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Post'}
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
  isEdit = false
}) => {
  return (
    <div className="tyagi-post-form">
      {/* Post Type Selection */}
      {!isEdit && (
        <div className="tyagi-form-group">
          <label>Post Type</label>
          <select 
            value={formData.postType} 
            onChange={(e) => handleInputChange('postType', e.target.value)}
            className="tyagi-form-control"
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="poll">Poll</option>
            <option value="quiz">Quiz</option>
            <option value="link">Link</option>
          </select>
        </div>
      )}

      {/* Description */}
      <div className="tyagi-form-group">
        <label>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          className="tyagi-form-control"
          rows="3"
          required
        />
      </div>

      {/* Image Post Fields */}
      {formData.postType === 'image' && (
        <div className="tyagi-form-group">
          <label>Select Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageSelect}
            className="tyagi-form-control"
          />
          {selectedImages.length > 0 && (
            <div className="tyagi-selected-files">
              {selectedImages.map((file, index) => (
                <span key={index} className="tyagi-file-tag">{file.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video Post Fields */}
      {formData.postType === 'video' && (
        <>
          <div className="tyagi-form-group">
            <label>Select Video</label>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              className="tyagi-form-control"
            />
            {selectedVideo && (
              <div className="tyagi-selected-files">
                <span className="tyagi-file-tag">{selectedVideo.name}</span>
              </div>
            )}
          </div>
          <div className="tyagi-form-group">
            <label>Caption</label>
            <input
              type="text"
              value={formData.caption}
              onChange={(e) => handleInputChange('caption', e.target.value)}
              className="tyagi-form-control"
            />
          </div>
        </>
      )}

      {/* Poll Post Fields */}
      {formData.postType === 'poll' && (
        <>
          <div className="tyagi-form-group">
            <label>Poll Options</label>
            {formData.pollOptions.map((option, index) => (
              <div key={index} className="tyagi-poll-option-input">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updatePollOption(index, e.target.value)}
                  className="tyagi-form-control"
                  placeholder={`Option ${index + 1}`}
                />
                {formData.pollOptions.length > 2 && (
                  <button 
                    type="button"
                    onClick={() => removePollOption(index)}
                    className="tyagi-btn tyagi-btn-sm tyagi-btn-danger"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button 
              type="button"
              onClick={addPollOption}
              className="tyagi-btn tyagi-btn-sm tyagi-btn-secondary"
            >
              Add Option
            </button>
          </div>
          <div className="tyagi-form-group">
            <label>Poll Expiry (Optional)</label>
            <input
              type="datetime-local"
              value={formData.pollExpiresAt}
              onChange={(e) => handleInputChange('pollExpiresAt', e.target.value)}
              className="tyagi-form-control"
            />
          </div>
        </>
      )}

      {/* Quiz Post Fields */}
      {formData.postType === 'quiz' && (
        <div className="tyagi-form-group">
          <label>Quiz Questions</label>
          {formData.quizQuestions.map((question, qIndex) => (
            <div key={qIndex} className="tyagi-quiz-question">
              <div className="tyagi-quiz-question-header">
                <h4>Question {qIndex + 1}</h4>
                {formData.quizQuestions.length > 1 && (
                  <button 
                    type="button"
                    onClick={() => removeQuizQuestion(qIndex)}
                    className="tyagi-btn tyagi-btn-sm tyagi-btn-danger"
                  >
                    Remove Question
                  </button>
                )}
              </div>
              <input
                type="text"
                value={question.question}
                onChange={(e) => updateQuizQuestion(qIndex, 'question', e.target.value)}
                className="tyagi-form-control"
                placeholder="Question"
              />
              <div className="tyagi-quiz-options">
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="tyagi-quiz-option-input">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateQuizOption(qIndex, oIndex, e.target.value)}
                      className="tyagi-form-control"
                      placeholder={`Option ${oIndex + 1}`}
                    />
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={question.correctAnswer === oIndex}
                      onChange={() => updateQuizQuestion(qIndex, 'correctAnswer', oIndex)}
                    />
                    <label>Correct</label>
                  </div>
                ))}
              </div>
              <textarea
                value={question.explanation}
                onChange={(e) => updateQuizQuestion(qIndex, 'explanation', e.target.value)}
                className="tyagi-form-control"
                placeholder="Explanation (optional)"
                rows="2"
              />
            </div>
          ))}
          <button 
            type="button"
            onClick={addQuizQuestion}
            className="tyagi-btn tyagi-btn-sm tyagi-btn-secondary"
          >
            Add Question
          </button>
        </div>
      )}

      {/* Link Post Fields */}
      {formData.postType === 'link' && (
        <>
          <div className="tyagi-form-group">
            <label>Link URL</label>
            <input
              type="url"
              value={formData.linkUrl}
              onChange={(e) => handleInputChange('linkUrl', e.target.value)}
              className="tyagi-form-control"
              required
            />
          </div>
          <div className="tyagi-form-group">
            <label>Link Title</label>
            <input
              type="text"
              value={formData.linkTitle}
              onChange={(e) => handleInputChange('linkTitle', e.target.value)}
              className="tyagi-form-control"
            />
          </div>
          <div className="tyagi-form-group">
            <label>Link Description</label>
            <textarea
              value={formData.linkDescription}
              onChange={(e) => handleInputChange('linkDescription', e.target.value)}
              className="tyagi-form-control"
              rows="2"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminCommunity;