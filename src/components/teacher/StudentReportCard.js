import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { reportCardsAPI, classTeacherCommentsAPI, termsAPI, sessionsAPI } from '../../api';
import schoolLogo from '../../pages/logo.png';
import './StudentReportCard.css';

// ✅ Helper to safely extract nested property
const getNestedValue = (obj, ...paths) => {
  for (const path of paths) {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (value == null || typeof value !== 'object') return null;
      value = value[key];
    }
    if (value != null) return value;
  }
  return null;
};

// ✅ Extract error message from API error
const extractErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';
  if (error?.response?.data) {
    const data = error.response.data;
    if (typeof data?.message === 'string') return data.message;
    if (typeof data === 'string') return data;
  }
  if (error?.message) {
    if (error.message.includes('Network Error')) return 'Network connection failed.';
    if (error.message.includes('timeout')) return 'Request timed out.';
    if (error.message.includes('401')) return 'Session expired. Please log in again.';
    if (error.message.includes('403')) return 'Access denied.';
    if (error.message.includes('404')) return 'Report data not found.';
    return error.message;
  }
  return 'An unknown error occurred';
};

// ✅ NEW: Default psychomotor skills for Nigerian schools
const DEFAULT_PSYCHOMOTOR = [
  { key: 'handwriting', label: 'Handwriting' },
  { key: 'sports', label: 'Sports' },
  { key: 'craft', label: 'Craft/Drawing' },
  { key: 'music', label: 'Music' },
  { key: 'communication', label: 'Communication' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'neatness', label: 'Neatness' },
  { key: 'politeness', label: 'Politeness' },
  { key: 'teamwork', label: 'Team Spirit' },
  { key: 'initiative', label: 'Initiative' },
];

// ✅ NEW: Default affective domain skills
const DEFAULT_AFFECTIVE = [
  { key: 'honesty', label: 'Honesty' },
  { key: 'selfReliance', label: 'Self Reliance' },
  { key: 'perseverance', label: 'Perseverance' },
  { key: 'respect', label: 'Respect' },
  { key: 'responsibility', label: 'Responsibility' },
];

// ✅ NEW: Rating component for psychomotor/affective
const RatingKey = ({ rating }) => {
  if (!rating || rating === '-') return <span className="rating-dash">—</span>;
  const ratingClass = rating === 'A' ? 'rating-excellent' 
    : rating === 'B' ? 'rating-very-good'
    : rating === 'C' ? 'rating-good'
    : rating === 'D' ? 'rating-fair'
    : rating === 'E' ? 'rating-poor'
    : '';
  return <span className={`rating-badge ${ratingClass}`}>{rating}</span>;
};

// ✅ Skeleton loader
const ReportSkeleton = () => (
  <div className="report-sheet-wrapper">
    <div className="a4-document">
      <div className="skeleton-shimmer" style={{ height: '130px', borderRadius: '8px', marginBottom: '16px' }}></div>
      <div className="skeleton-shimmer" style={{ height: '80px', borderRadius: '8px', marginBottom: '16px' }}></div>
      <div className="skeleton-shimmer" style={{ height: '60px', borderRadius: '8px', marginBottom: '16px' }}></div>
      <div className="skeleton-shimmer" style={{ height: '250px', borderRadius: '8px', marginBottom: '16px' }}></div>
      <div className="skeleton-shimmer" style={{ height: '40px', borderRadius: '8px', marginBottom: '16px' }}></div>
      <div className="skeleton-shimmer" style={{ height: '150px', borderRadius: '8px', marginBottom: '16px' }}></div>
      <div className="skeleton-shimmer" style={{ height: '100px', borderRadius: '8px', marginBottom: '16px' }}></div>
      <div className="skeleton-shimmer" style={{ height: '60px', borderRadius: '8px' }}></div>
    </div>
  </div>
);

