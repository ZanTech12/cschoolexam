import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionSetsAPI, classesAPI, subjectsAPI, dashboardAPI, getUserRole } from '../../api';
import Loading from '../common/Loading';

const QuestionSetManager = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const modalBodyRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputMethod, setInputMethod] = useState('manual');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState({
    title: '', classId: '', subjectId: '',
    questions: [{ questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' }],
  });
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userRole = getUserRole();
  const isTeacher = userRole === 'teacher';
  const teacherId = user?._id || user?.id;

  const { data: questionSets, isPending: qsPending } = useQuery({ queryKey: ['questionSets'], queryFn: questionSetsAPI.getAll });
  const { data: classes, isPending: classesPending } = useQuery({ queryKey: ['classes'], queryFn: () => classesAPI.getAll({ limit: 100 }) });
  const { data: subjects, isPending: subjectsPending } = useQuery({ queryKey: ['subjects'], queryFn: subjectsAPI.getAll });

  const { data: allTeacherAssignments } = useQuery({
    queryKey: ['teacherAssignments'], queryFn: dashboardAPI.getTeacherAssignments,
    enabled: !isTeacher && !showModal,
  });

  const { data: myAssignments, isPending: myAssignmentsPending } = useQuery({
    queryKey: ['my-assignments', teacherId],
    queryFn: () => dashboardAPI.getAssignmentsByTeacher(teacherId),
    enabled: isTeacher && !!teacherId,
  });

  const { data: classAssignments } = useQuery({
    queryKey: ['classAssignments', formData.classId],
    queryFn: () => dashboardAPI.getAssignmentsByClass(formData.classId),
    enabled: !!formData.classId && showModal && !isTeacher,
  });

  const createMutation = useMutation({
    mutationFn: questionSetsAPI.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questionSets'] }); handleCloseModal(); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create question set'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => questionSetsAPI.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questionSets'] }); handleCloseModal(); },
    onError: (err) => {
      if (err.response?.status === 403) setError('Authorization failed. Your backend might not be configured to allow teachers to edit sets they are assigned to.');
      else setError(err.response?.data?.message || 'Failed to update question set');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: questionSetsAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questionSets'] }),
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete question set. You might not have permission.'),
  });

  const formatName = (name) => {
    if (!name) return '';
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getAssignedTeacher = (classId, subjectId, assignmentsData) => {
    if (!assignmentsData?.data || !classId || !subjectId) return null;
    const classIdStr = classId.toString();
    const subjectIdStr = subjectId.toString();
    return assignmentsData.data.find((a) => {
      const aClassId = (a.class_id?._id || a.class_id || a.classId?._id || a.classId)?.toString();
      const aSubjectId = (a.subject_id?._id || a.subject_id || a.subjectId?._id || a.subjectId)?.toString();
      return aClassId === classIdStr && aSubjectId === subjectIdStr;
    });
  };

  const getTeacherDisplayInfo = (assignment) => {
    if (!assignment) return null;
    return assignment.teacher_name || `${assignment.teacher_id?.firstName || ''} ${assignment.teacher_id?.lastName || ''}`.trim() || null;
  };

  const getInitials = (name) => {
    if (!name) return '';
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#0ea5e9','#3b82f6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getDifficultyMeta = (d) => {
    const map = {
      easy:   { label: 'Easy',   color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', dot: '#34d399', icon: '●' },
      medium: { label: 'Medium', color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#fbbf24', icon: '●' },
      hard:   { label: 'Hard',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#f87171', icon: '●' },
    };
    return map[d] || map.medium;
  };

  const availableClasses = useMemo(() => {
    if (!classes?.data) return [];
    if (!isTeacher) return classes.data;
    if (!myAssignments?.data) return [];
    const ids = new Set(myAssignments.data.map(a => (a.class_id?._id || a.class_id)?.toString()).filter(Boolean));
    return classes.data.filter(c => ids.has(c._id));
  }, [isTeacher, classes?.data, myAssignments?.data]);

  const availableSubjects = useMemo(() => {
    if (!subjects?.data) return [];
    if (isTeacher) {
      if (!formData.classId || !myAssignments?.data) return [];
      return subjects.data.filter(sub =>
        myAssignments.data.some(a => {
          const aC = (a.class_id?._id || a.class_id)?.toString();
          const aS = (a.subject_id?._id || a.subject_id)?.toString();
          return aC === formData.classId && aS === sub._id;
        })
      );
    }
    return subjects.data;
  }, [isTeacher, formData.classId, subjects?.data, myAssignments?.data]);

  const filteredQuestionSets = useMemo(() => {
    if (!questionSets?.data) return [];
    if (!isTeacher) return questionSets.data;
    if (!myAssignments?.data) return [];
    const pairs = myAssignments.data.map(a => ({
      classId: (a.class_id?._id || a.class_id)?.toString(),
      subjectId: (a.subject_id?._id || a.subject_id)?.toString(),
    })).filter(p => p.classId && p.subjectId);
    return questionSets.data.filter(qs => {
      const qC = (qs.classId?._id || qs.classId)?.toString();
      const qS = (qs.subjectId?._id || qs.subjectId)?.toString();
      return pairs.some(p => p.classId === qC && p.subjectId === qS);
    });
  }, [isTeacher, questionSets?.data, myAssignments?.data]);

  const currentAssignedTeacher = !isTeacher && formData.classId && formData.subjectId
    ? getAssignedTeacher(formData.classId, formData.subjectId, classAssignments) : null;

  const sampleJSON = `[
  {
    "questionText": "What is the chemical symbol for water?",
    "options": ["H2O", "CO2", "NaCl", "O2"],
    "correctAnswer": 0,
    "difficulty": "easy",
    "explanation": "H2O consists of two hydrogen atoms and one oxygen atom."
  }
]`;

  const handleCopyJSON = () => { navigator.clipboard.writeText(sampleJSON); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleScroll = (e) => { const { scrollTop, scrollHeight, clientHeight } = e.target; setShowScrollBtn(scrollHeight - (scrollTop + clientHeight) >= 100); };
  const scrollToBottom = () => { modalBodyRef.current?.scrollTo({ top: modalBodyRef.current.scrollHeight, behavior: 'smooth' }); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'classId') setFormData(prev => ({ ...prev, classId: value, subjectId: '' }));
    else setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleQuestionChange = (field, value) => {
    const uq = [...formData.questions];
    uq[currentQuestionIndex][field] = value;
    setFormData({ ...formData, questions: uq });
  };

  const handleOptionChange = (i, v) => {
    const uq = [...formData.questions];
    uq[currentQuestionIndex].options[i] = v;
    setFormData({ ...formData, questions: uq });
  };

  const handleAddOption = () => {
    const uq = [...formData.questions];
    if (uq[currentQuestionIndex].options.length >= 8) return;
    uq[currentQuestionIndex].options.push('');
    setFormData({ ...formData, questions: uq });
  };

  const handleRemoveOption = (idx) => {
    const uq = [...formData.questions];
    const opts = uq[currentQuestionIndex].options;
    if (opts.length <= 2) return;
    const correctText = opts[uq[currentQuestionIndex].correctAnswer];
    opts.splice(idx, 1);
    let nc = opts.indexOf(correctText);
    if (nc === -1) nc = 0;
    uq[currentQuestionIndex].correctAnswer = nc;
    setFormData({ ...formData, questions: uq });
  };

  const handleDuplicateQuestion = () => {
    const uq = [...formData.questions];
    uq.splice(currentQuestionIndex + 1, 0, JSON.parse(JSON.stringify(uq[currentQuestionIndex])));
    setFormData({ ...formData, questions: uq });
    setCurrentQuestionIndex(p => p + 1);
  };

  const handleShuffleOptions = () => {
    const uq = [...formData.questions];
    const q = { ...uq[currentQuestionIndex] };
    const oc = [...q.options];
    const ct = oc[q.correctAnswer];
    for (let i = oc.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [oc[i], oc[j]] = [oc[j], oc[i]]; }
    q.options = oc;
    q.correctAnswer = oc.indexOf(ct);
    if (q.correctAnswer === -1) q.correctAnswer = 0;
    uq[currentQuestionIndex] = q;
    setFormData({ ...formData, questions: uq });
  };

  const handleNext = () => {
    if (currentQuestionIndex < formData.questions.length - 1) setCurrentQuestionIndex(p => p + 1);
    else {
      setFormData(prev => ({ ...prev, questions: [...prev.questions, { questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' }] }));
      setCurrentQuestionIndex(p => p + 1);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) { setCurrentQuestionIndex(p => p - 1); modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const removeQuestion = () => {
    if (formData.questions.length <= 1) return;
    const uq = formData.questions.filter((_, i) => i !== currentQuestionIndex);
    setFormData({ ...formData, questions: uq });
    if (currentQuestionIndex >= uq.length) setCurrentQuestionIndex(uq.length - 1);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let pq = [];
        const text = ev.target.result;
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          if (!Array.isArray(json)) throw new Error("JSON must be an array.");
          pq = json.map(q => ({ questionText: q.questionText || '', options: Array.isArray(q.options) ? q.options : ['', ''], correctAnswer: parseInt(q.correctAnswer) || 0, difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium', explanation: q.explanation || '' }));
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length < 2) throw new Error("CSV is empty.");
          for (let i = 1; i < lines.length; i++) {
            const c = lines[i].split(',').map(x => x.trim());
            if (c.length >= 6) pq.push({ questionText: c[0], options: [c[1]||'',c[2]||'',c[3]||'',c[4]||''].filter(Boolean), correctAnswer: parseInt(c[5])||0, difficulty: ['easy','medium','hard'].includes(c[6])?c[6]:'medium', explanation: c[7]||'' });
          }
        } else throw new Error("Invalid file type. Use .json or .csv");
        if (!pq.length) throw new Error("No valid questions found.");
        setFormData(prev => ({ ...prev, questions: pq }));
        setCurrentQuestionIndex(0); setError(''); setInputMethod('manual');
      } catch (err) { setError(`Upload failed: ${err.message}`); }
      finally { e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(formData.questions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${formData.title || 'question-set'}.json`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
  };

  const handleOpenCreate = () => {
    setEditingSet(null);
    setFormData({ title: '', classId: '', subjectId: '', questions: [{ questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' }] });
    setCurrentQuestionIndex(0); setInputMethod('manual'); setError(''); setShowModal(true); setShowScrollBtn(false); setCopied(false);
  };

  const handleOpenEdit = (qs) => {
    setEditingSet(qs);
    setFormData({ title: qs.title||'', classId: qs.classId?._id||qs.classId||'', subjectId: qs.subjectId?._id||qs.subjectId||'', questions: qs.questions?.length ? qs.questions : [{ questionText:'', options:['',''], correctAnswer:0, difficulty:'medium', explanation:'' }] });
    setCurrentQuestionIndex(0); setInputMethod('manual'); setError(''); setShowModal(true); setShowScrollBtn(false); setCopied(false);
  };

  const handleCloseModal = () => { setShowModal(false); setEditingSet(null); setError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const vq = formData.questions.filter(q => q.questionText.trim() && q.options.filter(o => o.trim()).length >= 2);
    if (!vq.length) { setError('Add at least one question with text and 2+ options'); return; }
    const data = { ...formData, questions: vq };
    if (editingSet) updateMutation.mutate({ id: editingSet._id, data });
    else createMutation.mutate(data);
  };

  const handleDelete = (qs) => { if (window.confirm(`Delete "${qs.title}"?`)) deleteMutation.mutate(qs._id); };

  const isLoading = qsPending || classesPending || subjectsPending || (isTeacher && myAssignmentsPending);
  if (isLoading) return <Loading message="Loading question sets..." />;

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const cq = formData.questions[currentQuestionIndex];
  const isLast = currentQuestionIndex === formData.questions.length - 1;
  const colSpan = isTeacher ? 4 : 7;

  return (
    <div className="qs-root">
      <style>{`
        .qs-root {
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
        .qs-header {
          background: var(--surface); border-bottom: 1px solid var(--border);
          padding: 20px 24px; position: sticky; top: 0; z-index: 30;
        }
        .qs-header::after {
          content: ''; position: absolute; bottom: -1px; left: 24px; right: 24px; height: 1px;
          background: linear-gradient(90deg, transparent, var(--primary) 20%, var(--primary) 80%, transparent);
          opacity: 0.15;
        }
        .qs-header-inner { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .qs-header-left { display: flex; align-items: center; gap: 16px; }
        .qs-header-icon {
          width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          display: flex; align-items: center; justify-content: center; color: #fff;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }
        .qs-header-title { font-size: 1.4rem; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.03em; }
        .qs-header-sub { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; font-weight: 500; }

        /* ===== BUTTONS ===== */
        .qs-btn {
          display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: var(--radius-sm);
          font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer;
          transition: all var(--transition); white-space: nowrap; line-height: 1.4; font-family: inherit;
          position: relative; overflow: hidden;
        }
        .qs-btn::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 60%); pointer-events: none; }
        .qs-btn:active { transform: scale(0.97); }
        .qs-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none !important; }
        .qs-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
        .qs-btn-primary {
          background: linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%);
          color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,0.3);
        }
        .qs-btn-primary:hover { box-shadow: 0 4px 16px rgba(79,70,229,0.4); transform: translateY(-1px); }
        .qs-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
        .qs-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; box-shadow: var(--shadow-xs); }
        .qs-btn-danger-outline { background: var(--surface); color: var(--danger); border: 1px solid #fecaca; }
        .qs-btn-danger-outline:hover { background: #fef2f2; border-color: #fca5a5; }
        .qs-btn-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: #fff; box-shadow: 0 2px 8px rgba(239,68,68,0.25);
        }
        .qs-btn-danger:hover { box-shadow: 0 4px 16px rgba(239,68,68,0.35); transform: translateY(-1px); }
        .qs-btn-warning-outline { background: var(--surface); color: #b45309; border: 1px solid #fde68a; }
        .qs-btn-warning-outline:hover { background: var(--warning-light); }
        .qs-btn-sm { padding: 7px 13px; font-size: 0.78rem; border-radius: var(--radius-xs); }
        .qs-btn-sm svg { width: 13px; height: 13px; }
        .qs-btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: qsSpin 0.6s linear infinite; flex-shrink: 0; }
        @keyframes qsSpin { to { transform: rotate(360deg); } }

        /* ===== BADGES ===== */
        .qs-badge {
          display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 20px;
          font-size: 0.72rem; font-weight: 600; white-space: nowrap; letter-spacing: 0.01em;
        }
        .qs-badge-indigo { background: var(--primary-light); color: #4338ca; }
        .qs-badge-green { background: #dcfce7; color: #166534; }
        .qs-badge-amber { background: #fef3c7; color: #92400e; }
        .qs-badge-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        /* ===== LOCKED ===== */
        .qs-locked {
          background: var(--surface); border: 1px solid #fde68a; border-radius: var(--radius);
          padding: 40px 24px; text-align: center; margin: 16px 24px;
        }
        .qs-locked-icon { width: 56px; height: 56px; border-radius: 50%; background: #fef3c7; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .qs-locked h3 { font-size: 1.05rem; font-weight: 700; color: #92400e; margin: 0 0 6px; }
        .qs-locked p { font-size: 0.88rem; color: #b45309; margin: 0; line-height: 1.5; max-width: 360px; margin-left: auto; margin-right: auto; }

        /* ===== STATS BAR ===== */
        .qs-stats {
          display: flex; gap: 12px; padding: 14px 24px; background: var(--bg);
          border-bottom: 1px solid var(--border); overflow-x: auto;
        }
        .qs-stat-chip {
          display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
          font-size: 0.82rem; color: var(--text-secondary); font-weight: 500; white-space: nowrap;
        }
        .qs-stat-chip strong { color: var(--text); font-weight: 700; font-variant-numeric: tabular-nums; }
        .qs-stat-chip svg { width: 15px; height: 15px; color: var(--text-muted); flex-shrink: 0; }

        /* ===== TABLE ===== */
        .qs-table-section { background: var(--surface); min-height: 200px; }
        .qs-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .qs-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 720px; }
        .qs-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 5; }
        .qs-table th {
          padding: 13px 18px; text-align: left; font-weight: 600; font-size: 0.72rem;
          text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted);
          border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .qs-table td { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .qs-table tbody tr { transition: background var(--transition); animation: qsRowIn 0.35s ease both; }
        .qs-table tbody tr:hover { background: #fafaff; }
        .qs-table tbody tr:last-child td { border-bottom: none; }
        @keyframes qsRowIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .qs-empty { text-align: center; padding: 56px 24px; color: var(--text-muted); }
        .qs-table-actions { display: flex; gap: 6px; }

        /* ===== MOBILE CARDS ===== */
        .qs-cards { display: none; flex-direction: column; gap: 10px; padding: 12px 16px; }
        .qs-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 18px; transition: all var(--transition); animation: qsRowIn 0.35s ease both;
          position: relative; overflow: hidden;
        }
        .qs-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--primary), #7c3aed); opacity: 0.6;
        }
        .qs-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .qs-card-title { font-weight: 700; font-size: 0.98rem; color: var(--text); line-height: 1.3; }
        .qs-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .qs-card-field { display: flex; flex-direction: column; gap: 3px; }
        .qs-card-field-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
        .qs-card-field-value { font-size: 0.86rem; color: var(--text); font-weight: 500; }
        .qs-card-actions { display: flex; gap: 8px; padding-top: 14px; border-top: 1px solid var(--border); }
        .qs-card-actions .qs-btn { flex: 1; justify-content: center; }

        /* ===== MODAL ===== */
        .qs-modal-overlay {
          position: fixed; inset: 0; background: rgba(15,23,42,0.55); backdrop-filter: blur(6px);
          z-index: 100; display: flex; align-items: center; justify-content: center;
          animation: qsFadeIn 0.2s ease;
        }
        @keyframes qsFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .qs-modal {
          background: var(--surface); border-radius: 20px; width: 100%; max-width: 940px;
          max-height: 92vh; overflow: hidden; display: flex; flex-direction: column;
          box-shadow: var(--shadow-xl); animation: qsModalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes qsModalIn { from { opacity: 0; transform: scale(0.95) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .qs-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: #cbd5e1; margin: 10px auto 0; }
        .qs-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 28px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0;
        }
        .qs-modal-title { font-size: 1.2rem; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.02em; }
        .qs-modal-close {
          width: 34px; height: 34px; border-radius: 50%; border: none; background: #f1f5f9;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); font-size: 1.3rem; transition: all var(--transition);
        }
        .qs-modal-close:hover { background: #e2e8f0; color: var(--text); transform: rotate(90deg); }
        .qs-modal-body { flex: 1; overflow-y: auto; padding: 24px 28px; }
        .qs-modal-footer {
          display: flex; gap: 10px; padding: 16px 28px; border-top: 1px solid var(--border);
          background: var(--surface); justify-content: flex-end; flex-wrap: wrap; flex-shrink: 0;
        }

        /* ===== ALERTS ===== */
        .qs-alert {
          padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500;
          display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
          animation: qsSlideDown 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .qs-alert-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        @keyframes qsSlideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        /* ===== METHOD TABS ===== */
        .qs-method-tabs {
          display: flex; gap: 2px; background: #e2e8f0; border-radius: var(--radius-sm); padding: 3px;
          width: fit-content; margin-bottom: 24px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
        }
        .qs-method-tab {
          display: inline-flex; align-items: center; gap: 7px; padding: 9px 20px; border-radius: 7px;
          border: none; background: none; font-size: 0.84rem; font-weight: 600;
          color: var(--text-muted); cursor: pointer; transition: all var(--transition); font-family: inherit;
        }
        .qs-method-tab:hover { color: var(--text-secondary); }
        .qs-method-tab--active {
          background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm), 0 0 0 1px rgba(0,0,0,0.04);
        }
        .qs-method-count {
          font-size: 0.76rem; font-weight: 700; color: var(--primary); padding: 2px 9px;
          background: var(--primary-light); border-radius: 10px;
        }

        /* ===== FORM ===== */
        .qs-form-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
        .qs-form-group { display: flex; flex-direction: column; gap: 6px; }
        .qs-form-label { font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.01em; }
        .qs-form-input, .qs-form-select, .qs-form-textarea {
          width: 100%; padding: 11px 14px; border-radius: var(--radius-sm);
          border: 1.5px solid var(--border); background: var(--surface); font-size: 0.88rem;
          color: var(--text); outline: none;
          transition: border-color var(--transition), box-shadow var(--transition);
          box-sizing: border-box; -webkit-appearance: none; appearance: none; font-family: inherit;
        }
        .qs-form-input::placeholder, .qs-form-textarea::placeholder { color: var(--text-muted); }
        .qs-form-input:focus, .qs-form-select:focus, .qs-form-textarea:focus {
          border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
        }
        .qs-form-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; cursor: pointer;
        }
        .qs-form-select option { color: var(--text); background: var(--surface); }
        .qs-form-textarea { resize: vertical; min-height: 80px; line-height: 1.6; }
        .qs-form-hint { font-size: 0.75rem; color: #92400e; margin-top: 2px; font-weight: 500; }

        /* ===== TEACHER INFO ===== */
        .qs-teacher-bar {
          display: flex; align-items: center; gap: 14px; padding: 14px 18px;
          border-radius: var(--radius-sm); margin-bottom: 20px;
        }
        .qs-teacher-bar--ok { background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border: 1px solid #c7d2fe; }
        .qs-teacher-bar--warn { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fde68a; }
        .qs-teacher-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 0.82rem; flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .qs-teacher-name { font-size: 0.9rem; font-weight: 700; }
        .qs-teacher-bar--ok .qs-teacher-name { color: #312e81; }
        .qs-teacher-bar--warn .qs-teacher-name { color: #92400e; }
        .qs-teacher-sub { font-size: 0.76rem; font-weight: 500; }
        .qs-teacher-bar--ok .qs-teacher-sub { color: var(--primary); }
        .qs-teacher-bar--warn .qs-teacher-sub { color: #b45309; }

        /* ===== QUESTION CARD ===== */
        .qs-q-card {
          background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius);
          overflow: hidden; margin-top: 4px; box-shadow: var(--shadow-xs);
          transition: box-shadow var(--transition);
        }
        .qs-q-card:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
        .qs-q-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-bottom: 1px solid var(--border); gap: 10px; flex-wrap: wrap;
        }
        .qs-q-num {
          display: inline-flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 8px; font-size: 0.82rem; font-weight: 800;
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          color: #fff; flex-shrink: 0;
        }
        .qs-q-title { font-weight: 700; font-size: 0.9rem; color: var(--text); }
        .qs-q-actions { display: flex; gap: 5px; flex-wrap: wrap; }
        .qs-q-btn {
          display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px;
          border-radius: var(--radius-xs); border: 1px solid var(--border); background: var(--surface);
          font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); cursor: pointer;
          transition: all var(--transition); font-family: inherit;
        }
        .qs-q-btn:hover { background: #f8fafc; border-color: #cbd5e1; box-shadow: var(--shadow-xs); }
        .qs-q-btn--green { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
        .qs-q-btn--green:hover { background: #dcfce7; }
        .qs-q-btn--red { border-color: #fecaca; background: #fef2f2; color: #dc2626; }
        .qs-q-btn--red:hover { background: #fee2e2; }
        .qs-q-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }

        /* ===== OPTIONS ===== */
        .qs-opt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
        .qs-opt {
          display: flex; align-items: center; gap: 12px; padding: 12px 14px;
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          background: var(--surface); transition: all var(--transition);
        }
        .qs-opt--correct {
          border-color: var(--primary); background: linear-gradient(135deg, var(--primary-50) 0%, #e0e7ff 100%);
          box-shadow: 0 0 0 3px rgba(79,70,229,0.06);
        }
        .qs-opt-letter {
          width: 28px; height: 28px; border-radius: 8px; background: #f1f5f9;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.76rem; font-weight: 700; color: var(--text-muted); flex-shrink: 0;
          transition: all var(--transition);
        }
        .qs-opt--correct .qs-opt-letter {
          background: var(--primary); color: #fff;
          box-shadow: 0 2px 6px rgba(79,70,229,0.3);
        }
        .qs-opt-input {
          flex: 1; border: none; outline: none; font-size: 0.88rem;
          background: transparent; color: var(--text); font-family: inherit;
        }
        .qs-opt-input::placeholder { color: var(--text-muted); }
        .qs-opt-remove {
          background: none; border: none; color: var(--text-muted); cursor: pointer;
          font-size: 1.3rem; line-height: 1; padding: 0; transition: all var(--transition);
          width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .qs-opt-remove:hover { color: var(--danger); background: #fef2f2; }

        /* ===== DIFFICULTY SELECT ===== */
        .qs-diff-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        /* ===== NAV ===== */
        .qs-nav {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border);
        }
        .qs-nav-label {
          font-size: 0.86rem; font-weight: 600; color: var(--text-muted);
          background: #f1f5f9; padding: 6px 16px; border-radius: 20px;
        }

        /* ===== SCROLL BTN ===== */
        .qs-scroll-btn {
          position: sticky; bottom: 24px; float: right; clear: both; margin-right: 12px;
          width: 46px; height: 46px; border-radius: 50%; border: none;
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.4); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s ease; opacity: 0; visibility: hidden; transform: translateY(16px); z-index: 50;
        }
        .qs-scroll-btn--vis { opacity: 1; visibility: visible; transform: translateY(0); }
        .qs-scroll-btn:hover { box-shadow: 0 6px 24px rgba(79,70,229,0.5); transform: translateY(-2px); }
        .qs-scroll-btn--vis:hover { transform: translateY(-2px); }
        .qs-scroll-btn svg { width: 20px; height: 20px; }

        /* ===== UPLOAD ===== */
        .qs-upload-zone {
          border: 2px dashed #cbd5e1; border-radius: var(--radius); padding: 48px 24px;
          text-align: center; cursor: pointer; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          transition: all 0.25s ease;
        }
        .qs-upload-zone:hover { border-color: var(--primary); background: linear-gradient(135deg, var(--primary-50) 0%, #e0e7ff 100%); }
        .qs-upload-icon-wrap {
          width: 64px; height: 64px; border-radius: 50%; background: var(--primary-light);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
          transition: all 0.25s ease;
        }
        .qs-upload-zone:hover .qs-upload-icon-wrap { background: var(--primary); box-shadow: 0 4px 16px rgba(79,70,229,0.3); }
        .qs-upload-zone:hover .qs-upload-icon-wrap svg { color: #fff; }
        .qs-upload-icon-wrap svg { width: 28px; height: 28px; color: var(--primary); transition: color 0.25s ease; }
        .qs-upload-title { margin: 0; font-weight: 700; font-size: 0.95rem; color: var(--text); }
        .qs-upload-sub { margin: 6px 0 0; font-size: 0.84rem; color: var(--text-muted); }

        /* ===== CODE BLOCK ===== */
        .qs-code-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .qs-code-label { font-size: 0.88rem; font-weight: 700; color: var(--text); }
        .qs-copy-btn {
          display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px;
          border-radius: var(--radius-xs); border: 1px solid var(--border); background: var(--surface);
          color: var(--text-secondary); cursor: pointer; font-size: 0.76rem; font-weight: 600;
          transition: all var(--transition); font-family: inherit;
        }
        .qs-copy-btn:hover { background: var(--text); color: #fff; border-color: var(--text); }
        .qs-copy-btn--done { background: var(--success); color: #fff; border-color: var(--success); }
        .qs-copy-btn svg { width: 12px; height: 12px; }
        .qs-code-block {
          background: #0f172a; border-radius: var(--radius-sm); padding: 18px;
          overflow: auto; max-height: 260px; border: 1px solid #1e293b;
        }
        .qs-code-block pre {
          color: #e2e8f0; font-size: 0.8rem; margin: 0;
          font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
          white-space: pre-wrap; word-break: break-all; line-height: 1.6;
        }
        .qs-code-hint { margin: 10px 0 0; font-size: 0.76rem; color: var(--text-muted); font-weight: 500; }

        /* ===== RESPONSIVE ===== */
        @media (min-width: 768px) {
          .qs-cards { display: none !important; }
          .qs-table-section { display: block !important; }
          .qs-header { padding: 24px 32px; }
          .qs-stats { padding: 14px 32px; }
          .qs-locked { margin: 16px 32px; }
          .qs-form-row { grid-template-columns: repeat(3, 1fr); gap: 18px; }
        }
        @media (max-width: 767px) {
          .qs-header { padding: 16px; }
          .qs-header-inner { flex-direction: column; align-items: flex-start; }
          .qs-header-title { font-size: 1.15rem; }
          .qs-header-icon { width: 42px; height: 42px; border-radius: 12px; }
          .qs-header-icon svg { width: 22px; height: 22px; }
          .qs-stats { padding: 10px 16px; gap: 8px; }
          .qs-stat-chip { padding: 7px 11px; font-size: 0.78rem; }
          .qs-locked { margin: 12px 16px; padding: 28px 16px; }
          .qs-table-section { display: none !important; }
          .qs-cards { display: flex !important; }
          .qs-card-grid { grid-template-columns: 1fr 1fr; }
          .qs-form-row { grid-template-columns: 1fr; }
          .qs-diff-row { grid-template-columns: 1fr; }
          .qs-modal { border-radius: 20px 20px 0 0; max-height: 96vh; width: 100%; max-width: 100%; }
          .qs-modal-overlay { align-items: flex-end; }
          .qs-method-tabs { width: 100%; }
          .qs-method-tab { flex: 1; justify-content: center; font-size: 0.78rem; padding: 9px 8px; }
          .qs-opt-grid { grid-template-columns: 1fr; }
          .qs-upload-zone { padding: 36px 16px; }
        }
        @media (max-width: 420px) {
          .qs-card-grid { grid-template-columns: 1fr; }
          .qs-q-header { flex-direction: column; align-items: flex-start; }
        }

        /* ===== SCROLLBAR ===== */
        .qs-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .qs-root ::-webkit-scrollbar-track { background: transparent; }
        .qs-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .qs-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* ===== HEADER ===== */}
      <div className="qs-header">
        <div className="qs-header-inner">
          <div className="qs-header-left">
            <div className="qs-header-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/>
              </svg>
            </div>
            <div>
              <h1 className="qs-header-title">Question Sets</h1>
              <p className="qs-header-sub">{isTeacher ? 'Manage question sets for your assigned subjects' : 'Create and manage question sets for tests'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!(isTeacher && availableClasses.length === 0) && (
              <button className="qs-btn qs-btn-primary" onClick={handleOpenCreate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Question Set
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== STATS BAR ===== */}
      {!isTeacher && (
        <div className="qs-stats">
          <div className="qs-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <strong>{filteredQuestionSets.length}</strong> Sets
          </div>
          <div className="qs-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/></svg>
            <strong>{filteredQuestionSets.reduce((sum, qs) => sum + (qs.questions?.length || 0), 0)}</strong> Questions
          </div>
          <div className="qs-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <strong>{new Set(filteredQuestionSets.map(qs => (qs.subjectId?._id || qs.subjectId)?.toString()).filter(Boolean)).size}</strong> Subjects
          </div>
        </div>
      )}

      {/* ===== LOCKED ===== */}
      {isTeacher && availableClasses.length === 0 && (
        <div className="qs-locked">
          <div className="qs-locked-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h3>No Access Granted</h3>
          <p>You have not been assigned to any classes or subjects yet. Please contact the administrator.</p>
        </div>
      )}

      {/* ===== TABLE ===== */}
      <div className="qs-table-section">
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Class</th>
                <th>Subject</th>
                {!isTeacher && <th>Assigned Teacher</th>}
                <th>Questions</th>
                {!isTeacher && <th>Created By</th>}
                <th style={{width:150}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestionSets.length === 0 ? (
                <tr><td colSpan={colSpan} className="qs-empty">
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'10px'}}>
                    <div style={{width:56,height:56,borderRadius:'50%',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',color:'#cbd5e1'}}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </div>
                    <span>{isTeacher ? 'No question sets found for your subjects' : 'No question sets yet'}</span>
                  </div>
                </td></tr>
              ) : filteredQuestionSets.map((qs) => {
                const qC = qs.classId?._id || qs.classId;
                const qS = qs.subjectId?._id || qs.subjectId;
                const ta = !isTeacher ? getAssignedTeacher(qC, qS, allTeacherAssignments) : null;
                const tn = getTeacherDisplayInfo(ta);
                return (
                  <tr key={qs._id}>
                    <td style={{fontWeight:700,fontSize:'0.9rem'}}>{qs.title}</td>
                    <td style={{color:'var(--text-secondary)'}}>{qs.classId?.name || '-'}</td>
                    <td style={{color:'var(--text-secondary)'}}>{qs.subjectId?.name || '-'}</td>
                    {!isTeacher && (
                      <td>
                        {tn ? (
                          <span className="qs-badge qs-badge-indigo">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            {formatName(tn)}
                          </span>
                        ) : (
                          <span className="qs-badge qs-badge-amber">
                            <span className="qs-badge-dot" style={{background:'#fbbf24'}}></span>
                            Not Assigned
                          </span>
                        )}
                      </td>
                    )}
                    <td><span className="qs-badge qs-badge-green">{qs.questions?.length || 0}</span></td>
                    {!isTeacher && <td style={{color:'var(--text-muted)',fontSize:'0.84rem'}}>{qs.teacherId ? `${qs.teacherId.firstName||''} ${qs.teacherId.lastName||''}`.trim()||'-' : '-'}</td>}
                    <td>
                      <div className="qs-table-actions">
                        <button className="qs-btn qs-btn-ghost qs-btn-sm" onClick={() => handleOpenEdit(qs)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Edit
                        </button>
                        <button className="qs-btn qs-btn-danger-outline qs-btn-sm" onClick={() => handleDelete(qs)} disabled={deleteMutation.isPending}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          Delete
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

      {/* ===== MOBILE CARDS ===== */}
      <div className="qs-cards">
        {filteredQuestionSets.length === 0 ? (
          <div style={{textAlign:'center',padding:'56px 16px',color:'var(--text-muted)'}}>
            <div style={{width:56,height:56,borderRadius:'50%',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',color:'#cbd5e1',margin:'0 auto 12px'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            {isTeacher ? 'No question sets for your subjects' : 'No question sets yet'}
          </div>
        ) : filteredQuestionSets.map((qs) => {
          const qC = qs.classId?._id || qs.classId;
          const qS = qs.subjectId?._id || qs.subjectId;
          const ta = !isTeacher ? getAssignedTeacher(qC, qS, allTeacherAssignments) : null;
          const tn = getTeacherDisplayInfo(ta);
          return (
            <div className="qs-card" key={qs._id}>
              <div className="qs-card-top">
                <span className="qs-card-title">{qs.title}</span>
                <span className="qs-badge qs-badge-green">{qs.questions?.length||0} Qs</span>
              </div>
              <div className="qs-card-grid">
                <div className="qs-card-field">
                  <span className="qs-card-field-label">Class</span>
                  <span className="qs-card-field-value">{qs.classId?.name||'-'}</span>
                </div>
                <div className="qs-card-field">
                  <span className="qs-card-field-label">Subject</span>
                  <span className="qs-card-field-value">{qs.subjectId?.name||'-'}</span>
                </div>
                {!isTeacher && tn && (
                  <div className="qs-card-field" style={{gridColumn:'1/-1'}}>
                    <span className="qs-card-field-label">Teacher</span>
                    <span className="qs-card-field-value">{formatName(tn)}</span>
                  </div>
                )}
              </div>
              <div className="qs-card-actions">
                <button className="qs-btn qs-btn-ghost qs-btn-sm" onClick={() => handleOpenEdit(qs)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button className="qs-btn qs-btn-danger-outline qs-btn-sm" onClick={() => handleDelete(qs)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="qs-modal-overlay" onClick={handleCloseModal}>
          <div className="qs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qs-modal-handle" />
            <div className="qs-modal-header">
              <h3 className="qs-modal-title">{editingSet ? 'Edit Question Set' : 'Create New Question Set'}</h3>
              <button className="qs-modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <div ref={modalBodyRef} onScroll={handleScroll} className="qs-modal-body">
              {error && (
                <div className="qs-alert qs-alert-danger">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {error}
                </div>
              )}

              {/* Tabs */}
              <div className="qs-method-tabs">
                <button type="button" className={`qs-method-tab ${inputMethod==='manual'?'qs-method-tab--active':''}`} onClick={() => setInputMethod('manual')}>✍️ Manual Entry</button>
                <button type="button" className={`qs-method-tab ${inputMethod==='upload'?'qs-method-tab--active':''}`} onClick={() => setInputMethod('upload')}>📁 Upload File</button>
                {inputMethod==='manual' && formData.questions.length>0 && (
                  <span className="qs-method-count">{formData.questions.length} Q{formData.questions.length!==1?'s':''}</span>
                )}
              </div>

              {/* Upload */}
              {inputMethod === 'upload' && (
                <div>
                  <div className="qs-upload-zone" onClick={() => fileInputRef.current.click()}>
                    <input type="file" accept=".json, .csv" style={{display:'none'}} ref={fileInputRef} onChange={handleFileUpload} />
                    <div className="qs-upload-icon-wrap">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="qs-upload-title">Click to upload JSON or CSV</p>
                    <p className="qs-upload-sub">After uploading, you can review and edit questions</p>
                  </div>
                  <div style={{marginTop:28}}>
                    <div className="qs-code-head">
                      <span className="qs-code-label">Sample JSON Format</span>
                      <button type="button" className={`qs-copy-btn ${copied?'qs-copy-btn--done':''}`} onClick={handleCopyJSON}>
                        {copied ? (
                          <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                        ) : (
                          <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                        )}
                      </button>
                    </div>
                    <div className="qs-code-block"><pre>{sampleJSON}</pre></div>
                    <p className="qs-code-hint">* <strong>correctAnswer</strong> is the zero-based index of the correct option.</p>
                  </div>
                </div>
              )}

              {/* Manual */}
              {inputMethod === 'manual' && cq && (
                <form onSubmit={handleSubmit} id="qs-form" style={{overflow:'visible'}}>
                  <div className="qs-form-row">
                    <div className="qs-form-group">
                      <label className="qs-form-label">Set Title *</label>
                      <input type="text" name="title" className="qs-form-input" value={formData.title} onChange={handleChange} required placeholder="e.g., Midterm Science" />
                    </div>
                    <div className="qs-form-group">
                      <label className="qs-form-label">Class *</label>
                      <select name="classId" className="qs-form-select" value={formData.classId} onChange={handleChange} required>
                        <option value="">Select Class</option>
                        {availableClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="qs-form-group">
                      <label className="qs-form-label">Subject *</label>
                      <select name="subjectId" className="qs-form-select" value={formData.subjectId} onChange={handleChange} required>
                        <option value="">Select Subject</option>
                        {availableSubjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                      </select>
                      {isTeacher && formData.classId && !availableSubjects.length && <span className="qs-form-hint">No subjects assigned for this class.</span>}
                    </div>
                  </div>

                  {/* Teacher info */}
                  {currentAssignedTeacher ? (
                    <div className="qs-teacher-bar qs-teacher-bar--ok">
                      <div className="qs-teacher-avatar" style={{background:getAvatarColor(getTeacherDisplayInfo(currentAssignedTeacher)||'')}}>{getInitials(getTeacherDisplayInfo(currentAssignedTeacher)||'')}</div>
                      <div>
                        <div className="qs-teacher-name">{formatName(getTeacherDisplayInfo(currentAssignedTeacher)||'')}</div>
                        <div className="qs-teacher-sub">Assigned Teacher for this Class & Subject</div>
                      </div>
                    </div>
                  ) : !isTeacher && formData.classId && formData.subjectId ? (
                    <div className="qs-teacher-bar qs-teacher-bar--warn">
                      <div className="qs-teacher-avatar" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </div>
                      <div>
                        <div className="qs-teacher-name">No Teacher Assigned</div>
                        <div className="qs-teacher-sub">No teacher for this class & subject. You can still create the set.</div>
                      </div>
                    </div>
                  ) : null}

                  {/* Question Card */}
                  <div className="qs-q-card">
                    <div className="qs-q-header">
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span className="qs-q-num">{currentQuestionIndex+1}</span>
                        <span className="qs-q-title">Question {currentQuestionIndex+1}</span>
                      </div>
                      <div className="qs-q-actions">
                        <button type="button" onClick={handleShuffleOptions} className="qs-q-btn">🔀 Shuffle</button>
                        <button type="button" onClick={handleDuplicateQuestion} className="qs-q-btn">📋 Clone</button>
                        {cq.options.length < 8 && <button type="button" onClick={handleAddOption} className="qs-q-btn qs-q-btn--green">+ Option</button>}
                        {formData.questions.length > 1 && <button type="button" onClick={removeQuestion} className="qs-q-btn qs-q-btn--red">🗑 Del</button>}
                      </div>
                    </div>
                    <div className="qs-q-body">
                      <div className="qs-form-group">
                        <label className="qs-form-label">Question Text *</label>
                        <textarea rows={3} className="qs-form-textarea" value={cq.questionText} onChange={e => handleQuestionChange('questionText', e.target.value)} required placeholder="Type your question here..." />
                      </div>
                      <div className="qs-form-group">
                        <label className="qs-form-label" style={{marginBottom:10}}>Options <span style={{fontWeight:400,color:'var(--text-muted)'}}>(click letter to mark correct)</span></label>
                        <div className="qs-opt-grid">
                          {cq.options.map((opt, oi) => {
                            const isC = cq.correctAnswer === oi;
                            return (
                              <div key={oi} className={`qs-opt ${isC?'qs-opt--correct':''}`}>
                                <div className="qs-opt-letter" onClick={() => handleQuestionChange('correctAnswer', oi)} style={{cursor:'pointer'}}>{String.fromCharCode(65+oi)}</div>
                                <input type="text" className="qs-opt-input" placeholder={`Option ${String.fromCharCode(65+oi)}`} value={opt} onChange={e => handleOptionChange(oi, e.target.value)} required={oi<2} />
                                {cq.options.length > 2 && <button type="button" className="qs-opt-remove" onClick={() => handleRemoveOption(oi)}>×</button>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="qs-diff-row">
                        <div className="qs-form-group">
                          <label className="qs-form-label">Difficulty</label>
                          <select className="qs-form-select" value={cq.difficulty} onChange={e => handleQuestionChange('difficulty', e.target.value)}>
                            <option value="easy">🟢 Easy</option>
                            <option value="medium">🟡 Medium</option>
                            <option value="hard">🔴 Hard</option>
                          </select>
                        </div>
                        <div className="qs-form-group">
                          <label className="qs-form-label">Explanation <span style={{fontWeight:400,color:'var(--text-muted)'}}>(optional)</span></label>
                          <input type="text" className="qs-form-input" value={cq.explanation||''} onChange={e => handleQuestionChange('explanation', e.target.value)} placeholder="Why is this correct?" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nav */}
                  <div className="qs-nav">
                    <button type="button" onClick={handlePrev} disabled={currentQuestionIndex===0} className="qs-btn qs-btn-ghost qs-btn-sm">← Previous</button>
                    <span className="qs-nav-label">Q {currentQuestionIndex+1} of {formData.questions.length}</span>
                    <button type="button" onClick={handleNext} className="qs-btn qs-btn-primary qs-btn-sm">{isLast ? '+ Add Next' : 'Next →'}</button>
                  </div>

                  <button type="button" onClick={scrollToBottom} className={`qs-scroll-btn ${showScrollBtn?'qs-scroll-btn--vis':''}`} title="Scroll to bottom">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </form>
              )}
            </div>

            {inputMethod === 'manual' && (
              <div className="qs-modal-footer">
                <button type="button" className="qs-btn qs-btn-ghost" onClick={handleCloseModal}>Cancel</button>
                <button type="button" className="qs-btn qs-btn-warning-outline" onClick={handleExportJSON} disabled={!formData.questions.length}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export JSON
                </button>
                <button type="submit" form="qs-form" disabled={isSaving} className="qs-btn qs-btn-primary">
                  {isSaving ? <><div className="qs-btn-spinner" /> Saving...</> : (editingSet ? 'Update Set' : 'Save Question Set')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionSetManager;