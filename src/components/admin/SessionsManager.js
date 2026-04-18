import React, { useState, useEffect } from 'react';
import { sessionsAPI } from '../../api';
import './SessionsManager.css';

const SessionsManager = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        startDate: '',
        endDate: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        fetchSessions();
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

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const response = await sessionsAPI.getAll();
            if (response.success) {
                setSessions(response.data);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingSession) {
                const response = await sessionsAPI.update(editingSession._id, formData);
                if (response.success) {
                    setSuccess('Session updated successfully');
                    setEditingSession(null);
                }
            } else {
                const response = await sessionsAPI.create(formData);
                if (response.success) {
                    setSuccess('Session created successfully');
                } else {
                    setError(response.message);
                    return;
                }
            }

            setFormData({ name: '', startDate: '', endDate: '' });
            setShowForm(false);
            fetchSessions();
        } catch (error) {
            setError(error.response?.data?.message || 'An error occurred');
        }
    };

    const handleEdit = (session) => {
        setEditingSession(session);
        setFormData({
            name: session.name,
            startDate: new Date(session.startDate).toISOString().split('T')[0],
            endDate: new Date(session.endDate).toISOString().split('T')[0]
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        setDeleteConfirm(null);
        try {
            const response = await sessionsAPI.delete(id);
            if (response.success) {
                setSuccess('Session deleted successfully');
                fetchSessions();
            } else {
                setError(response.message);
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to delete session');
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getSessionStatus = (session) => {
        const now = new Date();
        const start = new Date(session.startDate);
        const end = new Date(session.endDate);
        if (now < start) return 'upcoming';
        if (now > end) return 'completed';
        return 'active';
    };

    const getDaysInfo = (session) => {
        const now = new Date();
        const start = new Date(session.startDate);
        const end = new Date(session.endDate);
        const status = getSessionStatus(session);

        if (status === 'active') {
            const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
            const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            const progress = Math.min(100, Math.max(0, ((totalDays - daysLeft) / totalDays) * 100));
            return { label: `${daysLeft} days remaining`, progress };
        }
        if (status === 'upcoming') {
            const daysUntil = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
            return { label: `Starts in ${daysUntil} days`, progress: 0 };
        }
        return { label: 'Session ended', progress: 100 };
    };

    if (loading) {
        return (
            <div className="sm-loading-wrap">
                <div className="sm-loader">
                    <div className="sm-loader-ring"></div>
                    <div className="sm-loader-ring"></div>
                    <div className="sm-loader-ring"></div>
                </div>
                <p>Loading sessions...</p>
            </div>
        );
    }

    return (
        <div className="sm-root">
            {/* Decorative background elements */}
            <div className="sm-bg-orb sm-bg-orb--1"></div>
            <div className="sm-bg-orb sm-bg-orb--2"></div>

            {/* Toast notifications */}
            <div className="sm-toasts">
                {error && (
                    <div className="sm-toast sm-toast--error" key="error">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="sm-toast sm-toast--success" key="success">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>{success}</span>
                    </div>
                )}
            </div>

            {/* Header */}
            <header className="sm-header">
                <div className="sm-header-content">
                    <div className="sm-header-text">
                        <div className="sm-header-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="sm-title">Academic Sessions</h1>
                            <p className="sm-subtitle">
                                {sessions.length} session{sessions.length !== 1 ? 's' : ''} configured
                                {sessions.filter(s => getSessionStatus(s) === 'active').length > 0 && (
                                    <span className="sm-badge-active">
                                        {sessions.filter(s => getSessionStatus(s) === 'active').length} active
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        className={`sm-add-btn ${showForm ? 'sm-add-btn--open' : ''}`}
                        onClick={() => {
                            setEditingSession(null);
                            setFormData({ name: '', startDate: '', endDate: '' });
                            setShowForm(!showForm);
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: showForm ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        {showForm ? 'Cancel' : 'New Session'}
                    </button>
                </div>
            </header>

            {/* Form */}
            <div className={`sm-form-wrapper ${showForm ? 'sm-form-wrapper--open' : ''}`}>
                <form className="sm-form" onSubmit={handleSubmit}>
                    <div className="sm-form-header">
                        <div className="sm-form-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {editingSession
                                    ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                                    : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                                }
                            </svg>
                        </div>
                        <h3>{editingSession ? 'Edit Session' : 'Create New Session'}</h3>
                    </div>

                    <div className="sm-form-body">
                        <div className="sm-field">
                            <label htmlFor="session-name">Session Name</label>
                            <div className="sm-input-wrap">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm-input-icon">
                                    <path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>
                                </svg>
                                <input
                                    id="session-name"
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. 2024/2025"
                                    required
                                    className="sm-input"
                                />
                            </div>
                        </div>

                        <div className="sm-form-row">
                            <div className="sm-field">
                                <label htmlFor="start-date">Start Date</label>
                                <div className="sm-input-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm-input-icon">
                                        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                    <input
                                        id="start-date"
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        required
                                        className="sm-input"
                                    />
                                </div>
                            </div>

                            <div className="sm-field-arrow">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                                </svg>
                            </div>

                            <div className="sm-field">
                                <label htmlFor="end-date">End Date</label>
                                <div className="sm-input-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm-input-icon">
                                        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                    <input
                                        id="end-date"
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        required
                                        className="sm-input"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="sm-form-footer">
                        <button type="button" className="sm-btn-ghost" onClick={() => { setShowForm(false); setEditingSession(null); }}>
                            Discard
                        </button>
                        <button type="submit" className="sm-btn-primary">
                            {editingSession ? 'Save Changes' : 'Create Session'}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                        </button>
                    </div>
                </form>
            </div>

            {/* Sessions Grid */}
            <div className="sm-grid">
                {sessions.length === 0 ? (
                    <div className="sm-empty">
                        <div className="sm-empty-illustration">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/>
                            </svg>
                        </div>
                        <h3>No Sessions Yet</h3>
                        <p>Create your first academic session to get started.</p>
                        <button className="sm-btn-primary" onClick={() => setShowForm(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Create First Session
                        </button>
                    </div>
                ) : (
                    sessions.map((session, index) => {
                        const status = getSessionStatus(session);
                        const daysInfo = getDaysInfo(session);
                        return (
                            <div
                                key={session._id}
                                className={`sm-card sm-card--${status}`}
                                style={{ animationDelay: `${index * 0.06}s` }}
                            >
                                <div className="sm-card-top">
                                    <div className="sm-card-status-dot" />
                                    <span className={`sm-card-status-label sm-card-status-label--${status}`}>
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </span>
                                </div>

                                <h3 className="sm-card-name">{session.name}</h3>

                                <div className="sm-card-dates">
                                    <div className="sm-card-date-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                                        </svg>
                                        <span>{formatDate(session.startDate)}</span>
                                    </div>
                                    <div className="sm-card-date-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
                                        </svg>
                                        <span>{formatDate(session.endDate)}</span>
                                    </div>
                                </div>

                                {/* Progress bar for active sessions */}
                                {status === 'active' && (
                                    <div className="sm-card-progress">
                                        <div className="sm-card-progress-header">
                                            <span className="sm-card-progress-label">{daysInfo.label}</span>
                                            <span className="sm-card-progress-pct">{Math.round(daysInfo.progress)}%</span>
                                        </div>
                                        <div className="sm-card-progress-track">
                                            <div
                                                className="sm-card-progress-fill"
                                                style={{ width: `${daysInfo.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {status === 'upcoming' && (
                                    <div className="sm-card-info-tag">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                        </svg>
                                        {daysInfo.label}
                                    </div>
                                )}

                                {status === 'completed' && (
                                    <div className="sm-card-info-tag sm-card-info-tag--muted">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                        </svg>
                                        Session completed
                                    </div>
                                )}

                                <div className="sm-card-actions">
                                    {deleteConfirm === session._id ? (
                                        <div className="sm-confirm-row">
                                            <span className="sm-confirm-text">Delete?</span>
                                            <button className="sm-btn-sm sm-btn-sm--danger" onClick={() => handleDelete(session._id)}>
                                                Yes
                                            </button>
                                            <button className="sm-btn-sm sm-btn-sm--ghost" onClick={() => setDeleteConfirm(null)}>
                                                        No
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button className="sm-card-btn sm-card-btn--edit" onClick={() => handleEdit(session)} title="Edit session">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                                Edit
                                            </button>
                                            <button className="sm-card-btn sm-card-btn--delete" onClick={() => setDeleteConfirm(session._id)} title="Delete session">
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

export default SessionsManager;