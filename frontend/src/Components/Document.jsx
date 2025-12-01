import React, { useState, useEffect } from 'react';
import { Folder, File, Upload, FolderPlus, Trash2, Edit2, Download, Home, ChevronRight, Search, X, Move } from 'lucide-react';

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
      </div>

      {/* File Grid */}
      <div style={styles.fileGrid}>
        {searchResults ? (
          <>
            {/* Search Results */}
            <h3 style={styles.sectionTitle}>Folders ({searchResults.folders?.length || 0})</h3>
            {searchResults.folders?.map(item => (
              <div
                key={item._id}
                style={styles.fileItem}
                onClick={() => {
                  setSearchResults(null);
                  loadFolder(item._id);
                }}
              >
                <Folder size={40} color="#FFC107" />
                <div style={styles.fileName}>{item.name}</div>
                <div style={styles.filePath}>{item.path}</div>
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
                  onDoubleClick={() => item.type === 'folder' && loadFolder(item._id)}
                >
                  {item.type === 'folder' ? (
                    <Folder size={40} color="#FFC107" />
                  ) : (
                    <File size={40} color="#2196F3" />
                  )}
                  
                  <div style={styles.fileName}>{item.name}</div>
                  
                  {item.type === 'file' && (
                    <div style={styles.fileSize}>
                      {(item.size / 1024).toFixed(2)} KB
                    </div>
                  )}

                  <div style={styles.fileActions}>
                    {item.type === 'file' && (
                      <button onClick={() => downloadFile(item)} style={styles.iconBtn} title="Download">
                        <Download size={16} />
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
  }
};