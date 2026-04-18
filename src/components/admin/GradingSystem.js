import React, { useState, useEffect } from 'react';
import { gradingSystemsAPI, attendanceAPI, sessionsAPI, termsAPI } from '../../api';
import './GradingSystem.css';

const DEFAULT_GRADES = [
    { grade: 'A', minScore: 70, maxScore: 100, remark: 'Excellent', description: '' },
    { grade: 'B', minScore: 60, maxScore: 69, remark: 'Very Good', description: '' },
    { grade: 'C', minScore: 50, maxScore: 59, remark: 'Good', description: '' },
    { grade: 'D', minScore: 40, maxScore: 49, remark: 'Fair', description: '' },
    { grade: 'F', minScore: 0, maxScore: 39, remark: 'Fail', description: '' }
];

const TERMS = ['First Term', 'Second Term', 'Third Term'];

const getGradeColor = (grade) => {
    const g = (grade || '').toUpperCase().trim();
    if (g === 'A' || g === 'A+' || g === 'A-') return '#059669';
    if (g === 'B' || g === 'B+' || g === 'B-') return '#0891b2';
    if (g === 'C' || g === 'C+' || g === 'C-') return '#d97706';
    if (g === 'D' || g === 'D+' || g === 'D-') return '#ea580c';
    return '#dc2626';
};

const getGradeBg = (grade) => {
    const g = (grade || '').toUpperCase().trim();
    if (g === 'A' || g === 'A+' || g === 'A-') return '#ecfdf5';
    if (g === 'B' || g === 'B+' || g === 'B-') return '#ecfeff';
    if (g === 'C' || g === 'C+' || g === 'C-') return '#fffbeb';
    if (g === 'D' || g === 'D+' || g === 'D-') return '#fff7ed';
    return '#fef2f2';
};

