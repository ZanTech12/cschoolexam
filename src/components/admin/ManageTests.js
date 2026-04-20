import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testsAPI, classesAPI, subjectsAPI, questionSetsAPI, dashboardAPI, authAPI } from '../../api';
import Loading from '../common/Loading';

const ManageTests = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [showModalScrollBtn, setShowModalScrollBtn] = useState(false);
  const [success, setSuccess] = useState('');
  const modalBodyRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '', classId: '', subjectId: '', duration: 60,
    startDate: '', endDate: '', passMark: 50, instructions: '',
    questions: [], questionSetId: '',
  });
  const [error, setError] = useState('');
  const [selectedQuestionSet, setSelectedQuestionSet] = useState('');

  const { data: currentUserData, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'], queryFn: authAPI.getCurrentUser,
    staleTime: 1000 * 60 * 5, retry: false,
  });

  const currentUser = currentUserData?.data;
  const currentUserId = currentUser?._id;
  const isTeacher = currentUser?.role === 'teacher';

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['my-teacher-assignments'], queryFn: dashboardAPI.getTeacherAssignments,
    enabled: isTeacher && !!currentUserId,
  });

  const { data: tests, isLoading: testsLoading } = useQuery({ queryKey: ['tests'], queryFn: testsAPI.getAll });
  const { data: classes, isLoading: classesLoading } = useQuery({ queryKey: ['classes'], queryFn: () => classesAPI.getAll({ limit: 100 }) });
  const { data: subjects, isLoading: subjectsLoading } = useQuery({ queryKey: ['subjects'], queryFn: subjectsAPI.getAll });
  const { data: questionSets, isLoading: qsLoading } = useQuery({
    queryKey: ['questionSets', formData.classId, formData.subjectId],
    queryFn: () => questionSetsAPI.getAll({ classId: formData.classId, subjectId: formData.subjectId }),
    enabled: !!formData.classId && !!formData.subjectId,
  });

  const myAssignments = useMemo(() => {
    if (!isTeacher || !assignmentsData?.data || !currentUserId) return [];
    return assignmentsData.data.filter((a) => {
      const aT = a.teacher_id?._id || a.teacherId?._id;
      return aT === currentUserId;
    });
  }, [isTeacher, assignmentsData, currentUserId]);

  const classSubjectMap = useMemo(() => {
    const map = {};
    myAssignments.forEach((a) => {
      const cId = a.class_id?._id || a.classId?._id;
      const sId = a.subject_id?._id || a.subjectId?._id;
      if (cId && sId) { if (!map[cId]) map[cId] = []; if (!map[cId].includes(sId)) map[cId].push(sId); }
    });
    return map;
  }, [myAssignments]);

  const allowedClassIds = useMemo(() => {
    if (!isTeacher) return null;
    return [...new Set(myAssignments.map(a => a.class_id?._id || a.classId?._id).filter(Boolean))];
  }, [isTeacher, myAssignments]);

  const allowedSubjectIds = useMemo(() => {
    if (!isTeacher) return null;
    return [...new Set(myAssignments.map(a => a.subject_id?._id || a.subjectId?._id).filter(Boolean))];
  }, [isTeacher, myAssignments]);

  const myClasses = useMemo(() => {
    if (!classes?.data) return [];
    if (!isTeacher || !allowedClassIds) return classes.data;
    return classes.data.filter(c => allowedClassIds.includes(c._id));
  }, [classes, isTeacher, allowedClassIds]);

  const mySubjectsForForm = useMemo(() => {
    if (!subjects?.data) return [];
    if (!isTeacher) return subjects.data;
    if (!formData.classId) {
      if (!allowedSubjectIds) return subjects.data;
      return subjects.data.filter(s => allowedSubjectIds.includes(s._id));
    }
    const allowed = classSubjectMap[formData.classId] || [];
    return subjects.data.filter(s => allowed.includes(s._id));
  }, [subjects, isTeacher, formData.classId, classSubjectMap, allowedSubjectIds]);

  const myTests = useMemo(() => {
    if (!tests?.data) return [];
    if (!isTeacher || myAssignments.length === 0) return tests.data;
    return tests.data.filter((test) => {
      const tC = test.classId?._id || test.classId;
      const tS = test.subjectId?._id || test.subjectId;
      return myAssignments.some(a => {
        const aC = a.class_id?._id || a.classId?._id;
        const aS = a.subject_id?._id || a.subjectId?._id;
        return aC === tC && aS === tS;
      });
    });
  }, [tests, isTeacher, myAssignments]);

  const hasNoAssignments = isTeacher && myAssignments.length === 0 && !assignmentsLoading;

  useEffect(() => { if (success || error) { const t = setTimeout(() => { setSuccess(''); setError(''); }, 5000); return () => clearTimeout(t); } }, [success, error]);

  const createMutation = useMutation({
    mutationFn: testsAPI.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tests'] }); setSuccess(editingTest ? 'Test updated successfully' : 'Test created successfully'); handleCloseModal(); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create test'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => testsAPI.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tests'] }); setSuccess('Test updated successfully'); handleCloseModal(); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update test'),
  });

  const deleteMutation = useMutation({
    mutationFn: testsAPI.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tests'] }); setSuccess('Test deleted'); },
  });

  const publishMutation = useMutation({
    mutationFn: testsAPI.publishResults,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tests'] }); setSuccess('Results published'); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to publish'),
  });

  const unpublishMutation = useMutation({
    mutationFn: testsAPI.unpublishResults,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tests'] }); setSuccess('Results unpublished'); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to unpublish'),
  });

  const handleModalScroll = () => {
    if (!modalBodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = modalBodyRef.current;
    setShowModalScrollBtn(scrollTop > 50 && scrollTop + clientHeight < scrollHeight - 50);
  };
  const scrollModalToBottom = () => { modalBodyRef.current?.scrollTo({ top: modalBodyRef.current.scrollHeight, behavior: 'smooth' }); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'classId') {
      setFormData({ ...formData, [name]: value, subjectId: '', questions: [], questionSetId: '' });
      setSelectedQuestionSet('');
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setError('');
  };

  const handleQuestionSetSelect = (e) => {
    const qsId = e.target.value;
    setSelectedQuestionSet(qsId);
    if (qsId) {
      const qs = questionSets?.data?.find(q => q._id === qsId);
      if (qs) setFormData({ ...formData, questions: qs.questions, questionSetId: qsId });
    } else {
      setFormData({ ...formData, questions: [] });
    }
  };

  const handleOpenCreate = () => {
    if (isTeacher && myAssignments.length === 0) { setError('No class/subject assignments. Contact admin.'); return; }
    setEditingTest(null);
    setFormData({ title: '', classId: '', subjectId: '', duration: 60, startDate: '', endDate: '', passMark: 50, instructions: '', questions: [], questionSetId: '' });
    setSelectedQuestionSet(''); setError(''); setSuccess(''); setShowModalScrollBtn(false); setShowModal(true);
  };

  const handleOpenEdit = (test) => {
    if (isTeacher) {
      const tC = test.classId?._id || test.classId;
      const tS = test.subjectId?._id || test.subjectId;
      const canEdit = myAssignments.some(a => (a.class_id?._id || a.classId?._id) === tC && (a.subject_id?._id || a.subjectId?._id) === tS);
      if (!canEdit) { setError('No permission to edit this test.'); return; }
    }
    setEditingTest(test);
    setFormData({
      title: test.title || '', classId: test.classId?._id || '', subjectId: test.subjectId?._id || '',
      duration: test.duration || 60,
      startDate: test.startDate ? new Date(test.startDate).toISOString().slice(0, 16) : '',
      endDate: test.endDate ? new Date(test.endDate).toISOString().slice(0, 16) : '',
      passMark: test.passMark || 50, instructions: test.instructions || '',
      questions: test.questions || [], questionSetId: '',
    });
    setSelectedQuestionSet(''); setError(''); setSuccess(''); setShowModalScrollBtn(false); setShowModal(true);
  };

  const handleCloseModal = () => { setShowModal(false); setEditingTest(null); setError(''); setSuccess(''); setShowModalScrollBtn(false); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isTeacher) {
      const ok = myAssignments.some(a => (a.class_id?._id || a.classId?._id) === formData.classId && (a.subject_id?._id || a.subjectId?._id) === formData.subjectId);
      if (!ok) { setError('Not assigned to this class and subject.'); return; }
    }
    const data = { ...formData, duration: parseInt(formData.duration), passMark: parseInt(formData.passMark) };
    if (editingTest) updateMutation.mutate({ id: editingTest._id, data });
    else createMutation.mutate(data);
  };

  const handleDelete = (test) => {
    if (isTeacher) {
      const tC = test.classId?._id || test.classId;
      const tS = test.subjectId?._id || test.subjectId;
      if (!myAssignments.some(a => (a.class_id?._id || a.classId?._id) === tC && (a.subject_id?._id || a.subjectId?._id) === tS)) { alert('No permission to delete.'); return; }
    }
    if (window.confirm(`Delete "${test.title}"?`)) deleteMutation.mutate(test._id);
  };

  const handlePublish = (id) => { if (window.confirm('Publish results? Students will see their scores.')) publishMutation.mutate(id); };
  const handleUnpublish = (id) => { if (window.confirm('Unpublish results?')) unpublishMutation.mutate(id); };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getStatusMeta = (test) => {
    const now = new Date();
    const s = new Date(test.startDate);
    const e = new Date(test.endDate);
    if (now < s) return { label: 'Upcoming', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', dot: '#60a5fa' };
    if (now >= s && now <= e) return { label: 'Active', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', dot: '#34d399' };
    return { label: 'Expired', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8' };
  };

  if (userLoading || testsLoading || classesLoading || subjectsLoading || assignmentsLoading) return <Loading message="Loading tests..." />;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mt-root">
      <style>{`
        .mt-root {
          --bg: #f1f5f9; --surface: #ffffff; --border: #e2e8f0; --text: #0f172a; --text-secondary: #475569; --text-muted: #94a3b8;
          --primary: #4f46e5; --primary-hover: #4338ca; --primary-light: #eef2ff; --primary-50: #eef2ff;
          --danger: #ef4444; --danger-hover: #dc2626; --success: #10b981; --success-light: #ecfdf5;
          --warning: #f59e0b; --warning-light: #fffbeb; --amber: #f59e0b;
          --radius: 14px; --radius-sm: 10px; --radius-xs: 6px;
          --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          --shadow: 0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          --shadow-md: 0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
          --shadow-lg: 0 12px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04);
          --shadow-xl: 0 20px 40px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.06);
          --transition: 180ms cubic-bezier(0.4, 0, 0.2, 1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: var(--text); -webkit-font-smoothing: antialiased; background: var(--bg); min-height: 100vh;
        }

        /* ===== HEADER ===== */
        .mt-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; position: sticky; top: 0; z-index: 30; }
        .mt-header::after { content: ''; position: absolute; bottom: -1px; left: 24px; right: 24px; height: 1px; background: linear-gradient(90deg, transparent, var(--primary) 20%, var(--primary) 80%, transparent); opacity: 0.15; }
        .mt-header-inner { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .mt-header-left { display: flex; align-items: center; gap: 16px; }
        .mt-header-icon { width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0; background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 4px 12px rgba(79,70,229,0.3); }
        .mt-header-title { font-size: 1.4rem; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.03em; }
        .mt-header-sub { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; font-weight: 500; }

        /* ===== BUTTONS ===== */
        .mt-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; transition: all var(--transition); white-space: nowrap; line-height: 1.4; font-family: inherit; position: relative; overflow: hidden; }
        .mt-btn::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 60%); pointer-events: none; }
        .mt-btn:active { transform: scale(0.97); }
        .mt-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none !important; }
        .mt-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
        .mt-btn-primary { background: linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%); color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,0.3); }
        .mt-btn-primary:hover { box-shadow: 0 4px 16px rgba(79,70,229,0.4); transform: translateY(-1px); }
        .mt-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
        .mt-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; box-shadow: var(--shadow-xs); }
        .mt-btn-danger-outline { background: var(--surface); color: var(--danger); border: 1px solid #fecaca; }
        .mt-btn-danger-outline:hover { background: #fef2f2; border-color: #fca5a5; }
        .mt-btn-danger { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #fff; box-shadow: 0 2px 8px rgba(239,68,68,0.25); }
        .mt-btn-danger:hover { box-shadow: 0 4px 16px rgba(239,68,68,0.35); transform: translateY(-1px); }
        .mt-btn-success-outline { background: var(--surface); color: #166534; border: 1px solid #a7f3d0; }
        .mt-btn-success-outline:hover { background: #ecfdf5; border-color: #6ee7b7; }
        .mt-btn-warning-outline { background: var(--surface); color: #92400e; border: 1px solid #fde68a; }
        .mt-btn-warning-outline:hover { background: var(--warning-light); }
        .mt-btn-sm { padding: 6px 11px; font-size: 0.76rem; border-radius: var(--radius-xs); }
        .mt-btn-sm svg { width: 12px; height: 12px; }
        .mt-btn-xs { padding: 4px 9px; font-size: 0.72rem; border-radius: 5px; }
        .mt-btn-xs svg { width: 11px; height: 11px; }
        .mt-btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: mtSpin 0.6s linear infinite; flex-shrink: 0; }
        @keyframes mtSpin { to { transform: rotate(360deg); } }

        /* ===== TOASTS ===== */
        .mt-toasts { position: fixed; top: 16px; right: 16px; z-index: 200; display: flex; flex-direction: column; gap: 8px; pointer-events: none; max-width: 380px; }
        .mt-toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500; box-shadow: var(--shadow-lg); animation: mtToastIn 0.3s cubic-bezier(0.16,1,0.3,1); }
        .mt-toast--success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
        .mt-toast--error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        @keyframes mtToastIn { from { opacity: 0; transform: translateX(20px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }

        /* ===== BADGES ===== */
        .mt-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
        .mt-badge-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        /* ===== ASSIGNMENT BAR ===== */
        .mt-assign-bar { display: flex; align-items: center; gap: 12px; padding: 14px 24px; background: var(--surface); border-bottom: 1px solid var(--border); overflow-x: auto; }
        .mt-assign-label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); white-space: nowrap; display: flex; align-items: center; gap: 6px; }
        .mt-assign-chips { display: flex; gap: 6px; flex-wrap: nowrap; }
        .mt-assign-chip { display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 20px; font-size: 0.76rem; font-weight: 600; background: var(--primary-light); color: #4338ca; white-space: nowrap; border: 1px solid #c7d2fe; }
        .mt-assign-chip--none { background: #fef2f2; color: #991b1b; border-color: #fecaca; }

        /* ===== STATS BAR ===== */
        .mt-stats { display: flex; gap: 12px; padding: 14px 24px; background: var(--bg); border-bottom: 1px solid var(--border); overflow-x: auto; }
        .mt-stat-chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.82rem; color: var(--text-secondary); font-weight: 500; white-space: nowrap; }
        .mt-stat-chip strong { color: var(--text); font-weight: 700; font-variant-numeric: tabular-nums; }
        .mt-stat-chip svg { width: 15px; height: 15px; color: var(--text-muted); flex-shrink: 0; }

        /* ===== LOCKED ===== */
        .mt-locked { background: var(--surface); border: 1px solid #fde68a; border-radius: var(--radius); padding: 40px 24px; text-align: center; margin: 16px 24px; }
        .mt-locked-icon { width: 56px; height: 56px; border-radius: 50%; background: #fef3c7; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .mt-locked h3 { font-size: 1.05rem; font-weight: 700; color: #92400e; margin: 0 0 6px; }
        .mt-locked p { font-size: 0.88rem; color: #b45309; margin: 0; line-height: 1.5; max-width: 380px; margin-left: auto; margin-right: auto; }

        /* ===== TABLE ===== */
        .mt-table-section { background: var(--surface); min-height: 200px; }
        .mt-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .mt-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; min-width: 960px; }
        .mt-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 5; }
        .mt-table th { padding: 12px 14px; text-align: left; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
        .mt-table td { padding: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .mt-table tbody tr { transition: background var(--transition); animation: mtRowIn 0.35s ease both; }
        .mt-table tbody tr:hover { background: #fafaff; }
        .mt-table tbody tr:last-child td { border-bottom: none; }
        @keyframes mtRowIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .mt-empty { text-align: center; padding: 56px 24px; color: var(--text-muted); }
        .mt-table-actions { display: flex; gap: 4px; }
        .mt-td-title { font-weight: 700; font-size: 0.88rem; color: var(--text); }
        .mt-td-sub { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
        .mt-td-muted { color: var(--text-secondary); font-size: 0.84rem; }
        .mt-td-date { font-size: 0.82rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .mt-td-dur { display: inline-flex; align-items: center; gap: 4px; font-size: 0.82rem; color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
        .mt-td-dur svg { width: 13px; height: 13px; color: var(--text-muted); }

        /* ===== MOBILE CARDS ===== */
        .mt-cards { display: none; flex-direction: column; gap: 10px; padding: 12px 16px; }
        .mt-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; transition: all var(--transition); animation: mtRowIn 0.35s ease both; position: relative; overflow: hidden; }
        .mt-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--primary), #7c3aed); opacity: 0.6; }
        .mt-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .mt-card-title { font-weight: 700; font-size: 0.98rem; color: var(--text); line-height: 1.3; }
        .mt-card-badges { display: flex; gap: 5px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
        .mt-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .mt-card-field { display: flex; flex-direction: column; gap: 3px; }
        .mt-card-field-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
        .mt-card-field-value { font-size: 0.84rem; color: var(--text); font-weight: 500; }
        .mt-card-actions { display: flex; gap: 6px; padding-top: 14px; border-top: 1px solid var(--border); flex-wrap: wrap; }
        .mt-card-actions .mt-btn { flex: 1; justify-content: center; min-width: 0; }

        /* ===== MODAL ===== */
        .mt-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55); backdrop-filter: blur(6px); z-index: 100; display: flex; align-items: center; justify-content: center; animation: mtFadeIn 0.2s ease; }
        @keyframes mtFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .mt-modal { background: var(--surface); border-radius: 20px; width: 100%; max-width: 680px; max-height: 92vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); animation: mtModalIn 0.35s cubic-bezier(0.16,1,0.3,1); }
        @keyframes mtModalIn { from { opacity: 0; transform: scale(0.95) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .mt-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: #cbd5e1; margin: 10px auto 0; }
        .mt-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 28px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .mt-modal-title { font-size: 1.2rem; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.02em; }
        .mt-modal-close { width: 34px; height: 34px; border-radius: 50%; border: none; background: #f1f5f9; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 1.3rem; transition: all var(--transition); }
        .mt-modal-close:hover { background: #e2e8f0; color: var(--text); transform: rotate(90deg); }
        .mt-modal-body { flex: 1; overflow-y: auto; padding: 24px 28px; position: relative; }
        .mt-modal-footer { display: flex; gap: 10px; padding: 16px 28px; border-top: 1px solid var(--border); justify-content: flex-end; flex-wrap: wrap; flex-shrink: 0; }

        /* ===== ALERTS ===== */
        .mt-alert { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; animation: mtSlideDown 0.3s cubic-bezier(0.16,1,0.3,1); }
        .mt-alert-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        @keyframes mtSlideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        /* ===== FORM ===== */
        .mt-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .mt-form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .mt-form-group { display: flex; flex-direction: column; gap: 6px; }
        .mt-form-group.full { grid-column: 1 / -1; }
        .mt-form-label { font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.01em; display: flex; align-items: center; gap: 6px; }
        .mt-form-hint { font-size: 0.72rem; font-weight: 400; color: var(--text-muted); }
        .mt-form-hint--err { color: #dc2626; }
        .mt-form-input, .mt-form-select, .mt-form-textarea { width: 100%; padding: 11px 14px; border-radius: var(--radius-sm); border: 1.5px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; -webkit-appearance: none; appearance: none; font-family: inherit; }
        .mt-form-input::placeholder, .mt-form-textarea::placeholder { color: var(--text-muted); }
        .mt-form-input:focus, .mt-form-select:focus, .mt-form-textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
        .mt-form-input:disabled, .mt-form-select:disabled { background: #f8fafc; color: var(--text-muted); cursor: not-allowed; }
        .mt-form-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; cursor: pointer; }
        .mt-form-select option { color: var(--text); background: var(--surface); }
        .mt-form-textarea { resize: vertical; min-height: 72px; line-height: 1.6; }
        .mt-form-qs-loaded { display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 600; color: #166534; background: #ecfdf5; padding: 3px 10px; border-radius: 20px; border: 1px solid #a7f3d0; margin-top: 4px; }

        /* ===== SCROLL BTN ===== */
        .mt-scroll-btn { position: absolute; bottom: 20px; right: 20px; width: 46px; height: 46px; border-radius: 50%; border: none; background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.4); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; opacity: 0; visibility: hidden; transform: translateY(16px); z-index: 50; }
        .mt-scroll-btn--vis { opacity: 1; visibility: visible; transform: translateY(0); }
        .mt-scroll-btn:hover { box-shadow: 0 6px 24px rgba(79,70,229,0.5); transform: translateY(-2px); }
        .mt-scroll-btn--vis:hover { transform: translateY(-2px); }
        .mt-scroll-btn svg { width: 20px; height: 20px; }

        /* ===== RESPONSIVE ===== */
        @media (min-width: 768px) {
          .mt-cards { display: none !important; }
          .mt-table-section { display: block !important; }
          .mt-header { padding: 24px 32px; }
          .mt-assign-bar { padding: 14px 32px; }
          .mt-stats { padding: 14px 32px; }
          .mt-locked { margin: 16px 32px; }
        }
        @media (max-width: 767px) {
          .mt-header { padding: 16px; }
          .mt-header-inner { flex-direction: column; align-items: flex-start; }
          .mt-header-title { font-size: 1.15rem; }
          .mt-header-icon { width: 42px; height: 42px; border-radius: 12px; }
          .mt-header-icon svg { width: 22px; height: 22px; }
          .mt-assign-bar { padding: 10px 16px; flex-direction: column; align-items: flex-start; gap: 8px; }
          .mt-stats { padding: 10px 16px; gap: 8px; }
          .mt-stat-chip { padding: 7px 11px; font-size: 0.78rem; }
          .mt-locked { margin: 12px 16px; }
          .mt-table-section { display: none !important; }
          .mt-cards { display: flex !important; }
          .mt-card-grid { grid-template-columns: 1fr 1fr; }
          .mt-form-row, .mt-form-row-3 { grid-template-columns: 1fr; }
          .mt-modal { border-radius: 20px 20px 0 0; max-height: 96vh; width: 100%; max-width: 100%; }
          .mt-modal-overlay { align-items: flex-end; }
          .mt-toasts { left: 16px; right: 16px; max-width: none; }
        }
        @media (max-width: 420px) {
          .mt-card-grid { grid-template-columns: 1fr; }
          .mt-card-actions { flex-direction: column; }
          .mt-card-actions .mt-btn { width: 100%; }
        }

        .mt-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .mt-root ::-webkit-scrollbar-track { background: transparent; }
        .mt-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .mt-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* ===== TOASTS ===== */}
      <div className="mt-toasts">
        {error && (
          <div className="mt-toast mt-toast--error" key={`err-${Date.now()}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-toast mt-toast--success" key={`suc-${Date.now()}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* ===== HEADER ===== */}
      <div className="mt-header">
        <div className="mt-header-inner">
          <div className="mt-header-left">
            <div className="mt-header-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <h1 className="mt-header-title">Tests</h1>
              <p className="mt-header-sub">
                {isTeacher
                  ? `Manage tests for your assigned classes (${myClasses.length} classes)`
                  : 'Create and manage all tests'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!(isTeacher && myAssignments.length === 0) && (
              <button className="mt-btn mt-btn-primary" onClick={handleOpenCreate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Test
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== TEACHER ASSIGNMENT BAR ===== */}
      {isTeacher && !hasNoAssignments && (
        <div className="mt-assign-bar">
          <span className="mt-assign-label">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Your Assignments:
          </span>
          <div className="mt-assign-chips">
            {myAssignments.map((a, i) => (
              <span key={a._id || i} className="mt-assign-chip">{a.class_name} — {a.subject_name}</span>
            ))}
          </div>
        </div>
      )}

      {/* ===== LOCKED ===== */}
      {hasNoAssignments && (
        <div className="mt-locked">
          <div className="mt-locked-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h3>No Assignments Found</h3>
          <p>You haven't been assigned to any class and subject combination yet. Please contact your administrator.</p>
        </div>
      )}

      {/* ===== STATS BAR (Admin only) ===== */}
      {!isTeacher && !hasNoAssignments && (
        <div className="mt-stats">
          <div className="mt-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <strong>{myTests.length}</strong> Tests
          </div>
          <div className="mt-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/></svg>
            <strong>{myTests.reduce((s, t) => s + (t.questions?.length || 0), 0)}</strong> Questions
          </div>
          <div className="mt-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <strong>{myTests.filter(t => t.resultsPublished).length}</strong> Published
          </div>
          <div className="mt-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <strong>{myTests.filter(t => { const n = new Date(); return n >= new Date(t.startDate) && n <= new Date(t.endDate); }).length}</strong> Active
          </div>
        </div>
      )}

      {/* ===== TABLE ===== */}
      {!hasNoAssignments && (
        <div className="mt-table-section">
          <div className="mt-table-wrap">
            <table className="mt-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Duration</th>
                  <th>Window</th>
                  <th>Status</th>
                  <th>Qs</th>
                  <th>Results</th>
                  <th style={{width:170}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myTests?.length === 0 ? (
                  <tr><td colSpan="9" className="mt-empty">
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'10px'}}>
                      <div style={{width:56,height:56,borderRadius:'50%',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',color:'#cbd5e1'}}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                      <span>{isTeacher ? 'No tests for your subjects' : 'No tests yet'}</span>
                    </div>
                  </td></tr>
                ) : myTests?.map((test) => {
                  const sm = getStatusMeta(test);
                  return (
                    <tr key={test._id}>
                      <td>
                        <div className="mt-td-title">{test.title}</div>
                      </td>
                      <td className="mt-td-muted">{test.classId?.name || '-'}</td>
                      <td className="mt-td-muted">{test.subjectId?.name || '-'}</td>
                      <td>
                        <span className="mt-td-dur">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {test.duration}m
                        </span>
                      </td>
                      <td>
                        <div style={{display:'flex',flexDirection:'column',gap:2}}>
                          <span className="mt-td-date">{formatDate(test.startDate)}</span>
                          <span className="mt-td-date" style={{color:'var(--text-muted)',fontSize:'0.76rem'}}>→ {formatDate(test.endDate)}</span>
                        </div>
                      </td>
                      <td>
                        <span className="mt-badge" style={{color:sm.color, backgroundColor:sm.bg, border:`1px solid ${sm.border}`}}>
                          <span className="mt-badge-dot" style={{background:sm.dot}}></span>
                          {sm.label}
                        </span>
                      </td>
                      <td style={{fontWeight:700,color:'var(--text)',fontVariantNumeric:'tabular-nums'}}>{test.questions?.length || 0}</td>
                      <td>
                        {test.resultsPublished ? (
                          <span className="mt-badge" style={{color:'#166534',background:'#ecfdf5',border:'1px solid #a7f3d0'}}>
                            <span className="mt-badge-dot" style={{background:'#34d399'}}></span>Published
                          </span>
                        ) : (
                          <span className="mt-badge" style={{color:'#64748b',background:'#f8fafc',border:'1px solid #e2e8f0'}}>
                            <span className="mt-badge-dot" style={{background:'#cbd5e1'}}></span>Draft
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="mt-table-actions">
                          <button className="mt-btn mt-btn-ghost mt-btn-xs" onClick={() => handleOpenEdit(test)} title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit
                          </button>
                          {test.resultsPublished ? (
                            <button className="mt-btn mt-btn-warning-outline mt-btn-xs" onClick={() => handleUnpublish(test._id)} title="Unpublish">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                              Hide
                            </button>
                          ) : (
                            <button className="mt-btn mt-btn-success-outline mt-btn-xs" onClick={() => handlePublish(test._id)} title="Publish">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Publish
                            </button>
                          )}
                          <button className="mt-btn mt-btn-danger-outline mt-btn-xs" onClick={() => handleDelete(test)} title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MOBILE CARDS ===== */}
      {!hasNoAssignments && (
        <div className="mt-cards">
          {myTests?.length === 0 ? (
            <div style={{textAlign:'center',padding:'56px 16px',color:'var(--text-muted)'}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',color:'#cbd5e1',margin:'0 auto 12px'}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              {isTeacher ? 'No tests for your subjects' : 'No tests yet'}
            </div>
          ) : myTests?.map((test) => {
            const sm = getStatusMeta(test);
            return (
              <div className="mt-card" key={test._id}>
                <div className="mt-card-top">
                  <span className="mt-card-title">{test.title}</span>
                  <div className="mt-card-badges">
                    <span className="mt-badge" style={{color:sm.color,backgroundColor:sm.bg,border:`1px solid ${sm.border}`}}>
                      <span className="mt-badge-dot" style={{background:sm.dot}}></span>{sm.label}
                    </span>
                    {test.resultsPublished ? (
                      <span className="mt-badge" style={{color:'#166534',background:'#ecfdf5',border:'1px solid #a7f3d0'}}>
                        <span className="mt-badge-dot" style={{background:'#34d399'}}></span>Live
                      </span>
                    ) : (
                      <span className="mt-badge" style={{color:'#64748b',background:'#f8fafc',border:'1px solid #e2e8f0'}}>Draft</span>
                    )}
                  </div>
                </div>
                <div className="mt-card-grid">
                  <div className="mt-card-field">
                    <span className="mt-card-field-label">Class</span>
                    <span className="mt-card-field-value">{test.classId?.name || '-'}</span>
                  </div>
                  <div className="mt-card-field">
                    <span className="mt-card-field-label">Subject</span>
                    <span className="mt-card-field-value">{test.subjectId?.name || '-'}</span>
                  </div>
                  <div className="mt-card-field">
                    <span className="mt-card-field-label">Duration</span>
                    <span className="mt-card-field-value">{test.duration} min</span>
                  </div>
                  <div className="mt-card-field">
                    <span className="mt-card-field-label">Questions</span>
                    <span className="mt-card-field-value">{test.questions?.length || 0}</span>
                  </div>
                  <div className="mt-card-field" style={{gridColumn:'1/-1'}}>
                    <span className="mt-card-field-label">Window</span>
                    <span className="mt-card-field-value">{formatDate(test.startDate)} → {formatDate(test.endDate)}</span>
                  </div>
                </div>
                <div className="mt-card-actions">
                  <button className="mt-btn mt-btn-ghost mt-btn-sm" onClick={() => handleOpenEdit(test)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                  {test.resultsPublished ? (
                    <button className="mt-btn mt-btn-warning-outline mt-btn-sm" onClick={() => handleUnpublish(test._id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      Unpublish
                    </button>
                  ) : (
                    <button className="mt-btn mt-btn-success-outline mt-btn-sm" onClick={() => handlePublish(test._id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><polyline points="20 6 9 17 4 12"/></svg>
                      Publish
                    </button>
                  )}
                  <button className="mt-btn mt-btn-danger-outline mt-btn-sm" onClick={() => handleDelete(test)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="mt-modal-overlay" onClick={handleCloseModal}>
          <div className="mt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mt-modal-handle" />
            <div className="mt-modal-header">
              <h3 className="mt-modal-title">{editingTest ? 'Edit Test' : 'Create New Test'}</h3>
              <button className="mt-modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <div ref={modalBodyRef} onScroll={handleModalScroll} className="mt-modal-body">
              {error && (
                <div className="mt-alert mt-alert-danger">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} id="mt-form">
                <div className="mt-form-group" style={{marginBottom:16}}>
                  <label className="mt-form-label">Test Title *</label>
                  <input type="text" name="title" className="mt-form-input" value={formData.title} onChange={handleChange} required placeholder="e.g., First Term Mathematics Exam" />
                </div>

                <div className="mt-form-row">
                  <div className="mt-form-group">
                    <label className="mt-form-label">
                      Class *
                      {isTeacher && <span className="mt-form-hint">(assigned only)</span>}
                    </label>
                    <select name="classId" className="mt-form-select" value={formData.classId} onChange={handleChange} required>
                      <option value="">Select Class</option>
                      {myClasses.map(c => <option key={c._id} value={c._id}>{c.name} — {c.section}</option>)}
                    </select>
                    {isTeacher && myClasses.length === 0 && <span className="mt-form-hint mt-form-hint--err">No classes assigned.</span>}
                  </div>
                  <div className="mt-form-group">
                    <label className="mt-form-label">
                      Subject *
                      {isTeacher && <span className="mt-form-hint">(for this class)</span>}
                    </label>
                    <select name="subjectId" className="mt-form-select" value={formData.subjectId} onChange={handleChange} required disabled={!formData.classId}>
                      <option value="">{formData.classId ? 'Select Subject' : 'Pick class first'}</option>
                      {mySubjectsForForm.map(s => <option key={s._id} value={s._id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                    </select>
                    {isTeacher && formData.classId && mySubjectsForForm.length === 0 && <span className="mt-form-hint mt-form-hint--err">No subjects for this class.</span>}
                  </div>
                </div>

                <div className="mt-form-row-3">
                  <div className="mt-form-group">
                    <label className="mt-form-label">Duration (min) *</label>
                    <input type="number" name="duration" className="mt-form-input" value={formData.duration} onChange={handleChange} min="1" required />
                  </div>
                  <div className="mt-form-group">
                    <label className="mt-form-label">Pass Mark (%) *</label>
                    <input type="number" name="passMark" className="mt-form-input" value={formData.passMark} onChange={handleChange} min="0" max="100" required />
                  </div>
                  <div className="mt-form-group">
                    <label className="mt-form-label">Questions</label>
                    <input type="text" className="mt-form-input" value={formData.questions?.length || 0} disabled style={{background:'#f8fafc',fontVariantNumeric:'tabular-nums',fontWeight:700}} />
                  </div>
                </div>

                <div className="mt-form-row">
                  <div className="mt-form-group">
                    <label className="mt-form-label">Start Date *</label>
                    <input type="datetime-local" name="startDate" className="mt-form-input" value={formData.startDate} onChange={handleChange} required />
                  </div>
                  <div className="mt-form-group">
                    <label className="mt-form-label">End Date *</label>
                    <input type="datetime-local" name="endDate" className="mt-form-input" value={formData.endDate} onChange={handleChange} required />
                  </div>
                </div>

                <div className="mt-form-group" style={{marginBottom:16}}>
                  <label className="mt-form-label">
                    Load from Question Set
                    <span className="mt-form-hint">— auto-fills questions</span>
                  </label>
                  <select className="mt-form-select" value={selectedQuestionSet} onChange={handleQuestionSetSelect} disabled={!formData.classId || !formData.subjectId}>
                    <option value="">{(!formData.classId || !formData.subjectId) ? 'Select class & subject first' : 'Choose a Question Set'}</option>
                    {questionSets?.data?.map(qs => (
                      <option key={qs._id} value={qs._id}>{qs.title} ({qs.questions?.length} Qs)</option>
                    ))}
                  </select>
                  {formData.questions?.length > 0 && (
                    <span className="mt-form-qs-loaded">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {formData.questions.length} questions loaded
                    </span>
                  )}
                </div>

                <div className="mt-form-group">
                  <label className="mt-form-label">Instructions</label>
                  <textarea name="instructions" className="mt-form-textarea" value={formData.instructions} onChange={handleChange} rows="3" placeholder="Any special instructions for students..." />
                </div>
              </form>

              {showModalScrollBtn && (
                <button type="button" onClick={scrollModalToBottom} className={`mt-scroll-btn ${showModalScrollBtn ? 'mt-scroll-btn--vis' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              )}
            </div>

            <div className="mt-modal-footer">
              <button type="button" className="mt-btn mt-btn-ghost" onClick={handleCloseModal}>Cancel</button>
              <button type="submit" form="mt-form" disabled={isSaving} className="mt-btn mt-btn-primary">
                {isSaving ? <><div className="mt-btn-spinner" /> Saving...</> : (editingTest ? 'Update Test' : 'Save Test')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageTests;