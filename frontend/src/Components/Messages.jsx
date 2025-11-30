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
  FaUser,
  FaCalendarAlt,
  FaClock,
  FaExclamationTriangle,
  FaTimes
} from 'react-icons/fa';
import '../ComponentsCSS/Message.css';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
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

  const API_BASE = 'https://connectwithaaditiyamg2.onrender.com';

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
    } catch (err) {
      setError('Failed to fetch conversations');
      console.error(err);
    } finally {
      setLoading(false);
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
      
      setCurrentConversation({
        email: response.data.email,
        name: response.data.name,
        totalMessages: response.data.totalMessages,
        unreadCount: response.data.unreadCount,
        readCount: response.data.readCount,
        repliedCount: response.data.repliedCount
      });
      
      setCurrentMessages(response.data.messages || []);
      setIsChatView(true);
      setSelectedMessage(null);
      
      // Automatically mark conversation as read if it has unread messages
      if (response.data.unreadCount > 0) {
        await markConversationAsRead(email);
      }
      
      setTimeout(() => {
        fetchConversations();
        fetchMessageStats();
      }, 500);
    } catch (err) {
      setError('Failed to load conversation');
      showNotification('error', 'Failed to load conversation details');
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    
    if (!replyContent.trim()) {
      showNotification('error', 'Reply content cannot be empty');
      return;
    }
    
    try {
      setReplyLoading(true);
      await axios.post(
        `${API_BASE}/api/admin/messages/${selectedMessage?._id || currentMessages[0]._id}/reply`, 
        { 
          replyContent,
          replyingTo: selectedMessage?._id || currentMessages[0]._id
        }, 
        { withCredentials: true }
      );
      
      setReplyContent('');
      setSelectedMessage(null);
      showNotification('success', 'Reply sent successfully');
      viewConversation(currentConversation.email);
      fetchConversations();
      fetchMessageStats();
    } catch (err) {
      showNotification('error', 'Failed to send reply');
    } finally {
      setReplyLoading(false);
    }
  };

  const markConversationAsRead = async (email) => {
    try {
      setActionLoading(`read-${email}`);
      await axios.put(`${API_BASE}/api/admin/messages/email/${encodeURIComponent(email)}/mark-read`, {}, {
        withCredentials: true
      });
      
      showNotification('success', 'Conversation marked as read');
      fetchConversations();
      fetchMessageStats();
      
      if (isChatView && currentConversation?.email === email) {
        viewConversation(email);
      }
    } catch (err) {
      showNotification('error', 'Failed to mark conversation as read');
    } finally {
      setActionLoading(null);
    }
  };

  const markConversationAsUnread = async (email) => {
    try {
      setActionLoading(`unread-${email}`);
      await axios.put(`${API_BASE}/api/admin/messages/email/${encodeURIComponent(email)}/mark-unread`, {}, {
        withCredentials: true
      });
      
      showNotification('success', 'Conversation marked as unread');
      fetchConversations();
      fetchMessageStats();
      
      if (isChatView && currentConversation?.email === email) {
        viewConversation(email);
      }
    } catch (err) {
      showNotification('error', 'Failed to mark conversation as unread');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteConversation = async (email) => {
    if (!window.confirm(`Are you sure you want to delete all messages from ${email}?`)) {
      return;
    }
    
    try {
      setActionLoading(`delete-${email}`);
      await axios.delete(`${API_BASE}/api/admin/messages/email/${encodeURIComponent(email)}`, {
        withCredentials: true
      });
      
      if (isChatView && currentConversation?.email === email) {
        goBackToConversations();
      }
      
      showNotification('success', 'Conversation deleted successfully');
      fetchConversations();
      fetchMessageStats();
    } catch (err) {
      showNotification('error', 'Failed to delete conversation');
    } finally {
      setActionLoading(null);
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
    setSelectedMessage(null);
    setReplyContent('');
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

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
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
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
              <FaArrowLeft /> Back
            </button>
            <div className="insta-chat-user-info">
              <div className="insta-chat-avatar">{getInitials(currentConversation.name)}</div>
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
                className="mark-all-read"
                onClick={() => markConversationAsRead(currentConversation.email)}
                disabled={actionLoading === `read-${currentConversation.email}`}
                title="Mark all as read"
              >
                {actionLoading === `read-${currentConversation.email}` ? (
                  <FaSpinner className="insta-spinner" />
                ) : (
                  <FaEye classname="icon1"/>
                )}
                mark all read
              </button>
              <button 
                className="mark-all-unread"
                onClick={() => markConversationAsUnread(currentConversation.email)}
                disabled={actionLoading === `unread-${currentConversation.email}`}
                title="Mark all as unread"
              >
                {actionLoading === `unread-${currentConversation.email}` ? (
                  <FaSpinner className="insta-spinner" />
                ) : (
                  <FaEyeSlash  classname="icon1"/>
                )}
                 mark all unread
              </button>
              <button 
                className="delete-all"
                onClick={() => deleteConversation(currentConversation.email)}
                disabled={actionLoading === `delete-${currentConversation.email}`}
                title="Delete conversation"
              >
                {actionLoading === `delete-${currentConversation.email}` ? (
                  <FaSpinner className="insta-spinner" />
                ) : (
                  <FaTrash  classname="icon1"/>
                )}
                 delete all
              </button>
            </div>
          </div>

          <div className="insta-chat-messages-area">
            {currentMessages.map(message => (
              <div key={message._id} className="insta-message-group">
                <div 
                  className={`insta-original-message ${selectedMessage?._id === message._id ? 'selected' : ''}`}
                  onClick={() => setSelectedMessage(message)}
                >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMessage(message._id);
                        }}
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
            {selectedMessage && (
              <div className="insta-selected-message-preview">
                <div className="insta-selected-message-header">
                  <span>Replying to:</span>
                  <button 
                    className="insta-clear-selection"
                    onClick={() => setSelectedMessage(null)}
                    title="Clear selection"
                  >
                    <FaTimes />
                  </button>
                </div>
                <div className="insta-selected-message-content">
                  <p>{selectedMessage.message.substring(0, 100)}{selectedMessage.message.length > 100 ? '...' : ''}</p>
                  <span>{formatDate(selectedMessage.createdAt)}</span>
                </div>
              </div>
            )}
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

  const filteredConversations = conversations.filter(conversation => 
    activeTab === 'all' ? true : conversation.overallStatus === activeTab
  );

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
        {[
          { key: 'all', label: 'All', count: messageStats.total },
          { key: 'unread', label: 'Unread', count: messageStats.unread },
          { key: 'read', label: 'Read', count: messageStats.read },
          { key: 'replied', label: 'Replied', count: messageStats.replied }
        ].map(tab => (
          <div 
            key={tab.key}
            className={`insta-stat-tab ${activeTab === tab.key ? 'insta-active-tab' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="insta-stat-number">{tab.count}</span>
            <span className="insta-stat-label">{tab.label}</span>
            {tab.key === 'unread' && tab.count > 0 && <FaCircle className="insta-unread-dot" />}
          </div>
        ))}
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