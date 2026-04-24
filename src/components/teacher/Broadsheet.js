import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    dashboardAPI,
    classesAPI,
    teacherBroadsheetAPI,
    termsAPI,
    sessionsAPI,
    getAuthData,
} from '../../api';

// =============================================
// NIGERIAN GRADING SYSTEM
// =============================================
const GRADING = [
    { min: 70, max: 100, grade: 'A', remark: 'Excellent', color: '#15803d', bg: '#DCFCE7' },
    { min: 60, max: 69,  grade: 'B', remark: 'Very Good', color: '#2563eb', bg: '#DBEAFE' },
    { min: 50, max: 59,  grade: 'C', remark: 'Good',      color: '#D97706', bg: '#FEF3C7' },
    { min: 45, max: 49,  grade: 'D', remark: 'Fair',      color: '#EA580C', bg: '#FFEDD5' },
    { min: 40, max: 44,  grade: 'E', remark: 'Poor',      color: '#DC2626', bg: '#FEE2E2' },
    { min: 0,  max: 39,  grade: 'F', remark: 'Fail',      color: '#991B1B', bg: '#FECACA' },
];

function getGrade(score) {
    if (score === null || score === undefined || score === '-') {
        return { grade: '-', remark: '-', color: '#6B7280', bg: '#F3F4F6' };
    }
    const s = Number(score);
    if (isNaN(s)) return { grade: '-', remark: '-', color: '#6B7280', bg: '#F3F4F6' };
    return GRADING.find(g => s >= g.min && s <= g.max) || GRADING[GRADING.length - 1];
}

// =============================================
// HELPER FUNCTION: Get score from API response
// =============================================
function getScore(scores, studentId, subjectId) {
    const subjectScores = scores?.[subjectId];
    if (!subjectScores || !studentId) return null;
    return subjectScores[studentId] || null;
}

// =============================================
// SUB-COMPONENTS
// =============================================

function GradeBadge({ score }) {
    const g = getGrade(score);
    if (g.grade === '-') return <span className="text-slate-400 text-xs">—</span>;
    return (
        <span
            className="grade-badge inline-flex items-center justify-center w-7 h-6 rounded text-xs font-bold"
            style={{ color: g.color, backgroundColor: g.bg }}
        >
            {g.grade}
        </span>
    );
}

function StatsCard({ icon, label, value, sub, color, delay = 0 }) {
    return (
        <div
            className="bs-stats-card"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="bs-stats-icon" style={{ backgroundColor: color + '18', color }}>
                <i className={icon} />
            </div>
            <div>
                <div className="bs-stats-value">{value}</div>
                <div className="bs-stats-label">{label}</div>
                {sub && <div className="bs-stats-sub">{sub}</div>}
            </div>
        </div>
    );
}

function GradeDistribution({ grades }) {
    const maxCount = Math.max(...Object.values(grades), 1);
    return (
        <div className="bs-grade-dist">
            {GRADING.map((g, idx) => {
                const count = grades[g.grade] || 0;
                const pct = (count / maxCount) * 100;
                return (
                    <div key={g.grade} className="bs-grade-bar-wrap">
                        <span className="bs-grade-count">{count}</span>
                        <div
                            className="bs-grade-bar"
                            style={{
                                height: `${Math.max(pct, 4)}%`,
                                backgroundColor: g.color,
                                animationDelay: `${idx * 80}ms`,
                            }}
                        />
                        <span className="bs-grade-label" style={{ color: g.color }}>{g.grade}</span>
                    </div>
                );
            })}
        </div>
    );
}

function EmptyState({ icon, title, description }) {
    return (
        <div className="empty-state">
            <div className="empty-state-icon">{icon}</div>
            <div className="empty-state-title">{title}</div>
            <div className="empty-state-text">{description}</div>
        </div>
    );
}

function SortIcon({ field, sortField, sortDir }) {
    if (sortField !== field) return <i className="fas fa-sort" style={{ marginLeft: 4, fontSize: 10, color: '#94a3b8' }} />;
    return <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: 4, fontSize: 10, color: '#f59e0b' }} />;
}

function TableSkeleton({ rows = 8, cols = 9 }) {
    return (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
            {Array.from({ length: rows + 1 }).map((_, ri) => (
                <div key={ri} style={{ display: 'flex', borderTop: ri > 0 ? '1px solid #f1f5f9' : 'none' }}>
                    {Array.from({ length: cols }).map((_, ci) => (
                        <div key={ci} className="shimmer" style={{ flex: 1, minWidth: 60, height: ri === 0 ? 40 : 48, borderRight: '1px solid #f1f5f9' }} />
                    ))}
                </div>
            ))}
        </div>
    );
}

