import React, { useState, useEffect } from 'react';
import { Mail, Send, Users, BarChart3, Download, Trash2, Plus, Minus, X, List, Edit, Eye, Settings, FileText, Link, Image, Bold, Italic, Heading, Code, ListOrdered, CheckSquare, ListChecks } from 'lucide-react';
import './Adminmail.css';
const EmailAdminPanel = () => {
  const [activeTab, setActiveTab] = useState('send');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
const [newSubscriberEmail, setNewSubscriberEmail] = useState('');
  const [singleEmail, setSingleEmail] = useState({
    to: '',
    subject: '',
    message: '',
    senderName: 'Aaditiya Tyagi',
    receiverName: '',
    templateId: ''
  });

  const [bulkEmail, setBulkEmail] = useState({
    recipients: [''],
    subject: '',
    message: '',
    senderName: 'Admin',
    receiverName: 'Recipient',
    templateId: ''
  });

  const [listEmail, setListEmail] = useState({
    listId: '',
    subject: '',
    message: '',
    senderName: 'Admin',
    receiverName: 'Subscriber',
    templateId: ''
  });

  const [singleAttachments, setSingleAttachments] = useState([]);
  const [bulkAttachments, setBulkAttachments] = useState([]);
  const [listAttachments, setListAttachments] = useState([]);
  
  const [emailHistory, setEmailHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  const [subscriptionLists, setSubscriptionLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [newListForm, setNewListForm] = useState({ name: '', description: '' });
  const [showNewListForm, setShowNewListForm] = useState(false);

  const [emailTemplates, setEmailTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', markdownContent: '', isDefault: false });
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templatePreview, setTemplatePreview] = useState('');
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  const API_BASE = 'https://aadibgmg.onrender.com/api/admin';
  const PUBLIC_API = 'https://aadibgmg.onrender.com/api/public';

  useEffect(() => {
    if (token) {
      fetchStats();
      fetchEmailHistory();
      fetchSubscriptionLists();
      fetchEmailTemplates();
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

  const fetchEmailHistory = async (page = 1, listId = '') => {
    try {
      const url = listId 
        ? `${API_BASE}/email-history?page=${page}&limit=${pagination.limit}&listId=${listId}`
        : `${API_BASE}/email-history?page=${page}&limit=${pagination.limit}`;
      
      const response = await fetch(url, {
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

  const fetchSubscriptionLists = async () => {
    try {
      const response = await fetch(`${API_BASE}/subscription-lists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSubscriptionLists(data.lists);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
    }
  };

  const fetchListDetails = async (listId) => {
    try {
      const response = await fetch(`${API_BASE}/subscription-lists/${listId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSelectedList(data.list);
      }
    } catch (error) {
      console.error('Error fetching list details:', error);
    }
  };

  const createSubscriptionList = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/subscription-lists`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newListForm)
      });
      const data = await response.json();
      if (data.success) {
        showMessage('Subscription list created successfully!', 'success');
        setNewListForm({ name: '', description: '' });
        setShowNewListForm(false);
        fetchSubscriptionLists();
      } else {
        showMessage(data.message || 'Failed to create list', 'error');
      }
    } catch (error) {
      showMessage('Error creating list', 'error');
    } finally {
      setLoading(false);
    }
  };
const addSubscriberToList = async (e) => {
  e.preventDefault();
  if (!selectedList || !newSubscriberEmail.trim()) return;
  
  setLoading(true);
  try {
    const response = await fetch(`${API_BASE}/subscription-lists/${selectedList._id}/subscribers`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: newSubscriberEmail.trim() })
    });
    
    const data = await response.json();
    if (data.success) {
      showMessage('Subscriber added successfully!', 'success');
      setNewSubscriberEmail('');
      fetchListDetails(selectedList._id);
      fetchSubscriptionLists();
    } else {
      showMessage(data.message || 'Failed to add subscriber', 'error');
    }
  } catch (error) {
    showMessage('Error adding subscriber', 'error');
  } finally {
    setLoading(false);
  }
};
  const toggleListStatus = async (listId, currentStatus) => {
    try {
      const response = await fetch(`${API_BASE}/subscription-lists/${listId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      const data = await response.json();
      if (data.success) {
        showMessage('List status updated successfully!', 'success');
        fetchSubscriptionLists();
      } else {
        showMessage(data.message || 'Failed to update list', 'error');
      }
    } catch (error) {
      showMessage('Error updating list', 'error');
    }
  };

  const deleteSubscriptionList = async (listId) => {
    if (!window.confirm('Are you sure you want to delete this list?')) return;
    try {
      const response = await fetch(`${API_BASE}/subscription-lists/${listId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        showMessage('List deleted successfully!', 'success');
        fetchSubscriptionLists();
        if (selectedList?._id === listId) {
          setSelectedList(null);
        }
      } else {
        showMessage(data.message || 'Failed to delete list', 'error');
      }
    } catch (error) {
      showMessage('Error deleting list', 'error');
    }
  };

  const removeSubscriber = async (listId, email) => {
    if (!window.confirm(`Remove ${email} from this list?`)) return;
    try {
      const response = await fetch(`${API_BASE}/subscription-lists/${listId}/subscribers/${email}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        showMessage('Subscriber removed successfully!', 'success');
        fetchListDetails(listId);
        fetchSubscriptionLists();
      } else {
        showMessage(data.message || 'Failed to remove subscriber', 'error');
      }
    } catch (error) {
      showMessage('Error removing subscriber', 'error');
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE}/email-templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEmailTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const createEmailTemplate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/email-templates`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateForm)
      });
      const data = await response.json();
      if (data.success) {
        showMessage('Template created successfully!', 'success');
        setTemplateForm({ name: '', markdownContent: '', isDefault: false });
        setShowTemplateForm(false);
        fetchEmailTemplates();
      } else {
        showMessage(data.message || 'Failed to create template', 'error');
      }
    } catch (error) {
      showMessage('Error creating template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateEmailTemplate = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/email-templates/${selectedTemplate._id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateForm)
      });
      const data = await response.json();
      if (data.success) {
        showMessage('Template updated successfully!', 'success');
        setTemplateForm({ name: '', markdownContent: '', isDefault: false });
        setSelectedTemplate(null);
        fetchEmailTemplates();
      } else {
        showMessage(data.message || 'Failed to update template', 'error');
      }
    } catch (error) {
      showMessage('Error updating template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteEmailTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      const response = await fetch(`${API_BASE}/email-templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        showMessage('Template deleted successfully!', 'success');
        fetchEmailTemplates();
      } else {
        showMessage(data.message || 'Failed to delete template', 'error');
      }
    } catch (error) {
      showMessage('Error deleting template', 'error');
    }
  };

  const insertMarkdown = (syntax, cursorOffset = 0) => {
    const textarea = document.querySelector('.aep-markdown-textarea-input');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateForm.markdownContent;
    const selectedText = text.substring(start, end);
    
    let newText = '';
    let newCursorPos = start;
    
    switch(syntax) {
      case 'bold':
        newText = text.substring(0, start) + `**${selectedText || 'bold text'}**` + text.substring(end);
        newCursorPos = start + 2 + (selectedText ? selectedText.length : 0);
        break;
      case 'italic':
        newText = text.substring(0, start) + `*${selectedText || 'italic text'}*` + text.substring(end);
        newCursorPos = start + 1 + (selectedText ? selectedText.length : 0);
        break;
      case 'h1':
        newText = text.substring(0, start) + `# ${selectedText || 'Heading 1'}` + text.substring(end);
        newCursorPos = start + 2;
        break;
      case 'h2':
        newText = text.substring(0, start) + `## ${selectedText || 'Heading 2'}` + text.substring(end);
        newCursorPos = start + 3;
        break;
      case 'h3':
        newText = text.substring(0, start) + `### ${selectedText || 'Heading 3'}` + text.substring(end);
        newCursorPos = start + 4;
        break;
      case 'link':
        newText = text.substring(0, start) + `[${selectedText || 'link text'}](url)` + text.substring(end);
        newCursorPos = start + (selectedText ? selectedText.length + 3 : 12);
        break;
      case 'image':
        newText = text.substring(0, start) + `![${selectedText || 'alt text'}](image-url)` + text.substring(end);
        newCursorPos = start + (selectedText ? selectedText.length + 4 : 13);
        break;
      case 'code':
        newText = text.substring(0, start) + `\`${selectedText || 'code'}\`` + text.substring(end);
        newCursorPos = start + 1 + (selectedText ? selectedText.length : 0);
        break;
      case 'codeblock':
        newText = text.substring(0, start) + `\`\`\`\n${selectedText || 'code block'}\n\`\`\`` + text.substring(end);
        newCursorPos = start + 4;
        break;
      case 'ul':
        newText = text.substring(0, start) + `- ${selectedText || 'List item'}` + text.substring(end);
        newCursorPos = start + 2;
        break;
      case 'ol':
        newText = text.substring(0, start) + `1. ${selectedText || 'List item'}` + text.substring(end);
        newCursorPos = start + 3;
        break;
      case 'checkbox':
        newText = text.substring(0, start) + `- [ ] ${selectedText || 'Task'}` + text.substring(end);
        newCursorPos = start + 6;
        break;
      default:
        return;
    }
    
    setTemplateForm({ ...templateForm, markdownContent: newText });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSingleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setSingleAttachments(prev => [...prev, ...files]);
  };

  const removeSingleAttachment = (index) => {
    setSingleAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setBulkAttachments(prev => [...prev, ...files]);
  };

  const removeBulkAttachment = (index) => {
    setBulkAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleListFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setListAttachments(prev => [...prev, ...files]);
  };

  const removeListAttachment = (index) => {
    setListAttachments(prev => prev.filter((_, i) => i !== index));
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
      if (singleEmail.templateId) {
        formData.append('templateId', singleEmail.templateId);
      }
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
        setSingleEmail({ to: '', subject: '', message: '', senderName: 'Aaditiya Tyagi', receiverName: '', templateId: '' });
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

  const sendBulkEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const validRecipients = bulkEmail.recipients.filter(email => email.trim());
      if (validRecipients.length === 0) {
        showMessage('Please add at least one valid recipient', 'error');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('recipients', JSON.stringify(validRecipients));
      formData.append('subject', bulkEmail.subject);
      formData.append('message', bulkEmail.message);
      formData.append('senderName', bulkEmail.senderName);
      formData.append('receiverName', bulkEmail.receiverName);
      if (bulkEmail.templateId) {
        formData.append('templateId', bulkEmail.templateId);
      }
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
        setBulkEmail({ recipients: [''], subject: '', message: '', senderName: 'Admin', receiverName: 'Recipient', templateId: '' });
        setBulkAttachments([]);
        fetchStats();
        fetchEmailHistory();
      } else {
        showMessage(data.message || 'Failed to send bulk email', 'error');
      }
    } catch (error) {
      showMessage('Error sending bulk email', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendToList = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('listId', listEmail.listId);
      formData.append('subject', listEmail.subject);
      formData.append('message', listEmail.message);
      formData.append('senderName', listEmail.senderName);
      formData.append('receiverName', listEmail.receiverName);
      if (listEmail.templateId) {
        formData.append('templateId', listEmail.templateId);
      }
      listAttachments.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch(`${API_BASE}/send-to-list`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        showMessage(data.message, 'success');
        setListEmail({ listId: '', subject: '', message: '', senderName: 'Admin', receiverName: 'Subscriber', templateId: '' });
        setListAttachments([]);
        fetchStats();
        fetchEmailHistory();
      } else {
        showMessage(data.message || 'Failed to send emails to list', 'error');
      }
    } catch (error) {
      showMessage('Error sending emails to list', 'error');
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

  return (
    <div className="aep-dashboard-main-wrapper">
      {message && (
        <div className={`aep-notification-alert-box aep-alert-${messageType}`}>
          {message}
        </div>
      )}

      <div className="aep-tab-navigation-container">
        <button
          className={`aep-tab-nav-button ${activeTab === 'send' ? 'aep-tab-active' : ''}`}
          onClick={() => setActiveTab('send')}
        >
          <Send size={16} />
          <span>Send Email</span>
        </button>
        <button
          className={`aep-tab-nav-button ${activeTab === 'bulk' ? 'aep-tab-active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <Users size={16} />
          <span>Bulk Email</span>
        </button>
        <button
          className={`aep-tab-nav-button ${activeTab === 'list' ? 'aep-tab-active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          <ListChecks size={16} />
          <span>Send to List</span>
        </button>
        <button
          className={`aep-tab-nav-button ${activeTab === 'lists' ? 'aep-tab-active' : ''}`}
          onClick={() => setActiveTab('lists')}
        >
          <List size={16} />
          <span>Manage Lists</span>
        </button>
        <button
          className={`aep-tab-nav-button ${activeTab === 'templates' ? 'aep-tab-active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileText size={16} />
          <span>Templates</span>
        </button>
        <button
          className={`aep-tab-nav-button ${activeTab === 'history' ? 'aep-tab-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Mail size={16} />
          <span>History</span>
        </button>
        <button
          className={`aep-tab-nav-button ${activeTab === 'stats' ? 'aep-tab-active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 size={16} />
          <span>Statistics</span>
        </button>
      </div>

      <div className="aep-content-display-area">
        {activeTab === 'send' && (
          <div className="aep-form-card-container">
            <h2 className="aep-card-title-heading">Send Single Email</h2>
            <form onSubmit={sendSingleEmail} className="aep-email-compose-form">
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">To:</label>
                <input
                  type="email"
                  value={singleEmail.to}
                  onChange={(e) => setSingleEmail({...singleEmail, to: e.target.value})}
                  className="aep-text-input-control"
                  required
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Subject:</label>
                <input
                  type="text"
                  value={singleEmail.subject}
                  onChange={(e) => setSingleEmail({...singleEmail, subject: e.target.value})}
                  className="aep-text-input-control"
                  required
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Sender Name:</label>
                <input
                  type="text"
                  value={singleEmail.senderName}
                  onChange={(e) => setSingleEmail({...singleEmail, senderName: e.target.value})}
                  className="aep-text-input-control"
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Receiver Name:</label>
                <input
                  type="text"
                  value={singleEmail.receiverName}
                  onChange={(e) => setSingleEmail({...singleEmail, receiverName: e.target.value})}
                  className="aep-text-input-control"
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Template (Optional):</label>
                <select
                  value={singleEmail.templateId}
                  onChange={(e) => setSingleEmail({...singleEmail, templateId: e.target.value})}
                  className="aep-select-dropdown-control"
                >
                  <option value="">Use Default Template</option>
                  {emailTemplates.map(template => (
                    <option key={template._id} value={template._id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Message:</label>
                <textarea
                  value={singleEmail.message}
                  onChange={(e) => setSingleEmail({...singleEmail, message: e.target.value})}
                  className="aep-textarea-input-control"
                  rows={6}
                  required
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Attachments:</label>
                <div className="aep-file-upload-section">
                  <input
                    type="file"
                    onChange={handleSingleFileUpload}
                    multiple
                    id="aep-single-file-input"
                    className="aep-hidden-file-input"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('aep-single-file-input').click()}
                    className="aep-file-select-button"
                  >
                    <Plus size={16} />
                    Choose Files
                  </button>
                </div>
                {singleAttachments.length > 0 && (
                  <div className="aep-attachments-list-box">
                    {singleAttachments.map((file, index) => (
                      <div key={index} className="aep-attachment-item-card">
                        <span className="aep-attachment-filename">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeSingleAttachment(index)}
                          className="aep-remove-attachment-btn"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="aep-form-submit-button" disabled={loading}>
                {loading ? 'Sending...' : 'Send Email'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className="aep-form-card-container">
            <h2 className="aep-card-title-heading">Send Bulk Email</h2>
            <form onSubmit={sendBulkEmail} className="aep-email-compose-form">
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Recipients:</label>
                {bulkEmail.recipients.map((email, index) => (
                  <div key={index} className="aep-recipient-row-container">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateBulkRecipient(index, e.target.value)}
                      className="aep-text-input-control"
                      placeholder="Enter email address"
                      required
                    />
                    {bulkEmail.recipients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBulkRecipient(index)}
                        className="aep-recipient-remove-button"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBulkRecipient}
                  className="aep-add-recipient-button"
                >
                  <Plus size={16} />
                  Add Recipient
                </button>
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Subject:</label>
                <input
                  type="text"
                  value={bulkEmail.subject}
                  onChange={(e) => setBulkEmail({...bulkEmail, subject: e.target.value})}
                  className="aep-text-input-control"
                  required
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Sender Name:</label>
                <input
                  type="text"
                  value={bulkEmail.senderName}
                  onChange={(e) => setBulkEmail({...bulkEmail, senderName: e.target.value})}
                  className="aep-text-input-control"
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Receiver Name:</label>
                <input
                  type="text"
                  value={bulkEmail.receiverName}
                  onChange={(e) => setBulkEmail({...bulkEmail, receiverName: e.target.value})}
                  className="aep-text-input-control"
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Template (Optional):</label>
                <select
                  value={bulkEmail.templateId}
                  onChange={(e) => setBulkEmail({...bulkEmail, templateId: e.target.value})}
                  className="aep-select-dropdown-control"
                >
                  <option value="">Use Default Template</option>
                  {emailTemplates.map(template => (
                    <option key={template._id} value={template._id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Message:</label>
                <textarea
                  value={bulkEmail.message}
                  onChange={(e) => setBulkEmail({...bulkEmail, message: e.target.value})}
                  className="aep-textarea-input-control"
                  rows={6}
                  required
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Attachments:</label>
                <div className="aep-file-upload-section">
                  <input
                    type="file"
                    onChange={handleBulkFileUpload}
                    multiple
                    id="aep-bulk-file-input"
                    className="aep-hidden-file-input"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('aep-bulk-file-input').click()}
                    className="aep-file-select-button"
                  >
                    <Plus size={16} />
                    Choose Files
                  </button>
                </div>
                {bulkAttachments.length > 0 && (
                  <div className="aep-attachments-list-box">
                    {bulkAttachments.map((file, index) => (
                      <div key={index} className="aep-attachment-item-card">
                        <span className="aep-attachment-filename">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeBulkAttachment(index)}
                          className="aep-remove-attachment-btn"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="aep-form-submit-button" disabled={loading}>
                {loading ? 'Sending...' : 'Send Bulk Email'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="aep-form-card-container">
            <h2 className="aep-card-title-heading">Send to Subscription List</h2>
            <form onSubmit={sendToList} className="aep-email-compose-form">
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Select List:</label>
                <select
                  value={listEmail.listId}
                  onChange={(e) => setListEmail({...listEmail, listId: e.target.value})}
                  className="aep-select-dropdown-control"
                  required
                >
                  <option value="">Choose a list</option>
                  {subscriptionLists.filter(list => list.isActive).map(list => (
                    <option key={list._id} value={list._id}>
                      {list.name} ({list.subscriberCount} subscribers)
                    </option>
                  ))}
                </select>
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Subject:</label>
                <input
                  type="text"
                  value={listEmail.subject}
                  onChange={(e) => setListEmail({...listEmail, subject: e.target.value})}
                  className="aep-text-input-control"
                  required
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Sender Name:</label>
                <input
                  type="text"
                  value={listEmail.senderName}
                  onChange={(e) => setListEmail({...listEmail, senderName: e.target.value})}
                  className="aep-text-input-control"
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Receiver Name:</label>
                <input
                  type="text"
                  value={listEmail.receiverName}
                  onChange={(e) => setListEmail({...listEmail, receiverName: e.target.value})}
                  className="aep-text-input-control"
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Template (Optional):</label>
                <select
                  value={listEmail.templateId}
                  onChange={(e) => setListEmail({...listEmail, templateId: e.target.value})}
                  className="aep-select-dropdown-control"
                >
                  <option value="">Use Default Template</option>
                  {emailTemplates.map(template => (
                    <option key={template._id} value={template._id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Message:</label>
                <textarea
                  value={listEmail.message}
                  onChange={(e) => setListEmail({...listEmail, message: e.target.value})}
                  className="aep-textarea-input-control"
                  rows={6}
                  required
                />
              </div>
              <div className="aep-input-field-wrapper">
                <label className="aep-form-field-label">Attachments:</label>
                <div className="aep-file-upload-section">
                  <input
                    type="file"
                    onChange={handleListFileUpload}
                    multiple
                    id="aep-list-file-input"
                    className="aep-hidden-file-input"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('aep-list-file-input').click()}
                    className="aep-file-select-button"
                  >
                    <Plus size={16} />
                    Choose Files
                  </button>
                </div>
                {listAttachments.length > 0 && (
                  <div className="aep-attachments-list-box">
                    {listAttachments.map((file, index) => (
                      <div key={index} className="aep-attachment-item-card">
                        <span className="aep-attachment-filename">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeListAttachment(index)}
                          className="aep-remove-attachment-btn"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="aep-form-submit-button" disabled={loading}>
                {loading ? 'Sending...' : 'Send to List'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'lists' && (
          <div className="aep-lists-management-section">
            <div className="aep-lists-header-row">
              <h2 className="aep-card-title-heading">Subscription Lists</h2>
              <button
                onClick={() => setShowNewListForm(!showNewListForm)}
                className="aep-create-new-button"
              >
                <Plus size={16} />
                Create New List
              </button>
            </div>

            {showNewListForm && (
              <div className="aep-form-card-container aep-mb-20">
                <form onSubmit={createSubscriptionList} className="aep-email-compose-form">
                  <div className="aep-input-field-wrapper">
                    <label className="aep-form-field-label">List Name:</label>
                    <input
                      type="text"
                      value={newListForm.name}
                      onChange={(e) => setNewListForm({...newListForm, name: e.target.value})}
                      className="aep-text-input-control"
                      required
                    />
                  </div>
                  <div className="aep-input-field-wrapper">
                    <label className="aep-form-field-label">Description:</label>
                    <textarea
                      value={newListForm.description}
                      onChange={(e) => setNewListForm({...newListForm, description: e.target.value})}
                      className="aep-textarea-input-control"
                      rows={3}
                    />
                  </div>
                  <div className="aep-button-group">
                    <button type="submit" className="aep-form-submit-button" disabled={loading}>
                      {loading ? 'Creating...' : 'Create List'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewListForm(false)}
                      className="aep-cancel-button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="aep-lists-grid">
              {subscriptionLists.map(list => (
                <div key={list._id} className="aep-list-card">
                  <div className="aep-list-card-header">
                    <h3 className="aep-list-card-title">{list.name}</h3>
                    <span className={`aep-list-status-badge ${list.isActive ? 'aep-status-active' : 'aep-status-inactive'}`}>
                      {list.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="aep-list-description">{list.description || 'No description'}</p>
                  <div className="aep-list-stats">
                    <span className="aep-stat-item">
                      <Users size={14} />
                      {list.subscriberCount} subscribers
                    </span>
                  </div>
                  <div className="aep-list-actions">
                    <button
                      onClick={() => fetchListDetails(list._id)}
                      className="aep-action-btn aep-btn-view"
                    >
                      <Eye size={14} />
                      View
                    </button>
                    <button
                      onClick={() => toggleListStatus(list._id, list.isActive)}
                      className="aep-action-btn aep-btn-toggle"
                    >
                      <Settings size={14} />
                      {list.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteSubscriptionList(list._id)}
                      className="aep-action-btn aep-btn-delete"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

      {selectedList && (
  <div className="aep-list-details-modal">
    <div className="aep-modal-content">
      <div className="aep-modal-header">
        <h3 className="aep-modal-title">{selectedList.name} - Subscribers</h3>
        <button
          onClick={() => setSelectedList(null)}
          className="aep-modal-close-btn"
        >
          <X size={20} />
        </button>
      </div>
      
      {/* ADD SUBSCRIBER FORM */}
      <div className="aep-add-subscriber-form">
        <form onSubmit={addSubscriberToList} className="aep-inline-form">
          <input
            type="email"
            value={newSubscriberEmail}
            onChange={(e) => setNewSubscriberEmail(e.target.value)}
            placeholder="Enter email address"
            className="aep-text-input-control"
            required
          />
          <button type="submit" className="aep-form-submit-button" disabled={loading}>
            <Plus size={16} />
            {loading ? 'Adding...' : 'Add Subscriber'}
          </button>
        </form>
      </div>

      <div className="aep-modal-body">
                    {selectedList.subscribers.length === 0 ? (
                      <p className="aep-empty-state">No subscribers yet</p>
                    ) : (
                      <div className="aep-subscribers-list">
                        {selectedList.subscribers.map((sub, index) => (
                          <div key={index} className="aep-subscriber-item">
                            <div className="aep-subscriber-info">
                              <Mail size={16} />
                              <span>{sub.email}</span>
                              <span className="aep-subscriber-date">
                                {new Date(sub.subscribedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <button
                              onClick={() => removeSubscriber(selectedList._id, sub.email)}
                              className="aep-remove-subscriber-btn"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="aep-templates-management-section">
            <div className="aep-lists-header-row">
              <h2 className="aep-card-title-heading">Email Templates</h2>
              <button
                onClick={() => {
                  setShowTemplateForm(!showTemplateForm);
                  setSelectedTemplate(null);
                  setTemplateForm({ name: '', markdownContent: '', isDefault: false });
                }}
                className="aep-create-new-button"
              >
                <Plus size={16} />
                Create New Template
              </button>
            </div>

            {showTemplateForm && (
              <div className="aep-form-card-container aep-mb-20">
                <h3 className="aep-subsection-title">
                  {selectedTemplate ? 'Edit Template' : 'Create New Template'}
                </h3>
                <form onSubmit={selectedTemplate ? updateEmailTemplate : createEmailTemplate} className="aep-email-compose-form">
                  <div className="aep-input-field-wrapper">
                    <label className="aep-form-field-label">Template Name:</label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                      className="aep-text-input-control"
                      required
                    />
                  </div>
                  
                  <div className="aep-input-field-wrapper">
                    <div className="aep-markdown-editor-header">
                      <label className="aep-form-field-label">Template Content (Markdown):</label>
                      <div className="aep-markdown-toolbar">
                        <button type="button" onClick={() => insertMarkdown('bold')} className="aep-toolbar-btn" title="Bold">
                          <Bold size={16} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('italic')} className="aep-toolbar-btn" title="Italic">
                          <Italic size={16} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('h1')} className="aep-toolbar-btn" title="Heading 1">
                          <Heading size={16} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('h2')} className="aep-toolbar-btn" title="Heading 2">
                          <Heading size={14} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('h3')} className="aep-toolbar-btn" title="Heading 3">
                          <Heading size={12} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('link')} className="aep-toolbar-btn" title="Link">
                          <Link size={16} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('image')} className="aep-toolbar-btn" title="Image">
                          <Image size={16} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('code')} className="aep-toolbar-btn" title="Inline Code">
                          <Code size={16} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('codeblock')} className="aep-toolbar-btn" title="Code Block">
                          <Code size={18} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('ul')} className="aep-toolbar-btn" title="Bullet List">
                          <List size={16} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('ol')} className="aep-toolbar-btn" title="Numbered List">
                          <ListOrdered size={16} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('checkbox')} className="aep-toolbar-btn" title="Checkbox">
                          <CheckSquare size={16} />
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={templateForm.markdownContent}
                      onChange={(e) => setTemplateForm({...templateForm, markdownContent: e.target.value})}
                      className="aep-textarea-input-control aep-markdown-textarea-input"
                      rows={12}
                      placeholder="Use {{subject}}, {{message}}, {{senderName}}, {{receiverName}} as placeholders"
                      required
                    />
                    <div className="aep-markdown-help">
                      <p><strong>Available placeholders:</strong> {'{{subject}}'}, {'{{message}}'}, {'{{senderName}}'}, {'{{receiverName}}'}</p>
                    </div>
                  </div>

                  <div className="aep-input-field-wrapper">
                    <label className="aep-checkbox-label">
                      <input
                        type="checkbox"
                        checked={templateForm.isDefault}
                        onChange={(e) => setTemplateForm({...templateForm, isDefault: e.target.checked})}
                        className="aep-checkbox-input"
                      />
                      <span>Set as default template</span>
                    </label>
                  </div>

                  <div className="aep-button-group">
                    <button type="submit" className="aep-form-submit-button" disabled={loading}>
                      {loading ? 'Saving...' : (selectedTemplate ? 'Update Template' : 'Create Template')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTemplatePreview(!showTemplatePreview)}
                      className="aep-preview-button"
                    >
                      <Eye size={16} />
                      {showTemplatePreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplateForm(false);
                        setSelectedTemplate(null);
                        setTemplateForm({ name: '', markdownContent: '', isDefault: false });
                      }}
                      className="aep-cancel-button"
                    >
                      Cancel
                    </button>
                  </div>

                  {showTemplatePreview && templateForm.markdownContent && (
                    <div className="aep-template-preview-box">
                      <h4 className="aep-preview-title">Preview:</h4>
                      <div 
                        className="aep-preview-content"
                        dangerouslySetInnerHTML={{ 
                          __html: templateForm.markdownContent
                            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.+?)\*/g, '<em>$1</em>')
                            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
                            .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
                            .replace(/`(.+?)`/g, '<code>$1</code>')
                            .replace(/^- (.+)$/gm, '<li>$1</li>')
                            .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
                            .replace(/\n/g, '<br />')
                        }}
                      />
                    </div>
                  )}
                </form>
              </div>
            )}

            <div className="aep-templates-grid">
              {emailTemplates.map(template => (
                <div key={template._id} className="aep-template-card">
                  <div className="aep-template-card-header">
                    <h3 className="aep-template-card-title">{template.name}</h3>
                    {template.isDefault && (
                      <span className="aep-default-badge">Default</span>
                    )}
                  </div>
                  <div className="aep-template-preview-snippet">
                    {template.markdownContent.substring(0, 150)}...
                  </div>
                  <div className="aep-template-meta">
                    <span className="aep-meta-item">
                      Created: {new Date(template.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="aep-template-actions">
                    <button
                      onClick={() => {
                        setSelectedTemplate(template);
                        setTemplateForm({
                          name: template.name,
                          markdownContent: template.markdownContent,
                          isDefault: template.isDefault
                        });
                        setShowTemplateForm(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="aep-action-btn aep-btn-edit"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteEmailTemplate(template._id)}
                      className="aep-action-btn aep-btn-delete"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="aep-history-section">
            <h2 className="aep-card-title-heading">Email History</h2>
            
            <div className="aep-history-table-container">
              <table className="aep-history-table">
                <thead>
                  <tr>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>List</th>
                    <th>Template</th>
                    <th>Sent At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emailHistory.map(email => (
                    <tr key={email._id}>
                      <td className="aep-email-cell">{email.to}</td>
                      <td className="aep-subject-cell">{email.subject}</td>
                      <td>
                        <span className={`aep-status-badge ${email.status === 'sent' ? 'aep-status-sent' : 'aep-status-failed'}`}>
                          {email.status}
                        </span>
                      </td>
                      <td>{email.listId?.name || '-'}</td>
                      <td>{email.templateId?.name || 'Default'}</td>
                      <td className="aep-date-cell">
                        {new Date(email.sentAt).toLocaleString()}
                      </td>
                      <td>
                        <button
                          onClick={() => deleteEmail(email._id)}
                          className="aep-table-action-btn aep-btn-delete-small"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <div className="aep-pagination-controls">
                <button
                  onClick={() => fetchEmailHistory(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="aep-pagination-btn"
                >
                  Previous
                </button>
                <span className="aep-pagination-info">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => fetchEmailHistory(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="aep-pagination-btn"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="aep-stats-section">
            <h2 className="aep-card-title-heading">Email Statistics</h2>
            
            <div className="aep-stats-grid">
              <div className="aep-stat-card">
                <div className="aep-stat-icon aep-stat-icon-primary">
                  <Mail size={24} />
                </div>
                <div className="aep-stat-content">
                  <h3 className="aep-stat-label">Total Emails</h3>
                  <p className="aep-stat-value">{stats.total || 0}</p>
                </div>
              </div>

              <div className="aep-stat-card">
                <div className="aep-stat-icon aep-stat-icon-success">
                  <Send size={24} />
                </div>
                <div className="aep-stat-content">
                  <h3 className="aep-stat-label">Successfully Sent</h3>
                  <p className="aep-stat-value">{stats.sent || 0}</p>
                </div>
              </div>

              <div className="aep-stat-card">
                <div className="aep-stat-icon aep-stat-icon-danger">
                  <X size={24} />
                </div>
                <div className="aep-stat-content">
                  <h3 className="aep-stat-label">Failed</h3>
                  <p className="aep-stat-value">{stats.failed || 0}</p>
                </div>
              </div>

              <div className="aep-stat-card">
                <div className="aep-stat-icon aep-stat-icon-info">
                  <BarChart3 size={24} />
                </div>
                <div className="aep-stat-content">
                  <h3 className="aep-stat-label">Last 24 Hours</h3>
                  <p className="aep-stat-value">{stats.last24Hours || 0}</p>
                </div>
              </div>

              <div className="aep-stat-card">
                <div className="aep-stat-icon aep-stat-icon-warning">
                  <List size={24} />
                </div>
                <div className="aep-stat-content">
                  <h3 className="aep-stat-label">Total Lists</h3>
                  <p className="aep-stat-value">{stats.totalLists || 0}</p>
                </div>
              </div>

              <div className="aep-stat-card">
                <div className="aep-stat-icon aep-stat-icon-success">
                  <CheckSquare size={24} />
                </div>
                <div className="aep-stat-content">
                  <h3 className="aep-stat-label">Active Lists</h3>
                  <p className="aep-stat-value">{stats.activeLists || 0}</p>
                </div>
              </div>

              <div className="aep-stat-card">
                <div className="aep-stat-icon aep-stat-icon-primary">
                  <Users size={24} />
                </div>
                <div className="aep-stat-content">
                  <h3 className="aep-stat-label">Total Subscribers</h3>
                  <p className="aep-stat-value">{stats.totalSubscribers || 0}</p>
                </div>
              </div>

              <div className="aep-stat-card">
                <div className="aep-stat-icon aep-stat-icon-info">
                  <FileText size={24} />
                </div>
                <div className="aep-stat-content">
                  <h3 className="aep-stat-label">Success Rate</h3>
                  <p className="aep-stat-value">
                    {stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailAdminPanel;