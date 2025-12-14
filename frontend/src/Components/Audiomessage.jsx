import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaTrash,
  FaCheck,
  FaSpinner,
  FaArrowLeft,
  FaPaperPlane,
  FaCircle,
  FaUser,
  FaCalendarAlt,
  FaClock,
  FaExclamationTriangle,
  FaTimes,
  FaHeadphones
} from 'react-icons/fa';
import './Audio.css';

const AudioAdminDashboard = () => {
  const [recordings, setRecordings] = useState([]);
  const [currentRecording, setCurrentRecording] = useState(null);
  const [replies, setReplies] = useState([]);
  const [stats, setStats] = useState({ total: 0, unread: 0, read: 0, replied: 0, totalStorageMB: 0 });
  const [emailFilter, setEmailFilter] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isAudioView, setIsAudioView] = useState(false);
  const API_BASE = 'https://aadibgmg.onrender.com';
  const token = localStorage.getItem('token'); // Retrieve token from localStorage

  // Helper functions
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch all recordings
  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const url = emailFilter
        ? `${API_BASE}/api/admin/audio-recordings?email=${encodeURIComponent(emailFilter)}`
        : `${API_BASE}/api/admin/audio-recordings`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setRecordings(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch recordings');
      showNotification('error', 'Failed to fetch recordings');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/admin/audio-stats`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setStats(response.data.stats || { total: 0, unread: 0, read: 0, replied: 0, totalStorageMB: 0 });
    } catch (err) {
      showNotification('error', 'Failed to fetch stats');
    }
  };

  // View recording details
  const viewRecording = async (recording) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/admin/audio-recordings/${recording._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setCurrentRecording(response.data.recording);
      setReplies(response.data.replies || []);
      setIsAudioView(true);
      setError(null);
      fetchRecordings();
      fetchStats();
    } catch (err) {
      setError('Failed to load recording details');
      showNotification('error', 'Failed to load recording details');
    } finally {
      setLoading(false);
    }
  };

  // Send reply
  const sendReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) {
      showNotification('error', 'Reply content cannot be empty');
      return;
    }
    try {
      setReplyLoading(true);
      await axios.post(
        `${API_BASE}/api/admin/audio-recordings/${currentRecording._id}/reply`,
        { replyContent },
        { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
      );
      setReplyContent('');
      showNotification('success', 'Reply sent successfully');
      viewRecording(currentRecording);
    } catch (err) {
      showNotification('error', 'Failed to send reply');
    } finally {
      setReplyLoading(false);
    }
  };

  // Mark recording as read/unread
  const markRecordingStatus = async (id, status) => {
    try {
      setActionLoading(`status-${id}`);
      await axios.put(
        `${API_BASE}/api/admin/audio-recordings/${id}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
      );
      showNotification('success', `Recording marked as ${status}`);
      fetchRecordings();
      fetchStats();
      if (isAudioView && currentRecording?._id === id) {
        viewRecording({ ...currentRecording, _id: id });
      }
    } catch (err) {
      showNotification('error', `Failed to mark recording as ${status}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Delete recording
  const deleteRecording = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recording?')) return;
    try {
      setActionLoading(`delete-${id}`);
      await axios.delete(`${API_BASE}/api/admin/audio-recordings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      showNotification('success', 'Recording deleted successfully');
      if (isAudioView && currentRecording?._id === id) {
        setIsAudioView(false);
        setCurrentRecording(null);
        setReplies([]);
      }
      fetchRecordings();
      fetchStats();
    } catch (err) {
      showNotification('error', 'Failed to delete recording');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete all recordings
  const deleteAllRecordings = async () => {
    if (!window.confirm('Are you sure you want to delete all recordings?')) return;
    try {
      setActionLoading('delete-all');
      await axios.delete(`${API_BASE}/api/admin/audio-recordings`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      showNotification('success', 'All recordings deleted successfully');
      setIsAudioView(false);
      setCurrentRecording(null);
      setReplies([]);
      fetchRecordings();
      fetchStats();
    } catch (err) {
      showNotification('error', 'Failed to delete all recordings');
    } finally {
      setActionLoading(null);
    }
  };

  // Go back to recordings list
  const goBackToRecordings = () => {
    setIsAudioView(false);
    setCurrentRecording(null);
    setReplies([]);
    setReplyContent('');
  };

  useEffect(() => {
    fetchRecordings();
    fetchStats();
  }, [emailFilter]);

  if (isAudioView && currentRecording) {
    return (
      <div className="audio-main-wrapper">
        {notification && (
          <div className={`audio-notification-toast ${notification.type}`}>
            {notification.message}
          </div>
        )}
        <div className="audio-container">
          <div className="audio-header">
            <button className="audio-back-button" onClick={goBackToRecordings}>
              <FaArrowLeft /> Back
            </button>
            <div className="audio-user-info">
              <div className="audio-avatar">{getInitials(currentRecording.name)}</div>
              <div className="audio-user-details">
                <h3 className="audio-username">{currentRecording.name}</h3>
                <span className="audio-user-email">{currentRecording.email}</span>
                <div className="audio-stats">
                  <span className="audio-stat-item">
                    <FaClock /> {Math.floor(currentRecording.duration / 60)}:
                    {String(currentRecording.duration % 60).padStart(2, '0')}
                  </span>
                  <span className="audio-stat-item">
                    <FaHeadphones /> {(currentRecording.fileSize / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              </div>
            </div>
            <div className="audio-actions">
              <button
                className="mark-read"
                onClick={() => markRecordingStatus(currentRecording._id, 'read')}
                disabled={actionLoading === `status-${currentRecording._id}` || currentRecording.status !== 'unread'}
                title="Mark as read"
              >
                {actionLoading === `status-${currentRecording._id}` ? <FaSpinner className="audio-spinner" /> : <FaEye />}
              </button>
              <button
                className="mark-unread"
                onClick={() => markRecordingStatus(currentRecording._id, 'unread')}
                disabled={actionLoading === `status-${currentRecording._id}` || currentRecording.status === 'unread'}
                title="Mark as unread"
              >
                {actionLoading === `status-${currentRecording._id}` ? <FaSpinner className="audio-spinner" /> : <FaEyeSlash />}
              </button>
              <button
                className="delete"
                onClick={() => deleteRecording(currentRecording._id)}
                disabled={actionLoading === `delete-${currentRecording._id}`}
                title="Delete recording"
              >
                {actionLoading === `delete-${currentRecording._id}` ? <FaSpinner className="audio-spinner" /> : <FaTrash />}
              </button>
            </div>
          </div>
          <div className="audio-messages-area">
            <div className="audio-recording-group">
              <div className="audio-original-recording">
                <div className="audio-message-bubble">
                  <div className="audio-message-header">
                    <span className={`audio-status-badge ${currentRecording.status}`}>
                      {currentRecording.status === 'unread' && <FaCircle />}
                      {currentRecording.status === 'read' && <FaEye />}
                      {currentRecording.status === 'replied' && <FaCheck />}
                      {currentRecording.status}
                    </span>
                  </div>
                  <audio controls className="audio-player">
                    <source
                      src={`${API_BASE}/api/admin/audio-recordings/${currentRecording._id}/audio`}
                      type={currentRecording.mimeType}
                    />
                    Your browser does not support the audio element.
                  </audio>
                  {currentRecording.transcription && (
                    <p className="audio-transcription">Transcription: {currentRecording.transcription}</p>
                  )}
                  <span className="audio-message-timestamp">
                    <FaCalendarAlt /> {formatDate(currentRecording.createdAt)} at {formatTime(currentRecording.createdAt)}
                  </span>
                </div>
              </div>
              {replies.map((reply) => (
                <div key={reply._id} className="audio-reply-message">
                  <div className="audio-message-bubble audio-sent-message">
                    <div className="audio-message-text">{reply.replyContent}</div>
                    <span className="audio-message-timestamp">
                      <FaClock /> {formatTime(reply.repliedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="audio-input-area">
            <form onSubmit={sendReply} className="audio-message-form">
              <div className="audio-input-wrapper">
                <textarea
                  className="audio-message-input"
                  placeholder="Type your reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows="3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply(e);
                    }
                  }}
                />
                <button type="submit" className="audio-send-button" disabled={replyLoading || !replyContent.trim()}>
                  {replyLoading ? <FaSpinner className="audio-spinner" /> : <FaPaperPlane />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-main-wrapper">
      <div className="audio-messages-header">
        <h2 className="audio-messages-title">
          <FaHeadphones /> Audio Recordings
        </h2>
      </div>
      {notification && (
        <div className={`audio-notification-toast ${notification.type}`}>
          {notification.message}
        </div>
      )}
      <div className="audio-stats-tabs-container">
        {[
          { key: 'all', label: 'All', count: stats.total },
          { key: 'unread', label: 'Unread', count: stats.unread },
          { key: 'read', label: 'Read', count: stats.read },
          { key: 'replied', label: 'Replied', count: stats.replied },
          { key: 'storage', label: 'Storage', count: `${stats.totalStorageMB} MB` }
        ].map((tab) => (
          <div key={tab.key} className="audio-stat-tab">
            <span className="audio-stat-number">{tab.count}</span>
            <span className="audio-stat-label">{tab.label}</span>
            {tab.key === 'unread' && tab.count > 0 && <FaCircle className="audio-unread-dot" />}
          </div>
        ))}
      </div>
      <div className="audio-filter-container">
        <input
          type="text"
          placeholder="Filter by email..."
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          className="audio-email-filter"
        />
        <button
          className="audio-action-btn delete-all"
          onClick={deleteAllRecordings}
          disabled={actionLoading === 'delete-all'}
        >
          {actionLoading === 'delete-all' ? <FaSpinner className="audio-spinner" /> : <FaTrash />} Delete All
        </button>
      </div>
      <div className="audio-recordings-list-container">
        {loading ? (
          <div className="audio-loading-state">
            <FaSpinner className="audio-loading-spinner" />
            <span>Loading recordings...</span>
          </div>
        ) : error ? (
          <div className="audio-error-state">
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        ) : recordings.length === 0 ? (
          <div className="audio-empty-state">
            <FaHeadphones className="audio-empty-icon" />
            <p>No recordings found</p>
          </div>
        ) : (
          <div className="audio-recordings-list">
            {recordings.map((recording) => (
              <div key={recording._id} className={`audio-recording-item ${recording.status}`}>
                <div className="audio-recording-content" onClick={() => viewRecording(recording)}>
                  <div className="audio-recording-avatar">
                    <FaUser />
                    {recording.status === 'unread' && <div className="audio-unread-indicator"></div>}
                  </div>
                  <div className="audio-recording-details">
                    <div className="audio-recording-header">
                      <span className="audio-recording-name">{recording.name}</span>
                      <span className="audio-recording-time">{formatDate(recording.createdAt)}</span>
                    </div>
                    <div className="audio-recording-info">
                      <span className="audio-recording-email">{recording.email}</span>
                      <div className="audio-recording-stats">
                        <span className="audio-duration">
                          {Math.floor(recording.duration / 60)}:{String(recording.duration % 60).padStart(2, '0')}
                        </span>
                        <span className="audio-size">{(recording.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <div className="audio-recording-preview">
                      <span className={`audio-status-indicator ${recording.status}`}>
                        {recording.status === 'unread' && <FaCircle />}
                        {recording.status === 'read' && <FaEye />}
                        {recording.status === 'replied' && <FaCheck />}
                      </span>
                      <span className="audio-latest-transcription">
                        {recording.transcription ? `Transcription: ${recording.transcription.substring(0, 60)}...` : 'No transcription'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="audio-recording-actions">
                  <button
                    className="audio-action-btn mark-read"
                    onClick={(e) => {
                      e.stopPropagation();
                      markRecordingStatus(recording._id, 'read');
                    }}
                    disabled={actionLoading === `status-${recording._id}` || recording.status !== 'unread'}
                    title="Mark as read"
                  >
                    {actionLoading === `status-${recording._id}` ?
                    <FaSpinner className="audio-spinner" /> : <FaEye />}
                  </button>
                  <button
                    className="audio-action-btn mark-unread"
                    onClick={(e) => {
                      e.stopPropagation();
                      markRecordingStatus(recording._id, 'unread');
                    }}
                    disabled={actionLoading === `status-${recording._id}` || recording.status === 'unread'}
                    title="Mark as unread"
                  >
                    {actionLoading === `status-${recording._id}` ? <FaSpinner className="audio-spinner" /> : <FaEyeSlash />}
                  </button>
                  <button
                    className="audio-action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRecording(recording._id);
                    }}
                    disabled={actionLoading === `delete-${recording._id}`}
                    title="Delete recording"
                  >
                    {actionLoading === `delete-${recording._id}` ? <FaSpinner className="audio-spinner" /> : <FaTrash />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioAdminDashboard;