import React, { useState, useEffect } from 'react';
import './Query.css';

const AdminQueryManager = () => {
  const [queries, setQueries] = useState([]);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [replyText, setReplyText] = useState('');
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const API_BASE = 'https://aadibgmg.onrender.com/api';
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchQueries();
  }, [statusFilter, currentPage]);

  const fetchQueries = async () => {
    setLoading(true);
    setError('');
    try {
      const url = `${API_BASE}/admin/queries?page=${currentPage}&limit=20${statusFilter ? `&status=${statusFilter}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch queries');
      }

      setQueries(data.queries);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleQuery = async (ticketId) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/admin/queries/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch query');
      }

      setSelectedQuery(data.query);
      setReplyText(data.query.adminReply || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim()) {
      setError('Reply text cannot be empty');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/admin/queries/${selectedQuery.ticketId}/reply`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ adminReply: replyText })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit reply');
      }

      setSuccess('Reply submitted successfully');
      setShowReplyModal(false);
      setSelectedQuery(data.query);
      fetchQueries();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (ticketId, newStatus) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/admin/queries/${ticketId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update status');
      }

      setSuccess('Status updated successfully');
      fetchQueries();
      if (selectedQuery && selectedQuery.ticketId === ticketId) {
        setSelectedQuery(data.query);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ticketId) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/admin/queries/${ticketId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete query');
      }

      setSuccess('Query deleted successfully');
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      if (selectedQuery && selectedQuery.ticketId === ticketId) {
        setSelectedQuery(null);
      }
      fetchQueries();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTickets.length === 0) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/admin/queries/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ticketIds: selectedTickets })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete queries');
      }

      setSuccess(data.message);
      setSelectedTickets([]);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      fetchQueries();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTicketSelection = (ticketId) => {
    setSelectedTickets(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="qryadm__container">
      <div className="qryadm__header">
        <h1 className="qryadm__title">Query Management System</h1>
        <button 
          className="qryadm__btn qryadm__btn--refresh"
          onClick={fetchQueries}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="qryadm__alert qryadm__alert--error">
          {error}
          <button onClick={() => setError('')} className="qryadm__alert-close">×</button>
        </div>
      )}

      {success && (
        <div className="qryadm__alert qryadm__alert--success">
          {success}
          <button onClick={() => setSuccess('')} className="qryadm__alert-close">×</button>
        </div>
      )}

      <div className="qryadm__layout">
        <div className="qryadm__sidebar">
          <div className="qryadm__filters">
            <h3 className="qryadm__filters-title">Filters</h3>
            <div className="qryadm__filter-group">
              <label className="qryadm__label">Status</label>
              <select
                className="qryadm__select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="replied">Replied</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {selectedTickets.length > 0 && (
              <div className="qryadm__bulk-actions">
                <p className="qryadm__bulk-count">{selectedTickets.length} selected</p>
                <button
                  className="qryadm__btn qryadm__btn--danger qryadm__btn--small"
                  onClick={() => {
                    setDeleteTarget('bulk');
                    setShowDeleteConfirm(true);
                  }}
                >
                  Delete Selected
                </button>
              </div>
            )}
          </div>

          <div className="qryadm__list">
            {loading && queries.length === 0 ? (
              <div className="qryadm__loading">Loading queries...</div>
            ) : queries.length === 0 ? (
              <div className="qryadm__empty">No queries found</div>
            ) : (
              queries.map(query => (
                <div
                  key={query._id}
                  className={`qryadm__list-item ${selectedQuery?.ticketId === query.ticketId ? 'qryadm__list-item--active' : ''}`}
                >
                  <div className="qryadm__list-item-header">
                    <input
                      type="checkbox"
                      className="qryadm__checkbox"
                      checked={selectedTickets.includes(query.ticketId)}
                      onChange={() => toggleTicketSelection(query.ticketId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="qryadm__list-item-btn"
                      onClick={() => fetchSingleQuery(query.ticketId)}
                    >
                      <div className="qryadm__list-item-ticket">{query.ticketId}</div>
                      <div className={`qryadm__status qryadm__status--${query.status}`}>
                        {query.status}
                      </div>
                    </button>
                  </div>
                  <div className="qryadm__list-item-name">{query.name}</div>
                  <div className="qryadm__list-item-date">{formatDate(query.createdAt)}</div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="qryadm__pagination">
              <button
                className="qryadm__pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </button>
              <span className="qryadm__pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="qryadm__pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || loading}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="qryadm__main">
          {!selectedQuery ? (
            <div className="qryadm__placeholder">
              <h2>Select a query to view details</h2>
              <p>Choose a query from the list on the left to view and manage it</p>
            </div>
          ) : (
            <div className="qryadm__detail">
              <div className="qryadm__detail-header">
                <h2 className="qryadm__detail-title">Query Details</h2>
                <div className="qryadm__detail-actions">
                  <select
                    className="qryadm__select qryadm__select--inline"
                    value={selectedQuery.status}
                    onChange={(e) => handleStatusUpdate(selectedQuery.ticketId, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="replied">Replied</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    className="qryadm__btn qryadm__btn--danger qryadm__btn--small"
                    onClick={() => {
                      setDeleteTarget(selectedQuery.ticketId);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="qryadm__detail-section">
                <div className="qryadm__detail-row">
                  <span className="qryadm__detail-label">Ticket ID:</span>
                  <span className="qryadm__detail-value">{selectedQuery.ticketId}</span>
                </div>
                <div className="qryadm__detail-row">
                  <span className="qryadm__detail-label">Name:</span>
                  <span className="qryadm__detail-value">{selectedQuery.name}</span>
                </div>
                <div className="qryadm__detail-row">
                  <span className="qryadm__detail-label">Email:</span>
                  <span className="qryadm__detail-value">{selectedQuery.email}</span>
                </div>
                <div className="qryadm__detail-row">
                  <span className="qryadm__detail-label">Status:</span>
                  <span className={`qryadm__status qryadm__status--${selectedQuery.status}`}>
                    {selectedQuery.status}
                  </span>
                </div>
                <div className="qryadm__detail-row">
                  <span className="qryadm__detail-label">Submitted:</span>
                  <span className="qryadm__detail-value">{formatDate(selectedQuery.createdAt)}</span>
                </div>
              </div>

              <div className="qryadm__detail-section">
                <h3 className="qryadm__section-title">Query Text</h3>
                <div className="qryadm__detail-box">
                  {selectedQuery.queryText}
                </div>
              </div>

              <div className="qryadm__detail-section">
                <div className="qryadm__section-header">
                  <h3 className="qryadm__section-title">Admin Reply</h3>
                  <button
                    className="qryadm__btn qryadm__btn--primary qryadm__btn--small"
                    onClick={() => setShowReplyModal(true)}
                  >
                    {selectedQuery.adminReply ? 'Edit Reply' : 'Add Reply'}
                  </button>
                </div>
                {selectedQuery.adminReply ? (
                  <>
                    <div className="qryadm__detail-box">
                      {selectedQuery.adminReply}
                    </div>
                    {selectedQuery.repliedAt && (
                      <div className="qryadm__detail-meta">
                        Replied on {formatDate(selectedQuery.repliedAt)}
                        {selectedQuery.repliedBy && ` by ${selectedQuery.repliedBy.username}`}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="qryadm__detail-empty">
                    No reply added yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showReplyModal && (
        <div className="qryadm__modal-overlay" onClick={() => setShowReplyModal(false)}>
          <div className="qryadm__modal" onClick={(e) => e.stopPropagation()}>
            <div className="qryadm__modal-header">
              <h3 className="qryadm__modal-title">
                {selectedQuery.adminReply ? 'Edit Reply' : 'Add Reply'}
              </h3>
              <button
                className="qryadm__modal-close"
                onClick={() => setShowReplyModal(false)}
              >
                ×
              </button>
            </div>
            <div className="qryadm__modal-body">
              <textarea
                className="qryadm__textarea"
                rows="8"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Enter your reply here..."
              />
            </div>
            <div className="qryadm__modal-footer">
              <button
                className="qryadm__btn qryadm__btn--secondary"
                onClick={() => setShowReplyModal(false)}
              >
                Cancel
              </button>
              <button
                className="qryadm__btn qryadm__btn--primary"
                onClick={handleReplySubmit}
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Reply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="qryadm__modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="qryadm__modal qryadm__modal--small" onClick={(e) => e.stopPropagation()}>
            <div className="qryadm__modal-header">
              <h3 className="qryadm__modal-title">Confirm Deletion</h3>
              <button
                className="qryadm__modal-close"
                onClick={() => setShowDeleteConfirm(false)}
              >
                ×
              </button>
            </div>
            <div className="qryadm__modal-body">
              <p>
                {deleteTarget === 'bulk'
                  ? `Are you sure you want to delete ${selectedTickets.length} selected queries? This action cannot be undone.`
                  : 'Are you sure you want to delete this query? This action cannot be undone.'}
              </p>
            </div>
            <div className="qryadm__modal-footer">
              <button
                className="qryadm__btn qryadm__btn--secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="qryadm__btn qryadm__btn--danger"
                onClick={() => deleteTarget === 'bulk' ? handleBulkDelete() : handleDelete(deleteTarget)}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQueryManager;