import React, { useState, useEffect } from 'react';
import { Mail, Send, Users, BarChart3, Download, Trash2, Plus, Minus, X } from 'lucide-react';
import './Adminmail.css';

const EmailDashboard = () => {
  const [activeTab, setActiveTab] = useState('send');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [stats, setStats] = useState({});
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Form states
  const [singleEmail, setSingleEmail] = useState({
    to: '',
    subject: '',
    message: '',
    senderName: 'Aaditiya Tyagi',
    receiverName:''
  });

  const [bulkEmail, setBulkEmail] = useState({
    recipients: [''],
    subject: '',
    message: '',
    senderName: 'Admin',
    receiverName:'Recepient'
  });

  // Separate attachment states for each form
  const [singleAttachments, setSingleAttachments] = useState([]);
  const [bulkAttachments, setBulkAttachments] = useState([]);
  
  const [emailHistory, setEmailHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  const API_BASE = 'https://aadibgmg.onrender.com/api/admin';

  // Check authentication on mount
  useEffect(() => {
    if (token) {
      setIsLoggedIn(true);
      fetchStats();
      fetchEmailHistory();
    }
  }, [token]);

  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/email-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchEmailHistory = async (page = 1) => {
    try {
      const response = await fetch(`${API_BASE}/email-history?page=${page}&limit=${pagination.limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEmailHistory(data.emails);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching email history:', error);
    }
  };

  // Single email attachment handlers
  const handleSingleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setSingleAttachments(prev => [...prev, ...files]);
  };

  const removeSingleAttachment = (index) => {
    setSingleAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Bulk email attachment handlers
  const handleBulkFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setBulkAttachments(prev => [...prev, ...files]);
  };

  const removeBulkAttachment = (index) => {
    setBulkAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const addBulkRecipient = () => {
    setBulkEmail(prev => ({
      ...prev,
      recipients: [...prev.recipients, '']
    }));
  };

  const removeBulkRecipient = (index) => {
    setBulkEmail(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index)
    }));
  };

  const updateBulkRecipient = (index, value) => {
    setBulkEmail(prev => ({
      ...prev,
      recipients: prev.recipients.map((email, i) => i === index ? value : email)
    }));
  };

  const sendSingleEmail = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('to', singleEmail.to);
      formData.append('subject', singleEmail.subject);
      formData.append('message', singleEmail.message);
      formData.append('senderName', singleEmail.senderName);
      formData.append('receiverName', singleEmail.receiverName);

      singleAttachments.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch(`${API_BASE}/send-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        showMessage('Email sent successfully!', 'success');
        setSingleEmail({ to: '', subject: '', message: '', senderName: 'Aaditiya Tyagi', receiverName: '' });
        setSingleAttachments([]);
        fetchStats();
        fetchEmailHistory();
      } else {
        showMessage(data.message || 'Failed to send email', 'error');
      }
    } catch (error) {
      showMessage('Error sending email', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateBulkEmailForm = () => {
    const validRecipients = bulkEmail.recipients.filter(email => email.trim());
    
    if (validRecipients.length === 0) {
      showMessage('Please add at least one recipient', 'error');
      return false;
    }
    
    if (!bulkEmail.subject.trim()) {
      showMessage('Subject is required', 'error');
      return false;
    }
    
    if (!bulkEmail.message.trim()) {
      showMessage('Message is required', 'error');
      return false;
    }
    
    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validRecipients.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      showMessage(`Invalid email format(s): ${invalidEmails.join(', ')}`, 'error');
      return false;
    }
    
    return true;
  };

  const sendBulkEmail = async (e) => {
    e.preventDefault();
    if (!validateBulkEmailForm()) {
      return;
    }
    
    setLoading(true);

    try {
      // Filter out empty emails and validate
      const validRecipients = bulkEmail.recipients.filter(email => email.trim());
      
      if (validRecipients.length === 0) {
        showMessage('Please add at least one valid recipient', 'error');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      
      // Send recipients as JSON string (server expects to parse it)
      formData.append('recipients', JSON.stringify(validRecipients));
      formData.append('subject', bulkEmail.subject);
      formData.append('message', bulkEmail.message);
      formData.append('senderName', bulkEmail.senderName);
      formData.append('receiverName', bulkEmail.receiverName);

      bulkAttachments.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch(`${API_BASE}/send-bulk-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        showMessage(`Bulk email completed! ${data.results.successful.length} sent, ${data.results.failed.length} failed`, 'success');
        setBulkEmail({ recipients: [''], subject: '', message: '', senderName: 'Admin', receiverName: 'Recepient' });
        setBulkAttachments([]);
        fetchStats();
        fetchEmailHistory();
      } else {
        showMessage(data.message || 'Failed to send bulk email', 'error');
      }
    } catch (error) {
      console.error('Bulk email error:', error);
      showMessage('Error sending bulk email', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteEmail = async (id) => {
    if (!window.confirm('Are you sure you want to delete this email?')) return;

    try {
      const response = await fetch(`${API_BASE}/email/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        showMessage('Email deleted successfully', 'success');
        fetchEmailHistory();
        fetchStats();
      } else {
        showMessage(data.message || 'Failed to delete email', 'error');
      }
    } catch (error) {
      showMessage('Error deleting email', 'error');
    }
  };

  const downloadAttachment = async (emailId, attachmentId, filename) => {
    try {
      const response = await fetch(`${API_BASE}/email/${emailId}/attachment/${attachmentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        showMessage('Failed to download attachment', 'error');
      }
    } catch (error) {
      showMessage('Error downloading attachment', 'error');
    }
  };

  return (
    <div className="emd-dashboard-container-wrap">
      {message && (
        <div className={`emd-alert-notification-box emd-alert-${messageType}`}>
          {message}
        </div>
      )}

      <div className="emd-navigation-tabs-wrapper">
        <button
          className={`emd-nav-tab-button ${activeTab === 'send' ? 'emd-nav-tab-active' : ''}`}
          onClick={() => setActiveTab('send')}
        >
          <Send size={16} />
          Send Email
        </button>
        <button
          className={`emd-nav-tab-button ${activeTab === 'bulk' ? 'emd-nav-tab-active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <Users size={16} />
          Bulk Email
        </button>
        <button
          className={`emd-nav-tab-button ${activeTab === 'history' ? 'emd-nav-tab-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Mail size={16} />
          History
        </button>
        <button
          className={`emd-nav-tab-button ${activeTab === 'stats' ? 'emd-nav-tab-active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 size={16} />
          Statistics
        </button>
      </div>

      <div className="emd-main-content-area">
        {activeTab === 'send' && (
          <div className="emd-content-card-box">
            <h2 className="emd-section-heading-title">Send Single Email</h2>
            <form onSubmit={sendSingleEmail} className="emd-email-form-container">
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">To:</label>
                <input
                  type="email"
                  value={singleEmail.to}
                  onChange={(e) => setSingleEmail({...singleEmail, to: e.target.value})}
                  className="emd-text-input-field"
                  required
                />
              </div>
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">Subject:</label>
                <input
                  type="text"
                  value={singleEmail.subject}
                  onChange={(e) => setSingleEmail({...singleEmail, subject: e.target.value})}
                  className="emd-text-input-field"
                  required
                />
              </div>
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">Sender Name:</label>
                <input
                  type="text"
                  value={singleEmail.senderName}
                  onChange={(e) => setSingleEmail({...singleEmail, senderName: e.target.value})}
                  className="emd-text-input-field"
                />
              </div>
               <div className="emd-form-field-group">
                <label className="emd-input-field-label">Receiver Name:</label>
                <input
                  type="text"
                  value={singleEmail.receiverName}
                  onChange={(e) => setSingleEmail({...singleEmail, receiverName: e.target.value})}
                  className="emd-text-input-field"
                />
              </div>
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">Message:</label>
                <textarea
                  value={singleEmail.message}
                  onChange={(e) => setSingleEmail({...singleEmail, message: e.target.value})}
                  className="emd-textarea-input-field"
                  rows={6}
                  required
                />
              </div>
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">Attachments:</label>
                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="file"
                    onChange={handleSingleFileUpload}
                    multiple
                    id="singleFileInput"
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('singleFileInput').click()}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Plus size={16} />
                    Choose Files
                  </button>
                  <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    Click to select files (multiple files allowed)
                  </small>
                </div>
                {singleAttachments.length > 0 && (
                  <div className="emd-attachment-files-list">
                    <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                      Selected Files ({singleAttachments.length}):
                    </p>
                    {singleAttachments.map((file, index) => (
                      <div key={index} className="emd-attachment-file-item" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        marginBottom: '5px',
                        border: '1px solid #ddd'
                      }}>
                        <span style={{ fontSize: '14px' }}>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeSingleAttachment(index)}
                          style={{
                            background: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="emd-primary-submit-btn" disabled={loading}>
                {loading ? 'Sending...' : 'Send Email'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className="emd-content-card-box">
            <h2 className="emd-section-heading-title">Send Bulk Email</h2>
            <form onSubmit={sendBulkEmail} className="emd-email-form-container">
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">Recipients:</label>
                {bulkEmail.recipients.map((email, index) => (
                  <div key={index} className="emd-recipient-input-row">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateBulkRecipient(index, e.target.value)}
                      className="emd-text-input-field"
                      placeholder="Enter email address"
                      required
                    />
                    {bulkEmail.recipients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBulkRecipient(index)}
                        className="emd-recipient-remove-btn"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBulkRecipient}
                  className="emd-recipient-add-btn"
                >
                  <Plus size={16} />
                  Add Recipient
                </button>
              </div>
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">Subject:</label>
                <input
                  type="text"
                  value={bulkEmail.subject}
                  onChange={(e) => setBulkEmail({...bulkEmail, subject: e.target.value})}
                  className="emd-text-input-field"
                  required
                />
              </div>
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">Sender Name:</label>
                <input
                  type="text"
                  value={bulkEmail.senderName}
                  onChange={(e) => setBulkEmail({...bulkEmail, senderName: e.target.value})}
                  className="emd-text-input-field"
                />
              </div>
              
               <div className="emd-form-field-group">
                <label className="emd-input-field-label">Receiver Name:</label>
                <input
                  type="text"
                  value={bulkEmail.receiverName}
                  onChange={(e) => setBulkEmail({...bulkEmail, receiverName: e.target.value})}
                  className="emd-text-input-field"
                />
              </div>
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">Message:</label>
                <textarea
                  value={bulkEmail.message}
                  onChange={(e) => setBulkEmail({...bulkEmail, message: e.target.value})}
                  className="emd-textarea-input-field"
                  rows={6}
                  required
                />
              </div>
              <div className="emd-form-field-group">
                <label className="emd-input-field-label">Attachments:</label>
                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="file"
                    onChange={handleBulkFileUpload}
                    multiple
                    id="bulkFileInput"
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('bulkFileInput').click()}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Plus size={16} />
                    Choose Files
                  </button>
                  <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    Click to select files (multiple files allowed)
                  </small>
                </div>
                {bulkAttachments.length > 0 && (
                  <div className="emd-attachment-files-list">
                    <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                      Selected Files ({bulkAttachments.length}):
                    </p>
                    {bulkAttachments.map((file, index) => (
                      <div key={index} className="emd-attachment-file-item" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        marginBottom: '5px',
                        border: '1px solid #ddd'
                      }}>
                        <span style={{ fontSize: '14px' }}>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeBulkAttachment(index)}
                          style={{
                            background: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="emd-primary-submit-btn" disabled={loading}>
                {loading ? 'Sending...' : 'Send Bulk Email'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="emd-content-card-box">
            <h2 className="emd-section-heading-title">Email History</h2>
            <div className="emd-data-table-wrapper">
              <table className="emd-history-data-table">
                <thead>
                  <tr>
                    <th className="emd-table-header-cell">To</th>
                    <th className="emd-table-header-cell">Subject</th>
                    <th className="emd-table-header-cell">Status</th>
                    <th className="emd-table-header-cell">Date</th>
                    <th className="emd-table-header-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emailHistory.map((email) => (
                    <tr key={email._id}>
                      <td className="emd-table-body-cell">{email.to}</td>
                      <td className="emd-table-body-cell">{email.subject}</td>
                      <td className="emd-table-body-cell">
                        <span className={`emd-email-status-badge ${email.status === 'sent' ? 'emd-status-sent-badge' : 'emd-status-failed-badge'}`}>
                          {email.status}
                        </span>
                      </td>
                      <td className="emd-table-body-cell">
                        {new Date(email.sentAt).toLocaleDateString()}
                      </td>
                      <td className="emd-table-body-cell">
                        <div className="emd-table-action-btns">
                          {email.attachments && email.attachments.length > 0 && (
                            email.attachments.map((attachment, index) => (
                              <button
                                key={index}
                                onClick={() => downloadAttachment(email._id, attachment._id, attachment.filename)}
                                className="emd-icon-action-btn"
                                title={`Download ${attachment.filename}`}
                              >
                                <Download size={16} />
                              </button>
                            ))
                          )}
                          <button
                            onClick={() => deleteEmail(email._id)}
                            className="emd-icon-action-btn"
                            title="Delete email"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="emd-table-pagination-controls">
              <button
                onClick={() => fetchEmailHistory(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="emd-pagination-nav-btn"
              >
                Previous
              </button>
              <span className="emd-pagination-page-info">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => fetchEmailHistory(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="emd-pagination-nav-btn"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="emd-content-card-box">
            <h2 className="emd-section-heading-title">Email Statistics</h2>
            <div className="emd-statistics-grid-layout">
              <div className="emd-stat-display-card">
                <h3 className="emd-stat-card-title">Total Emails</h3>
                <p className="emd-stat-card-value">{stats.total || 0}</p>
              </div>
              <div className="emd-stat-display-card">
                <h3 className="emd-stat-card-title">Sent</h3>
                <p className="emd-stat-card-value">{stats.sent || 0}</p>
              </div>
              <div className="emd-stat-display-card">
                <h3 className="emd-stat-card-title">Failed</h3>
                <p className="emd-stat-card-value">{stats.failed || 0}</p>
              </div>
              <div className="emd-stat-display-card">
                <h3 className="emd-stat-card-title">Last 24 Hours</h3>
                <p className="emd-stat-card-value">{stats.last24Hours || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailDashboard;