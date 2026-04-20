import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { testResultsAPI, testsAPI, classesAPI, subjectsAPI, dashboardAPI, downloadCSV, teacherCAAPI, termsAPI, sessionsAPI } from '../../api';
import Loading from '../common/Loading';

const TestResults = () => {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTest, setSelectedTest] = useState('');
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushTermId, setPushTermId] = useState('');
  const [pushSessionId, setPushSessionId] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState('');
  const [pushError, setPushError] = useState('');
  const [pushConfirm, setPushConfirm] = useState(false);
  const [pushOverwriteMode, setPushOverwriteMode] = useState(false);
  const [pushType, setPushType] = useState('test');
  const [pushScores, setPushScores] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');
  const [darkMode, setDarkMode] = useState(false);
  const [showPerfInsights, setShowPerfInsights] = useState(false);
  const [hoveredStudent, setHoveredStudent] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isTeacher = user?.role === 'teacher';
  const teacherId = user?._id || user?.id;

  const { data: tests, isLoading: testsLoading } = useQuery({ queryKey: ['tests'], queryFn: () => testsAPI.getAll() });
  const { data: classes, isLoading: classesLoading } = useQuery({ queryKey: ['classes'], queryFn: () => classesAPI.getAll({ limit: 100 }) });
  const { data: subjects, isLoading: subjectsLoading } = useQuery({ queryKey: ['subjects'], queryFn: subjectsAPI.getAll });
  const { data: myAssignments, isLoading: myAssignmentsLoading } = useQuery({ queryKey: ['my-assignments', teacherId], queryFn: () => dashboardAPI.getAssignmentsByTeacher(teacherId), enabled: isTeacher && !!teacherId });
  const { data: results, isLoading: resultsLoading } = useQuery({ queryKey: ['testResults', selectedTest], queryFn: () => testResultsAPI.getByTest(selectedTest), enabled: !!selectedTest });
  const { data: terms } = useQuery({ queryKey: ['terms'], queryFn: () => termsAPI.getAll() });
  const { data: sessions } = useQuery({ queryKey: ['sessions'], queryFn: () => sessionsAPI.getAll() });

  useEffect(() => {
    if (showPushModal && terms?.data) {
      const active = terms.data.find(t => t.status === 'active');
      if (active) { setPushTermId(active._id); setPushSessionId(active.session?._id || active.session || ''); }
    }
  }, [showPushModal, terms?.data]);

  useEffect(() => {
    if (pushSuccess || pushError) { const t = setTimeout(() => { setPushSuccess(''); setPushError(''); }, 5000); return () => clearTimeout(t); }
  }, [pushSuccess, pushError]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('tr-dark');
    else document.documentElement.classList.remove('tr-dark');
    return () => document.documentElement.classList.remove('tr-dark');
  }, [darkMode]);

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
      if (!selectedClass || !myAssignments?.data) return [];
      return subjects.data.filter(sub => myAssignments.data.some(a => (a.class_id?._id || a.class_id)?.toString() === selectedClass && (a.subject_id?._id || a.subject_id)?.toString() === sub._id));
    }
    return subjects.data;
  }, [isTeacher, selectedClass, subjects?.data, myAssignments?.data]);

  const availableTests = useMemo(() => {
    if (!tests?.data) return [];
    let f = tests.data;
    if (selectedClass) f = f.filter(t => (t.classId?._id || t.classId)?.toString() === selectedClass);
    if (selectedSubject) f = f.filter(t => (t.subjectId?._id || t.subjectId)?.toString() === selectedSubject);
    return f;
  }, [tests?.data, selectedClass, selectedSubject]);

  useEffect(() => { setSelectedSubject(''); setSelectedTest(''); setSearchQuery(''); }, [selectedClass]);
  useEffect(() => { setSelectedTest(''); setSearchQuery(''); }, [selectedSubject]);

  const handleExport = () => {
    if (selectedTest) { const t = availableTests.find(t => (t._id || t.id) === selectedTest); downloadCSV(selectedTest, `${t?.title || 'test'}_results.csv`); }
  };

  const handlePrint = () => window.print();

  const getSelectedTestDetails = () => { if (!selectedTest) return null; return availableTests.find(t => (t._id || t.id) === selectedTest); };
  const convertScoreTo20 = (p) => Math.round((p / 100) * 20);

  const processedResults = useMemo(() => {
    if (!results?.data?.results) return [];
    return [...results.data.results].filter(r => !r.notTaken)
      .map(r => ({ ...r, percentage: r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0, caScore: r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100 / 100 * 20) : 0 }))
      .sort((a, b) => b.percentage - a.percentage || a.studentName.localeCompare(b.studentName))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [results?.data?.results]);

  const handleOpenPushModal = useCallback((type = 'test') => {
    setPushType(type); setPushError(''); setPushSuccess(''); setPushConfirm(false); setPushOverwriteMode(false);
    const s = {};
    processedResults.forEach(r => { s[r.studentId] = convertScoreTo20(r.percentage); });
    setPushScores(s); setShowPushModal(true);
  }, [processedResults]);

  const handleClosePushModal = () => {
    setShowPushModal(false); setPushConfirm(false); setPushOverwriteMode(false);
    setPushError(''); setPushSuccess(''); setPushType('test'); setPushScores({});
  };

  const handlePushScoreEdit = (sid, val) => {
    let n = parseFloat(val) || 0;
    n = Math.min(Math.max(n, 0), 20);
    setPushScores(prev => ({ ...prev, [sid]: n }));
  };

  const handleResetPushScores = () => {
    const s = {};
    processedResults.forEach(r => { s[r.studentId] = convertScoreTo20(r.percentage); });
    setPushScores(s);
  };

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const handlePushResults = async () => {
    if (!selectedTest || !pushTermId || !pushSessionId) { setPushError('Please select term and session'); return; }
    if (processedResults.length === 0) { setPushError('No results to push'); return; }
    const tObj = getSelectedTestDetails();
    const cId = tObj?.classId?._id || tObj?.classId;
    const sId = tObj?.subjectId?._id || tObj?.subjectId;
    if (!cId || !sId) { setPushError('Could not determine class or subject'); return; }
    let assessments;
    if (pushType === 'test') {
      assessments = processedResults.map(r => ({ studentId: r.studentId, testScore: pushScores[r.studentId] ?? convertScoreTo20(r.percentage), noteTakingScore: 0, assignmentScore: 0, examScore: 0, ...(pushOverwriteMode ? {} : { testScoreOnly: true }) }));
    } else {
      assessments = processedResults.map(r => ({ studentId: r.studentId, examScoreIncrement: pushScores[r.studentId] ?? convertScoreTo20(r.percentage) }));
    }
    setPushing(true); setPushError('');
    try {
      const response = await teacherCAAPI.pushTestResultsAsCA(selectedTest, { classId: cId, subjectId: sId, termId: pushTermId, sessionId: pushSessionId, assessments, pushType, overwriteTestScore: pushOverwriteMode });
      if (response.success) {
        const sm = response.data?.summary || response.data;
        const cr = sm?.created || 0, up = sm?.updated || 0, sk = sm?.skipped || 0;
        setPushSuccess(pushType === 'test' ? `Pushed ${assessments.length} CA test scores: ${cr} new, ${up} updated${sk > 0 ? `, ${sk} skipped` : ''}` : `Pushed ${assessments.length} exam scores: ${cr} new, ${up} updated${sk > 0 ? ` (${sk} skipped)` : ''}`);
        setShowPushModal(false); setPushConfirm(false);
      } else { setPushError(response.message || 'Failed to push'); }
    } catch (e) { setPushError(e.response?.data?.message || 'Failed to push'); }
    finally { setPushing(false); }
  };

  const getScoreColor = (p) => {
    if (p >= 80) return { bg: '#ecfdf5', text: '#059669', bar: '#10b981', glow: 'rgba(16,185,129,0.15)' };
    if (p >= 60) return { bg: '#eff6ff', text: '#2563eb', bar: '#3b82f6', glow: 'rgba(59,130,246,0.15)' };
    if (p >= 40) return { bg: '#fffbeb', text: '#d97706', bar: '#f59e0b', glow: 'rgba(245,158,11,0.15)' };
    return { bg: '#fef2f2', text: '#dc2626', bar: '#ef4444', glow: 'rgba(239,68,68,0.15)' };
  };

  const getGrade = (p) => {
    if (p >= 90) return { grade: 'A+', label: 'Outstanding', emoji: '🌟' };
    if (p >= 80) return { grade: 'A', label: 'Excellent', emoji: '⭐' };
    if (p >= 70) return { grade: 'B+', label: 'Very Good', emoji: '👍' };
    if (p >= 60) return { grade: 'B', label: 'Good', emoji: '✓' };
    if (p >= 50) return { grade: 'C', label: 'Average', emoji: '📖' };
    if (p >= 40) return { grade: 'D', label: 'Below Avg', emoji: '⚠️' };
    return { grade: 'F', label: 'Fail', emoji: '✗' };
  };

  const filteredResults = useMemo(() => {
    let data = [...processedResults];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(r => r.studentName?.toLowerCase().includes(q) || r.admissionNumber?.toLowerCase().includes(q));
    }
    return data.sort((a, b) => {
      let va, vb;
      switch (sortBy) {
        case 'name': va = a.studentName; vb = b.studentName; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'score': va = a.percentage; vb = b.percentage; break;
        case 'ca': va = a.caScore; vb = b.caScore; break;
        case 'date': va = a.dateTaken || ''; vb = b.dateTaken || ''; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        default: va = a.rank; vb = b.rank;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [processedResults, searchQuery, sortBy, sortDir]);

  const notTakenStudents = useMemo(() => {
    if (!results?.data?.results) return [];
    return results.data.results.filter(r => r.notTaken).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [results?.data?.results]);

  const scoreDistribution = useMemo(() => {
    const ranges = [
      { label: '90-100%', min: 90, max: 100, count: 0, color: '#059669', gradient: 'linear-gradient(90deg,#059669,#10b981)' },
      { label: '80-89%', min: 80, max: 89, count: 0, color: '#10b981', gradient: 'linear-gradient(90deg,#10b981,#34d399)' },
      { label: '70-79%', min: 70, max: 79, count: 0, color: '#3b82f6', gradient: 'linear-gradient(90deg,#3b82f6,#60a5fa)' },
      { label: '60-69%', min: 60, max: 69, count: 0, color: '#6366f1', gradient: 'linear-gradient(90deg,#6366f1,#818cf8)' },
      { label: '50-59%', min: 50, max: 59, count: 0, color: '#f59e0b', gradient: 'linear-gradient(90deg,#f59e0b,#fbbf24)' },
      { label: '40-49%', min: 40, max: 49, count: 0, color: '#f97316', gradient: 'linear-gradient(90deg,#f97316,#fb923c)' },
      { label: '0-39%', min: 0, max: 39, count: 0, color: '#ef4444', gradient: 'linear-gradient(90deg,#ef4444,#f87171)' },
    ];
    processedResults.forEach(r => { const rng = ranges.find(x => r.percentage >= x.min && r.percentage <= x.max); if (rng) rng.count++; });
    return ranges;
  }, [processedResults]);

  const maxDistCount = Math.max(...scoreDistribution.map(r => r.count), 1);

  const hasEditedScores = useMemo(() => {
    return processedResults.some(r => { const c = convertScoreTo20(r.percentage); const cur = pushScores[r.studentId]; return cur !== undefined && cur !== c; });
  }, [processedResults, pushScores]);

  const performanceInsights = useMemo(() => {
    if (processedResults.length === 0) return [];
    const insights = [];
    const avg = results?.data?.statistics?.averageScore || 0;
    const passRate = results?.data?.statistics?.passRate || 0;
    const highest = results?.data?.statistics?.highestScore || 0;
    const lowest = results?.data?.statistics?.lowestScore || 0;
    const topPerformer = processedResults[0];
    const range = highest - lowest;
    if (avg >= 75) insights.push({ type: 'success', icon: '🎯', text: `Strong class performance with ${avg}% average` });
    else if (avg >= 50) insights.push({ type: 'info', icon: '📊', text: `Moderate performance at ${avg}% average` });
    else insights.push({ type: 'warning', icon: '⚠️', text: `Low class average of ${avg}% — consider review` });
    if (passRate >= 80) insights.push({ type: 'success', icon: '✅', text: `${passRate}% pass rate is excellent` });
    else if (passRate >= 50) insights.push({ type: 'info', icon: '📈', text: `${passRate}% pass rate — room for improvement` });
    else insights.push({ type: 'danger', icon: '🚨', text: `Only ${passRate}% passed — intervention needed` });
    if (range > 50) insights.push({ type: 'warning', icon: '📏', text: `Wide score spread (${range}%) — significant disparity` });
    else if (range < 20 && range > 0) insights.push({ type: 'success', icon: '🎯', text: `Tight score range (${range}%) — consistent performance` });
    if (topPerformer) insights.push({ type: 'success', icon: '🏆', text: `Top performer: ${topPerformer.studentName} (${topPerformer.percentage}%)` });
    const failing = processedResults.filter(r => r.percentage < 40).length;
    if (failing > 0) insights.push({ type: 'danger', icon: '❌', text: `${failing} student${failing > 1 ? 's' : ''} scored below 40%` });
    const distinctions = processedResults.filter(r => r.percentage >= 80).length;
    if (distinctions > 0) insights.push({ type: 'success', icon: '🌟', text: `${distinctions} student${distinctions > 1 ? 's' : ''} scored above 80%` });
    return insights;
  }, [processedResults, results?.data?.statistics]);

  const gradeDistribution = useMemo(() => {
    const grades = {};
    processedResults.forEach(r => { const g = getGrade(r.percentage); grades[g.grade] = (grades[g.grade] || 0) + 1; });
    return Object.entries(grades).sort((a, b) => b[1] - a[1]);
  }, [processedResults]);

  const isLoading = testsLoading || classesLoading || subjectsLoading || (isTeacher && myAssignmentsLoading);

  const avatarColors = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316','#06b6d4'];
  const getInitials = (n) => n?.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const getAvatarColor = (n) => { const h = [...(n||'')].reduce((a, c) => a + c.charCodeAt(0), 0); return avatarColors[Math.abs(h) % avatarColors.length]; };
  const getSortIcon = (field) => { if (sortBy !== field) return '↕'; return sortDir === 'asc' ? '↑' : '↓'; };

  if (isLoading) return <Loading message="Loading results..." />;

  return (
    <div className={`tr-root ${darkMode ? 'tr-dark-mode' : ''}`}>
      <style>{`
        .tr-root{--bg:#f1f5f9;--surface:#ffffff;--border:#e2e8f0;--text:#0f172a;--text-secondary:#475569;--text-muted:#94a3b8;--primary:#4f46e5;--primary-hover:#4338ca;--primary-light:#eef2ff;--primary-50:#eef2ff;--danger:#ef4444;--danger-hover:#dc2626;--success:#10b981;--success-light:#ecfdf5;--warning:#f59e0b;--warning-light:#fffbeb;--amber:#f59e0b;--radius:14px;--radius-sm:10px;--radius-xs:6px;--shadow-xs:0 1px 2px rgba(0,0,0,0.04);--shadow-sm:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);--shadow:0 2px 8px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);--shadow-md:0 4px 12px rgba(0,0,0,0.07),0 2px 4px rgba(0,0,0,0.04);--shadow-lg:0 12px 24px rgba(0,0,0,0.08),0 4px 8px rgba(0,0,0,0.04);--shadow-xl:0 20px 40px rgba(0,0,0,0.1),0 8px 16px rgba(0,0,0,0.06);--transition:180ms cubic-bezier(0.4,0,0.2,1);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;background:var(--bg);min-height:100vh;}
        .tr-dark-mode{--bg:#0f172a;--surface:#1e293b;--border:#334155;--text:#f1f5f9;--text-secondary:#cbd5e1;--text-muted:#64748b;--primary:#818cf8;--primary-hover:#6366f1;--primary-light:#1e1b4b;--primary-50:#1e1b4b;--danger:#f87171;--danger-hover:#ef4444;--success:#34d399;--success-light:#064e3b;--warning:#fbbf24;--warning-light:#451a03;--amber:#fbbf24;--shadow-xs:0 1px 2px rgba(0,0,0,0.2);--shadow-sm:0 1px 3px rgba(0,0,0,0.3);--shadow:0 2px 8px rgba(0,0,0,0.3);--shadow-md:0 4px 12px rgba(0,0,0,0.3);--shadow-lg:0 12px 24px rgba(0,0,0,0.4);--shadow-xl:0 20px 40px rgba(0,0,0,0.5);}
        .tr-header{background:var(--surface);border-bottom:1px solid var(--border);padding:20px 24px;position:sticky;top:0;z-index:30;backdrop-filter:blur(12px);background:rgba(255,255,255,0.85);}
        .tr-dark-mode .tr-header{background:rgba(30,41,59,0.85);}
        .tr-header::after{content:'';position:absolute;bottom:-1px;left:24px;right:24px;height:2px;background:linear-gradient(90deg,transparent,var(--primary) 20%,#7c3aed 50%,var(--primary) 80%,transparent);opacity:0.4;border-radius:1px;}
        .tr-header-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .tr-header-left{display:flex;align-items:center;gap:16px;}
        .tr-header-icon{width:48px;height:48px;border-radius:14px;flex-shrink:0;background:linear-gradient(135deg,var(--primary) 0%,#7c3aed 50%,#ec4899 100%);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.35);animation:trIconPulse 3s ease-in-out infinite;}
        @keyframes trIconPulse{0%,100%{box-shadow:0 4px 16px rgba(79,70,229,0.35);}50%{box-shadow:0 4px 24px rgba(79,70,229,0.5);}}
        .tr-header-title{font-size:1.4rem;font-weight:800;color:var(--text);margin:0;letter-spacing:-0.03em;}
        .tr-header-sub{font-size:0.82rem;color:var(--text-muted);margin:2px 0 0;font-weight:500;}
        .tr-header-actions{display:flex;gap:8px;align-items:center;}
        .tr-dark-toggle{width:38px;height:38px;border-radius:10px;border:1px solid var(--border);background:var(--surface);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-muted);transition:all var(--transition);font-size:1.1rem;}
        .tr-dark-toggle:hover{background:var(--primary-light);color:var(--primary);border-color:var(--primary);}
        .tr-btn{display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border-radius:var(--radius-sm);font-size:0.82rem;font-weight:600;border:none;cursor:pointer;transition:all var(--transition);white-space:nowrap;line-height:1.4;font-family:inherit;position:relative;overflow:hidden;}
        .tr-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.12) 0%,transparent 60%);pointer-events:none;}
        .tr-btn:active{transform:scale(0.97);}
        .tr-btn:disabled{opacity:0.45;cursor:not-allowed;transform:none!important;}
        .tr-btn svg{width:15px;height:15px;flex-shrink:0;}
        .tr-btn-primary{background:linear-gradient(135deg,var(--primary) 0%,#6d28d9 100%);color:#fff;box-shadow:0 2px 8px rgba(79,70,229,0.3);}
        .tr-btn-primary:hover{box-shadow:0 4px 16px rgba(79,70,229,0.4);transform:translateY(-1px);}
        .tr-btn-ghost{background:var(--surface);color:var(--text-secondary);border:1px solid var(--border);}
        .tr-btn-ghost:hover{background:#f8fafc;border-color:#cbd5e1;}
        .tr-btn-success{background:var(--success);color:#fff;box-shadow:0 2px 8px rgba(16,185,129,0.25);}
        .tr-btn-success:hover{background:#059669;}
        .tr-btn-warning{background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#fff;box-shadow:0 2px 8px rgba(245,158,11,0.25);}
        .tr-btn-warning:hover{box-shadow:0 4px 16px rgba(245,158,11,0.35);transform:translateY(-1px);}
        .tr-btn-cancel{background:var(--surface);color:var(--text-secondary);border:1px solid var(--border);}
        .tr-btn-cancel:hover{background:#f8fafc;}
        .tr-btn-confirm{background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;box-shadow:0 2px 8px rgba(239,68,68,0.25);}
        .tr-btn-confirm:hover{box-shadow:0 4px 16px rgba(239,68,68,0.35);transform:translateY(-1px);}
        .tr-btn-sm{padding:7px 13px;font-size:0.78rem;border-radius:var(--radius-xs);}
        .tr-btn-sm svg{width:13px;height:13px;}
        .tr-btn-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:trSpin 0.6s linear infinite;flex-shrink:0;}
        @keyframes trSpin{to{transform:rotate(360deg);}}
        .tr-toasts{position:fixed;top:16px;right:16px;z-index:200;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:480px;}
        .tr-toast{pointer-events:auto;display:flex;align-items:center;gap:10px;padding:14px 18px;border-radius:var(--radius-sm);font-size:0.84rem;font-weight:500;box-shadow:var(--shadow-lg);animation:trToastIn 0.3s cubic-bezier(0.16,1,0.3,1);line-height:1.4;}
        .tr-toast--success{background:var(--success-light);color:#065f46;border:1px solid #a7f3d0;}
        .tr-toast--error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
        .tr-dark-mode .tr-toast--success{background:rgba(6,78,59,0.9);color:#6ee7b7;border-color:#065f46;}
        .tr-dark-mode .tr-toast--error{background:rgba(127,29,29,0.9);color:#fca5a5;border-color:#7f1d1d;}
        .tr-toast svg{width:16px;height:16px;flex-shrink:0;}
        @keyframes trToastIn{from{opacity:0;transform:translateX(20px) scale(0.95);}to{opacity:1;transform:translateX(0) scale(1);}}
        .tr-stats{display:flex;gap:12px;padding:14px 24px;background:var(--bg);border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none;}
        .tr-stats::-webkit-scrollbar{display:none;}
        .tr-stat{display:inline-flex;align-items:center;gap:10px;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);white-space:nowrap;box-shadow:var(--shadow-xs);transition:all var(--transition);position:relative;overflow:hidden;}
        .tr-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;opacity:0;transition:opacity var(--transition);}
        .tr-stat:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);}
        .tr-stat:hover::before{opacity:1;}
        .tr-stat--total::before{background:var(--primary);}
        .tr-stat--taken::before{background:#059669;}
        .tr-stat--avg::before{background:#2563eb;}
        .tr-stat--pass::before{background:#10b981;}
        .tr-stat--high::before{background:#d97706;}
        .tr-stat--low::before{background:#dc2626;}
        .tr-stat-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .tr-stat-icon svg{width:18px;height:18px;}
        .tr-stat-val{font-size:1.2rem;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;}
        .tr-stat-label{font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;}
        .tr-panel{background:var(--surface);border-bottom:1px solid var(--border);padding:16px 24px;}
        .tr-panel-header{display:flex;align-items:center;gap:8px;margin-bottom:14px;}
        .tr-panel-header svg{width:16px;height:16px;color:var(--text-muted);}
        .tr-panel-title{font-size:0.82rem;font-weight:700;color:var(--text);margin:0;text-transform:uppercase;letter-spacing:0.04em;}
        .tr-filters-row{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;}
        .tr-filter-group{display:flex;flex-direction:column;gap:5px;}
        .tr-filter-label{font-size:0.76rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;}
        .tr-filter-select{width:100%;padding:10px 36px 10px 14px;border-radius:var(--radius-sm);border:1.5px solid var(--border);background:var(--surface);font-size:0.88rem;color:var(--text);outline:none;transition:border-color var(--transition),box-shadow var(--transition);box-sizing:border-box;-webkit-appearance:none;appearance:none;font-family:inherit;cursor:pointer;}
        .tr-filter-select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(79,70,229,0.1);}
        .tr-filter-select:disabled{background:#f8fafc;color:var(--text-muted);cursor:not-allowed;}
        .tr-filter-select option{color:var(--text);background:var(--surface);}
        .tr-filter-hint{font-size:0.72rem;color:#dc2626;margin-top:2px;font-weight:500;}
        .tr-select-wrap{position:relative;}
        .tr-select-wrap svg{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;}
        .tr-filter-actions{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;}
        .tr-search-wrap{position:relative;}
        .tr-search-input{width:100%;padding:10px 14px 10px 38px;border-radius:var(--radius-sm);border:1.5px solid var(--border);background:var(--surface);font-size:0.88rem;color:var(--text);outline:none;transition:border-color var(--transition),box-shadow var(--transition);box-sizing:border-box;font-family:inherit;}
        .tr-search-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(79,70,229,0.1);}
        .tr-search-input::placeholder{color:var(--text-muted);}
        .tr-search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;}
        .tr-search-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;font-size:0.8rem;}
        .tr-search-clear:hover{color:var(--text);}
        .tr-dist{background:var(--surface);border-bottom:1px solid var(--border);}
        .tr-dist-header{display:flex;align-items:center;gap:8px;padding:14px 24px;border-bottom:1px solid var(--border);}
        .tr-dist-header svg{width:16px;height:16px;color:var(--text-muted);}
        .tr-dist-header h3{margin:0;font-size:0.82rem;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.04em;}
        .tr-dist-body{padding:16px 24px 18px;}
        .tr-dist-row{display:flex;align-items:center;gap:10px;margin-bottom:7px;}
        .tr-dist-label{font-size:0.76rem;font-weight:600;color:var(--text-muted);min-width:54px;text-align:right;}
        .tr-dist-bar{flex:1;height:24px;background:#f1f5f9;border-radius:7px;overflow:hidden;}
        .tr-dark-mode .tr-dist-bar{background:#334155;}
        .tr-dist-fill{height:100%;border-radius:7px;display:flex;align-items:center;padding-left:8px;transition:width 0.6s cubic-bezier(0.16,1,0.3,1);min-width:fit-content;}
        .tr-dist-fill span{font-size:0.68rem;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.2);}
        .tr-insights{background:var(--surface);border-bottom:1px solid var(--border);overflow:hidden;}
        .tr-insights-toggle{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;cursor:pointer;transition:background var(--transition);user-select:none;}
        .tr-insights-toggle:hover{background:var(--primary-light);}
        .tr-insights-toggle-left{display:flex;align-items:center;gap:8px;}
        .tr-insights-toggle-left svg{width:16px;height:16px;color:var(--primary);}
        .tr-insights-toggle h3{margin:0;font-size:0.82rem;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.04em;}
        .tr-insights-toggle .tr-insights-badge{font-size:0.72rem;font-weight:700;color:var(--primary);background:var(--primary-light);padding:2px 10px;border-radius:20px;margin-left:8px;}
        .tr-insights-chevron{width:20px;height:20px;color:var(--text-muted);transition:transform var(--transition);}
        .tr-insights-chevron.open{transform:rotate(180deg);}
        .tr-insights-body{padding:0 24px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:8px;animation:trSlideDown 0.3s ease;}
        .tr-insight{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:var(--radius-xs);font-size:0.82rem;line-height:1.4;transition:all var(--transition);}
        .tr-insight:hover{transform:translateX(4px);}
        .tr-insight--success{background:var(--success-light);color:#166534;}
        .tr-insight--info{background:#eff6ff;color:#1e40af;}
        .tr-insight--warning{background:var(--warning-light);color:#92400e;}
        .tr-insight--danger{background:#fef2f2;color:#991b1b;}
        .tr-dark-mode .tr-insight--success{background:rgba(6,78,59,0.3);color:#6ee7b7;}
        .tr-dark-mode .tr-insight--info{background:rgba(30,58,138,0.3);color:#93c5fd;}
        .tr-dark-mode .tr-insight--warning{background:rgba(69,26,3,0.3);color:#fcd34d;}
        .tr-dark-mode .tr-insight--danger{background:rgba(127,29,29,0.3);color:#fca5a5;}
        .tr-insight-icon{font-size:1rem;flex-shrink:0;margin-top:1px;}
        .tr-grade-row{display:flex;gap:6px;padding:12px 24px;background:var(--surface);border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:wrap;scrollbar-width:none;}
        .tr-grade-row::-webkit-scrollbar{display:none;}
        .tr-grade-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:0.76rem;font-weight:600;white-space:nowrap;border:1px solid var(--border);background:var(--surface);transition:all var(--transition);}
        .tr-grade-pill:hover{transform:translateY(-1px);box-shadow:var(--shadow-sm);}
        .tr-grade-pill-grade{font-weight:800;font-size:0.82rem;}
        .tr-grade-pill-count{color:var(--text-muted);}
        .tr-results-card{background:var(--surface);border-bottom:1px solid var(--border);overflow:hidden;}
        .tr-results-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 24px;border-bottom:1px solid var(--border);flex-wrap:wrap;}
        .tr-results-left{display:flex;align-items:center;gap:8px;}
        .tr-results-left svg{width:16px;height:16px;color:var(--text-muted);}
        .tr-results-left h3{margin:0;font-size:0.82rem;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.04em;}
        .tr-results-right{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
        .tr-results-count{font-size:0.76rem;font-weight:700;color:var(--primary);background:var(--primary-light);padding:3px 10px;border-radius:20px;}
        .tr-results-search-count{font-size:0.72rem;color:var(--text-muted);font-style:italic;}
        .tr-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .tr-table{width:100%;border-collapse:collapse;font-size:0.88rem;min-width:780px;}
        .tr-table thead{background:#f8fafc;position:sticky;top:0;z-index:5;}
        .tr-dark-mode .tr-table thead{background:#1a2332;}
        .tr-table th{padding:12px 16px;text-align:left;font-weight:600;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);border-bottom:1px solid var(--border);white-space:nowrap;user-select:none;}
        .tr-table th.sortable{cursor:pointer;transition:color var(--transition);}
        .tr-table th.sortable:hover{color:var(--primary);}
        .tr-table td{padding:14px 16px;border-bottom:1px solid #f1f5f9;vertical-align:middle;}
        .tr-dark-mode .tr-table td{border-bottom-color:#334155;}
        .tr-table tbody tr{transition:all var(--transition);animation:trRowIn 0.35s ease both;}
        .tr-table tbody tr:hover{background:rgba(79,70,229,0.04);}
        .tr-dark-mode .tr-table tbody tr:hover{background:rgba(129,140,248,0.08);}
        .tr-table tbody tr:last-child td{border-bottom:none;}
        .tr-table tbody tr.tr-highlighted{background:var(--primary-light);box-shadow:inset 3px 0 0 var(--primary);}
        @keyframes trRowIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        .tr-rank{width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;flex-shrink:0;border:1px solid var(--border);background:#f8fafc;color:var(--text-muted);}
        .tr-rank--gold{background:linear-gradient(135deg,#fef3c7,#fde68a);border-color:#f59e0b;color:#92400e;box-shadow:0 2px 8px rgba(245,158,11,0.25);}
        .tr-rank--silver{background:linear-gradient(135deg,#f3f4f6,#e5e7eb);border-color:#9ca3af;color:#374151;box-shadow:0 2px 8px rgba(156,163,175,0.25);}
        .tr-rank--bronze{background:linear-gradient(135deg,#fed7aa,#fdba74);border-color:#ea580c;color:#7c2d12;box-shadow:0 2px 8px rgba(234,88,12,0.25);}
        .tr-student{display:flex;align-items:center;gap:10px;}
        .tr-avatar{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.72rem;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.12);transition:transform var(--transition);}
        .tr-table tbody tr:hover .tr-avatar{transform:scale(1.08);}
        .tr-student-name{font-weight:600;font-size:0.9rem;color:var(--text);line-height:1.3;}
        .tr-student-adm{font-size:0.76rem;color:var(--text-muted);font-weight:500;}
        .tr-score-cell{display:flex;align-items:center;gap:12px;}
        .tr-ring{width:42px;height:42px;position:relative;flex-shrink:0;}
        .tr-ring svg{transform:rotate(-90deg);}
        .ring-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;}
        .tr-score-frac{font-weight:600;font-size:0.88rem;}
        .tr-score-status{font-size:0.72rem;margin-top:1px;}
        .tr-grade{display:inline-block;padding:3px 10px;border-radius:6px;font-size:0.76rem;font-weight:700;}
        .tr-ca{display:inline-block;padding:3px 10px;background:var(--primary-light);border:1px solid #c7d2fe;border-radius:6px;font-size:0.76rem;font-weight:700;color:#4338ca;}
        .tr-dark-mode .tr-ca{border-color:#4338ca;}
        .tr-date{color:var(--text-muted);font-size:0.8rem;white-space:nowrap;font-variant-numeric:tabular-nums;}
        .tr-notaken{background:var(--surface);border-bottom:1px solid var(--border);}
        .tr-notaken-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 24px;border-bottom:1px solid #fecaca;background:#fef2f2;}
        .tr-dark-mode .tr-notaken-bar{background:rgba(127,29,29,0.2);border-bottom-color:#7f1d1d;}
        .tr-notaken-bar h3{margin:0;font-size:0.82rem;font-weight:700;color:#991b1b;display:flex;align-items:center;gap:8px;}
        .tr-dark-mode .tr-notaken-bar h3{color:#fca5a5;}
        .tr-notaken-badge{font-size:0.72rem;font-weight:700;color:#991b1b;background:#fff;padding:2px 10px;border-radius:12px;}
        .tr-notaken-list{padding:12px 24px;display:flex;flex-wrap:wrap;gap:6px;}
        .tr-notaken-chip{padding:5px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius-xs);font-size:0.78rem;color:#991b1b;font-weight:500;transition:all var(--transition);}
        .tr-notaken-chip:hover{background:#fee2e2;border-color:#fca5a5;}
        .tr-dark-mode .tr-notaken-chip{background:rgba(127,29,29,0.15);border-color:#7f1d1d;color:#fca5a5;}
        .tr-empty{text-align:center;padding:56px 24px;color:var(--text-muted);}
        .tr-empty-icon{width:72px;height:72px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--primary);animation:trEmptyFloat 3s ease-in-out infinite;}
        @keyframes trEmptyFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
        .tr-empty h3{font-size:1.05rem;font-weight:700;color:var(--text-secondary);margin:0 0 6px;}
        .tr-empty p{font-size:0.85rem;margin:0;max-width:340px;line-height:1.5;margin-left:auto;margin-right:auto;}
        .tr-locked{background:var(--surface);border:1px solid #fde68a;border-radius:var(--radius);padding:40px 24px;text-align:center;margin:16px 24px;}
        .tr-locked-icon{width:56px;height:56px;border-radius:50%;background:#fef3c7;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;animation:trEmptyFloat 3s ease-in-out infinite;}
        .tr-locked h3{font-size:1.05rem;font-weight:700;color:#92400e;margin:0 0 6px;}
        .tr-locked p{font-size:0.88rem;color:#b45309;margin:0;line-height:1.5;max-width:360px;margin-left:auto;margin-right:auto;}
        .tr-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(6px);z-index:100;display:flex;align-items:center;justify-content:center;animation:trFadeIn 0.2s ease;}
        @keyframes trFadeIn{from{opacity:0;}to{opacity:1;}}
        .tr-modal{background:var(--surface);border-radius:20px;width:100%;max-width:580px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow-xl);animation:trModalIn 0.35s cubic-bezier(0.16,1,0.3,1);}
        @keyframes trModalIn{from{opacity:0;transform:scale(0.95) translateY(16px);}to{opacity:1;transform:scale(1) translateY(0);}}
        .tr-modal-handle{width:36px;height:4px;border-radius:2px;background:#cbd5e1;margin:10px auto 0;}
        .tr-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 28px;border-bottom:1px solid var(--border);flex-shrink:0;}
        .tr-modal-left{display:flex;align-items:center;gap:12px;min-width:0;flex:1;}
        .tr-modal-icon{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .tr-modal-icon--test{background:var(--primary-light);color:var(--primary);}
        .tr-modal-icon--exam{background:var(--warning-light);color:var(--warning);}
        .tr-modal-title{font-size:1.15rem;font-weight:800;color:var(--text);margin:0;letter-spacing:-0.02em;}
        .tr-modal-sub{margin:3px 0 0;font-size:0.78rem;color:var(--text-muted);line-height:1.4;}
        .tr-modal-close{width:34px;height:34px;border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:1.3rem;transition:all var(--transition);flex-shrink:0;}
        .tr-modal-close:hover{background:#e2e8f0;color:var(--text);transform:rotate(90deg);}
        .tr-modal-body{flex:1;overflow-y:auto;padding:24px 28px;position:relative;}
        .tr-modal-footer{display:flex;gap:10px;padding:16px 28px;border-top:1px solid var(--border);justify-content:flex-end;flex-wrap:wrap;flex-shrink:0;}
        .tr-push-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:0.76rem;font-weight:600;margin-bottom:16px;}
        .tr-push-badge--test{background:var(--primary-light);color:#4338ca;border:1px solid #c7d2fe;}
        .tr-push-badge--exam{background:var(--warning-light);color:#92400e;border:1px solid #fde68a;}
        .tr-info{padding:14px 16px;border-radius:var(--radius-sm);margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;}
        .tr-info--test{background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border:1px solid #a7f3d0;}
        .tr-info--exam{background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:1px solid #fde68a;}
        .tr-info-title{grid-column:1/-1;font-size:0.78rem;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px;}
        .tr-info--test .tr-info-title{color:#166534;}
        .tr-info--exam .tr-info-title{color:#92400e;}
        .tr-info-item{font-size:0.78rem;color:var(--text-secondary);}
        .tr-info-item strong{color:var(--text);}
        .tr-alert{padding:12px 16px;border-radius:var(--radius-sm);font-size:0.84rem;font-weight:500;display:flex;align-items:center;gap:10px;margin-bottom:16px;animation:trSlideDown 0.3s cubic-bezier(0.16,1,0.3,1);}
        .tr-alert--danger{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
        .tr-alert--warn{background:var(--warning-light);color:#92400e;border:1px solid #fde68a;}
        .tr-alert svg{width:16px;height:16px;flex-shrink:0;}
        @keyframes trSlideDown{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}
        .tr-form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
        .tr-form-group{display:flex;flex-direction:column;gap:6px;}
        .tr-form-label{font-size:0.78rem;font-weight:700;color:var(--text-secondary);}
        .tr-form-select{width:100%;padding:10px 36px 10px 14px;border-radius:var(--radius-sm);border:1.5px solid var(--border);background:var(--surface);font-size:0.88rem;color:var(--text);outline:none;transition:border-color var(--transition),box-shadow var(--transition);box-sizing:border-box;-webkit-appearance:none;appearance:none;font-family:inherit;cursor:pointer;}
        .tr-form-select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(79,70,229,0.1);}
        .tr-form-select option{color:var(--text);background:var(--surface);}
        .tr-toggle-row{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--warning-light);border:1px solid #fde68a;border-radius:var(--radius-sm);margin-bottom:16px;font-size:0.8rem;color:#92400e;}
        .tr-toggle{position:relative;width:38px;height:22px;flex-shrink:0;}
        .tr-toggle input{opacity:0;width:0;height:0;position:absolute;}
        .tr-toggle-slider{position:absolute;inset:0;background:#d1d5db;border-radius:11px;cursor:pointer;transition:background 0.2s;}
        .tr-toggle-slider::before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:transform 0.2s;}
        .tr-toggle input:checked+.tr-toggle-slider{background:var(--warning);}
        .tr-toggle input:checked+.tr-toggle-slider::before{transform:translateX(16px);}
        .tr-preview-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
        .tr-preview-title{font-size:0.76rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;}
        .tr-preview-reset{font-size:0.72rem;color:var(--primary);background:none;border:none;cursor:pointer;padding:4px 0;font-weight:600;font-family:inherit;}
        .tr-preview-reset:hover{text-decoration:underline;}
        .tr-preview{border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;max-height:220px;overflow-y:auto;}
        .tr-preview table{width:100%;border-collapse:collapse;}
        .tr-preview th{padding:8px 10px;font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;background:#f8fafc;border-bottom:1px solid var(--border);text-align:left;position:sticky;top:0;}
        .tr-preview td{padding:6px 10px;font-size:0.78rem;border-bottom:1px solid #f1f5f9;}
        .tr-preview-input{width:58px;padding:5px 6px;border:1.5px solid var(--border);border-radius:6px;font-size:0.78rem;font-weight:700;text-align:center;min-height:32px;box-sizing:border-box;outline:none;transition:border-color var(--transition),box-shadow var(--transition);font-family:inherit;}
        .tr-preview-input:focus{border-color:var(--primary);box-shadow:0 0 0 2px rgba(79,70,229,0.15);}
        .tr-preview-input--test{background:var(--primary-light);color:#4338ca;border-color:#c7d2fe;}
        .tr-preview-input--exam{background:var(--warning-light);color:#92400e;border-color:#fde68a;}
        .tr-preview-more{text-align:center;padding:6px;font-size:0.7rem;color:var(--text-muted);font-style:italic;}
        .tr-edited-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--warning);margin-left:4px;}
        .tr-confirm{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius-sm);margin-bottom:12px;font-size:0.78rem;color:#991b1b;}
        .tr-cards{display:none;flex-direction:column;gap:10px;padding:12px 16px;}
        .tr-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;transition:all var(--transition);animation:trRowIn 0.35s ease both;position:relative;overflow:hidden;}
        .tr-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--primary),#7c3aed);opacity:0.6;}
        .tr-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;}
        .tr-card-left{display:flex;align-items:center;gap:10px;min-width:0;flex:1;}
        .tr-card-name{font-weight:700;font-size:0.95rem;color:var(--text);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;}
        .tr-card-adm{font-size:0.76rem;color:var(--text-muted);display:block;}
        .tr-card-ring{width:50px;height:50px;position:relative;flex-shrink:0;}
        .tr-card-ring svg{transform:rotate(-90deg);width:50px;height:50px;}
        .tr-card-ring .ring-text{font-size:0.78rem;font-weight:700;}
        .tr-card-mid{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;margin-bottom:12px;}
        .tr-card-frac{font-size:0.88rem;font-weight:600;color:var(--text);}
        .tr-card-pass{font-size:0.74rem;font-weight:600;padding:3px 10px;border-radius:6px;}
        .tr-card-bottom{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
        .tr-card-date{margin-left:auto;font-size:0.7rem;color:var(--text-muted);white-space:nowrap;}
        .tr-card-actions{display:flex;gap:8px;padding-top:14px;border-top:1px solid var(--border);flex-wrap:wrap;}
        .tr-card-actions .tr-btn{flex:1;justify-content:center;min-width:0;}
        @media print{.tr-header-actions,.tr-filter-actions,.tr-results-right,.tr-cards,.tr-toasts,.tr-modal-overlay,.tr-insights,.tr-dark-toggle,.tr-grade-row,.tr-notaken,.tr-panel{display:none!important;}.tr-table-section{display:block!important;}.tr-header{position:static;background:#fff!important;backdrop-filter:none;}.tr-header::after{display:none;}.tr-stats{print-color-adjust:exact;-webkit-print-color-adjust:exact;}.tr-stat{border:1px solid #ddd;break-inside:avoid;}.tr-root{background:#fff;color:#000;}.tr-table tbody tr{animation:none!important;}}
        @media(min-width:768px){.tr-cards{display:none!important;}.tr-table-section{display:block!important;}.tr-header{padding:24px 32px;}.tr-panel{padding:16px 32px;}.tr-stats{padding:14px 32px;}.tr-filters-row{grid-template-columns:1fr 1fr 1fr auto;}.tr-dist,.tr-dist-header,.tr-dist-body{padding-left:32px;padding-right:32px;}.tr-results-bar{padding:14px 32px;}.tr-notaken-bar,.tr-notaken-list{padding-left:32px;padding-right:32px;}.tr-locked{margin:16px 32px;}.tr-insights-body{padding:0 32px 16px;}.tr-grade-row{padding:12px 32px;}}
        @media(max-width:767px){.tr-header{padding:16px;}.tr-header-inner{flex-direction:column;align-items:flex-start;}.tr-header-title{font-size:1.15rem;}.tr-header-icon{width:42px;height:42px;border-radius:12px;}.tr-header-icon svg{width:22px;height:22px;}.tr-panel{padding:14px 16px;}.tr-filters-row{grid-template-columns:1fr;}.tr-stats{padding:10px 16px;gap:8px;}.tr-stat{padding:8px 12px;}.tr-stat-icon{width:30px;height:30px;border-radius:8px;}.tr-stat-icon svg{width:15px;height:15px;}.tr-stat-val{font-size:1rem;}.tr-stat-label{font-size:0.62rem;}.tr-dist,.tr-dist-header,.tr-dist-body{padding-left:16px;padding-right:16px;}.tr-results-bar{padding:12px 16px;}.tr-notaken-bar,.tr-notaken-list{padding-left:16px;padding-right:16px;}.tr-locked{margin:12px 16px;padding:28px 16px;}.tr-table-section{display:none!important;}.tr-cards{display:flex!important;}.tr-form-row{grid-template-columns:1fr;}.tr-modal{border-radius:20px 20px 0 0;max-height:96vh;width:100%;max-width:100%;}.tr-modal-overlay{align-items:flex-end;}.tr-modal-body{padding:16px;}.tr-modal-header{padding:14px 16px 10px;}.tr-modal-footer{padding:14px 16px;padding-bottom:max(14px,env(safe-area-inset-bottom));gap:8px;}.tr-modal-footer .tr-btn{flex:1;justify-content:center;padding:14px;font-size:0.85rem;min-height:44px;}.tr-preview{max-height:180px;}.tr-toast{top:auto;bottom:16px;left:12px;right:12px;max-width:none;border-radius:var(--radius-sm);box-shadow:var(--shadow-xl);}.tr-insights-body{padding:0 16px 16px;grid-template-columns:1fr;}.tr-grade-row{padding:12px 16px;}}
        @media(max-width:420px){.tr-card-bottom{flex-direction:column;align-items:stretch;}.tr-card-date{margin-left:0;}.tr-card-actions{flex-direction:column;}.tr-card-actions .tr-btn{width:100%;}}
        .tr-root::-webkit-scrollbar{width:6px;height:6px;}.tr-root::-webkit-scrollbar-track{background:transparent;}.tr-root::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}.tr-root::-webkit-scrollbar-thumb:hover{background:#94a3b8;}
      `}</style>

      {/* TOASTS */}
      <div className="tr-toasts">
        {pushSuccess && (
          <div className="tr-toast tr-toast--success" key={`suc-${Date.now()}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>{pushSuccess}</span>
          </div>
        )}
        {pushError && !showPushModal && (
          <div className="tr-toast tr-toast--error" key={`err-${Date.now()}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span>{pushError}</span>
          </div>
        )}
      </div>

      {/* HEADER */}
      <div className="tr-header">
        <div className="tr-header-inner">
          <div className="tr-header-left">
            <div className="tr-header-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M18 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14"/><path d="M9 12h6"/><circle cx="12" cy="16" r="2"/></svg>
            </div>
            <div>
              <h1 className="tr-header-title">Test Results</h1>
              <p className="tr-header-sub">{isTeacher ? 'View and analyze your assigned subject results' : 'View and analyze test results'}</p>
            </div>
          </div>
          <div className="tr-header-actions">
            <button className="tr-dark-toggle" onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Light mode' : 'Dark mode'}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      {/* LOCKED */}
      {isTeacher && availableClasses.length === 0 && !isLoading && (
        <div className="tr-locked">
          <div className="tr-locked-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h3>No Access Granted</h3>
          <p>You have not been assigned to any classes or subjects yet.</p>
        </div>
      )}

      {/* FILTERS */}
      <div className="tr-panel">
        <div className="tr-panel-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <h3 className="tr-panel-title">Filter Results</h3>
        </div>
        <div className="tr-filters-row">
          <div className="tr-filter-group">
            <label className="tr-filter-label">Class</label>
            <div className="tr-select-wrap">
              <select className="tr-filter-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">All Classes</option>
                {availableClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div className="tr-filter-group">
            <label className="tr-filter-label">Subject</label>
            <div className="tr-select-wrap">
              <select className="tr-filter-select" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={isTeacher ? !selectedClass : false}>
                <option value="">{isTeacher ? (selectedClass ? 'Select Subject' : 'Select Class First') : 'All Subjects'}</option>
                {availableSubjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            {selectedClass && availableSubjects.length === 0 && <span className="tr-filter-hint">No subjects assigned for this class.</span>}
          </div>
          <div className="tr-filter-group">
            <label className="tr-filter-label">Test</label>
            <div className="tr-select-wrap">
              <select className="tr-filter-select" value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)}>
                <option value="">{availableTests.length ? 'Select a Test' : 'No Tests'}</option>
                {availableTests.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.title}</option>)}
              </select>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div className="tr-filter-actions">
            {selectedTest && (
              <>
                <button className="tr-btn tr-btn-success tr-btn-sm" onClick={handleExport} title="Export CSV">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  CSV
                </button>
                <button className="tr-btn tr-btn-ghost tr-btn-sm" onClick={handlePrint} title="Print">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* LOADING */}
      {resultsLoading && <Loading message="Loading results..." />}

      {/* MAIN CONTENT */}
      {results?.data && !resultsLoading && (
        <>
          {/* Stats */}
          <div className="tr-stats">
            <div className="tr-stat tr-stat--total">
              <div className="tr-stat-icon" style={{background:'var(--primary-light)',color:'var(--primary)'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3H17"/></svg>
              </div>
              <div><div className="tr-stat-val">{results.data.statistics.totalStudents}</div><div className="tr-stat-label">Total</div></div>
            </div>
            <div className="tr-stat tr-stat--taken">
              <div className="tr-stat-icon" style={{background:'var(--success-light)',color:'#059669'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div><div className="tr-stat-val">{results.data.statistics.takenCount}</div><div className="tr-stat-label">Taken</div></div>
            </div>
            <div className="tr-stat tr-stat--avg">
              <div className="tr-stat-icon" style={{background:'#eff6ff',color:'#2563eb'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <div><div className="tr-stat-val">{results.data.statistics.averageScore}%</div><div className="tr-stat-label">Average</div></div>
            </div>
            <div className="tr-stat tr-stat--pass">
              <div className="tr-stat-icon" style={{background:'var(--success-light)',color:'#059669'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div><div className="tr-stat-val">{results.data.statistics.passRate}%</div><div className="tr-stat-label">Pass Rate</div></div>
            </div>
            <div className="tr-stat tr-stat--high">
              <div className="tr-stat-icon" style={{background:'#fef3c7',color:'#d97706'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
              <div><div className="tr-stat-val">{results.data.statistics.highestScore}%</div><div className="tr-stat-label">Highest</div></div>
            </div>
            <div className="tr-stat tr-stat--low">
              <div className="tr-stat-icon" style={{background:'#fef2f2',color:'#dc2626'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
              </div>
              <div><div className="tr-stat-val">{results.data.statistics.lowestScore}%</div><div className="tr-stat-label">Lowest</div></div>
            </div>
          </div>

          {/* Performance Insights */}
          {performanceInsights.length > 0 && (
            <div className="tr-insights">
              <div className="tr-insights-toggle" onClick={() => setShowPerfInsights(v => !v)}>
                <div className="tr-insights-toggle-left">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  <h3>Performance Insights</h3>
                  <span className="tr-insights-badge">{performanceInsights.length}</span>
                </div>
                <svg className={`tr-insights-chevron ${showPerfInsights ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {showPerfInsights && (
                <div className="tr-insights-body">
                  {performanceInsights.map((insight, i) => (
                    <div key={i} className={`tr-insight tr-insight--${insight.type}`}>
                      <span className="tr-insight-icon">{insight.icon}</span>
                      <span>{insight.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Distribution */}
          {processedResults.length > 0 && (
            <div className="tr-dist">
              <div className="tr-dist-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                <h3>Score Distribution</h3>
              </div>
              <div className="tr-dist-body">
                {scoreDistribution.map(r => {
                  const w = maxDistCount > 0 ? (r.count / maxDistCount) * 100 : 0;
                  return (
                    <div className="tr-dist-row" key={r.label}>
                      <div className="tr-dist-label">{r.label}</div>
                      <div className="tr-dist-bar">
                        <div className="tr-dist-fill" style={{ width: `${Math.max(w, r.count > 0 ? 8 : 0)}%`, background: r.gradient }}>
                          {r.count > 0 && <span>{r.count}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grade Distribution Pills */}
          {gradeDistribution.length > 0 && (
            <div className="tr-grade-row">
              {gradeDistribution.map(([grade, count]) => {
                const pct = grade === 'A+' ? 95 : grade === 'A' ? 85 : grade === 'B+' ? 75 : grade === 'B' ? 65 : grade === 'C' ? 55 : grade === 'D' ? 45 : 20;
                const g = getGrade(pct);
                return (
                  <span className="tr-grade-pill" key={grade}>
                    <span className="tr-grade-pill-grade" style={{color: getScoreColor(pct).text}}>{g.emoji} {grade}</span>
                    <span className="tr-grade-pill-count">{count}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Results Table/Cards */}
          {processedResults.length > 0 && (
            <div className="tr-results-card">
              <div className="tr-results-bar">
                <div className="tr-results-left">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <h3>Student Results</h3>
                  <span className="tr-results-count">{filteredResults.length}{searchQuery ? ` of ${processedResults.length}` : ''} students</span>
                  {searchQuery && <span className="tr-results-search-count">matching &quot;{searchQuery}&quot;</span>}
                </div>
                <div className="tr-results-right">
                  {processedResults.length > 1 && (
                    <div className="tr-search-wrap" style={{width:200}}>
                      <svg className="tr-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input className="tr-search-input" placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                      {searchQuery && <button className="tr-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
                    </div>
                  )}
                  {isTeacher && (
                    <>
                      <button className="tr-btn tr-btn-primary tr-btn-sm" onClick={() => handleOpenPushModal('test')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        CA /20
                      </button>
                      <button className="tr-btn tr-btn-warning tr-btn-sm" onClick={() => handleOpenPushModal('exam')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                        Exam /20
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Desktop Table */}
              <div className="tr-table-section">
                <div className="tr-table-wrap">
                  <table className="tr-table">
                    <thead>
                      <tr>
                        <th style={{width:50}}>Rank</th>
                        <th className="sortable" onClick={() => handleSort('name')}>Student {getSortIcon('name')}</th>
                        <th className="sortable" onClick={() => handleSort('score')}>Score {getSortIcon('score')}</th>
                        <th>Grade</th>
                        <th className="sortable" onClick={() => handleSort('ca')}>CA Score {getSortIcon('ca')}</th>
                        <th className="sortable" onClick={() => handleSort('date')}>Date {getSortIcon('date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map(r => {
                        const c = getScoreColor(r.percentage);
                        const g = getGrade(r.percentage);
                        const isGold = r.rank === 1, isSilver = r.rank === 2, isBronze = r.rank === 3;
                        const circ = 2 * Math.PI * 17;
                        const offset = circ - (r.percentage / 100) * circ;
                        return (
                          <tr key={r.studentId} className={hoveredStudent === r.studentId ? 'tr-highlighted' : ''} onMouseEnter={() => setHoveredStudent(r.studentId)} onMouseLeave={() => setHoveredStudent(null)}>
                            <td>
                              <span className={`tr-rank ${isGold ? 'tr-rank--gold' : isSilver ? 'tr-rank--silver' : isBronze ? 'tr-rank--bronze' : ''}`}>
                                {isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : r.rank}
                              </span>
                            </td>
                            <td>
                              <div className="tr-student">
                                <div className="tr-avatar" style={{background:getAvatarColor(r.studentName)}}>{getInitials(r.studentName)}</div>
                                <div><div className="tr-student-name">{r.studentName}</div><div className="tr-student-adm">{r.admissionNumber}</div></div>
                              </div>
                            </td>
                            <td>
                              <div className="tr-score-cell">
                                <div className="tr-ring">
                                  <svg width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" fill="none" stroke="#f1f5f9" strokeWidth="3"/><circle cx="21" cy="21" r="17" fill="none" stroke={c.bar} strokeWidth="3" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}/></svg>
                                  <div className="ring-text" style={{color:c.text}}>{r.percentage}%</div>
                                </div>
                                <div>
                                  <div className="tr-score-frac">{r.score}/{r.totalQuestions}</div>
                                  <div className="tr-score-status" style={{color:c.text}}>{r.percentage >= 60 ? '✓ Passed' : '✗ Failed'}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className="tr-grade" style={{background:c.bg,color:c.text}}>{g.emoji} {g.grade} · {g.label}</span></td>
                            <td><span className="tr-ca">CA {r.caScore}/20</span></td>
                            <td className="tr-date">{r.dateTaken ? new Date(r.dateTaken).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="tr-cards">
                {isTeacher && (
                  <div className="tr-card-actions" style={{marginBottom:10}}>
                    <button className="tr-btn tr-btn-primary tr-btn-sm" onClick={() => handleOpenPushModal('test')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      CA /20
                    </button>
                    <button className="tr-btn tr-btn-warning tr-btn-sm" onClick={() => handleOpenPushModal('exam')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                      Exam /20
                    </button>
                  </div>
                )}
                {processedResults.length > 1 && (
                  <div className="tr-search-wrap" style={{marginBottom:10}}>
                    <svg className="tr-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input className="tr-search-input" placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    {searchQuery && <button className="tr-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
                  </div>
                )}
                {filteredResults.map(r => {
                  const c = getScoreColor(r.percentage);
                  const g = getGrade(r.percentage);
                  const isGold = r.rank === 1, isSilver = r.rank === 2, isBronze = r.rank === 3;
                  const mc = 2 * Math.PI * 20;
                  const mo = mc - (r.percentage / 100) * mc;
                  return (
                    <div className="tr-card" key={r.studentId}>
                      <div className="tr-card-top">
                        <div className="tr-card-left">
                          <span className={`tr-rank ${isGold ? 'tr-rank--gold' : isSilver ? 'tr-rank--silver' : isBronze ? 'tr-rank--bronze' : ''}`}>
                            {isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : r.rank}
                          </span>
                          <div style={{minWidth:0}}>
                            <span className="tr-card-name">{r.studentName}</span>
                            <span className="tr-card-adm">{r.admissionNumber}</span>
                          </div>
                        </div>
                        <div className="tr-card-ring">
                          <svg width="50" height="50" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="#f1f5f9" strokeWidth="3.5"/><circle cx="25" cy="25" r="20" fill="none" stroke={c.bar} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={mc} strokeDashoffset={mo}/></svg>
                          <div className="ring-text" style={{color:c.text}}>{r.percentage}%</div>
                        </div>
                      </div>
                      <div className="tr-card-mid">
                        <span className="tr-card-frac">{r.score}/{r.totalQuestions} correct</span>
                        <span className="tr-card-pass" style={{background:c.bg,color:c.text}}>{r.percentage >= 60 ? '✓ Passed' : '✗ Failed'}</span>
                      </div>
                      <div className="tr-card-bottom">
                        <span className="tr-grade" style={{background:c.bg,color:c.text}}>{g.emoji} {g.grade} · {g.label}</span>
                        <span className="tr-ca">CA {r.caScore}/20</span>
                        <span className="tr-card-date">{r.dateTaken ? new Date(r.dateTaken).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Not Taken */}
          {notTakenStudents.length > 0 && (
            <div className="tr-notaken">
              <div className="tr-notaken-bar">
                <h3>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Not Attempted
                </h3>
                <span className="tr-notaken-badge">{notTakenStudents.length} students</span>
              </div>
              <div className="tr-notaken-list">
                {notTakenStudents.map(s => (
                  <span className="tr-notaken-chip" key={s.studentId}>⛔ {s.studentName} <span style={{color:'#b91c1c',fontSize:'0.68rem'}}>({s.admissionNumber})</span></span>
                ))}
              </div>
            </div>
          )}

          {/* Empty - No submissions */}
          {processedResults.length === 0 && notTakenStudents.length > 0 && (
            <div className="tr-empty">
              <div className="tr-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
              </div>
              <h3>No Submissions Yet</h3>
              <p>{notTakenStudents.length} students have not attempted this test yet.</p>
            </div>
          )}
        </>
      )}

      {/* Empty - No tests */}
      {!selectedTest && !resultsLoading && availableTests.length === 0 && selectedClass && selectedSubject && (
        <div className="tr-empty">
          <div className="tr-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <h3>No Tests Created Yet</h3>
          <p>There are no tests for this class and subject combination.</p>
        </div>
      )}

      {/* Empty - Select filters */}
      {!selectedTest && !resultsLoading && !selectedSubject && (
        <div className="tr-empty">
          <div className="tr-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h3>Select Filters</h3>
          <p>Choose a class, subject, and test to view results.</p>
        </div>
      )}

      {/* PUSH MODAL */}
      {showPushModal && (
        <div className="tr-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClosePushModal()}>
          <div className="tr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tr-modal-handle" />
            <div className="tr-modal-header">
              <div className="tr-modal-left">
                <div className={`tr-modal-icon tr-modal-icon--${pushType}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <div>
                  <h2 className="tr-modal-title">{pushType === 'test' ? 'Push as CA Test Score' : 'Push as Exam Score'}</h2>
                  <p className="tr-modal-sub">
                    {pushType === 'test'
                      ? <>Convert percentages to <strong>CA test scores out of 20 marks</strong></>
                      : <>Add converted scores to existing <strong>Exam column</strong></>
                    }
                  </p>
                </div>
              </div>
              <button className="tr-modal-close" onClick={handleClosePushModal}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="tr-modal-body">
              <div className={`tr-push-badge tr-push-badge--${pushType}`}>
                {pushType === 'test' ? '📝 Target: CA Test Column (/20)' : '📋 Target: Exam Column (adds to existing)'}
              </div>

              <div className={`tr-info tr-info--${pushType}`}>
                <div className="tr-info-title">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  {pushType === 'test' ? 'Conversion Summary' : 'Exam Push Summary'}
                </div>
                <div style={{gridTemplateColumns:'1fr 1fr',gap:'6px 16px'}}>
                  <div className="tr-info-item"><span className="tr-info-label">Test: </span><strong>{getSelectedTestDetails()?.title || '—'}</strong></div>
                  <div className="tr-info-item"><span className="tr-info-label">Students: </span><strong>{processedResults.length} results</strong></div>
                  <div className="tr-info-item"><span className="tr-info-label">Formula: </span><strong>(%/100) × 20</strong></div>
                  <div className="tr-info-item"><span className="tr-info-label">{pushType === 'test' ? 'Sets:' : 'Action:'} </span><strong>{pushType === 'test' ? 'CA Test (20)' : 'Adds to Exam'}</strong></div>
                </div>
              </div>

              {pushError && (
                <div className="tr-alert tr-alert--danger">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span>{pushError}</span>
                </div>
              )}

              <div className="tr-form-row">
                <div className="tr-form-group">
                  <label className="tr-form-label">Term *</label>
                  <div className="tr-select-wrap">
                    <select className="tr-form-select" value={pushTermId} onChange={(e) => setPushTermId(e.target.value)}>
                      <option value="">Select Term</option>
                      {terms?.data?.map(t => <option key={t._id} value={t._id}>{t.name}{t.status === 'active' ? ' (Active)' : ''}</option>)}
                    </select>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
                <div className="tr-form-group">
                  <label className="tr-form-label">Session *</label>
                  <div className="tr-select-wrap">
                    <select className="tr-form-select" value={pushSessionId} onChange={(e) => setPushSessionId(e.target.value)}>
                      <option value="">Select Session</option>
                      {sessions?.data?.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
              </div>

              {pushType === 'test' && (
                <div className="tr-toggle-row">
                  <label className="tr-toggle">
                    <input type="checkbox" checked={pushOverwriteMode} onChange={(e) => setPushOverwriteMode(e.target.checked)} />
                    <span className="tr-toggle-slider" />
                  </label>
                  <span><strong>Overwrite existing</strong> test scores</span>
                </div>
              )}

              {pushType === 'exam' && (
                <div className="tr-alert tr-alert--warn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Converted scores will be <strong>added</strong> to existing exam scores.
                </div>
              )}

              {processedResults.length > 0 && (
                <div>
                  <div className="tr-preview-head">
                    <span className="tr-preview-title">Preview — {processedResults.length} students{hasEditedScores ? ' (edited)' : ''}</span>
                    {hasEditedScores && <button className="tr-preview-reset" onClick={handleResetPushScores}>↺ Reset</button>}
                  </div>
                  <div className="tr-preview">
                    <table>
                      <thead>
                        <tr><th>Student</th><th>Test %</th><th>{pushType === 'test' ? 'CA /20' : 'Exam Add /20'}</th></tr>
                      </thead>
                      <tbody>
                        {processedResults.slice(0, 8).map(r => {
                          const calc = convertScoreTo20(r.percentage);
                          const cur = pushScores[r.studentId] ?? calc;
                          const edited = cur !== calc;
                          return (
                            <tr key={r.studentId}>
                              <td><strong>{r.studentName}</strong><span style={{marginLeft:6,fontSize:'0.68rem',color:'var(--text-muted)'}}>{r.admissionNumber}</span></td>
                              <td>{r.percentage}%</td>
                              <td>
                                <input type="number" min="0" max="20" value={cur} onChange={(e) => handlePushScoreEdit(r.studentId, e.target.value)} className={`tr-preview-input tr-preview-input--${pushType}`} />
                                {edited && <span className="tr-edited-dot" />}
                              </td>
                            </tr>
                          );
                        })}
                        {processedResults.length > 8 && (
                          <tr><td colSpan="3" className="tr-preview-more">...and {processedResults.length - 8} more students</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {pushConfirm && (
                <div className="tr-confirm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  {pushType === 'test'
                    ? <>This will push <strong>{processedResults.length}</strong> CA test scores.{pushOverwriteMode ? ' Existing scores will be overwritten.' : ''}</>
                    : <>This will push <strong>{processedResults.length}</strong> exam score increments.</>
                  }
                </div>
              )}
            </div>

            <div className="tr-modal-footer">
              <button className="tr-btn tr-btn-cancel" onClick={handleClosePushModal} disabled={pushing}>Cancel</button>
              {!pushConfirm ? (
                <button className={`tr-btn ${pushType === 'exam' ? 'tr-btn-warning' : 'tr-btn-primary'}`} onClick={() => {
                  if (!pushTermId || !pushSessionId) { setPushError('Select both term and session'); return; }
                  setPushConfirm(true); setPushError('');
                }} disabled={pushing || processedResults.length === 0}>
                  Continue
                </button>
              ) : (
                <button className="tr-btn tr-btn-confirm" onClick={handlePushResults} disabled={pushing || !pushTermId || !pushSessionId}>
                  {pushing ? <><div className="tr-btn-spinner" /> Pushing...</> : <>✓ Confirm Push ({processedResults.length})</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestResults;