import React, { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { reportCardsAPI, classTeacherCommentsAPI, attendanceAPI } from '../../api';
import schoolLogo from '../../pages/logo.png';
import './ReportCardsPrintView.css';

const ReportCardsPrintView = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const termId = searchParams.get('termId');
  const classIdsString = searchParams.get('classIds') || '';
  const classIds = classIdsString.split(',').filter(Boolean);
  
  // Helper to generate a random rating between 4 and 5
  const randomRating = () => Math.floor(Math.random() * 2) + 4;

  // Default psychomotor skills when data doesn't include them
  const defaultPsychomotor = useMemo(() => [
    { skill: 'Handwriting' },
    { skill: 'Sports' },
    { skill: 'Drawing & Painting' },
    { skill: 'Music & Drama' },
    { skill: 'Crafts' },
    { skill: 'Cleanliness' },
    { skill: 'Punctuality' },
    { skill: 'Politeness' },
  ], []);

  // ============================================
  // MAIN QUERY: Batch Print Data for All Classes
  // ============================================
  const { data: printResponse, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['batch-print-data', termId, classIdsString],
    queryFn: () => reportCardsAPI.getPrintData(termId, classIdsString),
    enabled: !!termId && !!classIdsString,
    staleTime: 60000,
  });

  const printData = printResponse?.data || null;
  const error = isError
    ? (queryError?.response?.data?.message || 'Failed to load print data.')
    : null;

  const termName = printData?.term?.name || '';
  const sessionName = printData?.session?.name || '';

  // ============================================
  // EXTRACTED ENDPOINTS: Comments & Attendance
  // ============================================
  const commentQueries = useQueries({
    queries: classIds.map(classId => ({
      queryKey: ['batch-class-teacher-comment', classId, termName, sessionName],
      queryFn: () => classTeacherCommentsAPI.getByClass(classId, { term: termName, session: sessionName }),
      enabled: !!printData,
      staleTime: 60000,
    })),
  });

  const attendanceQueries = useQueries({
    queries: classIds.map(classId => ({
      queryKey: ['batch-class-attendance', classId, termName, sessionName],
      queryFn: () => attendanceAPI.getStudentCountsByClass(classId, { term: termName, session: sessionName }),
      enabled: !!printData,
      staleTime: 60000,
    })),
  });

  // ============================================
  // HELPERS
  // ============================================
  const getAbsentDays = (present, total) => {
    if (present === '' || present === undefined || present === null ||
        total === '' || total === undefined || total === null || total === 0) {
      return '';
    }
    const absent = total - present;
    return absent > 0 ? absent : 0;
  };

  const formatDate = (date) => date
    ? new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  // Extractors for the newly integrated endpoints
  const extractComments = (response) => {
    let comments = [];
    if (Array.isArray(response)) comments = response;
    else if (response?.data && Array.isArray(response.data)) comments = response.data;
    else if (response?.comments && Array.isArray(response.comments)) comments = response.comments;
    return comments;
  };

  const extractAttendance = (response) => {
    if (!response?.success) return { schoolOpenDays: '', students: [] };
    const schoolOpenDays = response.schoolOpenDays || response.data?.schoolOpenDays || '';
    const students = response.data || [];
    return { schoolOpenDays, students };
  };

  // Reusable psychomotor table renderer (Auto-generates ratings 4-5)
  const renderPsychomotorTable = (psychomotorData) => {
    const baseSkills = psychomotorData?.length ? psychomotorData : defaultPsychomotor;
    
    // Always override ratings to be between 4 and 5 for each student
    const skills = baseSkills.map((item) => ({
      skill: item.skill,
      rating: randomRating()
    }));

    const half = Math.ceil(skills.length / 2);
    const leftCol = skills.slice(0, half);
    const rightCol = skills.slice(half);
    const rows = Math.max(leftCol.length, rightCol.length);

    return (
      <div className="psychomotor-section">
        <div className="psychomotor-title">PSYCHOMOTOR / AFFECTIVE DOMAIN</div>
        <div className="psychomotor-key-note">
          Rating Key: <strong>5</strong> – Excellent &nbsp;|&nbsp;
          <strong>4</strong> – Very Good &nbsp;|&nbsp;
          <strong>3</strong> – Good &nbsp;|&nbsp;
          <strong>2</strong> – Fair &nbsp;|&nbsp;
          <strong>1</strong> – Poor
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
            {Array.from({ length: rows }, (_, idx) => (
              <tr key={idx}>
                <td className="pm-td-center">{idx + 1}</td>
                <td className="pm-td-skill">{leftCol[idx]?.skill || ''}</td>
                <td className="pm-td-rating">
                  <span className="pm-rating-badge">{leftCol[idx]?.rating}</span>
                </td>
                <td className="pm-td-center">{half + idx + 1}</td>
                <td className="pm-td-skill">{rightCol[idx]?.skill || ''}</td>
                <td className="pm-td-rating">
                  <span className="pm-rating-badge">{rightCol[idx]?.rating}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ============================================
  // UI RENDERING
  // ============================================
  if (isLoading) {
    return (
      <div className="print-loading-screen">
        <div className="spinner-large"></div>
        <h2>Gathering Report Cards...</h2>
        <p>This might take a moment for multiple classes.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="print-error-screen">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="btn-back">Go Back</button>
      </div>
    );
  }

  if (!printData) {
    return (
      <div className="print-error-screen">
        <h2>No Data Available</h2>
        <button onClick={() => navigate(-1)} className="btn-back">Go Back</button>
      </div>
    );
  }

  const { term, session, classes } = printData;

  return (
    <div className="print-view-wrapper">
      {/* Screen-only controls */}
      <div className="screen-controls">
        <button onClick={() => navigate(-1)} className="ctrl-btn back">
          &larr; Back
        </button>
        <button onClick={() => window.print()} className="ctrl-btn print">
          Print All Report Cards
        </button>
      </div>

      {/* Print Area */}
      <div className="print-area">
        {classes.map((classObj) => {
          const queryIdx = classIds.indexOf(classObj.classInfo._id);

          return (
            <div
              key={classObj.classInfo._id}
              className="print-class-section"
              style={{ pageBreakBefore: 'always' }}
            >
              {classObj.students.map((student) => {
                // --- 1. CLASS TEACHER COMMENT RESOLUTION ---
                let classTeacherComment = student.classTeacherComment || '';
                if (queryIdx !== -1 && commentQueries[queryIdx]?.data) {
                  const comments = extractComments(commentQueries[queryIdx].data);
                  const found = comments.find(c => {
                    const cStudentId = c.student_id || c.studentId || c.student?._id;
                    return cStudentId === student.student._id || cStudentId?._id === student.student._id;
                  });
                  if (found?.comment) {
                    classTeacherComment = found.comment;
                  }
                }

                // --- 2. ATTENDANCE RESOLUTION ---
                let timesOpen = student.attendance?.timesOpen || '';
                let timesPresent = student.attendance?.timesPresent || '';
                let timesAbsent = getAbsentDays(timesPresent, timesOpen);

                if (queryIdx !== -1 && attendanceQueries[queryIdx]?.data) {
                  const attData = extractAttendance(attendanceQueries[queryIdx].data);
                  if (attData.schoolOpenDays) timesOpen = attData.schoolOpenDays;
                  
                  const studentRecord = attData.students.find(s => {
                    const sId = s.student_id || s.studentId || s.student?._id;
                    return sId === student.student._id || sId?._id === student.student._id || sId?.toString() === student.student._id?.toString();
                  });

                  if (studentRecord) {
                    const present = studentRecord.times_present || studentRecord.timesPresent || '';
                    if (present !== '') timesPresent = present;
                  }
                  
                  if (timesOpen !== '' && timesPresent !== '') {
                    timesAbsent = (timesOpen >= timesPresent) ? timesOpen - timesPresent : 0;
                  }
                }

                return (
                  <div
                    key={student.student._id}
                    className="a4-document print-student-card"
                    style={{ pageBreakInside: 'avoid' }}
                  >
                    {/* ===== SCHOOL HEADER ===== */}
                    <header className="school-header-elegant">
                      <div className="header-ornament top"></div>

                      <div className="header-logo-wrap">
                        <img
                          src={schoolLogo}
                          alt="DATFORTE International School Logo"
                          className="header-logo"
                        />
                      </div>

                      <h1 className="school-name">
                        DATFORTE INTERNATIONAL SCHOOLS LIMITED
                      </h1>
                      <h2 className="doc-title">STUDENT ACADEMIC REPORT CARD</h2>

                      <div className="header-meta-box">
                        <span className="meta-text">
                          Term <strong>{term.name}</strong>
                        </span>
                        <span className="meta-divider"></span>
                        <span className="meta-text">
                          Session <strong>{session.name}</strong>
                        </span>
                      </div>

                      <div className="header-ornament bottom"></div>
                    </header>

                    {/* ===== STUDENT BIO-DATA ===== */}
                    <div className="bio-data-section">
                      <div className="bio-grid">
                        <div className="bio-item">
                          <span className="bio-label">Name of Student</span>
                          <span className="bio-value name-highlight">
                            {student.student.firstName} {student.student.lastName}
                          </span>
                        </div>
                        <div className="bio-item">
                          <span className="bio-label">Admission No.</span>
                          <span className="bio-value">
                            {student.student.admissionNumber}
                          </span>
                        </div>
                        <div className="bio-item">
                          <span className="bio-label">Class</span>
                          <span className="bio-value">
                            {classObj.classInfo.name} {classObj.classInfo.section}
                          </span>
                        </div>
                        <div className="bio-item">
                          <span className="bio-label">Gender</span>
                          <span className="bio-value">{student.student.gender}</span>
                        </div>
                      </div>
                    </div>

                    {/* ===== GRADES TABLE ===== */}
                    <div className="grades-container">
                      <table className="grades-table-elegant">
                        <thead>
                          <tr>
                            <th rowSpan="2" className="th-sn">S/N</th>
                            <th rowSpan="2" className="th-subject">SUBJECTS</th>
                            <th colSpan="4" className="th-ca-header">
                              CONTINUOUS ASSESSMENT (40)
                            </th>
                            <th rowSpan="2" className="th-score">
                              EXAM<br />(60)
                            </th>
                            <th rowSpan="2" className="th-score">
                              TOTAL<br />(100)
                            </th>
                            <th rowSpan="2" className="th-grade">GRADE</th>
                            <th rowSpan="2" className="th-remark">REMARK</th>
                          </tr>
                          <tr>
                            <th className="th-sub-ca">Test<br />(20)</th>
                            <th className="th-sub-ca">Notes<br />(10)</th>
                            <th className="th-sub-ca">Assign<br />(10)</th>
                            <th className="th-sub-ca">Total<br />(40)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {student.subjects.map((sub, i) => (
                            <tr key={sub.subjectId || sub._id || i}>
                              <td className="td-center">{i + 1}</td>
                              <td className="td-subject">
                                {sub.subjectName || sub.subject?.name}
                              </td>
                              <td className="td-center">
                                {sub.testScore ?? '–'}
                              </td>
                              <td className="td-center">
                                {sub.noteTakingScore ?? '–'}
                              </td>
                              <td className="td-center">
                                {sub.assignmentScore ?? '–'}
                              </td>
                              <td className="td-center td-bold">{sub.totalCA}</td>
                              <td className="td-center td-bold">{sub.examScore}</td>
                              <td className="td-center td-bold td-total">
                                {sub.totalScore}
                              </td>
                              <td className="td-center td-bold">{sub.grade}</td>
                              <td className="td-remark">{sub.remark}</td>
                            </tr>
                          ))}
                          {student.subjects.length === 0 && (
                            <tr>
                              <td colSpan="10" className="td-empty">
                                No grades recorded for this term.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="summary-row">
                            <td
                              colSpan="7"
                              className="td-right summary-label"
                            >
                              TOTAL SCORE OBTAINED:
                            </td>
                            <td className="td-center td-total">
                              {student.statistics.totalScore}
                            </td>
                            <td colSpan="2"></td>
                          </tr>
                          <tr className="summary-row">
                            <td
                              colSpan="7"
                              className="td-right summary-label"
                            >
                              STUDENT AVERAGE:
                            </td>
                            <td className="td-center td-total">
                              {student.statistics.averageScore}%
                            </td>
                            <td colSpan="2"></td>
                          </tr>
                          <tr className="summary-row">
                            <td
                              colSpan="7"
                              className="td-right summary-label"
                            >
                              POSITION IN CLASS:
                            </td>
                            <td className="td-center td-total" colSpan="3">
                              {student.statistics.position}th out of{' '}
                              {student.statistics.totalInClass}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* ===== GRADING KEY ===== */}
                    <div className="grading-key-elegant">
                      <span className="key-label">GRADING SCALE:</span>
                      <span className="key-text">
                        A (Excellent) | B (Very Good) | C (Good) | D (Fair) | E
                        (Poor) | F (Fail)
                      </span>
                    </div>

                    {/* ===== ATTENDANCE RECORD ===== */}
                    <div className="attendance-section">
                      <div className="attendance-title">ATTENDANCE RECORD</div>
                      <div className="attendance-grid">
                        <div className="attendance-card">
                          <span className="attendance-label">
                            No. of Times School Opened
                          </span>
                          <span className="attendance-value">
                            {timesOpen !== '' ? timesOpen : '––––'}
                          </span>
                        </div>
                        <div className="attendance-card">
                          <span className="attendance-label">
                            No. of Times Present
                          </span>
                          <span className="attendance-value present">
                            {timesPresent !== '' ? timesPresent : '––––'}
                          </span>
                        </div>
                        <div className="attendance-card">
                          <span className="attendance-label">
                            No. of Times Absent
                          </span>
                          <span className="attendance-value absent">
                            {timesAbsent !== '' ? timesAbsent : '––––'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ===== PSYCHOMOTOR / AFFECTIVE DOMAIN ===== */}
                    {renderPsychomotorTable(student.psychomotor)}

                    {/* ===== COMMENTS & SIGNATURES ===== */}
                    <div className="comments-container">
                      <div className="comment-box-elegant">
                        <div className="comment-title">
                          CLASS TEACHER'S COMMENT
                        </div>
                        <div className="comment-text-area">
                          {classTeacherComment ? (
                            <>
                              <strong>
                                {student.student.firstName}{' '}
                                {student.student.lastName}
                              </strong>{' '}
                              - {classTeacherComment}
                            </>
                          ) : (
                            <span className="blank-line">
                              ................................................................................
                            </span>
                          )}
                        </div>
                        <div className="signature-section">
                          <div className="sig-line"></div>
                          <span className="sig-text">Class Teacher</span>
                        </div>
                      </div>

                      <div className="comment-box-elegant">
                        <div className="comment-title">PRINCIPAL'S COMMENT</div>
                        <div className="comment-text-area">
                          {student.principalComment ? (
                            <>{student.principalComment}</>
                          ) : (
                            <span className="blank-line">
                              ................................................................................
                            </span>
                          )}
                        </div>
                        <div className="signature-section">
                          <div className="sig-line"></div>
                          <span className="sig-text">Principal/Headteacher</span>
                        </div>
                      </div>
                    </div>

                    {/* ===== FOOTER / NEXT TERM ===== */}
                    <footer className="sheet-footer-elegant">
                      <div className="footer-dates-grid">
                        <div className="footer-date-item">
                          <span className="fd-label">Term Begins:</span>
                          <span className="fd-value">
                            {formatDate(term.startDate)}
                          </span>
                        </div>
                        <div className="footer-date-item">
                          <span className="fd-label">Term Ends:</span>
                          <span className="fd-value">
                            {formatDate(term.endDate)}
                          </span>
                        </div>
                      </div>

                      {term.nextTermBegins && (
                        <div className="next-term-highlight">
                          <span className="nt-label">NEXT TERM BEGINS:</span>
                          <span className="nt-date">
                            {formatDate(term.nextTermBegins)}
                          </span>
                        </div>
                      )}
                    </footer>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReportCardsPrintView;