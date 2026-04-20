import React, { useState, useEffect } from 'react';
import { principalCommentsAPI, termsAPI, sessionsAPI, classesAPI } from '../../api';

const DEFAULT_TEMPLATES = [
    { id: 'excellent', min: 90, max: 100, label: 'Excellent', comment: 'An outstanding and brilliant performance. Keep up the excellent work!' },
    { id: 'very-good', min: 80, max: 89, label: 'Very Good', comment: 'A very commendable performance. Continue to maintain this high standard.' },
    { id: 'good', min: 70, max: 79, label: 'Good', comment: 'A good performance. With more effort, higher marks can be achieved.' },
    { id: 'fair', min: 60, max: 69, label: 'Fair', comment: 'A fair performance. More effort is needed to improve.' },
    { id: 'average', min: 50, max: 59, label: 'Average', comment: 'An average performance. More attention to studies is required.' },
    { id: 'below', min: 40, max: 49, label: 'Below Average', comment: 'Below average performance. Extra attention is needed.' },
    { id: 'poor', min: 0, max: 39, label: 'Poor', comment: 'Very poor performance. Urgent intervention is needed.' }
];

const getRangeColor = (min) => {
    if (min >= 90) return { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
    if (min >= 80) return { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' };
    if (min >= 70) return { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
    if (min >= 60) return { color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    if (min >= 50) return { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
    if (min >= 40) return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
    return { color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' };
};

const getInitials = (firstName, lastName) => {
    return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
};

const getAvatarColor = (name) => {
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

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
                if (Array.isArray(parsed) && parsed.length > 0) setTemplates(parsed);
            }
        } catch (e) { /* use defaults */ }
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
        } catch (error) { console.error('Error:', error); }
    };

    const fetchComments = async () => {
        try {
            setLoading(true);
            const res = await principalCommentsAPI.getAll({
                termId, sessionId, classId: classId || undefined
            });
            if (res.success) setComments(res.data);
        } catch (error) { console.error('Error:', error); }
        finally { setLoading(false); }
    };

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
        if (newMin < 0) { setError('Minimum percentage cannot be negative'); return; }
        if (newMax > 100) { setError('Maximum percentage cannot exceed 100'); return; }
        if (newMin >= newMax) { setError('Minimum must be less than maximum'); return; }
        updated[editIndex] = { ...updated[editIndex], min: newMin, max: newMax, comment: editValue, label: newMin + '-' + newMax + '%', range: newMin + '-' + newMax };
        setTemplates(updated);
        setEditIndex(null); setEditValue(''); setEditMin(''); setEditMax('');
    };

    const addTemplate = () => {
        let maxUsed = -1;
        templates.forEach(t => { if (t.max > maxUsed) maxUsed = t.max; });
        const newMin = maxUsed + 1;
        const newMax = Math.min(newMin + 10, 100);
        const newTemplate = { id: 'custom-' + Date.now(), min: newMin, max: newMax, label: newMin + '-' + newMax + '%', comment: 'Custom comment for ' + newMin + '-' + newMax + '% range' };
        setTemplates([...templates, newTemplate]);
        setEditIndex(templates.length);
        setEditValue(newTemplate.comment);
        setEditMin(newMin.toString());
        setEditMax(newMax.toString());
    };

    const removeTemplate = (index) => {
        setTemplates(templates.filter((_, i) => i !== index));
        if (editIndex === index) { setEditIndex(null); setEditValue(''); setEditMin(''); setEditMax(''); }
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
        } catch (e) { setError('Failed to save templates'); }
    };

    const handleGenerate = async () => {
        setConfirmGenerate(false);
        try {
            setGenerating(true); setError('');
            saveAllTemplates();
            const templatesForBackend = templates.map(t => ({ min: t.min, max: t.max, comment: t.comment }));
            const res = await principalCommentsAPI.generate({
                termId, sessionId, classId: classId || undefined, commentTemplates: templatesForBackend
            });
            if (res.success) {
                const count = Array.isArray(res.data) ? res.data.length : 0;
                setSuccess('Generated comments for ' + count + ' students');
                fetchComments();
            } else { setError(res.message || 'Generation failed'); }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to generate');
        } finally { setGenerating(false); }
    };

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
                    studentId: target?.studentId?._id || null,
                    termId, sessionId, comment: editText,
                    classTeacherComment: target?.classTeacherComment || null
                });
            }
            if (res.success) { setSuccess('Comment updated'); setEditingComment(null); fetchComments(); }
        } catch (error) { setError(error.response?.data?.message || 'Failed to update'); }
    };

    const deleteComment = async (id) => {
        setDeleteConfirm(null);
        try {
            const res = await principalCommentsAPI.delete(id);
            if (res.success) { setSuccess('Comment deleted'); fetchComments(); }
        } catch (error) { setError(error.response?.data?.message || 'Failed to delete'); }
    };

    const findTemplate = (commentText) => {
        if (!commentText) return null;
        return templates.find(t => commentText.indexOf(t.comment.substring(0, 20)) !== -1) || null;
    };

    return (
        <div className="pc-root">
            <style>{`
                /* ===== BASE RESET & TOKENS ===== */
                .pc-root {
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
                .pc-toasts { position: fixed; top: 16px; right: 16px; z-index: 200; display: flex; flex-direction: column; gap: 8px; pointer-events: none; max-width: 380px; }
                .pc-toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500; box-shadow: var(--shadow-lg); animation: pcToastIn 0.3s cubic-bezier(0.16,1,0.3,1); }
                .pc-toast--success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
                .pc-toast--error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
                .pc-toast svg { flex-shrink: 0; }
                @keyframes pcToastIn { from { opacity: 0; transform: translateX(20px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }

                /* ===== HEADER ===== */
                .pc-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; position: sticky; top: 0; z-index: 30; }
                .pc-header-content { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
                .pc-header-text { display: flex; align-items: center; gap: 14px; }
                .pc-header-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--primary-light); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0; }
                .pc-title { font-size: 1.35rem; font-weight: 700; color: var(--text); margin: 0; letter-spacing: -0.02em; }
                .pc-subtitle { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; }
                .pc-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

                /* ===== BUTTONS ===== */
                .pc-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; transition: all var(--transition); white-space: nowrap; line-height: 1.4; }
                .pc-btn:active { transform: scale(0.97); }
                .pc-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
                .pc-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
                .pc-btn-primary { background: var(--primary); color: #fff; }
                .pc-btn-primary:hover { background: var(--primary-hover); }
                .pc-btn-success { background: var(--success); color: #fff; }
                .pc-btn-success:hover { background: #059669; }
                .pc-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
                .pc-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
                .pc-btn-danger { background: var(--danger); color: #fff; }
                .pc-btn-danger:hover { background: var(--danger-hover); }
                .pc-btn-danger-outline { background: var(--surface); color: var(--danger); border: 1px solid #fecaca; }
                .pc-btn-danger-outline:hover { background: #fef2f2; }
                .pc-btn-sm { padding: 6px 12px; font-size: 0.78rem; }
                .pc-btn-sm svg { width: 13px; height: 13px; }
                .pc-btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: pcSpin 0.6s linear infinite; flex-shrink: 0; }
                .pc-btn-spinner--dark { border-color: rgba(0,0,0,0.12); border-top-color: var(--text-secondary); }
                @keyframes pcSpin { to { transform: rotate(360deg); } }

                /* ===== TEMPLATES PANEL ===== */
                .pc-templates-panel { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; animation: pcSlideDown 0.25s ease; }
                @keyframes pcSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
                .pc-templates-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
                .pc-templates-title { font-size: 1rem; font-weight: 700; color: var(--text); margin: 0 0 4px; }
                .pc-templates-subtitle { font-size: 0.82rem; color: var(--text-muted); margin: 0; line-height: 1.4; }
                .pc-templates-actions { display: flex; gap: 8px; flex-shrink: 0; }
                .pc-templates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-bottom: 14px; }

                .pc-template-card { background: #f8fafc; border: 1px solid var(--border); border-left: 4px solid var(--border); border-radius: var(--radius-sm); padding: 14px 16px; transition: all var(--transition); }
                .pc-template-card--editing { background: var(--surface); border-color: var(--primary); border-left-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
                .pc-template-card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
                .pc-template-range { display: flex; align-items: center; gap: 8px; }
                .pc-template-label { font-size: 0.82rem; font-weight: 700; }
                .pc-template-percentage { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); background: var(--surface); padding: 2px 8px; border-radius: 4px; }
                .pc-template-actions { display: flex; gap: 4px; }
                .pc-template-icon-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); transition: all var(--transition); }
                .pc-template-icon-btn:hover { background: #f1f5f9; color: var(--text-secondary); border-color: #cbd5e1; }
                .pc-template-icon-btn--danger:hover { background: #fef2f2; color: var(--danger); border-color: #fecaca; }
                .pc-template-comment { font-size: 0.84rem; color: var(--text-secondary); line-height: 1.5; margin: 0; }
                .pc-template-edit-area { margin-top: 4px; }
                .pc-template-input-row { display: flex; gap: 8px; margin-bottom: 8px; }
                .pc-template-input-group { flex: 1; display: flex; flex-direction: column; gap: 3px; }
                .pc-template-input-label { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
                .pc-template-input { width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 0.84rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; }
                .pc-template-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
                .pc-template-textarea { width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 0.84rem; color: var(--text); outline: none; resize: vertical; min-height: 60px; font-family: inherit; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; }
                .pc-template-textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
                .pc-template-edit-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }

                .pc-add-template-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-sm); border: 1px dashed #cbd5e1; background: none; color: var(--text-secondary); font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all var(--transition); }
                .pc-add-template-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
                .pc-add-template-btn svg { width: 15px; height: 15px; }

                .pc-templates-notice { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 14px; background: #f8fafc; border-radius: var(--radius-sm); font-size: 0.78rem; color: var(--text-muted); }
                .pc-templates-notice svg { flex-shrink: 0; color: var(--primary); }

                /* ===== FILTERS ===== */
                .pc-filters { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 24px; }
                .pc-filter-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
                .pc-filter-field { display: flex; flex-direction: column; gap: 5px; }
                .pc-filter-field label { font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
                .pc-optional { font-weight: 400; color: var(--text-muted); text-transform: none; }
                .pc-select-wrap { position: relative; }
                .pc-select-wrap svg { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
                .pc-select { width: 100%; padding: 10px 36px 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; -webkit-appearance: none; appearance: none; font-family: inherit; cursor: pointer; }
                .pc-select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
                .pc-select option { color: var(--text); background: var(--surface); }

                /* ===== GENERATE CONFIRM BAR ===== */
                .pc-generate-confirm { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 24px; background: var(--warning-light); border-bottom: 1px solid #fde68a; animation: pcSlideDown 0.25s ease; flex-wrap: wrap; }
                .pc-generate-confirm-inner { display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #92400e; }
                .pc-generate-confirm-actions { display: flex; gap: 8px; }

                /* ===== RESULTS INFO ===== */
                .pc-results-info { display: flex; align-items: center; padding: 12px 24px; font-size: 0.82rem; color: var(--text-muted); }
                .pc-results-count strong { color: var(--text-secondary); font-weight: 700; }

                /* ===== LOADING ===== */
                .pc-table-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 80px 24px; color: var(--text-muted); font-size: 0.88rem; }
                .pc-inline-loader { display: flex; gap: 6px; }
                .pc-loader-ring { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); opacity: 0.3; animation: pcBounce 1.2s ease-in-out infinite; }
                .pc-loader-ring:nth-child(2) { animation-delay: 0.15s; }
                .pc-loader-ring:nth-child(3) { animation-delay: 0.3s; }
                @keyframes pcBounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }

                /* ===== EMPTY STATE ===== */
                .pc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; text-align: center; color: var(--text-muted); }
                .pc-empty-illustration { width: 72px; height: 72px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #cbd5e1; }
                .pc-empty h3 { font-size: 1.05rem; font-weight: 700; color: var(--text-secondary); margin: 0 0 6px; }
                .pc-empty p { font-size: 0.85rem; margin: 0; max-width: 340px; line-height: 1.5; }

                /* ===== COMMENT LIST ===== */
                .pc-list { padding: 12px 24px; display: flex; flex-direction: column; gap: 10px; }
                .pc-card { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid transparent; border-radius: var(--radius); padding: 16px; transition: all var(--transition); animation: pcRowIn 0.3s ease both; }
                .pc-card--editing { border-color: var(--primary); border-left-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
                @keyframes pcRowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

                .pc-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
                .pc-student-block { display: flex; align-items: center; gap: 12px; min-width: 0; }
                .pc-avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; letter-spacing: 0.02em; }
                .pc-student-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
                .pc-student-name { font-weight: 600; font-size: 0.92rem; color: var(--text); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .pc-student-id { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; }
                .pc-card-top-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

                /* ===== PERCENTAGE BADGE ===== */
                .pc-percentage-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; font-variant-numeric: tabular-nums; }
                .pc-card-index { font-size: 0.72rem; color: var(--text-muted); font-weight: 600; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }

                /* ===== COMMENT BODY ===== */
                .pc-comment-body { margin-bottom: 12px; }
                .pc-comment-text { font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6; margin: 0; }

                /* ===== TEACHER REF ===== */
                .pc-teacher-ref { padding: 10px 14px; background: #f8fafc; border-radius: var(--radius-sm); margin-bottom: 12px; }
                .pc-teacher-ref-label { display: flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-bottom: 4px; }
                .pc-teacher-ref-label svg { color: var(--text-muted); }
                .pc-teacher-ref-text { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin: 0; font-style: italic; }

                /* ===== EDIT AREA ===== */
                .pc-edit-area { margin-bottom: 12px; }
                .pc-textarea-wrap { position: relative; margin-bottom: 8px; }
                .pc-textarea { width: 100%; padding: 12px 14px; padding-right: 70px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; resize: vertical; min-height: 80px; font-family: inherit; line-height: 1.5; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; }
                .pc-textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
                .pc-textarea-count { position: absolute; bottom: 10px; right: 12px; font-size: 0.7rem; color: var(--text-muted); font-weight: 500; font-variant-numeric: tabular-nums; }
                .pc-quick-templates { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
                .pc-quick-templates-label { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
                .pc-quick-template-btn { padding: 3px 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--surface); font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: all var(--transition); }
                .pc-quick-template-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }
                .pc-edit-actions { display: flex; gap: 8px; justify-content: flex-end; }

                /* ===== CARD ACTIONS ===== */
                .pc-card-actions { display: flex; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border); }
                .pc-action-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; border: 1px solid; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all var(--transition); background: var(--surface); }
                .pc-action-btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
                .pc-action-btn:active { transform: scale(0.97); }
                .pc-action-btn--edit { border-color: #bfdbfe; color: #1d4ed8; }
                .pc-action-btn--edit:hover { background: #eff6ff; }
                .pc-action-btn--delete { border-color: #fecaca; color: #dc2626; }
                .pc-action-btn--delete:hover { background: #fef2f2; }
                .pc-action-btn svg { width: 13px; height: 13px; }
                .pc-confirm-row { display: flex; align-items: center; gap: 8px; flex: 1; }
                .pc-confirm-text { font-size: 0.82rem; color: var(--text-secondary); font-weight: 500; flex: 1; }

                /* ===== RESPONSIVE ===== */
                @media (min-width: 768px) {
                    .pc-header { padding: 24px 32px; }
                    .pc-templates-panel { padding: 20px 32px; }
                    .pc-filters { padding: 16px 32px; }
                    .pc-generate-confirm { padding: 14px 32px; }
                    .pc-results-info { padding: 12px 32px; }
                    .pc-list { padding: 12px 32px; }
                }

                @media (max-width: 767px) {
                    .pc-header { padding: 16px; }
                    .pc-header-content { flex-direction: column; align-items: flex-start; }
                    .pc-header-actions { width: 100%; }
                    .pc-header-actions .pc-btn { flex: 1; justify-content: center; padding: 10px 10px; font-size: 0.78rem; }
                    .pc-title { font-size: 1.15rem; }
                    .pc-header-icon { width: 38px; height: 38px; border-radius: 10px; }
                    .pc-header-icon svg { width: 22px; height: 22px; }
                    .pc-templates-panel { padding: 16px; }
                    .pc-templates-header { flex-direction: column; }
                    .pc-templates-grid { grid-template-columns: 1fr; }
                    .pc-filters { padding: 14px 16px; }
                    .pc-filter-row { grid-template-columns: 1fr; }
                    .pc-generate-confirm { padding: 12px 16px; flex-direction: column; align-items: flex-start; }
                    .pc-generate-confirm-actions { width: 100%; }
                    .pc-generate-confirm-actions .pc-btn-sm { flex: 1; justify-content: center; }
                    .pc-results-info { padding: 10px 16px; }
                    .pc-list { padding: 10px 16px; }
                    .pc-quick-templates { display: none; }
                    .pc-toasts { left: 16px; right: 16px; max-width: none; }
                }

                @media (max-width: 420px) {
                    .pc-header-actions { flex-direction: column; }
                    .pc-confirm-row { flex-direction: column; align-items: stretch; }
                }

                /* ===== SCROLLBAR ===== */
                .pc-root ::-webkit-scrollbar { width: 6px; height: 6px; }
                .pc-root ::-webkit-scrollbar-track { background: transparent; }
                .pc-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                .pc-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>

            {/* ===== TOASTS ===== */}
            <div className="pc-toasts">
                {error && (
                    <div className="pc-toast pc-toast--error" key={`err-${Date.now()}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="pc-toast pc-toast--success" key={`suc-${Date.now()}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>{success}</span>
                    </div>
                )}
            </div>

            {/* ===== HEADER ===== */}
            <header className="pc-header">
                <div className="pc-header-content">
                    <div className="pc-header-text">
                        <div className="pc-header-icon">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="pc-title">Principal Comments</h1>
                            <p className="pc-subtitle">Set custom percentage ranges and comments, then generate for all students</p>
                        </div>
                    </div>
                    <div className="pc-header-actions">
                        <button className={`pc-btn ${showPanel ? 'pc-btn-primary' : 'pc-btn-ghost'}`} onClick={showPanel ? closePanel : () => setShowPanel(true)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}>
                                <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
                            </svg>
                            {showPanel ? 'Close Panel' : 'Set Comments'}
                        </button>
                        <button className="pc-btn pc-btn-success" onClick={() => setConfirmGenerate(true)} disabled={generating || !termId || !sessionId}>
                            {generating ? (
                                <><div className="pc-btn-spinner" /> Generating...</>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}>
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                </svg>
                            )}
                            {!generating && 'Generate for Students'}
                        </button>
                    </div>
                </div>
            </header>

            {/* ===== TEMPLATES PANEL ===== */}
            {showPanel && (
                <div className="pc-templates-panel">
                    <div className="pc-templates-header">
                        <div>
                            <h3 className="pc-templates-title">Set Comments by Percentage Range</h3>
                            <p className="pc-templates-subtitle">Define the percentage range and comment for each bracket. Changes are saved locally until you generate.</p>
                        </div>
                        <div className="pc-templates-actions">
                            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={resetToDefaults}>Reset Default</button>
                            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={saveAllTemplates}>Save Templates</button>
                        </div>
                    </div>

                    <div className="pc-templates-grid">
                        {templates.map((template, index) => {
                            const rc = getRangeColor(template.min);
                            return (
                                <div
                                    key={template.id}
                                    className={`pc-template-card ${editIndex === index ? 'pc-template-card--editing' : ''}`}
                                    style={{ borderLeftColor: rc.color }}
                                >
                                    <div className="pc-template-card-header">
                                        <div className="pc-template-range">
                                            <span className="pc-template-label" style={{ color: rc.color }}>{template.label}</span>
                                            <span className="pc-template-percentage">{template.range}%</span>
                                        </div>
                                        <div className="pc-template-actions">
                                            {editIndex === index ? (
                                                <button onClick={() => { setEditIndex(null); setEditValue(''); setEditMin(''); setEditMax(''); }} className="pc-btn pc-btn-ghost pc-btn-sm" style={{ padding: '4px 8px', fontSize: '0.72rem' }}>Cancel</button>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(index)} className="pc-template-icon-btn" title="Edit">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button onClick={() => removeTemplate(index)} className="pc-template-icon-btn pc-template-icon-btn--danger" title="Delete">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {editIndex === index ? (
                                        <div className="pc-template-edit-area">
                                            <div className="pc-template-input-row">
                                                <div className="pc-template-input-group">
                                                    <span className="pc-template-input-label">Min %</span>
                                                    <input type="number" min="0" max="100" value={editMin} onChange={(e) => setEditMin(e.target.value)} className="pc-template-input" />
                                                </div>
                                                <div className="pc-template-input-group">
                                                    <span className="pc-template-input-label">Max %</span>
                                                    <input type="number" min="0" max="100" value={editMax} onChange={(e) => setEditMax(e.target.value)} className="pc-template-input" />
                                                </div>
                                            </div>
                                            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} className="pc-template-textarea" placeholder="Write your custom comment here..." autoFocus />
                                            <div className="pc-template-edit-actions">
                                                <button onClick={() => { setEditIndex(null); setEditValue(''); setEditMin(''); setEditMax(''); }} className="pc-btn pc-btn-ghost pc-btn-sm">Cancel</button>
                                                <button onClick={saveEdit} className="pc-btn pc-btn-primary pc-btn-sm">Apply</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="pc-template-comment">{template.comment}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <button onClick={addTemplate} className="pc-add-template-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add New Range
                    </button>

                    <div className="pc-templates-notice">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <span>Edit any range above, click Apply, then click Generate for Students</span>
                    </div>
                </div>
            )}

            {/* ===== FILTERS ===== */}
            <div className="pc-filters">
                <div className="pc-filter-row">
                    <div className="pc-filter-field">
                        <label htmlFor="pc-term">Term</label>
                        <div className="pc-select-wrap">
                            <select id="pc-term" value={termId} onChange={(e) => setTermId(e.target.value)} className="pc-select">
                                <option value="">Select Term</option>
                                {terms.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                    <div className="pc-filter-field">
                        <label htmlFor="pc-session">Session</label>
                        <div className="pc-select-wrap">
                            <select id="pc-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="pc-select">
                                <option value="">Select Session</option>
                                {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                    <div className="pc-filter-field">
                        <label htmlFor="pc-class">Class <span className="pc-optional">(optional)</span></label>
                        <div className="pc-select-wrap">
                            <select id="pc-class" value={classId} onChange={(e) => setClassId(e.target.value)} className="pc-select">
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c._id} value={c._id}>{c.name} {c.section}</option>)}
                            </select>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== GENERATE CONFIRM ===== */}
            {confirmGenerate && (
                <div className="pc-generate-confirm">
                    <div className="pc-generate-confirm-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>Apply your custom percentage-based comments to all students?</span>
                    </div>
                    <div className="pc-generate-confirm-actions">
                        <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setConfirmGenerate(false)}>Cancel</button>
                        <button className="pc-btn pc-btn-success pc-btn-sm" onClick={handleGenerate} disabled={generating}>
                            {generating ? <><div className="pc-btn-spinner" /> Wait...</> : 'Generate'}
                        </button>
                    </div>
                </div>
            )}

            {/* ===== RESULTS INFO ===== */}
            {!loading && comments.length > 0 && (
                <div className="pc-results-info">
                    <span className="pc-results-count"><strong>{comments.length}</strong> comment{comments.length !== 1 ? 's' : ''}</span>
                </div>
            )}

            {/* ===== CONTENT ===== */}
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
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                    </div>
                    <h3>No Comments Yet</h3>
                    <p>Click Set Comments to customize percentage ranges, then Generate for Students.</p>
                </div>
            ) : (
                <div className="pc-list">
                    {comments.map((comment, index) => {
                        const matched = findTemplate(comment.comment);
                        const rc = matched ? getRangeColor(matched.min) : null;
                        const studentName = `${comment.studentId?.firstName || ''} ${comment.studentId?.lastName || ''}`.trim();

                        return (
                            <div
                                key={comment._id}
                                className={`pc-card ${editingComment === comment._id ? 'pc-card--editing' : ''}`}
                                style={{
                                    animationDelay: `${index * 0.04}s`,
                                    borderLeftColor: rc ? rc.color : '#e2e8f0'
                                }}
                            >
                                <div className="pc-card-top">
                                    <div className="pc-student-block">
                                        <div className="pc-avatar" style={{ background: getAvatarColor(studentName) }}>
                                            {getInitials(comment.studentId?.firstName, comment.studentId?.lastName)}
                                        </div>
                                        <div className="pc-student-info">
                                            <span className="pc-student-name">
                                                {comment.studentId?.firstName || ''}{' '}
                                                {comment.studentId?.lastName || ''}
                                            </span>
                                            <span className="pc-student-id">{comment.studentId?.admissionNumber || ''}</span>
                                        </div>
                                    </div>
                                    <div className="pc-card-top-right">
                                        {comment.percentage !== undefined && comment.percentage !== null && (
                                            <span className="pc-percentage-badge" style={{
                                                backgroundColor: rc ? rc.bg : '#f1f5f9',
                                                color: rc ? rc.color : 'var(--text-secondary)'
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
                                                    style={{ borderColor: getRangeColor(t.min).border, color: getRangeColor(t.min).color }}
                                                    onClick={() => setEditText(t.comment)}
                                                >
                                                    {t.range}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="pc-edit-actions">
                                            <button onClick={() => setEditingComment(null)} className="pc-btn pc-btn-ghost pc-btn-sm">Discard</button>
                                            <button onClick={saveEditComment} className="pc-btn pc-btn-primary pc-btn-sm">Save Comment</button>
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
                                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z"/>
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
                                                <button className="pc-btn pc-btn-danger pc-btn-sm" onClick={() => deleteComment(comment._id)}>Yes, Delete</button>
                                                <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                                            </div>
                                        ) : (
                                            <>
                                                <button className="pc-action-btn pc-action-btn--edit" onClick={() => startEditComment(comment)} title="Edit comment">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    Edit
                                                </button>
                                                <button className="pc-action-btn pc-action-btn--delete" onClick={() => setDeleteConfirm(comment._id)} title="Delete comment">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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