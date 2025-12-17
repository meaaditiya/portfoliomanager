import React, { useState, useEffect } from 'react';
import { X, Upload, Pencil, Trash2, Plus, FileText, Image as ImageIcon, Bold, Italic, Type, List, Code, Video, Link as LinkIcon, Palette } from 'lucide-react';
import './PrivacyPolicy.css';
const PolicyAdmin = () => {
    const [policies, setPolicies] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showTabModal, setShowTabModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [showMarkdownHelper, setShowMarkdownHelper] = useState(false);
    const [imageModal, setImageModal] = useState({
        isOpen: false,
        url: '',
        alt: '',
        caption: '',
        position: 'center'
    });
    const [videoModal, setVideoModal] = useState({
        isOpen: false,
        url: '',
        title: '',
        caption: '',
        position: 'center',
        autoplay: false,
        muted: false
    });
    const [formData, setFormData] = useState({
        policyType: ''
    });
    const [tabFormData, setTabFormData] = useState({
        tabId: '',
        tabName: '',
        content: '',
        contentFormat: 'markdown',
        tabOrder: 0
    });
    const [currentPolicy, setCurrentPolicy] = useState(null);
    const [currentTab, setCurrentTab] = useState(null);
    const API_BASE = 'https://aadibgmg.onrender.com/api';
    const token = localStorage.getItem('token');
    useEffect(() => {
        fetchPolicies();
    }, []);
    const fetchPolicies = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/admin/policy`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setPolicies(data.policies || []);
        } catch (error) {
            console.error('Error fetching policies:', error);
            setError('Failed to fetch policies');
        } finally {
            setLoading(false);
        }
    };
    const extractVideoInfo = (url) => {
    const youtubeRegex =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        if (youtubeMatch) {
            return { platform: 'youtube', videoId: youtubeMatch[1], url };
        }
        const vimeoRegex = /(?:vimeo\.com\/)([0-9]+)/;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch) {
            return { platform: 'vimeo', videoId: vimeoMatch[1], url };
        }

        const dailymotionRegex = /(?:dailymotion\.com\/video\/)([a-zA-Z0-9]+)/;
        const dailymotionMatch = url.match(dailymotionRegex);
        if (dailymotionMatch) {
            return { platform: 'dailymotion', videoId: dailymotionMatch[1], url };
        }

        return null;
    };
    const insertTextAtCursor = (text) => {
        const textarea = document.getElementById('tabContent');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = tabFormData.content.substring(0, start) + text + tabFormData.content.substring(end);
        setTabFormData(prev => ({ ...prev, content: newContent }));

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
    };
    const insertMarkdownSyntax = (syntax) => {
        const textarea = document.getElementById('tabContent');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = tabFormData.content;
        const selectedText = text.substring(start, end);
        let newText = '';
        let cursorPos = start;
        switch (syntax) {
            case 'bold':
                newText = text.substring(0, start) + `**${selectedText || 'bold text'}**` + text.substring(end);
                cursorPos = start + 2;
                break;
            case 'italic':
                newText = text.substring(0, start) + `*${selectedText || 'italic text'}*` + text.substring(end);
                cursorPos = start + 1;
                break;
            case 'heading':
                newText = text.substring(0, start) + `## ${selectedText || 'Heading'}` + text.substring(end);
                cursorPos = start + 3;
                break;
            case 'list':
                newText = text.substring(0, start) + `- ${selectedText || 'List item'}` + text.substring(end);
                cursorPos = start + 2;
                break;
            case 'code':
                newText = text.substring(0, start) + `\`${selectedText || 'code'}\`` + text.substring(end);
                cursorPos = start + 1;
                break;
            case 'image':
                setImageModal(prev => ({ ...prev, isOpen: true }));
                return;
            case 'video':
                setVideoModal(prev => ({ ...prev, isOpen: true }));
                return;
            default:
                newText = text;
        }

        setTabFormData(prev => ({ ...prev, content: newText }));
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(cursorPos, cursorPos);
        }, 0);
    };
    const insertColorSpan = () => {
        const colorInput = prompt('Enter color (hex code like #FF5733):', '#FF5733');
        if (!colorInput) return;
        insertTextAtCursor(<span style="color: ${colorInput}">colored text</span>);
    };
    const handleAddImage = async () => {
        if (!imageModal.url.trim()) {
            setError('Please enter an image URL');
            return;
        }
        try {
            new URL(imageModal.url);
        } catch {
            setError('Please enter a valid URL');
            return;
        }

        if (currentPolicy && currentTab) {
            try {
                setLoading(true);
                const response = await fetch(
                    `${API_BASE}/admin/policy/${currentPolicy._id}/tabs/${currentTab.tabId}/images`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            url: imageModal.url,
                            alt: imageModal.alt,
                            caption: imageModal.caption,
                            position: imageModal.position
                        })
                    }
                );

                const data = await response.json();
                if (response.ok) {
                    insertTextAtCursor(`[IMAGE:${data.image.imageId}]`);
                } else {
                    setError(data.message || 'Failed to add image');
                }
            } catch (err) {
                setError('Failed to add image');
            } finally {
                setLoading(false);
            }
        }

        setImageModal({
            isOpen: false,
            url: '',
            alt: '',
            caption: '',
            position: 'center'
        });
    };
    const handleAddVideo = async () => {
        if (!videoModal.url.trim()) {
            setError('Please enter a video URL');
            return;
        }
        const videoInfo = extractVideoInfo(videoModal.url);
        if (!videoInfo) {
            setError('Invalid video URL. Supported: YouTube, Vimeo, Dailymotion');
            return;
        }

        if (currentPolicy && currentTab) {
            try {
                setLoading(true);
                const response = await fetch(
                    `${API_BASE}/admin/policy/${currentPolicy._id}/tabs/${currentTab.tabId}/videos`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            url: videoModal.url,
                            title: videoModal.title,
                            caption: videoModal.caption,
                            position: videoModal.position,
                            autoplay: videoModal.autoplay,
                            muted: videoModal.muted
                        })
                    }
                );

                const data = await response.json();
                if (response.ok) {
                    insertTextAtCursor(`[VIDEO:${data.video.embedId}]`);
                } else {
                    setError(data.message || 'Failed to add video');
                }
            } catch (err) {
                setError('Failed to add video');
            } finally {
                setLoading(false);
            }
        }

        setVideoModal({
            isOpen: false,
            url: '',
            title: '',
            caption: '',
            position: 'center',
            autoplay: false,
            muted: false
        });
    };
    const handleCreatePolicy = async (e) => {
        e.preventDefault();
        if (!formData.policyType.trim()) {
            setError('Policy type is required');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/admin/policy`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ policyType: formData.policyType })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessMessage('Policy created successfully');
                fetchPolicies();
                setTimeout(() => {
                    setSuccessMessage('');
                    setShowModal(false);
                    setFormData({ policyType: '' });
                }, 2000);
            } else {
                setError(data.error || 'Failed to create policy');
            }
        } catch (error) {
            setError('Failed to create policy');
        } finally {
            setLoading(false);
        }
    };
    const handleCreateTab = async (e) => {
        e.preventDefault();
        if (!tabFormData.tabId.trim() || !tabFormData.tabName.trim()) {
            setError('Tab ID and name are required');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(
                `${API_BASE}/admin/policy/${currentPolicy._id}/tabs`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tabId: tabFormData.tabId,
                        tabName: tabFormData.tabName,
                        tabOrder: tabFormData.tabOrder
                    })
                }
            );

            const data = await response.json();

            if (response.ok) {
                setSuccessMessage('Tab created successfully');
                const updatedPolicy = await fetch(`${API_BASE}/admin/policy/${currentPolicy._id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(res => res.json());
                setCurrentPolicy(updatedPolicy.policy);
                resetTabForm();
                setShowTabModal(false);
            } else {
                setError(data.message || 'Failed to create tab');
            }
        } catch (error) {
            setError('Failed to create tab');
        } finally {
            setLoading(false);
        }
    };
    const handleSaveTabContent = async (e) => {
        e.preventDefault();
        if (!tabFormData.content.trim()) {
            setError('Content is required');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(
                `${API_BASE}/admin/policy/${currentPolicy._id}/tabs/${currentTab.tabId}/content`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        content: tabFormData.content,
                        contentFormat: tabFormData.contentFormat
                    })
                }
            );

            const data = await response.json();

            if (response.ok) {
                setSuccessMessage('Content saved successfully');
                const updatedPolicy = await fetch(`${API_BASE}/admin/policy/${currentPolicy._id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(res => res.json());
                setCurrentPolicy(updatedPolicy.policy);
                const updatedTab = updatedPolicy.policy.tabs.find(t => t.tabId === currentTab.tabId);
                setCurrentTab(updatedTab);
            } else {
                setError(data.message || 'Failed to save content');
            }
        } catch (error) {
            setError('Failed to save content');
        } finally {
            setLoading(false);
        }
    };
    const handleDeleteTab = async (tabId) => {
        if (!window.confirm('Delete this tab? This action cannot be undone.')) return;
        try {
            setLoading(true);
            const response = await fetch(
                `${API_BASE}/admin/policy/${currentPolicy._id}/tabs/${tabId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (response.ok) {
                setSuccessMessage('Tab deleted successfully');
                const updatedPolicy = await fetch(`${API_BASE}/admin/policy/${currentPolicy._id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(res => res.json());
                setCurrentPolicy(updatedPolicy.policy);
                setCurrentTab(null);
            } else {
                setError('Failed to delete tab');
            }
        } catch (error) {
            setError('Failed to delete tab');
        } finally {
            setLoading(false);
        }
    };
    const handleDeletePolicy = async (id) => {
        if (!window.confirm('Delete this policy? This action cannot be undone.')) return;
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/admin/policy/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setSuccessMessage('Policy deleted successfully');
                fetchPolicies();
                setCurrentPolicy(null);
                setCurrentTab(null);
            } else {
                setError('Failed to delete policy');
            }
        } catch (error) {
            setError('Failed to delete policy');
        } finally {
            setLoading(false);
        }
    };
    const handleSelectTab = (tab) => {
        setCurrentTab(tab);
        setTabFormData({
            tabId: tab.tabId,
            tabName: tab.tabName,
            content: tab.content,
            contentFormat: tab.contentFormat,
            tabOrder: tab.tabOrder
        });
    };
    const resetTabForm = () => {
        setTabFormData({
            tabId: '',
            tabName: '',
            content: '',
            contentFormat: 'markdown',
            tabOrder: 0
        });
    };
    const openCreatePolicyModal = () => {
        setFormData({ policyType: '' });
        setShowModal(true);
    };
    const closeModal = () => {
        setShowModal(false);
        setShowTabModal(false);
        setShowMarkdownHelper(false);
        setError(null);
    };
    if (!currentPolicy) {
        return (
            <div className="policy-admin-wrapper">
                <div className="policy-admin-header">
                    <h1>Privacy Policy Management</h1>
                    <button className="policy-btn policy-btn-primary" onClick={openCreatePolicyModal}>
                        <Plus size={20} /> Create Policy
                    </button>
                </div>
                {successMessage && (
                    <div className="policy-success-message">
                        {successMessage}
                        <button onClick={() => setSuccessMessage('')} className="policy-close-msg">×</button>
                    </div>
                )}

                {error && (
                    <div className="policy-error-message">
                        {error}
                        <button onClick={() => setError(null)} className="policy-close-msg">×</button>
                    </div>
                )}

                {loading && <div className="policy-loading">Loading...</div>}

                <div className="policy-list">
                    {policies.map((policy) => (
                        <div key={policy._id} className="policy-card">
                            <div className="policy-card-header">
                                <h3>{policy.policyType}</h3>
                                <span className="policy-badge">{policy.tabsCount} tabs</span>
                            </div>

                            <div className="policy-card-content">
                                <p className="policy-tabs-list">
                                    {policy.tabsCount > 0
                                        ? policy.tabs.map(t => t.tabName).join(', ')
                                        : 'No tabs yet'}
                                </p>
                            </div>

                            <div className="policy-card-actions">
                                <button
                                    className="policy-btn policy-btn-secondary"
                                    onClick={() => {
                                        const fetchAndSetPolicy = async () => {
                                            try {
                                                const res = await fetch(`${API_BASE}/admin/policy/${policy._id}`, {
                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                });
                                                const data = await res.json();
                                                setCurrentPolicy(data.policy);
                                            } catch (err) {
                                                setError('Failed to load policy');
                                            }
                                        };
                                        fetchAndSetPolicy();
                                    }}
                                >
                                    <Pencil size={16} /> Manage
                                </button>
                                <button
                                    className="policy-btn policy-btn-danger"
                                    onClick={() => handleDeletePolicy(policy._id)}
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {policies.length === 0 && !loading && (
                    <div className="policy-empty">
                        <p>No policies found. Create your first policy!</p>
                    </div>
                )}

                {showModal && (
                    <div className="policy-modal-backdrop" onClick={closeModal}>
                        <div className="policy-modal-dialog" onClick={(e) => e.stopPropagation()}>
                            <div className="policy-modal-header">
                                <h2>Create New Policy</h2>
                                <button className="policy-close-btn" onClick={closeModal}><X size={24} /></button>
                            </div>
                            <form onSubmit={handleCreatePolicy} className="policy-form">
                                <div className="policy-form-group">
                                    <label>Policy Type *</label>
                                    <input
                                        type="text"
                                        value={formData.policyType}
                                        onChange={(e) => setFormData(prev => ({ ...prev, policyType: e.target.value }))}
                                        placeholder="e.g., Privacy Policy, Terms of Service"
                                        required
                                    />
                                </div>
                                <div className="policy-form-actions">
                                    <button type="button" className="policy-btn policy-btn-secondary" onClick={closeModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="policy-btn policy-btn-primary" disabled={loading}>
                                        {loading ? 'Creating...' : 'Create Policy'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }
    return (
        <div className="policy-admin-wrapper">
            <div className="policy-admin-editor">
                <div className="policy-editor-header">
                    <button className="policy-btn policy-btn-secondary" onClick={() => setCurrentPolicy(null)}>
                        ← Back to Policies
                    </button>
                    <h2>{currentPolicy.policyType}</h2>
                    <div className="policy-editor-header-actions">
                        <button className="policy-btn policy-btn-primary" onClick={() => { resetTabForm(); setShowTabModal(true); }}>
                            <Plus size={16} /> Add Tab
                        </button>
                        <button className="policy-btn policy-btn-danger" onClick={() => handleDeletePolicy(currentPolicy._id)}>
                            <Trash2 size={16} /> Delete Policy
                        </button>
                    </div>
                </div>
                {successMessage && (
                    <div className="policy-success-message">
                        {successMessage}
                        <button onClick={() => setSuccessMessage('')} className="policy-close-msg">×</button>
                    </div>
                )}

                {error && (
                    <div className="policy-error-message">
                        {error}
                        <button onClick={() => setError(null)} className="policy-close-msg">×</button>
                    </div>
                )}

                <div className="policy-editor-container">
                    <div className="policy-tabs-sidebar">
                        <h3>Tabs ({currentPolicy.tabs.length})</h3>
                        <div className="policy-tabs-list-vertical">
                            {currentPolicy.tabs.length > 0 ? (
                                currentPolicy.tabs.map(tab => (
                                    <div
                                        key={tab._id}
                                        className={`policy-tab-item ${currentTab?._id === tab._id ? 'policy-tab-active' : ''}`}
                                        onClick={() => handleSelectTab(tab)}
                                    >
                                        <span>{tab.tabName}</span>
                                        <button
                                            className="policy-tab-delete"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTab(tab.tabId);
                                            }}
                                            title="Delete tab"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="policy-no-tabs">No tabs yet. Create one to get started!</p>
                            )}
                        </div>
                    </div>

                    <div className="policy-editor-main">
                        {currentTab ? (
                            <form onSubmit={handleSaveTabContent} className="policy-form">
                                <div className="policy-form-group">
                                    <label>Tab Name</label>
                                    <input
                                        type="text"
                                        value={tabFormData.tabName}
                                        disabled
                                        className="policy-input-disabled"
                                    />
                                </div>

                                <div className="policy-form-group">
                                    <div className="policy-format-switch">
                                        <label>Content Format</label>
                                        <div>
                                            <label className="policy-radio-label">
                                                <input
                                                    type="radio"
                                                    name="contentFormat"
                                                    value="markdown"
                                                    checked={tabFormData.contentFormat === 'markdown'}
                                                    onChange={(e) => setTabFormData(prev => ({ ...prev, contentFormat: e.target.value }))}
                                                />
                                                Markdown
                                            </label>
                                            <label className="policy-radio-label">
                                                <input
                                                    type="radio"
                                                    name="contentFormat"
                                                    value="plain"
                                                    checked={tabFormData.contentFormat === 'plain'}
                                                    onChange={(e) => setTabFormData(prev => ({ ...prev, contentFormat: e.target.value }))}
                                                />
                                                Plain Text
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {tabFormData.contentFormat === 'markdown' && (
                                    <div className="policy-markdown-toolbar">
                                        <button type="button" onClick={() => insertMarkdownSyntax('bold')} title="Bold"><Bold size={16} /></button>
                                        <button type="button" onClick={() => insertMarkdownSyntax('italic')} title="Italic"><Italic size={16} /></button>
                                        <button type="button" onClick={() => insertMarkdownSyntax('heading')} title="Heading"><Type size={16} /></button>
                                        <button type="button" onClick={() => insertMarkdownSyntax('list')} title="List"><List size={16} /></button>
                                        <button type="button" onClick={() => insertMarkdownSyntax('code')} title="Code"><Code size={16} /></button>
                                        <button type="button" onClick={() => insertMarkdownSyntax('image')} title="Image"><ImageIcon size={16} /></button>
                                        <button type="button" onClick={() => insertMarkdownSyntax('video')} title="Video"><Video size={16} /></button>
                                        <button type="button" onClick={insertColorSpan} title="Color"><Palette size={16} /></button>
                                        <button
                                            type="button"
                                            onClick={() => setShowMarkdownHelper(!showMarkdownHelper)}
                                            className="policy-help-btn"
                                        >
                                            ?
                                        </button>
                                    </div>
                                )}

                                {showMarkdownHelper && tabFormData.contentFormat === 'markdown' && (
                                    <div className="policy-markdown-helper">
                                        <h4>Markdown Guide:</h4>
                                        <ul>
                                            <li><strong>Bold:</strong> **text**</li>
                                            <li><strong>Italic:</strong> *text*</li>
                                            <li><strong>Heading:</strong> ## Heading</li>
                                            <li><strong>List:</strong> - item</li>
                                            <li><strong>Code:</strong> `code`</li>
                                            <li><strong>Image:</strong> Use image button</li>
                                            <li><strong>Video:</strong> Use video button</li>
                                        </ul>
                                    </div>
                                )}

                                <div className="policy-form-group">
                                    <label>Content *</label>
                                    <textarea
                                        id="tabContent"
                                        value={tabFormData.content}
                                        onChange={(e) => setTabFormData(prev => ({ ...prev, content: e.target.value }))}
                                        rows="12"
                                        placeholder="Enter your policy content here..."
                                        required
                                    />
                                </div>

                                <div className="policy-form-actions">
                                    <button type="button" className="policy-btn policy-btn-secondary" onClick={() => setCurrentTab(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="policy-btn policy-btn-primary" disabled={loading}>
                                        {loading ? 'Saving...' : 'Save Content'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="policy-no-tab">
                                <p>Select a tab to edit or create a new one</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showTabModal && (
                <div className="policy-modal-backdrop" onClick={closeModal}>
                    <div className="policy-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="policy-modal-header">
                            <h2>Create New Tab</h2>
                            <button className="policy-close-btn" onClick={closeModal}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreateTab} className="policy-form">
                            <div className="policy-form-group">
                                <label>Tab ID *</label>
                                <input
                                    type="text"
                                    value={tabFormData.tabId}
                                    onChange={(e) => setTabFormData(prev => ({ ...prev, tabId: e.target.value }))}
                                    placeholder="e.g., privacy-main, terms-services"
                                    required
                                />
                            </div>
                            <div className="policy-form-group">
                                <label>Tab Name *</label>
                                <input
                                    type="text"
                                    value={tabFormData.tabName}
                                    onChange={(e) => setTabFormData(prev => ({ ...prev, tabName: e.target.value }))}
                                    placeholder="e.g., Main Policy, Additional Terms"
                                    required
                                />
                            </div>
                            <div className="policy-form-group">
                                <label>Tab Order</label>
                                <input
                                    type="number"
                                    value={tabFormData.tabOrder}
                                    onChange={(e) => setTabFormData(prev => ({ ...prev, tabOrder: parseInt(e.target.value) }))}
                                    min="0"
                                />
                            </div>
                            <div className="policy-form-actions">
                                <button type="button" className="policy-btn policy-btn-secondary" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="policy-btn policy-btn-primary" disabled={loading}>
                                    {loading ? 'Creating...' : 'Create Tab'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {imageModal.isOpen && (
                <div className="policy-modal-backdrop" onClick={() => setImageModal(prev => ({ ...prev, isOpen: false }))}>
                    <div className="policy-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="policy-modal-header">
                            <h3>Add Image to Content</h3>
                            <button className="policy-close-btn" onClick={() => setImageModal(prev => ({ ...prev, isOpen: false }))}><X size={24} /></button>
                        </div>
                        <div className="policy-form">
                            <div className="policy-form-group">
                                <label>Image URL *</label>
                                <input
                                    type="url"
                                    value={imageModal.url}
                                    onChange={(e) => setImageModal(prev => ({ ...prev, url: e.target.value }))}
                                    placeholder="https://example.com/image.jpg"
                                    required
                                />
                            </div>
                            <div className="policy-form-group">
                                <label>Alt Text</label>
                                <input
                                    type="text"
                                    value={imageModal.alt}
                                    onChange={(e) => setImageModal(prev => ({ ...prev, alt: e.target.value }))}
                                    placeholder="Description for accessibility"
                                />
                            </div>
                            <div className="policy-form-group">
                                <label>Caption</label>
                                <input
                                    type="text"
                                    value={imageModal.caption}
                                    onChange={(e) => setImageModal(prev => ({ ...prev, caption: e.target.value }))}
                                    placeholder="Image caption (optional)"
                                />
                            </div>
                            <div className="policy-form-group">
                                <label>Position</label>
                                <select
                                    value={imageModal.position}
                                    onChange={(e) => setImageModal(prev => ({ ...prev, position: e.target.value }))}
                                >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                    <option value="right">Right</option>
                                    <option value="full-width">Full WidthContinue12:09 AM</option>
                                </select>
                            </div>
                            {imageModal.url && (
                                <div className="policy-image-preview">
                                    <p>Preview:</p>
                                    <img
                                        src={imageModal.url}
                                        alt="Preview"
                                        onError={(e) => {
                                            e.target.src = 'https://via.placeholder.com/400x200?text=Invalid+Image';
                                        }}
                                    />
                                </div>
                            )}
                            <div className="policy-form-actions">
                                <button type="button" className="policy-btn policy-btn-secondary" onClick={() => setImageModal(prev => ({ ...prev, isOpen: false }))}>
                                    Cancel
                                </button>
                                <button type="button" className="policy-btn policy-btn-primary" onClick={handleAddImage} disabled={!imageModal.url.trim()}>
                                    Add Image
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {videoModal.isOpen && (
                <div className="policy-modal-backdrop" onClick={() => setVideoModal(prev => ({ ...prev, isOpen: false }))}>
                    <div className="policy-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="policy-modal-header">
                            <h3>Add Video to Content</h3>
                            <button className="policy-close-btn" onClick={() => setVideoModal(prev => ({ ...prev, isOpen: false }))}><X size={24} /></button>
                        </div>
                        <div className="policy-form">
                            <div className="policy-form-group">
                                <label>Video URL *</label>
                                <input
                                    type="url"
                                    value={videoModal.url}
                                    onChange={(e) => setVideoModal(prev => ({ ...prev, url: e.target.value }))}
                                    placeholder="https://youtube.com/watch?v=..."
                                    required
                                />
                                <small>Supported: YouTube, Vimeo, Dailymotion</small>
                            </div>
                            <div className="policy-form-group">
                                <label>Video Title</label>
                                <input
                                    type="text"
                                    value={videoModal.title}
                                    onChange={(e) => setVideoModal(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Video title (optional)"
                                />
                            </div>
                            <div className="policy-form-group">
                                <label>Caption</label>
                                <input
                                    type="text"
                                    value={videoModal.caption}
                                    onChange={(e) => setVideoModal(prev => ({ ...prev, caption: e.target.value }))}
                                    placeholder="Video caption (optional)"
                                />
                            </div>
                            <div className="policy-form-group">
                                <label>Position</label>
                                <select
                                    value={videoModal.position}
                                    onChange={(e) => setVideoModal(prev => ({ ...prev, position: e.target.value }))}
                                >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                    <option value="right">Right</option>
                                    <option value="full-width">Full Width</option>
                                </select>
                            </div>
                            <div className="policy-checkbox-group">
                                <label className="policy-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={videoModal.autoplay}
                                        onChange={(e) => setVideoModal(prev => ({ ...prev, autoplay: e.target.checked }))}
                                    />
                                    Autoplay
                                </label>
                                <label className="policy-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={videoModal.muted}
                                        onChange={(e) => setVideoModal(prev => ({ ...prev, muted: e.target.checked }))}
                                    />
                                    Muted
                                </label>
                            </div>
                            <div className="policy-form-actions">
                                <button type="button" className="policy-btn policy-btn-secondary" onClick={() => setVideoModal(prev => ({ ...prev, isOpen: false }))}>
                                    Cancel
                                </button>
                                <button type="button" className="policy-btn policy-btn-primary" onClick={handleAddVideo} disabled={!videoModal.url.trim()}>
                                    Add Video
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default PolicyAdmin;