const GradingSystem = () => {
    const [systems, setSystems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingSystem, setEditingSystem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        isDefault: false,
        grades: [...DEFAULT_GRADES.map(g => ({ ...g }))]
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    /* ── School Days Open state ── */
    const currentYear = new Date().getFullYear();
    const [schoolDays, setSchoolDays] = useState({
        termId: '',           // ✅ Now storing term_id (MongoDB ObjectId)
        sessionId: '',        // ✅ Now storing session_id (MongoDB ObjectId)
        term: 'First Term',   // Display name
        session: `${currentYear}/${currentYear + 1}`, // Display name
        daysOpen: ''
    });
    const [sdLoading, setSdLoading] = useState(false);
    const [sdSaved, setSdSaved] = useState(false);
    const [sdHistory, setSdHistory] = useState([]);
    
    // ✅ NEW: Store available terms and sessions from backend
    const [availableTerms, setAvailableTerms] = useState([]);
    const [availableSessions, setAvailableSessions] = useState([]);
    const [loadingDropdowns, setLoadingDropdowns] = useState(false);

    useEffect(() => {
        fetchSystems();
        fetchDropdownOptions();
    }, []);

    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess('');
                setError('');
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    // ✅ Fetch existing school days when termId and sessionId change
    useEffect(() => {
        if (schoolDays.termId && schoolDays.sessionId) {
            fetchExistingSchoolDays();
        }
    }, [schoolDays.termId, schoolDays.sessionId]);

    /* ── Fetch dropdown options from backend ── */
    const fetchDropdownOptions = async () => {
        setLoadingDropdowns(true);
        try {
            const [termsRes, sessionsRes] = await Promise.all([
                termsAPI.getAll(),
                sessionsAPI.getAll()
            ]);
            
            if (termsRes.success) {
                setAvailableTerms(termsRes.data || []);
            }
            if (sessionsRes.success) {
                setAvailableSessions(sessionsRes.data || []);
            }

            // ✅ Set default selections if available
            if (termsRes.data?.length > 0) {
                const defaultTerm = termsRes.data.find(t => t.is_active) || termsRes.data[0];
                setSchoolDays(prev => ({
                    ...prev,
                    termId: defaultTerm._id,
                    term: defaultTerm.name
                }));
            }
            if (sessionsRes.data?.length > 0) {
                const defaultSession = sessionsRes.data.find(s => s.is_active) || sessionsRes.data[0];
                setSchoolDays(prev => ({
                    ...prev,
                    sessionId: defaultSession._id,
                    session: defaultSession.name
                }));
            }
        } catch (err) {
            console.error('Error fetching dropdown options:', err);
        } finally {
            setLoadingDropdowns(false);
        }
    };

    /* ── Fetch existing school days for selected term/session ── */
    const fetchExistingSchoolDays = async () => {
        try {
            const response = await attendanceAPI.getSchoolOpenDays({
                term_id: schoolDays.termId,
                session_id: schoolDays.sessionId
            });

            if (response.success && response.data) {
                setSchoolDays(prev => ({
                    ...prev,
                    daysOpen: response.data.times_open || ''
                }));
                setSdSaved(true); // Indicate it was previously saved
            } else {
                // No existing record - clear the days
                setSchoolDays(prev => ({
                    ...prev,
                    daysOpen: ''
                }));
                setSdSaved(false);
            }
        } catch (err) {
            // 404 means no record exists yet - that's fine
            if (err.response?.status !== 404) {
                console.error('Error fetching school days:', err);
            }
            setSchoolDays(prev => ({
                ...prev,
                daysOpen: ''
            }));
            setSdSaved(false);
        }
    };

    /* ── Fetch history of all saved school days ── */
    const fetchSchoolDaysHistory = async () => {
        // The API doesn't have a "get all history" endpoint,
        // so we rely on local history from saves
    };

    /* ── ✅ FIXED: Save school days using correct endpoint ── */
    const handleSchoolDaysSave = async (e) => {
        e?.preventDefault();
        const days = Number(schoolDays.daysOpen);
        
        if (!schoolDays.daysOpen || isNaN(days) || days < 1) {
            setError('Please enter a valid number of school days (at least 1).');
            return;
        }
        if (!schoolDays.termId) {
            setError('Please select a term.');
            return;
        }
        if (!schoolDays.sessionId) {
            setError('Please select a session.');
            return;
        }

        setSdLoading(true);
        setError('');
        setSuccess('');

        try {
            // ✅ FIXED: Using the correct endpoint with correct parameter names
            const response = await attendanceAPI.setSchoolOpenDays({
                term_id: schoolDays.termId,
                session_id: schoolDays.sessionId,
                times_open: days
            });

            if (response.success) {
                setSuccess(
                    `School days set to ${days} for ${schoolDays.term}, ${schoolDays.session}`
                );
                setSdSaved(true);

                // Update history
                setSdHistory(prev => {
                    const filtered = prev.filter(
                        h => !(h.termId === schoolDays.termId && h.sessionId === schoolDays.sessionId)
                    );
                    return [
                        { 
                            termId: schoolDays.termId,
                            sessionId: schoolDays.sessionId,
                            term: schoolDays.term, 
                            session: schoolDays.session, 
                            daysOpen: days, 
                            savedAt: new Date().toISOString() 
                        },
                        ...filtered
                    ].slice(0, 6);
                });
            } else {
                setError(response.message || 'Failed to save school days.');
            }
        } catch (err) {
            console.error('Save school days error:', err);
            setError(err.response?.data?.message || 'Failed to save school days.');
        } finally {
            setSdLoading(false);
        }
    };

    /* ── ✅ NEW: Increment school days by 1 ── */
    const handleIncrementSchoolDays = async () => {
        if (!schoolDays.termId || !schoolDays.sessionId) {
            setError('Please select both term and session first.');
            return;
        }

        setSdLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await attendanceAPI.updateSchoolOpenDays({
                term_id: schoolDays.termId,
                session_id: schoolDays.sessionId,
                increment: true
            });

            if (response.success) {
                const newDays = response.data.times_open;
                setSchoolDays(prev => ({
                    ...prev,
                    daysOpen: newDays
                }));
                setSuccess(`School days incremented to ${newDays}`);
                setSdSaved(true);

                // Update history
                setSdHistory(prev => {
                    const filtered = prev.filter(
                        h => !(h.termId === schoolDays.termId && h.sessionId === schoolDays.sessionId)
                    );
                    return [
                        { 
                            termId: schoolDays.termId,
                            sessionId: schoolDays.sessionId,
                            term: schoolDays.term, 
                            session: schoolDays.session, 
                            daysOpen: newDays, 
                            savedAt: new Date().toISOString() 
                        },
                        ...filtered
                    ].slice(0, 6);
                });
            } else {
                setError(response.message || 'Failed to increment school days.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to increment school days.');
        } finally {
            setSdLoading(false);
        }
    };

    /* ── Grading System helpers ── */
    const fetchSystems = async () => {
        try {
            setLoading(true);
            const response = await gradingSystemsAPI.getAll();
            if (response.success) {
                setSystems(response.data);
            }
        } catch (error) {
            console.error('Error fetching grading systems:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGradeChange = (index, field, value) => {
        const newGrades = [...formData.grades];
        newGrades[index][field] = field === 'grade' || field === 'remark' || field === 'description'
            ? value
            : Number(value);
        setFormData({ ...formData, grades: newGrades });
    };

    const addGrade = () => {
        setFormData({
            ...formData,
            grades: [...formData.grades, { grade: '', minScore: 0, maxScore: 0, remark: '', description: '' }]
        });
    };

    const removeGrade = (index) => {
        if (formData.grades.length <= 1) return;
        const newGrades = formData.grades.filter((_, i) => i !== index);
        setFormData({ ...formData, grades: newGrades });
    };

    const resetForm = () => ({
        name: '',
        isDefault: false,
        grades: [...DEFAULT_GRADES.map(g => ({ ...g }))]
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingSystem) {
                const response = await gradingSystemsAPI.update(editingSystem._id, formData);
                if (response.success) {
                    setSuccess('Grading system updated successfully');
                    setEditingSystem(null);
                }
            } else {
                const response = await gradingSystemsAPI.create(formData);
                if (response.success) {
                    setSuccess('Grading system created successfully');
                } else {
                    setError(response.message);
                    return;
                }
            }

            setShowForm(false);
            fetchSystems();
        } catch (error) {
            setError(error.response?.data?.message || 'An error occurred');
        }
    };

    const handleEdit = (system) => {
        setEditingSystem(system);
        setFormData({
            name: system.name,
            isDefault: system.isDefault,
            grades: system.grades.map(g => ({ ...g }))
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSetDefault = async (id) => {
        try {
            const response = await gradingSystemsAPI.update(id, { isDefault: true });
            if (response.success) {
                setSuccess('Default grading system updated');
                fetchSystems();
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to set default');
        }
    };

    const handleDelete = async (id) => {
        setDeleteConfirm(null);
        try {
            const response = await gradingSystemsAPI.delete(id);
            if (response.success) {
                setSuccess('Grading system deleted successfully');
                fetchSystems();
            } else {
                setError(response.message);
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to delete');
        }
    };

    if (loading) {
        return (
            <div className="gs-loading-wrap">
                <div className="gs-loader">
                    <div className="gs-loader-ring"></div>
                    <div className="gs-loader-ring"></div>
                    <div className="gs-loader-ring"></div>
                </div>
                <p>Loading grading systems...</p>
            </div>
        );
    }

    return (
        <div className="gs-root">
            <div className="gs-bg-orb gs-bg-orb--1"></div>
            <div className="gs-bg-orb gs-bg-orb--2"></div>

            {/* Toasts */}
            <div className="gs-toasts">
                {error && (
                    <div className="gs-toast gs-toast--error" key="error">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="gs-toast gs-toast--success" key="success">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>{success}</span>
                    </div>
                )}
            </div>

            {/* Header */}
            <header className="gs-header">
                <div className="gs-header-content">
                    <div className="gs-header-text">
                        <div className="gs-header-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                <line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="gs-title">Grading Systems</h1>
                            <p className="gs-subtitle">
                                {systems.length} system{systems.length !== 1 ? 's' : ''} configured
                                {systems.some(s => s.isDefault) && (
                                    <span className="gs-badge-default">1 default</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        className={`gs-add-btn ${showForm ? 'gs-add-btn--open' : ''}`}
                        onClick={() => {
                            setEditingSystem(null);
                            setFormData(resetForm());
                            setShowForm(!showForm);
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: showForm ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        {showForm ? 'Cancel' : 'New System'}
                    </button>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════
                SCHOOL DAYS OPEN SECTION - FIXED
                ═══════════════════════════════════════════════════════════ */}
            <section className="sd-section">
                <div className="sd-card">
                    <div className="sd-card-header">
                        <div className="sd-card-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                                <path d="M9 16l2 2 4-4"/>
                            </svg>
                        </div>
                        <div>
                            <h2 className="sd-card-title">School Days Open</h2>
                            <p className="sd-card-desc">
                                Set the total number of times school was open for a term. Used to calculate attendance percentages.
                            </p>
                        </div>
                    </div>

                    <form className="sd-form" onSubmit={handleSchoolDaysSave}>
                        <div className="sd-form-grid">
                            {/* ✅ FIXED: Term dropdown - now uses term_id */}
                            <div className="sd-field">
                                <label className="sd-label" htmlFor="sd-term">Term</label>
                                <div className="sd-select-wrap">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sd-field-icon">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/>
                                        <line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                    <select
                                        id="sd-term"
                                        value={schoolDays.termId}
                                        onChange={(e) => {
                                            const selectedTerm = availableTerms.find(t => t._id === e.target.value);
                                            setSchoolDays({ 
                                                ...schoolDays, 
                                                termId: e.target.value,
                                                term: selectedTerm?.name || '',
                                                daysOpen: '',
                                                sdSaved: false
                                            });
                                        }}
                                        className="sd-select"
                                        disabled={loadingDropdowns}
                                        required
                                    >
                                        <option value="">
                                            {loadingDropdowns ? 'Loading...' : 'Select Term'}
                                        </option>
                                        {availableTerms.map(t => (
                                            <option key={t._id} value={t._id}>
                                                {t.name}
                                                {t.is_active ? ' (Active)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sd-select-chevron">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </div>
                            </div>

                            {/* ✅ FIXED: Session dropdown - now uses session_id */}
                            <div className="sd-field">
                                <label className="sd-label" htmlFor="sd-session">Session</label>
                                <div className="sd-select-wrap">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sd-field-icon">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    <select
                                        id="sd-session"
                                        value={schoolDays.sessionId}
                                        onChange={(e) => {
                                            const selectedSession = availableSessions.find(s => s._id === e.target.value);
                                            setSchoolDays({ 
                                                ...schoolDays, 
                                                sessionId: e.target.value,
                                                session: selectedSession?.name || '',
                                                daysOpen: '',
                                                sdSaved: false
                                            });
                                        }}
                                        className="sd-select"
                                        disabled={loadingDropdowns}
                                        required
                                    >
                                        <option value="">
                                            {loadingDropdowns ? 'Loading...' : 'Select Session'}
                                        </option>
                                        {availableSessions.map(s => (
                                            <option key={s._id} value={s._id}>
                                                {s.name}
                                                {s.is_active ? ' (Active)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sd-select-chevron">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </div>
                            </div>

                            {/* Days Open */}
                            <div className="sd-field">
                                <label className="sd-label" htmlFor="sd-days">Days Open</label>
                                <div className="sd-input-wrap">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sd-field-icon">
                                        <path d="M12 20V10"/>
                                        <path d="M18 20V4"/>
                                        <path d="M6 20v-4"/>
                                    </svg>
                                    <input
                                        id="sd-days"
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={schoolDays.daysOpen}
                                        onChange={(e) => {
                                            setSchoolDays({ ...schoolDays, daysOpen: e.target.value });
                                            setSdSaved(false);
                                        }}
                                        placeholder="e.g., 65"
                                        required
                                        className="sd-input"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="sd-form-actions">
                            {/* ✅ NEW: Increment button */}
                            <button
                                type="button"
                                className={`sd-increment-btn ${sdLoading ? 'sd-increment-btn--loading' : ''}`}
                                onClick={handleIncrementSchoolDays}
                                disabled={sdLoading || !schoolDays.termId || !schoolDays.sessionId}
                                title="Add 1 to current count (or set to 1 if no record exists)"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                +1 Day
                            </button>

                            <button
                                type="submit"
                                className={`sd-save-btn ${sdLoading ? 'sd-save-btn--loading' : ''} ${sdSaved ? 'sd-save-btn--saved' : ''}`}
                                disabled={sdLoading}
                            >
                                {sdLoading ? (
                                    <>
                                        <span className="sd-spinner"></span>
                                        Saving...
                                    </>
                                ) : sdSaved ? (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                                        </svg>
                                        Saved
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                        Set School Days
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Saved History */}
                    {sdHistory.length > 0 && (
                        <div className="sd-history">
                            <div className="sd-history-header">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                </svg>
                                <span>Recent saves</span>
                            </div>
                            <div className="sd-history-list">
                                {sdHistory.map((h, i) => (
                                    <div key={i} className="sd-history-item">
                                        <div className="sd-history-info">
                                            <span className="sd-history-term-session">{h.term} &middot; {h.session}</span>
                                            <span className="sd-history-time">
                                                {new Date(h.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <span className="sd-history-days">
                                            <strong>{h.daysOpen}</strong> days
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════
                GRADING SYSTEM FORM
                ═══════════════════════════════════════════════════════════ */}
            <div className={`gs-form-wrapper ${showForm ? 'gs-form-wrapper--open' : ''}`}>
                <form className="gs-form" onSubmit={handleSubmit}>
                    <div className="gs-form-header">
                        <div className="gs-form-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {editingSystem
                                    ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                                    : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                                }
                            </svg>
                        </div>
                        <h3>{editingSystem ? 'Edit Grading System' : 'Create New Grading System'}</h3>
                    </div>

                    <div className="gs-form-body">
                        <div className="gs-field">
                            <label htmlFor="gs-name">System Name</label>
                            <div className="gs-input-wrap">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="gs-input-icon">
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                </svg>
                                <input
                                    id="gs-name"
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Standard Nigerian Grading"
                                    required
                                    className="gs-input"
                                />
                            </div>
                        </div>

                        <label className="gs-checkbox-label">
                            <div className="gs-checkbox-wrap">
                                <input
                                    type="checkbox"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                    className="gs-checkbox"
                                />
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="gs-checkbox-check">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </div>
                            <span>Set as default grading system</span>
                        </label>

                        <div className="gs-grades-editor">
                            <div className="gs-grades-editor-header">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                                </svg>
                                <span>Grade Scale</span>
                                <span className="gs-grades-count">{formData.grades.length} grade{formData.grades.length !== 1 ? 's' : ''}</span>
                            </div>

                            <div className="gs-grades-table">
                                <div className="gs-grades-table-head">
                                    <span className="gs-col-grade">Grade</span>
                                    <span className="gs-col-min">Min</span>
                                    <span className="gs-col-max">Max</span>
                                    <span className="gs-col-remark">Remark</span>
                                    <span className="gs-col-action"></span>
                                </div>
                                <div className="gs-grades-table-body">
                                    {formData.grades.map((grade, index) => (
                                        <div key={index} className="gs-grade-row">
                                            <div className="gs-col-grade">
                                                <input
                                                    type="text"
                                                    value={grade.grade}
                                                    onChange={(e) => handleGradeChange(index, 'grade', e.target.value)}
                                                    placeholder="A"
                                                    required
                                                    className="gs-grade-input gs-grade-input--letter"
                                                    style={{
                                                        borderColor: getGradeColor(grade.grade) + '30',
                                                        color: getGradeColor(grade.grade)
                                                    }}
                                                />
                                            </div>
                                            <div className="gs-col-min">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={grade.minScore}
                                                    onChange={(e) => handleGradeChange(index, 'minScore', e.target.value)}
                                                    required
                                                    className="gs-grade-input"
                                                />
                                            </div>
                                            <div className="gs-col-max">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={grade.maxScore}
                                                    onChange={(e) => handleGradeChange(index, 'maxScore', e.target.value)}
                                                    required
                                                    className="gs-grade-input"
                                                />
                                            </div>
                                            <div className="gs-col-remark">
                                                <input
                                                    type="text"
                                                    value={grade.remark}
                                                    onChange={(e) => handleGradeChange(index, 'remark', e.target.value)}
                                                    placeholder="Excellent"
                                                    className="gs-grade-input"
                                                />
                                            </div>
                                            <div className="gs-col-action">
                                                <button
                                                    type="button"
                                                    onClick={() => removeGrade(index)}
                                                    className="gs-grade-remove"
                                                    disabled={formData.grades.length <= 1}
                                                    title="Remove grade"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button type="button" onClick={addGrade} className="gs-add-grade-btn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                Add Grade
                            </button>
                        </div>
                    </div>

                    <div className="gs-form-footer">
                        <button type="button" className="gs-btn-ghost" onClick={() => { setShowForm(false); setEditingSystem(null); }}>
                            Discard
                        </button>
                        <button type="submit" className="gs-btn-primary">
                            {editingSystem ? 'Save Changes' : 'Create System'}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                        </button>
                    </div>
                </form>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                GRADING SYSTEMS GRID
                ═══════════════════════════════════════════════════════════ */}
            <div className="gs-grid">
                {systems.length === 0 ? (
                    <div className="gs-empty">
                        <div className="gs-empty-illustration">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                <line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>
                            </svg>
                        </div>
                        <h3>No Grading Systems</h3>
                        <p>Define how student scores are mapped to letter grades.</p>
                        <button className="gs-btn-primary" onClick={() => setShowForm(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Create First System
                        </button>
                    </div>
                ) : (
                    systems.map((system, index) => (
                        <div
                            key={system._id}
                            className={`gs-card ${system.isDefault ? 'gs-card--default' : ''}`}
                            style={{ animationDelay: `${index * 0.06}s` }}
                        >
                            <div className="gs-card-top">
                                <div className="gs-card-title-row">
                                    <h3 className="gs-card-name">{system.name}</h3>
                                    {system.isDefault && (
                                        <span className="gs-default-badge">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                            </svg>
                                            Default
                                        </span>
                                    )}
                                </div>
                                <span className="gs-card-grade-count">
                                    {system.grades.length} grade{system.grades.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="gs-scale-bar">
                                {system.grades.map((grade, gi) => {
                                    const width = Math.max(2, grade.maxScore - grade.minScore);
                                    return (
                                        <div
                                            key={gi}
                                            className="gs-scale-segment"
                                            style={{
                                                width: `${width}%`,
                                                backgroundColor: getGradeColor(grade.grade)
                                            }}
                                            title={`${grade.grade}: ${grade.minScore}–${grade.maxScore}`}
                                        >
                                            <span className="gs-scale-label">{grade.grade}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="gs-grades-list">
                                {system.grades.map((grade, gi) => (
                                    <div key={gi} className="gs-grade-item">
                                        <span
                                            className="gs-grade-letter"
                                            style={{
                                                backgroundColor: getGradeBg(grade.grade),
                                                color: getGradeColor(grade.grade)
                                            }}
                                        >
                                            {grade.grade}
                                        </span>
                                        <span className="gs-grade-range">{grade.minScore}–{grade.maxScore}%</span>
                                        <span className="gs-grade-remark">{grade.remark}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="gs-card-actions">
                                {deleteConfirm === system._id ? (
                                    <div className="gs-confirm-row">
                                        <span className="gs-confirm-text">Delete?</span>
                                        <button className="gs-btn-sm gs-btn-sm--danger" onClick={() => handleDelete(system._id)}>Yes</button>
                                        <button className="gs-btn-sm gs-btn-sm--ghost" onClick={() => setDeleteConfirm(null)}>No</button>
                                    </div>
                                ) : (
                                    <>
                                        {!system.isDefault && (
                                            <button className="gs-card-btn gs-card-btn--default" onClick={() => handleSetDefault(system._id)} title="Set as default">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                                </svg>
                                                Set Default
                                            </button>
                                        )}
                                        <button className="gs-card-btn gs-card-btn--edit" onClick={() => handleEdit(system)} title="Edit system">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                            </svg>
                                            Edit
                                        </button>
                                        {!system.isDefault && (
                                            <button className="gs-card-btn gs-card-btn--delete" onClick={() => setDeleteConfirm(system._id)} title="Delete system">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                                                </svg>
                                                Delete
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default GradingSystem;