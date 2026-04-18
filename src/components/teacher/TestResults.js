import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { testResultsAPI, testsAPI, classesAPI, subjectsAPI, dashboardAPI, downloadCSV, teacherCAAPI, termsAPI, sessionsAPI } from '../../api';
import Loading from '../common/Loading';

const useIsMobile = (breakpoint = 640) => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
};

const TestResults = () => {
  const isMobile = useIsMobile(640);
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

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isTeacher = user?.role === 'teacher';
  const teacherId = user?._id || user?.id;

  const { data: tests, isLoading: testsLoading } = useQuery({
    queryKey: ['tests'],
    queryFn: () => testsAPI.getAll()
  });

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesAPI.getAll({ limit: 100 })
  });

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: subjectsAPI.getAll
  });

  const { data: myAssignments, isLoading: myAssignmentsLoading } = useQuery({
    queryKey: ['my-assignments', teacherId],
    queryFn: () => dashboardAPI.getAssignmentsByTeacher(teacherId),
    enabled: isTeacher && !!teacherId,
  });

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['testResults', selectedTest],
    queryFn: () => testResultsAPI.getByTest(selectedTest),
    enabled: !!selectedTest
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termsAPI.getAll()
  });

  const { data: sessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsAPI.getAll()
  });

  useEffect(() => {
    if (showPushModal && terms?.data) {
      const activeTerm = terms.data.find(t => t.status === 'active');
      if (activeTerm) {
        setPushTermId(activeTerm._id);
        setPushSessionId(activeTerm.session?._id || activeTerm.session || '');
      }
    }
  }, [showPushModal, terms?.data]);

  useEffect(() => {
    if (pushSuccess || pushError) {
      const timer = setTimeout(() => {
        setPushSuccess('');
        setPushError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pushSuccess, pushError]);

  const availableClasses = useMemo(() => {
    if (!classes?.data) return [];
    if (!isTeacher) return classes.data;
    if (!myAssignments?.data) return [];
    const assignedClassIds = new Set(
      myAssignments.data.map(a => (a.class_id?._id || a.class_id)?.toString()).filter(Boolean)
    );
    return classes.data.filter(c => assignedClassIds.has(c._id));
  }, [isTeacher, classes?.data, myAssignments?.data]);

  const availableSubjects = useMemo(() => {
    if (!subjects?.data) return [];
    if (isTeacher) {
      if (!selectedClass || !myAssignments?.data) return [];
      return subjects.data.filter(sub =>
        myAssignments.data.some(a => {
          const aClassId = (a.class_id?._id || a.class_id)?.toString();
          const aSubjectId = (a.subject_id?._id || a.subject_id)?.toString();
          return aClassId === selectedClass && aSubjectId === sub._id;
        })
      );
    } else {
      return subjects.data;
    }
  }, [isTeacher, selectedClass, subjects?.data, myAssignments?.data]);

  const availableTests = useMemo(() => {
    if (!tests?.data) return [];
    let filtered = tests.data;
    if (selectedClass) {
      filtered = filtered.filter(test => (test.classId?._id || test.classId)?.toString() === selectedClass);
    }
    if (selectedSubject) {
      filtered = filtered.filter(test => (test.subjectId?._id || test.subjectId)?.toString() === selectedSubject);
    }
    return filtered;
  }, [tests?.data, selectedClass, selectedSubject]);

  useEffect(() => {
    setSelectedSubject('');
    setSelectedTest('');
  }, [selectedClass]);

  useEffect(() => {
    setSelectedTest('');
  }, [selectedSubject]);

  const handleExport = () => {
    if (selectedTest) {
      const test = availableTests.find(t => (t._id || t.id) === selectedTest);
      downloadCSV(selectedTest, `${test?.title || 'test'}_results.csv`);
    }
  };

  const getSelectedTestDetails = () => {
    if (!selectedTest) return null;
    return availableTests.find(t => (t._id || t.id) === selectedTest);
  };

  const convertScoreTo20 = (percentage) => {
    return Math.round((percentage / 100) * 20);
  };

  const handleOpenPushModal = (type = 'test') => {
    setPushType(type);
    setPushError('');
    setPushSuccess('');
    setPushConfirm(false);
    setPushOverwriteMode(false);
    const scores = {};
    processedResults.forEach(r => {
      scores[r.studentId] = convertScoreTo20(r.percentage);
    });
    setPushScores(scores);
    setShowPushModal(true);
  };

  const handleClosePushModal = () => {
    setShowPushModal(false);
    setPushConfirm(false);
    setPushOverwriteMode(false);
    setPushError('');
    setPushSuccess('');
    setPushType('test');
    setPushScores({});
  };

  const handlePushScoreEdit = (studentId, value) => {
    let num = parseFloat(value) || 0;
    num = Math.min(Math.max(num, 0), 20);
    setPushScores(prev => ({ ...prev, [studentId]: num }));
  };

  const handleResetPushScores = () => {
    const scores = {};
    processedResults.forEach(r => {
      scores[r.studentId] = convertScoreTo20(r.percentage);
    });
    setPushScores(scores);
  };

  const handlePushResults = async () => {
    if (!selectedTest || !pushTermId || !pushSessionId) {
      setPushError('Please select term and session');
      return;
    }

    if (processedResults.length === 0) {
      setPushError('No results to push');
      return;
    }

    const selectedTestObj = getSelectedTestDetails();
    const classId = selectedTestObj?.classId?._id || selectedTestObj?.classId;
    const subjectId = selectedTestObj?.subjectId?._id || selectedTestObj?.subjectId;

    if (!classId || !subjectId) {
      setPushError('Could not determine class or subject from this test');
      return;
    }

    let assessments;
    if (pushType === 'test') {
      assessments = processedResults.map(r => ({
        studentId: r.studentId,
        testScore: pushScores[r.studentId] ?? convertScoreTo20(r.percentage),
        noteTakingScore: 0,
        assignmentScore: 0,
        examScore: 0,
        ...(pushOverwriteMode ? {} : { testScoreOnly: true })
      }));
    } else {
      assessments = processedResults.map(r => ({
        studentId: r.studentId,
        examScoreIncrement: pushScores[r.studentId] ?? convertScoreTo20(r.percentage),
      }));
    }

    setPushing(true);
    setPushError('');

    try {
      const response = await teacherCAAPI.pushTestResultsAsCA(selectedTest, {
        classId,
        subjectId,
        termId: pushTermId,
        sessionId: pushSessionId,
        assessments,
        pushType,
        overwriteTestScore: pushOverwriteMode
      });

      if (response.success) {
        const summary = response.data?.summary || response.data;
        const created = summary?.created || 0;
        const updated = summary?.updated || 0;
        const skipped = summary?.skipped || 0;

        if (pushType === 'test') {
          setPushSuccess(
            `✅ Pushed ${assessments.length} scores as CA Test (/20): ${created} new, ${updated} updated${skipped > 0 ? `, ${skipped} skipped (already approved)` : ''}`
          );
        } else {
          setPushSuccess(
            `✅ Pushed ${assessments.length} scores as Exam (/20): ${created} new, ${updated} updated. Scores added to existing exam column.${skipped > 0 ? ` (${skipped} skipped)` : ''}`
          );
        }
        setShowPushModal(false);
        setPushConfirm(false);
      } else {
        setPushError(response.message || 'Failed to push results');
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to push results';
      setPushError(msg);
    } finally {
      setPushing(false);
    }
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return { bg: '#ecfdf5', text: '#059669', bar: '#10b981' };
    if (percentage >= 60) return { bg: '#eff6ff', text: '#2563eb', bar: '#3b82f6' };
    if (percentage >= 40) return { bg: '#fffbeb', text: '#d97706', bar: '#f59e0b' };
    return { bg: '#fef2f2', text: '#dc2626', bar: '#ef4444' };
  };

  const getGrade = (percentage) => {
    if (percentage >= 90) return { grade: 'A+', label: 'Outstanding' };
    if (percentage >= 80) return { grade: 'A', label: 'Excellent' };
    if (percentage >= 70) return { grade: 'B+', label: 'Very Good' };
    if (percentage >= 60) return { grade: 'B', label: 'Good' };
    if (percentage >= 50) return { grade: 'C', label: 'Average' };
    if (percentage >= 40) return { grade: 'D', label: 'Below Avg' };
    return { grade: 'F', label: 'Fail' };
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return { emoji: '🥇', bg: '#fef3c7', border: '#f59e0b' };
    if (rank === 2) return { emoji: '🥈', bg: '#f3f4f6', border: '#9ca3af' };
    if (rank === 3) return { emoji: '🥉', bg: '#fed7aa', border: '#ea580c' };
    return null;
  };

  const processedResults = useMemo(() => {
    if (!results?.data?.results) return [];
    return [...results.data.results]
      .filter(r => !r.notTaken)
      .map(r => ({
        ...r,
        percentage: r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0,
        caScore: r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100 / 100 * 20) : 0
      }))
      .sort((a, b) => b.percentage - a.percentage || a.studentName.localeCompare(b.studentName))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [results?.data?.results]);

  const notTakenStudents = useMemo(() => {
    if (!results?.data?.results) return [];
    return results.data.results.filter(r => r.notTaken).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [results?.data?.results]);

  const scoreDistribution = useMemo(() => {
    const ranges = [
      { label: '90-100%', min: 90, max: 100, count: 0 },
      { label: '80-89%', min: 80, max: 89, count: 0 },
      { label: '70-79%', min: 70, max: 79, count: 0 },
      { label: '60-69%', min: 60, max: 69, count: 0 },
      { label: '50-59%', min: 50, max: 59, count: 0 },
      { label: '40-49%', min: 40, max: 49, count: 0 },
      { label: '0-39%', min: 0, max: 39, count: 0 },
    ];
    processedResults.forEach(r => {
      const range = ranges.find(rng => r.percentage >= rng.min && r.percentage <= rng.max);
      if (range) range.count++;
    });
    return ranges;
  }, [processedResults]);

  const maxDistributionCount = Math.max(...scoreDistribution.map(r => r.count), 1);

  const hasEditedScores = useMemo(() => {
    return processedResults.some(r => {
      const calculated = convertScoreTo20(r.percentage);
      const current = pushScores[r.studentId];
      return current !== undefined && current !== calculated;
    });
  }, [processedResults, pushScores]);

  const isLoading = testsLoading || classesLoading || subjectsLoading || (isTeacher && myAssignmentsLoading);

  const avatarColors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#14b8a6'];

  return (
    <div className="results-page">
      {/* ============================================================
          ALL CSS SCOPED UNDER .results-page TO PREVENT GLOBAL LEAKS
          This was the root cause: .btn, .card, .modal-overlay, .toast,
          .spinner etc. were overriding parent app styles, causing an
          invisible overlay to block all clicks on the page.
          ============================================================ */}
      <style>{`
        .results-page {
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
          z-index: auto;
        }

        /* --- Cards --- */
        .results-page .rp-card {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          margin-top: 16px;
        }
        .results-page .rp-card-header {
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
        }
        .results-page .rp-card-header h3 {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: #1e293b;
        }
        .results-page .rp-card-body {
          padding: 16px;
        }

        /* --- Filter Grid --- */
        .results-page .rp-filters-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 12px;
          align-items: end;
        }
        .results-page .rp-filter-group label {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .results-page .rp-filter-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.85rem;
          background: white;
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 30px;
        }
        .results-page .rp-filter-group select:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .results-page .rp-filter-group select:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
        }

        /* --- Buttons --- */
        .results-page .rp-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
          transition: background 0.15s, opacity 0.15s, transform 0.1s;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .results-page .rp-btn:active:not(:disabled) {
          transform: scale(0.97);
        }
        .results-page .rp-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .results-page .rp-btn-export {
          background: #059669;
          color: white;
        }
        .results-page .rp-btn-export:hover:not(:disabled) {
          background: #047857;
        }
        .results-page .rp-btn-push {
          background: #6366f1;
          color: white;
        }
        .results-page .rp-btn-push:hover:not(:disabled) {
          background: #4f46e5;
        }
        .results-page .rp-btn-exam {
          background: #f59e0b;
          color: #78350f;
        }
        .results-page .rp-btn-exam:hover:not(:disabled) {
          background: #d97706;
        }
        .results-page .rp-btn-cancel {
          background: #f1f5f9;
          color: #475569;
        }
        .results-page .rp-btn-cancel:hover {
          background: #e2e8f0;
        }
        .results-page .rp-btn-confirm {
          background: #ef4444;
          color: white;
        }
        .results-page .rp-btn-confirm:hover:not(:disabled) {
          background: #dc2626;
        }
        .results-page .rp-btn svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        /* --- Stats Grid --- */
        .results-page .rp-stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-top: 16px;
        }
        .results-page .rp-stat-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;
          text-align: center;
        }
        .results-page .rp-stat-icon {
          font-size: 1.2rem;
          margin-bottom: 6px;
        }
        .results-page .rp-stat-value {
          font-size: 1.4rem;
          font-weight: 700;
          color: #0f172a;
        }
        .results-page .rp-stat-label {
          font-size: 0.65rem;
          color: #94a3b8;
          text-transform: uppercase;
          font-weight: 500;
        }

        /* --- Distribution --- */
        .results-page .rp-dist-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .results-page .rp-dist-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: #64748b;
          min-width: 50px;
          text-align: right;
        }
        .results-page .rp-dist-bar {
          flex: 1;
          height: 20px;
          background: #f1f5f9;
          border-radius: 4px;
          overflow: hidden;
        }
        .results-page .rp-dist-bar-fill {
          height: 100%;
          border-radius: 4px;
          display: flex;
          align-items: center;
          padding-left: 6px;
          transition: width 0.3s ease;
          min-width: fit-content;
        }
        .results-page .rp-dist-bar-fill span {
          font-size: 0.65rem;
          font-weight: 700;
          color: white;
        }

        /* --- Results Table --- */
        .results-page .rp-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .results-page .rp-results-table {
          width: 100%;
          border-collapse: collapse;
        }
        .results-page .rp-results-table th {
          padding: 10px 12px;
          font-size: 0.7rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          text-align: left;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
        }
        .results-page .rp-results-table td {
          padding: 10px 12px;
          font-size: 0.8rem;
          color: #334155;
          border-bottom: 1px solid #f1f5f9;
        }
        .results-page .rp-results-table tr:hover {
          background: #fafbff;
        }

        /* --- Rank Badge --- */
        .results-page .rp-rank-badge {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #94a3b8;
          flex-shrink: 0;
        }
        .results-page .rp-rank-badge.rp-gold {
          background: #fef3c7;
          border-color: #f59e0b;
          color: #92400e;
        }
        .results-page .rp-rank-badge.rp-silver {
          background: #f3f4f6;
          border-color: #9ca3af;
          color: #374151;
        }
        .results-page .rp-rank-badge.rp-bronze {
          background: #fed7aa;
          border-color: #ea580c;
          color: #7c2d12;
        }

        /* --- Student Info --- */
        .results-page .rp-student-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .results-page .rp-student-avatar {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        .results-page .rp-student-name {
          font-weight: 600;
          color: #1e293b;
        }
        .results-page .rp-student-adm {
          font-size: 0.68rem;
          color: #94a3b8;
        }

        /* --- Score Cell --- */
        .results-page .rp-score-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .results-page .rp-score-ring {
          width: 38px;
          height: 38px;
          position: relative;
          flex-shrink: 0;
        }
        .results-page .rp-score-ring svg {
          transform: rotate(-90deg);
        }
        .results-page .rp-score-ring-text {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6rem;
          font-weight: 700;
        }
        .results-page .rp-score-fraction {
          font-weight: 600;
        }
        .results-page .rp-score-percentage {
          font-size: 0.68rem;
        }

        /* --- Grade / CA Badges --- */
        .results-page .rp-grade-badge {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          display: inline-block;
        }
        .results-page .rp-ca-badge {
          padding: 3px 8px;
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          color: #4338ca;
          display: inline-block;
        }

        /* --- Results Actions --- */
        .results-page .rp-results-count {
          font-size: 0.7rem;
          font-weight: 600;
          color: #6366f1;
          background: #eef2ff;
          padding: 2px 8px;
          border-radius: 12px;
        }
        .results-page .rp-results-actions {
          display: flex;
          gap: 8px;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
        }
        .results-page .rp-results-actions-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* --- Not Taken --- */
        .results-page .rp-not-taken-header {
          background: #fef2f2;
        }
        .results-page .rp-not-taken-header h3 {
          color: #991b1b;
        }
        .results-page .rp-not-taken-list {
          padding: 12px 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .results-page .rp-not-taken-chip {
          padding: 4px 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          font-size: 0.75rem;
          color: #991b1b;
        }

        /* --- Empty State --- */
        .results-page .rp-empty-state {
          text-align: center;
          padding: 40px 20px;
          background: white;
          border: 2px dashed #e2e8f0;
          border-radius: 12px;
          margin-top: 16px;
        }
        .results-page .rp-empty-state .rp-empty-icon {
          font-size: 2.5rem;
          margin-bottom: 12px;
        }
        .results-page .rp-empty-state h3 {
          margin: 0 0 6px;
          font-size: 1rem;
          color: #475569;
        }
        .results-page .rp-empty-state p {
          margin: 0;
          font-size: 0.8rem;
          color: #94a3b8;
        }

        /* ============================
           MODAL — scoped under .results-page
           ============================ */
        .results-page .rp-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .results-page .rp-modal {
          background: white;
          border-radius: 12px;
          max-width: 520px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .results-page .rp-modal-header {
          padding: 16px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .results-page .rp-modal-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }
        .results-page .rp-modal-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .results-page .rp-modal-icon--test {
          background: #eef2ff;
          color: #6366f1;
        }
        .results-page .rp-modal-icon--exam {
          background: #fffbeb;
          color: #d97706;
        }
        .results-page .rp-modal-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }
        .results-page .rp-modal-subtitle {
          margin: 2px 0 0;
          font-size: 0.75rem;
          color: #64748b;
        }
        .results-page .rp-modal-close {
          width: 32px;
          height: 32px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .results-page .rp-modal-close:hover {
          background: #f1f5f9;
        }
        .results-page .rp-modal-body {
          padding: 16px;
        }
        .results-page .rp-modal-footer {
          padding: 16px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        /* --- Push Type Badge --- */
        .results-page .rp-push-type-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .results-page .rp-push-type-badge--test {
          background: #eef2ff;
          color: #4338ca;
          border: 1px solid #c7d2fe;
        }
        .results-page .rp-push-type-badge--exam {
          background: #fffbeb;
          color: #92400e;
          border: 1px solid #fde68a;
        }

        /* --- Info Box --- */
        .results-page .rp-info-box {
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .results-page .rp-info-box--test {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }
        .results-page .rp-info-box--exam {
          background: #fffbeb;
          border: 1px solid #fde68a;
        }
        .results-page .rp-info-box-title {
          font-size: 0.75rem;
          font-weight: 700;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .results-page .rp-info-box--test .rp-info-box-title {
          color: #166534;
        }
        .results-page .rp-info-box--exam .rp-info-box-title {
          color: #92400e;
        }
        .results-page .rp-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .results-page .rp-info-item {
          font-size: 0.75rem;
        }
        .results-page .rp-info-label {
          color: #64748b;
        }
        .results-page .rp-info-value {
          font-weight: 700;
        }

        /* --- Form Grid --- */
        .results-page .rp-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .results-page .rp-form-group label {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          color: #475569;
          margin-bottom: 4px;
        }
        .results-page .rp-form-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.85rem;
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 30px;
        }
        .results-page .rp-form-group select:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        /* --- Toggle --- */
        .results-page .rp-toggle-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 0.75rem;
          color: #92400e;
        }
        .results-page .rp-toggle {
          position: relative;
          width: 36px;
          height: 20px;
          flex-shrink: 0;
        }
        .results-page .rp-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }
        .results-page .rp-toggle-slider {
          position: absolute;
          inset: 0;
          background: #d1d5db;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .results-page .rp-toggle-slider::before {
          content: '';
          position: absolute;
          width: 14px;
          height: 14px;
          left: 3px;
          top: 3px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
        }
        .results-page .rp-toggle input:checked + .rp-toggle-slider {
          background: #f59e0b;
        }
        .results-page .rp-toggle input:checked + .rp-toggle-slider::before {
          transform: translateX(16px);
        }

        /* --- Notice Box --- */
        .results-page .rp-notice-box {
          padding: 10px 12px;
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 0.75rem;
          color: #78350f;
          line-height: 1.5;
        }

        /* --- Preview Table --- */
        .results-page .rp-preview-table {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          max-height: 200px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .results-page .rp-preview-table table {
          width: 100%;
          border-collapse: collapse;
        }
        .results-page .rp-preview-table th {
          padding: 8px 10px;
          font-size: 0.68rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
          position: sticky;
          top: 0;
        }
        .results-page .rp-preview-table td {
          padding: 6px 10px;
          font-size: 0.75rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .results-page .rp-preview-input {
          width: 56px;
          padding: 4px 6px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
          text-align: center;
          min-height: 32px;
          box-sizing: border-box;
        }
        .results-page .rp-preview-input--test {
          background: #eef2ff;
          color: #4338ca;
        }
        .results-page .rp-preview-input--exam {
          background: #fffbeb;
          color: #92400e;
        }
        .results-page .rp-preview-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
        }

        .results-page .rp-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .results-page .rp-preview-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
        }
        .results-page .rp-preview-reset {
          font-size: 0.68rem;
          color: #6366f1;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 0;
          -webkit-tap-highlight-color: transparent;
        }
        .results-page .rp-preview-reset:hover {
          text-decoration: underline;
        }
        .results-page .rp-preview-more {
          text-align: center;
          padding: 6px;
          font-size: 0.7rem;
          color: #94a3b8;
          font-style: italic;
        }

        /* --- Confirm Bar --- */
        .results-page .rp-confirm-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 0.75rem;
          color: #991b1b;
        }

        /* --- Error Box --- */
        .results-page .rp-error-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          margin-bottom: 12px;
          font-size: 0.78rem;
          color: #991b1b;
        }

        /* --- Spinner --- */
        .results-page .rp-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: rp-spin 0.6s linear infinite;
          flex-shrink: 0;
        }
        .results-page .rp-btn-exam .rp-spinner {
          border-color: rgba(120, 53, 15, 0.3);
          border-top-color: #78350f;
        }
        @keyframes rp-spin {
          to { transform: rotate(360deg); }
        }

        /* --- Toast --- */
        .results-page .rp-toast {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 1100;
          padding: 12px 16px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          border-left: 3px solid #10b981;
          max-width: 480px;
          font-size: 0.8rem;
          color: #334155;
          animation: rp-toastIn 0.25s ease;
          pointer-events: auto;
        }
        .results-page .rp-toast--error {
          border-left-color: #ef4444;
        }
        @keyframes rp-toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .results-page .rp-edited-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #f59e0b;
          margin-left: 3px;
        }

        /* ===== MOBILE CARD LAYOUT ===== */
        .results-page .rp-mobile-results-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .results-page .rp-mobile-result-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px;
          transition: box-shadow 0.15s;
        }
        .results-page .rp-mobile-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        .results-page .rp-mobile-card-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }
        .results-page .rp-mobile-card-left .rp-rank-badge {
          width: 30px;
          height: 30px;
          font-size: 0.85rem;
        }
        .results-page .rp-mobile-card-left .rp-student-name {
          font-size: 0.88rem;
          font-weight: 600;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
          line-height: 1.3;
        }
        .results-page .rp-mobile-card-left .rp-student-adm {
          font-size: 0.72rem;
          color: #94a3b8;
          display: block;
        }
        .results-page .rp-mobile-score-ring {
          width: 48px;
          height: 48px;
          position: relative;
          flex-shrink: 0;
        }
        .results-page .rp-mobile-score-ring svg {
          transform: rotate(-90deg);
          width: 48px;
          height: 48px;
        }
        .results-page .rp-mobile-score-ring .rp-score-ring-text {
          font-size: 0.72rem;
          font-weight: 700;
        }
        .results-page .rp-mobile-card-middle {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid #f1f5f9;
          border-bottom: 1px solid #f1f5f9;
          margin-bottom: 10px;
        }
        .results-page .rp-mobile-card-middle .rp-score-fraction {
          font-size: 0.85rem;
          font-weight: 600;
          color: #334155;
        }
        .results-page .rp-mobile-pass-tag {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .results-page .rp-mobile-card-bottom {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .results-page .rp-mobile-card-date {
          margin-left: auto;
          font-size: 0.68rem;
          color: #94a3b8;
          white-space: nowrap;
        }

        /* --- Mobile Filter Actions --- */
        .results-page .rp-mobile-filter-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .results-page .rp-mobile-filter-actions .rp-btn {
          flex: 1;
          justify-content: center;
          padding: 10px 12px;
          font-size: 0.82rem;
        }

        /* --- Mobile Push Actions --- */
        .results-page .rp-mobile-push-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        .results-page .rp-mobile-push-actions .rp-btn {
          width: 100%;
          justify-content: center;
          padding: 12px;
          font-size: 0.85rem;
        }

        /* --- Mobile Modal Handle --- */
        .results-page .rp-mobile-modal-handle {
          display: none;
          width: 36px;
          height: 4px;
          background: #d1d5db;
          border-radius: 2px;
          margin: 10px auto 0;
        }

        /* ============================
           RESPONSIVE BREAKPOINTS
           ============================ */

        /* Tablet */
        @media (max-width: 1024px) {
          .results-page .rp-stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        /* Small Desktop / Large Tablet */
        @media (max-width: 768px) {
          .results-page .rp-filters-grid {
            grid-template-columns: 1fr;
          }
          .results-page .rp-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .results-page .rp-form-grid {
            grid-template-columns: 1fr;
          }
          .results-page .rp-info-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .results-page {
            padding: 0;
            padding-bottom: env(safe-area-inset-bottom, 0);
          }

          .results-page .rp-card {
            border-radius: 0;
            border-left: 0;
            border-right: 0;
            margin-top: 12px;
          }
          .results-page .rp-card:first-child {
            margin-top: 8px;
          }
          .results-page .rp-card-header {
            padding: 10px 14px;
            border-radius: 0;
          }
          .results-page .rp-card-body {
            padding: 14px;
          }

          /* Larger touch targets for selects */
          .results-page .rp-filter-group select,
          .results-page .rp-form-group select {
            padding: 12px 36px 12px 14px;
            font-size: 0.9rem;
            border-radius: 10px;
            min-height: 44px;
          }

          .results-page .rp-results-actions {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .results-page .rp-results-actions-left {
            justify-content: space-between;
          }
          .results-page .rp-desktop-push-wrap {
            display: none !important;
          }

          .results-page .rp-stats-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-top: 12px;
          }
          .results-page .rp-stat-card {
            padding: 10px 8px;
            border-radius: 8px;
          }
          .results-page .rp-stat-icon {
            font-size: 1rem;
            margin-bottom: 4px;
          }
          .results-page .rp-stat-value {
            font-size: 1.15rem;
          }
          .results-page .rp-stat-label {
            font-size: 0.58rem;
          }

          .results-page .rp-dist-label {
            min-width: 44px;
            font-size: 0.65rem;
          }
          .results-page .rp-dist-bar {
            height: 18px;
          }
          .results-page .rp-dist-bar-fill span {
            font-size: 0.6rem;
          }

          .results-page .rp-not-taken-list {
            padding: 10px 14px;
          }
          .results-page .rp-not-taken-chip {
            font-size: 0.72rem;
            padding: 5px 8px;
          }

          .results-page .rp-empty-state {
            padding: 32px 16px;
            border-radius: 0;
            border-left: 0;
            border-right: 0;
          }
          .results-page .rp-empty-state .rp-empty-icon {
            font-size: 2rem;
          }

          /* Modal → bottom sheet */
          .results-page .rp-modal-overlay {
            padding: 0;
            align-items: flex-end;
            background: rgba(0,0,0,0.45);
          }
          .results-page .rp-modal {
            max-width: 100%;
            height: 92vh;
            border-radius: 20px 20px 0 0;
            max-height: 92vh;
            animation: rp-slideUp 0.3s ease;
          }
          .results-page .rp-mobile-modal-handle {
            display: block;
          }
          .results-page .rp-modal-header {
            padding: 14px 16px 10px;
          }
          .results-page .rp-modal-body {
            padding: 14px 16px;
          }
          .results-page .rp-modal-footer {
            padding: 14px 16px;
            padding-bottom: max(14px, env(safe-area-inset-bottom));
            gap: 8px;
          }
          .results-page .rp-modal-footer .rp-btn {
            flex: 1;
            justify-content: center;
            padding: 14px;
            font-size: 0.85rem;
            min-height: 44px;
          }

          .results-page .rp-preview-table {
            max-height: 180px;
          }
          .results-page .rp-preview-input {
            width: 52px;
            min-height: 36px;
          }

          /* Toast → bottom */
          .results-page .rp-toast {
            top: auto;
            bottom: 16px;
            left: 12px;
            right: 12px;
            max-width: none;
            font-size: 0.78rem;
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          }
        }

        @keyframes rp-slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        /* Hide/show desktop vs mobile */
        @media (max-width: 640px) {
          .results-page .rp-desktop-table-wrap {
            display: none !important;
          }
          .results-page .rp-desktop-push-wrap {
            display: none !important;
          }
        }
        @media (min-width: 641px) {
          .results-page .rp-mobile-results-wrap {
            display: none !important;
          }
          .results-page .rp-mobile-push-actions {
            display: none !important;
          }
          .results-page .rp-mobile-filter-actions {
            display: none !important;
          }
          .results-page .rp-mobile-modal-handle {
            display: none !important;
          }
        }
      `}</style>

      <div className="results-page">
        {/* Toasts */}
        {pushSuccess && (
          <div className="rp-toast">
            <span>{pushSuccess}</span>
          </div>
        )}
        {pushError && !showPushModal && (
          <div className="rp-toast rp-toast--error">
            <span>{pushError}</span>
          </div>
        )}

        {/* Page Header */}
        <div style={{ marginBottom: '4px' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: isMobile ? '1.1rem' : undefined }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius: 8,
              background: '#6366f1', color: 'white', fontSize: isMobile ? '0.95rem' : '1.1rem'
            }}>📊</span>
            Test Results
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8', paddingLeft: isMobile ? 42 : 46 }}>
            {isTeacher ? 'View and analyze your assigned subject results' : 'View and analyze test results'}
          </p>
        </div>

        {/* No Access */}
        {isTeacher && availableClasses.length === 0 && !isLoading && (
          <div className="rp-empty-state" style={{ borderColor: '#fde68a' }}>
            <div className="rp-empty-icon">🔒</div>
            <h3 style={{ color: '#92400e' }}>No Access Granted</h3>
            <p style={{ color: '#b45309' }}>You have not been assigned to any classes or subjects yet.</p>
          </div>
        )}

        {/* Filters */}
        <div className="rp-card">
          <div className="rp-card-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <h3>Filter Results</h3>
          </div>
          <div className="rp-card-body">
            {isMobile ? (
              <>
                <div className="rp-filter-group">
                  <label>Class</label>
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    <option value="">All Classes</option>
                    {availableClasses.map((cls) => (
                      <option key={cls._id} value={cls._id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div className="rp-filter-group" style={{ marginTop: 10 }}>
                  <label>Subject</label>
                  <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={isTeacher ? !selectedClass : false}>
                    <option value="">
                      {isTeacher ? (selectedClass ? 'Select Subject' : 'Select Class First') : 'All Subjects'}
                    </option>
                    {availableSubjects.map((sub) => (
                      <option key={sub._id} value={sub._id}>{sub.name}</option>
                    ))}
                  </select>
                  {selectedClass && availableSubjects.length === 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>
                      No subjects assigned to you for this class.
                    </span>
                  )}
                </div>
                <div className="rp-filter-group" style={{ marginTop: 10 }}>
                  <label>Test</label>
                  <select value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)}>
                    <option value="">{availableTests.length > 0 ? 'Select a Test' : 'No Tests Found'}</option>
                    {availableTests.map((test) => (
                      <option key={test._id || test.id} value={test._id || test.id}>{test.title}</option>
                    ))}
                  </select>
                </div>
                {selectedTest && (
                  <div className="rp-mobile-filter-actions">
                    <button className="rp-btn rp-btn-export" onClick={handleExport}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Export CSV
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rp-filters-grid">
                <div className="rp-filter-group">
                  <label>Class</label>
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    <option value="">All Classes</option>
                    {availableClasses.map((cls) => (
                      <option key={cls._id} value={cls._id}>{cls.name}</option>
                    ))}
                  </select>
                </div>

                <div className="rp-filter-group">
                  <label>Subject</label>
                  <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={isTeacher ? !selectedClass : false}>
                    <option value="">
                      {isTeacher ? (selectedClass ? 'Select Subject' : 'Select Class First') : 'All Subjects'}
                    </option>
                    {availableSubjects.map((sub) => (
                      <option key={sub._id} value={sub._id}>{sub.name}</option>
                    ))}
                  </select>
                  {selectedClass && availableSubjects.length === 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '2px', display: 'block' }}>
                      No subjects assigned to you for this class.
                    </span>
                  )}
                </div>

                <div className="rp-filter-group">
                  <label>Test</label>
                  <select value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)}>
                    <option value="">{availableTests.length > 0 ? 'Select a Test' : 'No Tests Found'}</option>
                    {availableTests.map((test) => (
                      <option key={test._id || test.id} value={test._id || test.id}>{test.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  {selectedTest && (
                    <button className="rp-btn rp-btn-export" onClick={handleExport}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Export
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {resultsLoading && <Loading message="Loading results..." />}

        {results?.data && !resultsLoading && (
          <>
            {/* Stats */}
            <div className="rp-stats-grid">
              <div className="rp-stat-card">
                <div className="rp-stat-icon">👥</div>
                <div className="rp-stat-value">{results.data.statistics.totalStudents}</div>
                <div className="rp-stat-label">Total</div>
              </div>
              <div className="rp-stat-card">
                <div className="rp-stat-icon">✅</div>
                <div className="rp-stat-value">{results.data.statistics.takenCount}</div>
                <div className="rp-stat-label">Taken</div>
              </div>
              <div className="rp-stat-card">
                <div className="rp-stat-icon">📈</div>
                <div className="rp-stat-value">{results.data.statistics.averageScore}%</div>
                <div className="rp-stat-label">Average</div>
              </div>
              <div className="rp-stat-card">
                <div className="rp-stat-icon">🎯</div>
                <div className="rp-stat-value">{results.data.statistics.passRate}%</div>
                <div className="rp-stat-label">Pass Rate</div>
              </div>
              <div className="rp-stat-card">
                <div className="rp-stat-icon">🏆</div>
                <div className="rp-stat-value">{results.data.statistics.highestScore}%</div>
                <div className="rp-stat-label">Highest</div>
              </div>
              <div className="rp-stat-card">
                <div className="rp-stat-icon">⚠️</div>
                <div className="rp-stat-value">{results.data.statistics.lowestScore}%</div>
                <div className="rp-stat-label">Lowest</div>
              </div>
            </div>

            {/* Distribution */}
            {processedResults.length > 0 && (
              <div className="rp-card">
                <div className="rp-card-header">
                  <span>📊</span>
                  <h3>Score Distribution</h3>
                </div>
                <div className="rp-card-body">
                  {scoreDistribution.map((range) => {
                    const width = maxDistributionCount > 0 ? (range.count / maxDistributionCount) * 100 : 0;
                    const colors = {
                      '90-100%': '#059669', '80-89%': '#10b981', '70-79%': '#3b82f6',
                      '60-69%': '#6366f1', '50-59%': '#f59e0b', '40-49%': '#f97316', '0-39%': '#ef4444',
                    };
                    return (
                      <div className="rp-dist-row" key={range.label}>
                        <div className="rp-dist-label">{range.label}</div>
                        <div className="rp-dist-bar">
                          <div className="rp-dist-bar-fill" style={{ width: `${Math.max(width, range.count > 0 ? 8 : 0)}%`, background: colors[range.label] || '#94a3b8' }}>
                            {range.count > 0 && <span>{range.count}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Results — Desktop Table + Mobile Cards */}
            {processedResults.length > 0 && (
              <div className="rp-card" style={{ overflow: 'hidden' }}>
                <div className="rp-card-header rp-results-actions">
                  <div className="rp-results-actions-left">
                    <span>📋</span>
                    <h3>Student Results</h3>
                    <span className="rp-results-count">{processedResults.length} students</span>
                  </div>
                  <div className="rp-desktop-push-wrap" style={{ display: 'flex', gap: '8px' }}>
                    {isTeacher && (
                      <>
                        <button className="rp-btn rp-btn-push" onClick={() => handleOpenPushModal('test')}>
                          Push as CA Test
                          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: 3, fontSize: '0.65rem' }}>/20</span>
                        </button>
                        <button className="rp-btn rp-btn-exam" onClick={() => handleOpenPushModal('exam')}>
                          Push as Exam
                          <span style={{ background: 'rgba(120,53,15,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: '0.65rem' }}>/20</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Desktop Table */}
                <div className="rp-desktop-table-wrap rp-table-wrap">
                  <table className="rp-results-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>Rank</th>
                        <th>Student</th>
                        <th>Score</th>
                        <th>Grade</th>
                        <th>CA Score</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedResults.map((result) => {
                        const colors = getScoreColor(result.percentage);
                        const grade = getGrade(result.percentage);
                        const rankBadge = getRankBadge(result.rank);
                        const avatarColor = avatarColors[(result.studentName?.charCodeAt(0) || 0) % avatarColors.length];
                        const initials = result.studentName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
                        const circumference = 2 * Math.PI * 16;
                        const strokeDashoffset = circumference - (result.percentage / 100) * circumference;

                        return (
                          <tr key={result.studentId}>
                            <td>
                              {rankBadge ? (
                                <span className={`rp-rank-badge ${result.rank === 1 ? 'rp-gold' : result.rank === 2 ? 'rp-silver' : 'rp-bronze'}`}>{rankBadge.emoji}</span>
                              ) : (
                                <span className="rp-rank-badge">{result.rank}</span>
                              )}
                            </td>
                            <td>
                              <div className="rp-student-info">
                                <div className="rp-student-avatar" style={{ background: avatarColor }}>{initials}</div>
                                <div>
                                  <div className="rp-student-name">{result.studentName}</div>
                                  <div className="rp-student-adm">{result.admissionNumber}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="rp-score-cell">
                                <div className="rp-score-ring">
                                  <svg width="38" height="38" viewBox="0 0 38 38">
                                    <circle cx="19" cy="19" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3"/>
                                    <circle cx="19" cy="19" r="16" fill="none" stroke={colors.bar} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}/>
                                  </svg>
                                  <div className="rp-score-ring-text" style={{ color: colors.text }}>{result.percentage}%</div>
                                </div>
                                <div>
                                  <div className="rp-score-fraction">{result.score}/{result.totalQuestions}</div>
                                  <div className="rp-score-percentage" style={{ color: colors.text }}>
                                    {result.percentage >= 60 ? '✓ Passed' : '✗ Failed'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="rp-grade-badge" style={{ background: colors.bg, color: colors.text }}>
                                {grade.grade} · {grade.label}
                              </span>
                            </td>
                            <td>
                              <span className="rp-ca-badge">
                                CA {result.caScore}/20
                              </span>
                            </td>
                            <td style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              {result.dateTaken
                                ? new Date(result.dateTaken).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="rp-mobile-results-wrap" style={{ padding: '12px 14px' }}>
                  {isTeacher && (
                    <div className="rp-mobile-push-actions" style={{ marginBottom: 12 }}>
                      <button className="rp-btn rp-btn-push" onClick={() => handleOpenPushModal('test')}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14"/><path d="M12 5v14"/>
                        </svg>
                        Push as CA Test
                        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 3, fontSize: '0.65rem' }}>/20</span>
                      </button>
                      <button className="rp-btn rp-btn-exam" onClick={() => handleOpenPushModal('exam')}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14"/><path d="M12 5v14"/>
                        </svg>
                        Push as Exam
                        <span style={{ background: 'rgba(120,53,15,0.1)', padding: '1px 6px', borderRadius: 3, fontSize: '0.65rem' }}>/20</span>
                      </button>
                    </div>
                  )}
                  <div className="rp-mobile-results-list">
                    {processedResults.map((result) => {
                      const colors = getScoreColor(result.percentage);
                      const grade = getGrade(result.percentage);
                      const rankBadge = getRankBadge(result.rank);
                      const mobileCirc = 2 * Math.PI * 19;
                      const mobileOffset = mobileCirc - (result.percentage / 100) * mobileCirc;

                      return (
                        <div className="rp-mobile-result-card" key={result.studentId}>
                          <div className="rp-mobile-card-top">
                            <div className="rp-mobile-card-left">
                              {rankBadge ? (
                                <span className={`rp-rank-badge ${result.rank === 1 ? 'rp-gold' : result.rank === 2 ? 'rp-silver' : 'rp-bronze'}`}>
                                  {rankBadge.emoji}
                                </span>
                              ) : (
                                <span className="rp-rank-badge">{result.rank}</span>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <span className="rp-student-name">{result.studentName}</span>
                                <span className="rp-student-adm">{result.admissionNumber}</span>
                              </div>
                            </div>
                            <div className="rp-mobile-score-ring">
                              <svg width="48" height="48" viewBox="0 0 48 48">
                                <circle cx="24" cy="24" r="19" fill="none" stroke="#f1f5f9" strokeWidth="3.5"/>
                                <circle cx="24" cy="24" r="19" fill="none" stroke={colors.bar} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={mobileCirc} strokeDashoffset={mobileOffset}/>
                              </svg>
                              <div className="rp-score-ring-text" style={{ color: colors.text }}>{result.percentage}%</div>
                            </div>
                          </div>
                          <div className="rp-mobile-card-middle">
                            <span className="rp-score-fraction">{result.score}/{result.totalQuestions} correct</span>
                            <span className="rp-mobile-pass-tag" style={{ background: colors.bg, color: colors.text }}>
                              {result.percentage >= 60 ? '✓ Passed' : '✗ Failed'}
                            </span>
                          </div>
                          <div className="rp-mobile-card-bottom">
                            <span className="rp-grade-badge" style={{ background: colors.bg, color: colors.text }}>
                              {grade.grade} · {grade.label}
                            </span>
                            <span className="rp-ca-badge">
                              CA {result.caScore}/20
                            </span>
                            <span className="rp-mobile-card-date">
                              {result.dateTaken
                                ? new Date(result.dateTaken).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Not Taken */}
            {notTakenStudents.length > 0 && (
              <div className="rp-card">
                <div className="rp-card-header rp-not-taken-header" style={{ justifyContent: 'space-between' }}>
                  <h3><span>⚠️</span> Not Attempted</h3>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#dc2626', background: 'white', padding: '2px 8px', borderRadius: '10px' }}>
                    {notTakenStudents.length} students
                  </span>
                </div>
                <div className="rp-not-taken-list">
                  {notTakenStudents.map((student) => (
                    <div className="rp-not-taken-chip" key={student.studentId}>
                      ⛔ {student.studentName} <span style={{ color: '#b91c1c', fontSize: '0.68rem' }}>({student.admissionNumber})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {processedResults.length === 0 && notTakenStudents.length > 0 && (
              <div className="rp-empty-state">
                <div className="rp-empty-icon">📭</div>
                <h3>No Submissions Yet</h3>
                <p>{notTakenStudents.length} students have not attempted this test yet.</p>
              </div>
            )}
          </>
        )}

        {!selectedTest && !resultsLoading && availableTests.length === 0 && selectedClass && selectedSubject && (
          <div className="rp-empty-state">
            <div className="rp-empty-icon">📝</div>
            <h3>No Tests Created Yet</h3>
            <p>There are no tests for this class and subject combination.</p>
          </div>
        )}

        {!selectedTest && !resultsLoading && !selectedSubject && (
          <div className="rp-empty-state">
            <div className="rp-empty-icon">🔍</div>
            <h3>Select Filters</h3>
            <p>Choose a class, subject, and test to view results.</p>
          </div>
        )}
      </div>

      {/* Push Modal */}
      {showPushModal && (
        <div className="rp-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClosePushModal()}>
          <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
            {/* Mobile drag handle */}
            <div className="rp-mobile-modal-handle" />

            <div className="rp-modal-header">
              <div className="rp-modal-header-left">
                <div className={`rp-modal-icon rp-modal-icon--${pushType}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="M12 5v14"/>
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 className="rp-modal-title">
                    {pushType === 'test' ? 'Push as CA Test Score' : 'Push as Exam Score'}
                  </h2>
                  <p className="rp-modal-subtitle">
                    {pushType === 'test'
                      ? <>Convert percentages to CA test scores out of <strong>20 marks</strong></>
                      : <>Convert to <strong>/20</strong> and add to existing <strong>Exam scores</strong></>
                    }
                  </p>
                </div>
              </div>
              <button className="rp-modal-close" onClick={handleClosePushModal}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="rp-modal-body">
              <div className={`rp-push-type-badge rp-push-type-badge--${pushType}`}>
                {pushType === 'test' ? '📝 Target: CA Test Column (/20)' : '📋 Target: Exam Column (adds to existing)'}
              </div>

              <div className={`rp-info-box rp-info-box--${pushType}`}>
                <div className="rp-info-box-title">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  {pushType === 'test' ? 'Conversion Summary' : 'Exam Push Summary'}
                </div>
                <div className="rp-info-grid">
                  <div className="rp-info-item"><span className="rp-info-label">Test: </span><span className="rp-info-value">{getSelectedTestDetails()?.title || '—'}</span></div>
                  <div className="rp-info-item"><span className="rp-info-label">Students: </span><span className="rp-info-value">{processedResults.length} results</span></div>
                  <div className="rp-info-item"><span className="rp-info-label">Formula: </span><span className="rp-info-value">(%/100) × 20</span></div>
                  <div className="rp-info-item"><span className="rp-info-label">{pushType === 'test' ? 'Sets:' : 'Action:'} </span><span className="rp-info-value">{pushType === 'test' ? 'Test Score (20)' : 'Adds to Exam'}</span></div>
                </div>
              </div>

              {pushError && (
                <div className="rp-error-box">
                  <span>{pushError}</span>
                </div>
              )}

              <div className="rp-form-grid">
                <div className="rp-form-group">
                  <label>Term *</label>
                  <select value={pushTermId} onChange={(e) => setPushTermId(e.target.value)}>
                    <option value="">Select Term</option>
                    {terms?.data?.map(term => (
                      <option key={term._id} value={term._id}>
                        {term.name} {term.status === 'active' ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rp-form-group">
                  <label>Session *</label>
                  <select value={pushSessionId} onChange={(e) => setPushSessionId(e.target.value)}>
                    <option value="">Select Session</option>
                    {sessions?.data?.map(session => (
                      <option key={session._id} value={session._id}>{session.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {pushType === 'test' && (
                <div className="rp-toggle-row">
                  <label className="rp-toggle">
                    <input type="checkbox" checked={pushOverwriteMode} onChange={(e) => setPushOverwriteMode(e.target.checked)} />
                    <span className="rp-toggle-slider"></span>
                  </label>
                  <span><strong>Overwrite existing</strong> test scores</span>
                </div>
              )}

              {pushType === 'exam' && (
                <div className="rp-notice-box">
                  ⚠️ Converted scores will be <strong>added</strong> to existing Exam scores. If a student has 30 in Exam and you push 16, result will be <strong>46/60</strong>.
                </div>
              )}

              {processedResults.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="rp-preview-header">
                    <div className="rp-preview-title">
                      Preview — {processedResults.length} students {hasEditedScores && '(edited)'}
                    </div>
                    {hasEditedScores && (
                      <button className="rp-preview-reset" onClick={handleResetPushScores}>
                        ↺ Reset
                      </button>
                    )}
                  </div>
                  <div className="rp-preview-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Test %</th>
                          <th>{pushType === 'test' ? 'CA /20' : 'Exam Add /20'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedResults.slice(0, 8).map((r) => {
                          const calculated = convertScoreTo20(r.percentage);
                          const current = pushScores[r.studentId] ?? calculated;
                          const isEdited = current !== calculated;
                          return (
                            <tr key={r.studentId}>
                              <td>
                                <strong>{r.studentName}</strong>
                                <span style={{ marginLeft: 4, fontSize: '0.65rem', color: '#94a3b8' }}>{r.admissionNumber}</span>
                              </td>
                              <td>{r.percentage}%</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  value={current}
                                  onChange={(e) => handlePushScoreEdit(r.studentId, e.target.value)}
                                  className={`rp-preview-input rp-preview-input--${pushType}`}
                                />
                                {isEdited && <span className="rp-edited-dot" />}
                              </td>
                            </tr>
                          );
                        })}
                        {processedResults.length > 8 && (
                          <tr>
                            <td colSpan="3" className="rp-preview-more">
                              ...and {processedResults.length - 8} more students
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {pushConfirm && (
                <div className="rp-confirm-bar">
                  ⚠️ {pushType === 'test'
                    ? <>This will push <strong>{processedResults.length}</strong> test scores as CA Test.{pushOverwriteMode ? ' Existing scores will be overwritten.' : ''}</>
                    : <>This will push <strong>{processedResults.length}</strong> scores as Exam increments to existing exam scores.</>
                  }
                </div>
              )}
            </div>

            <div className="rp-modal-footer">
              <button className="rp-btn rp-btn-cancel" onClick={handleClosePushModal} disabled={pushing}>
                Cancel
              </button>
              {!pushConfirm ? (
                <button
                  className={`rp-btn ${pushType === 'exam' ? 'rp-btn-exam' : 'rp-btn-push'}`}
                  onClick={() => {
                    if (!pushTermId || !pushSessionId) {
                      setPushError('Please select both term and session');
                      return;
                    }
                    setPushConfirm(true);
                    setPushError('');
                  }}
                  disabled={pushing || processedResults.length === 0}
                >
                  Continue
                </button>
              ) : (
                <button
                  className="rp-btn rp-btn-confirm"
                  onClick={handlePushResults}
                  disabled={pushing || !pushTermId || !pushSessionId}
                >
                  {pushing ? (
                    <><div className="rp-spinner" /> Pushing...</>
                  ) : (
                    <>✓ Confirm Push ({processedResults.length})</>
                  )}
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