// ✅ No subjects state
const NoSubjectsState = ({ studentName, termName }) => (
  <div className="no-subjects-banner">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
    <p>
      <strong>{studentName}</strong> has no approved subject scores for <strong>{termName}</strong>.
      <span className="no-subjects-hint">Scores must be uploaded by teachers and approved by admin.</span>
    </p>
  </div>
);

const StudentReportCard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const studentId = useMemo(() => {
    const queryId = searchParams.get('studentId');
    if (queryId) return queryId;
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const idx = pathParts.indexOf('student');
    if (idx !== -1 && pathParts[idx + 1]) return pathParts[idx + 1];
    return null;
  }, [searchParams]);
  
  const termId = searchParams.get('termId');
  
  const [report, setReport] = useState(null);
  const [classTeacherComment, setClassTeacherComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState('general');
  const [termDetails, setTermDetails] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [commentLoading, setCommentLoading] = useState(false);

  // ✅ NEW: Attendance data (can be from API or passed as props)
  const [attendanceData, setAttendanceData] = useState(null);
  
  // ✅ NEW: Psychomotor data (can be from API or default)
  const [psychomotorData, setPsychomotorData] = useState(null);
  const [affectiveData, setAffectiveData] = useState(null);

  const fetchTermDetails = useCallback(async (tid) => {
    if (!tid) return;
    try {
      const res = await termsAPI.getById(tid);
      if (res?.success && res?.data) {
        setTermDetails(res.data);
        if (res.data.session?._id) {
          try {
            const sessRes = await sessionsAPI.getById(res.data.session._id);
            if (sessRes?.success && sessRes?.data) setSessionDetails(sessRes.data);
          } catch (e) {
            setSessionDetails(res.data.session);
          }
        }
      }
    } catch (e) { console.warn('Failed to fetch term:', e); }
  }, []);

  const fetchClassTeacherComment = useCallback(async (classId, tid, sid) => {
    if (!classId) return;
    setCommentLoading(true);
    try {
      const params = {};
      if (tid) params.termId = tid;
      if (sid) params.sessionId = sid;
      if (!tid && termDetails?.name) params.term = termDetails.name;
      if (!sid && (sessionDetails?.name || termDetails?.session?.name)) {
        params.session = sessionDetails?.name || termDetails?.session?.name;
      }

      const response = await classTeacherCommentsAPI.getByClass(classId, params);
      
      let comments = [];
      if (Array.isArray(response)) comments = response;
      else if (response?.success === true && response?.data) {
        comments = Array.isArray(response.data) ? response.data 
          : response.data.student_id ? [response.data] : [];
      } else if (response?.data && Array.isArray(response.data)) comments = response.data;
      else if (response?.comments) comments = response.comments;

      const studentComment = comments.find(c => {
        const cId = c.student_id || c.studentId || c.student?._id;
        if (!cId) return false;
        return cId.toString() === studentId?.toString();
      });

      setClassTeacherComment(studentComment?.comment || '');
    } catch (e) {
      console.error('Comment fetch error:', e);
      setClassTeacherComment('');
    } finally {
      setCommentLoading(false);
    }
  }, [studentId, termDetails, sessionDetails]);

  const fetchReport = useCallback(async () => {
    if (!studentId) {
      setError('Student ID is missing.');
      setErrorType('missing-param');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setErrorType('general');
      setReport(null);
      setClassTeacherComment('');
      
      if (termId) fetchTermDetails(termId);
      
      const response = await reportCardsAPI.getStudentReport(studentId, { termId });
      
      if (response?.success && response?.data) {
        const data = response.data;
        if (!termDetails && data.term) setTermDetails(data.term);
        if (!sessionDetails && data.session) setSessionDetails(data.session);
        setReport(data);
        
        const classId = getNestedValue(data, 'student.class._id', 'student.class.id');
        const sid = getNestedValue(data, 'session._id', 'session.id');
        if (classId) fetchClassTeacherComment(classId, termId, sid);
        
        // ✅ NEW: Extract attendance and psychomotor from response if available
        if (data.attendance) setAttendanceData(data.attendance);
        if (data.psychomotor) setPsychomotorData(data.psychomotor);
        if (data.affective) setAffectiveData(data.affective);
      } else if (response?.success === false) {
        setError(response?.message || 'Failed to load report.');
        setErrorType('api-error');
      } else {
        setError('Unexpected response format.');
      }
    } catch (err) { 
      setError(extractErrorMessage(err));
      const status = err?.response?.status;
      if (status === 404) setErrorType('not-found');
      else if (status === 401) setErrorType('auth');
      else setErrorType('general');
    } finally { 
      setLoading(false); 
    }
  }, [studentId, termId, fetchTermDetails, fetchClassTeacherComment, termDetails, sessionDetails]);

  useEffect(() => { fetchReport(); }, [fetchReport, location.key]);

  const handleRefresh = () => {
    setTermDetails(null);
    setSessionDetails(null);
    fetchReport();
  };

  // ✅ Computed values
  const displayTermName = report?.term?.name || termDetails?.name || 'N/A';
  const displaySessionName = report?.session?.name || sessionDetails?.name || termDetails?.session?.name || 'N/A';
  
  const displayClassName = useMemo(() => {
    if (!report?.student?.class) return 'N/A';
    const { name, section, level } = report.student.class;
    return `${name}${section ? ` ${section}` : ''}${level ? ` (${level})` : ''}`;
  }, [report?.student?.class]);

  const studentFullName = useMemo(() => {
    if (!report?.student) return 'Unknown Student';
    return `${report.student.firstName} ${report.student.lastName}`;
  }, [report?.student]);

  const hasSubjects = report?.subjects && report.subjects.length > 0;

  // ✅ NEW: Calculate attendance stats
  const attendanceStats = useMemo(() => {
    const data = attendanceData || {};
    const timesOpen = data.timesOpen || data.schoolOpened || 0;
    const timesPresent = data.timesPresent || data.present || 0;
    const timesAbsent = timesOpen - timesPresent;
    const percentage = timesOpen > 0 ? ((timesPresent / timesOpen) * 100).toFixed(1) : '0.0';
    
    return { timesOpen, timesPresent, timesAbsent, percentage };
  }, [attendanceData]);

  // ✅ NEW: Get rating for psychomotor skill
  const getPsychomotorRating = (skillKey) => {
    if (!psychomotorData) return '-';
    return psychomotorData[skillKey] || '-';
  };

  // ✅ NEW: Get rating for affective skill
  const getAffectiveRating = (skillKey) => {
    if (!affectiveData) return '-';
    return affectiveData[skillKey] || '-';
  };

  const formatDate = (date) => date 
    ? new Date(date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) 
    : 'N/A';

  const getOrdinalSuffix = (num) => {
    if (!num || isNaN(num)) return '';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  // ✅ RENDER: Loading
  if (loading) return <ReportSkeleton />;

  // ✅ RENDER: Error
  if (error) {
    return (
      <div className="print-error-page">
        <div className="error-icon-container">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <h3>Error Loading Report</h3>
        <p className="error-message">{error}</p>
        <div className="error-actions">
          <button onClick={() => navigate(-1)} className="error-btn error-btn-secondary">← Go Back</button>
          <button onClick={handleRefresh} className="error-btn error-btn-primary">↻ Try Again</button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="print-error-page">
        <h3>Report Card Not Found</h3>
        <div className="error-actions">
          <button onClick={() => navigate(-1)} className="error-btn error-btn-secondary">Go Back</button>
          <button onClick={handleRefresh} className="error-btn error-btn-primary">Refresh</button>
        </div>
      </div>
    );
  }

  // ✅ RENDER: Main Report Card
  return (
    <div className="report-sheet-wrapper">
      {/* Screen Controls */}
      <div className="screen-controls">
        <button onClick={() => navigate(-1)} className="ctrl-btn back">← Back</button>
        <div className="screen-controls-right">
          <button onClick={handleRefresh} className="ctrl-btn refresh" disabled={loading}>↻ Refresh</button>
          <button onClick={() => window.print()} className="ctrl-btn print">🖨 Print Report</button>
        </div>
      </div>

      {/* A4 Document */}
      <div className="a4-document">
        
        {/* ===== HEADER ===== */}
        <header className="ng-header">
          <div className="ng-header-top">
            <div className="ng-logo-wrap">
              <img
                src={schoolLogo}
                alt="School Logo"
                className="ng-logo"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <div className="ng-school-info">
              <h1 className="ng-school-name">DATFORTE INTERNATIONAL SCHOOLS LIMITED</h1>
              <p className="ng-school-motto" style={{ fontStyle: 'italic', fontSize: '0.75rem', margin: '2px 0', color: '#666' }}>
                "Moulding Leaders for Tomorrow"
              </p>
              <div className="ng-school-address">
                <span>Location Address Here</span>
                <span>|</span>
                <span>Tel: 080XXXXXXXXX</span>
              </div>
            </div>
          </div>
          
          <div className="ng-doc-title-bar">
            <h2 className="ng-doc-title">STUDENT TERMLY REPORT SHEET</h2>
          </div>
          
          <div className="ng-term-session-bar">
            <div className="ng-ts-item">
              <span className="ng-ts-label">Term:</span>
              <span className="ng-ts-value">{displayTermName}</span>
            </div>
            <div className="ng-ts-divider"></div>
            <div className="ng-ts-item">
              <span className="ng-ts-label">Session:</span>
              <span className="ng-ts-value">{displaySessionName}</span>
            </div>
          </div>
        </header>

        {/* ===== STUDENT INFORMATION ===== */}
        <section className="ng-section ng-student-info">
          <div className="ng-info-grid">
            <div className="ng-info-item">
              <span className="ng-info-label">Student Name:</span>
              <span className="ng-info-value ng-name">{studentFullName}</span>
            </div>
            <div className="ng-info-item">
              <span className="ng-info-label">Admission No:</span>
              <span className="ng-info-value">{report.student.admissionNumber || 'N/A'}</span>
            </div>
            <div className="ng-info-item">
              <span className="ng-info-label">Class:</span>
              <span className="ng-info-value">{displayClassName}</span>
            </div>
            <div className="ng-info-item">
              <span className="ng-info-label">Gender:</span>
              <span className="ng-info-value">{report.student.gender || 'N/A'}</span>
            </div>
          </div>
        </section>

        {/* ===== ATTENDANCE RECORD (NEW) ===== */}
        <section className="ng-section ng-attendance">
          <h3 className="ng-section-title">A. ATTENDANCE RECORD</h3>
          <div className="ng-attendance-grid">
            <div className="ng-att-item">
              <span className="ng-att-label">No. of Times School Opened:</span>
              <span className="ng-att-value">{attendanceStats.timesOpen}</span>
            </div>
            <div className="ng-att-item">
              <span className="ng-att-label">No. of Times Present:</span>
              <span className="ng-att-value ng-att-present">{attendanceStats.timesPresent}</span>
            </div>
            <div className="ng-att-item">
              <span className="ng-att-label">No. of Times Absent:</span>
              <span className="ng-att-value ng-att-absent">{attendanceStats.timesAbsent}</span>
            </div>
            <div className="ng-att-item">
              <span className="ng-att-label">Percentage Present:</span>
              <span className={`ng-att-value ng-att-percentage ${parseFloat(attendanceStats.percentage) >= 75 ? 'ng-att-good' : 'ng-att-poor'}`}>
                {attendanceStats.percentage}%
              </span>
            </div>
          </div>
        </section>

        {/* ===== ACADEMIC PERFORMANCE ===== */}
        <section className="ng-section ng-grades">
          <h3 className="ng-section-title">B. ACADEMIC PERFORMANCE</h3>
          
          {!hasSubjects && (
            <NoSubjectsState studentName={studentFullName} termName={displayTermName} />
          )}

          <div className="ng-table-wrapper">
            <table className="ng-grades-table">
              <thead>
                <tr>
                  <th rowSpan="2" className="ng-th-sn">S/N</th>
                  <th rowSpan="2" className="ng-th-subject">SUBJECTS</th>
                  <th colSpan="4" className="ng-th-ca">CONTINUOUS ASSESSMENT (40%)</th>
                  <th rowSpan="2" className="ng-th-exam">EXAM SCORE<br/>(60%)</th>
                  <th rowSpan="2" className="ng-th-total">TOTAL<br/>(100%)</th>
                  <th rowSpan="2" className="ng-th-grade">GRADE</th>
                  <th rowSpan="2" className="ng-th-remark">REMARK</th>
                </tr>
                <tr>
                  <th className="ng-th-ca-sub">1st Test<br/>(10)</th>
                  <th className="ng-th-ca-sub">2nd Test<br/>(10)</th>
                  <th className="ng-th-ca-sub">Assignment<br/>(10)</th>
                  <th className="ng-th-ca-sub">Total CA<br/>(40)</th>
                </tr>
              </thead>
              <tbody>
                {report.subjects?.map((sub, i) => {
                  const subjectName = getNestedValue(sub, 'subject.name', 'subjectName', 'name');
                  const test1 = getNestedValue(sub, 'testScore', 0); // Using as 1st test
                  const test2 = 0; // Placeholder for 2nd test
                  const assignScore = getNestedValue(sub, 'assignmentScore', 0);
                  const noteScore = getNestedValue(sub, 'noteTakingScore', 0);
                  const totalCA = getNestedValue(sub, 'totalCA', test1 + test2 + assignScore + noteScore);
                  const examScore = getNestedValue(sub, 'examScore', 0);
                  const totalScore = getNestedValue(sub, 'totalScore', 0);
                  const grade = getNestedValue(sub, 'grade', '');
                  const remark = getNestedValue(sub, 'remark', '');
                  
                  return (
                    <tr key={sub._id || `sub-${i}`} className={i % 2 === 0 ? 'ng-row-even' : 'ng-row-odd'}>
                      <td className="ng-td-center">{i + 1}</td>
                      <td className="ng-td-subject">{subjectName || '—'}</td>
                      <td className="ng-td-center">{test1 || '—'}</td>
                      <td className="ng-td-center">{test2 || '—'}</td>
                      <td className="ng-td-center">{assignScore || '—'}</td>
                      <td className="ng-td-center ng-td-bold">{totalCA || '—'}</td>
                      <td className="ng-td-center ng-td-bold">{examScore || '—'}</td>
                      <td className="ng-td-center ng-td-bold ng-td-total">{totalScore || '—'}</td>
                      <td className="ng-td-center">
                        {grade ? <span className={`ng-grade ng-grade-${grade.toLowerCase()}`}>{grade}</span> : '—'}
                      </td>
                      <td className="ng-td-remark">{remark || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="ng-summary-row">
                  <td colSpan="6" className="ng-summary-label">TOTAL SCORE OBTAINED:</td>
                  <td className="ng-td-center ng-td-bold ng-td-total">{report.statistics?.totalScore || 0}</td>
                  <td colSpan="2"></td>
                </tr>
                <tr className="ng-summary-row">
                  <td colSpan="6" className="ng-summary-label">STUDENT'S AVERAGE:</td>
                  <td className="ng-td-center ng-td-bold ng-td-total">{report.statistics?.averageScore || 0}%</td>
                  <td colSpan="2"></td>
                </tr>
                <tr className="ng-summary-row">
                  <td colSpan="6" className="ng-summary-label">POSITION IN CLASS:</td>
                  <td className="ng-td-center ng-td-bold ng-td-total" colSpan="3">
                    {report.statistics?.position 
                      ? `${report.statistics.position}${getOrdinalSuffix(report.statistics.position)} out of ${report.statistics?.totalInClass || '?'}`
                      : 'N/A'
                    }
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="ng-grading-key">
            <span className="ng-grading-label">GRADING KEY:</span>
            <span className="ng-grading-text">
              A (70-100) Excellent | B (60-69) Very Good | C (50-59) Good | D (40-49) Fair | E (30-39) Poor | F (0-29) Fail
            </span>
          </div>
        </section>

        {/* ===== PSYCHOMOTOR DOMAIN (NEW) ===== */}
        <section className="ng-section ng-psychomotor">
          <h3 className="ng-section-title">C. PSYCHOMOTOR DOMAIN</h3>
          <div className="ng-psych-grid">
            {DEFAULT_PSYCHOMOTOR.map((skill, i) => (
              <div key={skill.key} className="ng-psych-item">
                <span className="ng-psych-num">{i + 1}.</span>
                <span className="ng-psych-label">{skill.label}</span>
                <RatingKey rating={getPsychomotorRating(skill.key)} />
              </div>
            ))}
          </div>
          <div className="ng-rating-key">
            <span className="ng-rating-key-label">RATING KEY:</span>
            <span className="ng-rating-key-text">A = Excellent | B = Very Good | C = Good | D = Fair | E = Poor</span>
          </div>
        </section>

        {/* ===== AFFECTIVE DOMAIN (NEW) ===== */}
        <section className="ng-section ng-affective">
          <h3 className="ng-section-title">D. AFFECTIVE DOMAIN</h3>
          <div className="ng-psych-grid ng-affective-grid">
            {DEFAULT_AFFECTIVE.map((skill, i) => (
              <div key={skill.key} className="ng-psych-item">
                <span className="ng-psych-num">{i + 1}.</span>
                <span className="ng-psych-label">{skill.label}</span>
                <RatingKey rating={getAffectiveRating(skill.key)} />
              </div>
            ))}
          </div>
        </section>

        {/* ===== COMMENTS & SIGNATURES ===== */}
        <section className="ng-section ng-comments">
          <h3 className="ng-section-title">E. GENERAL REMARKS</h3>
          
          <div className="ng-comments-grid">
            {/* Class Teacher Comment */}
            <div className="ng-comment-box">
              <div className="ng-comment-header">
                <span className="ng-comment-title">Class Teacher's Comment</span>
              </div>
              <div className="ng-comment-body">
                {commentLoading ? (
                  <span className="ng-comment-loading">Loading...</span>
                ) : classTeacherComment ? (
                  <p>{classTeacherComment}</p>
                ) : (
                  <p className="ng-blank-lines">............................................................................</p>
                )}
              </div>
             
            </div>

            {/* Principal Comment */}
            <div className="ng-comment-box">
              <div className="ng-comment-header">
                <span className="ng-comment-title">Principal's Comment</span>
              </div>
              <div className="ng-comment-body">
                {report.principalComment ? (
                  <p>{report.principalComment}</p>
                ) : (
                  <p className="ng-blank-lines">............................................................................</p>
                )}
              </div>
              <div className="ng-signature">
                <div className="ng-sig-line"></div>
                <span className="ng-sig-label">Principal's Signature</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="ng-footer">
          <div className="ng-next-term">
            <div className="ng-next-term-box">
              <span className="ng-next-term-label">NEXT TERM BEGINS:</span>
              <span className="ng-next-term-date">
                {report.term?.nextTermBegins 
                  ? formatDate(report.term.nextTermBegins) 
                  : 'To Be Announced'
                }
              </span>
            </div>
          </div>
          
          <div className="ng-footer-dates">
            <div className="ng-footer-date">
              <span className="ng-fd-label">Term Began:</span>
              <span className="ng-fd-value">{formatDate(report.term?.startDate)}</span>
            </div>
            <div className="ng-footer-date">
              <span className="ng-fd-label">Term Ended:</span>
              <span className="ng-fd-value">{formatDate(report.term?.endDate)}</span>
            </div>
          </div>

          <div className="ng-footer-bottom">
            <div className="ng-stamp-area">
              <div className="ng-stamp-placeholder">
                [SCHOOL STAMP]
              </div>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default StudentReportCard;