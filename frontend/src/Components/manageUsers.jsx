import React, { useState, useEffect } from 'react';
import './manageruser.css';

export default function AdminManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const API_BASE = 'http://localhost:5000/api';
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(
        `${API_BASE}/admin/users?page=${currentPage}&limit=10&search=${searchTerm}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = async (userId, currentStatus) => {
    try {
      setError('');
      const response = await fetch(
        `${API_BASE}/admin/users/${userId}/verify`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            isVerified: !currentStatus
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update verification status');
      }

      setSuccess(`User verification status updated to ${!currentStatus}`);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePremiumUser = async (userId, currentStatus) => {
    try {
      setError('');
      const response = await fetch(
        `${API_BASE}/admin/users/${userId}/premium`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            isPremium: !currentStatus
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update premium status');
      }

      setSuccess(`User premium status updated to ${!currentStatus}`);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setError('');
      const response = await fetch(
        `${API_BASE}/admin/users/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      setSuccess('User deleted successfully');
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const openUserModal = (user) => {
    setSelectedUser(user);
    setModalType('view');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setModalType('');
  };

  const filteredUsers = users.filter(user => {
    if (filterStatus === 'verified') return user.isVerified;
    if (filterStatus === 'unverified') return !user.isVerified;
    if (filterStatus === 'premium') return user.isPremium;
    if (filterStatus === 'regular') return !user.isPremium;
    return true;
  });

  return (
    <div className="adminkz9-container">
      <div className="adminkz9-header">
        <h1 className="adminkz9-header-title">User Management Dashboard</h1>
        <p className="adminkz9-header-subtitle">Manage all users, verification status, and premium accounts</p>
      </div>

      {error && <div className="adminkz9-alert-error">{error}</div>}
      {success && <div className="adminkz9-alert-success">{success}</div>}

      <div className="adminkz9-controls-container">
        <div className="adminkz9-controls-flex">
          <div className="adminkz9-controls-left">
            <div className="adminkz9-search-container">
              <svg className="adminkz9-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="adminkz9-search-input"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="adminkz9-filter-container">
              <svg className="adminkz9-filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <select
                className="adminkz9-filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Users</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
                <option value="premium">Premium Only</option>
                <option value="regular">Regular Only</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="adminkz9-loading-container">
          <div className="adminkz9-spinner"></div>
          <p className="adminkz9-loading-text">Loading users...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="adminkz9-empty-state">
          <p className="adminkz9-empty-text">No users found</p>
          <button className="adminkz9-empty-button" onClick={() => setSearchTerm('')}>
            Clear Search
          </button>
        </div>
      ) : (
        <div className="adminkz9-table-container">
          <table className="adminkz9-table">
            <thead className="adminkz9-table-header">
              <tr>
                <th className="adminkz9-table-th">Name</th>
                <th className="adminkz9-table-th">Email</th>
                <th className="adminkz9-table-th">Verified</th>
                <th className="adminkz9-table-th">Premium</th>
                <th className="adminkz9-table-th">Joined</th>
                <th className="adminkz9-table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="adminkz9-table-body">
              {filteredUsers.map(user => (
                <tr key={user._id} className="adminkz9-table-row">
                  <td className="adminkz9-table-td">
                    <div className="adminkz9-title-container">
                      <span className="adminkz9-title-text">{user.name}</span>
                    </div>
                  </td>
                  <td className="adminkz9-table-td">{user.email}</td>
                  <td className="adminkz9-table-td">
                    <button
                      className={`adminkz9-status-button ${user.isVerified ? 'adminkz9-status-active' : 'adminkz9-status-inactive'}`}
                      onClick={() => handleVerifyUser(user._id, user.isVerified)}
                    >
                      <svg className="adminkz9-status-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {user.isVerified ? 'Verified' : 'Unverified'}
                    </button>
                  </td>
                  <td className="adminkz9-table-td">
                    <button
                      className={`adminkz9-status-button ${user.isPremium ? 'adminkz9-status-active' : 'adminkz9-status-inactive'}`}
                      onClick={() => handlePremiumUser(user._id, user.isPremium)}
                    >
                      <svg className="adminkz9-status-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {user.isPremium ? 'Premium' : 'Regular'}
                    </button>
                  </td>
                  <td className="adminkz9-table-td">
                    <span className="adminkz9-date-text">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="adminkz9-table-td">
                    <div className="adminkz9-actions-container">
                      <button
                        className="adminkz9-action-button adminkz9-edit-button"
                        onClick={() => openUserModal(user)}
                        title="View Details"
                      >
                        <svg className="adminkz9-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        className="adminkz9-action-button adminkz9-delete-button"
                        onClick={() => handleDeleteUser(user._id)}
                        title="Delete User"
                      >
                        <svg className="adminkz9-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="adminkz9-pagination-container">
        <div className="adminkz9-pagination-flex">
          <p className="adminkz9-pagination-info">
            Page {currentPage} of {totalPages}
          </p>
          <div className="adminkz9-pagination-buttons">
            <button
              className="adminkz9-pagination-button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <button
              className="adminkz9-pagination-button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showModal && selectedUser && (
        <div className="adminkz9-modal-overlay" onClick={closeModal}>
          <div className="adminkz9-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="adminkz9-modal-header">
              <h2 className="adminkz9-modal-title">User Details</h2>
              <button className="adminkz9-modal-close" onClick={closeModal}>
                <svg className="adminkz9-modal-close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="adminkz9-form-container">
              <div className="adminkz9-form-group">
                <label className="adminkz9-form-label">Name</label>
                <input type="text" className="adminkz9-form-input" value={selectedUser.name} disabled />
              </div>
              <div className="adminkz9-form-group">
                <label className="adminkz9-form-label">Email</label>
                <input type="email" className="adminkz9-form-input" value={selectedUser.email} disabled />
              </div>
              <div className="adminkz9-form-group">
                <label className="adminkz9-form-label">Verified Status</label>
                <input type="text" className="adminkz9-form-input" value={selectedUser.isVerified ? 'Verified' : 'Not Verified'} disabled />
              </div>
              <div className="adminkz9-form-group">
                <label className="adminkz9-form-label">Premium Status</label>
                <input type="text" className="adminkz9-form-input" value={selectedUser.isPremium ? 'Premium' : 'Regular'} disabled />
              </div>
              <div className="adminkz9-form-group">
                <label className="adminkz9-form-label">Joined Date</label>
                <input type="text" className="adminkz9-form-input" value={new Date(selectedUser.createdAt).toLocaleString()} disabled />
              </div>
              <div className="adminkz9-form-buttons">
                <button className="adminkz9-cancel-button" onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}