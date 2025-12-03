import React, { useState, useEffect } from 'react';
import { Folder, LinkIcon, File, ExternalLink, Upload, FolderPlus, Trash2, Edit2, Download, Home, ChevronRight, Search, X, Move, FileSpreadsheet, ArrowLeft } from 'lucide-react';

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
      
      // Update breadcrumb
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
  
  // Check for common URL patterns with protocol
  const urlPattern = /^(https?:\/\/)/i;
  if (urlPattern.test(stringValue)) {
    try {
      new URL(stringValue);
      return true;
    } catch {
      return false;
    }
  }
  
  // Check if it looks like a URL without protocol (has domain pattern)
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
    // Ensure URL has protocol
    let fullUrl = stringValue;
    if (!stringValue.startsWith('http://') && !stringValue.startsWith('https://')) {
      fullUrl = 'https://' + stringValue;
    }
    
    // Extract shorter display text
    let displayText = stringValue;
    try {
      const urlObj = new URL(fullUrl);
      // Show just hostname + first part of path
      displayText = urlObj.hostname;
      if (urlObj.pathname && urlObj.pathname !== '/') {
        const pathPart = urlObj.pathname.substring(0, 15);
        displayText += pathPart + (urlObj.pathname.length > 15 ? '...' : '');
      }
    } catch (e) {
      // Fallback to truncated string
      displayText = stringValue.substring(0, 35) + (stringValue.length > 35 ? '...' : '');
    }
    
    return (
      <a 
        href={fullUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        style={styles.tableLink}
        onClick={(e) => e.stopPropagation()}
        title={fullUrl}
      >
        <ExternalLink size={14} style={{ marginRight: '4px', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayText}</span>
      </a>
    );
  }
  
  // Not a URL, return as regular text
  return stringValue;
};
const renderExcelTable = () => {
  if (!excelData || !selectedSheet) return null;

  const sheetData = excelData.data[selectedSheet];
  if (!sheetData || sheetData.length === 0) {
    return <div style={styles.emptyState}>No data in this sheet</div>;
  }

  const headers = Object.keys(sheetData[0]);

  return (
    <div style={styles.excelViewContainer}>
      <div style={styles.excelHeader}>
        <button onClick={closeExcelView} style={styles.backBtn}>
          <ArrowLeft size={20} />
          <span>Back to Files</span>
        </button>
        <h2 style={styles.excelTitle}>
          <FileSpreadsheet size={24} style={{ marginRight: '10px' }} />
          {viewingExcel.name}
        </h2>
      </div>

      {excelData.sheetNames && excelData.sheetNames.length > 1 && (
        <div style={styles.sheetTabs}>
          {excelData.sheetNames.map(sheetName => (
            <button
              key={sheetName}
              onClick={() => setSelectedSheet(sheetName)}
              style={{
                ...styles.sheetTab,
                ...(selectedSheet === sheetName ? styles.activeSheetTab : {})
              }}
            >
              {sheetName}
            </button>
          ))}
        </div>
      )}

      <div style={styles.excelInfo}>
        <span>Total Rows: {sheetData.length}</span>
        <span>Columns: {headers.length}</span>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>#</th>
              {headers.map(header => (
                <th key={header} style={styles.tableHeader}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheetData.map((row, rowIndex) => (
              <tr key={rowIndex} style={styles.tableRow}>
                <td style={styles.tableCell}>{rowIndex + 1}</td>
                {headers.map(header => (
                  <td key={header} style={styles.tableCell}>
                    {renderCellValue(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
  // Render folder tree for move modal
  const renderFolderTree = (folders, level = 0) => {
    return folders.filter(f => f.type === 'folder').map(folder => (
      <div key={folder._id}>
        <div
          style={{
            ...styles.treeItem,
            paddingLeft: `${level * 20 + 10}px`,
            background: folder._id === moveItem?._id ? '#e0e0e0' : 'transparent'
          }}
          onClick={() => folder._id !== moveItem?._id && moveItemFunc(folder._id)}
        >
          <Folder size={16} />
          <span style={{ marginLeft: '8px' }}>{folder.name}</span>
        </div>
        {folder.children && renderFolderTree(folder.children, level + 1)}
      </div>
    ));
  };
if (viewingExcel && excelData) {
  return (
    <div style={styles.container}>
      {message && <div style={styles.message}>{message}</div>}
      {renderExcelTable()}
    </div>
  );
}
  return (
    
    <div style={styles.container}>
      
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Folder size={24} color="#4CAF50" />
          <h2 style={styles.title}>File Manager</h2>
        </div>

        <div style={styles.searchBar}>
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && performSearch()}
            style={styles.searchInput}
          />
          <button onClick={performSearch} style={styles.searchBtn}>
            <Search size={16} />
          </button>
          {searchResults && (
            <button onClick={() => setSearchResults(null)} style={styles.clearBtn}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={styles.message}>
          {message}
        </div>
      )}

      {/* Breadcrumb */}
      {!searchResults && (
        <div style={styles.breadcrumb}>
          {breadcrumb.map((crumb, idx) => (
            <React.Fragment key={crumb.id || 'root'}>
              <span
                style={{
                  ...styles.crumbItem,
                  fontWeight: idx === breadcrumb.length - 1 ? 'bold' : 'normal'
                }}
                onClick={() => loadFolder(crumb.id)}
              >
                {idx === 0 ? <Home size={16} /> : crumb.name}
              </span>
              {idx < breadcrumb.length - 1 && <ChevronRight size={16} style={styles.chevron} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          type="file"
          id="fileInput"
          style={{ display: 'none' }}
          onChange={(e) => uploadFile(e.target.files[0])}
        />
        
        <button
          onClick={() => document.getElementById('fileInput').click()}
          style={styles.toolBtn}
        >
          <Upload size={16} />
          <span>Upload File</span>
        </button>

        <button
          onClick={() => setShowNewFolderModal(true)}
          style={styles.toolBtn}
        >
          <FolderPlus size={16} />
          <span>New Folder</span>
        </button>
        <button
  onClick={() => setShowNewLinkModal(true)}
  style={styles.toolBtn}
>
  <LinkIcon size={16} />
  <span>Add Link</span>
</button>
<input
  type="file"
  id="excelInput"
  accept=".xlsx,.xls,.csv"
  style={{ display: 'none' }}
  onChange={(e) => uploadExcelFile(e.target.files[0])}
/>

<button
  onClick={() => document.getElementById('excelInput').click()}
  style={styles.toolBtn}
>
  <FileSpreadsheet size={16} />
  <span>Upload Excel</span>
</button>
      </div>

      {/* File Grid */}
      <div style={styles.fileGrid}>
        {searchResults ? (
          <>
            {/* Search Results */}
           <h3 style={styles.sectionTitle}>Links ({searchResults.links?.length || 0})</h3>
{searchResults.links?.map(item => (
  <div key={item._id} style={styles.fileItem}>
    <LinkIcon size={40} color="#9C27B0" />
    <div style={styles.fileName}>{item.name}</div>
    <div style={styles.linkUrl}>{item.url}</div>
    <div style={styles.filePath}>{item.path}</div>
    <div style={styles.fileActions}>
      <button 
        onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')} 
        style={styles.iconBtn}
        title="Open Link"
      >
        <ExternalLink size={16} />
      </button>
    </div>
  </div>
))}
<h3 style={styles.sectionTitle}>Excel Files ({searchResults.excels?.length || 0})</h3>
{searchResults.excels?.map(item => (
  <div key={item._id} style={styles.fileItem}>
    <FileSpreadsheet size={40} color="#10B981" />
    <div style={styles.fileName}>{item.name}</div>
    <div style={styles.filePath}>{item.path}</div>
    <div style={styles.fileActions}>
      <button onClick={() => loadExcelData(item)} style={styles.iconBtn}>
        <ExternalLink size={16} />
      </button>
    </div>
  </div>
))}

            <h3 style={styles.sectionTitle}>Files ({searchResults.files?.length || 0})</h3>
            {searchResults.files?.map(item => (
              <div key={item._id} style={styles.fileItem}>
                <File size={40} color="#2196F3" />
                <div style={styles.fileName}>{item.name}</div>
                <div style={styles.filePath}>{item.path}</div>
                <div style={styles.fileActions}>
                  <button onClick={() => downloadFile(item)} style={styles.iconBtn}>
                    <Download size={16} />
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Current Folder Contents */}
            {items.length === 0 ? (
              <div style={styles.emptyState}>
                <Folder size={64} color="#ccc" />
                <p>This folder is empty</p>
                <p style={styles.emptyHint}>Upload files or create folders to get started</p>
              </div>
            ) : (
           items.map(item => (
  <div
    key={item._id}
    style={{
      ...styles.fileItem,
      opacity: draggedItem?._id === item._id ? 0.5 : 1
    }}
    draggable={true}
    onDragStart={(e) => handleDragStart(e, item)}
    onDragOver={item.type === 'folder' ? handleDragOver : undefined}
    onDrop={item.type === 'folder' ? (e) => handleDrop(e, item) : undefined}
   onDoubleClick={() => {
  if (item.type === 'folder') {
    loadFolder(item._id);
  } else if (item.type === 'link') {
    window.open(item.url, '_blank', 'noopener,noreferrer');
  } else if (item.type === 'excel') {  // ADD THIS
    loadExcelData(item);
  }
}}
  >
   {item.type === 'folder' ? (
  <Folder size={40} color="#FFC107" />
) : item.type === 'link' ? (
  <LinkIcon size={40} color="#9C27B0" />
) : item.type === 'excel' ? (  // ADD THIS
  <FileSpreadsheet size={40} color="#10B981" />
) : (
  <File size={40} color="#2196F3" />
)}

    
    <div style={styles.fileName}>{item.name}</div>
    
    {item.type === 'file' && (
      <div style={styles.fileSize}>
        {(item.size / 1024).toFixed(2)} KB
      </div>
    )}

    {item.type === 'link' && (
      <div style={styles.linkUrl}>{item.url}</div>
    )}
{item.type === 'excel' && (
  <div style={styles.fileSize}>
    {item.rowCount} rows • {item.columnCount} cols
  </div>
)}
    <div style={styles.fileActions}>
      {item.type === 'file' && (
        <button onClick={() => downloadFile(item)} style={styles.iconBtn} title="Download">
          <Download size={16} />
        </button>
      )}
      
      {item.type === 'link' && (
        <button 
          onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')} 
          style={styles.iconBtn} 
          title="Open Link"
        >
          <ExternalLink size={16} />
        </button>
      )}
      {item.type === 'excel' && (
  <button 
    onClick={() => loadExcelData(item)} 
    style={styles.iconBtn} 
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
        style={styles.iconBtn}
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
        style={styles.iconBtn}
        title="Move"
      >
        <Move size={16} />
      </button>

      <button
        onClick={() => deleteItem(item)}
        style={{...styles.iconBtn, color: '#f44336'}}
        title="Delete"
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
))
            )}
          </>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div style={styles.modal} onClick={() => setShowNewFolderModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createFolder()}
              style={styles.input}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button onClick={() => setShowNewFolderModal(false)} style={styles.cancelBtn}>
                Cancel
              </button>
              <button onClick={createFolder} style={styles.submitBtn}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div style={styles.modal} onClick={() => setShowRenameModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Rename {renameItem?.type}</h3>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && renameItemFunc()}
              style={styles.input}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button onClick={() => setShowRenameModal(false)} style={styles.cancelBtn}>
                Cancel
              </button>
              <button onClick={renameItemFunc} style={styles.submitBtn}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {showMoveModal && (
        <div style={styles.modal} onClick={() => setShowMoveModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Move {moveItem?.name}</h3>
            <div style={styles.treeContainer}>
              <div
                style={styles.treeItem}
                onClick={() => moveItemFunc(null)}
              >
                <Home size={16} />
                <span style={{ marginLeft: '8px' }}>Root</span>
              </div>
              {renderFolderTree(folderTree)}
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setShowMoveModal(false)} style={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* New Link Modal */}
{showNewLinkModal && (
  <div style={styles.modal} onClick={() => setShowNewLinkModal(false)}>
    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
      <h3>Add New Link</h3>
      <input
        type="text"
        placeholder="Link name"
        value={linkFormData.name}
        onChange={(e) => setLinkFormData({...linkFormData, name: e.target.value})}
        style={styles.input}
        autoFocus
      />
      <input
        type="url"
        placeholder="https://example.com"
        value={linkFormData.url}
        onChange={(e) => setLinkFormData({...linkFormData, url: e.target.value})}
        onKeyPress={(e) => e.key === 'Enter' && createLink()}
        style={styles.input}
      />
      <div style={styles.modalActions}>
        <button onClick={() => setShowNewLinkModal(false)} style={styles.cancelBtn}>
          Cancel
        </button>
        <button onClick={createLink} style={styles.submitBtn}>
          Add Link
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
    margintop: '50px',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    background: '#f5f5f5',
    minHeight: '100vh'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  title: {
    margin: 0,
    fontSize: '24px'
  },
  searchBar: {
    display: 'flex',
    gap: '5px'
  },
  searchInput: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    width: '300px',
    fontSize: '14px'
  },
  searchBtn: {
    padding: '8px 12px',
    background: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  clearBtn: {
    padding: '8px 12px',
    background: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  message: {
    padding: '12px',
    background: '#4CAF50',
    color: 'white',
    borderRadius: '4px',
    marginBottom: '20px',
    textAlign: 'center'
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    background: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  crumbItem: {
    cursor: 'pointer',
    color: '#2196F3',
    display: 'flex',
    alignItems: 'center'
  },
  chevron: {
    margin: '0 8px',
    color: '#999'
  },
  toolbar: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  toolBtn: {
    padding: '10px 16px',
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  fileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '20px'
  },
  fileItem: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    position: 'relative'
  },
  fileName: {
    marginTop: '12px',
    fontSize: '14px',
    fontWeight: '500',
    wordBreak: 'break-word'
  },
  filePath: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px'
  },
  fileSize: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px'
  },
  fileActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '12px'
  },
  iconBtn: {
    padding: '6px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999'
  },
  emptyHint: {
    fontSize: '14px',
    marginTop: '10px'
  },
  sectionTitle: {
    gridColumn: '1 / -1',
    fontSize: '18px',
    fontWeight: '600',
    marginTop: '20px',
    marginBottom: '10px'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: 'white',
    padding: '30px',
    borderRadius: '8px',
    minWidth: '400px',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'auto'
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    marginTop: '15px',
    boxSizing: 'border-box'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px'
  },
  cancelBtn: {
    padding: '10px 20px',
    background: '#f5f5f5',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  submitBtn: {
    padding: '10px 20px',
    background: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  treeContainer: {
    marginTop: '15px',
    maxHeight: '300px',
    overflow: 'auto',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '10px'
  },
  treeItem: {
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    transition: 'background 0.2s'
  },
  linkUrl: {
  fontSize: '11px',
  color: '#9C27B0',
  marginTop: '4px',
  wordBreak: 'break-all',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
},
excelViewContainer: {
  background: 'white',
  borderRadius: '8px',
  padding: '20px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
},
excelHeader: {
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  marginBottom: '20px',
  paddingBottom: '15px',
  borderBottom: '2px solid #f0f0f0'
},
backBtn: {
  padding: '8px 16px',
  background: '#f5f5f5',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'all 0.2s'
},
excelTitle: {
  margin: 0,
  fontSize: '20px',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center'
},
sheetTabs: {
  display: 'flex',
  gap: '8px',
  marginBottom: '15px',
  borderBottom: '1px solid #e0e0e0',
  paddingBottom: '10px'
},
sheetTab: {
  padding: '8px 16px',
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  color: '#666',
  transition: 'all 0.2s'
},
activeSheetTab: {
  color: '#2196F3',
  borderBottomColor: '#2196F3'
},
excelInfo: {
  display: 'flex',
  gap: '20px',
  padding: '12px',
  background: '#f8f9fa',
  borderRadius: '6px',
  marginBottom: '15px',
  fontSize: '14px',
  color: '#666'
},
tableWrapper: {
  overflowX: 'auto',
  overflowY: 'auto',
  maxHeight: '600px',
  border: '1px solid #e0e0e0',
  borderRadius: '6px'
},
table: {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px'
},
tableHeader: {
  background: '#f8f9fa',
  padding: '12px',
  textAlign: 'left',
  fontWeight: '600',
  borderBottom: '2px solid #e0e0e0',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  whiteSpace: 'nowrap'
},
tableRow: {
  borderBottom: '1px solid #f0f0f0',
  transition: 'background 0.2s'
},
tableCell: {
  padding: '12px',
  borderRight: '1px solid #f0f0f0',
  whiteSpace: 'nowrap',
  maxWidth: '300px',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
},
tableLink: {
  color: '#2196F3',
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
}
};