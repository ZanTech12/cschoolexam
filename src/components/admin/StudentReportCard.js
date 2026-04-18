import React, { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportCardsAPI, classTeacherCommentsAPI, attendanceAPI } from '../../api';
import schoolLogo from '../../pages/logo.png';
import './StudentReportCard.css';

const StudentReportCard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const studentId = window.location.pathname.split('/').pop();
  const termId = searchParams.get('termId');
  
  // Default psychomotor skills when API doesn't return them
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

  // ============================================
  // QUERY 1: Main Student Report
  // ============================================
  const { data: reportResponse, isLoading: isReportLoading, isError: isReportError } = useQuery({
    queryKey: ['student-report', studentId, termId],
    queryFn: () => reportCardsAPI.getStudentReport(studentId, { termId }),
    enabled: !!studentId && !!termId,
    staleTime: 60000,
  });

  const report = reportResponse?.data || null;

  // Extract dependent variables for the other queries
  const classId = report?.student?.class?._id || report?.student?.class?.id || null;
  const termName = report?.term?.name || null;
  const sessionName = report?.session?.name || null;

  // ============================================
  // QUERY 2: Class Teacher Comment (Depends on Query 1)
  // ============================================
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
    enabled: !!classId && !!termName && !!sessionName && !!studentId, // Only runs if report data is loaded
    staleTime: 60000,
  });

  // ============================================
  // QUERY 3: Attendance Data (Depends on Query 1)
  // ============================================
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
    enabled: !!classId && !!termName && !!sessionName && !!studentId, // Only runs if report data is loaded
    staleTime: 60000,
  });

  // ============================================
  // DERIVED STATE & HELPERS
  // ============================================
  const isLoading = isReportLoading;
  const error = isReportError ? 'Failed to load report data.' : null;

  const psychomotorSkills = report?.psychomotor?.length ? report.psychomotor : defaultPsychomotor;

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

  // ============================================
  // UI RENDERING
  // ============================================
  if (isLoading) {
    return (
      <div className="print-loading">
        <div className="spinner"></div>
        <p>Generating Report Sheet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="print-error-page">
        <h3>Error Loading Report</h3>
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="print-error-page">
        <p>Report card not found.</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="report-sheet-wrapper">
      {/* Screen Only Controls */}
      <div className="screen-controls">
        <button onClick={() => navigate(-1)} className="ctrl-btn back">&larr; Back</button>
        <button onClick={() => window.print()} className="ctrl-btn print">Print Report Sheet</button>
      </div>

      {/* The A4 Document */}
      <div className="a4-document">
        
        {/* --- HEADER --- */}
        <header className="school-header-elegant">
          <div className="header-ornament top"></div>

          <div className="header-logo-wrap">
            <img
              src={schoolLogo}
              alt="DATFORTE International School Logo"
              className="header-logo"
            />
          </div>

          <h1 className="school-name">DATFORTE INTERNATIONAL SCHOOLS LIMITED</h1>
          <h2 className="doc-title">STUDENT ACADEMIC REPORT CARD</h2>
          
          <div className="header-meta-box">
            <span className="meta-text">Term <strong>{report.term.name}</strong></span>
            <span className="meta-divider"></span>
            <span className="meta-text">Session <strong>{report.session.name}</strong></span>
          </div>

          <div className="header-ornament bottom"></div>
        </header>

        {/* STUDENT BIO-DATA */}
        <div className="bio-data-section">
          <div className="bio-grid">
            <div className="bio-item">
              <span className="bio-label">Name of Student</span>
              <span className="bio-value name-highlight">
                {report.student.firstName} {report.student.lastName}
              </span>
            </div>
            <div className="bio-item">
              <span className="bio-label">Admission No.</span>
              <span className="bio-value">{report.student.admissionNumber}</span>
            </div>
            <div className="bio-item">
              <span className="bio-label">Class</span>
              <span className="bio-value">
                {report.student.class?.name} {report.student.class?.section}
              </span>
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
              <tr className="summary-row">
                <td colSpan="7" className="td-right summary-label">POSITION IN CLASS:</td>
                <td className="td-center td-total" colSpan="3">
                  {report.statistics.position}th out of {report.statistics.totalInClass}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* GRADING KEY */}
        <div className="grading-key-elegant">
          <span className="key-label">GRADING SCALE:</span>
          <span className="key-text">
            A (Excellent) | B (Very Good) | C (Good) | D (Fair) | E (Poor) | F (Fail)
          </span>
        </div>

        {/* ========== ATTENDANCE SUMMARY ========== */}
        <div className="attendance-section">
          <div className="attendance-title">ATTENDANCE RECORD</div>
          <div className="attendance-grid">
            <div className="attendance-card">
              <span className="attendance-label">No. of Times School Opened</span>
              <span className="attendance-value">
                {timesSchoolOpen !== '' ? timesSchoolOpen : '––––'}
              </span>
            </div>
            <div className="attendance-card">
              <span className="attendance-label">No. of Times Present</span>
              <span className="attendance-value present">
                {timesPresent !== '' ? timesPresent : '––––'}
              </span>
            </div>
            <div className="attendance-card">
              <span className="attendance-label">No. of Times Absent</span>
              <span className="attendance-value absent">
                {timesAbsent !== '' ? timesAbsent : '––––'}
              </span>
            </div>
          </div>
        </div>

        {/* ========== PSYCHOMOTOR SKILLS ========== */}
        <div className="psychomotor-section">
          <div className="psychomotor-title">PSYCHOMOTOR / AFFECTIVE DOMAIN</div>
          <div className="psychomotor-key-note">
            Rating Key: <strong>A</strong> – Excellent &nbsp;|&nbsp;
            <strong>B</strong> – Very Good &nbsp;|&nbsp;
            <strong>C</strong> – Good &nbsp;|&nbsp;
            <strong>D</strong> – Fair &nbsp;|&nbsp;
            <strong>E</strong> – Poor
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
                    <td className="pm-td-skill">
                      {leftCol[idx]?.skill || ''}
                    </td>
                    <td className="pm-td-rating">
                      {leftCol[idx]?.rating
                        ? <span className="pm-rating-badge">{leftCol[idx].rating}</span>
                        : '––'
                      }
                    </td>
                    <td className="pm-td-center">{half + idx + 1}</td>
                    <td className="pm-td-skill">
                      {rightCol[idx]?.skill || ''}
                    </td>
                    <td className="pm-td-rating">
                      {rightCol[idx]?.rating
                        ? <span className="pm-rating-badge">{rightCol[idx].rating}</span>
                        : '––'
                      }
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

        {/* COMMENTS & SIGNATURES */}
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

        {/* FOOTER / NEXT TERM */}
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
  );
};

export default StudentReportCard;