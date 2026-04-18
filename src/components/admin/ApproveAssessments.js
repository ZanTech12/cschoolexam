import React, { useState, useEffect } from 'react';
import { continuousAssessmentsAPI, termsAPI, sessionsAPI, classesAPI, subjectsAPI } from '../../api';
import './ApproveAssessments.css';

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

const getStatusMeta = (s) => {
    const map = {
        submitted: { label: 'Submitted', color: '#d97706', bg: '#fffbeb', dot: '#fbbf24' },
        draft:     { label: 'Draft',     color: '#64748b', bg: '#f8fafc', dot: '#94a3b8' },
        approved:  { label: 'Approved',  color: '#059669', bg: '#ecfdf5', dot: '#34d399' }
    };
    return map[s] || map.draft;
};

// Helper to safely extract array from various API response structures
const extractDataArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.success && Array.isArray(response.data)) return response.data;
    if (response.success && response.data?.data && Array.isArray(response.data.data)) return response.data.data;
    if (response.success && response.data?.items && Array.isArray(response.data.items)) return response.data.items;
    if (response.success && response.data?.assessments && Array.isArray(response.data.assessments)) return response.data.assessments;
    if (!response.success && Array.isArray(response.data)) return response.data;
    return [];
};

const ApproveAssessments = () => {
    const [assessments, setAssessments] = useState([]);
    const [termId, setTermId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [classId, setClassId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [status, setStatus] = useState('submitted');
    const [terms, setTerms] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [confirmBulk, setConfirmBulk] = useState(false);
    const [confirmBulkUnapprove, setConfirmBulkUnapprove] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [unapprovingId, setUnapprovingId] = useState(null);

    useEffect(() => { fetchInitialData(); }, []);
    
    useEffect(() => {
        if (termId || sessionId || classId || subjectId) {
            fetchAssessments();
        }
    }, [termId, sessionId, classId, subjectId, status]);

    useEffect(() => {
        if (classId) {
            fetchSubjectsForClass(classId);
        } else {
            fetchAllSubjects();
        }
    }, [classId]);

    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => { setSuccess(''); setError(''); }, 5000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    const fetchAllSubjects = async () => {
        try {
            const response = await subjectsAPI.getAll();
            if (response.success) {
                setSubjects(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch subjects:', err);
        }
    };

    const fetchSubjectsForClass = async (cId) => {
        try {
            const response = await subjectsAPI.getByClass(cId);
            if (response.success) {
                setSubjects(response.data);
            } else {
                fetchAllSubjects();
            }
        } catch (err) {
            console.error('Failed to fetch subjects for class:', err);
            fetchAllSubjects();
        }
    };

    const fetchInitialData = async () => {
        try {
            const [termsRes, sessionsRes, classesRes, subjectsRes] = await Promise.all([
                termsAPI.getAll(), 
                sessionsAPI.getAll(), 
                classesAPI.getAllForDropdown(), 
                subjectsAPI.getAll()
            ]);
            
            if (termsRes.success) {
                setTerms(termsRes.data);
                const activeTerm = termsRes.data.find(t => t.status === 'active');
                if (activeTerm) {
                    setTermId(activeTerm._id);
                    setSessionId(activeTerm.session?._id || activeTerm.session);
                }
            }
            if (sessionsRes.success) setSessions(sessionsRes.data);
            
            if (classesRes.success) {
                const classesData = classesRes.data?.data || classesRes.data;
                setClasses(Array.isArray(classesData) ? classesData : []);
            }
            
            if (subjectsRes.success) setSubjects(subjectsRes.data);
        } catch (err) { 
            console.error('[fetchInitialData] Error:', err); 
        }
    };

    const fetchAssessments = async () => {
        try {
            setLoading(true);
            setConfirmBulk(false);
            setConfirmBulkUnapprove(false);
            
            const params = {
                termId: termId || undefined,
                sessionId: sessionId || undefined,
                classId: classId || undefined,
                subjectId: subjectId || undefined,
                status: status || undefined
            };
            
            Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
            
            const response = await continuousAssessmentsAPI.getAll(params);
            const extractedData = extractDataArray(response);
            
            setAssessments(extractedData);
            
        } catch (err) {
            console.error('[fetchAssessments] Error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch assessments');
        } finally { 
            setLoading(false); 
        }
    };

    const handleApprove = async (id) => {
        try {
            setSuccess('');
            setError('');
            
            const response = await continuousAssessmentsAPI.approve(id);
            
            if (response.success) {
                setSuccess('Assessment approved successfully');
                // Delay to ensure database consistency with $unset fix
                await new Promise(resolve => setTimeout(resolve, 500));
                fetchAssessments();
            } else {
                setError(response.message || 'Failed to approve - response not successful');
            }
        } catch (err) {
            console.error('[handleApprove] Error:', err.response?.data || err);
            setError(err.response?.data?.message || err.message || 'Failed to approve assessment');
        }
    };

    const handleUnapprove = async (id) => {
        try {
            setSuccess('');
            setError('');
            setUnapprovingId(id);
            
            const response = await continuousAssessmentsAPI.unapprove(id);
            
            if (response.success) {
                setSuccess('Assessment unapproved successfully');
                await new Promise(resolve => setTimeout(resolve, 500));
                fetchAssessments();
            } else {
                setError(response.message || 'Failed to unapprove - response not successful');
            }
        } catch (err) {
            console.error('[handleUnapprove] Error:', err.response?.data || err);
            setError(err.response?.data?.message || err.message || 'Failed to unapprove assessment');
        } finally {
            setUnapprovingId(null);
        }
    };

    const handleApproveAll = async () => {
        setConfirmBulk(false);
        setBulkLoading(true);
        setSuccess('');
        setError('');
        
        try {
            let successCount = 0;
            let failCount = 0;
            
            // Process sequentially with delay between each to prevent DB lock/contention
            for (const a of assessments) {
                try {
                    const response = await continuousAssessmentsAPI.approve(a._id);
                    if (response.success) {
                        successCount++;
                    } else {
                        failCount++;
                        console.warn('[handleApproveAll] Failed for ID:', a._id, response);
                    }
                } catch (err) {
                    failCount++;
                    console.error('[handleApproveAll] Error for ID:', a._id, err.response?.data || err);
                }
                // 150ms delay between each request to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 150));
            }
            
            if (failCount === 0) {
                setSuccess(`Successfully approved ${successCount} assessments`);
            } else {
                setError(`Failed to approve ${failCount} assessment(s). Check console for details.`);
                setSuccess(`Approved ${successCount} of ${assessments.length} assessments`);
            }
            
            // Longer delay before refetch to ensure all DB writes are fully committed
            await new Promise(resolve => setTimeout(resolve, 1000));
            fetchAssessments();
        } catch (err) {
            setError('An unexpected error occurred while approving assessments');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleUnapproveAll = async () => {
        setConfirmBulkUnapprove(false);
        setBulkLoading(true);
        setSuccess('');
        setError('');
        
        try {
            let successCount = 0;
            let failCount = 0;
            
            for (const a of assessments) {
                try {
                    const response = await continuousAssessmentsAPI.unapprove(a._id);
                    if (response.success) {
                        successCount++;
                    } else {
                        failCount++;
                        console.warn('[handleUnapproveAll] Failed for ID:', a._id, response);
                    }
                } catch (err) {
                    failCount++;
                    console.error('[handleUnapproveAll] Error for ID:', a._id, err.response?.data || err);
                }
                await new Promise(resolve => setTimeout(resolve, 150));
            }
            
            if (failCount === 0) {
                setSuccess(`Successfully unapproved ${successCount} assessments`);
            } else {
                setError(`Failed to unapprove ${failCount} assessment(s). Check console for details.`);
                setSuccess(`Unapproved ${successCount} of ${assessments.length} assessments`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            fetchAssessments();
        } catch (err) {
            setError('An unexpected error occurred while unapproving assessments');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleClassChange = (e) => {
        const newClassId = e.target.value;
        setClassId(newClassId);
        setSubjectId('');
    };

    const statusTabs = [
        { value: 'submitted', label: 'Submitted' },
        { value: 'draft', label: 'Draft' },
        { value: 'approved', label: 'Approved' }
    ];

    const pendingCount = status === 'submitted' ? assessments.length : 0;
    const approvedCount = status === 'approved' ? assessments.length : 0;

    return (
        <div className="aa-root">
            <div className="aa-bg-orb aa-bg-orb--1"></div>
            <div className="aa-bg-orb aa-bg-orb--2"></div>

            {/* Toasts */}
            <div className="aa-toasts">
                {error && (
                    <div className="aa-toast aa-toast--error" key={`error-${Date.now()}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="aa-toast aa-toast--success" key={`success-${Date.now()}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>{success}</span>
                    </div>
                )}
            </div>

            {/* Header */}
            <header className="aa-header">
                <div className="aa-header-content">
                    <div className="aa-header-text">
                        <div className="aa-header-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <polyline points="9 12 11 14 15 10"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="aa-title">Approve Assessments</h1>
                            <p className="aa-subtitle">Review and approve student score entries</p>
                        </div>
                    </div>
                    
                    <div className="aa-header-actions">
                        {pendingCount > 0 && (
                            <button
                                className="aa-approve-all-btn"
                                onClick={() => setConfirmBulk(true)}
                                disabled={bulkLoading}
                            >
                                {bulkLoading ? (
                                    <div className="aa-btn-spinner" />
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                )}
                                Approve All ({pendingCount})
                            </button>
                        )}
                        {approvedCount > 0 && (
                            <button
                                className="aa-unapprove-all-btn"
                                onClick={() => setConfirmBulkUnapprove(true)}
                                disabled={bulkLoading}
                            >
                                {bulkLoading ? (
                                    <div className="aa-btn-spinner" />
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 3l18 18"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                )}
                                Unapprove All ({approvedCount})
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Filters Panel */}
            <div className="aa-filters">
                {/* Status Tabs */}
                <div className="aa-status-tabs">
                    {statusTabs.map(tab => {
                        const meta = getStatusMeta(tab.value);
                        const isActive = status === tab.value;
                        return (
                            <button
                                key={tab.value}
                                className={`aa-status-tab ${isActive ? 'aa-status-tab--active' : ''}`}
                                style={isActive ? { '--tab-color': meta.color, '--tab-bg': meta.bg } : undefined}
                                onClick={() => setStatus(tab.value)}
                            >
                                <span className="aa-status-tab-dot" style={isActive ? { background: meta.dot } : undefined} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Dropdowns */}
                <div className="aa-filter-row">
                    <div className="aa-filter-field">
                        <label htmlFor="aa-term">Term</label>
                        <div className="aa-select-wrap">
                            <select id="aa-term" value={termId} onChange={(e) => setTermId(e.target.value)} className="aa-select">
                                <option value="">All Terms</option>
                                {terms.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="aa-select-chevron">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div className="aa-filter-field">
                        <label htmlFor="aa-session">Session</label>
                        <div className="aa-select-wrap">
                            <select id="aa-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="aa-select">
                                <option value="">All Sessions</option>
                                {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="aa-select-chevron">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div className="aa-filter-field">
                        <label htmlFor="aa-class">Class</label>
                        <div className="aa-select-wrap">
                            <select id="aa-class" value={classId} onChange={handleClassChange} className="aa-select">
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="aa-select-chevron">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div className="aa-filter-field">
                        <label htmlFor="aa-subject">Subject</label>
                        <div className="aa-select-wrap">
                            <select id="aa-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="aa-select">
                                <option value="">All Subjects</option>
                                {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="aa-select-chevron">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bulk Confirm Approve Bar */}
            {confirmBulk && (
                <div className="aa-bulk-confirm">
                    <div className="aa-bulk-confirm-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aa-bulk-confirm-icon">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>Approve all <strong>{assessments.length}</strong> assessments? This cannot be undone.</span>
                    </div>
                    <div className="aa-bulk-confirm-actions">
                        <button className="aa-btn-sm aa-btn-sm--ghost" onClick={() => setConfirmBulk(false)}>Cancel</button>
                        <button className="aa-btn-sm aa-btn-sm--approve" onClick={handleApproveAll}>Confirm</button>
                    </div>
                </div>
            )}

            {/* Bulk Confirm Unapprove Bar */}
            {confirmBulkUnapprove && (
                <div className="aa-bulk-confirm aa-bulk-confirm--unapprove">
                    <div className="aa-bulk-confirm-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aa-bulk-confirm-icon">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>Unapprove all <strong>{assessments.length}</strong> assessments? They will be moved back to submitted.</span>
                    </div>
                    <div className="aa-bulk-confirm-actions">
                        <button className="aa-btn-sm aa-btn-sm--ghost" onClick={() => setConfirmBulkUnapprove(false)}>Cancel</button>
                        <button className="aa-btn-sm aa-btn-sm--unapprove" onClick={handleUnapproveAll}>Confirm</button>
                    </div>
                </div>
            )}

            {/* Results Info */}
            {!loading && assessments.length > 0 && (
                <div className="aa-results-info">
                    <span className="aa-results-count">
                        Showing <strong>{assessments.length}</strong> assessment{assessments.length !== 1 ? 's' : ''}
                    </span>
                    <span className="aa-results-status" style={{ color: getStatusMeta(status).color }}>
                        {getStatusMeta(status).label}
                    </span>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="aa-table-loading">
                    <div className="aa-inline-loader">
                        <div className="aa-loader-ring"></div>
                        <div className="aa-loader-ring"></div>
                        <div className="aa-loader-ring"></div>
                    </div>
                    <span>Fetching assessments...</span>
                </div>
            ) : assessments.length === 0 ? (
                <div className="aa-empty">
                    <div className="aa-empty-illustration">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <polyline points="9 12 11 14 15 10"/>
                        </svg>
                    </div>
                    <h3>No Assessments Found</h3>
                    <p>{status === 'submitted'
                        ? 'All assessments have been reviewed. Nothing pending.'
                        : `No ${status} assessments match the current filters.`
                    }</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="aa-table-wrap">
                        <table className="aa-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Class</th>
                                    <th>Subject</th>
                                    <th className="aa-th-score">CA<span className="aa-th-max">/40</span></th>
                                    <th className="aa-th-score">Exam<span className="aa-th-max">/60</span></th>
                                    <th className="aa-th-total">Total<span className="aa-th-max">/100</span></th>
                                    <th>Grade</th>
                                    <th>Status</th>
                                    <th className="aa-th-action">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assessments.map((a, i) => {
                                    const sm = getStatusMeta(a.status);
                                    const isUnapproving = unapprovingId === a._id;
                                    return (
                                        <tr key={a._id} className={`aa-row aa-row--${a.status}`} style={{ animationDelay: `${i * 0.03}s` }}>
                                            <td className="aa-td-student">
                                                <span className="aa-student-name">
                                                    {a.studentId?.lastName} {a.studentId?.firstName}
                                                </span>
                                                <span className="aa-student-id">{a.studentId?.admissionNumber}</span>
                                            </td>
                                            <td>
                                                <span className="aa-tag aa-tag--class">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                                                    </svg>
                                                    {a.classId?.name}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="aa-subject-name">{a.subjectId?.name}</span>
                                            </td>
                                            <td className="aa-td-score">{a.totalCA}</td>
                                            <td className="aa-td-score">{a.examScore}</td>
                                            <td className="aa-td-total">
                                                <span className="aa-total-badge">{a.totalScore}</span>
                                            </td>
                                            <td>
                                                <span
                                                    className="aa-grade-badge"
                                                    style={{ backgroundColor: getGradeBg(a.grade), color: getGradeColor(a.grade) }}
                                                >
                                                    {a.grade}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="aa-status-badge" style={{ color: sm.color, backgroundColor: sm.bg }}>
                                                    <span className="aa-status-dot" style={{ backgroundColor: sm.dot }} />
                                                    {sm.label}
                                                </span>
                                            </td>
                                            <td className="aa-td-action">
                                                {a.status === 'submitted' ? (
                                                    <button className="aa-approve-btn" onClick={() => handleApprove(a._id)}>
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12"/>
                                                        </svg>
                                                        Approve
                                                    </button>
                                                ) : a.status === 'approved' ? (
                                                    <button 
                                                        className="aa-unapprove-btn" 
                                                        onClick={() => handleUnapprove(a._id)}
                                                        disabled={isUnapproving}
                                                    >
                                                        {isUnapproving ? (
                                                            <div className="aa-btn-spinner aa-btn-spinner--sm" />
                                                        ) : (
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M3 3l18 18"/><path d="M9 9l6 6"/>
                                                            </svg>
                                                        )}
                                                        Unapprove
                                                    </button>
                                                ) : (
                                                    <span className="aa-draft-label">Draft</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="aa-cards">
                        {assessments.map((a, i) => {
                            const sm = getStatusMeta(a.status);
                            const isUnapproving = unapprovingId === a._id;
                            return (
                                <div key={a._id} className={`aa-card aa-card--${a.status}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div className="aa-card-top">
                                        <div className="aa-card-student">
                                            <span className="aa-student-name">
                                                {a.studentId?.lastName} {a.studentId?.firstName}
                                            </span>
                                            <span className="aa-student-id">{a.studentId?.admissionNumber}</span>
                                        </div>
                                        <span className="aa-status-badge" style={{ color: sm.color, backgroundColor: sm.bg }}>
                                            <span className="aa-status-dot" style={{ backgroundColor: sm.dot }} />
                                            {sm.label}
                                        </span>
                                    </div>

                                    <div className="aa-card-meta">
                                        <span className="aa-tag aa-tag--class">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                                            </svg>
                                            {a.classId?.name}
                                        </span>
                                        <span className="aa-subject-name">{a.subjectId?.name}</span>
                                    </div>

                                    <div className="aa-card-scores">
                                        <div className="aa-score-block">
                                            <span className="aa-score-label">CA</span>
                                            <span className="aa-score-value">{a.totalCA}<span className="aa-score-max">/40</span></span>
                                        </div>
                                        <div className="aa-score-divider">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="5" y1="12" x2="19" y2="12"/>
                                            </svg>
                                        </div>
                                        <div className="aa-score-block">
                                            <span className="aa-score-label">Exam</span>
                                            <span className="aa-score-value">{a.examScore}<span className="aa-score-max">/60</span></span>
                                        </div>
                                        <div className="aa-score-divider">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="5" y1="12" x2="19" y2="12"/>
                                            </svg>
                                        </div>
                                        <div className="aa-score-block aa-score-block--total">
                                            <span className="aa-score-label">Total</span>
                                            <span className="aa-score-value aa-score-value--total">{a.totalScore}<span className="aa-score-max">/100</span></span>
                                        </div>
                                        <span
                                            className="aa-grade-badge aa-grade-badge--card"
                                            style={{ backgroundColor: getGradeBg(a.grade), color: getGradeColor(a.grade) }}
                                        >
                                            {a.grade}
                                        </span>
                                    </div>

                                    <div className="aa-card-action">
                                        {a.status === 'submitted' ? (
                                            <button className="aa-approve-btn" onClick={() => handleApprove(a._id)}>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"/>
                                                </svg>
                                                Approve
                                            </button>
                                        ) : a.status === 'approved' ? (
                                            <button 
                                                className="aa-unapprove-btn" 
                                                onClick={() => handleUnapprove(a._id)}
                                                disabled={isUnapproving}
                                            >
                                                {isUnapproving ? (
                                                    <div className="aa-btn-spinner aa-btn-spinner--sm" />
                                                ) : (
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 3l18 18"/><path d="M9 9l6 6"/>
                                                    </svg>
                                                )}
                                                Unapprove
                                            </button>
                                        ) : (
                                            <span className="aa-draft-label">Draft</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export default ApproveAssessments;