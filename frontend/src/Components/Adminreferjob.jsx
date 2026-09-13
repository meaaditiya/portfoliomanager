import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../ComponentsCSS/Adminreferjob.css';

const API_BASE ='https://aadibgmg.onrender.com';

const emptyQuestion = () => ({
  tempId: Math.random().toString(36).slice(2),
  questionText: '',
  type: 'text',
  options: [],
  placeholder: '',
  required: false
});

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

function QuestionBuilder({ questions, setQuestions }) {
  const updateQuestion = (id, patch) => {
    setQuestions(questions.map((q) => (q.tempId === id || q._id === id ? { ...q, ...patch } : q)));
  };

  const removeQuestion = (id) => {
    setQuestions(questions.filter((q) => q.tempId !== id && q._id !== id));
  };

  const addOption = (id) => {
    const q = questions.find((item) => item.tempId === id || item._id === id);
    updateQuestion(id, { options: [...(q.options || []), ''] });
  };

  const updateOption = (id, index, value) => {
    const q = questions.find((item) => item.tempId === id || item._id === id);
    const options = [...(q.options || [])];
    options[index] = value;
    updateQuestion(id, { options });
  };

  const removeOption = (id, index) => {
    const q = questions.find((item) => item.tempId === id || item._id === id);
    const options = (q.options || []).filter((_, i) => i !== index);
    updateQuestion(id, { options });
  };

  return (
    <div className="rjbAdm-qb-list">
      {questions.map((q, index) => {
        const key = q.tempId || q._id;
        const needsOptions = ['radio', 'checkbox', 'select'].includes(q.type);
        return (
          <div key={key} className="rjbAdm-qb-item">
            <div className="rjbAdm-qb-row">
              <span className="rjbAdm-qb-index">{index + 1}</span>
              <input
                className="rjbAdm-qb-input"
                placeholder="Question text"
                value={q.questionText}
                onChange={(e) => updateQuestion(key, { questionText: e.target.value })}
              />
              <select
                className="rjbAdm-qb-select"
                value={q.type}
                onChange={(e) => updateQuestion(key, { type: e.target.value, options: [] })}
              >
                <option value="text">Text</option>
                <option value="textarea">Textarea</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
                <option value="date">Date</option>
                <option value="radio">Radio</option>
                <option value="checkbox">Checkbox</option>
                <option value="select">Select</option>
                <option value="file">File</option>
              </select>
              <label className="rjbAdm-qb-required-label">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => updateQuestion(key, { required: e.target.checked })}
                />
                Required
              </label>
              <button type="button" onClick={() => removeQuestion(key)} className="rjbAdm-qb-remove-btn">
                Remove
              </button>
            </div>

            {!needsOptions && q.type !== 'file' && (
              <input
                className="rjbAdm-qb-placeholder-input"
                placeholder="Placeholder text (optional)"
                value={q.placeholder}
                onChange={(e) => updateQuestion(key, { placeholder: e.target.value })}
              />
            )}

            {needsOptions && (
              <div className="rjbAdm-qb-options">
                {(q.options || []).map((opt, optIndex) => (
                  <div key={optIndex} className="rjbAdm-qb-option-row">
                    <input
                      className="rjbAdm-qb-option-input"
                      value={opt}
                      onChange={(e) => updateOption(key, optIndex, e.target.value)}
                      placeholder={`Option ${optIndex + 1}`}
                    />
                    <button type="button" onClick={() => removeOption(key, optIndex)} className="rjbAdm-qb-option-remove">
                      x
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addOption(key)} className="rjbAdm-qb-add-option">
                  + Add option
                </button>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" onClick={() => setQuestions([...questions, emptyQuestion()])} className="rjbAdm-qb-add-question">
        + Add question
      </button>
    </div>
  );
}

function PostingForm({ type, initialData, onSaved, onCancel }) {
  const isReferral = type === 'referral';
  const [form, setForm] = useState({
    companyName: initialData?.companyName || '',
    roleTitle: initialData?.roleTitle || '',
    title: initialData?.title || '',
    company: initialData?.company || '',
    department: initialData?.department || '',
    location: initialData?.location || '',
    jobType: initialData?.jobType || 'full-time',
    experienceLevel: initialData?.experienceLevel || '',
    description: initialData?.description || '',
    externalJobLink: initialData?.externalJobLink || '',
    applyMode: initialData?.applyMode || 'external',
    applyLink: initialData?.applyLink || '',
    salaryMin: initialData?.salaryRange?.min || '',
    salaryMax: initialData?.salaryRange?.max || '',
    currency: initialData?.salaryRange?.currency || 'INR',
    isDisclosed: initialData?.salaryRange?.isDisclosed || false,
    isActive: initialData?.isActive ?? true
  });
  const [questions, setQuestions] = useState(
    initialData?.questions?.length ? initialData.questions : []
  );
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const endpoint = isReferral ? 'referral-postings' : 'job-postings';
      const url = initialData
        ? `${API_BASE}/api/admin/${endpoint}/${initialData._id}`
        : `${API_BASE}/api/admin/${endpoint}`;

      const payload = new FormData();
      if (isReferral) {
        payload.append('companyName', form.companyName);
        payload.append('roleTitle', form.roleTitle);
        payload.append('department', form.department);
        payload.append('externalJobLink', form.externalJobLink);
      } else {
        payload.append('title', form.title);
        payload.append('company', form.company);
        payload.append('applyMode', form.applyMode);
        payload.append('applyLink', form.applyLink);
        payload.append('salaryMin', form.salaryMin);
        payload.append('salaryMax', form.salaryMax);
        payload.append('currency', form.currency);
        payload.append('isDisclosed', form.isDisclosed);
      }
      payload.append('location', form.location);
      payload.append('jobType', form.jobType);
      payload.append('experienceLevel', form.experienceLevel);
      payload.append('description', form.description);
      payload.append('isActive', form.isActive);
      payload.append('questions', JSON.stringify(questions.map(({ tempId, ...q }) => q)));
      if (logoFile) payload.append('companyLogo', logoFile);

      const method = initialData ? 'put' : 'post';
      const res = await axios[method](url, payload, {
        ...authHeaders(),
        headers: { ...authHeaders().headers, 'Content-Type': 'multipart/form-data' }
      });

      onSaved(res.data.posting);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save posting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rjbAdm-form">
      <h3 className="rjbAdm-form-heading">
        {initialData ? 'Edit' : 'New'} {isReferral ? 'Referral Posting' : 'Job Posting'}
      </h3>

      {error && <p className="rjbAdm-form-error">{error}</p>}

      <div className="rjbAdm-form-grid">
        {isReferral ? (
          <>
            <input
              className="rjbAdm-form-input"
              placeholder="Company name"
              value={form.companyName}
              onChange={(e) => update('companyName', e.target.value)}
              required
            />
            <input
              className="rjbAdm-form-input"
              placeholder="Role title"
              value={form.roleTitle}
              onChange={(e) => update('roleTitle', e.target.value)}
              required
            />
          </>
        ) : (
          <>
            <input
              className="rjbAdm-form-input"
              placeholder="Job title"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              required
            />
            <input
              className="rjbAdm-form-input"
              placeholder="Company"
              value={form.company}
              onChange={(e) => update('company', e.target.value)}
              required
            />
          </>
        )}
        <input
          className="rjbAdm-form-input"
          placeholder="Location"
          value={form.location}
          onChange={(e) => update('location', e.target.value)}
        />
        <select className="rjbAdm-form-select" value={form.jobType} onChange={(e) => update('jobType', e.target.value)}>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="internship">Internship</option>
          <option value="contract">Contract</option>
          <option value="freelance">Freelance</option>
        </select>
        <input
          className="rjbAdm-form-input"
          placeholder="Experience level"
          value={form.experienceLevel}
          onChange={(e) => update('experienceLevel', e.target.value)}
        />
        {isReferral ? (
          <input
            className="rjbAdm-form-input"
            placeholder="Department"
            value={form.department}
            onChange={(e) => update('department', e.target.value)}
          />
        ) : (
          <select className="rjbAdm-form-select" value={form.applyMode} onChange={(e) => update('applyMode', e.target.value)}>
            <option value="external">External link</option>
            <option value="onsite">Apply on this site</option>
          </select>
        )}
      </div>

      {isReferral ? (
        <input
          className="rjbAdm-form-input rjbAdm-form-input--full"
          placeholder="External job link (optional)"
          value={form.externalJobLink}
          onChange={(e) => update('externalJobLink', e.target.value)}
        />
      ) : form.applyMode === 'external' ? (
        <input
          className="rjbAdm-form-input rjbAdm-form-input--full"
          placeholder="Apply link"
          value={form.applyLink}
          onChange={(e) => update('applyLink', e.target.value)}
        />
      ) : null}

      {!isReferral && (
        <div className="rjbAdm-form-row-inline">
          <input
            className="rjbAdm-form-input"
            placeholder="Min salary"
            type="number"
            value={form.salaryMin}
            onChange={(e) => update('salaryMin', e.target.value)}
          />
          <input
            className="rjbAdm-form-input"
            placeholder="Max salary"
            type="number"
            value={form.salaryMax}
            onChange={(e) => update('salaryMax', e.target.value)}
          />
          <input
            className="rjbAdm-form-input"
            placeholder="Currency"
            value={form.currency}
            onChange={(e) => update('currency', e.target.value)}
          />
          <label className="rjbAdm-form-checkbox-label">
            <input
              type="checkbox"
              checked={form.isDisclosed}
              onChange={(e) => update('isDisclosed', e.target.checked)}
            />
            Show salary publicly
          </label>
        </div>
      )}

      <textarea
        className="rjbAdm-form-textarea"
        placeholder="Description"
        value={form.description}
        onChange={(e) => update('description', e.target.value)}
      />

      <div className="rjbAdm-form-file-row">
        <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} />
        <label className="rjbAdm-form-checkbox-label">
          <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} />
          Active / visible publicly
        </label>
      </div>

      {(isReferral || form.applyMode === 'onsite') && (
        <div>
          <p className="rjbAdm-form-questionnaire-label">Custom questionnaire</p>
          <QuestionBuilder questions={questions} setQuestions={setQuestions} />
        </div>
      )}

      <div className="rjbAdm-form-actions">
        <button type="submit" disabled={saving} className="rjbAdm-btn-primary">
          {saving ? 'Saving...' : 'Save posting'}
        </button>
        <button type="button" onClick={onCancel} className="rjbAdm-btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function PostingsManager({ type }) {
  const [postings, setPostings] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const endpoint = type === 'referral' ? 'referral-postings' : 'job-postings';

  const fetchPostings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/admin/${endpoint}`, authHeaders());
      setPostings(res.data.postings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchPostings();
  }, [fetchPostings]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this posting?')) return;
    try {
      await axios.delete(`${API_BASE}/api/admin/${endpoint}/${id}`, authHeaders());
      fetchPostings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditing(null);
    fetchPostings();
  };

  if (showForm) {
    return (
      <PostingForm
        type={type}
        initialData={editing}
        onSaved={handleSaved}
        onCancel={() => {
          setShowForm(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="rjbAdm-panel-body">
      <button
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="rjbAdm-btn-primary"
      >
        + New {type === 'referral' ? 'referral posting' : 'job posting'}
      </button>

      {loading ? (
        <p className="rjbAdm-empty-text">Loading...</p>
      ) : postings.length === 0 ? (
        <p className="rjbAdm-empty-text">No postings yet.</p>
      ) : (
        <div className="rjbAdm-postings-list">
          {postings.map((p) => (
            <div key={p._id} className="rjbAdm-posting-card">
              <div className="rjbAdm-posting-info">
                <p className="rjbAdm-posting-title">
                  {type === 'referral' ? p.roleTitle : p.title} — {type === 'referral' ? p.companyName : p.company}
                </p>
                <p className="rjbAdm-posting-meta">
                  {p.location || 'No location'} · {p.jobType} · {p.isActive ? 'Active' : 'Hidden'}
                </p>
              </div>
              <div className="rjbAdm-posting-actions">
                <button
                  onClick={() => {
                    setEditing(p);
                    setShowForm(true);
                  }}
                  className="rjbAdm-link-btn"
                >
                  Edit
                </button>
                <button onClick={() => handleDelete(p._id)} className="rjbAdm-link-btn rjbAdm-link-btn--danger">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationsManager() {
  const [applications, setApplications] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [filters, setFilters] = useState({ applicationType: '', search: '', statusLabel: '' });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  const fetchApplications = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { ...filters, page, limit: 20 };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const res = await axios.get(`${API_BASE}/api/admin/applications`, { ...authHeaders(), params });
      setApplications(res.data.applications);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchApplications(1);
  }, [fetchApplications]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/admin/status-options`, authHeaders())
      .then((res) => setStatusOptions(res.data.options))
      .catch((err) => console.error(err));
  }, []);

  const handleExport = async () => {
    try {
      const params = { ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const res = await axios.get(`${API_BASE}/api/admin/applications/export`, {
        ...authHeaders(),
        params,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'applications.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id, label, color, note) => {
    try {
      const res = await axios.put(
        `${API_BASE}/api/admin/applications/${id}/status`,
        { label, color, note },
        authHeaders()
      );
      setSelected(res.data.application);
      fetchApplications(pagination.page);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="rjbAdm-panel-body">
      <div className="rjbAdm-apps-filters">
        <select
          className="rjbAdm-apps-filter-select"
          value={filters.applicationType}
          onChange={(e) => setFilters((f) => ({ ...f, applicationType: e.target.value }))}
        >
          <option value="">All types</option>
          <option value="referral">Refer me</option>
          <option value="job">Job posting</option>
        </select>
        <select
          className="rjbAdm-apps-filter-select"
          value={filters.statusLabel}
          onChange={(e) => setFilters((f) => ({ ...f, statusLabel: e.target.value }))}
        >
          <option value="">All statuses</option>
          {statusOptions.map((o) => (
            <option key={o._id} value={o.label}>{o.label}</option>
          ))}
        </select>
        <input
          className="rjbAdm-apps-filter-input"
          placeholder="Search name, email, application id"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <button onClick={handleExport} className="rjbAdm-btn-export">
          Export to Excel
        </button>
      </div>

      {loading ? (
        <p className="rjbAdm-empty-text">Loading...</p>
      ) : (
        <div className="rjbAdm-table-wrapper">
          <table className="rjbAdm-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Applicant</th>
                <th>Posting</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app._id}>
                  <td className="rjbAdm-cell-mono">{app.applicationId}</td>
                  <td>
                    {app.applicantName}
                    <br />
                    <span className="rjbAdm-cell-subtext">{app.applicantEmail}</span>
                  </td>
                  <td>{app.postingSnapshot?.roleTitle} — {app.postingSnapshot?.companyName}</td>
                  <td>
                    <span
                      className="rjbAdm-status-badge"
                      style={{ backgroundColor: `${app.currentStatus?.color}22`, color: app.currentStatus?.color }}
                    >
                      {app.currentStatus?.label}
                    </span>
                  </td>
                  <td className="rjbAdm-cell-subtext">{new Date(app.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => setSelected(app)} className="rjbAdm-link-btn">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="rjbAdm-pagination">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchApplications(p)}
              className={`rjbAdm-pagination-btn ${p === pagination.page ? 'rjbAdm-pagination-btn--active' : ''}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ApplicationDetailModal
          application={selected}
          statusOptions={statusOptions}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateStatus}
        />
      )}
    </div>
  );
}

function ApplicationDetailModal({ application, statusOptions, onClose, onUpdateStatus }) {
  const [label, setLabel] = useState(application.currentStatus?.label || '');
  const [color, setColor] = useState(application.currentStatus?.color || '#6b7280');
  const [note, setNote] = useState('');

  return (
    <div className="rjbAdm-modal-overlay">
      <div className="rjbAdm-modal">
        <div className="rjbAdm-modal-header">
          <div>
            <h3 className="rjbAdm-modal-name">{application.applicantName}</h3>
            <p className="rjbAdm-modal-id">{application.applicationId}</p>
          </div>
          <button onClick={onClose} className="rjbAdm-modal-close">✕</button>
        </div>

        <div className="rjbAdm-modal-body">
          <div className="rjbAdm-modal-summary-grid">
            <p><span className="rjbAdm-modal-label">Email:</span> {application.applicantEmail}</p>
            <p><span className="rjbAdm-modal-label">Phone:</span> {application.applicantPhone || '—'}</p>
            <p><span className="rjbAdm-modal-label">Company:</span> {application.postingSnapshot?.companyName}</p>
            <p><span className="rjbAdm-modal-label">Role:</span> {application.postingSnapshot?.roleTitle}</p>
            {application.resume?.url && (
              <p className="rjbAdm-modal-summary-full">
                <a href={application.resume.url} target="_blank" rel="noreferrer" className="rjbAdm-modal-resume-link">
                  View resume
                </a>
              </p>
            )}
          </div>

          <div className="rjbAdm-modal-section">
            <p className="rjbAdm-modal-section-title">Answers</p>
            {application.answers.map((a, i) => (
              <div key={i} className="rjbAdm-modal-answer">
                <p className="rjbAdm-modal-answer-question">{a.questionText}</p>
                <p className="rjbAdm-modal-answer-value">{Array.isArray(a.answer) ? a.answer.join(', ') : String(a.answer)}</p>
              </div>
            ))}
          </div>

          <div className="rjbAdm-modal-section">
            <p className="rjbAdm-modal-section-title">Update status</p>
            <div className="rjbAdm-status-chip-row">
              {statusOptions.map((o) => (
                <button
                  key={o._id}
                  onClick={() => {
                    setLabel(o.label);
                    setColor(o.color);
                  }}
                  className="rjbAdm-status-chip"
                  style={{
                    borderColor: o.color,
                    color: label === o.label ? '#fff' : o.color,
                    backgroundColor: label === o.label ? o.color : 'transparent'
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="rjbAdm-status-edit-row">
              <input
                className="rjbAdm-form-input"
                placeholder="Custom status label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="rjbAdm-color-input" />
            </div>
            <textarea
              className="rjbAdm-form-textarea"
              placeholder="Note (optional, visible to applicant)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button onClick={() => onUpdateStatus(application._id, label, color, note)} className="rjbAdm-btn-primary">
              Save status
            </button>
          </div>

          {application.statusHistory?.length > 0 && (
            <div className="rjbAdm-modal-section">
              <p className="rjbAdm-modal-section-title">History</p>
              {application.statusHistory.map((h, i) => (
                <p key={i} className="rjbAdm-history-item">
                  {new Date(h.updatedAt).toLocaleString()} — <span style={{ color: h.color }}>{h.label}</span> {h.note ? `— ${h.note}` : ''}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusOptionsManager() {
  const [options, setOptions] = useState([]);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [appliesTo, setAppliesTo] = useState('both');

  const fetchOptions = async () => {
    const res = await axios.get(`${API_BASE}/api/admin/status-options`, authHeaders());
    setOptions(res.data.options);
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const addOption = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    await axios.post(`${API_BASE}/api/admin/status-options`, { label, color, appliesTo }, authHeaders());
    setLabel('');
    fetchOptions();
  };

  const removeOption = async (id) => {
    await axios.delete(`${API_BASE}/api/admin/status-options/${id}`, authHeaders());
    fetchOptions();
  };

  return (
    <div className="rjbAdm-panel-body">
      <form onSubmit={addOption} className="rjbAdm-status-manager-form">
        <input
          className="rjbAdm-form-input"
          placeholder="Status label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="rjbAdm-color-input" />
        <select className="rjbAdm-form-select" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
          <option value="both">Both</option>
          <option value="referral">Refer me only</option>
          <option value="job">Job postings only</option>
        </select>
        <button type="submit" className="rjbAdm-btn-primary">
          Add status
        </button>
      </form>

      <div className="rjbAdm-status-pill-row">
        {options.map((o) => (
          <span key={o._id} className="rjbAdm-status-pill" style={{ backgroundColor: `${o.color}22`, color: o.color }}>
            {o.label}
            <button onClick={() => removeOption(o._id)} className="rjbAdm-status-pill-remove">✕</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminReferJob() {
  const [tab, setTab] = useState('referral');

  const tabs = [
    { id: 'referral', label: 'Refer Me Postings' },
    { id: 'jobs', label: 'Open Job Postings' },
    { id: 'applications', label: 'Applications' },
    { id: 'statuses', label: 'Status Presets' }
  ];

  return (
    <div className="rjbAdm-wrapper">
      <h1 className="rjbAdm-page-title">Refer Me & Job Postings</h1>

      <div className="rjbAdm-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rjbAdm-tab ${tab === t.id ? 'rjbAdm-tab--active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'referral' && <PostingsManager type="referral" />}
      {tab === 'jobs' && <PostingsManager type="job" />}
      {tab === 'applications' && <ApplicationsManager />}
      {tab === 'statuses' && <StatusOptionsManager />}
    </div>
  );
}