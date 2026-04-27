import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { adminCAAPI, termsAPI, sessionsAPI, classesAPI, subjectsAPI } from '../../api';

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
        submitted: { label: 'Submitted', color: '#d97706', bg: '#fffbeb', dot: '#fbbf24', borderColor: '#fde68a' },
        draft:     { label: 'Draft',     color: '#64748b', bg: '#f8fafc', dot: '#94a3b8', borderColor: '#e2e8f0' },
        approved:  { label: 'Approved',  color: '#059669', bg: '#ecfdf5', dot: '#34d399', borderColor: '#a7f3d0' }
    };
    return map[s] || map.draft;
};

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

const normalizeFilterOptions = (response) => {
    if (!response?.success || !response.data) return null;
    const d = response.data;
    const terms = Array.isArray(d.terms) ? d.terms : [];
    const sessions = Array.isArray(d.sessions) ? d.sessions : [];
    const classes = Array.isArray(d.classes) ? d.classes : (Array.isArray(d.classesData) ? d.classesData : []);
    const subjects = Array.isArray(d.subjects) ? d.subjects : [];
    const nested = d.data || {};
    const nestedTerms = Array.isArray(nested.terms) ? nested.terms : [];
    const nestedSessions = Array.isArray(nested.sessions) ? nested.sessions : [];
    const nestedClasses = Array.isArray(nested.classes) ? nested.classes : (Array.isArray(nested.classesData) ? nested.classesData : []);
    const nestedSubjects = Array.isArray(nested.subjects) ? nested.subjects : [];
    const deepNested = nested.data || {};
    const deepTerms = Array.isArray(deepNested.terms) ? deepNested.terms : [];
    const deepSessions = Array.isArray(deepNested.sessions) ? deepNested.sessions : [];
    const deepClasses = Array.isArray(deepNested.classes) ? deepNested.classes : (Array.isArray(deepNested.classesData) ? deepNested.classesData : []);
    const deepSubjects = Array.isArray(deepNested.subjects) ? deepNested.subjects : [];
    const pickLongest = (...arrays) => arrays.reduce((a, b) => b.length > a.length ? b : a, []);
    return {
        terms: pickLongest(terms, nestedTerms, deepTerms),
        sessions: pickLongest(sessions, nestedSessions, deepSessions),
        classes: pickLongest(classes, nestedClasses, deepClasses),
        subjects: pickLongest(subjects, nestedSubjects, deepSubjects),
    };
};

const toOption = (item) => {
    if (!item) return null;
    const id = item._id || item.value || item.id || item.termId || item.sessionId || item.classId || item.subjectId;
    const name = item.name || item.label || item.className || item.subjectName || item.termName || item.sessionName || `${id}`;
    if (!id) return null;
    return { _id: id, name, ...item };
};

// Page size options
const PAGE_SIZE_OPTIONS = [10, 20, 50];

const ExcludeCheckbox = React.memo(({ checked, indeterminate, onChange }) => (
    <div
        className={`aa-exclude-cb ${checked && !indeterminate ? 'aa-exclude-cb--checked' : ''} ${indeterminate ? 'aa-exclude-cb--indeterminate' : ''}`}
        onClick={onChange}
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(); } }}
    >
        {(checked || indeterminate) && (
            indeterminate ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            )
        )}
    </div>
));
ExcludeCheckbox.displayName = 'ExcludeCheckbox';

