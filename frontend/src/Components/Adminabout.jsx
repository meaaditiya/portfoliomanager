import React, { useEffect, useState } from 'react';
import '../ComponentsCSS/adminAbout.css';

const API_BASE_URL = 'https://aadibgmg.onrender.com';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

const AdminAbout = () => {
  const [about, setAbout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [heroTitlePrefix, setHeroTitlePrefix] = useState('');
  const [heroTitleHighlight, setHeroTitleHighlight] = useState('');
  const [summaryPoints, setSummaryPoints] = useState(['']);
  const [jobStatuses, setJobStatuses] = useState([]);

  const [newSkill, setNewSkill] = useState({ name: '', logoFile: null });
  const [newExperience, setNewExperience] = useState({
    role: '',
    company: '',
    startDate: '',
    endDate: 'Present',
    logoFile: null
  });
  const [newEducation, setNewEducation] = useState({
    degree: '',
    school: '',
    duration: '',
    grade: '',
    logoFile: null
  });
  const [resumeFile, setResumeFile] = useState(null);

  // ---- edit-mode state (which item is being edited + its draft data) ----
  const [editingSkillId, setEditingSkillId] = useState(null);
  const [editSkillDraft, setEditSkillDraft] = useState({ name: '', logoFile: null, removeLogo: false });

  const [editingExpId, setEditingExpId] = useState(null);
  const [editExpDraft, setEditExpDraft] = useState({
    role: '', company: '', startDate: '', endDate: '', logoFile: null, removeLogo: false
  });

  const [editingEduId, setEditingEduId] = useState(null);
  const [editEduDraft, setEditEduDraft] = useState({
    degree: '', school: '', duration: '', grade: '', logoFile: null, removeLogo: false
  });

  const fetchAbout = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about`, { headers: authHeaders() });
      const data = await res.json();
      setAbout(data.about);
      setHeroTitlePrefix(data.about.heroTitlePrefix || '');
      setHeroTitleHighlight(data.about.heroTitleHighlight || '');
      setSummaryPoints(data.about.summaryPoints?.length ? data.about.summaryPoints : ['']);
      setJobStatuses(data.about.jobStatuses || []);
    } catch (err) {
      console.error('Error fetching about details:', err);
      setMessage('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAbout();
  }, []);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // ---------- base fields ----------
  const handleSaveBase = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          heroTitlePrefix,
          heroTitleHighlight,
          summaryPoints: summaryPoints.filter((p) => p.trim() !== ''),
          jobStatuses
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      setAbout(data.about);
      showMessage('Saved successfully');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- resume ----------
  const handleResumeUpload = async () => {
    if (!resumeFile) return;
    const formData = new FormData();
    formData.append('resume', resumeFile);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/resume`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setAbout((prev) => ({ ...prev, resume: data.resume }));
      setResumeFile(null);
      showMessage('Resume uploaded');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // SKILLS — add / edit / delete
  // ============================================================
  const handleAddSkill = async () => {
    if (!newSkill.name.trim()) return;
    const formData = new FormData();
    formData.append('name', newSkill.name);
    if (newSkill.logoFile) formData.append('logo', newSkill.logoFile);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/skills`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add skill');
      setAbout(data.about);
      setNewSkill({ name: '', logoFile: null });
      showMessage('Skill added');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditSkill = (skill) => {
    setEditingSkillId(skill._id);
    setEditSkillDraft({ name: skill.name, logoFile: null, removeLogo: false });
  };

  const cancelEditSkill = () => {
    setEditingSkillId(null);
    setEditSkillDraft({ name: '', logoFile: null, removeLogo: false });
  };

  const handleUpdateSkill = async (skillId) => {
    if (!editSkillDraft.name.trim()) return;
    const formData = new FormData();
    formData.append('name', editSkillDraft.name);
    if (editSkillDraft.logoFile) formData.append('logo', editSkillDraft.logoFile);
    else if (editSkillDraft.removeLogo) formData.append('removeLogo', 'true');

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/skills/${skillId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update skill');
      setAbout(data.about);
      cancelEditSkill();
      showMessage('Skill updated');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSkill = async (skillId) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/skills/${skillId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete skill');
      setAbout(data.about);
      showMessage('Skill removed');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // EXPERIENCE — add / edit / delete
  // ============================================================
  const handleAddExperience = async () => {
    if (!newExperience.role.trim() || !newExperience.company.trim() || !newExperience.startDate.trim()) return;
    const formData = new FormData();
    Object.entries(newExperience).forEach(([key, val]) => {
      if (key === 'logoFile') {
        if (val) formData.append('companyLogo', val);
      } else {
        formData.append(key, val);
      }
    });
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/experience`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add experience');
      setAbout(data.about);
      setNewExperience({ role: '', company: '', startDate: '', endDate: 'Present', logoFile: null });
      showMessage('Experience added');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditExperience = (exp) => {
    setEditingExpId(exp._id);
    setEditExpDraft({
      role: exp.role,
      company: exp.company,
      startDate: exp.startDate,
      endDate: exp.endDate,
      logoFile: null,
      removeLogo: false
    });
  };

  const cancelEditExperience = () => {
    setEditingExpId(null);
    setEditExpDraft({ role: '', company: '', startDate: '', endDate: '', logoFile: null, removeLogo: false });
  };

  const handleUpdateExperience = async (expId) => {
    if (!editExpDraft.role.trim() || !editExpDraft.company.trim() || !editExpDraft.startDate.trim()) return;
    const formData = new FormData();
    formData.append('role', editExpDraft.role);
    formData.append('company', editExpDraft.company);
    formData.append('startDate', editExpDraft.startDate);
    formData.append('endDate', editExpDraft.endDate || 'Present');
    if (editExpDraft.logoFile) formData.append('companyLogo', editExpDraft.logoFile);
    else if (editExpDraft.removeLogo) formData.append('removeLogo', 'true');

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/experience/${expId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update experience');
      setAbout(data.about);
      cancelEditExperience();
      showMessage('Experience updated');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExperience = async (expId) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/experience/${expId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete experience');
      setAbout(data.about);
      showMessage('Experience removed');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // EDUCATION — add / edit / delete
  // ============================================================
  const handleAddEducation = async () => {
    if (!newEducation.degree.trim() || !newEducation.school.trim() || !newEducation.duration.trim()) return;
    const formData = new FormData();
    Object.entries(newEducation).forEach(([key, val]) => {
      if (key === 'logoFile') {
        if (val) formData.append('schoolLogo', val);
      } else {
        formData.append(key, val);
      }
    });
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/education`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add education');
      setAbout(data.about);
      setNewEducation({ degree: '', school: '', duration: '', grade: '', logoFile: null });
      showMessage('Education added');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditEducation = (edu) => {
    setEditingEduId(edu._id);
    setEditEduDraft({
      degree: edu.degree,
      school: edu.school,
      duration: edu.duration,
      grade: edu.grade || '',
      logoFile: null,
      removeLogo: false
    });
  };

  const cancelEditEducation = () => {
    setEditingEduId(null);
    setEditEduDraft({ degree: '', school: '', duration: '', grade: '', logoFile: null, removeLogo: false });
  };

  const handleUpdateEducation = async (eduId) => {
    if (!editEduDraft.degree.trim() || !editEduDraft.school.trim() || !editEduDraft.duration.trim()) return;
    const formData = new FormData();
    formData.append('degree', editEduDraft.degree);
    formData.append('school', editEduDraft.school);
    formData.append('duration', editEduDraft.duration);
    formData.append('grade', editEduDraft.grade || '');
    if (editEduDraft.logoFile) formData.append('schoolLogo', editEduDraft.logoFile);
    else if (editEduDraft.removeLogo) formData.append('removeLogo', 'true');

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/education/${eduId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update education');
      setAbout(data.about);
      cancelEditEducation();
      showMessage('Education updated');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEducation = async (eduId) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/about/education/${eduId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete education');
      setAbout(data.about);
      showMessage('Education removed');
    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- job status helpers (already inline-editable) ----------
  const addJobStatus = () => {
    setJobStatuses((prev) => [...prev, { label: '', color: '#22c55e', order: prev.length }]);
  };
  const updateJobStatus = (idx, field, value) => {
    setJobStatuses((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };
  const removeJobStatus = (idx) => {
    setJobStatuses((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---------- summary point helpers (already inline-editable) ----------
  const updateSummaryPoint = (idx, value) => {
    setSummaryPoints((prev) => prev.map((p, i) => (i === idx ? value : p)));
  };
  const addSummaryPoint = () => setSummaryPoints((prev) => [...prev, '']);
  const removeSummaryPoint = (idx) => setSummaryPoints((prev) => prev.filter((_, i) => i !== idx));

  if (loading) return <div className="admin-about-loading">Loading...</div>;

  return (
    <div className="admin-about-container">
      <h2 className="admin-about-title">Manage About Page</h2>
      {message && <div className="admin-about-message">{message}</div>}

      {/* Hero */}
      <section className="admin-about-section">
        <h3>Hero Title</h3>
        <div className="admin-row">
          <input
            type="text"
            placeholder="Prefix (e.g. Full-Stack)"
            value={heroTitlePrefix}
            onChange={(e) => setHeroTitlePrefix(e.target.value)}
          />
          <input
            type="text"
            placeholder="Highlight (e.g. Developer)"
            value={heroTitleHighlight}
            onChange={(e) => setHeroTitleHighlight(e.target.value)}
          />
        </div>
      </section>

      {/* Summary points */}
      <section className="admin-about-section">
        <h3>Professional Summary Bullets</h3>
        {summaryPoints.map((point, idx) => (
          <div className="admin-row" key={idx}>
            <textarea value={point} onChange={(e) => updateSummaryPoint(idx, e.target.value)} rows={2} />
            <button className="admin-btn-danger" onClick={() => removeSummaryPoint(idx)}>
              Remove
            </button>
          </div>
        ))}
        <button className="admin-btn-secondary" onClick={addSummaryPoint}>
          + Add bullet
        </button>
      </section>

      {/* Job statuses */}
      <section className="admin-about-section">
        <h3>Job Statuses (slider)</h3>
        {jobStatuses.map((status, idx) => (
          <div className="admin-row" key={idx}>
            <input
              type="text"
              placeholder="Label e.g. Open to Work"
              value={status.label}
              onChange={(e) => updateJobStatus(idx, 'label', e.target.value)}
            />
            <input
              type="color"
              value={status.color}
              onChange={(e) => updateJobStatus(idx, 'color', e.target.value)}
            />
            <button className="admin-btn-danger" onClick={() => removeJobStatus(idx)}>
              Remove
            </button>
          </div>
        ))}
        <button className="admin-btn-secondary" onClick={addJobStatus}>
          + Add status
        </button>
      </section>

      <button className="admin-btn-primary" onClick={handleSaveBase} disabled={saving}>
        {saving ? 'Saving...' : 'Save Hero / Summary / Statuses'}
      </button>

      {/* Resume */}
      <section className="admin-about-section">
        <h3>Resume (PDF)</h3>
        {about?.resume?.url && (
          <p>
            Current:{' '}
            <a href={about.resume.url} target="_blank" rel="noreferrer">
              {about.resume.originalName || 'View resume'}
            </a>{' '}
            <span className="admin-hint">(uploading a new file below replaces this one)</span>
          </p>
        )}
        <input type="file" accept="application/pdf" onChange={(e) => setResumeFile(e.target.files[0])} />
        <button className="admin-btn-primary" onClick={handleResumeUpload} disabled={saving || !resumeFile}>
          Upload Resume
        </button>
      </section>

      {/* Skills */}
      <section className="admin-about-section">
        <h3>Skills</h3>
        <div className="admin-list">
          {about?.skills?.map((skill) =>
            editingSkillId === skill._id ? (
              <div className="admin-edit-card" key={skill._id}>
                <div className="admin-row admin-row-wrap">
                  <input
                    type="text"
                    placeholder="Skill name"
                    value={editSkillDraft.name}
                    onChange={(e) => setEditSkillDraft((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setEditSkillDraft((p) => ({ ...p, logoFile: e.target.files[0], removeLogo: false }))
                    }
                  />
                  {skill.logo?.url && !editSkillDraft.logoFile && (
                    <label className="admin-checkbox-label">
                      <input
                        type="checkbox"
                        checked={editSkillDraft.removeLogo}
                        onChange={(e) => setEditSkillDraft((p) => ({ ...p, removeLogo: e.target.checked }))}
                      />
                      Remove current logo
                    </label>
                  )}
                </div>
                <div className="admin-edit-actions">
                  <button
                    className="admin-btn-primary admin-btn-sm"
                    onClick={() => handleUpdateSkill(skill._id)}
                    disabled={saving}
                  >
                    Save
                  </button>
                  <button className="admin-btn-secondary admin-btn-sm" onClick={cancelEditSkill}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-list-item" key={skill._id}>
                {skill.logo?.url && <img src={skill.logo.url} alt={skill.name} />}
                <span>{skill.name}</span>
                <button className="admin-btn-secondary admin-btn-sm" onClick={() => startEditSkill(skill)}>
                  Edit
                </button>
                <button className="admin-btn-danger admin-btn-sm" onClick={() => handleDeleteSkill(skill._id)}>
                  Delete
                </button>
              </div>
            )
          )}
        </div>
        <div className="admin-row">
          <input
            type="text"
            placeholder="Skill name"
            value={newSkill.name}
            onChange={(e) => setNewSkill((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setNewSkill((prev) => ({ ...prev, logoFile: e.target.files[0] }))}
          />
          <button className="admin-btn-secondary" onClick={handleAddSkill} disabled={saving}>
            Add Skill
          </button>
        </div>
      </section>

      {/* Experience */}
      <section className="admin-about-section">
        <h3>Experience</h3>
        <div className="admin-list">
          {about?.experience?.map((exp) =>
            editingExpId === exp._id ? (
              <div className="admin-edit-card" key={exp._id}>
                <div className="admin-row admin-row-wrap">
                  <input
                    type="text"
                    placeholder="Role"
                    value={editExpDraft.role}
                    onChange={(e) => setEditExpDraft((p) => ({ ...p, role: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Company"
                    value={editExpDraft.company}
                    onChange={(e) => setEditExpDraft((p) => ({ ...p, company: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Start date"
                    value={editExpDraft.startDate}
                    onChange={(e) => setEditExpDraft((p) => ({ ...p, startDate: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="End date"
                    value={editExpDraft.endDate}
                    onChange={(e) => setEditExpDraft((p) => ({ ...p, endDate: e.target.value }))}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setEditExpDraft((p) => ({ ...p, logoFile: e.target.files[0], removeLogo: false }))
                    }
                  />
                  {exp.companyLogo?.url && !editExpDraft.logoFile && (
                    <label className="admin-checkbox-label">
                      <input
                        type="checkbox"
                        checked={editExpDraft.removeLogo}
                        onChange={(e) => setEditExpDraft((p) => ({ ...p, removeLogo: e.target.checked }))}
                      />
                      Remove current logo
                    </label>
                  )}
                </div>
                <div className="admin-edit-actions">
                  <button
                    className="admin-btn-primary admin-btn-sm"
                    onClick={() => handleUpdateExperience(exp._id)}
                    disabled={saving}
                  >
                    Save
                  </button>
                  <button className="admin-btn-secondary admin-btn-sm" onClick={cancelEditExperience}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-list-item" key={exp._id}>
                {exp.companyLogo?.url && <img src={exp.companyLogo.url} alt={exp.company} />}
                <span>
                  {exp.role} — {exp.company} ({exp.startDate} – {exp.endDate})
                </span>
                <button className="admin-btn-secondary admin-btn-sm" onClick={() => startEditExperience(exp)}>
                  Edit
                </button>
                <button className="admin-btn-danger admin-btn-sm" onClick={() => handleDeleteExperience(exp._id)}>
                  Delete
                </button>
              </div>
            )
          )}
        </div>
        <div className="admin-row admin-row-wrap">
          <input
            type="text"
            placeholder="Role"
            value={newExperience.role}
            onChange={(e) => setNewExperience((p) => ({ ...p, role: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Company"
            value={newExperience.company}
            onChange={(e) => setNewExperience((p) => ({ ...p, company: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Start date (e.g. 21 Jul 2026)"
            value={newExperience.startDate}
            onChange={(e) => setNewExperience((p) => ({ ...p, startDate: e.target.value }))}
          />
          <input
            type="text"
            placeholder="End date (e.g. Present)"
            value={newExperience.endDate}
            onChange={(e) => setNewExperience((p) => ({ ...p, endDate: e.target.value }))}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setNewExperience((p) => ({ ...p, logoFile: e.target.files[0] }))}
          />
          <button className="admin-btn-secondary" onClick={handleAddExperience} disabled={saving}>
            Add Experience
          </button>
        </div>
      </section>

      {/* Education */}
      <section className="admin-about-section">
        <h3>Education</h3>
        <div className="admin-list">
          {about?.education?.map((edu) =>
            editingEduId === edu._id ? (
              <div className="admin-edit-card" key={edu._id}>
                <div className="admin-row admin-row-wrap">
                  <input
                    type="text"
                    placeholder="Degree"
                    value={editEduDraft.degree}
                    onChange={(e) => setEditEduDraft((p) => ({ ...p, degree: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="School"
                    value={editEduDraft.school}
                    onChange={(e) => setEditEduDraft((p) => ({ ...p, school: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Duration"
                    value={editEduDraft.duration}
                    onChange={(e) => setEditEduDraft((p) => ({ ...p, duration: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Grade"
                    value={editEduDraft.grade}
                    onChange={(e) => setEditEduDraft((p) => ({ ...p, grade: e.target.value }))}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setEditEduDraft((p) => ({ ...p, logoFile: e.target.files[0], removeLogo: false }))
                    }
                  />
                  {edu.schoolLogo?.url && !editEduDraft.logoFile && (
                    <label className="admin-checkbox-label">
                      <input
                        type="checkbox"
                        checked={editEduDraft.removeLogo}
                        onChange={(e) => setEditEduDraft((p) => ({ ...p, removeLogo: e.target.checked }))}
                      />
                      Remove current logo
                    </label>
                  )}
                </div>
                <div className="admin-edit-actions">
                  <button
                    className="admin-btn-primary admin-btn-sm"
                    onClick={() => handleUpdateEducation(edu._id)}
                    disabled={saving}
                  >
                    Save
                  </button>
                  <button className="admin-btn-secondary admin-btn-sm" onClick={cancelEditEducation}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-list-item" key={edu._id}>
                {edu.schoolLogo?.url && <img src={edu.schoolLogo.url} alt={edu.school} />}
                <span>
                  {edu.degree} — {edu.school} ({edu.duration}) {edu.grade}
                </span>
                <button className="admin-btn-secondary admin-btn-sm" onClick={() => startEditEducation(edu)}>
                  Edit
                </button>
                <button className="admin-btn-danger admin-btn-sm" onClick={() => handleDeleteEducation(edu._id)}>
                  Delete
                </button>
              </div>
            )
          )}
        </div>
        <div className="admin-row admin-row-wrap">
          <input
            type="text"
            placeholder="Degree"
            value={newEducation.degree}
            onChange={(e) => setNewEducation((p) => ({ ...p, degree: e.target.value }))}
          />
          <input
            type="text"
            placeholder="School"
            value={newEducation.school}
            onChange={(e) => setNewEducation((p) => ({ ...p, school: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Duration (e.g. 2022 - 2026)"
            value={newEducation.duration}
            onChange={(e) => setNewEducation((p) => ({ ...p, duration: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Grade"
            value={newEducation.grade}
            onChange={(e) => setNewEducation((p) => ({ ...p, grade: e.target.value }))}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setNewEducation((p) => ({ ...p, logoFile: e.target.files[0] }))}
          />
          <button className="admin-btn-secondary" onClick={handleAddEducation} disabled={saving}>
            Add Education
          </button>
        </div>
      </section>
    </div>
  );
};

export default AdminAbout;