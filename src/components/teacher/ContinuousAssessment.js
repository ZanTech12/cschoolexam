import React, { useState, useEffect, useRef } from 'react';
import { teacherCAAPI, termsAPI, sessionsAPI } from '../../api';
import './ContinuousAssessment.css';

const ContinuousAssessment = () => {
    const [classId, setClassId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [termId, setTermId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [eligibleClasses, setEligibleClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [terms, setTerms] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [studentScores, setStudentScores] = useState({});
    const [confirmSubmit, setConfirmSubmit] = useState(false);
    const fileInputRef = useRef(null);

    // State for delete functionality
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    useEffect(() => { fetchInitialData(); }, []);

    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => { setSuccess(''); setError(''); }, 4000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    const fetchInitialData = async () => {
        try {
            setInitialLoading(true);
            const [eligibleRes, termsRes, sessionsRes] = await Promise.all([
                teacherCAAPI.getEligibleClassesSubjects(),
                termsAPI.getAll(),
                sessionsAPI.getAll()
            ]);
            if (eligibleRes.success) setEligibleClasses(eligibleRes.data || []);
            if (termsRes.success) {
                setTerms(termsRes.data);
                const activeTerm = termsRes.data.find(t => t.status === 'active');
                if (activeTerm) {
                    setTermId(activeTerm._id);
                    setSessionId(activeTerm.session?._id || activeTerm.session);
                }
            }
            if (sessionsRes.success) setSessions(sessionsRes.data);
        } catch (error) {
            console.error('Error fetching initial data:', error);
            if (error.response?.status === 403) {
                setError('You do not have any class-subject assignments. Contact the admin.');
            }
        } finally { setInitialLoading(false); }
    };

    useEffect(() => {
        if (classId) {
            const selectedClass = eligibleClasses.find(c => c.classId === classId);
            setSubjects(selectedClass?.subjects || []);
            setSubjectId('');
            setStudents([]);
            setStudentScores({});
        }
    }, [classId, eligibleClasses]);

    useEffect(() => {
        if (classId && subjectId && termId && sessionId) fetchStudentsAndAssessments();
        else { setStudents([]); setStudentScores({}); }
    }, [classId, subjectId, termId, sessionId]);

    const fetchStudentsAndAssessments = async () => {
        try {
            setLoading(true);
            const response = await teacherCAAPI.getStudentsForCA(classId, subjectId, { termId, sessionId });
            if (response.success) {
                const studentsData = response.data || [];
                setStudents(studentsData);
                const scores = {};
                studentsData.forEach(student => {
                    if (student.existingCA) {
                        scores[student.studentId] = {
                            testScore: student.existingCA.testScore || 0,
                            noteTakingScore: student.existingCA.noteTakingScore || 0,
                            assignmentScore: student.existingCA.assignmentScore || 0,
                            examScore: student.existingCA.examScore || 0,
                            assessmentId: student.existingCA.id
                        };
                    }
                });
                setStudentScores(scores);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            if (error.response?.status === 403) {
                setError('Access denied. You are not assigned to this class and subject.');
                setStudents([]); setStudentScores({});
            }
        } finally { setLoading(false); }
    };

    const handleScoreChange = (studentId, field, value) => {
        const maxScores = { testScore: 20, noteTakingScore: 10, assignmentScore: 10, examScore: 60 };
        let numValue = parseFloat(value) || 0;
        numValue = Math.min(Math.max(numValue, 0), maxScores[field]);
        setStudentScores(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], [field]: numValue }
        }));
    };

    const calculateTotals = (studentId) => {
        const scores = studentScores[studentId] || {};
        const totalCA = (scores.testScore || 0) + (scores.noteTakingScore || 0) + (scores.assignmentScore || 0);
        const totalScore = totalCA + (scores.examScore || 0);
        return { totalCA, totalScore };
    };

    const isComplete = (studentId) => {
        const s = studentScores[studentId];
        if (!s) return false;
        return s.testScore > 0 || s.noteTakingScore > 0 || s.assignmentScore > 0 || s.examScore > 0;
    };

    const isApproved = (student) => student.existingCA?.status === 'approved';

    const completionCount = students.filter(s => isComplete(s.studentId)).length;
    const draftCount = students.filter(s => !isApproved(s) && isComplete(s.studentId)).length;

    // ===================================================================
    // DELETE CA ENTRY FUNCTION
    // ===================================================================
    const handleDeleteClick = (assessmentId, studentName, subjectName) => {
        if (!assessmentId) {
            setError('No CA entry exists to delete. Enter scores and save first.');
            return;
        }

        let confirmMessage = 'Are you sure you want to delete this CA entry?';

        if (studentName && subjectName) {
            confirmMessage = `Delete CA entry for ${studentName} (${subjectName})?`;
        }

        setConfirmDelete({
            id: assessmentId,
            message: confirmMessage,
            studentName,
            subjectName
        });
    };

    const confirmDeleteHandler = async () => {
        if (!confirmDelete) return;

        setDeletingId(confirmDelete.id);
        setConfirmDelete(null);

        try {
            const response = await teacherCAAPI.deleteDraftCA(confirmDelete.id);

            if (response.success) {
                setSuccess(`CA deleted for ${confirmDelete.studentName || 'this student'} (${confirmDelete.subjectName || 'this subject'}).`);
                fetchStudentsAndAssessments();
            } else {
                setError(response.message || 'Failed to delete CA entry');
            }
        } catch (error) {
            console.error('Error deleting CA:', error);
            setError(error.response?.data?.message || 'Failed to delete CA entry');
        } finally {
            setDeletingId(null);
        }
    };

    const cancelDelete = () => {
        setConfirmDelete(null);
        setDeletingId(null);
    };

    // ===================================================================
    // CSV Helpers
    // ===================================================================
    const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { current += '"'; i++; }
                    else inQuotes = false;
                } else current += ch;
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === ',') { result.push(current.trim()); current = ''; }
                else current += ch;
            }
        }
        result.push(current.trim());
        return result;
    };

    const parseCSVText = (text) => {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return [];
        const headers = parseCSVLine(lines[0]);
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const vals = parseCSVLine(lines[i]);
            if (vals.every(v => v === '')) continue;
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
            rows.push(obj);
        }
        return rows;
    };

    const downloadTemplate = () => {
        if (students.length === 0) return;
        const headers = ['Admission Number', 'Last Name', 'First Name', 'Test (/20)', 'Notes (/10)', 'Assignment (/10)', 'Exam (/60)'];
        const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
        const csvRows = [headers.map(escape).join(',')];
        students.forEach(s => {
            csvRows.push([s.admissionNumber, s.lastName, s.firstName, '', '', '', ''].map(escape).join(','));
        });
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cLabel = selectedClassLabel ? `${selectedClassLabel.className}_${selectedClassLabel.classSection}` : 'class';
        const sLabel = selectedSubjectLabel ? selectedSubjectLabel.subjectCode : 'subject';
        a.download = `CA_Template_${cLabel}_${sLabel}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccess(`Template downloaded with ${students.length} students`);
    };

    const handleCSVUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.csv')) {
            setError('Please upload a .csv file');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const rows = parseCSVText(evt.target.result);
                if (rows.length === 0) {
                    setError('CSV file is empty or has no data rows');
                    return;
                }

                let updated = 0, skipped = 0, invalid = 0, notFound = 0;

                const scoreUpdates = {};
                rows.forEach(row => {
                    const admNo = (row['Admission Number'] || row['Admission_Number'] || row['adm_no'] || row['Adm No'] || '').trim();
                    if (!admNo) { skipped++; return; }

                    const student = students.find(s => s.admissionNumber === admNo);
                    if (!student) { notFound++; return; }
                    if (isApproved(student)) { skipped++; return; }

                    const testScore = parseFloat(row['Test (/20)'] || row['Test'] || row['test_score'] || 0) || 0;
                    const noteTakingScore = parseFloat(row['Notes (/10)'] || row['Notes'] || row['note_taking_score'] || 0) || 0;
                    const assignmentScore = parseFloat(row['Assignment (/10)'] || row['Assignment'] || row['assignment_score'] || 0) || 0;
                    const examScore = parseFloat(row['Exam (/60)'] || row['Exam'] || row['exam_score'] || 0) || 0;

                    if (testScore < 0 || testScore > 20 || noteTakingScore < 0 || noteTakingScore > 10 ||
                        assignmentScore < 0 || assignmentScore > 10 || examScore < 0 || examScore > 60) {
                        invalid++;
                        return;
                    }

                    scoreUpdates[student.studentId] = {
                        ...(studentScores[student.studentId] || {}),
                        testScore,
                        noteTakingScore,
                        assignmentScore,
                        examScore
                    };
                    updated++;
                });

                if (updated > 0) {
                    setStudentScores(prev => ({ ...prev, ...scoreUpdates }));
                }

                const parts = [];
                if (updated > 0) parts.push(`${updated} imported`);
                if (notFound > 0) parts.push(`${notFound} not found`);
                if (skipped > 0) parts.push(`${skipped} skipped`);
                if (invalid > 0) parts.push(`${invalid} invalid`);

                if (updated > 0) {
                    setSuccess(`CSV uploaded — ${parts.join(', ')}`);
                } else {
                    setError(`No scores imported — ${parts.join(', ')}`);
                }
            } catch (err) {
                console.error('CSV parse error:', err);
                setError('Failed to parse CSV. Ensure it matches the template format.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleSaveAll = async () => {
        setError(''); setSuccess(''); setSaving(true);
        try {
            const assessmentsData = students
                .filter(s => !isApproved(s))
                .map(student => {
                    const scores = studentScores[student.studentId] || {};
                    return {
                        studentId: student.studentId,
                        testScore: scores.testScore || 0,
                        noteTakingScore: scores.noteTakingScore || 0,
                        assignmentScore: scores.assignmentScore || 0,
                        examScore: scores.examScore || 0
                    };
                });

            if (assessmentsData.length === 0) {
                setSuccess('No editable assessments to save.');
                setSaving(false);
                return;
            }

            const response = await teacherCAAPI.uploadBulkCA({
                classId, subjectId, termId, sessionId, assessments: assessmentsData
            });
            if (response.success) {
                const { created, updated, errors: errCount } = response.data.summary;
                setSuccess(`Saved: ${created} new, ${updated} updated${errCount > 0 ? ` (${errCount} skipped)` : ''}`);
                fetchStudentsAndAssessments();
            } else { setError(response.message); }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to save assessments');
        } finally { setSaving(false); }
    };

    const handleSubmitForApproval = async () => {
        setConfirmSubmit(false);
        setSubmitting(true);
        try {
            const response = await teacherCAAPI.submitForApproval(classId, subjectId, { termId, sessionId });
            if (response.success) {
                setSuccess(`${response.data.submitted} draft assessment(s) submitted for approval`);
                fetchStudentsAndAssessments();
            } else { setError(response.message); }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to submit assessments');
        } finally { setSubmitting(false); }
    };

    const getStatusMeta = (existingCA) => {
        const status = existingCA?.status || 'draft';
        const map = {
            submitted: { label: 'Submitted', color: '#d97706', bg: '#fffbeb', dot: '#fbbf24' },
            draft:     { label: 'Draft',     color: '#64748b', bg: '#f8fafc', dot: '#94a3b8' },
            approved:  { label: 'Approved',  color: '#059669', bg: '#ecfdf5', dot: '#34d399' }
        };
        return map[status] || map.draft;
    };

    const isReady = classId && subjectId && termId && sessionId;
    const selectedClassLabel = eligibleClasses.find(c => c.classId === classId);
    const selectedSubjectLabel = subjects.find(s => s.subjectId === subjectId);

    return (
        <div className="ca-root">
            <div className="ca-bg-orb ca-bg-orb--1"></div>
            <div className="ca-bg-orb ca-bg-orb--2"></div>

            {/* Toasts */}
            <div className="ca-toasts">
                {error && (
                    <div className="ca-toast ca-toast--error" key="error">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="ca-toast ca-toast--success" key="success">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>{success}</span>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            {confirmDelete && (
                <div className="ca-delete-modal-overlay">
                    <div className="ca-delete-modal">
                        <div className="ca-delete-modal-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                        </div>
                        <h3 className="ca-delete-modal-title">Delete CA Entry</h3>
                        <p className="ca-delete-modal-student">
                            {confirmDelete.studentName && confirmDelete.subjectName ? (
                                <>
                                    <strong>{confirmDelete.studentName}</strong>
                                    <br />
                                    ({confirmDelete.subjectName})
                                </>
                            ) : (
                                <strong>this CA entry</strong>
                            )}
                        </p>
                        <div className="ca-delete-modal-actions">
                            <button className="ca-btn-sm ca-btn-sm--ghost" onClick={cancelDelete}>
                                Cancel
                            </button>
                            <button
                                className="ca-btn-sm ca-btn-sm--danger"
                                onClick={confirmDeleteHandler}
                                disabled={deletingId === confirmDelete.id}
                            >
                                {deletingId === confirmDelete.id ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="ca-btn-spinner" style={{ width: '14px', height: '14px' }} />
                                        Deleting...
                                    </span>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                            <line x1="10" y1="11" x2="10" y2="17"/>
                                            <line x1="14" y1="11" x2="14" y2="17"/>
                                        </svg>
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="ca-header">
                <div className="ca-header-content">
                    <div className="ca-header-text">
                        <div className="ca-header-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10 9 9 9 8 9"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="ca-title">Continuous Assessment</h1>
                            <p className="ca-subtitle">Enter scores for your assigned classes and subjects</p>
                        </div>
                    </div>
                    {eligibleClasses.length > 0 && (
                        <div className="ca-header-badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            {eligibleClasses.length} class{eligibleClasses.length !== 1 ? 'es' : ''} assigned
                        </div>
                    )}
                </div>
            </header>

            {/* Filters */}
            <div className="ca-filters">
                <div className="ca-filter-row">
                    <div className="ca-filter-field">
                        <label htmlFor="ca-class">My Class</label>
                        <div className="ca-select-wrap">
                            <select id="ca-class" value={classId} onChange={(e) => setClassId(e.target.value)} className="ca-select" disabled={initialLoading}>
                                <option value="">Select Class</option>
                                {eligibleClasses.map(cls => (
                                    <option key={cls.classId} value={cls.classId}>
                                        {cls.className} {cls.classSection} – {cls.classLevel}
                                        <span className="ca-select-sub-count"> ({cls.subjects.length} subj.)</span>
                                    </option>
                                ))}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ca-select-chevron">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div className="ca-filter-field">
                        <label htmlFor="ca-subject">My Subject</label>
                        <div className="ca-select-wrap">
                            <select id="ca-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="ca-select" disabled={!classId}>
                                <option value="">Select Subject</option>
                                {subjects.map(sub => (
                                    <option key={sub.subjectId} value={sub.subjectId}>
                                        {sub.subjectName} ({sub.subjectCode})
                                    </option>
                                ))}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ca-select-chevron">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div className="ca-filter-field">
                        <label htmlFor="ca-term">Term</label>
                        <div className="ca-select-wrap">
                            <select id="ca-term" value={termId} onChange={(e) => setTermId(e.target.value)} className="ca-select">
                                <option value="">Select Term</option>
                                {terms.map(term => (
                                    <option key={term._id} value={term._id}>
                                        {term.name} {term.status === 'active' ? '(Active)' : ''}
                                    </option>
                                ))}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ca-select-chevron">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div className="ca-filter-field">
                        <label htmlFor="ca-session">Session</label>
                        <div className="ca-select-wrap">
                            <select id="ca-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="ca-select">
                                <option value="">Select Session</option>
                                {sessions.map(s => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ca-select-chevron">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Score Breakdown Legend */}
                <div className="ca-legend">
                    <div className="ca-legend-group">
                        <span className="ca-legend-label">CA Components</span>
                        <div className="ca-legend-items">
                            <span className="ca-legend-chip ca-legend-chip--test">Test <strong>20</strong></span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ca-legend-plus">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span className="ca-legend-chip ca-legend-chip--notes">Notes <strong>10</strong></span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ca-legend-plus">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span className="ca-legend-chip ca-legend-chip--assign">Assign <strong>10</strong></span>
                            <span className="ca-legend-eq">=</span>
                            <span className="ca-legend-chip ca-legend-chip--ca">CA <strong>40</strong></span>
                        </div>
                    </div>
                    <div className="ca-legend-sep" />
                    <div className="ca-legend-group">
                        <span className="ca-legend-label">Final</span>
                        <div className="ca-legend-items">
                            <span className="ca-legend-chip ca-legend-chip--ca">CA <strong>40</strong></span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ca-legend-plus">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span className="ca-legend-chip ca-legend-chip--exam">Exam <strong>60</strong></span>
                            <span className="ca-legend-eq">=</span>
                            <span className="ca-legend-chip ca-legend-chip--total">Total <strong>100</strong></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit Confirm Bar */}
            {confirmSubmit && (
                <div className="ca-submit-confirm">
                    <div className="ca-submit-confirm-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ca-submit-confirm-icon">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>Submit all <strong>{draftCount}</strong> draft assessments for principal approval? This cannot be undone.</span>
                    </div>
                    <div className="ca-submit-confirm-actions">
                        <button className="ca-btn-sm ca-btn-sm--ghost" onClick={() => setConfirmSubmit(false)}>Cancel</button>
                        <button className="ca-btn-sm ca-btn-sm--submit" onClick={handleSubmitForApproval} disabled={submitting}>
                            {submitting ? <div className="ca-btn-spinner" /> : 'Confirm Submit'}
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            {initialLoading ? (
                <div className="ca-table-loading">
                    <div className="ca-inline-loader">
                        <div className="ca-loader-ring"></div>
                        <div className="ca-loader-ring"></div>
                        <div className="ca-loader-ring"></div>
                    </div>
                    <span>Loading your assignments...</span>
                </div>
            ) : eligibleClasses.length === 0 ? (
                <div className="ca-empty">
                    <div className="ca-empty-illustration">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                    </div>
                    <h3>No Assignments Found</h3>
                    <p>You are not assigned to any class-subject combination yet. Contact the administrator to get assigned.</p>
                </div>
            ) : !isReady ? (
                <div className="ca-empty">
                    <div className="ca-empty-illustration">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                    </div>
                    <h3>Select Filters to Begin</h3>
                    <p>Choose your class, subject, term, and session to load student score entries.</p>
                </div>
            ) : students.length === 0 ? (
                <div className="ca-empty">
                    <div className="ca-empty-illustration">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                    </div>
                    <h3>No Students Found</h3>
                    <p>No students are enrolled in {selectedClassLabel?.className} {selectedClassLabel?.classSection} yet.</p>
                </div>
            ) : (
                <>
                    {/* Completion Tracker */}
                    <div className="ca-tracker">
                        <div className="ca-tracker-bar">
                            <div
                                className="ca-tracker-fill"
                                style={{ width: `${students.length > 0 ? (completionCount / students.length) * 100 : 0}%` }}
                            />
                        </div>
                        <span className="ca-tracker-text">
                            <strong>{completionCount}</strong> of <strong>{students.length}</strong> students have scores entered
                        </span>
                    </div>

                    {/* CSV Tools Bar */}
                    <div className="ca-csv-bar">
                        <div className="ca-csv-bar-info">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            <span>Download the CSV template with student names, fill in scores offline, then upload</span>
                        </div>
                        <div className="ca-csv-bar-actions">
                            <button className="ca-csv-btn ca-csv-btn--download" onClick={downloadTemplate} title="Download CSV template with student names">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Download Template
                            </button>
                            <button className="ca-csv-btn ca-csv-btn--upload" onClick={() => fileInputRef.current?.click()} title="Upload filled CSV with exam scores">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="17 8 12 3 7 8"/>
                                    <line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                                Upload Scores CSV
                            </button>
                            <input
                                type="file"
                                accept=".csv"
                                ref={fileInputRef}
                                onChange={handleCSVUpload}
                                className="ca-csv-hidden-input"
                            />
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="ca-table-wrap">
                        <table className="ca-table">
                            <thead>
                                <tr>
                                    <th className="ca-th-sn">#</th>
                                    <th className="ca-th-student">Student</th>
                                    <th className="th-adm">Adm No</th>
                                    <th className="ca-th-input">
                                        <span className="ca-th-label">Test</span>
                                        <span className="ca-th-max">/20</span>
                                    </th>
                                    <th className="ca-th-input">
                                        <span className="ca-th-label">Notes</span>
                                        <span className="ca-th-max">/10</span>
                                    </th>
                                    <th className="ca-th-input">
                                        <span className="ca-th-label">Assign</span>
                                        <span className="ca-th-max">/10</span>
                                    </th>
                                    <th className="ca-th-ca">
                                        <span className="ca-th-label">CA</span>
                                        <span className="ca-th-max">/40</span>
                                    </th>
                                    <th className="ca-th-input">
                                        <span className="ca-th-label">Exam</span>
                                        <span className="ca-th-max">/60</span>
                                    </th>
                                    <th className="ca-th-total">
                                        <span className="ca-th-label">Total</span>
                                        <span className="ca-th-max">/100</span>
                                    </th>
                                    <th className="ca-th-status">Status</th>
                                    <th className="ca-th-action">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student, index) => {
                                    const sid = student.studentId;
                                    const scores = studentScores[sid] || {};
                                    const { totalCA, totalScore } = calculateTotals(sid);
                                    const approved = isApproved(student);
                                    const sm = getStatusMeta(student.existingCA);
                                    const isDeleting = deletingId === scores.assessmentId;

                                    return (
                                        <tr
                                            key={sid}
                                            className={`ca-row ${isComplete(sid) ? 'ca-row--filled' : ''} ${approved ? 'ca-row--approved' : ''} ${isDeleting ? 'ca-row--deleting' : ''}`}
                                            style={{ animationDelay: `${index * 0.025}s`, opacity: isDeleting ? 0.5 : 1 }}
                                        >
                                            <td className="ca-td-sn">{index + 1}</td>
                                            <td className="ca-td-student">
                                                <span className="ca-student-name">{student.lastName} {student.firstName}</span>
                                            </td>
                                            <td className="ca-td-adm">{student.admissionNumber}</td>
                                            <td className="ca-td-input">
                                                <input
                                                    type="number"
                                                    min="0" max="20"
                                                    value={scores.testScore || ''}
                                                    onChange={(e) => handleScoreChange(sid, 'testScore', e.target.value)}
                                                    placeholder="–"
                                                    className={`ca-score-input ${approved ? 'ca-score-input--locked' : ''}`}
                                                    disabled={approved || isDeleting}
                                                />
                                            </td>
                                            <td className="ca-td-input">
                                                <input
                                                    type="number"
                                                    min="0" max="10"
                                                    value={scores.noteTakingScore || ''}
                                                    onChange={(e) => handleScoreChange(sid, 'noteTakingScore', e.target.value)}
                                                    placeholder="–"
                                                    className={`ca-score-input ${approved ? 'ca-score-input--locked' : ''}`}
                                                    disabled={approved || isDeleting}
                                                />
                                            </td>
                                            <td className="ca-td-input">
                                                <input
                                                    type="number"
                                                    min="0" max="10"
                                                    value={scores.assignmentScore || ''}
                                                    onChange={(e) => handleScoreChange(sid, 'assignmentScore', e.target.value)}
                                                    placeholder="–"
                                                    className={`ca-score-input ${approved ? 'ca-score-input--locked' : ''}`}
                                                    disabled={approved || isDeleting}
                                                />
                                            </td>
                                            <td className="ca-td-ca">
                                                <span className={`ca-computed ${totalCA > 0 ? 'ca-computed--has' : ''}`}>{totalCA}</span>
                                            </td>
                                            <td className="ca-td-input">
                                                <input
                                                    type="number"
                                                    min="0" max="60"
                                                    value={scores.examScore || ''}
                                                    onChange={(e) => handleScoreChange(sid, 'examScore', e.target.value)}
                                                    placeholder="–"
                                                    className={`ca-score-input ${approved ? 'ca-score-input--locked' : ''}`}
                                                    disabled={approved || isDeleting}
                                                />
                                            </td>
                                            <td className="ca-td-total">
                                                <span className={`ca-total-badge ${totalScore >= 50 ? 'ca-total-badge--pass' : totalScore > 0 ? 'ca-total-badge--fail' : ''}`}>{totalScore}</span>
                                            </td>
                                            <td className="ca-td-status">
                                                <span className="ca-status-badge" style={{ color: sm.color, backgroundColor: sm.bg }}>
                                                    <span className="ca-status-dot" style={{ backgroundColor: sm.dot }} />
                                                    {approved && (
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={sm.dot} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                                                            <polyline points="20 6 9 17 4 12"/>
                                                        </svg>
                                                    )}
                                                    {sm.label}
                                                </span>
                                            </td>
                                            <td className="ca-td-action">
                                                {isDeleting ? (
                                                    <button
                                                        className="ca-delete-btn ca-delete-btn--loading"
                                                        disabled
                                                    >
                                                        <div className="ca-delete-spinner" style={{ width: '14px', height: '14px' }} />
                                                    </button>
                                                ) : !approved && scores.assessmentId ? (
                                                    <button
                                                        className="ca-delete-btn"
                                                        onClick={() => handleDeleteClick(
                                                            scores.assessmentId,
                                                            `${student.lastName} ${student.firstName}`,
                                                            selectedSubjectLabel?.subjectName || null
                                                        )}
                                                        title="Delete this CA entry"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"/>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                            <line x1="10" y1="11" x2="10" y2="17"/>
                                                            <line x1="14" y1="11" x2="14" y2="17"/>
                                                        </svg>
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="ca-cards">
                        {students.map((student, index) => {
                            const sid = student.studentId;
                            const scores = studentScores[sid] || {};
                            const { totalCA, totalScore } = calculateTotals(sid);
                            const approved = isApproved(student);
                            const sm = getStatusMeta(student.existingCA);
                            const isDeleting = deletingId === scores.assessmentId;

                            return (
                                <div
                                    key={sid}
                                    className={`ca-card ${isComplete(sid) ? 'ca-card--filled' : ''} ${approved ? 'ca-card--approved' : ''} ${isDeleting ? 'ca-card--deleting' : ''}`}
                                    style={{ animationDelay: `${index * 0.04}s`, opacity: isDeleting ? 0.5 : 1 }}
                                >
                                    <div className="ca-card-top">
                                        <div className="ca-card-student">
                                            <span className="ca-card-sn">#{index + 1}</span>
                                            <div>
                                                <span className="ca-student-name">{student.lastName} {student.firstName}</span>
                                                <span className="ca-student-id">{student.admissionNumber}</span>
                                            </div>
                                        </div>
                                        <div className="ca-card-top-right">
                                            <span className="ca-status-badge" style={{ color: sm.color, backgroundColor: sm.bg }}>
                                                <span className="ca-status-dot" style={{ backgroundColor: sm.dot }} />
                                                {approved && (
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={sm.dot} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                                                        <polyline points="20 6 9 17 4 12"/>
                                                    </svg>
                                                )}
                                                {sm.label}
                                            </span>
                                            {isDeleting ? (
                                                <button className="ca-delete-btn ca-delete-btn--loading" disabled>
                                                    <div className="ca-delete-spinner" style={{ width: '14px', height: '14px' }} />
                                                </button>
                                            ) : !approved && scores.assessmentId ? (
                                                <button
                                                    className="ca-delete-btn"
                                                    onClick={() => handleDeleteClick(
                                                        scores.assessmentId,
                                                        `${student.lastName} ${student.firstName}`,
                                                        selectedSubjectLabel?.subjectName || null
                                                    )}
                                                    title="Delete this CA entry"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"/>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                        <line x1="10" y1="11" x2="10" y2="17"/>
                                                        <line x1="14" y1="11" x2="14" y2="17"/>
                                                    </svg>
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="ca-card-scores-row">
                                        <div className="ca-card-mini-field">
                                            <span className="ca-card-mini-label">Test<span className="ca-card-mini-max">/20</span></span>
                                            <input
                                                type="number" min="0" max="20"
                                                value={scores.testScore || ''}
                                                onChange={(e) => handleScoreChange(sid, 'testScore', e.target.value)}
                                                placeholder="–"
                                                className={`ca-score-input ca-score-input--mini ${approved ? 'ca-score-input--locked' : ''}`}
                                                disabled={approved || isDeleting}
                                            />
                                        </div>
                                        <div className="ca-card-mini-field">
                                            <span className="ca-card-mini-label">Note<span className="ca-card-mini-max">/10</span></span>
                                            <input
                                                type="number" min="0" max="10"
                                                value={scores.noteTakingScore || ''}
                                                onChange={(e) => handleScoreChange(sid, 'noteTakingScore', e.target.value)}
                                                placeholder="–"
                                                className={`ca-score-input ca-score-input--mini ${approved ? 'ca-score-input--locked' : ''}`}
                                                disabled={approved || isDeleting}
                                            />
                                        </div>
                                        <div className="ca-card-mini-field">
                                            <span className="ca-card-mini-label">Assig<span className="ca-card-mini-max">/10</span></span>
                                            <input
                                                type="number" min="0" max="10"
                                                value={scores.assignmentScore || ''}
                                                onChange={(e) => handleScoreChange(sid, 'assignmentScore', e.target.value)}
                                                placeholder="–"
                                                className={`ca-score-input ca-score-input--mini ${approved ? 'ca-score-input--locked' : ''}`}
                                                disabled={approved || isDeleting}
                                            />
                                        </div>
                                        <div className="ca-card-mini-field">
                                            <span className="ca-card-mini-label">Exam<span className="ca-card-mini-max">/60</span></span>
                                            <input
                                                type="number" min="0" max="60"
                                                value={scores.examScore || ''}
                                                onChange={(e) => handleScoreChange(sid, 'examScore', e.target.value)}
                                                placeholder="–"
                                                className={`ca-score-input ca-score-input--mini ${approved ? 'ca-score-input--locked' : ''}`}
                                                disabled={approved || isDeleting}
                                            />
                                        </div>
                                        <div className="ca-card-mini-sep" />
                                        <div className="ca-card-mini-field ca-card-mini-field--ca">
                                            <span className="ca-card-mini-label">CA</span>
                                            <span className={`ca-card-mini-computed ${totalCA > 0 ? 'ca-card-mini-computed--has' : ''}`}>{totalCA}</span>
                                        </div>
                                        <div className="ca-card-mini-sep" />
                                        <div className="ca-card-mini-field ca-card-mini-field--total">
                                            <span className="ca-card-mini-label">Total</span>
                                            <span className={`ca-card-mini-total ${totalScore >= 50 ? 'ca-card-mini-total--pass' : totalScore > 0 ? 'ca-card-mini-total--fail' : ''}`}>{totalScore}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Action Bar */}
                    <div className="ca-actions">
                        <button className="ca-save-btn" onClick={handleSaveAll} disabled={saving}>
                            {saving ? (
                                <>
                                    <div className="ca-btn-spinner" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 0 2-2z"/>
                                        <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                                    </svg>
                                    Save All Scores
                                </>
                            )}
                        </button>
                        <button
                            className="ca-submit-btn"
                            onClick={() => setConfirmSubmit(true)}
                            disabled={draftCount === 0 || submitting}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Submit for Approval {draftCount > 0 && `(${draftCount})`}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default ContinuousAssessment;