const ApproveAssessments = () => {
    const [assessments, setAssessments]                   = useState([]);
    const [termId, setTermId]                             = useState('');
    const [sessionId, setSessionId]                       = useState('');
    const [classId, setClassId]                           = useState('');
    const [subjectId, setSubjectId]                       = useState('');
    const [status, setStatus]                             = useState('submitted');
    const [terms, setTerms]                               = useState([]);
    const [sessions, setSessions]                         = useState([]);
    const [classes, setClasses]                           = useState([]);
    const [subjects, setSubjects]                         = useState([]);
    const [loading, setLoading]                           = useState(false);
    const [subjectsLoading, setSubjectsLoading]           = useState(false);
    const [bulkLoading, setBulkLoading]                   = useState(false);
    const [bulkProgress, setBulkProgress]                 = useState({ current: 0, total: 0, phase: '' });
    const [confirmBulk, setConfirmBulk]                   = useState(false);
    const [confirmBulkUnapprove, setConfirmBulkUnapprove] = useState(false);
    const [success, setSuccess]                           = useState('');
    const [error, setError]                               = useState('');
    const [unapprovingId, setUnapprovingId]               = useState(null);
    const [excludedIds, setExcludedIds]                   = useState(new Set());
    const [totalResults, setTotalResults]                 = useState(0);

    // PAGINATION STATE
    const [currentPage, setCurrentPage]                   = useState(1);
    const [pageSize, setPageSize]                         = useState(20);

    const [approvedSummary, setApprovedSummary]           = useState(null);
    const [bulkApproveResult, setBulkApproveResult]       = useState(null);

    const [showClearPanel, setShowClearPanel]             = useState(false);
    const [clearClasses, setClearClasses]                 = useState([]);
    const [clearSubjects, setClearSubjects]               = useState([]);
    const [clearClassId, setClearClassId]                 = useState('');
    const [clearSubjectId, setClearSubjectId]             = useState('');
    const [clearLoading, setClearLoading]                 = useState(false);
    const [clearSuccess, setClearSuccess]                 = useState('');
    const [clearError, setClearError]                     = useState('');
    const [clearClassesLoading, setClearClassesLoading]   = useState(false);
    const [clearSubjectsLoading, setClearSubjectsLoading] = useState(false);
    const [clearInfo, setClearInfo]                       = useState(null);
    const [clearProgress, setClearProgress]               = useState({ current: 0, total: 0, phase: '' });
    const [clearPreview, setClearPreview]                 = useState(null);
    const [clearPreviewLoading, setClearPreviewLoading]   = useState(false);
    const [clearExcludedStudents, setClearExcludedStudents] = useState(new Set());
    const [clearConfirmAction, setClearConfirmAction]     = useState(null);
    const [previewExpanded, setPreviewExpanded]           = useState(true);
    const [clearPreviewAssessmentIds, setClearPreviewAssessmentIds] = useState([]);
    const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
    const filterOptionsSourceRef = useRef(null);

    const abortRef         = useRef(null);
    const debounceRef      = useRef(null);
    const initialDoneRef   = useRef(false);
    const fetchRef         = useRef(null);
    const subjectsCacheRef = useRef({});

    const isAllExcluded  = assessments.length > 0 && excludedIds.size === assessments.length;
    const isSomeExcluded = excludedIds.size > 0 && !isAllExcluded;

    // Total pages derived from totalResults and pageSize
    const totalPages = useMemo(() => {
        if (totalResults <= 0) return 1;
        return Math.ceil(totalResults / pageSize);
    }, [totalResults, pageSize]);

    // For submitted tab: use effectivePendingCount from visible list
    const effectivePendingCount  = Math.max(0, (status === 'submitted' ? assessments.length : 0) - excludedIds.size);
    const effectiveApprovedCount = Math.max(0, (status === 'approved' ? assessments.length : 0) - excludedIds.size);

    const activeTermName = terms.find(t => t._id === termId)?.name || '';
    const activeSessionName = sessions.find(s => s._id === sessionId)?.name || '';
    const isCrossTermApproved = status === 'approved' && approvedSummary?.byTerm?.length > 1;
    const canUseFilterApprove = status === 'submitted' && (termId || sessionId || classId || subjectId);

    const toggleExclude = useCallback((id) => {
        setExcludedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleExcludeAll = useCallback(() => {
        setExcludedIds(prev => {
            if (prev.size === assessments.length) return new Set();
            return new Set(assessments.map(a => a._id));
        });
    }, [assessments]);

    const clearExclusions = useCallback(() => setExcludedIds(new Set()), []);

    useEffect(() => {
        if (!success && !error && !clearSuccess) return;
        const t = setTimeout(() => { setSuccess(''); setError(''); setClearSuccess(''); setBulkApproveResult(null); }, 6000);
        return () => clearTimeout(t);
    }, [success, error, clearSuccess]);

    // Reset to page 1 when filters or status change
    useEffect(() => {
        if (!initialDoneRef.current) return;
        setCurrentPage(1);
    }, [termId, sessionId, classId, subjectId, status, pageSize]);

    const fetchSubjectsForClass = useCallback(async (cId) => {
        if (subjectsCacheRef.current[cId]) {
            setSubjects(subjectsCacheRef.current[cId]);
            return;
        }
        setSubjectsLoading(true);
        try {
            const res = await subjectsAPI.getByClass(cId);
            if (res.success && Array.isArray(res.data)) {
                subjectsCacheRef.current[cId] = res.data;
                setSubjects(res.data);
            } else {
                setSubjects([]);
            }
        } catch (err) {
            console.error('Failed to fetch subjects for class:', err);
            setSubjects([]);
        } finally {
            setSubjectsLoading(false);
        }
    }, []);

    const scheduleFetch = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchRef.current?.(), 250);
    }, []);

    useEffect(() => {
        if (!initialDoneRef.current) return;
        setExcludedIds(new Set());
        setBulkApproveResult(null);
        scheduleFetch();
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [termId, sessionId, classId, subjectId, status, currentPage, pageSize, scheduleFetch]);

    useEffect(() => {
        if (!initialDoneRef.current) return;
        setSubjectId('');
        if (!classId) {
            setSubjects([]);
            subjectsCacheRef.current = {};
        } else {
            fetchSubjectsForClass(classId);
        }
    }, [classId, fetchSubjectsForClass]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                let usedFilterOptions = false;
                let normalizedFilterOptions = null;

                try {
                    setFilterOptionsLoading(true);
                    const filterRes = await adminCAAPI.getFilterOptions({ status });
                    if (filterRes?.success) {
                        const normalized = normalizeFilterOptions(filterRes);
                        if (normalized) {
                            usedFilterOptions = true;
                            normalizedFilterOptions = normalized;
                            filterOptionsSourceRef.current = 'filterOptions';
                            if (normalized.terms.length > 0) {
                                const termOpts = normalized.terms.map(toOption).filter(Boolean);
                                setTerms(termOpts);
                                const active = termOpts.find(t => t.status === 'active' || t.isActive === true);
                                if (active) {
                                    setTermId(active._id);
                                    setSessionId(active.session?._id || active.session || active.sessionId || '');
                                }
                            }
                            if (normalized.sessions.length > 0) {
                                setSessions(normalized.sessions.map(toOption).filter(Boolean));
                            }
                            if (normalized.classes.length > 0) {
                                setClasses(normalized.classes.map(toOption).filter(Boolean));
                            }
                            if (normalized.subjects.length > 0) {
                                subjectsCacheRef.current['__global__'] = normalized.subjects.map(toOption).filter(Boolean);
                            }
                            if (normalized.terms.length === 0 || normalized.sessions.length === 0 || normalized.classes.length === 0) {
                                usedFilterOptions = false;
                            }
                        }
                    }
                } catch (filterErr) {
                    console.warn('[getFilterOptions] failed, falling back:', filterErr.message);
                    usedFilterOptions = false;
                } finally {
                    setFilterOptionsLoading(false);
                }

                if (!usedFilterOptions) {
                    filterOptionsSourceRef.current = 'individual';
                    const [termsRes, sessionsRes, classesRes] = await Promise.all([
                        termsAPI.getAll(), sessionsAPI.getAll(), classesAPI.getAllForDropdown()
                    ]);
                    if (termsRes.success) {
                        setTerms(termsRes.data);
                        const active = termsRes.data.find(t => t.status === 'active');
                        if (active) {
                            setTermId(active._id);
                            setSessionId(active.session?._id || active.session);
                        }
                    }
                    if (sessionsRes.success) setSessions(sessionsRes.data);
                    if (classesRes.success) {
                        const data = classesRes.data?.data || classesRes.data;
                        setClasses(Array.isArray(data) ? data : []);
                    }
                } else if (normalizedFilterOptions) {
                    const missingPromises = [];
                    if (normalizedFilterOptions.terms.length === 0) {
                        missingPromises.push(termsAPI.getAll().then(res => {
                            if (res.success) { setTerms(res.data); const active = res.data.find(t => t.status === 'active'); if (active) { setTermId(active._id); setSessionId(active.session?._id || active.session); } }
                        }));
                    }
                    if (normalizedFilterOptions.sessions.length === 0) {
                        missingPromises.push(sessionsAPI.getAll().then(res => { if (res.success) setSessions(res.data); }));
                    }
                    if (normalizedFilterOptions.classes.length === 0) {
                        missingPromises.push(classesAPI.getAllForDropdown().then(res => { if (res.success) { const data = res.data?.data || res.data; setClasses(Array.isArray(data) ? data : []); } }));
                    }
                    if (missingPromises.length > 0) await Promise.all(missingPromises);
                }
            } catch (err) {
                console.error('[fetchInitialData]', err);
            } finally {
                initialDoneRef.current = true;
                fetchRef.current?.();
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!initialDoneRef.current) return;
        const refetch = async () => {
            try {
                setFilterOptionsLoading(true);
                const filterRes = await adminCAAPI.getFilterOptions({ status });
                if (filterRes?.success) {
                    const normalized = normalizeFilterOptions(filterRes);
                    if (normalized) {
                        if (normalized.terms.length > 0) setTerms(normalized.terms.map(toOption).filter(Boolean));
                        if (normalized.sessions.length > 0) setSessions(normalized.sessions.map(toOption).filter(Boolean));
                        if (normalized.classes.length > 0) setClasses(normalized.classes.map(toOption).filter(Boolean));
                        if (normalized.subjects.length > 0) subjectsCacheRef.current['__global__'] = normalized.subjects.map(toOption).filter(Boolean);
                        filterOptionsSourceRef.current = 'filterOptions';
                    }
                }
            } catch (err) { console.warn('[refetchFilterOptions] failed:', err.message); }
            finally { setFilterOptionsLoading(false); }
        };
        refetch();
    }, [status]);

    // =====================================================
    // UPDATED fetchAssessments — now sends page & limit
    // =====================================================
    const fetchAssessments = useCallback(async () => {
        if (abortRef.current) abortRef.current.cancelled = true;
        const controller = { cancelled: false };
        abortRef.current = controller;

        try {
            setLoading(true);
            setConfirmBulk(false);
            setConfirmBulkUnapprove(false);

            if (status === 'approved') {
                const params = {};
                if (classId)   params.classId   = classId;
                if (subjectId) params.subjectId = subjectId;
                if (termId)    params.termId    = termId;
                if (sessionId) params.sessionId = sessionId;
                params.page  = currentPage;
                params.limit = pageSize;

                const response = await adminCAAPI.getAllApproved(params);
                if (controller.cancelled) return;

                const dataArray = extractDataArray(response);
                setAssessments(dataArray);
                setExcludedIds(new Set());
                setApprovedSummary(response.success ? response.summary || null : null);

                if (response.success && response.summary?.total != null) {
                    setTotalResults(response.summary.total);
                } else if (response.success && response.total != null) {
                    setTotalResults(response.total);
                } else {
                    setTotalResults(dataArray.length);
                }
            } else {
                const params = {};
                if (termId)    params.termId    = termId;
                if (sessionId) params.sessionId = sessionId;
                if (classId)   params.classId   = classId;
                if (subjectId) params.subjectId = subjectId;
                if (status && status !== 'all') params.status = status;

                // PAGINATION: send page and limit to backend
                params.page  = currentPage;
                params.limit = pageSize;

                const response = await adminCAAPI.getAssessments(params);
                if (controller.cancelled) return;

                const dataArray = extractDataArray(response);
                setAssessments(dataArray);
                setExcludedIds(new Set());
                setApprovedSummary(null);

                // Backend should return total count for pagination
                if (response.summary?.total != null) {
                    setTotalResults(response.summary.total);
                } else if (response.total != null) {
                    setTotalResults(response.total);
                } else if (response.data?.total != null) {
                    setTotalResults(response.data.total);
                } else {
                    setTotalResults(dataArray.length);
                }
            }
        } catch (err) {
            if (controller.cancelled) return;
            console.error('[fetchAssessments]', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch assessments');
        } finally {
            if (abortRef.current === controller) setLoading(false);
        }
    }, [termId, sessionId, classId, subjectId, status, currentPage, pageSize]);

    useEffect(() => { fetchRef.current = fetchAssessments; }, [fetchAssessments]);

    const handleApprove = useCallback(async (id) => {
        setSuccess(''); setError('');
        const previous = { ...assessments.find(a => a._id === id) };
        setAssessments(prev => prev.map(a => a._id === id ? { ...a, status: 'approved' } : a));
        try {
            const response = await adminCAAPI.approve(id);
            if (response.success) {
                setSuccess('Assessment approved successfully');
                if (response.data) setAssessments(prev => prev.map(a => a._id === id ? { ...a, ...response.data, status: 'approved' } : a));
            } else {
                setAssessments(prev => prev.map(a => a._id === id ? previous : a));
                setError(response.message || 'Failed to approve');
            }
        } catch (err) {
            setAssessments(prev => prev.map(a => a._id === id ? previous : a));
            setError(err.response?.data?.message || err.message || 'Failed to approve assessment');
        }
    }, [assessments]);

    const handleUnapprove = useCallback(async (id) => {
        setSuccess(''); setError(''); setUnapprovingId(id);
        const previous = { ...assessments.find(a => a._id === id) };
        setAssessments(prev => prev.map(a => a._id === id ? { ...a, status: 'submitted' } : a));
        try {
            const response = await adminCAAPI.unapprove(id);
            if (response.success) {
                setSuccess('Assessment unapproved successfully');
                if (response.data) setAssessments(prev => prev.map(a => a._id === id ? { ...a, ...response.data, status: 'submitted' } : a));
            } else {
                setAssessments(prev => prev.map(a => a._id === id ? previous : a));
                setError(response.message || 'Failed to unapprove');
            }
        } catch (err) {
            setAssessments(prev => prev.map(a => a._id === id ? previous : a));
            setError(err.response?.data?.message || err.message || 'Failed to unapprove assessment');
        } finally { setUnapprovingId(null); }
    }, [assessments]);

    const handleApproveAll = useCallback(async () => {
        setConfirmBulk(false);
        setBulkLoading(true);
        setBulkProgress({ current: 0, total: 1, phase: 'Approving...' });
        setSuccess(''); setError(''); setBulkApproveResult(null);
        const excludedIdsArray = excludedIds.size > 0 ? Array.from(excludedIds) : undefined;
        setAssessments(prev => prev.map(a => (!excludedIds.has(a._id) ? { ...a, status: 'approved' } : a)));
        try {
            const filters = { termId: termId || undefined, sessionId: sessionId || undefined, classId: classId || undefined, subjectId: subjectId || undefined };
            if (excludedIdsArray?.length > 0) filters.excludedIds = excludedIdsArray;
            const response = await adminCAAPI.bulkApproveByFilters(filters);
            setBulkProgress({ current: 1, total: 1, phase: 'Done' });
            setBulkLoading(false); setExcludedIds(new Set());
            if (response.success) {
                const modifiedCount = response.data?.modified || response.data?.nowInApprovedStatus || 0;
                setBulkApproveResult({ count: modifiedCount, excluded: excludedIdsArray?.length || 0 });
                setSuccess(response.message || `Successfully approved ${modifiedCount} assessment(s).`);
                setTimeout(async () => {
                    try { const fr = await adminCAAPI.getFilterOptions({ status }); if (fr?.success) { const n = normalizeFilterOptions(fr); if (n?.classes.length > 0) setClasses(n.classes.map(toOption).filter(Boolean)); } } catch (_) {}
                    fetchRef.current?.();
                }, 300);
            } else { setError(response.message || 'Failed to approve assessments'); fetchRef.current?.(); }
        } catch (err) {
            setBulkLoading(false); setBulkProgress({ current: 0, total: 0, phase: '' });
            setError(err.response?.data?.message || err.message || 'Failed to approve assessments');
            fetchRef.current?.();
        }
    }, [termId, sessionId, classId, subjectId, excludedIds, status]);

    const handleUnapproveAll = useCallback(async () => {
        setConfirmBulkUnapprove(false);
        setBulkLoading(true);
        setBulkProgress({ current: 0, total: 1, phase: 'Unapproving...' });
        setSuccess(''); setError('');
        const excludedIdsArray = excludedIds.size > 0 ? Array.from(excludedIds) : undefined;
        setAssessments(prev => prev.map(a => (!excludedIds.has(a._id) ? { ...a, status: 'submitted' } : a)));
        try {
            const payload = {};
            if (termId) payload.termId = termId; if (sessionId) payload.sessionId = sessionId;
            if (classId) payload.classId = classId; if (subjectId) payload.subjectId = subjectId;
            if (excludedIdsArray?.length > 0) payload.excludedIds = excludedIdsArray;
            const response = await adminCAAPI.bulkUnapprove(payload);
            setBulkProgress({ current: 1, total: 1, phase: 'Done' });
            setBulkLoading(false); setExcludedIds(new Set());
            if (response.success) {
                const modifiedCount = response.data?.modified || response.data?.nowInSubmittedStatus || 0;
                setSuccess(response.message || `Successfully unapproved ${modifiedCount} assessment(s).`);
                setTimeout(async () => {
                    try { const fr = await adminCAAPI.getFilterOptions({ status }); if (fr?.success) { const n = normalizeFilterOptions(fr); if (n?.classes.length > 0) setClasses(n.classes.map(toOption).filter(Boolean)); } } catch (_) {}
                    fetchRef.current?.();
                }, 300);
            } else { setError(response.message || 'Failed to unapprove assessments'); fetchRef.current?.(); }
        } catch (err) {
            setBulkLoading(false); setBulkProgress({ current: 0, total: 0, phase: '' });
            setError(err.response?.data?.message || err.message || 'Failed to unapprove assessments');
            fetchRef.current?.();
        }
    }, [termId, sessionId, classId, subjectId, status, excludedIds]);

    const handleClassChange = useCallback((e) => setClassId(e.target.value), []);

    // Page size change handler — resets to page 1
    const handlePageSizeChange = useCallback((e) => {
        setPageSize(Number(e.target.value));
        setCurrentPage(1);
    }, []);

    // Page navigation handler
    const goToPage = useCallback((page) => {
        if (page < 1 || page > totalPages || page === currentPage) return;
        setCurrentPage(page);
    }, [currentPage, totalPages]);

    const openClearPanel = useCallback(async () => {
        setShowClearPanel(true);
        setClearClassId(''); setClearSubjectId(''); setClearError(''); setClearSuccess('');
        setClearInfo(null); setClearClasses([]); setClearSubjects([]);
        setClearProgress({ current: 0, total: 0, phase: '' }); setClearPreview(null);
        setClearPreviewLoading(false); setClearExcludedStudents(new Set());
        setClearConfirmAction(null); setClearPreviewAssessmentIds([]); setClearClassesLoading(true);
        setPreviewExpanded(true);
        try {
            const response = await adminCAAPI.getClassesWithApproved({ termId: termId || undefined, sessionId: sessionId || undefined });
            if (response.success && Array.isArray(response.data)) {
                if (response.data.length === 0) setClearInfo({ type: 'info', message: 'No approved CA records found for the selected term/session.' });
                else { setClearClasses(response.data); setClearInfo({ type: 'success', message: `${response.data.length} class${response.data.length !== 1 ? 'es' : ''} with approved records found.` }); }
            } else setClearInfo({ type: 'error', message: response.message || 'Failed to load approved records' });
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to load approved records.';
            setClearError(msg); setClearInfo({ type: 'error', message: msg });
        } finally { setClearClassesLoading(false); }
    }, [termId, sessionId]);

    const closeClearPanel = useCallback(() => {
        if (clearLoading) return;
        setShowClearPanel(false); setClearClassId(''); setClearSubjectId(''); setClearError('');
        setClearSuccess(''); setClearInfo(null); setClearClasses([]); setClearSubjects([]);
        setClearProgress({ current: 0, total: 0, phase: '' }); setClearPreview(null);
        setClearPreviewLoading(false); setClearExcludedStudents(new Set());
        setClearConfirmAction(null); setClearPreviewAssessmentIds([]); setPreviewExpanded(true);
    }, [clearLoading]);

    const handleClearClassChange = useCallback(async (e) => {
        const newClassId = e.target.value;
        setClearClassId(newClassId); setClearSubjectId(''); setClearError(''); setClearSuccess('');
        setClearInfo(null); setClearPreview(null); setClearPreviewLoading(false);
        setClearExcludedStudents(new Set()); setClearConfirmAction(null); setClearPreviewAssessmentIds([]);
        if (newClassId) {
            setClearSubjectsLoading(true);
            try {
                const response = await adminCAAPI.getSubjectsWithApproved(newClassId, { termId: termId || undefined, sessionId: sessionId || undefined });
                if (response.success && Array.isArray(response.data)) {
                    setClearSubjects(response.data);
                    const totalRecs = response.data.reduce((s, g) => s + g.approvedRecords, 0);
                    setClearInfo({ type: 'success', message: `${response.data.length} subject${response.data.length !== 1 ? 's' : ''} with ${totalRecs} approved record${totalRecs !== 1 ? 's' : ''}. Select "Clear All" to proceed.` });
                } else { setClearSubjects([]); setClearInfo({ type: 'info', message: response.message || 'No approved subjects found for this class.' }); }
            } catch (err) {
                const msg = err.response?.data?.message || err.message || 'Failed to load subjects.';
                setClearSubjects([]); setClearError(msg); setClearInfo({ type: 'error', message: msg });
            } finally { setClearSubjectsLoading(false); }
        } else setClearSubjects([]);
    }, [termId, sessionId]);

    const loadPreview = useCallback(async (cId, sId) => {
        setClearPreviewLoading(true); setClearPreview(null); setClearExcludedStudents(new Set());
        setClearConfirmAction(null); setClearPreviewAssessmentIds([]);
        try {
            const response = await adminCAAPI.previewClearApproval({ classId: cId, subjectId: sId, termId: termId || undefined, sessionId: sessionId || undefined });
            if (response.success && response.data) {
                const { classInfo, subjectInfo, totalRecords, students } = response.data;
                setClearPreviewAssessmentIds(students.map(s => s.assessmentId || s._id).filter(Boolean));
                setClearPreview({ classInfo, subjectInfo, totalRecords, students: students.map(s => ({ studentId: s.studentId, name: s.name, admissionNumber: s.admissionNumber, totalScore: s.totalScore, grade: s.grade, assessmentId: s.assessmentId || s._id })) });
                if (students.length === 0) setClearInfo({ type: 'info', message: 'No student records found.' }); else setClearInfo(null);
            } else { setClearInfo({ type: 'error', message: response.message || 'Failed to load preview' }); setClearPreview(null); setClearPreviewAssessmentIds([]); }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to load preview.';
            setClearError(msg); setClearInfo({ type: 'error', message: msg }); setClearPreview(null); setClearPreviewAssessmentIds([]);
        } finally { setClearPreviewLoading(false); }
    }, [termId, sessionId]);

    const handleClearSubjectChange = useCallback((e) => {
        const newSubjectId = e.target.value;
        setClearSubjectId(newSubjectId); setClearError(''); setClearSuccess(''); setClearInfo(null);
        setClearPreview(null); setClearPreviewLoading(false); setClearExcludedStudents(new Set());
        setClearConfirmAction(null); setClearPreviewAssessmentIds([]); setPreviewExpanded(true);
        if (newSubjectId) loadPreview(clearClassId, newSubjectId); else setClearPreview(null);
    }, [clearClassId, loadPreview]);

    const toggleClearStudentExclusion = useCallback((studentId) => {
        setClearExcludedStudents(prev => { const next = new Set(prev); if (next.has(studentId)) next.delete(studentId); else next.add(studentId); return next; });
    }, []);

    const toggleAllClearStudentsExclusion = useCallback(() => {
        setClearExcludedStudents(prev => { if (!clearPreview) return new Set(); const allIds = clearPreview.students.map(s => s.studentId); if (prev.size === allIds.length) return new Set(); return new Set(allIds); });
    }, [clearPreview]);

    const clearClearStudentExclusions = useCallback(() => setClearExcludedStudents(new Set()), []);

    const getEffectiveClearCount = useCallback(() => {
        if (!clearPreview) return 0;
        return clearPreview.students.length - clearExcludedStudents.size;
    }, [clearPreview, clearExcludedStudents]);

    const handleConfirmClear = useCallback(async () => {
        if (!clearClassId) return;
        setClearLoading(true); setClearSuccess(''); setClearError('');
        setClearProgress({ current: 0, total: 1, phase: 'Sending request...' });
        try {
            const hasExclusions = clearExcludedStudents.size > 0 && clearExcludedStudents.size < (clearPreview?.students.length || 0);
            let response;
            if (clearSubjectId && clearPreviewAssessmentIds.length > 0 && hasExclusions) {
                const excludedAssessmentIds = clearPreview.students.filter(s => clearExcludedStudents.has(s.studentId)).map(s => s.assessmentId).filter(Boolean);
                const idsToClear = clearPreviewAssessmentIds.filter(id => !excludedAssessmentIds.includes(id));
                if (idsToClear.length === 0) { setClearLoading(false); setClearInfo({ type: 'info', message: 'No records to clear after exclusions.' }); setClearProgress({ current: 0, total: 0, phase: '' }); return; }
                response = await adminCAAPI.clearApprovalByIds(idsToClear, 'draft');
            } else if (clearSubjectId) {
                response = await adminCAAPI.clearApprovalStatus({ classId: clearClassId, subjectId: clearSubjectId || undefined, termId: termId || undefined, sessionId: sessionId || undefined, resetTo: 'draft' });
            } else {
                response = await adminCAAPI.clearApprovalStatus({ classId: clearClassId, termId: termId || undefined, sessionId: sessionId || undefined, resetTo: 'draft' });
            }
            setClearProgress({ current: 1, total: 1, phase: 'Done' });
            if (response.success) {
                const result = response.data?.result || response.data;
                const recordsAffected = result?.recordsAffected || result?.modified || result?.nowInSubmittedStatus || getEffectiveClearCount();
                setClearSuccess(clearSubjectId ? `Cleared ${recordsAffected} record${recordsAffected !== 1 ? 's' : ''} for ${result?.subjectInfo?.name || clearSubjects.find(s => s.subjectId === clearSubjectId)?.subjectName || 'subject'}` : `Cleared ${recordsAffected} record${recordsAffected !== 1 ? 's' : ''} across ${clearSubjects.length} subject${clearSubjects.length !== 1 ? 's' : ''}`);
                fetchRef.current?.();
                setTimeout(async () => {
                    try {
                        if (clearClassId) { const subRes = await adminCAAPI.getSubjectsWithApproved(clearClassId, { termId: termId || undefined, sessionId: sessionId || undefined }); if (subRes.success && Array.isArray(subRes.data)) setClearSubjects(subRes.data); }
                        if (!clearSubjectId && clearClassId) { const classRes = await adminCAAPI.getClassesWithApproved({ termId: termId || undefined, sessionId: sessionId || undefined }); if (classRes.success && Array.isArray(classRes.data)) { setClearClasses(classRes.data); if (classRes.data.length === 0) { setClearInfo({ type: 'info', message: 'All approved records cleared.' }); setClearClassId(''); setClearSubjects([]); } else { const remaining = classRes.data.reduce((sum, c) => sum + c.approvedRecords, 0); setClearInfo({ type: 'success', message: `${classRes.data.length} class${classRes.data.length !== 1 ? 'es' : ''} remaining with ${remaining} records.` }); } } }
                        if (clearSubjectId) { setClearPreview(null); setClearPreviewAssessmentIds([]); setClearExcludedStudents(new Set()); setClearSubjectId(''); }
                    } catch (err) { console.error('[refreshClearPanel]', err); }
                }, 500);
            } else setClearError(response.message || 'Failed to clear approval status');
        } catch (err) { setClearError(err.response?.data?.message || err.message || 'Failed to clear approval status.'); }
        finally { setClearLoading(false); setTimeout(() => setClearProgress({ current: 0, total: 0, phase: '' }), 800); }
    }, [clearClassId, clearSubjectId, clearSubjects, clearPreview, clearExcludedStudents, clearPreviewAssessmentIds, termId, sessionId, getEffectiveClearCount]);

    const statusTabs = [
        { value: 'submitted', label: 'Submitted' },
        { value: 'draft',     label: 'Draft' },
        { value: 'approved',  label: 'Approved' }
    ];

    const bulkLabel = bulkLoading && bulkProgress.total > 0 ? `${bulkProgress.current}/${bulkProgress.total}` : null;

    const getActiveFiltersDescription = useCallback(() => {
        const parts = [];
        if (termId) { const t = terms.find(t => t._id === termId); if (t) parts.push(t.name); }
        if (sessionId) { const s = sessions.find(s => s._id === sessionId); if (s) parts.push(s.name); }
        if (classId) { const c = classes.find(c => c._id === classId); if (c) parts.push(c.name + (c.section ? ' ' + c.section : '')); }
        if (subjectId) { const s = subjects.find(s => s._id === subjectId); if (s) parts.push(s.name); }
        return parts.length > 0 ? parts.join(' → ') : 'All';
    }, [termId, sessionId, classId, subjectId, terms, sessions, classes, subjects]);

    // Generate visible page numbers for pagination
    const visiblePages = useMemo(() => {
        const pages = [];
        const maxVisible = 7;
        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            let start = Math.max(2, currentPage - 2);
            let end = Math.min(totalPages - 1, currentPage + 2);
            if (currentPage <= 3) { start = 2; end = 5; }
            if (currentPage >= totalPages - 2) { start = totalPages - 4; end = totalPages - 1; }
            if (start > 2) pages.push('...');
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages - 1) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    }, [currentPage, totalPages]);

    // Show range text like "Showing 1-20 of 245"
    const paginationRangeText = useMemo(() => {
        if (totalResults === 0) return 'No results';
        const from = (currentPage - 1) * pageSize + 1;
        const to = Math.min(currentPage * pageSize, totalResults);
        return `Showing ${from}–${to} of ${totalResults}`;
    }, [currentPage, pageSize, totalResults]);

    return (
        <div className="aa-root">
            <style>{`
                .aa-root {
                    --bg: #f1f5f9; --surface: #ffffff; --border: #e2e8f0; --text: #0f172a; --text-secondary: #475569; --text-muted: #94a3b8;
                    --primary: #4f46e5; --primary-hover: #4338ca; --primary-light: #eef2ff;
                    --danger: #ef4444; --danger-hover: #dc2626; --success: #10b981; --success-light: #ecfdf5;
                    --warning: #f59e0b; --warning-light: #fffbeb;
                    --radius: 12px; --radius-sm: 8px;
                    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
                    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
                    --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: var(--text); -webkit-font-smoothing: antialiased; background: var(--bg); min-height: 100vh;
                }
                .aa-toasts { position: fixed; top: 16px; right: 16px; z-index: 200; display: flex; flex-direction: column; gap: 8px; pointer-events: none; max-width: 420px; }
                .aa-toast { pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500; box-shadow: var(--shadow-lg); animation: aaToastIn 0.3s cubic-bezier(0.16,1,0.3,1); line-height: 1.4; }
                .aa-toast--success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
                .aa-toast--error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
                .aa-toast svg { flex-shrink: 0; margin-top: 1px; }
                .aa-toast-content { flex: 1; }
                .aa-toast-detail { display: block; font-size: 0.78rem; opacity: 0.8; margin-top: 2px; }
                @keyframes aaToastIn { from { opacity: 0; transform: translateX(20px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
                .aa-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; position: sticky; top: 0; z-index: 30; }
                .aa-header-content { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
                .aa-header-text { display: flex; align-items: center; gap: 14px; }
                .aa-header-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--primary-light); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0; }
                .aa-title { font-size: 1.35rem; font-weight: 700; color: var(--text); margin: 0; letter-spacing: -0.02em; }
                .aa-subtitle { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; }
                .aa-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
                .aa-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; transition: all var(--transition); white-space: nowrap; line-height: 1.4; }
                .aa-btn:active { transform: scale(0.97); }
                .aa-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
                .aa-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
                .aa-btn-success { background: var(--success); color: #fff; }
                .aa-btn-success:hover { background: #059669; }
                .aa-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
                .aa-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
                .aa-btn-danger { background: var(--danger); color: #fff; }
                .aa-btn-danger:hover { background: var(--danger-hover); }
                .aa-btn-danger-outline { background: var(--surface); color: var(--danger); border: 1px solid #fecaca; }
                .aa-btn-danger-outline:hover { background: #fef2f2; border-color: #fca5a5; }
                .aa-btn-outline-secondary { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
                .aa-btn-outline-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
                .aa-btn-sm { padding: 6px 12px; font-size: 0.78rem; }
                .aa-btn-sm svg { width: 13px; height: 13px; }
                .aa-btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: aaSpin 0.6s linear infinite; flex-shrink: 0; }
                .aa-btn-spinner--sm { width: 13px; height: 13px; }
                .aa-btn-spinner--dark { border-color: rgba(0,0,0,0.12); border-top-color: var(--text-secondary); }
                @keyframes aaSpin { to { transform: rotate(360deg); } }
                .aa-exclude-cb { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 5px; border: 2px solid #cbd5e1; background: var(--surface); cursor: pointer; transition: all var(--transition); flex-shrink: 0; }
                .aa-exclude-cb:hover { border-color: #94a3b8; background: #f8fafc; }
                .aa-exclude-cb--checked { background: var(--danger); border-color: var(--danger); }
                .aa-exclude-cb--checked:hover { background: var(--danger-hover); border-color: var(--danger-hover); }
                .aa-exclude-cb--indeterminate { background: var(--danger); border-color: var(--danger); }
                .aa-exclude-cb--indeterminate:hover { background: var(--danger-hover); border-color: var(--danger-hover); }
                .aa-exclude-cb svg { width: 12px; height: 12px; color: #fff; pointer-events: none; }
                .aa-exclude-cb:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
                .aa-exclusion-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 24px; background: #fef2f2; border-bottom: 1px solid #fecaca; animation: aaSlideDown 0.25s ease; }
                .aa-exclusion-bar-inner { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #991b1b; font-weight: 500; }
                .aa-exclusion-bar-inner svg { flex-shrink: 0; }
                .aa-exclusion-bar-count { font-weight: 700; }
                .aa-exclusion-bar-actions { display: flex; gap: 6px; }
                .aa-exclusion-clear { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; border: 1px solid #fecaca; background: var(--surface); color: #991b1b; font-size: 0.76rem; font-weight: 600; cursor: pointer; transition: all var(--transition); }
                .aa-exclusion-clear:hover { background: #fee2e2; border-color: #fca5a5; }
                .aa-exclusion-clear svg { width: 12px; height: 12px; }
                .aa-filters { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 24px; }
                .aa-status-tabs { display: flex; gap: 4px; margin-bottom: 14px; background: #f1f5f9; border-radius: var(--radius-sm); padding: 3px; width: fit-content; }
                .aa-status-tab { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 6px; border: none; background: none; font-size: 0.82rem; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all var(--transition); }
                .aa-status-tab:hover { color: var(--text-secondary); }
                .aa-status-tab--active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
                .aa-status-tab-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); transition: background var(--transition); }
                .aa-filter-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
                .aa-filter-field { display: flex; flex-direction: column; gap: 5px; }
                .aa-filter-field label { font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 6px; }
                .aa-subject-loading { display: inline-flex; align-items: center; }
                .aa-mini-spinner { width: 12px; height: 12px; border: 2px solid #e2e8f0; border-top-color: var(--primary); border-radius: 50%; animation: aaSpin 0.6s linear infinite; display: inline-block; }
                .aa-select-wrap { position: relative; }
                .aa-select-wrap svg { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
                .aa-select { width: 100%; padding: 10px 36px 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; -webkit-appearance: none; appearance: none; font-family: inherit; cursor: pointer; }
                .aa-select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
                .aa-select:disabled { background: #f8fafc; color: var(--text-muted); cursor: not-allowed; }
                .aa-select option { color: var(--text); background: var(--surface); }
                .aa-filter-hint { display: flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 0.78rem; color: var(--text-muted); }
                .aa-filter-hint svg { flex-shrink: 0; }
                .aa-filter-options-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; background: var(--primary-light); color: var(--primary); font-size: 0.68rem; font-weight: 600; text-transform: none; letter-spacing: 0; }
                .aa-bulk-confirm { display: flex; flex-direction: column; gap: 10px; padding: 14px 24px; background: var(--warning-light); border-bottom: 1px solid #fde68a; animation: aaSlideDown 0.25s ease; }
                .aa-bulk-confirm--unapprove { background: #fef2f2; border-bottom-color: #fecaca; }
                .aa-bulk-confirm-inner { display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #92400e; }
                .aa-bulk-confirm--unapprove .aa-bulk-confirm-inner { color: #991b1b; }
                .aa-bulk-confirm-note { display: block; font-size: 0.78rem; color: #a16207; font-weight: 400; margin-top: 2px; }
                .aa-bulk-confirm--unapprove .aa-bulk-confirm-note { color: #b91c1c; }
                .aa-bulk-confirm-scope { display: flex; align-items: center; gap: 6px; font-size: 0.76rem; color: #78716c; font-weight: 500; }
                .aa-bulk-confirm-scope-code { padding: 2px 8px; background: rgba(0,0,0,0.05); border-radius: 4px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.72rem; color: #57534e; }
                .aa-bulk-confirm-server-note { display: flex; align-items: center; gap: 6px; font-size: 0.72rem; color: #059669; font-weight: 500; }
                .aa-bulk-confirm-server-note svg { flex-shrink: 0; }
                .aa-bulk-confirm-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
                .aa-bulk-confirm-actions { display: flex; gap: 8px; }
                .aa-results-info { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; font-size: 0.82rem; color: var(--text-muted); }
                .aa-results-count strong { color: var(--text-secondary); font-weight: 700; }
                .aa-results-status { font-weight: 600; }
                .aa-approved-summary { padding: 10px 24px; background: var(--success-light); border-bottom: 1px solid #a7f3d0; animation: aaSlideDown 0.25s ease; }
                .aa-approved-summary-notice { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 600; color: #065f46; margin-bottom: 6px; }
                .aa-approved-summary-notice svg { flex-shrink: 0; }
                .aa-approved-summary-terms { display: flex; flex-wrap: wrap; gap: 6px; }
                .aa-approved-term-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 20px; background: var(--surface); border: 1px solid #a7f3d0; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
                .aa-approved-term-chip-count { font-weight: 700; color: var(--primary); }
                .aa-table-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 80px 24px; color: var(--text-muted); font-size: 0.88rem; }
                .aa-inline-loader { display: flex; gap: 6px; }
                .aa-loader-ring { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); opacity: 0.3; animation: aaBounce 1.2s ease-in-out infinite; }
                .aa-loader-ring:nth-child(2) { animation-delay: 0.15s; }
                .aa-loader-ring:nth-child(3) { animation-delay: 0.3s; }
                @keyframes aaBounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }
                .aa-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; text-align: center; color: var(--text-muted); }
                .aa-empty-illustration { width: 72px; height: 72px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #cbd5e1; }
                .aa-empty h3 { font-size: 1.05rem; font-weight: 700; color: var(--text-secondary); margin: 0 0 6px; }
                .aa-empty p { font-size: 0.85rem; margin: 0; max-width: 340px; line-height: 1.5; }
                .aa-table-section { background: var(--surface); min-height: 200px; }
                .aa-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .aa-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 920px; }
                .aa-table--with-terms { min-width: 1120px; }
                .aa-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 5; }
                .aa-table th { padding: 12px 16px; text-align: left; font-weight: 600; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
                .aa-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                .aa-table tbody tr { transition: background var(--transition), opacity var(--transition); animation: aaRowIn 0.3s ease both; }
                .aa-table tbody tr:hover { background: #f8fafc; }
                .aa-table tbody tr.aa-row-excluded { opacity: 0.45; }
                .aa-table tbody tr.aa-row-excluded:hover { background: #fef2f2; }
                .aa-table tbody tr:last-child td { border-bottom: none; }
                @keyframes aaRowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
                .aa-th-exclude { width: 48px; text-align: center; }
                .aa-td-exclude { text-align: center; }
                .aa-th-exclude-label { display: flex; align-items: center; gap: 8px; justify-content: center; }
                .aa-th-exclude-text { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
                .aa-th-score, .aa-th-total { text-align: center; }
                .aa-th-max { font-weight: 400; color: var(--text-muted); font-size: 0.68rem; margin-left: 2px; }
                .aa-th-action { width: 110px; text-align: right; }
                .aa-td-student { display: flex; flex-direction: column; gap: 2px; }
                .aa-student-name { font-weight: 600; font-size: 0.9rem; color: var(--text); line-height: 1.3; }
                .aa-student-id { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; }
                .aa-td-score { text-align: center; font-weight: 600; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
                .aa-td-total { text-align: center; }
                .aa-total-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; padding: 4px 10px; border-radius: 6px; background: #f1f5f9; font-weight: 700; font-size: 0.92rem; color: var(--text); font-variant-numeric: tabular-nums; }
                .aa-td-action { text-align: right; }
                .aa-grade-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; padding: 3px 10px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; font-variant-numeric: tabular-nums; }
                .aa-status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
                .aa-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
                .aa-tag { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; white-space: nowrap; }
                .aa-tag--class { background: #f1f5f9; color: var(--text-secondary); }
                .aa-tag--class svg { color: var(--text-muted); }
                .aa-tag--term { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
                .aa-tag--session { background: #faf5ff; color: #7c3aed; border: 1px solid #ddd6fe; }
                .aa-subject-name { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
                .aa-approve-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 6px; border: 1px solid #a7f3d0; background: #ecfdf5; color: #065f46; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all var(--transition); }
                .aa-approve-btn:hover { background: #d1fae5; transform: translateY(-1px); box-shadow: var(--shadow-sm); }
                .aa-approve-btn:active { transform: scale(0.97); }
                .aa-approve-btn svg { width: 13px; height: 13px; }
                .aa-unapprove-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 6px; border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all var(--transition); }
                .aa-unapprove-btn:hover { background: #fee2e2; transform: translateY(-1px); box-shadow: var(--shadow-sm); }
                .aa-unapprove-btn:active { transform: scale(0.97); }
                .aa-unapprove-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
                .aa-unapprove-btn svg { width: 13px; height: 13px; }
                .aa-draft-label { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; font-style: italic; }
                .aa-cards { display: none; flex-direction: column; gap: 10px; padding: 12px 16px; }
                .aa-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; transition: box-shadow var(--transition), opacity var(--transition); animation: aaRowIn 0.3s ease both; }
                .aa-card:active { box-shadow: var(--shadow); }
                .aa-card.aa-card-excluded { opacity: 0.45; border-color: #fecaca; }
                .aa-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
                .aa-card-top-left { display: flex; align-items: flex-start; gap: 10px; min-width: 0; flex: 1; }
                .aa-card-student { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
                .aa-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
                .aa-card-scores { display: flex; align-items: center; gap: 0; background: #f8fafc; border-radius: var(--radius-sm); padding: 12px; margin-bottom: 14px; overflow-x: auto; }
                .aa-score-block { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 12px; min-width: 60px; }
                .aa-score-block--total { padding-left: 14px; border-left: 1px solid var(--border); margin-left: 4px; }
                .aa-score-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
                .aa-score-value { font-size: 1.1rem; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
                .aa-score-value--total { color: var(--primary); }
                .aa-score-max { font-size: 0.72rem; font-weight: 500; color: var(--text-muted); margin-left: 1px; }
                .aa-score-divider { color: var(--border); padding: 0 2px; flex-shrink: 0; }
                .aa-grade-badge--card { margin-left: auto; align-self: center; }
                .aa-card-action { display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border); }
                .aa-card-action .aa-approve-btn, .aa-card-action .aa-unapprove-btn { flex: 1; justify-content: center; padding: 9px 12px; }
                .aa-card-term-session { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 0.76rem; color: var(--text-muted); }
                .aa-card-term-session-sep { width: 1px; height: 12px; background: var(--border); }
                @keyframes aaSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

                /* ===== PAGINATION STYLES ===== */
                .aa-pagination-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: var(--surface); border-top: 1px solid var(--border); gap: 16px; flex-wrap: wrap; }
                .aa-pagination-left { display: flex; align-items: center; gap: 12px; }
                .aa-pagination-range { font-size: 0.82rem; color: var(--text-muted); font-weight: 500; white-space: nowrap; }
                .aa-pagination-range strong { color: var(--text-secondary); font-weight: 700; }
                .aa-page-size-select { display: flex; align-items: center; gap: 6px; }
                .aa-page-size-select label { font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
                .aa-page-size-select .aa-select { width: auto; min-width: 72px; padding: 6px 30px 6px 10px; font-size: 0.82rem; }
                .aa-page-size-select .aa-select-wrap svg { right: 8px; }
                .aa-pagination-controls { display: flex; align-items: center; gap: 4px; }
                .aa-page-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 34px; padding: 0 8px; border-radius: 6px; border: 1px solid transparent; background: none; font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: all var(--transition); white-space: nowrap; }
                .aa-page-btn:hover:not(:disabled):not(.aa-page-btn--active) { background: #f1f5f9; border-color: var(--border); }
                .aa-page-btn:active:not(:disabled) { transform: scale(0.95); }
                .aa-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
                .aa-page-btn--active { background: var(--primary); color: #fff; border-color: var(--primary); }
                .aa-page-btn--active:hover { background: var(--primary-hover); }
                .aa-page-btn--ellipsis { border: none; color: var(--text-muted); cursor: default; min-width: 28px; }
                .aa-page-btn--ellipsis:hover { background: none; border-color: transparent; }
                .aa-page-btn svg { width: 14px; height: 14px; }

                .aa-clear-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; animation: aaOverlayIn 0.2s ease; }
                .aa-clear-modal { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); width: 90%; max-width: 600px; max-height: 85vh; overflow-y: auto; display: flex; flex-direction: column; animation: aaModalIn 0.3s cubic-bezier(0.16,1,0.3,1); }
                @keyframes aaOverlayIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes aaModalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .aa-clear-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); }
                .aa-clear-header-left { display: flex; align-items: center; gap: 12px; }
                .aa-clear-header-icon { width: 40px; height: 40px; border-radius: 10px; background: #fef2f2; display: flex; align-items: center; justify-content: center; color: var(--danger); flex-shrink: 0; }
                .aa-clear-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
                .aa-clear-subtitle { font-size: 0.78rem; color: var(--text-muted); margin: 2px 0 0; }
                .aa-close-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: none; cursor: pointer; transition: all var(--transition); color: var(--text-muted); }
                .aa-close-btn:hover { background: #f1f5f9; color: var(--text); }
                .aa-close-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .aa-close-btn svg { width: 16px; height: 16px; }
                .aa-clear-body { padding: 20px 24px; }
                .aa-clear-context { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 16px; flex-wrap: wrap; }
                .aa-clear-context-label { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
                .aa-clear-context-value { font-size: 0.84rem; font-weight: 600; color: var(--text-secondary); }
                .aa-clear-context-sep { width: 1px; height: 16px; background: var(--border); }
                .aa-clear-desc { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px; }
                .aa-clear-desc strong { color: var(--text); }
                .aa-clear-steps { display: flex; flex-direction: column; gap: 16px; }
                .aa-clear-step { display: flex; align-items: flex-start; gap: 12px; }
                .aa-clear-step-number { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-size: 0.82rem; font-weight: 700; flex-shrink: 0; }
                .aa-clear-step-content { flex: 1; min-width: 0; }
                .aa-clear-select-label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; display: block; }
                .aa-select-wrap--clear { position: relative; }
                .aa-select--clear { width: 100%; padding: 10px 36px 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; -webkit-appearance: none; appearance: none; font-family: inherit; cursor: pointer; }
                .aa-select--clear:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
                .aa-select--clear:disabled { background: #f8fafc; color: var(--text-muted); cursor: not-allowed; }
                .aa-select--clear option { color: var(--text); background: var(--surface); }
                .aa-select-wrap--clear svg { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
                .aa-info-banner { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 16px; }
                .aa-info-banner svg { flex-shrink: 0; }
                .aa-info-banner--success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
                .aa-info-banner--error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
                .aa-info-banner--info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
                .aa-info-banner-text { font-size: 0.82rem; font-weight: 500; flex: 1; }
                .aa-clear-subjects-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
                .aa-clear-subject-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-sm); }
                .aa-clear-subject-name { font-size: 0.88rem; font-weight: 600; color: var(--text); }
                .aa-clear-subject-count { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); background: var(--surface); padding: 3px 10px; border-radius: 20px; border: 1px solid var(--border); }
                .aa-clear-confirm-bar { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); margin-top: 16px; }
                .aa-clear-confirm-inner { display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #991b1b; font-weight: 600; }
                .aa-clear-confirm-detail { font-size: 0.78rem; color: #b91c1c; font-weight: 400; margin-top: 4px; display: flex; align-items: center; gap: 6px; }
                .aa-clear-confirm-actions { display: flex; gap: 8px; margin-top: 4px; }
                .aa-clear-progress { margin-top: 16px; }
                .aa-clear-progress-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
                .aa-clear-progress-phase { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
                .aa-clear-progress-count { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); }
                .aa-progress-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
                .aa-progress-fill { height: 100%; background: var(--danger); border-radius: 4px; transition: width 0.4s ease; }
                .aa-preview-section { border: 1px solid var(--border); border-radius: var(--radius-sm); margin-top: 16px; overflow: hidden; }
                .aa-preview-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid var(--border); cursor: pointer; }
                .aa-preview-header:hover { background: #f1f5f9; }
                .aa-preview-header-left { display: flex; align-items: center; gap: 8px; }
                .aa-preview-header-title { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
                .aa-preview-header-count { font-size: 0.78rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 3px 10px; border-radius: 20px; }
                .aa-preview-chevron { width: 16px; height: 16px; color: var(--text-muted); transition: transform 0.2s ease; flex-shrink: 0; }
                .aa-preview-chevron--open { transform: rotate(180deg); }
                .aa-preview-list { max-height: 200px; overflow-y: auto; }
                .aa-preview-list--collapsed { max-height: 0; overflow: hidden; }
                .aa-preview-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--border); transition: background 0.15s ease; }
                .aa-preview-row:last-child { border-bottom: none; }
                .aa-preview-row:hover { background: #f1f5f9; }
                .aa-preview-row-excluded { opacity: 0.4; }
                .aa-preview-row-excluded .aa-preview-name { text-decoration: line-through; }
                .aa-preview-cb { flex-shrink: 0; }
                .aa-preview-name { flex: 1; min-width: 0; font-size: 0.88rem; color: var(--text); font-weight: 500; }
                .aa-preview-adm { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; margin-left: auto; }
                .aa-preview-score { font-size: 0.88rem; font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums; min-width: 40px; text-align: center; }
                .aa-preview-grade { font-size: 0.78rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; text-align: center; }
                .aa-preview-exclude-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; transition: all var(--transition); color: var(--text-muted); flex-shrink: 0; }
                .aa-preview-exclude-btn:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }
                .aa-preview-exclude-btn--excluded { background: #fef2f2; border-color: #ef4444; color: #ef4444; }
                .aa-preview-exclude-btn svg { width: 14px; height: 14px; }
                .aa-preview-loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 32px 16px; color: var(--text-muted); font-size: 0.84rem; }
                @media (min-width: 768px) {
                    .aa-cards { display: none !important; }
                    .aa-table-section { display: block !important; }
                }
                @media (max-width: 767px) {
                    .aa-cards { display: flex !important; }
                    .aa-table-section { display: none !important; }
                    .aa-header { padding: 16px; }
                    .aa-header-content { flex-direction: column; align-items: flex-start; }
                    .aa-header-actions { width: 100%; }
                    .aa-header-actions .aa-btn { flex: 1; justify-content: center; padding: 10px 10px; font-size: 0.78rem; }
                    .aa-title { font-size: 1.15rem; }
                    .aa-header-icon { width: 38px; height: 38px; border-radius: 10px; }
                    .aa-filters { padding: 14px 16px; }
                    .aa-status-tabs { width: 100%; }
                    .aa-status-tab { flex: 1; justify-content: center; padding: 8px 10px; font-size: 0.78rem; }
                    .aa-filter-row { grid-template-columns: 1fr 1fr; gap: 10px; }
                    .aa-exclusion-bar { padding: 10px 16px; flex-direction: column; align-items: flex-start; gap: 8px; }
                    .aa-exclusion-bar-actions { width: 100%; }
                    .aa-exclusion-clear { flex: 1; justify-content: center; }
                    .aa-bulk-confirm { padding: 12px 16px; }
                    .aa-bulk-confirm-row { flex-direction: column; align-items: stretch; }
                    .aa-bulk-confirm-actions { width: 100%; }
                    .aa-bulk-confirm-actions .aa-btn-sm { flex: 1; justify-content: center; }
                    .aa-approved-summary { padding: 10px 16px; }
                    .aa-approved-summary-terms { gap: 4px; }
                    .aa-approved-term-chip { font-size: 0.72rem; padding: 3px 8px; }
                    .aa-clear-modal { max-width: 95%; max-height: 85vh; }
                    .aa-clear-header { padding: 16px 20px; }
                    .aa-clear-body { padding: 16px 20px; }
                    .aa-clear-steps { gap: 14px; }
                    .aa-clear-confirm-actions { flex-direction: column; }
                    .aa-clear-confirm-actions .aa-btn-sm { width: 100%; justify-content: center; }
                    .aa-preview-section { margin-top: 12px; }
                    .aa-preview-header { padding: 10px 16px; }
                    .aa-preview-list { max-height: 180px; }
                    .aa-bulk-confirm-scope { flex-wrap: wrap; }
                    .aa-pagination-bar { padding: 10px 16px; flex-direction: column; align-items: stretch; gap: 10px; }
                    .aa-pagination-left { flex-direction: column; align-items: stretch; gap: 8px; }
                    .aa-pagination-controls { justify-content: center; flex-wrap: wrap; }
                    .aa-results-info { padding: 10px 16px; }
                }
            `}</style>

            {/* Toasts */}
            <div className="aa-toasts">
                {error && (
                    <div className="aa-toast aa-toast--error" key={`err-${Date.now()}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                        <span className="aa-toast-content">{error}</span>
                    </div>
                )}
                {success && (
                    <div className="aa-toast aa-toast--success" key={`suc-${Date.now()}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span className="aa-toast-content">
                            {success}
                            {bulkApproveResult && (
                                <span className="aa-toast-detail">
                                    {bulkApproveResult.excluded > 0 ? `${bulkApproveResult.count} approved, ${bulkApproveResult.excluded} excluded` : `${bulkApproveResult.count} total records approved`}
                                </span>
                            )}
                        </span>
                    </div>
                )}
                {clearSuccess && (
                    <div className="aa-toast aa-toast--success" key={`clr-${Date.now()}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span className="aa-toast-content">{clearSuccess}</span>
                    </div>
                )}
            </div>

            {/* Header */}
            <header className="aa-header">
                <div className="aa-header-content">
                    <div className="aa-header-text">
                        <div className="aa-header-icon">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 10-10V5l-8-3-8 3v7c0 6 8 10 10"/><polyline points="9 12 11 14 10"/></svg>
                        </div>
                        <div>
                            <h1 className="aa-title">Approve Assessments</h1>
                            <p className="aa-subtitle">Review and approve student score entries</p>
                        </div>
                    </div>
                    <div className="aa-header-actions">
                        {effectivePendingCount > 0 && (
                            <button className="aa-btn aa-btn-success" onClick={() => setConfirmBulk(true)} disabled={bulkLoading}>
                                {bulkLoading ? (<><div className="aa-btn-spinner" />{bulkLabel || 'Processing...'}</>) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                )}
                                {!bulkLoading && `Approve All (${effectivePendingCount})`}
                            </button>
                        )}
                        {effectiveApprovedCount > 0 && (
                            <button className="aa-btn aa-btn-danger-outline" onClick={() => setConfirmBulkUnapprove(true)} disabled={bulkLoading}>
                                {bulkLoading ? (<><div className="aa-btn-spinner aa-btn-spinner--dark" />{bulkLabel || 'Processing...'}</>) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M9 9l6 6"/></svg>
                                )}
                                {!bulkLoading && `Unapprove All (${effectiveApprovedCount})`}
                            </button>
                        )}
                        <button className="aa-btn aa-btn-danger" onClick={openClearPanel} disabled={loading}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                            Clear Approval
                        </button>
                    </div>
                </div>
            </header>

            {/* Clear Approval Modal — unchanged from original */}
            {showClearPanel && (
                <div className="aa-clear-overlay" onClick={closeClearPanel}>
                    <div className="aa-clear-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="aa-clear-header">
                            <div className="aa-clear-header-left">
                                <div className="aa-clear-header-icon">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                                </div>
                                <div>
                                    <h2 className="aa-clear-title">Clear Approval Status</h2>
                                    <p className="aa-clear-subtitle">Unapprove records so teachers can edit</p>
                                </div>
                            </div>
                            <button className="aa-close-btn" onClick={closeClearPanel} disabled={clearLoading}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div className="aa-clear-body">
                            <div className="aa-clear-context">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="10" x2="16" y2="10"/></svg>
                                <span className="aa-clear-context-label">Scope:</span>
                                <span className="aa-clear-context-value">{activeTermName || 'All Terms'}{activeSessionName && (<><span className="aa-clear-context-sep" /><span className="aa-clear-context-value">{activeSessionName}</span></>)}</span>
                            </div>
                            <p className="aa-clear-desc"><strong>This will unapprove assessments</strong> so teachers can modify scores. Select a class, then choose to clear a specific subject or all subjects at once.</p>
                            {clearInfo && (
                                <div className={`aa-info-banner aa-info-banner--${clearInfo.type === 'error' ? 'error' : clearInfo.type === 'info' ? 'info' : 'success'}`}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {clearInfo.type === 'error' ? (<><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></>) : clearInfo.type === 'info' ? (<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12.01" y2="8"/></>) : (<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>)}
                                    </svg>
                                    <span className="aa-info-banner-text">{clearInfo.message}</span>
                                </div>
                            )}
                            {clearError && (
                                <div className="aa-info-banner aa-info-banner--error">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                                    <span className="aa-info-banner-text">{clearError}</span>
                                </div>
                            )}
                            <div className="aa-clear-steps">
                                <div className="aa-clear-step">
                                    <div className="aa-clear-step-number">1</div>
                                    <div className="aa-clear-step-content">
                                        <label className="aa-clear-select-label">Select Class</label>
                                        <div className="aa-select-wrap--clear">
                                            <select className="aa-select aa-select--clear" value={clearClassId} onChange={handleClearClassChange} disabled={clearClassesLoading || clearLoading || clearClasses.length === 0}>
                                                <option value="">{clearClassesLoading ? 'Loading...' : '-- Select a class --'}</option>
                                                {clearClasses.map(c => (<option key={c.classId} value={c.classId}>{c.className} — {c.approvedRecords} rec, {c.uniqueSubjects} subj</option>))}
                                            </select>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                        </div>
                                    </div>
                                </div>
                                {clearClassId && (
                                    <div className="aa-clear-step">
                                        <div className="aa-clear-step-number">2</div>
                                        <div className="aa-clear-step-content">
                                            <label className="aa-clear-select-label">Select Subject (Optional)</label>
                                            <div className="aa-select-wrap--clear">
                                                <select className="aa-select aa-select--clear" value={clearSubjectId} onChange={handleClearSubjectChange} disabled={clearLoading || clearSubjects.length === 0}>
                                                    <option value="">-- Clear all subjects in class --</option>
                                                    {clearSubjects.map(s => (<option key={s.subjectId} value={s.subjectId}>{s.subjectName} — {s.approvedRecords} records</option>))}
                                                </select>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {!clearSubjectId && clearClassId && clearSubjects.length > 0 && !clearPreviewLoading && !clearPreview && !clearLoading && (
                                    <div className="aa-clear-confirm-bar">
                                        <div className="aa-clear-confirm-inner">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 1-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                            <span>Clear all approved records for <strong>{clearClasses.find(c => c.classId === clearClassId)?.className || 'this class'}</strong>?</span>
                                        </div>
                                        <div className="aa-clear-confirm-detail">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="16" y2="12"/></svg>
                                            {clearSubjects.length} subject{clearSubjects.length !== 1 ? 's' : ''} will be affected — records revert to draft
                                        </div>
                                        <div className="aa-clear-confirm-actions">
                                            <button className="aa-btn aa-btn-outline-secondary aa-btn-sm" onClick={() => setClearClassId('')} disabled={clearLoading}>Cancel</button>
                                            <button className="aa-btn aa-btn-danger aa-btn-sm" onClick={handleConfirmClear} disabled={clearLoading}>
                                                {clearLoading ? (<><div className="aa-btn-spinner" />Clearing...</>) : (<><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>Clear All Subjects</>)}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {clearSubjectId && clearPreviewLoading && (
                                    <div className="aa-preview-loading"><div className="aa-btn-spinner aa-btn-spinner--dark" /><span>Loading preview...</span></div>
                                )}
                                {clearSubjectId && clearPreview && !clearPreviewLoading && (
                                    <div className="aa-preview-section">
                                        <div className="aa-preview-header" onClick={() => setPreviewExpanded(prev => !prev)}>
                                            <div className="aa-preview-header-left">
                                                <span className="aa-preview-header-title">Preview Affected Students</span>
                                                <span className="aa-preview-header-count">{getEffectiveClearCount()} student{getEffectiveClearCount() !== 1 ? 's' : ''}</span>
                                            </div>
                                            <svg className={`aa-preview-chevron ${previewExpanded ? 'aa-preview-chevron--open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                        </div>
                                        <div className={`aa-preview-list ${previewExpanded ? '' : 'aa-preview-list--collapsed'}`}>
                                            {clearPreview.students.map((student) => (
                                                <div key={student.studentId} className={`aa-preview-row ${clearExcludedStudents.has(student.studentId) ? 'aa-preview-row-excluded' : ''}`}>
                                                    <div className="aa-preview-cb"><ExcludeCheckbox checked={clearExcludedStudents.has(student.studentId)} onChange={() => toggleClearStudentExclusion(student.studentId)} /></div>
                                                    <span className="aa-preview-name">{student.name}</span>
                                                    <span className="aa-preview-adm">{student.admissionNumber}</span>
                                                    <span className="aa-preview-score">{student.totalScore}</span>
                                                    <span className="aa-preview-grade" style={{ backgroundColor: getGradeBg(student.grade), color: getGradeColor(student.grade) }}>{student.grade}</span>
                                                    <button className={`aa-preview-exclude-btn ${clearExcludedStudents.has(student.studentId) ? 'aa-preview-exclude-btn--excluded' : ''}`} onClick={() => toggleClearStudentExclusion(student.studentId)} title={clearExcludedStudents.has(student.studentId) ? 'Include' : 'Exclude'}>
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            {clearExcludedStudents.has(student.studentId) ? (<><line x1="5" y1="12" x2="19" y2="12"/><line x1="12" y1="5" x2="12" y2="19"/></>) : (<line x1="12" y1="5" x2="12" y2="19"/>)}
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        {clearExcludedStudents.size > 0 && (
                                            <div className="aa-exclusion-bar" style={{ borderBottom: '1px solid #fecaca' }}>
                                                <div className="aa-exclusion-bar-inner">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                                    <span><span className="aa-exclusion-bar-count">{clearExcludedStudents.size}</span> student{clearExcludedStudents.size !== 1 ? 's' : ''} will not be cleared</span>
                                                </div>
                                                <div className="aa-exclusion-bar-actions">
                                                    <button className="aa-exclusion-clear" onClick={clearClearStudentExclusions}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/></svg>Include All</button>
                                                </div>
                                            </div>
                                        )}
                                        {clearPreview && getEffectiveClearCount() > 0 && !clearLoading && (
                                            <div className="aa-clear-confirm-bar">
                                                <div className="aa-clear-confirm-inner">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 1-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                                    <span>Clear <strong>{getEffectiveClearCount()}</strong> record{getEffectiveClearCount() !== 1 ? 's' : ''}?</span>
                                                </div>
                                                <div className="aa-clear-confirm-detail">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="16" y2="12"/></svg>
                                                    Records will revert to draft status
                                                </div>
                                                <div className="aa-clear-confirm-actions">
                                                    <button className="aa-btn aa-btn-outline-secondary aa-btn-sm" onClick={() => { setClearConfirmAction(null); setClearSubjectId(''); setClearPreview(null); setClearPreviewAssessmentIds([]); }} disabled={clearLoading}>Back</button>
                                                    <button className="aa-btn aa-btn-danger aa-btn-sm" onClick={handleConfirmClear} disabled={clearLoading}>
                                                        {clearLoading ? (<><div className="aa-btn-spinner" />Clearing...</>) : (<><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>Clear{clearSubjectId ? ` ${clearSubjects.find(s => s.subjectId === clearSubjectId)?.subjectName || 'Subject'}` : ' All Subjects'}</>)}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {clearLoading && (
                                            <div className="aa-clear-progress">
                                                <div className="aa-clear-progress-header"><span className="aa-clear-progress-phase">{clearProgress.phase || 'Processing...'}</span><span className="aa-clear-progress-count">{clearProgress.current}/{clearProgress.total}</span></div>
                                                <div className="aa-progress-bar"><div className="aa-progress-fill" style={{ width: `${clearProgress.total > 0 ? (clearProgress.current / clearProgress.total) * 100 : 0}%` }}></div></div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="aa-filters">
                <div className="aa-status-tabs">
                    {statusTabs.map(tab => {
                        const meta = getStatusMeta(tab.value);
                        const isActive = status === tab.value;
                        return (
                            <button key={tab.value} className={`aa-status-tab ${isActive ? 'aa-status-tab--active' : ''}`} onClick={() => setStatus(tab.value)} disabled={filterOptionsLoading}>
                                <span className="aa-status-tab-dot" style={isActive ? { background: meta.dot } : undefined} />
                                {tab.label}
                                {filterOptionsLoading && isActive && <span className="aa-mini-spinner" style={{ width: 10, height: 10, marginLeft: 4 }} />}
                            </button>
                        );
                    })}
                </div>
                <div className="aa-filter-row">
                    <div className="aa-filter-field">
                        <label htmlFor="aa-term">Term{status === 'approved' && !termId && (<span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#059669', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>)}{filterOptionsSourceRef.current === 'filterOptions' && (<span className="aa-filter-options-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 10-10V5l-8-3-8 3v7c0 6 8 10 10"/></svg>filtered</span>)}</label>
                        <div className="aa-select-wrap">
                            <select id="aa-term" value={termId} onChange={(e) => setTermId(e.target.value)} className="aa-select" disabled={filterOptionsLoading}>
                                <option value="">{filterOptionsLoading ? 'Loading...' : 'All Terms'}</option>
                                {terms.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                    <div className="aa-filter-field">
                        <label htmlFor="aa-session">Session{status === 'approved' && !sessionId && (<span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#059669', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>)}</label>
                        <div className="aa-select-wrap">
                            <select id="aa-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="aa-select" disabled={filterOptionsLoading}>
                                <option value="">{filterOptionsLoading ? 'Loading...' : 'All Sessions'}</option>
                                {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                    <div className="aa-filter-field">
                        <label htmlFor="aa-class">Class</label>
                        <div className="aa-select-wrap">
                            <select id="aa-class" value={classId} onChange={handleClassChange} className="aa-select" disabled={filterOptionsLoading}>
                                <option value="">{filterOptionsLoading ? 'Loading...' : 'All Classes'}</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name}{c.section ? ` ${c.section}` : ''}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                    <div className="aa-filter-field">
                        <label htmlFor="aa-subject">Subject{subjectsLoading && <span className="aa-subject-loading"><span className="aa-mini-spinner" /></span>}</label>
                        <div className="aa-select-wrap">
                            <select id="aa-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="aa-select" disabled={(!classId && subjects.length === 0) || filterOptionsLoading}>
                                <option value="">{subjectsLoading ? 'Loading...' : 'All Subjects'}</option>
                                {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                </div>
                {!classId && (
                    <div className="aa-filter-hint">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12.01" y2="8"/></svg>
                        <span>Select a class to filter by subject</span>
                    </div>
                )}
            </div>

            {/* Exclusion Bar */}
            {excludedIds.size > 0 && (
                <div className="aa-exclusion-bar">
                    <div className="aa-exclusion-bar-inner">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        <span><span className="aa-exclusion-bar-count">{excludedIds.size}</span> student{excludedIds.size !== 1 ? 's' : ''} excluded from bulk actions</span>
                    </div>
                    <div className="aa-exclusion-bar-actions">
                        <button className="aa-exclusion-clear" onClick={clearExclusions}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/></svg>Clear</button>
                    </div>
                </div>
            )}

            {/* Bulk Approve Confirm */}
            {confirmBulk && (
                <div className="aa-bulk-confirm">
                    <div className="aa-bulk-confirm-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 1-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span>Approve all submitted assessments matching current filters?{excludedIds.size > 0 && <span className="aa-bulk-confirm-note">{excludedIds.size} excluded</span>}</span>
                    </div>
                    <div className="aa-bulk-confirm-scope"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Scope: <span className="aa-bulk-confirm-scope-code">{getActiveFiltersDescription()}</span></div>
                    <div className="aa-bulk-confirm-server-note"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 10-10V5l-8-3-8 3v7c0 6 8 10 10"/></svg>Server-side: approves all matching records</div>
                    <div className="aa-bulk-confirm-row">
                        <span style={{ fontSize: '0.82rem', color: '#78716c' }}>Showing {effectivePendingCount} on this page — server will process all matches</span>
                        <div className="aa-bulk-confirm-actions">
                            <button className="aa-btn aa-btn-ghost aa-btn-sm" onClick={() => setConfirmBulk(false)} disabled={bulkLoading}>Cancel</button>
                            <button className="aa-btn aa-btn-success aa-btn-sm" onClick={handleApproveAll} disabled={bulkLoading}>{bulkLoading ? <><div className="aa-btn-spinner" />Approving...</> : 'Confirm Approve All'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Unapprove Confirm */}
            {confirmBulkUnapprove && (
                <div className="aa-bulk-confirm aa-bulk-confirm--unapprove">
                    <div className="aa-bulk-confirm-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 1-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span>Unapprove all approved assessments matching current filters?{excludedIds.size > 0 && <span className="aa-bulk-confirm-note">{excludedIds.size} excluded</span>}</span>
                    </div>
                    <div className="aa-bulk-confirm-scope"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Scope: <span className="aa-bulk-confirm-scope-code">{getActiveFiltersDescription()}</span></div>
                    <div className="aa-bulk-confirm-server-note" style={{ color: '#991b1b' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 10-10V5l-8-3-8 3v7c0 6 8 10 10"/></svg>Server-side: unapproves all matching records</div>
                    <div className="aa-bulk-confirm-row">
                        <span style={{ fontSize: '0.82rem', color: '#78716c' }}>Showing {effectiveApprovedCount} on this page — server will process all matches</span>
                        <div className="aa-bulk-confirm-actions">
                            <button className="aa-btn aa-btn-ghost aa-btn-sm" onClick={() => setConfirmBulkUnapprove(false)} disabled={bulkLoading}>Cancel</button>
                            <button className="aa-btn aa-btn-danger-outline aa-btn-sm" onClick={handleUnapproveAll} disabled={bulkLoading}>{bulkLoading ? <><div className="aa-btn-spinner aa-btn-spinner--dark" />Unapproving...</> : 'Confirm Unapprove All'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {(loading || filterOptionsLoading) && assessments.length === 0 ? (
                <div className="aa-table-loading">
                    <div className="aa-inline-loader"><div className="aa-loader-ring"></div><div className="aa-loader-ring"></div><div className="aa-loader-ring"></div></div>
                    <span>{filterOptionsLoading && !loading ? 'Loading filter options...' : 'Fetching assessments...'}</span>
                </div>
            ) : !loading && assessments.length === 0 ? (
                <div className="aa-empty">
                    <div className="aa-empty-illustration"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 10-10V5l-8-3-8 3v7c0 6 8 10 10"/></svg></div>
                    <h3>No Assessments Found</h3>
                    <p>{status === 'submitted' ? 'All assessments have been reviewed.' : `No ${status} assessments match the current filters.`}</p>
                </div>
            ) : (
                <>
                    {/* Results Info */}
                    {!loading && assessments.length > 0 && (
                        <div className="aa-results-info">
                            <span className="aa-results-count">
                                <strong>{paginationRangeText}</strong>
                                {excludedIds.size > 0 && <span style={{ color: '#ef4444', fontWeight: 600, marginLeft: 8 }}>({excludedIds.size} excluded)</span>}
                            </span>
                            <span className="aa-results-status" style={{ color: getStatusMeta(status).color }}>{getStatusMeta(status).label}</span>
                        </div>
                    )}

                    {/* Approved Summary Bar */}
                    {!loading && status === 'approved' && approvedSummary?.byTerm?.length > 0 && (
                        <div className="aa-approved-summary">
                            <div className="aa-approved-summary-notice">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                {isCrossTermApproved ? `Showing approved records across ${approvedSummary.byTerm.length} terms` : `Approved records for ${approvedSummary.byTerm[0]?.termName} (${approvedSummary.byTerm[0]?.sessionName})`}
                            </div>
                            <div className="aa-approved-summary-terms">
                                {approvedSummary.byTerm.map((t) => (
                                    <span key={`${t.termId}-${t.sessionId}`} className="aa-approved-term-chip">{t.termName}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t.sessionName})</span><span className="aa-approved-term-chip-count">{t.count}</span></span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Desktop Table */}
                    <div className="aa-table-section">
                        <div className="aa-table-wrap">
                            <table className={`aa-table ${status === 'approved' ? 'aa-table--with-terms' : ''}`}>
                                <thead>
                                    <tr>
                                        <th className="aa-th-exclude"><div className="aa-th-exclude-label"><ExcludeCheckbox checked={isAllExcluded} indeterminate={isSomeExcluded} onChange={toggleExcludeAll} /><span className="aa-th-exclude-text">Exclude</span></div></th>
                                        <th>Student</th><th>Class</th><th>Subject</th>
                                        {status === 'approved' && <th>Term</th>}
                                        {status === 'approved' && <th>Session</th>}
                                        <th className="aa-th-score">CA<span className="aa-th-max">/40</span></th>
                                        <th className="aa-th-score">Exam<span className="aa-th-max">/60</span></th>
                                        <th className="aa-th-total">Total<span className="aa-th-max">/100</span></th>
                                        <th>Grade</th><th>Status</th><th className="aa-th-action">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assessments.map((a, i) => {
                                        const sm = getStatusMeta(a.status);
                                        const isUnapproving = unapprovingId === a._id;
                                        const isExcluded = excludedIds.has(a._id);
                                        return (
                                            <tr key={a._id} className={isExcluded ? 'aa-row-excluded' : ''} style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}>
                                                <td className="aa-td-exclude"><ExcludeCheckbox checked={isExcluded} onChange={() => toggleExclude(a._id)} /></td>
                                                <td className="aa-td-student"><span className="aa-student-name">{a.studentId?.lastName} {a.studentId?.firstName}</span><span className="aa-student-id">{a.studentId?.admissionNumber}</span></td>
                                                <td><span className="aa-tag aa-tag--class"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 1 2-2 0z"/><path d="M19 6l-1 14H6L5 6"/></svg>{a.classId?.name}</span></td>
                                                <td><span className="aa-subject-name">{a.subjectId?.name}</span></td>
                                                {status === 'approved' && (<td><span className="aa-tag aa-tag--term">{a.termId?.name || '—'}</span></td>)}
                                                {status === 'approved' && (<td><span className="aa-tag aa-tag--session">{a.sessionId?.name || '—'}</span></td>)}
                                                <td className="aa-td-score">{a.totalCA}</td>
                                                <td className="aa-td-score">{a.examScore}</td>
                                                <td className="aa-td-total"><span className="aa-total-badge">{a.totalScore}</span></td>
                                                <td><span className="aa-grade-badge" style={{ backgroundColor: getGradeBg(a.grade), color: getGradeColor(a.grade) }}>{a.grade}</span></td>
                                                <td><span className="aa-status-badge" style={{ color: sm.color, backgroundColor: sm.bg }}><span className="aa-status-dot" style={{ backgroundColor: sm.dot }} />{sm.label}</span></td>
                                                <td className="aa-td-action">
                                                    {a.status === 'submitted' ? (<button className="aa-approve-btn" onClick={() => handleApprove(a._id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Approve</button>) : a.status === 'approved' ? (<button className="aa-unapprove-btn" onClick={() => handleUnapprove(a._id)} disabled={isUnapproving}>{isUnapproving ? <div className="aa-btn-spinner aa-btn-spinner--sm aa-btn-spinner--dark" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M9 9l6 6"/></svg>}Unapprove</button>) : <span className="aa-draft-label">Draft</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="aa-cards">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ExcludeCheckbox checked={isAllExcluded} indeterminate={isSomeExcluded} onChange={toggleExcludeAll} />
                                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Exclude from bulk</span>
                            </div>
                            {excludedIds.size > 0 && (<button onClick={clearExclusions} style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Clear ({excludedIds.length})</button>)}
                        </div>
                        {assessments.map((a, i) => {
                            const sm = getStatusMeta(a.status);
                            const isUnapproving = unapprovingId === a._id;
                            const isExcluded = excludedIds.has(a._id);
                            return (
                                <div key={a._id} className={`aa-card ${isExcluded ? 'aa-card-excluded' : ''}`} style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}>
                                    <div className="aa-card-top">
                                        <div className="aa-card-top-left">
                                            <ExcludeCheckbox checked={isExcluded} onChange={() => toggleExclude(a._id)} />
                                            <div className="aa-card-student"><span className="aa-student-name">{a.studentId?.lastName} {a.studentId?.firstName}</span><span className="aa-student-id">{a.studentId?.admissionNumber}</span></div>
                                        </div>
                                    </div>
                                    <div className="aa-card-meta">
                                        <span className="aa-tag aa-tag--class"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 1 2-2 0z"/><path d="M19 6l-1 14H6L5 6"/></svg>{a.classId?.name}</span>
                                        <span className="aa-subject-name">{a.subjectId?.name}</span>
                                    </div>
                                    {status === 'approved' && (a.termId?.name || a.sessionId?.name) && (
                                        <div className="aa-card-term-session">{a.termId?.name && <span style={{ fontWeight: 600 }}>{a.termId?.name}</span>}{a.termId?.name && a.sessionId?.name && <span className="aa-card-term-session-sep" />}{a.sessionId?.name && <span>{a.sessionId?.name}</span>}</div>
                                    )}
                                    <div className="aa-card-scores">
                                        <div className="aa-score-block"><span className="aa-score-label">CA</span><span className="aa-score-value">{a.totalCA}<span className="aa-score-max">/40</span></span></div>
                                        <div className="aa-score-divider"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
                                        <div className="aa-score-block aa-score-block--total"><span className="aa-score-label">Exam</span><span className="aa-score-value aa-score-value--total">{a.examScore}<span className="aa-score-max">/60</span></span></div>
                                        <span className="aa-grade-badge aa-grade-badge--card" style={{ backgroundColor: getGradeBg(a.grade), color: getGradeColor(a.grade) }}>{a.grade}</span>
                                    </div>
                                    <div className="aa-card-action">
                                        {a.status === 'submitted' ? (<button className="aa-approve-btn" onClick={() => handleApprove(a._id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Approve</button>) : a.status === 'approved' ? (<button className="aa-unapprove-btn" onClick={() => handleUnapprove(a._id)} disabled={isUnapproving}>{isUnapproving ? <div className="aa-btn-spinner aa-btn-spinner--sm aa-btn-spinner--dark" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M9 9l6 6"/></svg>}Unapprove</button>) : (<span className="aa-draft-label" style={{ flex: 1, textAlign: 'center', padding: '9px 0' }}>Draft</span>)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ===== PAGINATION BAR ===== */}
                    {!loading && totalResults > 0 && totalPages > 1 && (
                        <div className="aa-pagination-bar">
                            <div className="aa-pagination-left">
                                <span className="aa-pagination-range">{paginationRangeText}</span>
                                <div className="aa-page-size-select">
                                    <label htmlFor="aa-page-size">Per page:</label>
                                    <div className="aa-select-wrap">
                                        <select id="aa-page-size" className="aa-select" value={pageSize} onChange={handlePageSizeChange} disabled={loading}>
                                            {PAGE_SIZE_OPTIONS.map(size => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="aa-pagination-controls">
                                <button className="aa-page-btn" onClick={() => goToPage(1)} disabled={currentPage === 1 || loading} title="First page">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                                </button>
                                <button className="aa-page-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1 || loading} title="Previous page">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                </button>
                                {visiblePages.map((page, idx) => (
                                    page === '...' ? (
                                        <span key={`ellipsis-${idx}`} className="aa-page-btn aa-page-btn--ellipsis">…</span>
                                    ) : (
                                        <button key={page} className={`aa-page-btn ${currentPage === page ? 'aa-page-btn--active' : ''}`} onClick={() => goToPage(page)} disabled={loading}>
                                            {page}
                                        </button>
                                    )
                                ))}
                                <button className="aa-page-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages || loading} title="Next page">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                                <button className="aa-page-btn" onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages || loading} title="Last page">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Show page size selector even with 1 page when there are results, for future use */}
                    {!loading && totalResults > 0 && totalPages <= 1 && (
                        <div className="aa-pagination-bar">
                            <div className="aa-pagination-left">
                                <span className="aa-pagination-range">{paginationRangeText}</span>
                                <div className="aa-page-size-select">
                                    <label htmlFor="aa-page-size">Per page:</label>
                                    <div className="aa-select-wrap">
                                        <select id="aa-page-size" className="aa-select" value={pageSize} onChange={handlePageSizeChange} disabled={loading}>
                                            {PAGE_SIZE_OPTIONS.map(size => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {totalResults <= pageSize ? 'All results shown' : 'Use "Per page" to show more'}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ApproveAssessments;