// =============================================
// MAIN COMPONENT
// =============================================
export default function Broadsheet() {
    const { user } = getAuthData();

    // --- State ---
    const [assignments, setAssignments] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [terms, setTerms] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState('');
    const [selectedSession, setSelectedSession] = useState('');
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState('all');
    const [initialLoading, setInitialLoading] = useState(true);
    const [broadsheetLoading, setBroadsheetLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('last_name');
    const [sortDir, setSortDir] = useState('asc');

    // The broadsheet data from the new API
    const [broadsheetData, setBroadsheetData] = useState(null);

    // ===================================================
    // STEP 1: Load assignments, classes, terms, sessions
    // ===================================================
    useEffect(() => {
        let cancelled = false;

        async function loadInitialData() {
            setInitialLoading(true);
            setError(null);
            try {
                const [assignRes, classesRes, termsRes, sessRes] = await Promise.all([
                    dashboardAPI.getAssignmentsByTeacher(user?._id),
                    classesAPI.getAll(),
                    termsAPI.getAll({ limit: 100 }),
                    sessionsAPI.getAll(),
                ]);

                if (cancelled) return;

                setAssignments(assignRes?.data || assignRes || []);
                setAllClasses(classesRes?.data || classesRes || []);
                setTerms(termsRes?.data || termsRes || []);
                setSessions(sessRes?.data || sessRes || []);

                const activeTerm = (termsRes?.data || termsRes || []).find(t => t.status === 'active');
                setSelectedTerm(activeTerm?._id || (termsRes?.data?.[0]?._id) || '');
                setSelectedSession((sessRes?.data?.[0]?._id) || '');
            } catch (err) {
                if (!cancelled) {
                    console.error('[Broadsheet] Initial load error:', err);
                    setError(err?.response?.data?.message || 'Failed to load assignments.');
                }
            } finally {
                if (!cancelled) setInitialLoading(false);
            }
        }

        loadInitialData();
        return () => { cancelled = true; };
    }, [user?._id]);

    // ===================================================
    // STEP 2: Build unique classes from assignments
    // ===================================================
    const uniqueClasses = useMemo(() => {
        const classMap = new Map();

        assignments.forEach(assignment => {
            const classId = assignment.class_id?._id || assignment.class_id;
            if (!classId) return;

            const subjectData = assignment.subject_id?._id
                ? assignment.subject_id
                : assignment.subject?.id
                    ? assignment.subject
                    : null;

            if (!classMap.has(classId)) {
                const classInfo = allClasses.find(c => c._id === classId);
                classMap.set(classId, {
                    _id: classId,
                    name: classInfo?.name || assignment.class_id?.name || 'Unknown Class',
                    section: classInfo?.section || assignment.class_id?.section || '',
                    level: classInfo?.level || assignment.class_id?.level || '',
                    subjects: subjectData ? [subjectData] : [],
                });
            } else {
                const existingClass = classMap.get(classId);
                if (subjectData) {
                    const subjectId = subjectData._id || subjectData.id;
                    const alreadyAdded = existingClass.subjects.some(
                        s => (s._id || s.id) === subjectId
                    );
                    if (!alreadyAdded) existingClass.subjects.push(subjectData);
                }
            }
        });

        return Array.from(classMap.values());
    }, [assignments, allClasses]);

    // ===================================================
    // STEP 3: Derived — subjects for selected class
    // ===================================================
    const mySubjectsForClass = useMemo(() => {
        const cls = uniqueClasses.find(c => c._id === selectedClassId);
        return cls ? cls.subjects : [];
    }, [selectedClassId, uniqueClasses]);

    // ===================================================
    // STEP 4: Fetch broadsheet data when class + term + session are selected
    // ===================================================
    useEffect(() => {
        if (!selectedClassId || !selectedTerm || !selectedSession || mySubjectsForClass.length === 0) return;
        let cancelled = false;

        async function loadBroadsheet() {
            setBroadsheetLoading(true);
            setError(null);
            setBroadsheetData(null);

            try {
                const params = {};
                if (selectedTerm) params.termId = selectedTerm;
                if (selectedSession) params.sessionId = selectedSession;
                if (selectedSubjectId !== 'all') params.subjectFilter = 'assigned';

                const response = await teacherBroadsheetAPI.getBroadsheet(selectedClassId, params);

                if (!cancelled) {
                    setBroadsheetData(response?.data || null);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('[Broadsheet] API error:', err);
                    setError(err?.response?.data?.message || 'Failed to load broadsheet data.');
                }
            } finally {
                if (!cancelled) setBroadsheetLoading(false);
            }
        }

        const timer = setTimeout(loadBroadsheet, 150);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [selectedClassId, selectedTerm, selectedSession, selectedSubjectId, mySubjectsForClass]);

    // ===================================================
    // STEP 5: Extract data from broadsheet response
    // ===================================================
    const {
        classInfo,
        termInfo,
        sessionInfo,
        subjects,
        subjectStats,
        students: broadsheetStudents,
        statistics,
    } = broadsheetData || {
        classInfo: null,
        termInfo: null,
        sessionInfo: null,
        subjects: [],
        subjectStats: [],
        students: [],
        statistics: {
            totalStudents: 0,
            assessedStudents: 0,
            notAssessedStudents: 0,
            highestTotal: 0,
            lowestTotal: 0,
            classAverage: 0,
            subjectsTotal: 0,
            subjectsWithScores: 0,
        },
    };

    // ===================================================
    // STEP 6: Derived values
    // ===================================================

    // Displayed subjects based on filter
    const displayedSubjects = useMemo(() => {
        if (selectedSubjectId === 'all') return subjects;
        return subjects.filter(s => s.subjectId === selectedSubjectId);
    }, [selectedSubjectId, subjects]);

    // Determine if we should show detailed view (single subject) or summary view (multi-subject)
    const isSingleSubjectView = displayedSubjects.length === 1;

    // Filtered + sorted students
    const getStudentName = useCallback((s) => {
        return `${s.lastName || ''} ${s.firstName || ''}`.trim();
    }, []);

    const getAdmNo = useCallback((s) => {
        return s.admissionNumber || '';
    }, []);

    const filteredStudents = useMemo(() => {
        if (!broadsheetStudents || broadsheetStudents.length === 0) return [];

        let result = [...broadsheetStudents];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s => {
                const name = getStudentName(s).toLowerCase();
                const adm = getAdmNo(s).toLowerCase();
                return name.includes(q) || adm.includes(q);
            });
        }
        result.sort((a, b) => {
            if (sortField === '_index') return 0;
            const f = sortField === 'last_name' ? 'lastName' : sortField === 'admission_number' ? 'admissionNumber' : sortField;
            let va = a[f] || '', vb = b[f] || '';
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [broadsheetStudents, searchQuery, sortField, sortDir, getStudentName, getAdmNo]);

    // Build grade distribution from API data
    const gradeDistribution = useMemo(() => {
        const dist = {};
        if (subjectStats && subjectStats.length > 0) {
            subjectStats.forEach(sub => {
                if (sub.gradeDistribution) {
                    Object.entries(sub.gradeDistribution).forEach(([grade, count]) => {
                        dist[grade] = (dist[grade] || 0) + count;
                    });
                }
            });
        } else if (statistics?.gradeDistribution) {
            Object.entries(statistics.gradeDistribution).forEach(([grade, count]) => {
                dist[grade] = count;
            });
        }
        return dist;
    }, [subjectStats, statistics]);

    // Handlers
    const handleClassSelect = useCallback((classId) => {
        if (classId === selectedClassId) return;
        setSelectedClassId(classId);
        setSelectedSubjectId('all');
        setSearchQuery('');
        setBroadsheetData(null);
    }, [selectedClassId]);

    const handleSort = useCallback((field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    }, [sortField]);

    const handlePrint = useCallback(() => window.print(), []);

    // ===================================================
    // RENDER
    // ===================================================
    if (initialLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }} />
                    <p style={{ color: '#64748b', fontSize: 14 }}>Loading your assignments...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-state">
                <div className="error-state-icon">⚠️</div>
                <div className="error-state-title">Error Loading Assignments</div>
                <div className="error-state-text">{error}</div>
            </div>
        );
    }

    const selectedClass = uniqueClasses.find(c => c._id === selectedClassId);
    const selectedTermData = terms.find(t => t._id === selectedTerm);
    const selectedSessionData = sessions.find(s => s._id === selectedSession);

    return (
        <div className="broadsheet-container">
            {/* Print-only school header */}
            <div className="print-only" style={{ textAlign: 'center', marginBottom: 16 }}>
                <h1 style={{ fontSize: 22, fontWeight: 'bold' }}>Diamondville International School</h1>
                <p style={{ fontSize: 13, color: '#666' }}>Motto: "Knowledge, Integrity, Excellence"</p>
                <div style={{ marginTop: 10, borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '6px 0' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2 }}>Broadsheet</h2>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
                    <span><strong>Class:</strong> {classInfo?.className || '—'}</span>
                    <span><strong>Term:</strong> {termInfo?.name || '—'}</span>
                    <span><strong>Session:</strong> {sessionInfo?.name || '—'}</span>
                </div>
                {selectedSubjectId !== 'all' && displayedSubjects[0] && (
                    <div style={{ fontSize: 13, marginTop: 4 }}><strong>Subject:</strong> {displayedSubjects[0].subjectName}</div>
                )}
                <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                    Printed: {new Date().toLocaleDateString('en-NG', { dateStyle: 'full' })}
                </div>
            </div>

            {/* Page title */}
            <div className="no-print" style={{ marginBottom: 20 }}>
                <h1 className="page-title" style={{ marginBottom: 4 }}>Broadsheet</h1>
                <p className="page-subtitle">View scores for your assigned classes and subjects</p>
            </div>

            {/* Term / Session selects */}
            <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <select
                    value={selectedTerm}
                    onChange={e => setSelectedTerm(e.target.value)}
                    className="form-select"
                    style={{ minWidth: 180 }}
                >
                    <option value="">Select Term</option>
                    {terms.map(t => (
                        <option key={t._id} value={t._id}>
                            {t.name} {t.status === 'active' ? '(Active)' : ''}
                        </option>
                    ))}
                </select>
                <select
                    value={selectedSession}
                    onChange={e => setSelectedSession(e.target.value)}
                    className="form-select"
                    style={{ minWidth: 180 }}
                >
                    <option value="">Select Session</option>
                    {sessions.map(s => (
                        <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                </select>
                {selectedClassId && (
                    <button onClick={handlePrint} className="btn btn-primary" style={{ marginLeft: 'auto' }}>
                        <i className="fas fa-print" style={{ marginRight: 6 }} />Print
                    </button>
                )}
            </div>

            {/* Class tabs */}
            <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
                {uniqueClasses.map(cls => {
                    const isActive = selectedClassId === cls._id;
                    return (
                        <button
                            key={cls._id}
                            onClick={() => handleClassSelect(cls._id)}
                            className={`bs-class-tab ${isActive ? 'bs-class-tab-active' : ''}`}
                        >
                            <i className="fas fa-chalkboard" style={{ fontSize: 12, marginRight: 8, color: isActive ? '#f59e0b' : '#64748b' }} />
                            {cls.name}
                            <span className={`bs-class-tab-badge ${isActive ? 'active' : ''}`}>
                                {cls.subjects.length}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* No class selected */}
            {!selectedClassId && (
                <EmptyState
                    icon="🏫"
                    title="Select a Class"
                    description="Choose one of your assigned classes above to view the broadsheet."
                />
            )}

            {/* Loading skeleton */}
            {selectedClassId && broadsheetLoading && (
                <TableSkeleton
                    rows={10}
                    cols={isSingleSubjectView ? 11 : 3 + displayedSubjects.length + 5}
                />
            )}

            {/* Class content */}
            {selectedClassId && !broadsheetLoading && broadsheetData && broadsheetStudents && broadsheetStudents.length > 0 && (
                <div>
                    {/* Subject pills */}
                    <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#64748b', marginRight: 4 }}>Subjects:</span>
                        <button
                            onClick={() => setSelectedSubjectId('all')}
                            className={`bs-subject-pill ${selectedSubjectId === 'all' ? 'active' : ''}`}
                        >
                            All My Subjects
                        </button>
                        {mySubjectsForClass.map(sub => {
                            const subId = sub._id || sub.id;
                            const hasData = subjectStats.some(s => s.subjectId === subId && s.assessedStudents > 0);
                            const isActive = selectedSubjectId === subId;
                            return (
                                <button
                                    key={subId}
                                    onClick={() => setSelectedSubjectId(subId)}
                                    className={`bs-subject-pill ${isActive ? 'active' : ''}`}
                                >
                                    <span style={{ fontWeight: 700 }}>{sub.code || ''}</span>
                                    <span className="bs-subject-pill-name">{sub.name}</span>
                                    {!hasData && <span className="bs-no-data-dot" title="No scores entered" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="no-print" style={{ marginBottom: 16 }}>
                        <div style={{ position: 'relative', maxWidth: 280 }}>
                            <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12 }} />
                            <input
                                type="text"
                                placeholder="Search student name or adm. no..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="form-control"
                                style={{ paddingLeft: 34 }}
                            />
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="no-print bs-stats-grid">
                        <StatsCard icon="fas fa-users" label="Students with Scores" value={statistics.assessedStudents || 0} sub={`of ${statistics.totalStudents}`} color="#3b82f6" delay={0} />
                        <StatsCard icon="fas fa-chart-line" label="Class Average" value={statistics.classAverage || '—'} sub="out of 100" color="#eab308" delay={50} />
                        <StatsCard icon="fas fa-arrow-up" label="Highest" value={statistics.highestTotal || '—'} color="#22c55e" delay={100} />
                        <StatsCard icon="fas fa-arrow-down" label="Lowest" value={statistics.lowestTotal || '—'} color="#ef4444" delay={150} />
                        <StatsCard icon="fas fa-check-double" label="Pass Rate (40+)" value={statistics.passRate ? `${statistics.passRate}%` : '—'} sub={isSingleSubjectView ? '' : 'by average'} color="#8b5cf6" delay={200} />
                    </div>

                    {/* Grade distribution */}
                    {Object.keys(gradeDistribution).length > 0 && statistics.assessedStudents > 0 && (
                        <div className="no-print bs-grade-dist-card">
                            <h4 style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Grade Distribution</h4>
                            <GradeDistribution grades={gradeDistribution} />
                        </div>
                    )}

                    {/* ====== THE BROADSHEET TABLE ====== */}
                    {filteredStudents.length === 0 ? (
                        <EmptyState
                            icon="🔍"
                            title="No Students Found"
                            description={searchQuery ? `No match for "${searchQuery}"` : 'No students in this class.'}
                        />
                    ) : (
                        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="broadsheet-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        {isSingleSubjectView ? (
                                            <>
                                                {/* SINGLE SUBJECT VIEW - Detailed breakdown */}
                                                <tr style={{ background: '#1B4332', color: '#fff' }}>
                                                    <th className="bs-th-sticky-0" onClick={() => handleSort('_index')} style={{ cursor: 'pointer', width: 40 }}>
                                                        S/N <SortIcon field="_index" sortField={sortField} sortDir={sortDir} />
                                                    </th>
                                                    <th className="bs-th-sticky-1" onClick={() => handleSort('last_name')} style={{ cursor: 'pointer', minWidth: 140, textAlign: 'left' }}>
                                                        Student Name <SortIcon field="last_name" sortField={sortField} sortDir={sortDir} />
                                                    </th>
                                                    <th className="bs-th-sticky-2" onClick={() => handleSort('admission_number')} style={{ cursor: 'pointer', minWidth: 100, textAlign: 'left' }}>
                                                        Adm. No <SortIcon field="admission_number" sortField={sortField} sortDir={sortDir} />
                                                    </th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '8px 6px', background: '#2D6A4F', borderRight: '1px solid #40916C' }}>
                                                        Test<br /><span style={{ color: '#6ee7b7', fontSize: 9 }}>/20</span>
                                                    </th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '8px 6px', background: '#2D6A4F', borderRight: '1px solid #40916C' }}>
                                                        Notes<br /><span style={{ color: '#6ee7b7', fontSize: 9 }}>/10</span>
                                                    </th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '8px 6px', background: '#2D6A4F', borderRight: '1px solid #40916C' }}>
                                                        Assign<br /><span style={{ color: '#6ee7b7', fontSize: 9 }}>/10</span>
                                                    </th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '8px 6px', background: '#2D6A4F', borderRight: '1px solid #40916C' }}>
                                                        CA<br /><span style={{ color: '#6ee7b7', fontSize: 9 }}>/40</span>
                                                    </th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '8px 6px', background: '#2D6A4F', borderRight: '1px solid #40916C' }}>
                                                        Exam<br /><span style={{ color: '#6ee7b7', fontSize: 9 }}>/60</span>
                                                    </th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '8px 6px', background: '#2D6A4F', borderRight: '1px solid #40916C' }}>
                                                        Total<br /><span style={{ color: '#6ee7b7', fontSize: 9 }}>/100</span>
                                                    </th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '8px 6px', background: '#2D6A4F' }}>Grade</th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '8px 6px', background: '#2D6A4F' }}>Remark</th>
                                                </tr>
                                            </>
                                        ) : (
                                            <>
                                                {/* MULTI-SUBJECT VIEW - Summary view */}
                                                <tr style={{ background: '#1B4332', color: '#fff' }}>
                                                    <th className="bs-th-sticky-0" onClick={() => handleSort('_index')} style={{ cursor: 'pointer', width: 40 }}>
                                                        S/N <SortIcon field="_index" sortField={sortField} sortDir={sortDir} />
                                                    </th>
                                                    <th className="bs-th-sticky-1" onClick={() => handleSort('lastName')} style={{ cursor: 'pointer', minWidth: 140, textAlign: 'left' }}>
                                                        Student Name <SortIcon field="lastName" sortField={sortField} sortDir={sortDir} />
                                                    </th>
                                                    <th className="bs-th-sticky-2" onClick={() => handleSort('admission_number')} style={{ cursor: 'pointer', minWidth: 100, textAlign: 'left' }}>
                                                        Adm. No <SortIcon field="admission_number" sortField={sortField} sortDir={sortDir} />
                                                    </th>
                                                    {displayedSubjects.map(sub => (
                                                        <th
                                                            key={sub.subjectId}
                                                            style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '8px 6px', background: '#2D6A4F', borderRight: '1px solid #40916C' }}
                                                        >
                                                            {sub.code || ''}
                                                            <br />
                                                            <span style={{ fontSize: 9, fontWeight: 400, color: '#a7f3d0' }}>{sub.subjectName}</span>
                                                        </th>
                                                    ))}
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '8px 6px', minWidth: 60, borderRight: '1px solid #40916C' }}>Total</th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '8px 6px', minWidth: 50, borderRight: '1px solid #40916C' }}>Avg</th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '8px 6px', minWidth: 40, borderRight: '1px solid #40916C' }}>Pos</th>
                                                    <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '8px 6px', minWidth: 44 }}>Grade</th>
                                                </tr>
                                            </>
                                        )}
                                    </thead>

                                    <tbody>
                                        {filteredStudents.map((student, idx) => {
                                            const rowBg = idx % 2 === 0 ? '#fff' : '#f8fafc';
                                            
                                            const renderSingleSubjectCell = (sub, studentId) => {
                                                const sc = getScore(student.scores, studentId, sub.subjectId);
                                                const g = getGrade(sc?.totalScore);

                                                return (
                                                    <React.Fragment key={sub.subjectId}>
                                                        <td style={{ textAlign: 'center', fontSize: 12, padding: '8px 6px', borderRight: '1px solid #f1f5f9' }}>
                                                            {sc?.testScore != null ? sc.testScore : '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'center', fontSize: 12, padding: '8px 6px', borderRight: '1px solid #f1f5f9' }}>
                                                            {sc?.noteTakingScore != null ? sc.noteTakingScore : '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'center', fontSize: 12, padding: '8px 6px', borderRight: '1px solid #f1f5f9' }}>
                                                            {sc?.assignmentScore != null ? sc.assignmentScore : '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'center', fontSize: 12, padding: '8px 6px', borderRight: '1px solid #f1f5f9' }}>
                                                            {sc?.totalCA != null ? sc.totalCA : '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'center', fontSize: 12, padding: '8px 6px', borderRight: '1px solid #f1f5f9' }}>
                                                            {sc?.examScore != null ? sc.examScore : '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '8px 6px', borderRight: '1px solid #f1f5f9', color: g.color }}>
                                                            {sc?.totalScore != null ? sc.totalScore : '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'center', padding: '8px 6px', borderRight: '1px solid #f1f5f9' }}>
                                                            <GradeBadge score={sc?.totalScore} />
                                                        </td>
                                                        <td style={{ textAlign: 'center', fontSize: 10, padding: '8px 6px', color: g.remark }}>
                                                            {g.remark !== '-' ? g.remark : '—'}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            };

                                            const renderMultiSubjectCell = (sub, studentId) => {
                                                const sc = getScore(student.scores, studentId, sub.subjectId);
                                                const g = getGrade(sc?.totalScore);

                                                return (
                                                    <td
                                                        key={sub.subjectId}
                                                        style={{ textAlign: 'center', fontSize: 12, fontWeight: sc ? 600 : 400, padding: '8px 6px', borderRight: '1px solid #f1f5f9', color: sc ? g.color : '#94a3b8' }}
                                                    >
                                                        {sc?.totalScore != null ? sc.totalScore : '—'}
                                                    </td>
                                                );
                                            };

                                            return (
                                                <tr key={student.studentId} className="broadsheet-row" style={{ background: rowBg }}>
                                                    <td className="bs-td-sticky-0" style={{ textAlign: 'center', fontSize: 12, color: '#64748b', padding: '8px 6px', borderRight: '1px solid #f1f5f9', background: rowBg }}>{idx + 1}</td>
                                                    <td className="bs-td-sticky-1" style={{ textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#1e293b', padding: '8px 10px', borderRight: '1px solid #f1f5f9', background: rowBg, whiteSpace: 'nowrap' }}>
                                                        {getStudentName(student)}
                                                    </td>
                                                    <td className="bs-td-sticky-2" style={{ textAlign: 'left', fontSize: 11, color: '#64748b', fontFamily: 'monospace', padding: '8px 10px', borderRight: '1px solid #f1f5f9', background: rowBg, whiteSpace: 'nowrap' }}>
                                                        {getAdmNo(student)}
                                                    </td>

                                                    {/* Score columns */}
                                                    {displayedSubjects.map(sub => isSingleSubjectView ? renderSingleSubjectCell(sub, student.studentId) : renderMultiSubjectCell(sub, student.studentId))}

                                                    {/* Summary columns (multi-subject only) */}
                                                    {!isSingleSubjectView && (
                                                        <>
                                                            <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#1e293b', padding: '8px 6px', borderRight: '1px solid #f1f5f9' }}>
                                                                {student.totalScore != null ? student.totalScore : '—'}
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#d97706', padding: '8px 6px', borderRight: '1px solid #f1f5f9' }}>
                                                                {student.averageScore != null ? student.averageScore : '—'}
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '8px 6px', borderRight: '1px solid #f1f5f9' }}>
                                                                {student.position ? (
                                                                    <span style={{
                                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                        width: 24, height: 24, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                                                                        background: student.position <= 3 ? '#1B4332' : '#f1f5f9',
                                                                        color: student.position <= 3 ? '#f59e0b' : '#64748b',
                                                                    }}>{student.position}</span>
                                                                ) : '—'}
                                                            </td>
                                                            <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                                                                <GradeBadge score={student.averageScore != null ? Math.round(Number(student.averageScore)) : null} />
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>

                                    {/* Footer summary */}
                                    {filteredStudents.length > 0 && (
                                        <tfoot>
                                            <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                                                <td colSpan={3} style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#475569', padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>
                                                    CLASS SUMMARY
                                                </td>
                                                {isSingleSubjectView && subjectStats && subjectStats.length > 0 ? (
                                                    <>
                                                        {subjectStats.map((sum, idx) => {
                                                            const sub = displayedSubjects[0];
                                                            return (
                                                                <React.Fragment key={`foot-${sub?._id || idx}`}>
                                                                    <td style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}>—</td>
                                                                    <td style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}>—</td>
                                                                    <td style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}>—</td>
                                                                    <td style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}>—</td>
                                                                    <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}>Avg: {sum?.avg || '—'}</td>
                                                                    <td style={{ textAlign: 'center', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}><span style={{ fontSize: 10, color: '#94a3b8' }}>—</span></td>
                                                                    <td style={{ textAlign: 'center', padding: '6px 6px' }}><span style={{ fontSize: 10, color: '#94a3b8' }}>—</span></td>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </>
                                                ) : !isSingleSubjectView && subjectStats && subjectStats.length > 0 ? (
                                                    <>
                                                        {subjectStats.map((sum, idx) => (
                                                            <td key={`foot-${sum.subjectId || idx}`} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#475569', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}>
                                                                {sum.avg || '—'}
                                                            </td>
                                                        ))}
                                                        <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}>—</td>
                                                        <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#d97706', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}>—</td>
                                                        <td style={{ textAlign: 'center', padding: '6px 6px', borderRight: '1px solid #e2e8f0' }}>—</td>
                                                        <td style={{ textAlign: 'center', padding: '6px 6px' }}>—</td>
                                                    </>
                                                ) : null}
                                            </tr>
                                            {/* Sub-footer for single subject */}
                                            {isSingleSubjectView && subjectStats[0] && (
                                                <tr style={{ background: '#f8fafc' }}>
                                                    <td colSpan={3} style={{ textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#64748b', padding: '4px 10px', borderRight: '1px solid #e2e8f0' }}>
                                                        H: {subjectStats[0]?.high ?? '—'} &nbsp;|&nbsp; L: {subjectStats[0]?.low ?? '—'} &nbsp;|&nbsp; Entered: {subjectStats[0]?.count ?? 0}/{filteredStudents.length}
                                                    </td>
                                                    <td colSpan={8} />
                                                </tr>
                                            )}
                                        </tfoot>
                                    )}
                                </table>
                            </div>

                            {/* Per-subject breakdown cards (multi-subject only) - OUTSIDE TABLE */}
                            {!isSingleSubjectView && subjectStats && subjectStats.length > 0 && (
                                <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 20, padding: '0 16px 16px' }}>
                                    {subjectStats.map((sum, idx) => (
                                        <div key={sum.subjectId || idx} className="card" style={{ padding: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: 4 }}>
                                                        {sum.code || ''}
                                                    </span>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{sum.subjectName}</span>
                                                </div>
                                                {(!sum.count || sum.count === 0) && (
                                                    <span style={{ fontSize: 10, color: '#ef4444', background: '#fef2f2', padding: '2px 8px', borderRadius: 12 }}>No data</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{sum.avg === '—' ? '—' : sum.avg}</div>
                                                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Average</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{sum.high === '—' ? '—' : sum.high}</div>
                                                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Highest</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{sum.low === '—' ? '—' : sum.low}</div>
                                                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Lowest</div>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
                                                {sum.count || 0}/{filteredStudents.length} scores entered
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* No students in class */}
            {selectedClassId && !broadsheetLoading && broadsheetData && (!broadsheetData.students || broadsheetData.students.length === 0) && (
                <EmptyState
                    icon="👨‍🎓"
                    title="No Students Found"
                    description="This class has no students assigned yet, or no scores have been entered."
                />
            )}

            {/* Styles */}
            <style>{`
                /* Stats cards */
                .bs-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .bs-stats-card {
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 12px;
                    padding: 14px 16px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    animation: bsFadeIn 0.4s ease-out forwards;
                    opacity: 0;
                }
                .bs-stats-icon {
                    width: 42px;
                    height: 42px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    flex-shrink: 0;
                }
                .bs-stats-value { font-size: 22px; font-weight: 700; color: #f1f5f9; line-height: 1; }
                .bs-stats-label { font-size: 11px; color: #94a3b8; margin-top: 3px; }
                .bs-stats-sub { font-size: 10px; color: #64748b; margin-top: 1px; }

                /* Grade distribution */
                .bs-grade-dist-card {
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 16px;
                    animation: bsFadeIn 0.4s ease-out 0.25s forwards;
                    opacity: 0;
                }
                .bs-grade-dist {
                    display: flex;
                    gap: 12px;
                    align-items: flex-end;
                    height: 72px;
                }
                .bs-grade-bar-wrap {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 3px;
                    flex: 1;
                }
                .bs-grade-count { font-size: 10px; font-weight: 700; color: #94a3b8; }
                .bs-grade-bar {
                    width: 100%;
                    max-width: 32px;
                    border-radius: 3px 3px 0 0;
                    animation: bsBarGrow 0.6s ease-out forwards;
                }
                .bs-grade-label { font-size: 12px; font-weight: 700; }

                /* Class tabs */
                .bs-class-tab {
                    display: flex;
                    align-items: center;
                    padding: 10px 16px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 500;
                    white-space: nowrap;
                    border: 1px solid #e2e8f0;
                    background: #fff;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .bs-class-tab:hover { border-color: #cbd5e1; color: #334155; }
                .bs-class-tab-active {
                    background: #1B4332 !important;
                    border-color: #2D6A4F !important;
                    color: #fff !important;
                    box-shadow: 0 4px 12px rgba(27, 67, 50, 0.3);
                }
                .bs-class-tab-badge {
                    font-size: 10px;
                    padding: 1px 7px;
                    border-radius: 10px;
                    margin-left: 8px;
                    background: #f1f5f9;
                    color: #94a3b8;
                }
                .bs-class-tab-badge.active { background: #2D6A4F; color: #a7f3d0; }

                /* Subject pills */
                .bs-subject-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 500;
                    border: 1px solid #e2e8f0;
                    background: #fff;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .bs-subject-pill:hover { border-color: #cbd5e1; color: #334155; }
                .bs-subject-pill.active {
                    background: #eab308 !important;
                    border-color: #eab308 !important;
                    color: #1e293b !important;
                    font-weight: 600;
                }
                .bs-subject-pill-name { display: none; }
                @media (min-width: 640px) { .bs-subject-pill-name { display: inline; } }
                .bs-no-data-dot {
                    width: 6px; height: 6px; border-radius: 50%; background: #ef4444; flex-shrink: 0;
                }

                /* Shimmer loading */
                @keyframes shimmer {
                    0% { background-position: -400px 0; }
                    100% { background-position: 400px 0; }
                }
                .shimmer {
                    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
                    background-size: 400px 100%;
                    animation: shimmer 1.5s ease-in-out infinite;
                }

                /* Animations */
                @keyframes bsFadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes bsBarGrow { from { height: 0; } }

                /* Table row hover */
                .broadsheet-row { transition: background-color 0.12s; }
                .broadsheet-row:hover { background-color: #f0fdf4 !important; }

                /* Sticky columns */
                .bs-th-sticky-0, .bs-td-sticky-0 { position: sticky; left: 0; z-index: 10; }
                .bs-th-sticky-1, .bs-td-sticky-1 { position: sticky; left: 40px; z-index: 10; }
                .bs-th-sticky-2, .bs-td-sticky-2 { position: sticky; left: 180px; z-index: 10; }
                .broadsheet-table thead .bs-th-sticky-0,
                .broadsheet-table thead .bs-th-sticky-1,
                .broadsheet-table thead .bs-th-sticky-2 { z-index: 20; }
                .broadsheet-table tbody .bs-td-sticky-0 { box-shadow: 3px 0 6px rgba(0,0,0,0.06); }
                .broadsheet-row:hover .bs-td-sticky-0,
                .broadsheet-row:hover .bs-td-sticky-1,
                .broadsheet-row:hover .bs-td-sticky-2 { background-color: #f0fdf4 !important; }

                /* Grade badge */
                .grade-badge { border: 1px solid transparent; }

                /* Print */
                .print-only { display: none; }
                @media print {
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .broadsheet-table { font-size: 10px !important; }
                    .broadsheet-table th, .broadsheet-table td { padding: 3px 5px !important; border: 1px solid #333 !important; }
                    .broadsheet-row:hover { background-color: transparent !important; }
                    .bs-td-sticky-0,
                    .bs-td-sticky-1,
                    .bs-td-sticky-2 { position: sticky; left: 0; z-index: 10; }
                    .grade-badge { border: 1px solid #888 !important; }
                    .bs-stats-card, .bs-grade-dist-card { display: none !important; }
                    .shimmer { animation: none; background: #e5e7eb !important; }
                }
            `}</style>
        </div>
    );
}