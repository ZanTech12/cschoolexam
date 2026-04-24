import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const processInBatches = async (items, handler, batchSize = 5, onProgress) => {
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(handler));
        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value) successCount++;
            else failCount++;
        });
        if (onProgress) onProgress(Math.min(i + batchSize, items.length), items.length);
    }
    return { successCount, failCount };
};

const ExcludeCheckbox = ({ checked, indeterminate, onChange }) => (
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
);

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
    const [bulkProgress, setBulkProgress]                 = useState({ current: 0, total: 0 });
    const [confirmBulk, setConfirmBulk]                   = useState(false);
    const [confirmBulkUnapprove, setConfirmBulkUnapprove] = useState(false);
    const [success, setSuccess]                           = useState('');
    const [error, setError]                               = useState('');
    const [unapprovingId, setUnapprovingId]               = useState(null);
    const [excludedIds, setExcludedIds]                   = useState(new Set());
    const [totalResults, setTotalResults]                 = useState(0);

    const abortRef         = useRef(null);
    const debounceRef      = useRef(null);
    const initialDoneRef   = useRef(false);
    const fetchRef         = useRef(null);
    const subjectsCacheRef = useRef({});

    /* ── Derived exclusion state ── */
    const isAllExcluded  = assessments.length > 0 && excludedIds.size === assessments.length;
    const isSomeExcluded = excludedIds.size > 0 && !isAllExcluded;
    const effectivePendingCount  = Math.max(0, (status === 'submitted' ? assessments.length : 0) - excludedIds.size);
    const effectiveApprovedCount = Math.max(0, (status === 'approved' ? assessments.length : 0) - excludedIds.size);

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

    /* ── Toast timer ── */
    useEffect(() => {
        if (!success && !error) return;
        const t = setTimeout(() => { setSuccess(''); setError(''); }, 5000);
        return () => clearTimeout(t);
    }, [success, error]);

    /* ── Debounced fetch on filter change ── */
    const scheduleFetch = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchRef.current?.(), 250);
    }, []);

    useEffect(() => {
        if (!initialDoneRef.current) return;
        setExcludedIds(new Set());
        scheduleFetch();
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [termId, sessionId, classId, subjectId, status, scheduleFetch]);

    useEffect(() => {
        if (!initialDoneRef.current) return;
        setSubjectId('');
        if (!classId) {
            setSubjects([]);
            subjectsCacheRef.current = {};
        } else {
            fetchSubjectsForClass(classId);
        }
    }, [classId]);

    useEffect(() => { fetchInitialData(); }, []);

    const fetchSubjectsForClass = async (cId) => {
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
    };

    const fetchInitialData = async () => {
        try {
            const [termsRes, sessionsRes, classesRes] = await Promise.all([
                termsAPI.getAll(),
                sessionsAPI.getAll(),
                classesAPI.getAllForDropdown()
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
        } catch (err) {
            console.error('[fetchInitialData]', err);
        } finally {
            initialDoneRef.current = true;
            fetchAssessments();
        }
    };

    const fetchAssessments = async () => {
        // Cancel any in-flight request
        if (abortRef.current) {
            abortRef.current.cancelled = true;
        }
        const controller = { cancelled: false };
        abortRef.current = controller;

        try {
            setLoading(true);
            setConfirmBulk(false);
            setConfirmBulkUnapprove(false);
            const params = { limit: 1000 };
            if (termId)    params.termId    = termId;
            if (sessionId) params.sessionId = sessionId;
            if (classId)   params.classId   = classId;
            if (subjectId) params.subjectId = subjectId;
            if (status)    params.status    = status;

            // Use admin CA endpoint for properly populated data
            const response = await adminCAAPI.getAssessments(params);

            // Check if this request was superseded
            if (controller.cancelled) return;

            const dataArray = extractDataArray(response);
            setAssessments(dataArray);
            setExcludedIds(new Set());
            
            // Track total results from pagination if available
            if (response.pagination?.total) {
                setTotalResults(response.pagination.total);
            } else {
                setTotalResults(dataArray.length);
            }
        } catch (err) {
            if (controller.cancelled) return;
            console.error('[fetchAssessments]', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch assessments');
        } finally {
            if (abortRef.current === controller) setLoading(false);
        }
    };

    fetchRef.current = fetchAssessments;

    const handleApprove = async (id) => {
        setSuccess(''); setError('');
        const previous = { ...assessments.find(a => a._id === id) };
        setAssessments(prev => prev.map(a => a._id === id ? { ...a, status: 'approved' } : a));
        try {
            const response = await adminCAAPI.approve(id);
            if (response.success) {
                setSuccess('Assessment approved successfully');
                if (response.data) {
                    setAssessments(prev => prev.map(a => a._id === id ? { ...a, ...response.data, status: 'approved' } : a));
                }
            } else {
                setAssessments(prev => prev.map(a => a._id === id ? previous : a));
                setError(response.message || 'Failed to approve');
            }
        } catch (err) {
            setAssessments(prev => prev.map(a => a._id === id ? previous : a));
            setError(err.response?.data?.message || err.message || 'Failed to approve assessment');
        }
    };

    const handleUnapprove = async (id) => {
        setSuccess(''); setError(''); setUnapprovingId(id);
        const previous = { ...assessments.find(a => a._id === id) };
        setAssessments(prev => prev.map(a => a._id === id ? { ...a, status: 'submitted' } : a));
        try {
            const response = await adminCAAPI.unapprove(id);
            if (response.success) {
                setSuccess('Assessment unapproved successfully');
                if (response.data) {
                    setAssessments(prev => prev.map(a => a._id === id ? { ...a, ...response.data, status: 'submitted' } : a));
                }
            } else {
                setAssessments(prev => prev.map(a => a._id === id ? previous : a));
                setError(response.message || 'Failed to unapprove');
            }
        } catch (err) {
            setAssessments(prev => prev.map(a => a._id === id ? previous : a));
            setError(err.response?.data?.message || err.message || 'Failed to unapprove assessment');
        } finally {
            setUnapprovingId(null);
        }
    };

    const handleApproveAll = async () => {
        setConfirmBulk(false);
        setBulkLoading(true);
        setBulkProgress({ current: 0, total: 0 });
        setSuccess('');
        setError('');

        const toApprove = assessments.filter(a => !excludedIds.has(a._id));
        const ids = toApprove.map(a => a._id);

        if (ids.length === 0) {
            setBulkLoading(false);
            return;
        }

        // Optimistically update UI
        setAssessments(prev => prev.map(a => (!excludedIds.has(a._id) ? { ...a, status: 'approved' } : a)));

        try {
            // Use bulk approve endpoint for efficiency
            const response = await adminCAAPI.bulkApprove(ids);
            setBulkLoading(false);
            setExcludedIds(new Set());

            if (response.success) {
                setSuccess(`Successfully approved ${ids.length} assessments`);
            } else {
                setError(response.message || 'Failed to approve some assessments');
                fetchAssessments();
            }
        } catch (err) {
            setBulkLoading(false);
            setError(err.response?.data?.message || err.message || 'Failed to approve assessments');
            fetchAssessments();
        }
    };

    const handleUnapproveAll = async () => {
        setConfirmBulkUnapprove(false);
        setBulkLoading(true);
        setBulkProgress({ current: 0, total: 0 });
        setSuccess('');
        setError('');

        const toUnapprove = assessments.filter(a => !excludedIds.has(a._id));
        const ids = toUnapprove.map(a => a._id);

        if (ids.length === 0) {
            setBulkLoading(false);
            return;
        }

        // Optimistically update UI
        setAssessments(prev => prev.map(a => (!excludedIds.has(a._id) ? { ...a, status: 'submitted' } : a)));

        // No bulk unapprove endpoint, use batch processing
        const { successCount, failCount } = await processInBatches(
            ids,
            (id) => adminCAAPI.unapprove(id).then(r => r.success),
            5,
            (current, total) => setBulkProgress({ current, total })
        );

        setBulkLoading(false);
        setExcludedIds(new Set());

        if (failCount === 0) {
            setSuccess(`Successfully unapproved ${successCount} assessments`);
        } else {
            setError(`Failed to unapprove ${failCount} assessment(s)`);
            setSuccess(`Unapproved ${successCount} of ${ids.length}`);
            fetchAssessments();
        }
    };

    const handleClassChange = (e) => setClassId(e.target.value);

    const statusTabs = [
        { value: 'submitted', label: 'Submitted' },
        { value: 'draft',     label: 'Draft' },
        { value: 'approved',  label: 'Approved' }
    ];

    const bulkLabel = bulkLoading && bulkProgress.total > 0 ? `${bulkProgress.current}/${bulkProgress.total}` : null;

    return (
        <div className="aa-root">
            <style>{`
                /* ===== BASE RESET & TOKENS ===== */
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

                /* ===== TOASTS ===== */
                .aa-toasts { position: fixed; top: 16px; right: 16px; z-index: 200; display: flex; flex-direction: column; gap: 8px; pointer-events: none; max-width: 380px; }
                .aa-toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500; box-shadow: var(--shadow-lg); animation: aaToastIn 0.3s cubic-bezier(0.16,1,0.3,1); }
                .aa-toast--success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
                .aa-toast--error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
                .aa-toast svg { flex-shrink: 0; }
                @keyframes aaToastIn { from { opacity: 0; transform: translateX(20px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }

                /* ===== HEADER ===== */
                .aa-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; position: sticky; top: 0; z-index: 30; }
                .aa-header-content { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
                .aa-header-text { display: flex; align-items: center; gap: 14px; }
                .aa-header-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--primary-light); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0; }
                .aa-title { font-size: 1.35rem; font-weight: 700; color: var(--text); margin: 0; letter-spacing: -0.02em; }
                .aa-subtitle { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; }
                .aa-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

                /* ===== BUTTONS ===== */
                .aa-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; transition: all var(--transition); white-space: nowrap; line-height: 1.4; }
                .aa-btn:active { transform: scale(0.97); }
                .aa-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
                .aa-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
                .aa-btn-primary { background: var(--primary); color: #fff; }
                .aa-btn-primary:hover { background: var(--primary-hover); }
                .aa-btn-success { background: var(--success); color: #fff; }
                .aa-btn-success:hover { background: #059669; }
                .aa-btn-warning { background: var(--warning); color: #fff; }
                .aa-btn-warning:hover { background: #d97706; }
                .aa-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
                .aa-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
                .aa-btn-danger-outline { background: var(--surface); color: var(--danger); border: 1px solid #fecaca; }
                .aa-btn-danger-outline:hover { background: #fef2f2; border-color: #fca5a5; }
                .aa-btn-sm { padding: 6px 12px; font-size: 0.78rem; }
                .aa-btn-sm svg { width: 13px; height: 13px; }
                .aa-btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: aaSpin 0.6s linear infinite; flex-shrink: 0; }
                .aa-btn-spinner--sm { width: 13px; height: 13px; }
                .aa-btn-spinner--dark { border-color: rgba(0,0,0,0.12); border-top-color: var(--text-secondary); }
                @keyframes aaSpin { to { transform: rotate(360deg); } }

                /* ===== EXCLUDE CHECKBOX ===== */
                .aa-exclude-cb { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 5px; border: 2px solid #cbd5e1; background: var(--surface); cursor: pointer; transition: all var(--transition); flex-shrink: 0; }
                .aa-exclude-cb:hover { border-color: #94a3b8; background: #f8fafc; }
                .aa-exclude-cb--checked { background: var(--danger); border-color: var(--danger); }
                .aa-exclude-cb--checked:hover { background: var(--danger-hover); border-color: var(--danger-hover); }
                .aa-exclude-cb--indeterminate { background: var(--danger); border-color: var(--danger); }
                .aa-exclude-cb--indeterminate:hover { background: var(--danger-hover); border-color: var(--danger-hover); }
                .aa-exclude-cb svg { width: 12px; height: 12px; color: #fff; pointer-events: none; }
                .aa-exclude-cb:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

                /* ===== EXCLUSION BAR ===== */
                .aa-exclusion-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 24px; background: #fef2f2; border-bottom: 1px solid #fecaca; animation: aaSlideDown 0.25s ease; }
                .aa-exclusion-bar-inner { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #991b1b; font-weight: 500; }
                .aa-exclusion-bar-inner svg { flex-shrink: 0; }
                .aa-exclusion-bar-count { font-weight: 700; }
                .aa-exclusion-bar-actions { display: flex; gap: 6px; }
                .aa-exclusion-clear { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; border: 1px solid #fecaca; background: var(--surface); color: #991b1b; font-size: 0.76rem; font-weight: 600; cursor: pointer; transition: all var(--transition); }
                .aa-exclusion-clear:hover { background: #fee2e2; border-color: #fca5a5; }
                .aa-exclusion-clear svg { width: 12px; height: 12px; }

                /* ===== FILTERS PANEL ===== */
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

                /* ===== BULK CONFIRM BAR ===== */
                .aa-bulk-confirm { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 24px; background: var(--warning-light); border-bottom: 1px solid #fde68a; animation: aaSlideDown 0.25s ease; flex-wrap: wrap; }
                .aa-bulk-confirm--unapprove { background: #fef2f2; border-bottom-color: #fecaca; }
                .aa-bulk-confirm-inner { display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #92400e; }
                .aa-bulk-confirm--unapprove .aa-bulk-confirm-inner { color: #991b1b; }
                .aa-bulk-confirm-icon { flex-shrink: 0; }
                .aa-bulk-confirm-note { display: block; font-size: 0.78rem; color: #a16207; font-weight: 400; margin-top: 2px; }
                .aa-bulk-confirm--unapprove .aa-bulk-confirm-note { color: #b91c1c; }
                .aa-bulk-confirm-actions { display: flex; gap: 8px; }

                /* ===== RESULTS INFO ===== */
                .aa-results-info { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; font-size: 0.82rem; color: var(--text-muted); }
                .aa-results-count strong { color: var(--text-secondary); font-weight: 700; }
                .aa-results-status { font-weight: 600; }

                /* ===== LOADING ===== */
                .aa-table-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 80px 24px; color: var(--text-muted); font-size: 0.88rem; }
                .aa-inline-loader { display: flex; gap: 6px; }
                .aa-loader-ring { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); opacity: 0.3; animation: aaBounce 1.2s ease-in-out infinite; }
                .aa-loader-ring:nth-child(2) { animation-delay: 0.15s; }
                .aa-loader-ring:nth-child(3) { animation-delay: 0.3s; }
                @keyframes aaBounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }

                /* ===== EMPTY STATE ===== */
                .aa-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; text-align: center; color: var(--text-muted); }
                .aa-empty-illustration { width: 72px; height: 72px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #cbd5e1; }
                .aa-empty h3 { font-size: 1.05rem; font-weight: 700; color: var(--text-secondary); margin: 0 0 6px; }
                .aa-empty p { font-size: 0.85rem; margin: 0; max-width: 340px; line-height: 1.5; }

                /* ===== DESKTOP TABLE ===== */
                .aa-table-section { background: var(--surface); min-height: 200px; }
                .aa-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .aa-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 920px; }
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

                /* ===== GRADE BADGE ===== */
                .aa-grade-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; padding: 3px 10px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; font-variant-numeric: tabular-nums; }

                /* ===== STATUS BADGE ===== */
                .aa-status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
                .aa-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

                /* ===== TAGS ===== */
                .aa-tag { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; white-space: nowrap; }
                .aa-tag--class { background: #f1f5f9; color: var(--text-secondary); }
                .aa-tag--class svg { color: var(--text-muted); }
                .aa-subject-name { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }

                /* ===== ACTION BUTTONS IN TABLE ===== */
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

                /* ===== MOBILE CARDS ===== */
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

                /* ===== ALERT INLINE ===== */
                .aa-alert { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500; display: flex; align-items: center; gap: 8px; animation: aaSlideDown 0.25s ease; }
                .aa-alert--success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
                .aa-alert--danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
                @keyframes aaSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

                /* ===== PROGRESS BAR ===== */
                .aa-progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
                .aa-progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s ease; }

                /* ===== RESPONSIVE ===== */
                @media (min-width: 768px) {
                    .aa-cards { display: none !important; }
                    .aa-table-section { display: block !important; }
                    .aa-header { padding: 24px 32px; }
                    .aa-filters { padding: 16px 32px; }
                    .aa-exclusion-bar { padding: 10px 32px; }
                    .aa-bulk-confirm { padding: 14px 32px; }
                    .aa-results-info { padding: 12px 32px; }
                }

                @media (max-width: 767px) {
                    .aa-header { padding: 16px; }
                    .aa-header-content { flex-direction: column; align-items: flex-start; }
                    .aa-header-actions { width: 100%; }
                    .aa-header-actions .aa-btn { flex: 1; justify-content: center; padding: 10px 10px; font-size: 0.78rem; }
                    .aa-title { font-size: 1.15rem; }
                    .aa-header-icon { width: 38px; height: 38px; border-radius: 10px; }
                    .aa-header-icon svg { width: 22px; height: 22px; }
                    .aa-filters { padding: 14px 16px; }
                    .aa-status-tabs { width: 100%; }
                    .aa-status-tab { flex: 1; justify-content: center; padding: 8px 10px; font-size: 0.78rem; }
                    .aa-filter-row { grid-template-columns: 1fr 1fr; gap: 10px; }
                    .aa-exclusion-bar { padding: 10px 16px; }
                    .aa-exclusion-bar-inner { font-size: 0.78rem; }
                    .aa-bulk-confirm { padding: 12px 16px; }
                    .aa-bulk-confirm-inner { font-size: 0.82rem; }
                    .aa-results-info { padding: 10px 16px; }
                    .aa-table-section { display: none !important; }
                    .aa-cards { display: flex !important; }
                    .aa-card-scores { padding: 10px 8px; }
                    .aa-score-block { padding: 0 8px; min-width: 52px; }
                    .aa-score-value { font-size: 1rem; }
                    .aa-toasts { left: 16px; right: 16px; max-width: none; }
                }

                @media (max-width: 420px) {
                    .aa-filter-row { grid-template-columns: 1fr; }
                    .aa-header-actions { flex-direction: column; }
                    .aa-bulk-confirm { flex-direction: column; align-items: flex-start; }
                    .aa-bulk-confirm-actions { width: 100%; }
                    .aa-bulk-confirm-actions .aa-btn-sm { flex: 1; justify-content: center; }
                    .aa-exclusion-bar { flex-direction: column; align-items: flex-start; gap: 8px; }
                    .aa-exclusion-bar-actions { width: 100%; }
                    .aa-exclusion-clear { flex: 1; justify-content: center; }
                }

                /* ===== SCROLLBAR ===== */
                .aa-root ::-webkit-scrollbar { width: 6px; height: 6px; }
                .aa-root ::-webkit-scrollbar-track { background: transparent; }
                .aa-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                .aa-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>

            {/* ===== TOASTS ===== */}
            <div className="aa-toasts">
                {error && (
                    <div className="aa-toast aa-toast--error" key={`err-${Date.now()}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="aa-toast aa-toast--success" key={`suc-${Date.now()}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>{success}</span>
                    </div>
                )}
            </div>

            {/* ===== HEADER ===== */}
            <header className="aa-header">
                <div className="aa-header-content">
                    <div className="aa-header-text">
                        <div className="aa-header-icon">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                        {effectivePendingCount > 0 && (
                            <button className="aa-btn aa-btn-success" onClick={() => setConfirmBulk(true)} disabled={bulkLoading}>
                                {bulkLoading ? (
                                    <><div className="aa-btn-spinner" />{bulkLabel || 'Processing...'}</>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                                )}
                                {!bulkLoading && `Approve All (${effectivePendingCount})`}
                            </button>
                        )}
                        {effectiveApprovedCount > 0 && (
                            <button className="aa-btn aa-btn-danger-outline" onClick={() => setConfirmBulkUnapprove(true)} disabled={bulkLoading}>
                                {bulkLoading ? (
                                    <><div className="aa-btn-spinner aa-btn-spinner--dark" />{bulkLabel || 'Processing...'}</>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                                )}
                                {!bulkLoading && `Unapprove All (${effectiveApprovedCount})`}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ===== FILTERS ===== */}
            <div className="aa-filters">
                <div className="aa-status-tabs">
                    {statusTabs.map(tab => {
                        const meta = getStatusMeta(tab.value);
                        const isActive = status === tab.value;
                        return (
                            <button
                                key={tab.value}
                                className={`aa-status-tab ${isActive ? 'aa-status-tab--active' : ''}`}
                                onClick={() => setStatus(tab.value)}
                            >
                                <span className="aa-status-tab-dot" style={isActive ? { background: meta.dot } : undefined} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="aa-filter-row">
                    <div className="aa-filter-field">
                        <label htmlFor="aa-term">Term</label>
                        <div className="aa-select-wrap">
                            <select id="aa-term" value={termId} onChange={(e) => setTermId(e.target.value)} className="aa-select">
                                <option value="">All Terms</option>
                                {terms.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                    <div className="aa-filter-field">
                        <label htmlFor="aa-session">Session</label>
                        <div className="aa-select-wrap">
                            <select id="aa-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="aa-select">
                                <option value="">All Sessions</option>
                                {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                    <div className="aa-filter-field">
                        <label htmlFor="aa-class">Class</label>
                        <div className="aa-select-wrap">
                            <select id="aa-class" value={classId} onChange={handleClassChange} className="aa-select">
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                    <div className="aa-filter-field">
                        <label htmlFor="aa-subject">
                            Subject
                            {subjectsLoading && (
                                <span className="aa-subject-loading"><span className="aa-mini-spinner" /></span>
                            )}
                        </label>
                        <div className="aa-select-wrap">
                            <select
                                id="aa-subject"
                                value={subjectId}
                                onChange={(e) => setSubjectId(e.target.value)}
                                className="aa-select"
                                disabled={!classId && subjects.length === 0}
                            >
                                <option value="">All Subjects</option>
                                {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                </div>

                {!classId && (
                    <div className="aa-filter-hint">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <span>Select a class to filter by subject</span>
                    </div>
                )}
            </div>

            {/* ===== EXCLUSION BAR ===== */}
            {excludedIds.size > 0 && (
                <div className="aa-exclusion-bar">
                    <div className="aa-exclusion-bar-inner">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                        </svg>
                        <span><span className="aa-exclusion-bar-count">{excludedIds.size}</span> student{excludedIds.size !== 1 ? 's' : ''} excluded from bulk actions</span>
                    </div>
                    <div className="aa-exclusion-bar-actions">
                        <button className="aa-exclusion-clear" onClick={clearExclusions}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* ===== BULK CONFIRM: APPROVE ===== */}
            {confirmBulk && (
                <div className="aa-bulk-confirm">
                    <div className="aa-bulk-confirm-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aa-bulk-confirm-icon">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>
                            Approve <strong>{effectivePendingCount}</strong> assessment{effectivePendingCount !== 1 ? 's' : ''}?
                            {excludedIds.size > 0 && (
                                <span className="aa-bulk-confirm-note">{excludedIds.size} student{excludedIds.size !== 1 ? 's' : ''} excluded from this action</span>
                            )}
                        </span>
                    </div>
                    <div className="aa-bulk-confirm-actions">
                        <button className="aa-btn aa-btn-ghost aa-btn-sm" onClick={() => setConfirmBulk(false)}>Cancel</button>
                        <button className="aa-btn aa-btn-success aa-btn-sm" onClick={handleApproveAll}>Confirm</button>
                    </div>
                </div>
            )}

            {/* ===== BULK CONFIRM: UNAPPROVE ===== */}
            {confirmBulkUnapprove && (
                <div className="aa-bulk-confirm aa-bulk-confirm--unapprove">
                    <div className="aa-bulk-confirm-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aa-bulk-confirm-icon">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>
                            Unapprove <strong>{effectiveApprovedCount}</strong> assessment{effectiveApprovedCount !== 1 ? 's' : ''}?
                            {excludedIds.size > 0 && (
                                <span className="aa-bulk-confirm-note">{excludedIds.size} student{excludedIds.size !== 1 ? 's' : ''} excluded from this action</span>
                            )}
                        </span>
                    </div>
                    <div className="aa-bulk-confirm-actions">
                        <button className="aa-btn aa-btn-ghost aa-btn-sm" onClick={() => setConfirmBulkUnapprove(false)}>Cancel</button>
                        <button className="aa-btn aa-btn-danger-outline aa-btn-sm" onClick={handleUnapproveAll}>Confirm</button>
                    </div>
                </div>
            )}

            {/* ===== RESULTS INFO ===== */}
            {!loading && assessments.length > 0 && (
                <div className="aa-results-info">
                    <span className="aa-results-count">
                        Showing <strong>{assessments.length}</strong> assessment{assessments.length !== 1 ? 's' : ''}
                        {totalResults > assessments.length && (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500, marginLeft: 4 }}>
                                of {totalResults}
                            </span>
                        )}
                        {excludedIds.size > 0 && (
                            <span style={{ color: '#ef4444', fontWeight: 600, marginLeft: 8 }}>
                                ({excludedIds.size} excluded)
                            </span>
                        )}
                    </span>
                    <span className="aa-results-status" style={{ color: getStatusMeta(status).color }}>
                        {getStatusMeta(status).label}
                    </span>
                </div>
            )}

            {/* ===== CONTENT ===== */}
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
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
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
                    {/* ===== DESKTOP TABLE ===== */}
                    <div className="aa-table-section">
                        <div className="aa-table-wrap">
                            <table className="aa-table">
                                <thead>
                                    <tr>
                                        <th className="aa-th-exclude">
                                            <div className="aa-th-exclude-label">
                                                <ExcludeCheckbox
                                                    checked={isAllExcluded}
                                                    indeterminate={isSomeExcluded}
                                                    onChange={toggleExcludeAll}
                                                />
                                                <span className="aa-th-exclude-text">Exclude</span>
                                            </div>
                                        </th>
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
                                        const isExcluded = excludedIds.has(a._id);
                                        return (
                                            <tr key={a._id} className={isExcluded ? 'aa-row-excluded' : ''} style={{ animationDelay: `${i * 0.03}s` }}>
                                                <td className="aa-td-exclude">
                                                    <ExcludeCheckbox
                                                        checked={isExcluded}
                                                        onChange={() => toggleExclude(a._id)}
                                                    />
                                                </td>
                                                <td className="aa-td-student">
                                                    <span className="aa-student-name">{a.studentId?.lastName} {a.studentId?.firstName}</span>
                                                    <span className="aa-student-id">{a.studentId?.admissionNumber}</span>
                                                </td>
                                                <td>
                                                    <span className="aa-tag aa-tag--class">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                                        {a.classId?.name}
                                                    </span>
                                                </td>
                                                <td><span className="aa-subject-name">{a.subjectId?.name}</span></td>
                                                <td className="aa-td-score">{a.totalCA}</td>
                                                <td className="aa-td-score">{a.examScore}</td>
                                                <td className="aa-td-total"><span className="aa-total-badge">{a.totalScore}</span></td>
                                                <td>
                                                    <span className="aa-grade-badge" style={{ backgroundColor: getGradeBg(a.grade), color: getGradeColor(a.grade) }}>{a.grade}</span>
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
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                            Approve
                                                        </button>
                                                    ) : a.status === 'approved' ? (
                                                        <button className="aa-unapprove-btn" onClick={() => handleUnapprove(a._id)} disabled={isUnapproving}>
                                                            {isUnapproving ? (
                                                                <div className="aa-btn-spinner aa-btn-spinner--sm aa-btn-spinner--dark" />
                                                            ) : (
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M9 9l6 6"/></svg>
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
                    </div>

                    {/* ===== MOBILE CARDS ===== */}
                    <div className="aa-cards">
                        {/* Mobile select all bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ExcludeCheckbox
                                    checked={isAllExcluded}
                                    indeterminate={isSomeExcluded}
                                    onChange={toggleExcludeAll}
                                />
                                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Exclude from bulk
                                </span>
                            </div>
                            {excludedIds.size > 0 && (
                                <button
                                    onClick={clearExclusions}
                                    style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                                >
                                    Clear ({excludedIds.size})
                                </button>
                            )}
                        </div>

                        {assessments.map((a, i) => {
                            const sm = getStatusMeta(a.status);
                            const isUnapproving = unapprovingId === a._id;
                            const isExcluded = excludedIds.has(a._id);
                            return (
                                <div key={a._id} className={`aa-card ${isExcluded ? 'aa-card-excluded' : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div className="aa-card-top">
                                        <div className="aa-card-top-left">
                                            <ExcludeCheckbox
                                                checked={isExcluded}
                                                onChange={() => toggleExclude(a._id)}
                                            />
                                            <div className="aa-card-student">
                                                <span className="aa-student-name">{a.studentId?.lastName} {a.studentId?.firstName}</span>
                                                <span className="aa-student-id">{a.studentId?.admissionNumber}</span>
                                            </div>
                                        </div>
                                        <span className="aa-status-badge" style={{ color: sm.color, backgroundColor: sm.bg, flexShrink: 0 }}>
                                            <span className="aa-status-dot" style={{ backgroundColor: sm.dot }} />
                                            {sm.label}
                                        </span>
                                    </div>

                                    <div className="aa-card-meta">
                                        <span className="aa-tag aa-tag--class">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
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
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        </div>
                                        <div className="aa-score-block">
                                            <span className="aa-score-label">Exam</span>
                                            <span className="aa-score-value">{a.examScore}<span className="aa-score-max">/60</span></span>
                                        </div>
                                        <div className="aa-score-divider">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        </div>
                                        <div className="aa-score-block aa-score-block--total">
                                            <span className="aa-score-label">Total</span>
                                            <span className="aa-score-value aa-score-value--total">{a.totalScore}<span className="aa-score-max">/100</span></span>
                                        </div>
                                        <span className="aa-grade-badge aa-grade-badge--card" style={{ backgroundColor: getGradeBg(a.grade), color: getGradeColor(a.grade) }}>{a.grade}</span>
                                    </div>

                                    <div className="aa-card-action">
                                        {a.status === 'submitted' ? (
                                            <button className="aa-approve-btn" onClick={() => handleApprove(a._id)}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                Approve
                                            </button>
                                        ) : a.status === 'approved' ? (
                                            <button className="aa-unapprove-btn" onClick={() => handleUnapprove(a._id)} disabled={isUnapproving}>
                                                {isUnapproving ? (
                                                    <div className="aa-btn-spinner aa-btn-spinner--sm aa-btn-spinner--dark" />
                                                ) : (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M9 9l6 6"/></svg>
                                                )}
                                                Unapprove
                                            </button>
                                        ) : (
                                            <span className="aa-draft-label" style={{ flex: 1, textAlign: 'center', padding: '9px 0' }}>Draft</span>
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