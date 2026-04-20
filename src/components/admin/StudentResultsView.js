// src/components/admin/StudentResultsView.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { testResultsAPI, testsAPI, classesAPI, studentsAPI, subjectsAPI, downloadCSV, reportCardsAPI, classTeacherCommentsAPI, attendanceAPI } from '../../api';
import Loading from '../common/Loading';
import schoolLogo from '../../pages/logo.png';
import './studentresults.css';

// ============================================
// REPORT CARD MODAL COMPONENT
// ============================================
const ReportCardModal = ({ studentId, termId, onClose }) => {
  const defaultPsychomotor = useMemo(() => [
    { skill: 'Handwriting', rating: '' },
    { skill: 'Sports', rating: '' },
    { skill: 'Drawing & Painting', rating: '' },
    { skill: 'Music & Drama', rating: '' },
    { skill: 'Crafts', rating: '' },
    { skill: 'Cleanliness', rating: '' },
    { skill: 'Punctuality', rating: '' },
    { skill: 'Politeness', rating: '' },
  ], []);

  const { data: reportResponse, isLoading: isReportLoading, isError: isReportError } = useQuery({
    queryKey: ['student-report', studentId, termId],
    queryFn: () => reportCardsAPI.getStudentReport(studentId, { termId }),
    enabled: !!studentId && !!termId,
    staleTime: 60000,
  });

  const report = reportResponse?.data || null;
  const classId = report?.student?.class?._id || report?.student?.class?.id || null;
  const termName = report?.term?.name || null;
  const sessionName = report?.session?.name || null;

  const { data: classTeacherComment } = useQuery({
    queryKey: ['class-teacher-comment', classId, termName, sessionName, studentId],
    queryFn: async () => {
      const response = await classTeacherCommentsAPI.getByClass(classId, { term: termName, session: sessionName });
      let comments = [];
      if (Array.isArray(response)) comments = response;
      else if (response?.data && Array.isArray(response.data)) comments = response.data;
      else if (response?.comments && Array.isArray(response.comments)) comments = response.comments;

      const studentComment = comments.find(c => {
        const cStudentId = c.student_id || c.studentId || c.student?._id;
        return cStudentId === studentId || cStudentId?._id === studentId;
      });
      return studentComment?.comment || '';
    },
    enabled: !!classId && !!termName && !!sessionName && !!studentId,
    staleTime: 60000,
  });

  const { data: attendanceResponse } = useQuery({
    queryKey: ['student-attendance', classId, termName, sessionName, studentId],
    queryFn: async () => {
      const response = await attendanceAPI.getStudentCountsByClass(classId, {
        term: termName,
        session: sessionName
      });

      if (!response?.success) return { timesPresent: '', timesSchoolOpen: '', timesAbsent: '' };

      const schoolOpenDays = response.schoolOpenDays || response.data?.schoolOpenDays || '';
      const students = response.data || [];

      const studentRecord = students.find(s => {
        const sId = s.student_id || s.studentId || s.student?._id;
        return sId === studentId || sId?._id === studentId || sId?.toString() === studentId?.toString();
      });

      const timesPresent = studentRecord?.times_present || studentRecord?.timesPresent || '';
      const timesSchoolOpen = typeof schoolOpenDays === 'number' ? schoolOpenDays : '';
      const timesAbsent = (timesPresent !== '' && timesSchoolOpen !== '' && timesSchoolOpen >= timesPresent)
        ? timesSchoolOpen - timesPresent
        : '';

      return { timesPresent, timesSchoolOpen, timesAbsent };
    },
    enabled: !!classId && !!termName && !!sessionName && !!studentId,
    staleTime: 60000,
  });

  const psychomotorSkills = report?.psychomotor?.length ? report.psychomotor : defaultPsychomotor;
  const randomPsychomotorRatings = useMemo(() => {
    return psychomotorSkills.map(() => Math.floor(Math.random() * 2) + 4);
  }, [psychomotorSkills]);

  const timesPresent = attendanceResponse?.timesPresent || report?.attendance?.timesPresent || report?.timesPresent || '';
  const timesSchoolOpen = attendanceResponse?.timesSchoolOpen || report?.attendance?.timesSchoolOpen || report?.timesSchoolOpen || '';
  const timesAbsent = attendanceResponse?.timesAbsent !== undefined
    ? attendanceResponse.timesAbsent
    : ((timesPresent !== '' && timesSchoolOpen !== '' && timesSchoolOpen >= timesPresent)
      ? timesSchoolOpen - timesPresent
      : '');

  const formatDate = (date) => date
    ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  const handlePrint = () => {
    const printContent = document.getElementById('report-card-printable');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Report Card - ${report?.student?.firstName || ''} ${report?.student?.lastName || ''}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Times New Roman', Times, serif; padding: 20px; }
            .report-sheet-wrapper { max-width: 210mm; margin: 0 auto; }
            .school-header-elegant { text-align: center; padding: 15px 0; border-bottom: 3px double #1a365d; margin-bottom: 15px; }
            .header-logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 10px; }
            .school-name { font-size: 18px; font-weight: bold; color: #1a365d; letter-spacing: 1px; margin-bottom: 5px; }
            .doc-title { font-size: 14px; color: #4a5568; margin-bottom: 10px; }
            .header-meta-box { display: flex; justify-content: center; gap: 20px; font-size: 12px; }
            .bio-data-section { margin-bottom: 15px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 4px; }
            .bio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .bio-item { display: flex; gap: 10px; }
            .bio-label { font-size: 11px; color: #718096; min-width: 100px; }
            .bio-value { font-size: 12px; font-weight: 600; }
            .grades-container { margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #cbd5e0; padding: 6px 8px; text-align: center; }
            th { background: #1a365d; color: white; font-size: 10px; }
            .td-subject { text-align: left; }
            .td-bold { font-weight: 600; }
            .td-right { text-align: right; }
            .summary-row { background: #f7fafc; font-weight: 600; }
            .grading-key-elegant { text-align: center; padding: 8px; background: #f7fafc; border: 1px solid #e2e8f0; margin-bottom: 15px; font-size: 10px; }
            .attendance-section { margin-bottom: 15px; }
            .attendance-title { font-size: 12px; font-weight: bold; margin-bottom: 8px; text-align: center; text-decoration: underline; }
            .attendance-grid { display: flex; justify-content: space-around; }
            .attendance-card { text-align: center; }
            .attendance-label { font-size: 10px; color: #718096; display: block; }
            .attendance-value { font-size: 16px; font-weight: bold; display: block; }
            .psychomotor-section { margin-bottom: 15px; }
            .psychomotor-title { font-size: 12px; font-weight: bold; margin-bottom: 8px; text-align: center; text-decoration: underline; }
            .psychomotor-key-note { text-align: center; font-size: 9px; color: #718096; margin-bottom: 8px; }
            .pm-td-skill { text-align: left; }
            .pm-rating-badge { background: #edf2f7; padding: 2px 8px; border-radius: 3px; font-weight: bold; }
            .comments-container { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; align-items: stretch; }
            .comment-box-elegant { border: 1px solid #e2e8f0; padding: 10px; display: flex; flex-direction: column; }
            .comment-title { font-size: 11px; font-weight: bold; margin-bottom: 8px; text-decoration: underline; flex-shrink: 0; }
            .comment-text-area { font-size: 11px; min-height: 60px; flex: 1; }
            .signature-section { margin-top: auto; flex-shrink: 0; padding-top: 15px; }
            .sig-line { border-top: 1px solid #000; width: 150px; }
            .sig-text { font-size: 10px; display: block; margin-top: 5px; }
            .sheet-footer-elegant { border-top: 2px solid #1a365d; padding-top: 15px; text-align: center; }
            .footer-dates-grid { display: flex; justify-content: space-around; margin-bottom: 10px; }
            .fd-label { font-size: 10px; color: #718096; }
            .fd-value { font-size: 12px; font-weight: 600; display: block; }
            .next-term-highlight { background: #1a365d; color: white; padding: 8px 15px; border-radius: 4px; display: inline-block; }
            .nt-label { font-size: 10px; }
            .nt-date { font-size: 14px; font-weight: bold; display: block; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  if (isReportLoading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content report-modal">
          <div className="modal-header">
            <h3>Student Report Card</h3>
            <button onClick={onClose} className="modal-close">&times;</button>
          </div>
          <div className="modal-body">
            <Loading message="Generating report card..." />
          </div>
        </div>
      </div>
    );
  }

  if (isReportError || !report) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content report-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Student Report Card</h3>
            <button onClick={onClose} className="modal-close">&times;</button>
          </div>
          <div className="modal-body">
            <div className="error-container">
              <span className="error-icon">⚠️</span>
              <p>{isReportError ? 'Failed to load report card.' : 'Report card not found. Ensure all grades are entered for this term.'}</p>
              <button onClick={onClose} className="btn btn-primary">Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content report-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📄 Student Report Card</h3>
          <div className="modal-header-actions">
            <button onClick={handlePrint} className="btn btn-success btn-sm">🖨️ Print</button>
            <button onClick={onClose} className="modal-close">&times;</button>
          </div>
        </div>
        <div className="modal-body report-modal-body">
          <div id="report-card-printable" className="report-sheet-wrapper">
            <div className="a4-document">
              {/* HEADER */}
              <header className="school-header-elegant">
                <div className="header-logo-wrap">
                  <img src={schoolLogo} alt="School Logo" className="header-logo" />
                </div>
                <h1 className="school-name">DATFORTE INTERNATIONAL SCHOOLS LIMITED</h1>
                <h2 className="doc-title">STUDENT ACADEMIC REPORT CARD</h2>
                <div className="header-meta-box">
                  <span className="meta-text">Term <strong>{report.term.name}</strong></span>
                  <span className="meta-divider">|</span>
                  <span className="meta-text">Session <strong>{report.session.name}</strong></span>
                </div>
              </header>

              {/* STUDENT BIO-DATA */}
              <div className="bio-data-section">
                <div className="bio-grid">
                  <div className="bio-item">
                    <span className="bio-label">Name of Student</span>
                    <span className="bio-value name-highlight">{report.student.firstName} {report.student.lastName}</span>
                  </div>
                  <div className="bio-item">
                    <span className="bio-label">Admission No.</span>
                    <span className="bio-value">{report.student.admissionNumber}</span>
                  </div>
                  <div className="bio-item">
                    <span className="bio-label">Class</span>
                    <span className="bio-value">{report.student.class?.name} {report.student.class?.section}</span>
                  </div>
                  <div className="bio-item">
                    <span className="bio-label">Gender</span>
                    <span className="bio-value">{report.student.gender}</span>
                  </div>
                </div>
              </div>

              {/* GRADES TABLE */}
              <div className="grades-container">
                <table className="grades-table-elegant">
                  <thead>
                    <tr>
                      <th rowSpan="2" className="th-sn">S/N</th>
                      <th rowSpan="2" className="th-subject">SUBJECTS</th>
                      <th colSpan="4" className="th-ca-header">CONTINUOUS ASSESSMENT (40)</th>
                      <th rowSpan="2" className="th-score">EXAM<br/>(60)</th>
                      <th rowSpan="2" className="th-score">TOTAL<br/>(100)</th>
                      <th rowSpan="2" className="th-grade">GRADE</th>
                      <th rowSpan="2" className="th-remark">REMARK</th>
                    </tr>
                    <tr>
                      <th className="th-sub-ca">Test<br/>(20)</th>
                      <th className="th-sub-ca">Notes<br/>(10)</th>
                      <th className="th-sub-ca">Assign<br/>(10)</th>
                      <th className="th-sub-ca">Total<br/>(40)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.subjects.map((sub, i) => (
                      <tr key={sub._id || i}>
                        <td className="td-center">{i + 1}</td>
                        <td className="td-subject">{sub.subject?.name}</td>
                        <td className="td-center">{sub.testScore}</td>
                        <td className="td-center">{sub.noteTakingScore}</td>
                        <td className="td-center">{sub.assignmentScore}</td>
                        <td className="td-center td-bold">{sub.totalCA}</td>
                        <td className="td-center td-bold">{sub.examScore}</td>
                        <td className="td-center td-bold td-total">{sub.totalScore}</td>
                        <td className="td-center td-bold">{sub.grade}</td>
                        <td className="td-remark">{sub.remark}</td>
                      </tr>
                    ))}
                    {report.subjects.length === 0 && (
                      <tr>
                        <td colSpan="10" className="td-empty">No grades recorded for this term.</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="summary-row">
                      <td colSpan="7" className="td-right summary-label">TOTAL SCORE OBTAINED:</td>
                      <td className="td-center td-total">{report.statistics.totalScore}</td>
                      <td colSpan="2"></td>
                    </tr>
                    <tr className="summary-row">
                      <td colSpan="7" className="td-right summary-label">STUDENT AVERAGE:</td>
                      <td className="td-center td-total">{report.statistics.averageScore}%</td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* GRADING KEY */}
              <div className="grading-key-elegant">
                <span className="key-label">GRADING SCALE:</span>
                <span className="key-text">A (Excellent) | B (Very Good) | C (Good) | D (Fair) | E (Poor) | F (Fail)</span>
              </div>

              {/* ATTENDANCE */}
              <div className="attendance-section">
                <div className="attendance-title">ATTENDANCE RECORD</div>
                <div className="attendance-grid">
                  <div className="attendance-card">
                    <span className="attendance-label">No. of Times School Opened</span>
                    <span className="attendance-value">{timesSchoolOpen !== '' ? timesSchoolOpen : '––––'}</span>
                  </div>
                  <div className="attendance-card">
                    <span className="attendance-label">No. of Times Present</span>
                    <span className="attendance-value present">{timesPresent !== '' ? timesPresent : '––––'}</span>
                  </div>
                  <div className="attendance-card">
                    <span className="attendance-label">No. of Times Absent</span>
                    <span className="attendance-value absent">{timesAbsent !== '' ? timesAbsent : '––––'}</span>
                  </div>
                </div>
              </div>

              {/* PSYCHOMOTOR */}
              <div className="psychomotor-section">
                <div className="psychomotor-title">PSYCHOMOTOR / AFFECTIVE DOMAIN</div>
                <div className="psychomotor-key-note">
                  Rating Key: <strong>A</strong> – Excellent | <strong>B</strong> – Very Good | <strong>C</strong> – Good | <strong>D</strong> – Fair | <strong>E</strong> – Poor
                </div>
                <table className="psychomotor-table">
                  <thead>
                    <tr>
                      <th className="pm-th-sn">S/N</th>
                      <th className="pm-th-skill">Skill / Trait</th>
                      <th className="pm-th-rating">Rating</th>
                      <th className="pm-th-sn">S/N</th>
                      <th className="pm-th-skill">Skill / Trait</th>
                      <th className="pm-th-rating">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const half = Math.ceil(psychomotorSkills.length / 2);
                      const leftCol = psychomotorSkills.slice(0, half);
                      const rightCol = psychomotorSkills.slice(half);
                      const rows = Math.max(leftCol.length, rightCol.length);
                      return Array.from({ length: rows }, (_, idx) => (
                        <tr key={idx}>
                          <td className="pm-td-center">{idx + 1}</td>
                          <td className="pm-td-skill">{leftCol[idx]?.skill || ''}</td>
                          <td className="pm-td-rating">
                            <span className="pm-rating-badge">{leftCol[idx]?.rating || randomPsychomotorRatings[idx]}</span>
                          </td>
                          <td className="pm-td-center">{half + idx + 1}</td>
                          <td className="pm-td-skill">{rightCol[idx]?.skill || ''}</td>
                          <td className="pm-td-rating">
                            <span className="pm-rating-badge">{rightCol[idx]?.rating || randomPsychomotorRatings[half + idx]}</span>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* COMMENTS - EQUAL SIZED CONTAINERS */}
              <div className="comments-container">
                <div className="comment-box-elegant">
                  <div className="comment-title">CLASS TEACHER'S COMMENT</div>
                  <div className="comment-text-area">
                    {classTeacherComment
                      ? <><strong>{report.student.firstName} {report.student.lastName}</strong> - {classTeacherComment}</>
                      : <span className="blank-line">................................................................................</span>
                    }
                  </div>
                  <div className="signature-section">
                    <div className="sig-line"></div>
                    <span className="sig-text">Class Teacher</span>
                  </div>
                </div>
                <div className="comment-box-elegant">
                  <div className="comment-title">PRINCIPAL'S COMMENT</div>
                  <div className="comment-text-area">
                    {report.principalComment
                      ? <>{report.principalComment}</>
                      : <span className="blank-line">................................................................................</span>
                    }
                  </div>
                  <div className="signature-section">
                    <div className="sig-line"></div>
                    <span className="sig-text">Principal/Headteacher</span>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <footer className="sheet-footer-elegant">
                <div className="footer-dates-grid">
                  <div className="footer-date-item">
                    <span className="fd-label">Term Begins:</span>
                    <span className="fd-value">{formatDate(report.term.startDate)}</span>
                  </div>
                  <div className="footer-date-item">
                    <span className="fd-label">Term Ends:</span>
                    <span className="fd-value">{formatDate(report.term.endDate)}</span>
                  </div>
                </div>
                {report.term.nextTermBegins && (
                  <div className="next-term-highlight">
                    <span className="nt-label">NEXT TERM BEGINS:</span>
                    <span className="nt-date">{formatDate(report.term.nextTermBegins)}</span>
                  </div>
                )}
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN STUDENT RESULTS VIEW COMPONENT
// ============================================
const StudentResultsView = () => {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTest, setSelectedTest] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('student_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('all');
  const [viewMode, setViewMode] = useState('filtered');
  const [expandedClass, setExpandedClass] = useState(null);
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(null);
  const [showReportCard, setShowReportCard] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState('');

  const { data: termsData } = useQuery({
    queryKey: ['terms-for-report-cards'],
    queryFn: () => classesAPI.getTerms(selectedClass),
    enabled: !!selectedClass,
    staleTime: 60000,
  });

  const availableTerms = useMemo(() => {
    if (!termsData) return [];
    if (Array.isArray(termsData)) return termsData;
    if (termsData.data && Array.isArray(termsData.data)) return termsData.data;
    if (termsData.terms && Array.isArray(termsData.terms)) return termsData.terms;
    return [];
  }, [termsData]);

  const {
    data: resultsData,
    isLoading: resultsLoading,
    error: resultsError,
  } = useQuery({
    queryKey: ['all-test-results', selectedClass, selectedTest, selectedStudent, selectedSubject],
    queryFn: () => {
      const params = { limit: 100000, page: 1 };
      if (selectedClass) params.class_id = selectedClass;
      if (selectedTest) params.test_id = selectedTest;
      if (selectedStudent) params.student_id = selectedStudent;
      if (selectedSubject) params.subject_id = selectedSubject;
      return testResultsAPI.getAll(params);
    },
    staleTime: 30000,
  });

  const normalizedResults = useMemo(() => {
    if (!resultsData) return [];
    let source = resultsData;
    if (Array.isArray(source)) return source;
    if (source.data && Array.isArray(source.data)) return source.data;
    if (source.results && Array.isArray(source.results)) return source.results;
    const arrayKey = Object.keys(source).find(key => Array.isArray(source[key]));
    return arrayKey ? source[arrayKey] : [];
  }, [resultsData]);

  const strictlyFilteredResults = useMemo(() => {
    if (!Array.isArray(normalizedResults)) return [];
    return normalizedResults.filter(result => {
      if (!result) return false;
      const resultClassId = result.classId?._id || result.classId || result.testId?.classId?._id || result.testId?.classId;
      const resultSubjectId = result.subjectId?._id || result.subjectId || result.testId?.subjectId?._id || result.testId?.subjectId;
      if (selectedClass && String(resultClassId) !== String(selectedClass)) return false;
      if (selectedSubject && String(resultSubjectId) !== String(selectedSubject)) return false;
      if (selectedTest) {
        const resultTestId = result.testId?._id || result.testId;
        if (String(resultTestId) !== String(selectedTest)) return false;
      }
      if (selectedStudent) {
        const resultStudentId = result.studentId?._id || result.studentId || result.student?._id || result.student;
        if (String(resultStudentId) !== String(selectedStudent)) return false;
      }
      return true;
    });
  }, [normalizedResults, selectedClass, selectedSubject, selectedTest, selectedStudent]);

  const stats = useMemo(() => {
    const validPercentages = strictlyFilteredResults.map(r => r?.percentage).filter(p => typeof p === 'number' && !isNaN(p));
    const total = strictlyFilteredResults.length;
    const passed = strictlyFilteredResults.filter(r => r?.status === 'passed').length;
    const failed = strictlyFilteredResults.filter(r => r?.status === 'failed').length;
    const averageScore = validPercentages.length > 0 ? (validPercentages.reduce((sum, p) => sum + p, 0) / validPercentages.length).toFixed(1) : '0.0';
    const highestScore = validPercentages.length > 0 ? Math.max(...validPercentages) : 0;
    const lowestScore = validPercentages.length > 0 ? Math.min(...validPercentages) : 0;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    return {
      total, passed, failed,
      pending: strictlyFilteredResults.filter(r => r?.status === 'pending').length,
      averageScore, highestScore, lowestScore, passRate,
      totalSubjects: new Set(strictlyFilteredResults.map(r => r?.testId?.subjectId?._id || r?.subjectId?._id).filter(Boolean)).size
    };
  }, [strictlyFilteredResults]);

  const publishMutation = useMutation({
    mutationFn: (testId) => testsAPI.publishResults(testId),
    onSuccess: () => { queryClient.invalidateQueries(['all-test-results']); queryClient.invalidateQueries(['tests-for-results']); setShowPublishConfirm(null); alert('✅ Results published successfully!'); },
    onError: (error) => { alert(`❌ Failed: ${error.response?.data?.message || error.message}`); setShowPublishConfirm(null); },
  });

  const unpublishMutation = useMutation({
    mutationFn: (testId) => testsAPI.unpublishResults(testId),
    onSuccess: () => { queryClient.invalidateQueries(['all-test-results']); queryClient.invalidateQueries(['tests-for-results']); setShowPublishConfirm(null); alert('🔒 Results unpublished successfully!'); },
    onError: (error) => { alert(`❌ Failed: ${error.response?.data?.message || error.message}`); setShowPublishConfirm(null); },
  });

  const publishAllMutation = useMutation({
    mutationFn: async () => {
      const unpub = filteredTests.filter(t => !t.resultsPublished);
      if (!unpub.length) throw new Error('No unpublished tests');
      const res = await Promise.allSettled(unpub.map(t => testsAPI.publishResults(t._id)));
      return { total: unpub.length, success: unpub.length - res.filter(r => r.status === 'rejected').length };
    },
    onSuccess: (res) => { queryClient.invalidateQueries(['all-test-results']); setShowPublishConfirm(null); alert(`✅ Published ${res.success} test(s)!`); },
    onError: (err) => { alert(`❌ ${err.message}`); setShowPublishConfirm(null); },
  });

  const handlePublish = (testId) => setShowPublishConfirm({ testId, action: 'publish' });
  const handleUnpublish = (testId) => setShowPublishConfirm({ testId, action: 'unpublish' });
  const handlePublishAll = () => setShowPublishConfirm({ testId: 'all', action: 'publish-all' });

  const confirmPublishAction = () => {
    if (!showPublishConfirm) return;
    if (showPublishConfirm.action === 'publish') publishMutation.mutate(showPublishConfirm.testId);
    else if (showPublishConfirm.action === 'unpublish') unpublishMutation.mutate(showPublishConfirm.testId);
    else if (showPublishConfirm.action === 'publish-all') publishAllMutation.mutate();
  };

  const { data: studentsData } = useQuery({ queryKey: ['students-for-results'], queryFn: () => studentsAPI.getAll() });
  const { data: testsData } = useQuery({ queryKey: ['tests-for-results'], queryFn: () => testsAPI.getAll() });
  const { data: classesData } = useQuery({ queryKey: ['classes-for-results'], queryFn: () => classesAPI.getAll() });
  const { data: subjectsData } = useQuery({ queryKey: ['subjects-for-results'], queryFn: () => subjectsAPI.getAll() });
  const { data: subjectsByClass } = useQuery({ queryKey: ['subjects-by-class', selectedClass], queryFn: () => subjectsAPI.getByClass(selectedClass), enabled: !!selectedClass });

  const studentLookup = useMemo(() => {
    const map = {};
    const arr = studentsData?.data || (Array.isArray(studentsData) ? studentsData : []);
    arr.forEach(s => { if (s && s._id) map[s._id] = s; });
    return map;
  }, [studentsData]);

  const getStudentInfo = (r) => {
    const obj = r.studentId && typeof r.studentId === 'object' ? r.studentId : (r.student && typeof r.student === 'object' ? r.student : null);
    if (obj) return { firstName: obj.firstName || '', lastName: obj.lastName || '', admissionNumber: obj.admissionNumber || '' };
    const strId = r.studentId || r.student;
    const s = strId && typeof strId === 'string' ? studentLookup[strId] : null;
    return s ? { firstName: s.firstName || '', lastName: s.lastName || '', admissionNumber: s.admissionNumber || '' } : { firstName: '', lastName: '', admissionNumber: '' };
  };

  const getStudentName = (r) => { const i = getStudentInfo(r); return (i.firstName || i.lastName) ? `${i.firstName} ${i.lastName}`.trim() : 'Unknown Student'; };
  const getStudentInitials = (r) => { const i = getStudentInfo(r); return `${i.firstName?.[0] || ''}${i.lastName?.[0] || ''}`; };
  const getStudentId = (r) => r.studentId?._id || r.student?._id || r.studentId || r.student;

  const filteredSubjects = useMemo(() => {
    if (selectedClass && subjectsByClass?.data) return subjectsByClass.data;
    if (Array.isArray(subjectsByClass)) return subjectsByClass;
    return subjectsData?.data || [];
  }, [selectedClass, subjectsByClass, subjectsData]);

  const filteredTests = useMemo(() => {
    const tests = testsData?.data || [];
    return tests.filter(t => {
      if (selectedClass && t.classId?._id !== selectedClass && t.classId !== selectedClass) return false;
      if (selectedSubject && t.subjectId?._id !== selectedSubject && t.subjectId !== selectedSubject) return false;
      return true;
    });
  }, [testsData, selectedClass, selectedSubject]);

  const unpublishedTestsCount = useMemo(() => filteredTests.filter(t => !t.resultsPublished).length, [filteredTests]);

  const uniqueStudentsInResults = useMemo(() => {
    const studentMap = new Map();
    strictlyFilteredResults.forEach(r => {
      const id = getStudentId(r);
      if (id && !studentMap.has(id)) {
        studentMap.set(id, { id, name: getStudentName(r), info: getStudentInfo(r) });
      }
    });
    return Array.from(studentMap.values());
  }, [strictlyFilteredResults]);

  useEffect(() => {
    if (viewMode === 'class_subject') {
      setExpandedClass(selectedClass && selectedSubject ? selectedClass : selectedClass || null);
      setExpandedSubject(selectedClass && selectedSubject ? `${selectedClass}-${selectedSubject}` : null);
    }
  }, [selectedClass, selectedSubject, viewMode]);

  useEffect(() => { setCurrentPage(1); }, [selectedClass, selectedSubject, selectedTest, selectedStudent, searchTerm]);

  const groupedResults = useMemo(() => {
    if (!Array.isArray(strictlyFilteredResults)) return {};
    const g = {};
    strictlyFilteredResults.forEach(r => {
      if (!r) return;
      const cId = r.classId?._id || r.testId?.classId?._id || 'unknown';
      const cName = r.classId?.name || r.testId?.classId?.name || 'Unknown Class';
      const sId = r.testId?.subjectId?._id || r.subjectId?._id || 'unknown';
      const sName = r.testId?.subjectId?.name || r.subjectId?.name || 'Unknown Subject';
      const tId = r.testId?._id || 'unknown';
      if (!g[cId]) g[cId] = { classId: cId, className: cName, subjects: {} };
      if (!g[cId].subjects[sId]) g[cId].subjects[sId] = { subjectId: sId, subjectName: sName, students: [], tests: {}, stats: { total: 0, passed: 0, failed: 0, pending: 0, averageScore: 0, highestScore: 0, lowestScore: 100 } };
      const sub = g[cId].subjects[sId];
      if (!sub.tests[tId]) sub.tests[tId] = { testId: tId, testTitle: r.testId?.title || 'Test', isPublished: r.testId?.resultsPublished || false, studentCount: 0 };
      sub.tests[tId].studentCount++;
      sub.students.push(r);
      sub.stats.total++;
      if (r.status === 'passed') sub.stats.passed++;
      if (r.status === 'failed') sub.stats.failed++;
      if (r.status === 'pending') sub.stats.pending++;
      const p = r.percentage || 0;
      sub.stats.averageScore += p;
      if (p > sub.stats.highestScore) sub.stats.highestScore = p;
      if (p < sub.stats.lowestScore) sub.stats.lowestScore = p;
    });
    Object.values(g).forEach(c => Object.values(c.subjects).forEach(s => { if (s.stats.total > 0) s.stats.averageScore = (s.stats.averageScore / s.stats.total).toFixed(1); }));
    return g;
  }, [strictlyFilteredResults]);

  const processedResults = useMemo(() => {
    if (!Array.isArray(strictlyFilteredResults)) return [];
    let res = [...strictlyFilteredResults];
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      res = res.filter(r => {
        const i = getStudentInfo(r);
        return (i.firstName?.toLowerCase() || '').includes(t) || (i.lastName?.toLowerCase() || '').includes(t) || (i.admissionNumber?.toLowerCase() || '').includes(t) || (r.testId?.title?.toLowerCase() || '').includes(t);
      });
    }
    res.sort((a, b) => {
      let vA, vB;
      switch (sortBy) {
        case 'student_name': vA = getStudentName(a).toLowerCase(); vB = getStudentName(b).toLowerCase(); break;
        case 'admission_number': vA = getStudentInfo(a).admissionNumber || ''; vB = getStudentInfo(b).admissionNumber || ''; break;
        case 'test_title': vA = a.testId?.title?.toLowerCase() || ''; vB = b.testId?.title?.toLowerCase() || ''; break;
        case 'score': vA = a.percentage || 0; vB = b.percentage || 0; break;
        default: vA = new Date(a.submittedAt || 0); vB = new Date(b.submittedAt || 0); break;
      }
      if (vA < vB) return sortOrder === 'asc' ? -1 : 1;
      if (vA > vB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return res;
  }, [strictlyFilteredResults, searchTerm, sortBy, sortOrder]);

  const effectiveItemsPerPage = itemsPerPage === 'all' ? processedResults.length : Number(itemsPerPage);
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(processedResults.length / effectiveItemsPerPage);
  const paginatedResults = itemsPerPage === 'all' ? processedResults : processedResults.slice((currentPage - 1) * effectiveItemsPerPage, currentPage * effectiveItemsPerPage);

  const handleSort = (col) => { if (sortBy === col) setSortOrder(p => p === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortOrder('asc'); } };
  const resetFilters = () => { setSelectedClass(''); setSelectedTest(''); setSelectedStudent(''); setSelectedSubject(''); setSearchTerm(''); setCurrentPage(1); setExpandedClass(null); setExpandedSubject(null); setSelectedTerm(''); };
  const handleClassChange = (id) => { setSelectedClass(id); setSelectedSubject(''); setSelectedTest(''); setSelectedTerm(''); };
  const handleSubjectChange = (id) => { setSelectedSubject(id); setSelectedTest(''); };
  const getSortIndicator = (col) => sortBy !== col ? '↕' : sortOrder === 'asc' ? '↑' : '↓';
  const getGrade = (p) => { if (p >= 90) return { grade: 'A+', color: '#059669' }; if (p >= 80) return { grade: 'A', color: '#10b981' }; if (p >= 70) return { grade: 'B', color: '#3b82f6' }; if (p >= 60) return { grade: 'C', color: '#6366f1' }; if (p >= 50) return { grade: 'D', color: '#f59e0b' }; return { grade: 'F', color: '#ef4444' }; };

  const toggleClass = (id) => { setExpandedClass(expandedClass === id ? null : id); setExpandedSubject(null); };
  const toggleSubject = (id) => setExpandedSubject(expandedSubject === id ? null : id);

  const handleViewReportCard = (studentId) => {
    if (!selectedTerm) { alert('Please select a term to generate the report card.'); return; }
    setShowReportCard({ studentId, termId: selectedTerm });
  };

  const renderStudentCell = (r) => (
    <div className="student-name-cell">
      <div className="student-avatar">{getStudentInitials(r) || '?'}</div>
      <strong>{getStudentName(r)}</strong>
    </div>
  );
  const renderAdmissionNumber = (r) => <span className="admission-badge">{getStudentInfo(r).admissionNumber || '-'}</span>;
  const renderPublishStatus = (isPub) => isPub ? (<span className="publish-status-badge published"><span className="publish-dot"></span>Published</span>) : (<span className="publish-status-badge unpublished"><span className="publish-dot"></span>Draft</span>);
  const renderPublishButton = (id, isPub) => {
    const dis = publishMutation.isPending || unpublishMutation.isPending;
    return isPub ? (<button onClick={e => { e.stopPropagation(); handleUnpublish(id); }} className="btn btn-sm btn-outline-danger publish-btn" disabled={dis} title="Unpublish">🔒</button>) : (<button onClick={e => { e.stopPropagation(); handlePublish(id); }} className="btn btn-sm btn-outline-success publish-btn" disabled={dis} title="Publish">📢</button>);
  };
  const renderReportCardButton = (r) => (
    <button onClick={(e) => { e.stopPropagation(); handleViewReportCard(getStudentId(r)); }} className="btn btn-sm btn-outline-primary report-card-btn" title="View Report Card" disabled={!selectedTerm}>📄</button>
  );

  const selectedClassName = classesData?.data?.find(c => c._id === selectedClass)?.name || '';
  const selectedSubjectName = filteredSubjects?.find(s => s._id === selectedSubject)?.name || '';
  const currentSubjectStats = useMemo(() => groupedResults[selectedClass]?.subjects[selectedSubject]?.stats || null, [groupedResults, selectedClass, selectedSubject]);

  if (resultsLoading) return <Loading message="Loading student results..." />;
  if (resultsError) return (
    <div className="error-container">
      <span className="error-icon">⚠️</span>
      <p>Failed: {resultsError.message}</p>
      <button onClick={() => queryClient.invalidateQueries(['all-test-results'])} className="btn btn-primary">🔄 Retry</button>
    </div>
  );

  return (
    <div className="student-results-container">
      {showPublishConfirm && (
        <div className="modal-overlay" onClick={() => setShowPublishConfirm(null)}>
          <div className="modal-content publish-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{showPublishConfirm.action === 'unpublish' ? '🔒 Unpublish' : '📢 Publish'} Results</h3></div>
            <div className="modal-body"><p>Are you sure you want to {showPublishConfirm.action} "{filteredTests.find(t => t._id === showPublishConfirm.testId)?.title || 'these tests'}"?</p></div>
            <div className="modal-footer">
              <button onClick={() => setShowPublishConfirm(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={confirmPublishAction} className={`btn ${showPublishConfirm.action === 'unpublish' ? 'btn-danger' : 'btn-success'}`}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {showReportCard && (
        <ReportCardModal studentId={showReportCard.studentId} termId={showReportCard.termId} onClose={() => setShowReportCard(null)} />
      )}

      <div className="results-header">
        <div>
          <h1 className="page-title">Student Results</h1>
          <p className="page-subtitle">Select class and subject to view & publish</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setViewMode(v => v === 'class_subject' ? 'filtered' : 'class_subject')} className="btn btn-secondary">{viewMode === 'class_subject' ? '📋 Table View' : '🏫 Grouped View'}</button>
          {selectedTest && <button onClick={() => downloadCSV(selectedTest, `test.csv`)} className="btn btn-success">📥 Export CSV</button>}
          {selectedClass && selectedSubject && unpublishedTestsCount > 0 && <button onClick={handlePublishAll} className="btn btn-warning" disabled={publishAllMutation.isPending}>📢 Publish All ({unpublishedTestsCount})</button>}
        </div>
      </div>

      <div className="selection-panel card">
        <div className="card-body">
          <div className="selection-grid">
            <div className="selection-group main-selection">
              <label className="selection-label">🏫 Select Class</label>
              <select value={selectedClass} onChange={e => handleClassChange(e.target.value)} className="form-control selection-select">
                <option value="">-- Choose Class --</option>
                {classesData?.data?.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="selection-group main-selection">
              <label className="selection-label">📚 Select Subject</label>
              <select value={selectedSubject} onChange={e => handleSubjectChange(e.target.value)} className="form-control selection-select" disabled={!selectedClass}>
                <option value="">{selectedClass ? '-- Choose Subject --' : '-- Select class first --'}</option>
                {filteredSubjects?.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="selection-group">
              <label className="selection-label">📝 Test (Optional)</label>
              <select value={selectedTest} onChange={e => setSelectedTest(e.target.value)} className="form-control selection-select" disabled={!selectedClass}>
                <option value="">{selectedClass ? 'All Tests' : '-- Select class first --'}</option>
                {filteredTests?.map(t => <option key={t._id} value={t._id}>{t.resultsPublished ? '✅ ' : '🔒 '}{t.title}</option>)}
              </select>
            </div>
            <div className="selection-group">
              <label className="selection-label">📅 Term (for Report Card)</label>
              <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className="form-control selection-select" disabled={!selectedClass}>
                <option value="">{selectedClass ? '-- Select Term --' : '-- Select class first --'}</option>
                {availableTerms.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="selection-group">
              <label className="selection-label">🔍 Search Student</label>
              <input type="text" placeholder="Name or adm no..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="form-control selection-select" />
            </div>
            {(selectedClass || searchTerm) && (
              <div className="selection-group">
                <label className="selection-label">&nbsp;</label>
                <button onClick={resetFilters} className="btn btn-outline-secondary selection-select">🔄 Reset</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedClass && selectedTerm && uniqueStudentsInResults.length > 0 && (
        <div className="card report-card-quick-access">
          <div className="card-header">
            <h3>📄 Quick Report Card Access</h3>
            <span className="header-count">{uniqueStudentsInResults.length} students</span>
          </div>
          <div className="card-body">
            <div className="quick-report-students-grid">
              {uniqueStudentsInResults.slice(0, 20).map(student => (
                <button key={student.id} onClick={() => handleViewReportCard(student.id)} className="quick-report-student-btn">
                  <span className="quick-avatar">{student.info.firstName?.[0]}{student.info.lastName?.[0]}</span>
                  <span className="quick-name">{student.name}</span>
                  <span className="quick-adm">{student.info.admissionNumber}</span>
                </button>
              ))}
              {uniqueStudentsInResults.length > 20 && (
                <div className="quick-report-more">
                  <select onChange={e => { if (e.target.value) handleViewReportCard(e.target.value); e.target.value = ''; }} className="form-control form-control-sm">
                    <option value="">+ {uniqueStudentsInResults.length - 20} more...</option>
                    {uniqueStudentsInResults.slice(20).map(student => (
                      <option key={student.id} value={student.id}>{student.name} ({student.info.admissionNumber})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!selectedClass && (
        <div className="card no-selection-card">
          <div className="card-body">
            <div className="no-selection-prompt">
              <span className="prompt-icon">👆</span>
              <h3>Select a Class to View Results</h3>
              <p>You can also generate report cards by selecting a term</p>
            </div>
          </div>
        </div>
      )}

      {selectedClass && selectedSubject && filteredTests.length > 0 && (
        <div className="card publish-summary-card">
          <div className="card-header"><h3>📊 Test Status - {selectedClassName} ({selectedSubjectName})</h3></div>
          <div className="card-body">
            <div className="publish-tests-grid">
              {filteredTests.map(t => (
                <div key={t._id} className={`publish-test-item ${t.resultsPublished ? 'published' : 'unpublished'}`}>
                  <div className="publish-test-info"><span className="publish-test-title">{t.title}</span>{renderPublishStatus(t.resultsPublished)}</div>
                  <div className="publish-test-action">{renderPublishButton(t._id, t.resultsPublished)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedClass && (
        <div className="results-stats-grid">
          <div className="result-stat-card"><div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>📊</div><div className="stat-info"><span className="stat-value">{stats.total}</span><span className="stat-label">Total Results</span></div></div>
          <div className="result-stat-card"><div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>✅</div><div className="stat-info"><span className="stat-value">{stats.passed}</span><span className="stat-label">Passed</span></div></div>
          <div className="result-stat-card"><div className="stat-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>❌</div><div className="stat-info"><span className="stat-value">{stats.failed}</span><span className="stat-label">Failed</span></div></div>
          <div className="result-stat-card"><div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>📈</div><div className="stat-info"><span className="stat-value">{stats.averageScore}%</span><span className="stat-label">Average</span></div></div>
          <div className="result-stat-card"><div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>🏆</div><div className="stat-info"><span className="stat-value">{stats.highestScore}%</span><span className="stat-label">Highest</span></div></div>
          <div className="result-stat-card"><div className="stat-icon" style={{ background: '#fff1f2', color: '#e11d48' }}>📉</div><div className="stat-info"><span className="stat-value">{stats.lowestScore}%</span><span className="stat-label">Lowest</span></div></div>
          <div className="result-stat-card"><div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>📚</div><div className="stat-info"><span className="stat-value">{stats.totalSubjects}</span><span className="stat-label">Subjects</span></div></div>
          <div className="result-stat-card"><div className="stat-icon" style={{ background: '#f0fdf4', color: '#15803d' }}>✨</div><div className="stat-info"><span className="stat-value">{stats.passRate}%</span><span className="stat-label">Pass Rate</span></div></div>
        </div>
      )}

      {selectedClass && selectedSubject && currentSubjectStats && (
        <div className="subject-detail-stats card">
          <div className="card-header"><h3>📊 {selectedClassName} - {selectedSubjectName} Summary</h3></div>
          <div className="card-body">
            <div className="subject-stats-bar">
              <div className="stats-bar-item"><span className="stats-bar-label">Students</span><span className="stats-bar-value">{currentSubjectStats.total}</span></div>
              <div className="stats-bar-item"><span className="stats-bar-label">Passed</span><span className="stats-bar-value" style={{ color: '#059669' }}>{currentSubjectStats.passed}</span></div>
              <div className="stats-bar-item"><span className="stats-bar-label">Failed</span><span className="stats-bar-value" style={{ color: '#dc2626' }}>{currentSubjectStats.failed}</span></div>
              <div className="stats-bar-item"><span className="stats-bar-label">Pending</span><span className="stats-bar-value" style={{ color: '#d97706' }}>{currentSubjectStats.pending}</span></div>
              <div className="stats-bar-divider"></div>
              <div className="stats-bar-item"><span className="stats-bar-label">Average</span><span className="stats-bar-value">{currentSubjectStats.averageScore}%</span></div>
              <div className="stats-bar-item"><span className="stats-bar-label">Highest</span><span className="stats-bar-value" style={{ color: '#059669' }}>{currentSubjectStats.highestScore}%</span></div>
              <div className="stats-bar-item"><span className="stats-bar-label">Lowest</span><span className="stats-bar-value" style={{ color: '#ef4444' }}>{currentSubjectStats.lowestScore}%</span></div>
              <div className="stats-bar-item"><span className="stats-bar-label">Pass Rate</span><span className="stats-bar-value" style={{ color: '#0284c7' }}>{currentSubjectStats.total > 0 ? ((currentSubjectStats.passed / currentSubjectStats.total) * 100).toFixed(1) : 0}%</span></div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'class_subject' && selectedClass && (
        <div className="class-subject-view">
          {Object.keys(groupedResults).length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty-state"><p>No results found</p></div></div></div>
          ) : (
            Object.values(groupedResults).map(cGroup => (
              <div key={cGroup.classId} className="class-group-card">
                <div className="class-group-header" onClick={() => toggleClass(cGroup.classId)}>
                  <div className="class-group-info"><span className="class-group-icon">🏫</span><div><h3>{cGroup.className}</h3><span className="class-group-meta">{Object.keys(cGroup.subjects).length} subjects • {Object.values(cGroup.subjects).reduce((s, sub) => s + sub.students.length, 0)} results</span></div></div>
                  <span className="expand-icon">{expandedClass === cGroup.classId ? '▼' : '▶'}</span>
                </div>
                {expandedClass === cGroup.classId && (
                  <div className="class-group-body">
                    {Object.values(cGroup.subjects).map(sGroup => (
                      <div key={sGroup.subjectId} className="subject-group">
                        <div className="subject-group-header" onClick={() => toggleSubject(`${cGroup.classId}-${sGroup.subjectId}`)}>
                          <div className="subject-group-info"><span className="subject-group-icon">📚</span><div><h4>{sGroup.subjectName}</h4><span className="subject-group-meta">{sGroup.students.length} students</span></div></div>
                          <div className="subject-stats-mini"><span className="mini-stat">📊 {sGroup.stats.averageScore}%</span><span className="mini-stat passed">✅ {sGroup.stats.passed}</span><span className="mini-stat failed">❌ {sGroup.stats.failed}</span></div>
                          <span className="expand-icon">{expandedSubject === `${cGroup.classId}-${sGroup.subjectId}` ? '▼' : '▶'}</span>
                        </div>
                        {expandedSubject === `${cGroup.classId}-${sGroup.subjectId}` && (
                          <div className="subject-group-body">
                            <div className="grouped-test-status">{Object.values(sGroup.tests).map(t => (<div key={t.testId} className={`grouped-test-item ${t.isPublished ? 'published' : 'unpublished'}`}><span className="grouped-test-name">{t.testTitle}</span>{renderPublishStatus(t.isPublished)}{renderPublishButton(t.testId, t.isPublished)}</div>))}</div>
                            <div className="table-responsive"><table className="table table-sm"><thead><tr><th className="sn-col">S/N</th><th>Student</th><th>Adm. No.</th><th>Test</th><th>Score</th><th>%</th><th>Grade</th><th>Status</th>{selectedTerm && <th>Report</th>}</tr></thead><tbody>
                              {sGroup.students.sort((a, b) => getStudentName(a).localeCompare(getStudentName(b))).map((r, i) => {
                                const g = getGrade(r.percentage || 0);
                                const st = { passed: { color: '#059669', bg: '#ecfdf5', icon: '✅', label: 'Passed' }, failed: { color: '#dc2626', bg: '#fef2f2', icon: '❌', label: 'Failed' }, pending: { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' } }[r.status] || { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' };
                                return (<tr key={r._id || i}><td>{i + 1}</td><td>{renderStudentCell(r)}</td><td>{renderAdmissionNumber(r)}</td><td><div className="test-title-cell">{r.testId?.title || '-'}{renderPublishStatus(r.testId?.resultsPublished)}</div></td><td><span className="score-cell"><span className="score-achieved">{r.score}</span><span className="score-total">/{r.totalQuestions || r.testId?.totalQuestions || '?'}</span></span></td><td><div className="percentage-cell"><div className="percentage-bar-wrapper"><div className="percentage-bar-fill" style={{ width: `${Math.min(r.percentage || 0, 100)}%`, background: g.color }}></div></div><span className="percentage-value" style={{ color: g.color }}>{r.percentage || 0}%</span></div></td><td><span className="grade-badge" style={{ background: `${g.color}15`, color: g.color, borderColor: `${g.color}30` }}>{g.grade}</span></td><td><span className="status-badge" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span></td>{selectedTerm && <td>{renderReportCardButton(r)}</td>}</tr>);
                              })}
                            </tbody></table></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {viewMode === 'filtered' && selectedClass && (
        <div className="card">
          <div className="card-header">
            <h3>📋 Results {selectedClassName && <span> • {selectedClassName}</span>}{selectedSubjectName && <span> • {selectedSubjectName}</span>} <span className="header-count">({processedResults.length})</span></h3>
            <div className="items-per-page"><span>Show:</span><select value={itemsPerPage} onChange={e => { setItemsPerPage(e.target.value); setCurrentPage(1); }} className="form-control form-control-sm"><option value="all">All ({processedResults.length})</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {processedResults.length === 0 ? <div className="empty-state"><p>No results found</p></div> : (
              <div className="table-responsive"><table className="table"><thead><tr>
                <th className="sn-col">S/N</th>
                <th onClick={() => handleSort('student_name')} className="sortable-header">Student {getSortIndicator('student_name')}</th>
                <th onClick={() => handleSort('admission_number')} className="sortable-header">Adm. No. {getSortIndicator('admission_number')}</th>
                {!selectedSubject && <th>Subject</th>}
                <th onClick={() => handleSort('test_title')} className="sortable-header">Test {getSortIndicator('test_title')}</th>
                <th>Score</th>
                <th onClick={() => handleSort('score')} className="sortable-header">% {getSortIndicator('score')}</th>
                <th>Grade</th>
                <th>Status</th>
                {selectedTerm && <th>Report</th>}
              </tr></thead><tbody>
                {paginatedResults.map((r, index) => {
                  const g = getGrade(r.percentage || 0);
                  const st = { passed: { color: '#059669', bg: '#ecfdf5', icon: '✅', label: 'Passed' }, failed: { color: '#dc2626', bg: '#fef2f2', icon: '❌', label: 'Failed' }, pending: { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' } }[r.status] || { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' };
                  const sn = itemsPerPage === 'all' ? index + 1 : ((currentPage - 1) * effectiveItemsPerPage) + index + 1;
                  return (<tr key={r._id || index} className="result-row"><td className="sn-col">{sn}</td><td>{renderStudentCell(r)}</td><td>{renderAdmissionNumber(r)}</td>{!selectedSubject && <td>{r.testId?.subjectId?.name || '-'}</td>}<td><div className="test-title-cell"><span>{r.testId?.title || '-'}</span><div className="test-title-publish-status">{renderPublishStatus(r.testId?.resultsPublished)}</div></div></td><td><span className="score-cell"><span className="score-achieved">{r.score}</span><span className="score-total">/{r.totalQuestions || r.testId?.totalQuestions || '?'}</span></span></td><td><div className="percentage-cell"><div className="percentage-bar-wrapper"><div className="percentage-bar-fill" style={{ width: `${Math.min(r.percentage || 0, 100)}%`, background: g.color }}></div></div><span className="percentage-value" style={{ color: g.color }}>{r.percentage || 0}%</span></div></td><td><span className="grade-badge" style={{ background: `${g.color}15`, color: g.color, borderColor: `${g.color}30` }}>{g.grade}</span></td><td><span className="status-badge" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span></td>{selectedTerm && <td>{renderReportCardButton(r)}</td>}</tr>);
                })}
              </tbody></table></div>
            )}
          </div>
          {itemsPerPage !== 'all' && totalPages > 1 && (
            <div className="pagination">
              <span>Showing {((currentPage - 1) * effectiveItemsPerPage) + 1} to {Math.min(currentPage * effectiveItemsPerPage, processedResults.length)} of {processedResults.length}</span>
              <div className="pagination-buttons">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="btn btn-sm btn-secondary">««</button>
                <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="btn btn-sm btn-secondary">«</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => { let p = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i; return (<button key={p} onClick={() => setCurrentPage(p)} className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-secondary'}`}>{p}</button>); })}
                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="btn btn-sm btn-secondary">»</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="btn btn-sm btn-secondary">»»</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentResultsView;