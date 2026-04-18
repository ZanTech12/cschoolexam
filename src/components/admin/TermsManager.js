import React, { useState, useEffect } from 'react';
import { termsAPI, sessionsAPI } from '../../api';
import './TermsManager.css';

const TermsManager = () => {
    const [terms, setTerms] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingTerm, setEditingTerm] = useState(null);
    const [formData, setFormData] = useState({
        name: 'First Term',
        session: '',
        startDate: '',
        endDate: '',
        nextTermBegins: '',
        status: 'upcoming'
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        fetchData();
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

    const fetchData = async () => {
        try {
            setLoading(true);
            const [termsRes, sessionsRes] = await Promise.all([
                termsAPI.getAll(),
                sessionsAPI.getAll()
            ]);
            if (termsRes.success) setTerms(termsRes.data);
            if (sessionsRes.success) {
                setSessions(sessionsRes.data);
                if (sessionsRes.data.length > 0 && !formData.session) {
                    setFormData(prev => ({ ...prev, session: sessionsRes.data[0]._id }));
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTermNumber = (name) => {
        const map = { 'First Term': 1, 'Second Term': 2, 'Third Term': 3 };
        return map[name] || 1;
    };

    const getTermRoman = (name) => {
        const map = { 'First Term': 'I', 'Second Term': 'II', 'Third Term': 'III' };
        return map[name] || 'I';
    };

    const resetForm = () => ({
        name: 'First Term',
        session: sessions[0]?._id || '',
        startDate: '',
        endDate: '',
        nextTermBegins: '',
        status: 'upcoming'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingTerm) {
                const response = await termsAPI.update(editingTerm._id, formData);
                if (response.success) {
                    setSuccess('Term updated successfully');
                    setEditingTerm(null);
                }
            } else {
                const response = await termsAPI.create(formData);
                if (response.success) {
                    setSuccess('Term created successfully');
                } else {
                    setError(response.message);
                    return;
                }
            }

            setFormData(resetForm());
            setShowForm(false);
            fetchData();
        } catch (error) {
            setError(error.response?.data?.message || 'An error occurred');
        }
    };

    const handleActivate = async (term) => {
        try {
            const response = await termsAPI.update(term._id, { status: 'active' });
            if (response.success) {
                setSuccess(`${term.name} is now active`);
                fetchData();
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to activate term');
        }
    };

    const handleEdit = (term) => {
        setEditingTerm(term);
        setFormData({
            name: term.name,
            session: term.session?._id || term.session,
            startDate: new Date(term.startDate).toISOString().split('T')[0],
            endDate: new Date(term.endDate).toISOString().split('T')[0],
            nextTermBegins: term.nextTermBegins ? new Date(term.nextTermBegins).toISOString().split('T')[0] : '',
            status: term.status
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        setDeleteConfirm(null);
        try {
            const response = await termsAPI.delete(id);
            if (response.success) {
                setSuccess('Term deleted successfully');
                fetchData();
            } else {
                setError(response.message);
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to delete term');
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getSessionName = (term) => {
        return term.session?.name || 'Unknown Session';
    };

    const getDaysInfo = (term) => {
        const now = new Date();
        const start = new Date(term.startDate);
        const end = new Date(term.endDate);

        if (term.status === 'active') {
            const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
            const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            const progress = Math.min(100, Math.max(0, ((totalDays - daysLeft) / totalDays) * 100));
            return { label: `${daysLeft} days remaining`, progress };
        }
        if (term.status === 'upcoming') {
            const daysUntil = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
            return { label: `Starts in ${daysUntil} days`, progress: 0 };
        }
        return { label: 'Term ended', progress: 100 };
    };

    if (loading) {
        return (
            <div className="tm-loading-wrap">
                <div className="tm-loader">
                    <div className="tm-loader-ring"></div>
                    <div className="tm-loader-ring"></div>
                    <div className="tm-loader-ring"></div>
                </div>
                <p>Loading terms...</p>
            </div>
        );
    }

    return (
        <div className="tm-root">
            <div className="tm-bg-orb tm-bg-orb--1"></div>
            <div className="tm-bg-orb tm-bg-orb--2"></div>

            {/* Toasts */}
            <div className="tm-toasts">
                {error && (
                    <div className="tm-toast tm-toast--error" key="error">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="tm-toast tm-toast--success" key="success">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>{success}</span>
                    </div>
                )}
            </div>

            {/* Header */}
            <header className="tm-header">
                <div className="tm-header-content">
                    <div className="tm-header-text">
                        <div className="tm-header-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="tm-title">Academic Terms</h1>
                            <p className="tm-subtitle">
                                {terms.length} term{terms.length !== 1 ? 's' : ''} configured
                                {terms.filter(t => t.status === 'active').length > 0 && (
                                    <span className="tm-badge-active">
                                        {terms.filter(t => t.status === 'active').length} active
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        className={`tm-add-btn ${showForm ? 'tm-add-btn--open' : ''}`}
                        onClick={() => {
                            setEditingTerm(null);
                            setFormData(resetForm());
                            setShowForm(!showForm);
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: showForm ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        {showForm ? 'Cancel' : 'New Term'}
                    </button>
                </div>
            </header>

            {/* No sessions warning */}
            {sessions.length === 0 && (
                <div className="tm-warning-banner">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>You need to create at least one academic session before adding terms.</span>
                </div>
            )}

            {/* Form */}
            <div className={`tm-form-wrapper ${showForm ? 'tm-form-wrapper--open' : ''}`}>
                <form className="tm-form" onSubmit={handleSubmit}>
                    <div className="tm-form-header">
                        <div className="tm-form-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {editingTerm
                                    ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                                    : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                                }
                            </svg>
                        </div>
                        <h3>{editingTerm ? 'Edit Term' : 'Create New Term'}</h3>
                    </div>

                    <div className="tm-form-body">
                        {/* Row 1: Term + Session */}
                        <div className="tm-form-row">
                            <div className="tm-field">
                                <label htmlFor="term-name">Term</label>
                                <div className="tm-select-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tm-input-icon">
                                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                                    </svg>
                                    <select
                                        id="term-name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="tm-input tm-select"
                                    >
                                        <option value="First Term">First Term</option>
                                        <option value="Second Term">Second Term</option>
                                        <option value="Third Term">Third Term</option>
                                    </select>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="tm-select-chevron">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </div>
                            </div>
                            <div className="tm-field">
                                <label htmlFor="term-session">Session</label>
                                <div className="tm-select-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tm-input-icon">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                    <select
                                        id="term-session"
                                        value={formData.session}
                                        onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                                        required
                                        className="tm-input tm-select"
                                    >
                                        <option value="">Select Session</option>
                                        {sessions.map(session => (
                                            <option key={session._id} value={session._id}>
                                                {session.name}
                                            </option>
                                        ))}
                                    </select>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="tm-select-chevron">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Start Date → End Date */}
                        <div className="tm-form-row">
                            <div className="tm-field">
                                <label htmlFor="term-start">Start Date</label>
                                <div className="tm-input-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tm-input-icon">
                                        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                    <input
                                        id="term-start"
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        required
                                        className="tm-input"
                                    />
                                </div>
                            </div>
                            <div className="tm-field-arrow">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                                </svg>
                            </div>
                            <div className="tm-field">
                                <label htmlFor="term-end">End Date</label>
                                <div className="tm-input-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tm-input-icon">
                                        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                    <input
                                        id="term-end"
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        required
                                        className="tm-input"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Next Term Begins + Status */}
                        <div className="tm-form-row">
                            <div className="tm-field">
                                <label htmlFor="term-next">Next Term Begins <span className="tm-optional">(optional)</span></label>
                                <div className="tm-input-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tm-input-icon">
                                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    <input
                                        id="term-next"
                                        type="date"
                                        value={formData.nextTermBegins}
                                        onChange={(e) => setFormData({ ...formData, nextTermBegins: e.target.value })}
                                        className="tm-input"
                                    />
                                </div>
                            </div>
                            <div className="tm-field">
                                <label htmlFor="term-status">Status</label>
                                <div className="tm-select-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tm-input-icon">
                                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                    <select
                                        id="term-status"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="tm-input tm-select"
                                    >
                                        <option value="upcoming">Upcoming</option>
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="tm-select-chevron">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="tm-form-footer">
                        <button type="button" className="tm-btn-ghost" onClick={() => { setShowForm(false); setEditingTerm(null); }}>
                            Discard
                        </button>
                        <button type="submit" className="tm-btn-primary">
                            {editingTerm ? 'Save Changes' : 'Create Term'}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                        </button>
                    </div>
                </form>
            </div>

            {/* Grid */}
            <div className="tm-grid">
                {terms.length === 0 ? (
                    <div className="tm-empty">
                        <div className="tm-empty-illustration">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                            </svg>
                        </div>
                        <h3>No Terms Yet</h3>
                        <p>Create your first academic term to get started.</p>
                        {sessions.length > 0 ? (
                            <button className="tm-btn-primary" onClick={() => setShowForm(true)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                Create First Term
                            </button>
                        ) : (
                            <p className="tm-empty-hint">Please create a session first.</p>
                        )}
                    </div>
                ) : (
                    terms.map((term, index) => {
                        const daysInfo = getDaysInfo(term);
                        const romanNumeral = getTermRoman(term.name);
                        return (
                            <div
                                key={term._id}
                                className={`tm-card tm-card--${term.status}`}
                                style={{ animationDelay: `${index * 0.06}s` }}
                            >
                                {/* Top row: status + session tag */}
                                <div className="tm-card-top">
                                    <div className="tm-card-status-row">
                                        <div className="tm-card-status-dot" />
                                        <span className={`tm-card-status-label tm-card-status-label--${term.status}`}>
                                            {term.status.charAt(0).toUpperCase() + term.status.slice(1)}
                                        </span>
                                    </div>
                                    <span className="tm-card-session-tag">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        {getSessionName(term)}
                                    </span>
                                </div>

                                {/* Term number + name */}
                                <div className="tm-card-name-block">
                                    <span className={`tm-card-numeral tm-card-numeral--${term.status}`}>
                                        {romanNumeral}
                                    </span>
                                    <h3 className="tm-card-name">{term.name}</h3>
                                </div>

                                {/* Dates */}
                                <div className="tm-card-dates">
                                    <div className="tm-card-date-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                                        </svg>
                                        <span>{formatDate(term.startDate)}</span>
                                    </div>
                                    <div className="tm-card-date-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
                                        </svg>
                                        <span>{formatDate(term.endDate)}</span>
                                    </div>
                                </div>

                                {/* Progress for active */}
                                {term.status === 'active' && (
                                    <div className="tm-card-progress">
                                        <div className="tm-card-progress-header">
                                            <span className="tm-card-progress-label">{daysInfo.label}</span>
                                            <span className="tm-card-progress-pct">{Math.round(daysInfo.progress)}%</span>
                                        </div>
                                        <div className="tm-card-progress-track">
                                            <div className="tm-card-progress-fill" style={{ width: `${daysInfo.progress}%` }} />
                                        </div>
                                    </div>
                                )}

                                {/* Info tags */}
                                {term.status === 'upcoming' && (
                                    <div className="tm-card-info-tag">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                        </svg>
                                        {daysInfo.label}
                                    </div>
                                )}

                                {term.status === 'completed' && (
                                    <div className="tm-card-info-tag tm-card-info-tag--muted">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                        </svg>
                                        Term completed
                                    </div>
                                )}

                                {/* Next term begins */}
                                {term.nextTermBegins && (
                                    <div className="tm-card-next-term">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                        </svg>
                                        <span>Next term: <strong>{formatDate(term.nextTermBegins)}</strong></span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="tm-card-actions">
                                    {deleteConfirm === term._id ? (
                                        <div className="tm-confirm-row">
                                            <span className="tm-confirm-text">Delete?</span>
                                            <button className="tm-btn-sm tm-btn-sm--danger" onClick={() => handleDelete(term._id)}>Yes</button>
                                            <button className="tm-btn-sm tm-btn-sm--ghost" onClick={() => setDeleteConfirm(null)}>No</button>
                                        </div>
                                    ) : (
                                        <>
                                            {term.status !== 'active' && (
                                                <button className="tm-card-btn tm-card-btn--activate" onClick={() => handleActivate(term)} title="Activate term">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polygon points="5 3 19 12 5 21 5 3"/>
                                                    </svg>
                                                    Activate
                                                </button>
                                            )}
                                            <button className="tm-card-btn tm-card-btn--edit" onClick={() => handleEdit(term)} title="Edit term">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                                Edit
                                            </button>
                                            <button className="tm-card-btn tm-card-btn--delete" onClick={() => setDeleteConfirm(term._id)} title="Delete term">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                                                </svg>
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default TermsManager;