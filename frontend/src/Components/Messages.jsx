// src/admin/pages/Messages.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaEnvelope, FaEye, FaReply, FaTrash, FaCheck, FaSpinner, FaArrowLeft, FaPaperPlane, FaCircle } from 'react-icons/fa';
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
  const [isChatView, setIsChatView] = useState(false);

  // Fetch messages on component mount
  useEffect(() => {
    fetchMessages();
    fetchMessageStats();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get('https://connectwithaaditiyamg.onrender.com/api/admin/messages', {
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
      const response = await axios.get('https://connectwithaaditiyamg.onrender.com/api/admin/message-stats', {
        withCredentials: true
      });
      setMessageStats(response.data);
    } catch (err) {
      console.error('Failed to fetch message stats', err);
    }
  };

  const viewMessage = async (messageId) => {
    try {
      const response = await axios.get(`https://connectwithaaditiyamg.onrender.com/api/admin/messages/${messageId}`, {
        withCredentials: true
      });
      
      setCurrentMessage(response.data.message);
      setReplies(response.data.replies);
      setIsChatView(true);
      
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
        `https://connectwithaaditiyamg.onrender.com/api/admin/messages/${currentMessage._id}/reply`, 
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
      await axios.delete(`https://connectwithaaditiyamg.onrender.com/api/admin/messages/${messageId}`, {
        withCredentials: true
      });
      
      // Clear current message if it's the one being deleted
      if (currentMessage && currentMessage._id === messageId) {
        setCurrentMessage(null);
        setReplies([]);
        setIsChatView(false);
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

  const goBackToMessages = () => {
    setIsChatView(false);
    setCurrentMessage(null);
    setReplies([]);
    setReplyContent('');
  };

  // Filter messages based on active tab
  const filteredMessages = messages.filter(message => {
    if (activeTab === 'all') return true;
    return message.status === activeTab;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'unread': return '#0095f6';
      case 'read': return '#8e8e8e';
      case 'replied': return '#00d851';
      default: return '#8e8e8e';
    }
  };

  if (isChatView && currentMessage) {
    return (
      <div className="insta-messages-main-wrapper">
        {notification && (
          <div className={`insta-notification-toast ${notification.type}`}>
            {notification.message}
          </div>
        )}
        
        <div className="insta-chat-container">
          <div className="insta-chat-header">
            <button className="insta-back-button" onClick={goBackToMessages}>
              <FaArrowLeft />
            </button>
            <div className="insta-chat-user-info">
              <div className="insta-chat-avatar">
                {getInitials(currentMessage.name)}
              </div>
              <div className="insta-chat-user-details">
                <h3 className="insta-chat-username">{currentMessage.name}</h3>
                <span className="insta-chat-user-email">{currentMessage.email}</span>
              </div>
            </div>
            <button 
              className="insta-delete-chat-button" 
              onClick={() => deleteMessage(currentMessage._id)}
            >
              <FaTrash />
            </button>
          </div>

          <div className="insta-chat-messages-area">
            <div className="insta-original-message">
              <div className="insta-message-bubble insta-received-message">
                <p className="insta-message-text">{currentMessage.message}</p>
                <span className="insta-message-timestamp">
                  {formatTime(currentMessage.createdAt)}
                </span>
              </div>
            </div>

            {replies.map(reply => (
              <div key={reply._id} className="insta-reply-message">
                <div className="insta-message-bubble insta-sent-message">
                  <div 
                    className="insta-message-text" 
                    dangerouslySetInnerHTML={{ __html: reply.replyContent }}
                  ></div>
                  <span className="insta-message-timestamp">
                    {formatTime(reply.repliedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="insta-chat-input-area">
            <form onSubmit={sendReply} className="insta-message-form">
              <div className="insta-input-wrapper">
                <textarea
                  className="insta-message-input"
                  placeholder="Message..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows="1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply(e);
                    }
                  }}
                />
                <button 
                  type="submit" 
                  className="insta-send-button"
                  disabled={replyLoading || !replyContent.trim()}
                >
                  {replyLoading ? (
                    <FaSpinner className="insta-spinner" />
                  ) : (
                    <FaPaperPlane />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="insta-messages-main-wrapper">
      <div className="insta-messages-header">
        <h2 className="insta-messages-title">Messages</h2>
      </div>
      
      {notification && (
        <div className={`insta-notification-toast ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      <div className="insta-stats-tabs-container">
        <div 
          className={`insta-stat-tab ${activeTab === 'all' ? 'insta-active-tab' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <span className="insta-stat-number">{messageStats.total}</span>
          <span className="insta-stat-label">All</span>
        </div>
        <div 
          className={`insta-stat-tab ${activeTab === 'unread' ? 'insta-active-tab' : ''}`}
          onClick={() => setActiveTab('unread')}
        >
          <span className="insta-stat-number">{messageStats.unread}</span>
          <span className="insta-stat-label">Unread</span>
          {messageStats.unread > 0 && <FaCircle className="insta-unread-dot" />}
        </div>
        <div 
          className={`insta-stat-tab ${activeTab === 'read' ? 'insta-active-tab' : ''}`}
          onClick={() => setActiveTab('read')}
        >
          <span className="insta-stat-number">{messageStats.read}</span>
          <span className="insta-stat-label">Read</span>
        </div>
        <div 
          className={`insta-stat-tab ${activeTab === 'replied' ? 'insta-active-tab' : ''}`}
          onClick={() => setActiveTab('replied')}
        >
          <span className="insta-stat-number">{messageStats.replied}</span>
          <span className="insta-stat-label">Replied</span>
        </div>
      </div>
      
      <div className="insta-messages-list-container">
        {loading ? (
          <div className="insta-loading-state">
            <FaSpinner className="insta-loading-spinner" />
            <span>Loading messages...</span>
          </div>
        ) : error ? (
          <div className="insta-error-state">{error}</div>
        ) : filteredMessages.length === 0 ? (
          <div className="insta-empty-state">
            <FaEnvelope className="insta-empty-icon" />
            <p>No messages found</p>
          </div>
        ) : (
          <div className="insta-conversations-list">
            {filteredMessages.map(message => (
              <div 
                key={message._id} 
                className="insta-conversation-item"
                onClick={() => viewMessage(message._id)}
              >
                <div className="insta-conversation-avatar">
                  {getInitials(message.name)}
                  {message.status === 'unread' && (
                    <div className="insta-online-indicator"></div>
                  )}
                </div>
                
                <div className="insta-conversation-content">
                  <div className="insta-conversation-header">
                    <span className="insta-conversation-name">{message.name}</span>
                    <span className="insta-conversation-time">{formatDate(message.createdAt)}</span>
                  </div>
                  <div className="insta-conversation-preview">
                    <p className="insta-message-preview">
                      {message.message.substring(0, 50)}...
                    </p>
                    <div className="insta-message-status">
                      {message.status === 'replied' && (
                        <FaCheck className="insta-replied-check" />
                      )}
                      {message.status === 'unread' && (
                        <div className="insta-unread-badge">{1}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;