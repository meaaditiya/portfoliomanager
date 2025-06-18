// src/admin/pages/Messages.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FaEnvelope, 
  FaEye, 
  FaReply, 
  FaTrash, 
  FaCheck, 
  FaSpinner, 
  FaArrowLeft, 
  FaPaperPlane, 
  FaCircle,
  FaEyeSlash,
  FaCheckCircle,
  FaTimesCircle,
  FaUser,
  FaCalendarAlt,
  FaClock,
  FaExclamationTriangle
} from 'react-icons/fa';
import '../ComponentsCSS/Message.css'

const Messages = () => {
  const [conversations, setConversations] = useState([]); // Grouped conversations
  const [currentConversation, setCurrentConversation] = useState(null);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [replies, setReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [notification, setNotification] = useState(null);
  const [isChatView, setIsChatView] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [messageStats, setMessageStats] = useState({
    total: 0,
    unread: 0,
    read: 0,
    replied: 0
  });

  // API Base URL
  const API_BASE = 'https://connectwithaaditiyamg.onrender.com';

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations();
    fetchMessageStats();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/admin/messages?grouped=true`, {
        withCredentials: true
      });
      setConversations(response.data.data || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch conversations');
      setLoading(false);
      console.error(err);
    }
  };

  const fetchMessageStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/admin/message-stats`, {
        withCredentials: true
      });
      setMessageStats(response.data.data || {
        total: 0,
        unread: 0,
        read: 0,
        replied: 0
      });
    } catch (err) {
      console.error('Failed to fetch message stats', err);
    }
  };

  const viewConversation = async (email) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/admin/messages/email/${encodeURIComponent(email)}`, {
        withCredentials: true
      });
      
      const conversationData = response.data;
      setCurrentConversation({
        email: conversationData.email,
        name: conversationData.name,
        totalMessages: conversationData.totalMessages,
        unreadCount: conversationData.unreadCount,
        readCount: conversationData.readCount,
        repliedCount: conversationData.repliedCount
      });
      
      setCurrentMessages(conversationData.messages || []);
      setIsChatView(true);
      setLoading(false);
      
      // Refresh conversations and stats
      setTimeout(() => {
        fetchConversations();
        fetchMessageStats();
      }, 500);
    } catch (err) {
      setError('Failed to load conversation');
      setLoading(false);
      showNotification('error', 'Failed to load conversation details');
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    
    if (!replyContent.trim()) {
      showNotification('error', 'Reply content cannot be empty');
      return;
    }
    
    // Find the original message to reply to (first message in conversation)
    const originalMessage = currentMessages.find(msg => !msg.replies || msg.replies.length === 0) || currentMessages[0];
    
    if (!originalMessage) {
      showNotification('error', 'No message found to reply to');
      return;
    }
    
    try {
      setReplyLoading(true);
      
      await axios.post(
        `${API_BASE}/api/admin/messages/${originalMessage._id}/reply`, 
        { replyContent }, 
        { withCredentials: true }
      );
      
      setReplyContent('');
      setReplyLoading(false);
      
      showNotification('success', 'Reply sent successfully');
      
      // Refresh conversation
      viewConversation(currentConversation.email);
      fetchConversations();
      fetchMessageStats();
    } catch (err) {
      setReplyLoading(false);
      showNotification('error', 'Failed to send reply');
    }
  };

  const markConversationAsRead = async (email) => {
    try {
      setActionLoading(`read-${email}`);
      await axios.put(`${API_BASE}/api/admin/messages/email/${encodeURIComponent(email)}/mark-read`, {}, {
        withCredentials: true
      });
      
      showNotification('success', 'Conversation marked as read');
      
      // Refresh data
      fetchConversations();
      fetchMessageStats();
      
      // Update current conversation if viewing
      if (isChatView && currentConversation?.email === email) {
        viewConversation(email);
      }
      
      setActionLoading(null);
    } catch (err) {
      setActionLoading(null);
      showNotification('error', 'Failed to mark conversation as read');
    }
  };

  const markConversationAsUnread = async (email) => {
    try {
      setActionLoading(`unread-${email}`);
      await axios.put(`${API_BASE}/api/admin/messages/email/${encodeURIComponent(email)}/mark-unread`, {}, {
        withCredentials: true
      });
      
      showNotification('success', 'Conversation marked as unread');
      
      // Refresh data
      fetchConversations();
      fetchMessageStats();
      
      // Update current conversation if viewing
      if (isChatView && currentConversation?.email === email) {
        viewConversation(email);
      }
      
      setActionLoading(null);
    } catch (err) {
      setActionLoading(null);
      showNotification('error', 'Failed to mark conversation as unread');
    }
  };

  const deleteConversation = async (email) => {
    if (!window.confirm(`Are you sure you want to delete all messages from ${email}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setActionLoading(`delete-${email}`);
      await axios.delete(`${API_BASE}/api/admin/messages/email/${encodeURIComponent(email)}`, {
        withCredentials: true
      });
      
      // If currently viewing this conversation, go back to list
      if (isChatView && currentConversation?.email === email) {
        goBackToConversations();
      }
      
      showNotification('success', 'Conversation deleted successfully');
      
      // Refresh data
      fetchConversations();
      fetchMessageStats();
      setActionLoading(null);
    } catch (err) {
      setActionLoading(null);
      showNotification('error', 'Failed to delete conversation');
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }
    
    try {
      await axios.delete(`${API_BASE}/api/admin/messages/${messageId}`, {
        withCredentials: true
      });
      
      showNotification('success', 'Message deleted successfully');
      
      // Refresh current conversation
      if (currentConversation) {
        viewConversation(currentConversation.email);
      }
      
      fetchConversations();
      fetchMessageStats();
    } catch (err) {
      showNotification('error', 'Failed to delete message');
    }
  };

  const goBackToConversations = () => {
    setIsChatView(false);
    setCurrentConversation(null);
    setCurrentMessages([]);
    setReplies([]);
    setReplyContent('');
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Filter conversations based on active tab
  const filteredConversations = conversations.filter(conversation => {
    if (activeTab === 'all') return true;
    return conversation.overallStatus === activeTab;
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

  // Chat view for individual conversation
  if (isChatView && currentConversation) {
    return (
      <div className="insta-messages-main-wrapper">
        {notification && (
          <div className={`insta-notification-toast ${notification.type}`}>
            {notification.message}
          </div>
        )}
        
        <div className="insta-chat-container">
          <div className="insta-chat-header">
            <button className="insta-back-button" onClick={goBackToConversations}>
              <FaArrowLeft />
            </button>
            <div className="insta-chat-user-info">
              <div className="insta-chat-avatar">
                {getInitials(currentConversation.name)}
              </div>
              <div className="insta-chat-user-details">
                <h3 className="insta-chat-username">{currentConversation.name}</h3>
                <span className="insta-chat-user-email">{currentConversation.email}</span>
                <div className="insta-conversation-stats">
                  <span className="insta-stat-item">
                    <FaEnvelope /> {currentConversation.totalMessages} messages
                  </span>
                  {currentConversation.unreadCount > 0 && (
                    <span className="insta-stat-item unread">
                      <FaCircle /> {currentConversation.unreadCount} unread
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="insta-chat-actions">
              <button 
                className="insta-action-button mark-read"
                onClick={() => markConversationAsRead(currentConversation.email)}
                disabled={actionLoading === `read-${currentConversation.email}`}
                title="Mark all as read"
              >
                {actionLoading === `read-${currentConversation.email}` ? (
                  <FaSpinner className="insta-spinner" />
                ) : (
                  <FaEye />
                )}
              </button>
              <button 
                className="insta-action-button mark-unread"
                onClick={() => markConversationAsUnread(currentConversation.email)}
                disabled={actionLoading === `unread-${currentConversation.email}`}
                title="Mark all as unread"
              >
                {actionLoading === `unread-${currentConversation.email}` ? (
                  <FaSpinner className="insta-spinner" />
                ) : (
                  <FaEyeSlash />
                )}
              </button>
              <button 
                className="insta-action-button delete"
                onClick={() => deleteConversation(currentConversation.email)}
                disabled={actionLoading === `delete-${currentConversation.email}`}
                title="Delete conversation"
              >
                {actionLoading === `delete-${currentConversation.email}` ? (
                  <FaSpinner className="insta-spinner" />
                ) : (
                  <FaTrash />
                )}
              </button>
            </div>
          </div>

          <div className="insta-chat-messages-area">
            {currentMessages.map(message => (
              <div key={message._id} className="insta-message-group">
                <div className="insta-original-message">
                  <div className="insta-message-bubble insta-received-message">
                    <div className="insta-message-header">
                      <span className={`insta-status-badge ${message.status}`}>
                        {message.status === 'unread' && <FaCircle />}
                        {message.status === 'read' && <FaEye />}
                        {message.status === 'replied' && <FaCheck />}
                        {message.status}
                      </span>
                      <button 
                        className="insta-delete-message-btn"
                        onClick={() => deleteMessage(message._id)}
                        title="Delete this message"
                      >
                        <FaTrash />
                      </button>
                    </div>
                    <p className="insta-message-text">{message.message}</p>
                    <span className="insta-message-timestamp">
                      <FaCalendarAlt /> {formatDate(message.createdAt)} at {formatTime(message.createdAt)}
                    </span>
                  </div>
                </div>

                {message.replies && message.replies.map(reply => (
                  <div key={reply._id} className="insta-reply-message">
                    <div className="insta-message-bubble insta-sent-message">
                      <div 
                        className="insta-message-text" 
                        dangerouslySetInnerHTML={{ __html: reply.replyContent }}
                      ></div>
                      <span className="insta-message-timestamp">
                        <FaClock /> {formatTime(reply.repliedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="insta-chat-input-area">
            <form onSubmit={sendReply} className="insta-message-form">
              <div className="insta-input-wrapper">
                <textarea
                  className="insta-message-input"
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

  // Main conversations list view
  return (
    <div className="insta-messages-main-wrapper">
      <div className="insta-messages-header">
        <h2 className="insta-messages-title">
          <FaEnvelope /> Conversations
        </h2>
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
            <span>Loading conversations...</span>
          </div>
        ) : error ? (
          <div className="insta-error-state">
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="insta-empty-state">
            <FaEnvelope className="insta-empty-icon" />
            <p>No conversations found</p>
          </div>
        ) : (
          <div className="insta-conversations-list">
            {filteredConversations.map(conversation => (
              <div 
                key={conversation._id} 
                className={`insta-conversation-item ${conversation.overallStatus}`}
              >
                <div className="insta-conversation-content" onClick={() => viewConversation(conversation.email)}>
                  <div className="insta-conversation-avatar">
                    <FaUser />
                    {conversation.overallStatus === 'unread' && (
                      <div className="insta-online-indicator"></div>
                    )}
                  </div>
                  
                  <div className="insta-conversation-details">
                    <div className="insta-conversation-header">
                      <span className="insta-conversation-name">{conversation.name}</span>
                      <span className="insta-conversation-time">{formatDate(conversation.latestMessage)}</span>
                    </div>
                    <div className="insta-conversation-info">
                      <span className="insta-conversation-email">{conversation.email}</span>
                      <div className="insta-conversation-stats-inline">
                        <span className="insta-message-count">{conversation.totalMessages} messages</span>
                        {conversation.unreadCount > 0 && (
                          <span className="insta-unread-count">{conversation.unreadCount} unread</span>
                        )}
                      </div>
                    </div>
                    <div className="insta-conversation-preview">
                      <span className={`insta-status-indicator ${conversation.overallStatus}`}>
                        {conversation.overallStatus === 'unread' && <FaCircle />}
                        {conversation.overallStatus === 'read' && <FaEye />}
                        {conversation.overallStatus === 'replied' && <FaCheck />}
                      </span>
                      <span className="insta-latest-message">
                        Latest: {conversation.messages[0]?.message.substring(0, 60)}...
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="insta-conversation-actions">
                  <button 
                    className="insta-action-btn mark-read"
                    onClick={(e) => {
                      e.stopPropagation();
                      markConversationAsRead(conversation.email);
                    }}
                    disabled={actionLoading === `read-${conversation.email}`}
                    title="Mark as read"
                  >
                    {actionLoading === `read-${conversation.email}` ? (
                      <FaSpinner className="insta-spinner" />
                    ) : (
                      <FaEye />
                    )}
                  </button>
                  <button 
                    className="insta-action-btn mark-unread"
                    onClick={(e) => {
                      e.stopPropagation();
                      markConversationAsUnread(conversation.email);
                    }}
                    disabled={actionLoading === `unread-${conversation.email}`}
                    title="Mark as unread"
                  >
                    {actionLoading === `unread-${conversation.email}` ? (
                      <FaSpinner className="insta-spinner" />
                    ) : (
                      <FaEyeSlash />
                    )}
                  </button>
                  <button 
                    className="insta-action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conversation.email);
                    }}
                    disabled={actionLoading === `delete-${conversation.email}`}
                    title="Delete conversation"
                  >
                    {actionLoading === `delete-${conversation.email}` ? (
                      <FaSpinner className="insta-spinner" />
                    ) : (
                      <FaTrash />
                    )}
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

export default Messages;