import React, { useState, useEffect } from 'react';
import { principalCommentsAPI, termsAPI, sessionsAPI, classesAPI } from '../../api';
import './PrincipalComments.css';

const DEFAULT_TEMPLATES = [
    { id: 'excellent', min: 90, max: 100, label: 'Excellent', comment: 'An outstanding and brilliant performance. Keep up the excellent work!' },
    { id: 'very-good', min: 80, max: 89, label: 'Very Good', comment: 'A very commendable performance. Continue to maintain this high standard.' },
    { id: 'good', min: 70, max: 79, label: 'Good', comment: 'A good performance. With more effort, higher marks can be achieved.' },
    { id: 'fair', min: 60, max: 69, label: 'Fair', comment: 'A fair performance. More effort is needed to improve.' },
    { id: 'average', min: 50, max: 59, label: 'Average', comment: 'An average performance. More attention to studies is required.' },
    { id: 'below', min: 40, max: 49, label: 'Below Average', comment: 'Below average performance. Extra attention is needed.' },
    { id: 'poor', min: 0, max: 39, label: 'Poor', comment: 'Very poor performance. Urgent intervention is needed.' }
];

const PrincipalComments = () => {
    const [termId, setTermId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [classId, setClassId] = useState('');
    const [terms, setTerms] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingComment, setEditingComment] = useState(null);
    const [editText, setEditText] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [confirmGenerate, setConfirmGenerate] = useState(false);

    // ============================================
    // TEMPLATE STATE
    // ============================================
    const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
    const [showPanel, setShowPanel] = useState(false);
    const [editIndex, setEditIndex] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [editMin, setEditMin] = useState('');
    const [editMax, setEditMax] = useState('');

    useEffect(() => { fetchInitialData(); }, []);

    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => { setSuccess(''); setError(''); }, 4000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    useEffect(() => {
        if (termId && sessionId) fetchComments();
    }, [termId, sessionId, classId]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('principal_templates');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setTemplates(parsed);
                }
            }
        } catch (e) {
            console.log('No saved templates, using defaults');
        }
    }, []);

    const fetchInitialData = async () => {
        try {
            const [termsRes, sessionsRes, classesRes] = await Promise.all([
                termsAPI.getAll(), sessionsAPI.getAll(), classesAPI.getAllForDropdown()
            ]);
            if (termsRes.success) {
                setTerms(termsRes.data);
                const active = termsRes.data.find(t => t.status === 'active');
                if (active) {
                    setTermId(active._id);
                    setSessionId(active.session ? active.session._id : active.session);
                }
            }
            if (sessionsRes.success) setSessions(sessionsRes.data);
            if (classesRes.success) setClasses(classesRes.data.data || classesRes.data);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const fetchComments = async () => {
        try {
            setLoading(true);
            // FIX 1: Changed principalComments.getAll to principalCommentsAPI.getAll
            const res = await principalCommentsAPI.getAll({
                termId,
                sessionId,
                classId: classId || undefined
            });
            if (res.success) setComments(res.data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // TEMPLATE HANDLERS
    // ============================================
    const openPanel = () => { setShowPanel(true); };

    const closePanel = () => {
        setShowPanel(false);
        setEditIndex(null);
        setEditValue('');
        setEditMin('');
        setEditMax('');
    };

    const startEdit = (index) => {
        setEditIndex(index);
        setEditValue(templates[index].comment);
        setEditMin(templates[index].min);
        setEditMax(templates[index].max);
    };

    const saveEdit = () => {
        if (editIndex === null) return;
        const updated = [...templates];
        const newMin = parseInt(editMin) || 0;
        const newMax = parseInt(editMax) || 0;

        // Validate
        if (newMin < 0) { setError('Minimum percentage cannot be negative'); return; }
        if (newMax > 100) { setError('Maximum percentage cannot exceed 100'); return; }
        if (newMin >= newMax) { setError('Minimum must be less than maximum'); return; }

        updated[editIndex] = {
            ...updated[editIndex],
            min: newMin,
            max: newMax,
            comment: editValue,
            label: newMin + '-' + newMax + '%',
            range: newMin + '-' + newMax
        };

        setTemplates(updated);
        setEditIndex(null);
        setEditValue('');
        setEditMin('');
        setEditMax('');
    };

    const addTemplate = () => {
        // Find the lowest unused range
        let maxUsed = -1;
        templates.forEach(t => {
            if (t.max > maxUsed) maxUsed = t.max;
        });

        const newMin = maxUsed + 1;
        const newMax = Math.min(newMin + 10, 100);

        const newTemplate = {
            id: 'custom-' + Date.now(),
            min: newMin,
            max: newMax,
            label: newMin + '-' + newMax + '%',
            comment: 'Custom comment for ' + newMin + '-' + newMax + '% range'
        };

        setTemplates([...templates, newTemplate]);
        setEditIndex(templates.length - 1);
        setEditValue(newTemplate.comment);
        setEditMin(newMin.toString());
        setEditMax(newMax.toString());
    };

    const removeTemplate = (index) => {
        const updated = templates.filter((_, i) => i !== index);
        setTemplates(updated);
        if (editIndex === index) {
            setEditIndex(null);
            setEditValue('');
            setEditMin('');
            setEditMax('');
        }
    };

    const resetToDefaults = () => {
        setTemplates(DEFAULT_TEMPLATES);
        localStorage.removeItem('principal_templates');
        setSuccess('Templates reset to defaults');
    };

    const saveAllTemplates = () => {
        try {
            localStorage.setItem('principal_templates', JSON.stringify(templates));
            setSuccess('Templates saved! Now click Generate for Students to apply them.');
        } catch (e) {
            setError('Failed to save templates');
        }
    };

    // ============================================
    // GENERATE
    // ============================================
    const handleGenerate = async () => {
        setConfirmGenerate(false);
        try {
            setGenerating(true);
            setError('');
            saveAllTemplates();

            const templatesForBackend = templates.map(t => ({
                min: t.min,
                max: t.max,
                comment: t.comment
            }));

            console.log('Sending templates:', JSON.stringify(templatesForBackend));

            const res = await principalCommentsAPI.generate({
                termId,
                sessionId,
                classId: classId || undefined,
                commentTemplates: templatesForBackend
            });

            if (res.success) {
                const count = Array.isArray(res.data) ? res.data.length : 0;
                setSuccess('Generated comments for ' + count + ' students');
                fetchComments();
            } else {
                setError(res.message || 'Generation failed');
            }
        } catch (error) {
            setError(error.response && error.response && error.response.data && error.response.data.message ? error.response.data.message : 'Failed to generate');
        } finally {
            setGenerating(false);
        }
    };

    // ============================================
    // COMMENT EDIT/DELETE
    // ============================================
    const startEditComment = (comment) => {
        setEditingComment(comment._id);
        setEditText(comment.comment);
    };

    const saveEditComment = async () => {
        try {
            let res;
            if (principalCommentsAPI.update) {
                res = await principalCommentsAPI.update(editingComment, { comment: editText });
            } else {
                const target = comments.find(c => c._id === editingComment);
                res = await principalCommentsAPI.create({
                    studentId: target && target.studentId ? target.studentId._id : null,
                    termId,
                    sessionId,
                    comment: editText,
                    classTeacherComment: target && target.classTeacherComment ? target.classTeacherComment : null
                });
            }
            if (res.success) {
                setSuccess('Comment updated');
                setEditingComment(null);
                fetchComments();
            }
        } catch (error) {
            setError(error.response && error.response && error.response.data && error.response.data.message ? error.response.data.message : 'Failed to update');
        }
    };

    const deleteComment = async (id) => {
        setDeleteConfirm(null);
        try {
            const res = await principalCommentsAPI.delete(id);
            if (res.success) {
                setSuccess('Comment deleted');
                fetchComments();
            }
        } catch (error) {
            setError(error.response && error.response && error.response.data && error.response.data.message ? error.response.data.message : 'Failed to delete');
        }
    };

    const findTemplate = (commentText) => {
        if (!commentText) return null;
        return templates.find(function(t) {
            return commentText.indexOf(t.comment.substring(0, 20)) !== -1;
        }) || null;
    };

    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="pc-root">
            <div className="pc-bg-orb pc-bg-orb--1"></div>
            <div className="pc-bg-orb pc-bg-orb--2"></div>

            <div className="pc-toasts">
                {error && (
                    <div className="pc-toast pc-toast--error" key="error">
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="pc-toast pc-toast--success" key={success}>
                        <span>{success}</span>
                    </div>
                )}
            </div>

            <header className="pc-header">
                <div className="pc-header-content">
                    <div className="pc-header-text">
                        <div className="pc-header-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="pc-title">Principal Comments</h1>
                            <p className="pc-subtitle">Set custom percentage ranges and comments, then generate for all students</p>
                        </div>
                    </div>
                    <div className="pc-header-actions">
                        <button
                            onClick={openPanel}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: showPanel ? '#6366f1' : 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer'
                            }}
                        >
                            {showPanel ? 'Close' : 'Set Comments'}
                        </button>
                        <button
                            className="pc-generate-btn"
                            onClick={() => setConfirmGenerate(true)}
                            disabled={generating || !termId || !sessionId}
                        >
                            {generating ? 'Generating...' : 'Generate for Students'}
                        </button>
                    </div>
                </div>
            </header>

            {/* ============================================ */}
            {/* TEMPLATES PANEL */}
            {/* ============================================ */}
            {showPanel && (
                <div className="pc-templates-panel">
                    <div className="pc-templates-header">
                        <div>
                            <h3 className="pc-templates-title">
                                Set Your Comments by Percentage Range
                            </h3>
                            <p className="pc-templates-subtitle">
                                Set the percentage range and the comment for each bracket. Click "Add Range" to create new ones.
                            </p>
                        </div>
                        <div className="pc-templates-actions">
                            <button className="pc-btn-sm pc-btn-sm--ghost" onClick={resetToDefaults}>
                                Reset Default
                            </button>
                            <button className="pc-btn-sm pc-btn-sm--save" onClick={saveAllTemplates}>
                                Save Templates
                            </button>
                        </div>
                    </div>

                    <div className="pc-templates-grid">
                        {templates.map((template, index) => (
                            <div
                                key={template.id}
                                className={`pc-template-card ${editIndex === index ? 'pc-template-card--editing' : ''}`}
                                style={{ borderLeftColor: template.color }}
                            >
                                <div className="pc-template-card-header">
                                    <div className="pc-template-range">
                                        <span className="pc-template-label" style={{ color: template.color }}>
                                            {template.label}
                                        </span>
                                        <span className="pc-template-percentage">
                                            {template.range}
                                        </span>
                                    </div>
                                    <div className="pc-template-actions">
                                        {editIndex === index ? (
                                            <button
                                                onClick={() => { setEditIndex(null); setEditValue(''); setEditMin(''); setEditMax(''); }}
                                                className="pc-template-cancel-btn"
                                            >
                                                Cancel
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(index)}
                                                className="pc-template-edit-btn"
                                                title="Edit this range"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                            </button>
                                        )}
                                        {editIndex !== index && (
                                            <button
                                                onClick={() => removeTemplate(index)}
                                                className="pc-template-delete-btn"
                                                title="Delete this range"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {editIndex === index ? (
                                    <div className="pc-template-edit-area">
                                        {/* Percentage inputs */}
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                                                    Min Percentage (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={editMin}
                                                    onChange={(e) => setEditMin(e.target.value)}
                                                    className="pc-template-input"
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                                                    Max Percentage (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={editMax}
                                                    onChange={(e) => setEditMax(e.target.value)}
                                                    className="pc-template-input"
                                                />
                                            </div>
                                        </div>
                                        {/* Comment textarea */}
                                        <textarea
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            rows={3}
                                            className="pc-template-textarea"
                                            placeholder="Write your custom comment here..."
                                            autoFocus
                                        />
                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                            <button
                                                onClick={() => { setEditIndex(null); setEditValue(''); setEditMin(''); setEditMax(''); }}
                                                className="pc-template-cancel-btn"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveEdit}
                                                className="pc-template-save-btn"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="pc-template-comment">{template.comment}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add Range Button */}
                    <button
                        onClick={addTemplate}
                        className="pc-add-template-btn"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add New Range
                    </button>

                    {/* Info */}
                    <div className="pc-templates-notice">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                        </svg>
                        <span>Edit any range above, click Apply, then click Generate for Students</span>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="pc-filters">
                <div className="pc-filter-row">
                    <div className="pc-filter-field">
                        <label htmlFor="pc-term">Term</label>
                        <div className="pc-select-wrap">
                            <select id="pc-term" value={termId} onChange={(e) => setTermId(e.target.value)} className="pc-select">
                                <option value="">Select Term</option>
                                {terms.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pc-select-chevron">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </div>
                    </div>
                    <div className="pc-filter-field">
                        <label htmlFor="pc-session">Session</label>
                        <div className="pc-select-wrap">
                            <select id="pc-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="pc-select">
                                <option value="">Select Session</option>
                                {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pc-select-chevron">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </div>
                    </div>
                    <div className="pc-filter-field">
                        <label htmlFor="pc-class">Class <span className="pc-optional">(optional)</span></label>
                        <div className="pc-select-wrap">
                            <select id="pc-class" value={classId} onChange={(e) => setClassId(e.target.value)} className="pc-select">
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pc-select-chevron">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Generate Confirm */}
            {confirmGenerate && (
                <div className="pc-generate-confirm">
                    <div className="pc-generate-confirm-inner">
                        <span>Apply your custom percentage-based comments to all students?</span>
                    </div>
                    <div className="pc-generate-confirm-actions">
                        <button className="pc-btn-sm pc-btn-sm--ghost" onClick={() => setConfirmGenerate(false)}>Cancel</button>
                        <button className="pc-btn-sm pc-btn-sm--generate" onClick={handleGenerate}>Generate</button>
                    </div>
                </div>
            )}

            {!loading && comments.length > 0 && (
                <div className="pc-results-info">
                    <span className="pc-results-count">
                        <strong>{comments.length}</strong> comment{comments.length !== 1 ? 's' : ''}
                    </span>
                </div>
            )}

            {loading ? (
                <div className="pc-table-loading">
                    <div className="pc-inline-loader">
                        <div className="pc-loader-ring"></div>
                        <div className="pc-loader-ring"></div>
                        <div className="pc-loader-ring"></div>
                    </div>
                    <span>Loading comments...</span>
                </div>
            ) : comments.length === 0 ? (
                <div className="pc-empty">
                    <div className="pc-empty-illustration">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                    </div>
                    <h3>No Comments Yet</h3>
                    <p>Click Set Comments to customize percentage ranges, then Generate for Students.</p>
                </div>
            ) : (
                <div className="pc-list">
                    {comments.map((comment, index) => {
                        const matched = findTemplate(comment.comment);

                        return (
                            <div
                                key={comment._id}
                                className={editingComment === comment._id ? 'pc-card--editing' : ''}
                                style={{
                                    animationDelay: index * 0.04 + 's',
                                    borderLeftColor: matched ? matched.color : 'transparent'
                                }}
                            >
                                <div className="pc-card-top">
                                    <div className="pc-student-block">
                                        {/* FIX 2: Added a '+' between the two string evaluations to fix the parsing error */}
                                        <div className="pc-student-avatar">
                                            {(comment.studentId && comment.studentId.firstName ? comment.studentId.firstName[0] : '') + (comment.studentId && comment.studentId.lastName ? comment.studentId.lastName[0] : '')}
                                        </div>
                                        <div className="pc-student-info">
                                            <span className="pc-student-name">
                                                {comment.studentId && comment.studentId.firstName ? comment.studentId.firstName : ''}{' '}
                                                {comment.studentId && comment.studentId.lastName ? comment.studentId.lastName : ''}
                                            </span>
                                            <span className="pc-student-id">
                                                {comment.studentId && comment.studentId.admissionNumber ? comment.studentId.admissionNumber : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pc-card-top-right">
                                        {comment.percentage !== undefined && comment.percentage !== null && (
                                            <span className="pc-percentage-badge" style={{
                                                backgroundColor: matched ? matched.color + '25' : 'rgba(255,255,255,0.1)',
                                                color: matched ? matched.color : '#fff'
                                            }}>
                                                {comment.percentage}%
                                            </span>
                                        )}
                                        <span className="pc-card-index">#{index + 1}</span>
                                    </div>
                                </div>

                                {editingComment === comment._id ? (
                                    <div className="pc-edit-area">
                                        <div className="pc-textarea-wrap">
                                            <textarea
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                rows={4}
                                                className="pc-textarea"
                                                placeholder="Write comment..."
                                                autoFocus
                                            />
                                            <span className="pc-textarea-count">{editText.length} chars</span>
                                        </div>
                                        <div className="pc-quick-templates">
                                            <span className="pc-quick-templates-label">Quick insert:</span>
                                            {templates.map(t => (
                                                <button
                                                    key={t.id}
                                                    className="pc-quick-template-btn"
                                                    style={{ borderColor: t.color }}
                                                    onClick={() => setEditText(t.comment)}
                                                >
                                                    {t.range}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="pc-edit-actions">
                                            <button onClick={() => setEditingComment(null)} className="pc-btn-cancel">Discard</button>
                                            <button onClick={saveEditComment} className="pc-btn-save">Save Comment</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pc-comment-body">
                                        <p className="pc-comment-text">{comment.comment}</p>
                                    </div>
                                )}

                                {comment.classTeacherComment && (
                                    <div className="pc-teacher-ref">
                                        <div className="pc-teacher-ref-label">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z" />
                                            </svg>
                                            <span>Class Teacher Remark</span>
                                        </div>
                                        <p className="pc-teacher-ref-text">{comment.classTeacherComment}</p>
                                    </div>
                                )}

                                {editingComment !== comment._id && (
                                    <div className="pc-card-actions">
                                        {deleteConfirm === comment._id ? (
                                            <div className="pc-confirm-row">
                                                <span className="pc-confirm-text">Delete this comment?</span>
                                                <button className="pc-btn-sm pc-btn-sm--danger" onClick={() => deleteComment(comment._id)}>Yes</button>
                                                <button className="pc-btn-sm pc-btn-sm--ghost" onClick={() => setDeleteConfirm(null)}>No</button>
                                            </div>
                                        ) : (
                                            <>
                                                <button className="pc-action-btn pc-action-btn--edit" onClick={() => startEditComment(comment)} title="Edit comment">
                                                    Edit
                                                </button>
                                                <button className="pc-action-btn pc-action-btn--delete" onClick={() => setDeleteConfirm(comment._id)} title="Delete comment">
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PrincipalComments;