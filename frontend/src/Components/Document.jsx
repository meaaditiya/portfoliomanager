import React, { useState, useEffect } from 'react';
import { Folder, LinkIcon, Star, CheckSquare, File, ExternalLink, Upload, FolderPlus, Trash2, Edit2, Download, Home, ChevronRight, Search, X, Move, FileSpreadsheet, ArrowLeft, Check, Circle, Heart, Lock, Unlock, Shield, Link2, Copy } from 'lucide-react';
import './FileManager.css';

export default function FileManager() {
  const [currentFolder, setCurrentFolder] = useState(null);
  const [items, setItems] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: 'Root', type: 'folder' }]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [renameItem, setRenameItem] = useState(null);
  const [moveItem, setMoveItem] = useState(null);
  const [folderTree, setFolderTree] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [message, setMessage] = useState('');
  const [showNewLinkModal, setShowNewLinkModal] = useState(false);
  const [excelData, setExcelData] = useState(null);
  const [viewingExcel, setViewingExcel] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [linkFormData, setLinkFormData] = useState({ name: '', url: '' });
  const [showBookmarkToggleModal, setShowBookmarkToggleModal] = useState(false);
  const [bookmarkToggleItem, setBookmarkToggleItem] = useState(null);
  const [showCheckmarkFieldsModal, setShowCheckmarkFieldsModal] = useState(false);
  const [checkmarkFieldsItem, setCheckmarkFieldsItem] = useState(null);
  const [checkmarkFields, setCheckmarkFields] = useState([]);
  const [editingExcel, setEditingExcel] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue] = useState('');
  const [editingHeader, setEditingHeader] = useState(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessItem, setAccessItem] = useState(null);
  const [accessLevel, setAccessLevel] = useState('public');
  const [showGenerateLinkModal, setShowGenerateLinkModal] = useState(false);
  const [generateLinkItem, setGenerateLinkItem] = useState(null);
  const [linkExpiry, setLinkExpiry] = useState(24);
  const [maxAccessCount, setMaxAccessCount] = useState('');
  const [generatedLinks, setGeneratedLinks] = useState([]);
  const [showAccessRequestsModal, setShowAccessRequestsModal] = useState(false);
  const [accessRequests, setAccessRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [headerValue, setHeaderValue] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState(null);

  const CHECKMARK_TYPES = [
    { id: 'checkbox', label: 'Checkbox', icon: CheckSquare },
    { id: 'check', label: 'Check', icon: Check },
    { id: 'circle', label: 'Circle', icon: Circle },
    { id: 'star', label: 'Star', icon: Star },
    { id: 'heart', label: 'Heart', icon: Heart }
  ];

  const API_URL = 'https://connectwithaaditiyamg2.onrender.com';
  const token = localStorage.getItem('token');

  // Load folder contents
  const loadFolder = async (folderId = null) => {
    try {
      const url = folderId 
        ? `${API_URL}/api/folder/contents?parentId=${folderId}`
        : `${API_URL}/api/folder/contents`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      setItems(data.items || []);
      setCurrentFolder(data.currentFolder);
      
      if (folderId) {
        const breadcrumbRes = await fetch(`${API_URL}/api/item/${folderId}/breadcrumb`);
        const breadcrumbData = await breadcrumbRes.json();
        setBreadcrumb([{ id: null, name: 'Root', type: 'folder' }, ...breadcrumbData.breadcrumb]);
      } else {
        setBreadcrumb([{ id: null, name: 'Root', type: 'folder' }]);
      }
      
      setSearchResults(null);
      setViewingExcel(null);
      setExcelData(null);
    } catch (err) {
      console.error('Error loading folder:', err);
    }
  };

  // Load folder tree for move modal
  const loadFolderTree = async () => {
    try {
      const res = await fetch(`${API_URL}/api/folder/tree`);
      const data = await res.json();
      setFolderTree(data.tree || []);
    } catch (err) {
      console.error('Error loading tree:', err);
    }
  };

  useEffect(() => {
    loadFolder();
  }, []);

  // Create folder
  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/folder/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newFolderName,
          parentId: currentFolder?._id || null
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        showMessage('Folder created successfully');
        setNewFolderName('');
        setShowNewFolderModal(false);
        loadFolder(currentFolder?._id);
      } else {
        showMessage(data.message || 'Error creating folder', 'error');
      }
    } catch (err) {
      showMessage('Error creating folder', 'error');
    }
  };

  // Create link
  const createLink = async () => {
    if (!linkFormData.name.trim() || !linkFormData.url.trim()) {
      showMessage('Link name and URL are required', 'error');
      return;
    }

    try {
      new URL(linkFormData.url);
    } catch (e) {
      showMessage('Invalid URL format', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/link/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: linkFormData.name,
          url: linkFormData.url,
          parentId: currentFolder?._id || null
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        showMessage('Link created successfully');
        setLinkFormData({ name: '', url: '' });
        setShowNewLinkModal(false);
        loadFolder(currentFolder?._id);
      } else {
        showMessage(data.message || 'Error creating link', 'error');
      }
    } catch (err) {
      showMessage('Error creating link', 'error');
    }
  };

  // Upload file
  const uploadFile = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (currentFolder?._id) {
      formData.append('parentId', currentFolder._id);
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/document/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      
      if (res.ok) {
        showMessage('File uploaded successfully');
        loadFolder(currentFolder?._id);
      } else {
        showMessage(data.message || 'Error uploading file', 'error');
      }
    } catch (err) {
      showMessage('Error uploading file', 'error');
    }
  };

  // Delete item
  const deleteItem = async (item) => {
    if (!confirm(`Delete ${item.name}?`)) return;

    try {
      const endpoint = item.type === 'folder' && confirm('Delete all contents?')
        ? `${API_URL}/api/admin/folder/${item._id}/recursive`
        : `${API_URL}/api/admin/item/${item._id}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showMessage('Deleted successfully');
        loadFolder(currentFolder?._id);
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error deleting', 'error');
      }
    } catch (err) {
      showMessage('Error deleting', 'error');
    }
  };

  // Rename item
  const renameItemFunc = async () => {
    if (!renameName.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/item/${renameItem._id}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newName: renameName })
      });

      if (res.ok) {
        showMessage('Renamed successfully');
        setShowRenameModal(false);
        setRenameItem(null);
        loadFolder(currentFolder?._id);
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error renaming', 'error');
      }
    } catch (err) {
      showMessage('Error renaming', 'error');
    }
  };

  // Move item
  const moveItemFunc = async (targetFolderId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/item/${moveItem._id}/move`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newParentId: targetFolderId })
      });

      if (res.ok) {
        showMessage('Moved successfully');
        setShowMoveModal(false);
        setMoveItem(null);
        loadFolder(currentFolder?._id);
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error moving', 'error');
      }
    } catch (err) {
      showMessage('Error moving', 'error');
    }
  };

  // Search
  const performSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      showMessage('Error searching', 'error');
    }
  };

  // Download file
  const downloadFile = async (item) => {
    try {
      const res = await fetch(`${API_URL}/api/download/${item._id}`);
      const data = await res.json();
      window.open(data.downloadUrl, '_blank');
    } catch (err) {
      showMessage('Error downloading', 'error');
    }
  };

  // Drag and drop
  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetFolder) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem._id === targetFolder._id) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/item/${draggedItem._id}/move`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newParentId: targetFolder._id })
      });

      if (res.ok) {
        showMessage(`Moved ${draggedItem.name} to ${targetFolder.name}`);
        loadFolder(currentFolder?._id);
      }
    } catch (err) {
      showMessage('Error moving', 'error');
    }
    
    setDraggedItem(null);
  };

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // Set access level
  const setDocumentAccessLevel = async (item, level, inheritParent = false) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/access/${item._id}/level`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          accessLevel: level,
          inheritParentAccess: inheritParent
        })
      });

      if (res.ok) {
        showMessage(`Access level set to ${level}`);
        setShowAccessModal(false);
        loadFolder(currentFolder?._id);
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error setting access level', 'error');
      }
    } catch (err) {
      showMessage('Error setting access level', 'error');
    }
  };

  // Generate private link
  const generatePrivateLink = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/access/${generateLinkItem._id}/generate-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          expiryHours: parseInt(linkExpiry),
          maxAccessCount: maxAccessCount ? parseInt(maxAccessCount) : null
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        showMessage('Private link generated successfully');
        setGeneratedLinks([...generatedLinks, data]);
        loadAccessSettings(generateLinkItem._id);
      } else {
        showMessage(data.message || 'Error generating link', 'error');
      }
    } catch (err) {
      showMessage('Error generating link', 'error');
    }
  };

  // Load access settings
  const loadAccessSettings = async (itemId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/access/${itemId}/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      if (res.ok) {
        setGeneratedLinks(data.privateAccessLinks || []);
      }
    } catch (err) {
      console.error('Error loading access settings:', err);
    }
  };

  // Revoke private link
  const revokePrivateLink = async (itemId, linkId) => {
    if (!confirm('Revoke this access link?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/admin/access/${itemId}/link/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        showMessage('Link revoked successfully');
        loadAccessSettings(itemId);
      } else {
        showMessage('Error revoking link', 'error');
      }
    } catch (err) {
      showMessage('Error revoking link', 'error');
    }
  };

  // Load access requests
  const loadAccessRequests = async (status = 'pending') => {
    try {
      const res = await fetch(`${API_URL}/api/admin/access-requests?status=${status}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      if (res.ok) {
        setAccessRequests(data.requests || []);
      }
    } catch (err) {
      showMessage('Error loading access requests', 'error');
    }
  };

  // Approve access request
  const approveAccessRequest = async (requestId, expiryHours = 720, adminResponse = '') => {
    try {
      const res = await fetch(`${API_URL}/api/admin/access-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          expiryHours: parseInt(expiryHours),
          adminResponse
        })
      });

      if (res.ok) {
        showMessage('Access request approved and email sent');
        loadAccessRequests();
        setSelectedRequest(null);
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error approving request', 'error');
      }
    } catch (err) {
      showMessage('Error approving request', 'error');
    }
  };

  // Reject access request
  const rejectAccessRequest = async (requestId, adminResponse = '') => {
    try {
      const res = await fetch(`${API_URL}/api/admin/access-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adminResponse
        })
      });

      if (res.ok) {
        showMessage('Access request rejected');
        loadAccessRequests();
        setSelectedRequest(null);
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error rejecting request', 'error');
      }
    } catch (err) {
      showMessage('Error rejecting request', 'error');
    }
  };

  // Toggle bookmark
  const toggleBookmarkAvailability = async (item, enabled) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/item/${item._id}/bookmark-toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled })
      });

      if (res.ok) {
        showMessage(`Bookmarking ${enabled ? 'enabled' : 'disabled'} for ${item.name}`);
        setShowBookmarkToggleModal(false);
        loadFolder(currentFolder?._id);
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error updating bookmark setting', 'error');
      }
    } catch (err) {
      showMessage('Error updating bookmark setting', 'error');
    }
  };

  // Checkmark fields
  const saveCheckmarkFields = async () => {
    if (checkmarkFields.some(f => !f.fieldName || !f.fieldId)) {
      showMessage('All fields must have a name and ID', 'error');
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/admin/excel/${checkmarkFieldsItem._id}/checkmark-fields`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ fields: checkmarkFields })
        }
      );

      if (res.ok) {
        showMessage('Checkmark fields updated successfully');
        setShowCheckmarkFieldsModal(false);
        setCheckmarkFieldsItem(null);
        loadFolder(currentFolder?._id);
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error updating fields', 'error');
      }
    } catch (err) {
      showMessage('Error updating checkmark fields', 'error');
    }
  };

  const addCheckmarkField = () => {
    setCheckmarkFields([
      ...checkmarkFields,
      { 
        fieldName: '', 
        fieldId: `field_${Date.now()}`,
        checkmarkType: 'checkbox' 
      }
    ]);
  };

  const updateCheckmarkField = (index, key, value) => {
    const updated = [...checkmarkFields];
    updated[index][key] = value;
    setCheckmarkFields(updated);
  };

  const removeCheckmarkField = (index) => {
    setCheckmarkFields(checkmarkFields.filter((_, i) => i !== index));
  };

  const loadExcelCheckmarkFields = async (excelId) => {
    try {
      const res = await fetch(`${API_URL}/api/excel/${excelId}/data`);
      const data = await res.json();
      setCheckmarkFields(data.checkmarkFields || []);
    } catch (err) {
      setCheckmarkFields([]);
    }
  };

  // Excel upload
  const uploadExcelFile = async (file) => {
    if (!file) return;

    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (!validTypes.includes(file.type)) {
      showMessage('Please upload only Excel (.xlsx, .xls) or CSV files', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (currentFolder?._id) {
      formData.append('parentId', currentFolder._id);
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/excel/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      
      if (res.ok) {
        showMessage('Excel file uploaded successfully');
        loadFolder(currentFolder?._id);
      } else {
        showMessage(data.message || 'Error uploading Excel file', 'error');
      }
    } catch (err) {
      showMessage('Error uploading Excel file', 'error');
    }
  };

  // Excel editing
  const enterEditMode = (item) => {
    setEditingExcel(item);
    setEditMode(true);
    loadExcelData(item);
  };

  const exitEditMode = () => {
    setEditMode(false);
    setEditingExcel(null);
    setSelectedCell(null);
    setEditingCell(null);
    setCellValue('');
  };

  const updateCell = async (rowIndex, columnName, newValue) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/excel/${editingExcel._id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'UPDATE_CELL',
          data: {
            sheetName: selectedSheet,
            rowIndex,
            columnName,
            newValue
          }
        })
      });

      if (res.ok) {
        const result = await res.json();
        setExcelData({
          ...excelData,
          data: {
            ...excelData.data,
            [selectedSheet]: result.data
          }
        });
        showMessage('Cell updated');
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error updating cell', 'error');
      }
    } catch (err) {
      showMessage('Error updating cell', 'error');
    }
  };

  const updateHeader = async (oldColumnName, newColumnName) => {
    if (!newColumnName.trim() || oldColumnName === newColumnName) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/excel/${editingExcel._id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'UPDATE_HEADER',
          data: {
            sheetName: selectedSheet,
            columnName: oldColumnName,
            newColumnName: newColumnName.trim()
          }
        })
      });

      if (res.ok) {
        const result = await res.json();
        setExcelData({
          ...excelData,
          data: {
            ...excelData.data,
            [selectedSheet]: result.data
          }
        });
        showMessage('Column renamed');
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error renaming column', 'error');
      }
    } catch (err) {
      showMessage('Error renaming column', 'error');
    }
  };

  const deleteRow = async (rowIndex) => {
    if (!confirm('Delete this row?')) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/excel/${editingExcel._id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'DELETE_ROW',
          data: {
            sheetName: selectedSheet,
            rowIndex
          }
        })
      });

      if (res.ok) {
        const result = await res.json();
        setExcelData({
          ...excelData,
          data: {
            ...excelData.data,
            [selectedSheet]: result.data
          },
          rowCount: result.rowCount
        });
        showMessage('Row deleted');
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error deleting row', 'error');
      }
    } catch (err) {
      showMessage('Error deleting row', 'error');
    }
  };

  const deleteColumn = async (columnName) => {
    if (!confirm(`Delete column "${columnName}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/excel/${editingExcel._id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'DELETE_COLUMN',
          data: {
            sheetName: selectedSheet,
            columnName
          }
        })
      });

      if (res.ok) {
        const result = await res.json();
        setExcelData({
          ...excelData,
          data: {
            ...excelData.data,
            [selectedSheet]: result.data
          },
          columnCount: result.columnCount
        });
        showMessage('Column deleted');
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error deleting column', 'error');
      }
    } catch (err) {
      showMessage('Error deleting column', 'error');
    }
  };

  const addRow = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/excel/${editingExcel._id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'ADD_ROW',
          data: {
            sheetName: selectedSheet
          }
        })
      });

      if (res.ok) {
        const result = await res.json();
        setExcelData({
          ...excelData,
          data: {
            ...excelData.data,
            [selectedSheet]: result.data
          },
          rowCount: result.rowCount
        });
        showMessage('Row added');
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error adding row', 'error');
      }
    } catch (err) {
      showMessage('Error adding row', 'error');
    }
  };

  const addColumn = async () => {
    const colName = prompt('Enter column name:');
    if (!colName || !colName.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/excel/${editingExcel._id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'ADD_COLUMN',
          data: {
            sheetName: selectedSheet,
            newColumnName: colName.trim()
          }
        })
      });

      if (res.ok) {
        const result = await res.json();
        setExcelData({
          ...excelData,
          data: {
            ...excelData.data,
            [selectedSheet]: result.data
          },
          columnCount: result.columnCount
        });
        showMessage('Column added');
      } else {
        const data = await res.json();
        showMessage(data.message || 'Error adding column', 'error');
}
} catch (err) {
showMessage('Error adding column', 'error');
}
};
// Keyboard navigation
const handleCellKeyDown = (e, rowIndex, colIndex, headers) => {
if (editingCell) return;
const currentRow = rowIndex;
const currentCol = colIndex;

switch(e.key) {
  case 'ArrowUp':
    e.preventDefault();
    if (currentRow > 0) {
      setSelectedCell({ row: currentRow - 1, col: currentCol });
    }
    break;
  case 'ArrowDown':
    e.preventDefault();
    const sheetData = excelData.data[selectedSheet];
    if (currentRow < sheetData.length - 1) {
      setSelectedCell({ row: currentRow + 1, col: currentCol });
    }
    break;
  case 'ArrowLeft':
    e.preventDefault();
    if (currentCol > 0) {
      setSelectedCell({ row: currentRow, col: currentCol - 1 });
    }
    break;
  case 'ArrowRight':
    e.preventDefault();
    if (currentCol < headers.length - 1) {
      setSelectedCell({ row: currentRow, col: currentCol + 1 });
    }
    break;
  case 'Enter':
    e.preventDefault();
    setEditingCell({ row: currentRow, col: currentCol });
    const cellVal = excelData.data[selectedSheet][currentRow][headers[currentCol]];
    setCellValue(cellVal || '');
    break;
  case 'Delete':
    e.preventDefault();
    if (editMode) {
      updateCell(currentRow, headers[currentCol], '');
    }
    break;
}
};
const saveCellEdit = (rowIndex, columnName) => {
if (editingCell) {
updateCell(rowIndex, columnName, cellValue);
setEditingCell(null);
setCellValue('');
}
};
const saveHeaderEdit = (oldName) => {
if (editingHeader && headerValue.trim()) {
updateHeader(oldName, headerValue);
setEditingHeader(null);
setHeaderValue('');
}
};
const loadExcelData = async (excelItem) => {
try {
const res = await fetch(`${API_URL}/api/excel/${excelItem._id}/data`);
const data = await res.json();
  setExcelData(data);
  setViewingExcel(excelItem);
  setSelectedSheet(data.sheetNames?.[0] || null);
} catch (err) {
  showMessage('Error loading Excel data', 'error');
}
};
const closeExcelView = () => {
setExcelData(null);
setViewingExcel(null);
setSelectedSheet(null);
};
const isURL = (value) => {
if (typeof value !== 'string') return false;
if (!value || value.trim() === '') return false;
const stringValue = value.trim();

const urlPattern = /^(https?:\/\/)/i;
if (urlPattern.test(stringValue)) {
  try {
    new URL(stringValue);
    return true;
  } catch {
    return false;
  }
}

const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}(\/.*)?$/;
if (domainPattern.test(stringValue)) {
  try {
    new URL('https://' + stringValue);
    return true;
  } catch {
    return false;
  }
}

return false;
};
const renderCellValue = (value) => {
if (value === null || value === undefined || value === '') return '-';
const stringValue = String(value).trim();

if (isURL(stringValue)) {
  let fullUrl = stringValue;
  if (!stringValue.startsWith('http://') && !stringValue.startsWith('https://')) {
    fullUrl = 'https://' + stringValue;
  }
  
  let displayText = stringValue;
  try {
    const urlObj = new URL(fullUrl);
    displayText = urlObj.hostname;
    if (urlObj.pathname && urlObj.pathname !== '/') {
      const pathPart = urlObj.pathname.substring(0, 15);
      displayText += pathPart + (urlObj.pathname.length > 15 ? '...' : '');
    }
  } catch (e) {
    displayText = stringValue.substring(0, 35) + (stringValue.length > 35 ? '...' : '');
  }
  
  return (
    <a 
      href={fullUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="fm-table__link"
      onClick={(e) => e.stopPropagation()}
      title={fullUrl}
    >
      <ExternalLink size={14} className="fm-table__link-icon" />
      <span className="fm-table__link-text">{displayText}</span>
    </a>
  );
}

return stringValue;
};
const renderExcelTable = () => {
if (!excelData || !selectedSheet) return null;
const sheetData = excelData.data[selectedSheet];
if (!sheetData || sheetData.length === 0) {
  return <div className="fm-empty-state">No data in this sheet</div>;
}

const headers = Object.keys(sheetData[0]);

return (
  <div className="fm-excel-view">
    <div className="fm-excel-header">
      <button onClick={closeExcelView} className="fm-back-btn">
        <ArrowLeft size={20} />
        <span>Back to Files</span>
      </button>
      <h2 className="fm-excel-title">
        <FileSpreadsheet size={24} className="fm-excel-title__icon" />
        {viewingExcel.name}
      </h2>
      {!editMode ? (
        <button
          onClick={() => enterEditMode(viewingExcel)}
          className="fm-tool-btn fm-excel-header__edit"
        >
          <Edit2 size={16} />
          <span>Edit File</span>
        </button>
      ) : (
        <button
          onClick={exitEditMode}
          className="fm-tool-btn fm-excel-header__done"
        >
          <Check size={16} />
          <span>Done Editing</span>
        </button>
      )}
    </div>

    {excelData.sheetNames && excelData.sheetNames.length > 1 && (
      <div className="fm-sheet-tabs">
        {excelData.sheetNames.map(sheetName => (
          <button
            key={sheetName}
            onClick={() => setSelectedSheet(sheetName)}
            className={`fm-sheet-tab ${selectedSheet === sheetName ? 'fm-sheet-tab--active' : ''}`}
          >
            {sheetName}
          </button>
        ))}
      </div>
    )}

    <div className="fm-excel-info">
      <span>Total Rows: {sheetData.length}</span>
      <span>Columns: {headers.length}</span>
      {editMode && <span className="fm-excel-info__edit-mode">● EDIT MODE</span>}
    </div>

    {editMode && (
      <div className="fm-edit-toolbar">
        <button onClick={addRow} className="fm-edit-btn">
          + Add Row
        </button>
        <button onClick={addColumn} className="fm-edit-btn">
          + Add Column
        </button>
        <div className="fm-edit-hint">
          <span>💡 Click cells to edit • Arrow keys to navigate • Enter to edit • Delete to clear</span>
        </div>
      </div>
    )}

    <div className="fm-table-wrapper">
      <table className="fm-table">
        <thead>
          <tr>
            <th className="fm-table__header">#</th>
            {editMode && <th className="fm-table__header fm-table__header--actions">Actions</th>}
            {headers.map((header, colIndex) => (
              <th key={header} className="fm-table__header">
                {editMode ? (
                  <div className="fm-header-edit-container">
                    {editingHeader === colIndex ? (
                      <input
                        type="text"
                        value={headerValue}
                        onChange={(e) => setHeaderValue(e.target.value)}
                        onBlur={() => saveHeaderEdit(header)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') saveHeaderEdit(header);
                        }}
                        className="fm-header-input"
                        autoFocus
                      />
                    ) : (
                      <>
                        <span 
                          onClick={() => {
                            setEditingHeader(colIndex);
                            setHeaderValue(header);
                          }}
                          className="fm-editable-header"
                        >
                          {header}
                        </span>
                        <button
                          onClick={() => deleteColumn(header)}
                          className="fm-mini-delete-btn"
                          title="Delete Column"
                        >
                          <X size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheetData.map((row, rowIndex) => (
            <tr 
              key={rowIndex} 
              className={`fm-table__row ${selectedCell?.row === rowIndex ? 'fm-table__row--selected' : ''}`}
            >
              <td className="fm-table__cell">{rowIndex + 1}</td>
              {editMode && (
                <td className="fm-table__cell">
                  <button
                    onClick={() => deleteRow(rowIndex)}
                    className="fm-row-delete-btn"
                    title="Delete Row"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
              {headers.map((header, colIndex) => {
                const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                
                return (
                  <td
                    key={header}
                    className={`fm-table__cell ${isSelected ? 'fm-table__cell--selected' : ''} ${editMode ? 'fm-table__cell--editable' : ''}`}
                    onClick={() => {
                      if (editMode) {
                        setSelectedCell({ row: rowIndex, col: colIndex });
                      }
                    }}
                    onDoubleClick={() => {
                      if (editMode) {
                        setEditingCell({ row: rowIndex, col: colIndex });
                        setCellValue(row[header] || '');
                      }
                    }}
                    onKeyDown={(e) => editMode && handleCellKeyDown(e, rowIndex, colIndex, headers)}
                    tabIndex={editMode ? 0 : -1}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={() => saveCellEdit(rowIndex, header)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            saveCellEdit(rowIndex, header);
                            setSelectedCell({ row: rowIndex + 1, col: colIndex });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingCell(null);
                            setCellValue('');
                          }
                        }}
                        className="fm-cell-input"
                        autoFocus
                      />
                    ) : (
                      renderCellValue(row[header])
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
};
const renderFolderTree = (folders, level = 0) => {
return folders.filter(f => f.type === 'folder').map(folder => (
<div key={folder._id}>
<div
className="fm-tree-item"

onClick={() => folder._id !== moveItem?._id && moveItemFunc(folder._id)}
>
<Folder size={16} />
<span className="fm-tree-item__name">{folder.name}</span>
</div>
{folder.children && renderFolderTree(folder.children, level + 1)}
</div>
));
};
// Copy to clipboard function
const copyToClipboard = (text, linkId) => {
navigator.clipboard.writeText(text).then(() => {
setCopiedLinkId(linkId);
showMessage('Link copied to clipboard');
setTimeout(() => setCopiedLinkId(null), 2000);
}).catch(() => {
showMessage('Failed to copy link', 'error');
});
};
if (viewingExcel && excelData) {
return (
<div className="fm-container">
{message && <div className="fm-message">{message}</div>}
{renderExcelTable()}
</div>
);
}
return (
<div className="fm-container">
{/* Header */}
<div className="fm-header">
<div className="fm-header__left">
<Folder size={24} className="fm-header__icon" />
<h2 className="fm-header__title">File Manager</h2>
</div>
    <div className="fm-search-bar">
      <input
        type="text"
        placeholder="Search files and folders..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && performSearch()}
        className="fm-search-input"
      />
      <button onClick={performSearch} className="fm-search-btn">
        <Search size={16} />
      </button>
      {searchResults && (
        <button onClick={() => setSearchResults(null)} className="fm-clear-btn">
          <X size={16} />
        </button>
      )}
    </div>
  </div>

  {/* Message */}
  {message && (
    <div className="fm-message">
      {message}
    </div>
  )}

  {/* Breadcrumb */}
  {!searchResults && (
    <div className="fm-breadcrumb">
      {breadcrumb.map((crumb, idx) => (
        <React.Fragment key={crumb.id || 'root'}>
          <span
            className={`fm-breadcrumb__item ${idx === breadcrumb.length - 1 ? 'fm-breadcrumb__item--active' : ''}`}
            onClick={() => loadFolder(crumb.id)}
          >
            {idx === 0 ? <Home size={16} /> : crumb.name}
          </span>
          {idx < breadcrumb.length - 1 && <ChevronRight size={16} className="fm-breadcrumb__chevron" />}
        </React.Fragment>
      ))}
    </div>
  )}

  {/* Toolbar */}
  <div className="fm-toolbar">
    <input
      type="file"
      id="fileInput"
      className="fm-file-input"
      onChange={(e) => uploadFile(e.target.files[0])}
    />
    
    <button
      onClick={() => document.getElementById('fileInput').click()}
      className="fm-tool-btn"
    >
      <Upload size={16} />
      <span>Upload File</span>
    </button>

    <button
      onClick={() => setShowNewFolderModal(true)}
      className="fm-tool-btn"
    >
      <FolderPlus size={16} />
      <span>New Folder</span>
    </button>

    <button
      onClick={() => setShowNewLinkModal(true)}
      className="fm-tool-btn"
    >
      <LinkIcon size={16} />
      <span>Add Link</span>
    </button>

    <input
      type="file"
      id="excelInput"
      accept=".xlsx,.xls,.csv"
      className="fm-file-input"
      onChange={(e) => uploadExcelFile(e.target.files[0])}
    />

    <button
      onClick={() => document.getElementById('excelInput').click()}
      className="fm-tool-btn"
    >
      <FileSpreadsheet size={16} />
      <span>Upload Excel</span>
    </button>

    <button
      onClick={() => {
        loadAccessRequests();
        setShowAccessRequestsModal(true);
      }}
      className="fm-tool-btn fm-tool-btn--access"
    >
      <Shield size={16} />
      <span>Access Requests</span>
    </button>
  </div>

  {/* File Grid */}
  <div className="fm-file-grid">
    {searchResults ? (
      <>
        <h3 className="fm-section-title">Links ({searchResults.links?.length || 0})</h3>
        {searchResults.links?.map(item => (
          <div key={item._id} className="fm-file-item">
            <LinkIcon size={40} className="fm-file-item__icon fm-file-item__icon--link" />
            <div className="fm-file-item__name">{item.name}</div>
            <div className="fm-file-item__link-url">{item.url}</div>
            <div className="fm-file-item__path">{item.path}</div>
            <div className="fm-file-item__actions">
              <button 
                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')} 
                className="fm-icon-btn"
                title="Open Link"
              >
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        ))}

        <h3 className="fm-section-title">Excel Files ({searchResults.excels?.length || 0})</h3>
        {searchResults.excels?.map(item => (
          <div key={item._id} className="fm-file-item">
            <FileSpreadsheet size={40} className="fm-file-item__icon fm-file-item__icon--excel" />
            <div className="fm-file-item__name">{item.name}</div>
            <div className="fm-file-item__path">{item.path}</div>
            <div className="fm-file-item__actions">
              <button onClick={() => loadExcelData(item)} className="fm-icon-btn">
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        ))}

        <h3 className="fm-section-title">Files ({searchResults.files?.length || 0})</h3>
        {searchResults.files?.map(item => (
          <div key={item._id} className="fm-file-item">
            <File size={40} className="fm-file-item__icon fm-file-item__icon--file" />
            <div className="fm-file-item__name">{item.name}</div>
            <div className="fm-file-item__path">{item.path}</div>
            <div className="fm-file-item__actions">
              <button onClick={() => downloadFile(item)} className="fm-icon-btn">
                <Download size={16} />
              </button>
            </div>
          </div>
        ))}
      </>
    ) : (
      <>
        {items.length === 0 ? (
          <div className="fm-empty-state">
            <Folder size={64} className="fm-empty-state__icon" />
            <p>This folder is empty</p>
            <p className="fm-empty-state__hint">Upload files or create folders to get started</p>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item._id}
              className={`fm-file-item ${draggedItem?._id === item._id ? 'fm-file-item--dragging' : ''}`}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={item.type === 'folder' ? handleDragOver : undefined}
              onDrop={item.type === 'folder' ? (e) => handleDrop(e, item) : undefined}
              onDoubleClick={() => {
                if (item.type === 'folder') {
                  loadFolder(item._id);
                } else if (item.type === 'link') {
                  window.open(item.url, '_blank', 'noopener,noreferrer');
                } else if (item.type === 'excel') {
                  loadExcelData(item);
                }
              }}
            >
              {item.type === 'folder' ? (
                <Folder size={40} className="fm-file-item__icon fm-file-item__icon--folder" />
              ) : item.type === 'link' ? (
                <LinkIcon size={40} className="fm-file-item__icon fm-file-item__icon--link" />
              ) : item.type === 'excel' ? (
                <FileSpreadsheet size={40} className="fm-file-item__icon fm-file-item__icon--excel" />
              ) : (
                <File size={40} className="fm-file-item__icon fm-file-item__icon--file" />
              )}

              <div className="fm-file-item__name">{item.name}</div>
              
              {item.type === 'file' && (
                <div className="fm-file-item__size">
                  {(item.size / 1024).toFixed(2)} KB
                </div>
              )}

              {item.type === 'link' && (
                <div className="fm-file-item__link-url">{item.url}</div>
              )}

              {item.type === 'excel' && (
                <div className="fm-file-item__size">
                  {item.rowCount} rows • {item.columnCount} cols
                </div>
              )}

              <div className="fm-file-item__actions">
                {item.type === 'file' && (
                  <button onClick={() => downloadFile(item)} className="fm-icon-btn" title="Download">
                    <Download size={16} />
                  </button>
                )}
                
                {item.type === 'link' && (
                  <button 
                    onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')} 
                    className="fm-icon-btn" 
                    title="Open Link"
                  >
                    <ExternalLink size={16} />
                  </button>
                )}

                {item.type === 'excel' && (
                  <button 
                    onClick={() => loadExcelData(item)} 
                    className="fm-icon-btn" 
                    title="View Data"
                  >
                    <ExternalLink size={16} />
                  </button>
                )}

                <button
                  onClick={() => {
                    setRenameItem(item);
                    setRenameName(item.name);
                    setShowRenameModal(true);
                  }}
                  className="fm-icon-btn"
                  title="Rename"
                >
                  <Edit2 size={16} />
                </button>

                <button
                  onClick={() => {
                    setMoveItem(item);
                    loadFolderTree();
                    setShowMoveModal(true);
                  }}
                  className="fm-icon-btn"
                  title="Move"
                >
                  <Move size={16} />
                </button>

                <button
                  onClick={() => deleteItem(item)}
                  className="fm-icon-btn fm-icon-btn--delete"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBookmarkToggleItem(item);
                    setShowBookmarkToggleModal(true);
                  }}
                  className={`fm-icon-btn ${item.bookmarkEnabled ? 'fm-icon-btn--active' : ''}`}
                  title={item.bookmarkEnabled ? 'Bookmarking Enabled' : 'Enable Bookmarking'}
                >
                  <Star size={16} fill={item.bookmarkEnabled ? 'currentColor' : 'none'} />
                </button>

                {item.type === 'excel' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCheckmarkFieldsItem(item);
                      loadExcelCheckmarkFields(item._id);
                      setShowCheckmarkFieldsModal(true);
                    }}
                    className="fm-icon-btn"
                    title="Manage Checkmark Fields"
                  >
                    <CheckSquare size={16} />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAccessItem(item);
                    setAccessLevel(item.accessLevel || 'public');
                    loadAccessSettings(item._id);
                    setShowAccessModal(true);
                  }}
                  className={`fm-icon-btn fm-icon-btn--access ${item.accessLevel === 'locked' ? 'fm-icon-btn--locked' : item.accessLevel === 'private' ? 'fm-icon-btn--private' : ''}`}
                  title={`Access: ${item.accessLevel || 'public'}`}
                >
                  {item.accessLevel === 'locked' ? <Lock size={16} /> : 
                   item.accessLevel === 'private' ? <Shield size={16} /> : 
                   <Unlock size={16} />}
                </button>
              </div>
            </div>
          ))
        )}
      </>
    )}
  </div>

  {/* Modals */}
  {showNewFolderModal && (
    <div className="fm-modal" onClick={() => setShowNewFolderModal(false)}>
      <div className="fm-modal__content" onClick={(e) => e.stopPropagation()}>
        <h3>Create New Folder</h3>
        <input
          type="text"
          placeholder="Folder name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && createFolder()}
          className="fm-input"
          autoFocus
        />
        <div className="fm-modal__actions">
          <button onClick={() => setShowNewFolderModal(false)} className="fm-cancel-btn">
            Cancel
          </button>
          <button onClick={createFolder} className="fm-submit-btn">
            Create
          </button>
        </div>
      </div>
    </div>
  )}

  {showRenameModal && (
    <div className="fm-modal" onClick={() => setShowRenameModal(false)}>
      <div className="fm-modal__content" onClick={(e) => e.stopPropagation()}>
        <h3>Rename {renameItem?.type}</h3>
        <input
          type="text"
          value={renameName}
          onChange={(e) => setRenameName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && renameItemFunc()}
          className="fm-input"
          autoFocus
        />
        <div className="fm-modal__actions">
          <button onClick={() => setShowRenameModal(false)} className="fm-cancel-btn">
            Cancel
          </button>
          <button onClick={renameItemFunc} className="fm-submit-btn">
            Rename
          </button>
        </div>
      </div>
    </div>
  )}

  {showMoveModal && (
    <div className="fm-modal" onClick={() => setShowMoveModal(false)}>
      <div className="fm-modal__content" onClick={(e) => e.stopPropagation()}>
        <h3>Move {moveItem?.name}</h3>
        <div className="fm-tree-container">
          <div
            className="fm-tree-item"
            onClick={() => moveItemFunc(null)}
          >
            <Home size={16} />
            <span className="fm-tree-item__name">Root</span>
          </div>
          {renderFolderTree(folderTree)}
        </div>
        <div className="fm-modal__actions">
          <button onClick={() => setShowMoveModal(false)} className="fm-cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )}

  {showNewLinkModal && (
    <div className="fm-modal" onClick={() => setShowNewLinkModal(false)}>
      <div className="fm-modal__content" onClick={(e) => e.stopPropagation()}>
        <h3>Add New Link</h3>
        <input
          type="text"
          placeholder="Link name"
          value={linkFormData.name}
          onChange={(e) => setLinkFormData({...linkFormData, name: e.target.value})}
          className="fm-input"
          autoFocus
        />
        <input
          type="url"
          placeholder="https://example.com"
          value={linkFormData.url}
          onChange={(e) => setLinkFormData({...linkFormData, url: e.target.value})}
          onKeyPress={(e) => e.key === 'Enter' && createLink()}
          className="fm-input"
        />
        <div className="fm-modal__actions">
          <button onClick={() => setShowNewLinkModal(false)} className="fm-cancel-btn">
            Cancel
          </button>
          <button onClick={createLink} className="fm-submit-btn">
            Add Link
          </button>
        </div>
      </div>
    </div>
  )}

  {showBookmarkToggleModal && bookmarkToggleItem && (
    <div className="fm-modal" onClick={() => setShowBookmarkToggleModal(false)}>
      <div className="fm-modal__content" onClick={(e) => e.stopPropagation()}>
        <h3>Bookmark Settings</h3>
        <p className="fm-modal__item-name"><strong>{bookmarkToggleItem.name}</strong></p>
        <p>
          Current Status: {bookmarkToggleItem.bookmarkEnabled ? (
            <span className="fm-status fm-status--enabled">Enabled</span>
) : (
<span className="fm-status fm-status--disabled">Disabled</span>
)}
</p>
<p className="fm-modal__description">
When enabled, users can bookmark this item for quick access.
</p>
<div className="fm-modal__actions">
<button
onClick={() => {
toggleBookmarkAvailability(bookmarkToggleItem, false);
}}
className="fm-cancel-btn"
>
Disable Bookmarking
</button>
<button
onClick={() => {
toggleBookmarkAvailability(bookmarkToggleItem, true);
}}
className="fm-submit-btn"
>
Enable Bookmarking
</button>
</div>
</div>
</div>
)}
  {showCheckmarkFieldsModal && checkmarkFieldsItem && (
    <div className="fm-modal" onClick={() => setShowCheckmarkFieldsModal(false)}>
      <div className="fm-modal__content fm-modal__content--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Manage Checkmark Fields</h3>
        <p className="fm-modal__description">
          <strong>{checkmarkFieldsItem.name}</strong>
          <br />
          Add custom checkmark columns that users can check/uncheck for each row.
        </p>
        
        {checkmarkFields.length === 0 ? (
          <div className="fm-empty-fields">
            No checkmark fields yet. Add one below.
          </div>
        ) : (
          checkmarkFields.map((field, index) => (
            <div key={index} className="fm-checkmark-field">
              <input
                type="text"
                placeholder="Field Name (e.g., Complete)"
                value={field.fieldName}
                onChange={(e) => updateCheckmarkField(index, 'fieldName', e.target.value)}
                className="fm-input fm-checkmark-field__input"
              />
              <input
                type="text"
                placeholder="Field ID (e.g., complete)"
                value={field.fieldId}
                onChange={(e) => updateCheckmarkField(index, 'fieldId', e.target.value)}
                className="fm-input fm-checkmark-field__input"
                disabled
              />
              <select
                value={field.checkmarkType || 'checkbox'}
                onChange={(e) => updateCheckmarkField(index, 'checkmarkType', e.target.value)}
                className="fm-input fm-checkmark-field__select"
              >
                {CHECKMARK_TYPES.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeCheckmarkField(index)}
                className="fm-icon-btn fm-icon-btn--delete"
                title="Remove Field"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
        
        <button
          onClick={addCheckmarkField}
          className="fm-tool-btn fm-add-field-btn"
        >
          <span>+ Add Checkmark Field</span>
        </button>
        
        <div className="fm-modal__actions">
          <button
            onClick={() => {
              setShowCheckmarkFieldsModal(false);
              setCheckmarkFieldsItem(null);
            }}
            className="fm-cancel-btn"
          >
            Cancel
          </button>
          <button onClick={saveCheckmarkFields} className="fm-submit-btn">
            Save Fields
          </button>
        </div>
      </div>
    </div>
  )}

  {showAccessModal && accessItem && (
    <div className="fm-modal" onClick={() => setShowAccessModal(false)}>
      <div className="fm-modal__content fm-modal__content--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Access Control: {accessItem.name}</h3>
        
        <div className="fm-access-section">
          <label className="fm-access-label">Access Level:</label>
          
          <div className="fm-access-options">
            <label className="fm-radio-label">
              <input
                type="radio"
                name="accessLevel"
                value="public"
                checked={accessLevel === 'public'}
                onChange={(e) => setAccessLevel(e.target.value)}
              />
              <Unlock size={16} className="fm-radio-label__icon" />
              <div className="fm-radio-label__content">
                <strong>Public</strong>
                <p className="fm-radio-label__description">
                  Anyone can view and access this item
                </p>
              </div>
            </label>
            
            <label className="fm-radio-label">
              <input
                type="radio"
                name="accessLevel"
                value="private"
                checked={accessLevel === 'private'}
                onChange={(e) => setAccessLevel(e.target.value)}
              />
              <Shield size={16} className="fm-radio-label__icon fm-radio-label__icon--private" />
              <div className="fm-radio-label__content">
                <strong>Private</strong>
                <p className="fm-radio-label__description">
                  Requires authentication or special access link
                </p>
              </div>
            </label>
            
            <label className="fm-radio-label">
              <input
                type="radio"
                name="accessLevel"
                value="locked"
                checked={accessLevel === 'locked'}
                onChange={(e) => setAccessLevel(e.target.value)}
              />
              <Lock size={16} className="fm-radio-label__icon fm-radio-label__icon--locked" />
              <div className="fm-radio-label__content">
                <strong>Locked</strong>
                <p className="fm-radio-label__description">
                  Only metadata visible, no content access
                </p>
              </div>
            </label>
          </div>
        </div>

        {accessLevel === 'private' && (
          <div className="fm-access-links-section">
            <h4 className="fm-access-links-title">Private Access Links</h4>
            
            {generatedLinks.length === 0 ? (
              <p className="fm-access-links-empty">
                No access links generated yet
              </p>
            ) : (
              <div className="fm-access-links-list">
                {generatedLinks.map((link, idx) => (
                  <div key={idx} className="fm-access-link">
                    <div className="fm-access-link__content">
                      <div className="fm-access-link__url">
                        {link.accessUrl?.substring(0, 50)}...
                      </div>
                      <div className="fm-access-link__meta">
                        Uses: {link.accessCount} | 
                        Expires: {link.expiresAt ? new Date(link.expiresAt).toLocaleString() : 'Never'} |
                        Status: {link.isActive ? '✓ Active' : '✗ Revoked'}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(link.accessUrl, link.linkId)}
                      className={`fm-copy-btn ${copiedLinkId === link.linkId ? 'fm-copy-btn--copied' : ''}`}
                      title="Copy link to clipboard"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => revokePrivateLink(accessItem._id, link.linkId)}
                      className="fm-icon-btn fm-icon-btn--delete"
                      disabled={!link.isActive}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={() => {
                setGenerateLinkItem(accessItem);
                setShowGenerateLinkModal(true);
              }}
              className="fm-tool-btn fm-generate-link-btn"
            >
              <Link2 size={16} />
              <span>Generate New Link</span>
            </button>
          </div>
        )}

        <div className="fm-modal__actions">
          <button onClick={() => setShowAccessModal(false)} className="fm-cancel-btn">
            Cancel
          </button>
          <button 
            onClick={() => setDocumentAccessLevel(accessItem, accessLevel)}
            className="fm-submit-btn"
          >
            Save Access Level
          </button>
        </div>
      </div>
    </div>
  )}

  {showGenerateLinkModal && generateLinkItem && (
    <div className="fm-modal" onClick={() => setShowGenerateLinkModal(false)}>
      <div className="fm-modal__content" onClick={(e) => e.stopPropagation()}>
        <h3>Generate Private Access Link</h3>
        <p className="fm-modal__description">
          Create a shareable link for: <strong>{generateLinkItem.name}</strong>
        </p>
        
        <label className="fm-form-label">
          Link Expiry (hours):
        </label>
        <input
          type="number"
          value={linkExpiry}
          onChange={(e) => setLinkExpiry(e.target.value)}
          className="fm-input"
          placeholder="24"
          min="1"
        />
        <p className="fm-form-hint">
          Leave blank for no expiry
        </p>
        
        <label className="fm-form-label">
          Max Access Count (optional):
        </label>
        <input
          type="number"
          value={maxAccessCount}
          onChange={(e) => setMaxAccessCount(e.target.value)}
          className="fm-input"
          placeholder="Leave empty for unlimited"
          min="1"
        />
        
        <div className="fm-modal__actions">
          <button onClick={() => setShowGenerateLinkModal(false)} className="fm-cancel-btn">
            Cancel
          </button>
          <button onClick={generatePrivateLink} className="fm-submit-btn">
            Generate Link
          </button>
        </div>
      </div>
    </div>
  )}

  {showAccessRequestsModal && (
    <div className="fm-modal" onClick={() => setShowAccessRequestsModal(false)}>
      <div className="fm-modal__content fm-modal__content--extra-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Access Requests</h3>
        
        <div className="fm-request-filters">
          <button
            onClick={() => loadAccessRequests('pending')}
            className="fm-tool-btn"
          >
            Pending
          </button>
          <button
            onClick={() => loadAccessRequests('approved')}
            className="fm-tool-btn"
          >
            Approved
          </button>
          <button
            onClick={() => loadAccessRequests('rejected')}
            className="fm-tool-btn"
          >
            Rejected
          </button>
        </div>
        
        {accessRequests.length === 0 ? (
          <div className="fm-no-requests">
            No access requests found
          </div>
        ) : (
          <div className="fm-requests-list">
            {accessRequests.map((request) => (
              <div key={request._id} className={`fm-request ${request.status === 'pending' ? 'fm-request--pending' : ''}`}>
                <div className="fm-request__header">
                  <div>
                    <strong>{request.userName}</strong>
                    <span className="fm-request__email">
                      {request.userEmail}
                    </span>
                  </div>
                  <div className={`fm-request__status fm-request__status--${request.status}`}>
                    {request.status.toUpperCase()}
                  </div>
                </div>
                
                <div className="fm-request__field">
                  <strong>Document:</strong> {request.documentId?.name || 'N/A'}
                </div>
                
                <div className="fm-request__message">
                  <strong>Message:</strong>
                  <p>{request.requestMessage}</p>
                </div>
                
                <div className="fm-request__date">
                  Requested: {new Date(request.requestedAt).toLocaleString()}
                </div>
                
                {request.status === 'pending' && (
                  <div className="fm-request__actions">
                    <button
                      onClick={() => {
                        const response = prompt('Admin message (optional):');
                        if (response !== null) {
                          approveAccessRequest(request._id, 720, response);
                        }
                      }}
                      className="fm-submit-btn"
                    >
                      Approve (30 days)
                    </button>
                    <button
                      onClick={() => {
                        const response = prompt('Rejection reason (optional):');
                        if (response !== null) {
                          rejectAccessRequest(request._id, response);
                        }
                      }}
                      className="fm-cancel-btn fm-cancel-btn--reject"
                    >
                      Reject
                    </button>
                  </div>
                )}
                
                {request.accessLink && (
                  <div className="fm-request__link">
                    <div className="fm-request__link-label">
                      Access Link Generated:
                    </div>
                    <div className="fm-request__link-value">
                      {request.accessLink}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        <div className="fm-modal__actions">
          <button onClick={() => setShowAccessRequestsModal(false)} className="fm-cancel-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  )}
</div>
);
}
