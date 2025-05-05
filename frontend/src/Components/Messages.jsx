// src/admin/pages/Messages.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaEnvelope, FaEye, FaReply, FaTrash, FaCheck, FaSpinner } from 'react-icons/fa';
import '../ComponentsCSS/Message.css'
const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [messageStats, setMessageStats] = useState({
    total: 0,
    unread: 0,
    read: 0,
    replied: 0
  });
  const [currentMessage, setCurrentMessage] = useState(null);
  const [replies, setReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [notification, setNotification] = useState(null);

  // Fetch messages on component mount
  useEffect(() => {
    fetchMessages();
    fetchMessageStats();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
     
      const response = await axios.get('http://localhost:5000/api/admin/messages', {
        withCredentials: true
      });
      setMessages(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch messages');
      setLoading(false);
    }
  };

  const fetchMessageStats = async () => {
    try {
      
      const response = await axios.get('http://localhost:5000/api/admin/message-stats',  {
        withCredentials: true
      });
      setMessageStats(response.data);
    } catch (err) {
      console.error('Failed to fetch message stats', err);
    }
  };

  const viewMessage = async (messageId) => {
    try {
      
      const response = await axios.get(`http://localhost:5000/api/admin/messages/${messageId}`,  {
        withCredentials: true
      });
      
      setCurrentMessage(response.data.message);
      setReplies(response.data.replies);
      
      // Refresh messages and stats after viewing (to update read status)
      fetchMessages();
      fetchMessageStats();
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Failed to load message details'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    
    if (!replyContent.trim()) {
      setNotification({
        type: 'error',
        message: 'Reply content cannot be empty'
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    try {
      setReplyLoading(true);
     
      
      await axios.post(
        `http://localhost:5000/api/admin/messages/${currentMessage._id}/reply`, 
        { replyContent }, 
        {
            withCredentials: true
          }
      );
      
      // Reset form and refresh data
      setReplyContent('');
      setReplyLoading(false);
      
      // Show success notification
      setNotification({
        type: 'success',
        message: 'Reply sent successfully'
      });
      setTimeout(() => setNotification(null), 3000);
      
      // Refresh current message, all messages, and stats
      viewMessage(currentMessage._id);
      fetchMessages();
      fetchMessageStats();
    } catch (err) {
      setReplyLoading(false);
      setNotification({
        type: 'error',
        message: 'Failed to send reply'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }
    
    try {
      
      await axios.delete(`http://localhost:5000/api/admin/messages/${messageId}`,  {
        withCredentials: true
      });
      
      // Clear current message if it's the one being deleted
      if (currentMessage && currentMessage._id === messageId) {
        setCurrentMessage(null);
        setReplies([]);
      }
      
      // Refresh messages and stats
      fetchMessages();
      fetchMessageStats();
      
      setNotification({
        type: 'success',
        message: 'Message deleted successfully'
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Failed to delete message'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Filter messages based on active tab
  const filteredMessages = messages.filter(message => {
    if (activeTab === 'all') return true;
    return message.status === activeTab;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-messages-container">
      <h2 className="admin-section-title">Contact Messages</h2>
      
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      <div className="message-stats">
        <div className="stat-box" onClick={() => setActiveTab('all')}>
          <span className="stat-value">{messageStats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-box unread" onClick={() => setActiveTab('unread')}>
          <span className="stat-value">{messageStats.unread}</span>
          <span className="stat-label">Unread</span>
        </div>
        <div className="stat-box read" onClick={() => setActiveTab('read')}>
          <span className="stat-value">{messageStats.read}</span>
          <span className="stat-label">Read</span>
        </div>
        <div className="stat-box replied" onClick={() => setActiveTab('replied')}>
          <span className="stat-value">{messageStats.replied}</span>
          <span className="stat-label">Replied</span>
        </div>
      </div>
      
      <div className="messages-panel">
        <div className="messages-list">
          <div className="list-header">
            <h3>{activeTab === 'all' ? 'All Messages' : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Messages`}</h3>
          </div>
          
          {loading ? (
            <div className="loading-indicator">
              <FaSpinner className="spinner" />
              <span>Loading messages...</span>
            </div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : filteredMessages.length === 0 ? (
            <div className="empty-state">No messages found</div>
          ) : (
            <ul className="messages">
              {filteredMessages.map(message => (
                <li 
                  key={message._id} 
                  className={`message-item ${currentMessage && currentMessage._id === message._id ? 'active' : ''} ${message.status === 'unread' ? 'unread' : ''}`}
                  onClick={() => viewMessage(message._id)}
                >
                  <div className="message-item-header">
                    <span className="sender-name">{message.name}</span>
                    <span className="message-date">{formatDate(message.createdAt)}</span>
                  </div>
                  <div className="message-preview">
                    <span className="message-email">{message.email}</span>
                    <p className="message-snippet">{message.message.substring(0, 60)}...</p>
                  </div>
                  <div className="message-actions">
                    <button 
                      className="action-button view" 
                      onClick={(e) => {
                        e.stopPropagation();
                        viewMessage(message._id);
                      }}
                    >
                      <FaEye />
                    </button>
                    <button 
                      className="action-button delete" 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMessage(message._id);
                      }}
                    >
                      <FaTrash />
                    </button>
                  </div>
                  {message.status === 'unread' && <div className="unread-indicator"></div>}
                  {message.status === 'replied' && <div className="replied-indicator"><FaCheck /></div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="message-detail">
          {currentMessage ? (
            <>
              <div className="detail-header">
                <h3>Message from {currentMessage.name}</h3>
                <span className="message-status">{currentMessage.status}</span>
              </div>
              
              <div className="message-metadata">
                <div className="metadata-item">
                  <span className="metadata-label">From:</span>
                  <span className="metadata-value">{currentMessage.name} ({currentMessage.email})</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">Received:</span>
                  <span className="metadata-value">{formatDate(currentMessage.createdAt)}</span>
                </div>
              </div>
              
              <div className="message-content">
                <p>{currentMessage.message}</p>
              </div>
              
              {replies.length > 0 && (
                <div className="replies-section">
                  <h4>Previous Replies</h4>
                  {replies.map(reply => (
                    <div key={reply._id} className="reply-item">
                      <div className="reply-header">
                        <span className="reply-author">From: {reply.repliedBy.name}</span>
                        <span className="reply-date">{formatDate(reply.repliedAt)}</span>
                      </div>
                      <div className="reply-content" dangerouslySetInnerHTML={{ __html: reply.replyContent }}></div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="reply-form">
                <h4>
                  <FaReply className="reply-icon" />
                  Reply to this message
                </h4>
                <form onSubmit={sendReply}>
                  <div className="form-group">
                    <textarea
                      rows="6"
                      className="reply-textarea"
                      placeholder="Type your reply here..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                    ></textarea>
                    <div className="helper-text">
                      <small>You can use basic HTML tags for formatting (e.g., &lt;b&gt;, &lt;i&gt;, &lt;p&gt;, &lt;br&gt;, &lt;a&gt;)</small>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="send-reply-button"
                    disabled={replyLoading}
                  >
                    {replyLoading ? (
                      <>
                        <FaSpinner className="spinner" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FaReply />
                        Send Reply
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="no-message-selected">
              <FaEnvelope className="envelope-icon" />
              <p>Select a message to view its details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;