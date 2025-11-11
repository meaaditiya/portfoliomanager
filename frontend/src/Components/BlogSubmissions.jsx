import React, { useState, useEffect } from 'react';
import './AdminBlogSubmissions.css';

const AdminBlogSubmissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [changesSuggestion, setChangesSuggestion] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const API_URL = 'https://connectwithaaditiyamg.onrender.com';

  // Get token from localStorage
  const getToken = () => localStorage.getItem('token');

  // Fetch submissions
  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        ...(filterStatus && { status: filterStatus }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`${API_URL}/api/admin/blog-submissions?${params}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setSubmissions(data.submissions);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      } else {
        alert(data.message || 'Failed to fetch submissions');
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      alert('Error fetching submissions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch single submission details
  const fetchSubmissionDetails = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/blog-submissions/${id}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setSelectedSubmission(data);
        setShowModal(true);
      } else {
        alert(data.message || 'Failed to fetch submission details');
      }
    } catch (error) {
      console.error('Error fetching submission:', error);
      alert('Error fetching submission details');
    }
  };

  // Approve submission
  const approveSubmission = async (id) => {
    if (!window.confirm('Are you sure you want to approve this submission?')) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/blog-submissions/${id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Submission approved successfully!');
        fetchSubmissions();
        setShowModal(false);
      } else {
        alert(data.message || 'Failed to approve submission');
      }
    } catch (error) {
      console.error('Error approving submission:', error);
      alert('Error approving submission');
    }
  };

  // Reject submission
  const rejectSubmission = async (id) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/blog-submissions/${id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rejectionReason })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Submission rejected');
        setRejectionReason('');
        fetchSubmissions();
        setShowModal(false);
      } else {
        alert(data.message || 'Failed to reject submission');
      }
    } catch (error) {
      console.error('Error rejecting submission:', error);
      alert('Error rejecting submission');
    }
  };

  // Suggest changes
  const suggestChanges = async (id) => {
    if (!changesSuggestion.trim()) {
      alert('Please provide change suggestions');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/blog-submissions/${id}/suggest-changes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ changesSuggested: changesSuggestion })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Changes suggested successfully');
        setChangesSuggestion('');
        fetchSubmissions();
      } else {
        alert(data.message || 'Failed to suggest changes');
      }
    } catch (error) {
      console.error('Error suggesting changes:', error);
      alert('Error suggesting changes');
    }
  };

  // Delete submission
  const deleteSubmission = async (id) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/blog-submissions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Submission deleted');
        fetchSubmissions();
        setShowModal(false);
      } else {
        alert(data.message || 'Failed to delete submission');
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
      alert('Error deleting submission');
    }
  };

  // Bulk approve
  const bulkApprove = async () => {
    if (selectedIds.length === 0) {
      alert('Please select submissions to approve');
      return;
    }

    if (!window.confirm(`Approve ${selectedIds.length} submission(s)?`)) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/blog-submissions/bulk/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ submissionIds: selectedIds })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Approved: ${data.results.approved.length}, Failed: ${data.results.failed.length}`);
        setSelectedIds([]);
        fetchSubmissions();
      } else {
        alert(data.message || 'Failed to bulk approve');
      }
    } catch (error) {
      console.error('Error bulk approving:', error);
      alert('Error bulk approving');
    }
  };

  // Bulk reject
  const bulkReject = async () => {
    if (selectedIds.length === 0) {
      alert('Please select submissions to reject');
      return;
    }

    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/blog-submissions/bulk/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          submissionIds: selectedIds,
          rejectionReason: reason 
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Rejected ${data.modifiedCount} submission(s)`);
        setSelectedIds([]);
        fetchSubmissions();
      } else {
        alert(data.message || 'Failed to bulk reject');
      }
    } catch (error) {
      console.error('Error bulk rejecting:', error);
      alert('Error bulk rejecting');
    }
  };

  // Toggle selection
  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Select all
  const toggleSelectAll = () => {
    if (selectedIds.length === submissions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(submissions.map(s => s._id));
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [currentPage, filterStatus, searchTerm]);

  return (
    <div className="admin-container">
      <h1>Blog Submissions Dashboard</h1>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total</h3>
          <p>{stats.total}</p>
        </div>
        <div className="stat-card pending">
          <h3>Pending</h3>
          <p>{stats.pending}</p>
        </div>
        <div className="stat-card approved">
          <h3>Approved</h3>
          <p>{stats.approved}</p>
        </div>
        <div className="stat-card rejected">
          <h3>Rejected</h3>
          <p>{stats.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search by title, name, email, or ID..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="search-input"
        />

        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bulk-actions">
          <span>{selectedIds.length} selected</span>
          <button onClick={bulkApprove} className="btn-approve">Bulk Approve</button>
          <button onClick={bulkReject} className="btn-reject">Bulk Reject</button>
          <button onClick={() => setSelectedIds([])} className="btn-secondary">Clear</button>
        </div>
      )}

      {/* Submissions Table */}
      <div className="table-container">
        {loading ? (
          <p>Loading...</p>
        ) : submissions.length === 0 ? (
          <p>No submissions found</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === submissions.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>ID</th>
                <th>Title</th>
                <th>Author</th>
                <th>Email</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission._id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(submission._id)}
                      onChange={() => toggleSelection(submission._id)}
                    />
                  </td>
                  <td className="submission-id">{submission.blogSubmissionId}</td>
                  <td>{submission.title}</td>
                  <td>{submission.userName}</td>
                  <td>{submission.userEmail}</td>
                  <td>
                    <span className={`status-badge ${submission.status}`}>
                      {submission.status}
                    </span>
                  </td>
                  <td>{new Date(submission.submittedAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => fetchSubmissionDetails(submission._id)}
                      className="btn-view"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="btn-secondary"
        >
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="btn-secondary"
        >
          Next
        </button>
      </div>

      {/* Modal */}
      {showModal && selectedSubmission && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            
            <h2>Submission Details</h2>
            
            <div className="modal-body">
              <div className="detail-row">
                <strong>Submission ID:</strong>
                <span>{selectedSubmission.blogSubmissionId}</span>
              </div>
              
              <div className="detail-row">
                <strong>Status:</strong>
                <span className={`status-badge ${selectedSubmission.status}`}>
                  {selectedSubmission.status}
                </span>
              </div>
              
              <div className="detail-row">
                <strong>Author:</strong>
                <span>{selectedSubmission.userName}</span>
              </div>
              
              <div className="detail-row">
                <strong>Email:</strong>
                <span>{selectedSubmission.userEmail}</span>
              </div>
              
              <div className="detail-row">
                <strong>Title:</strong>
                <span>{selectedSubmission.title}</span>
              </div>
              
              <div className="detail-row">
                <strong>Summary:</strong>
                <span>{selectedSubmission.summary}</span>
              </div>
              
              <div className="detail-row">
                <strong>Tags:</strong>
                <span>{selectedSubmission.tags.join(', ')}</span>
              </div>
              
              {selectedSubmission.featuredImage && (
                <div className="detail-row">
                  <strong>Featured Image:</strong>
                  <img src={selectedSubmission.featuredImage} alt="Featured" className="preview-img" />
                </div>
              )}
              
              <div className="detail-row">
                <strong>Content:</strong>
                <div className="content-preview">{selectedSubmission.content}</div>
              </div>
              
              {selectedSubmission.rejectionReason && (
                <div className="detail-row">
                  <strong>Rejection Reason:</strong>
                  <span className="rejection-text">{selectedSubmission.rejectionReason}</span>
                </div>
              )}
              
              {selectedSubmission.changesSuggested && (
                <div className="detail-row">
                  <strong>Changes Suggested:</strong>
                  <span>{selectedSubmission.changesSuggested}</span>
                </div>
              )}

              {/* Action Buttons */}
              {selectedSubmission.status === 'pending' && (
                <>
                  <div className="modal-actions">
                    <button
                      onClick={() => approveSubmission(selectedSubmission._id)}
                      className="btn-approve"
                    >
                      Approve & Publish
                    </button>
                  </div>

                  <div className="modal-section">
                    <h3>Reject Submission</h3>
                    <textarea
                      placeholder="Enter rejection reason..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="textarea"
                    />
                    <button
                      onClick={() => rejectSubmission(selectedSubmission._id)}
                      className="btn-reject"
                    >
                      Reject
                    </button>
                  </div>

                  <div className="modal-section">
                    <h3>Suggest Changes</h3>
                    <textarea
                      placeholder="Enter change suggestions..."
                      value={changesSuggestion}
                      onChange={(e) => setChangesSuggestion(e.target.value)}
                      className="textarea"
                    />
                    <button
                      onClick={() => suggestChanges(selectedSubmission._id)}
                      className="btn-secondary"
                    >
                      Send Suggestions
                    </button>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button
                  onClick={() => deleteSubmission(selectedSubmission._id)}
                  className="btn-delete"
                >
                  Delete Submission
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBlogSubmissions;