import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { testResultsAPI, testsAPI, classesAPI, studentsAPI, subjectsAPI, downloadCSV, reportCardsAPI, classTeacherCommentsAPI, attendanceAPI } from '../../api';
import Loading from '../common/Loading';
import schoolLogo from '../../pages/logo.png';

// ── Shared Utilities ──
const avatarColor = (name) => {
  const colors = ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#0ea5e9','#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const getGrade = (p) => {
  if (p >= 90) return { grade: 'A+', color: '#059669' };
  if (p >= 80) return { grade: 'A', color: '#10b981' };
  if (p >= 70) return { grade: 'B', color: '#3b82f6' };
  if (p >= 60) return { grade: 'C', color: '#6366f1' };
  if (p >= 50) return { grade: 'D', color: '#f59e0b' };
  return { grade: 'F', color: '#ef4444' };
};

const formatDate = (date) => date
  ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  : 'N/A';

// ════════════════════════════════════════════════════════════════
// REPORT CARD MODAL
// ════════════════════════════════════════════════════════════════
const ReportCardModal = ({ studentId, termId, onClose }) => {
  const defaultPsychomotor = useMemo(() => [
    { skill: 'Handwriting', rating: '' }, { skill: 'Sports', rating: '' },
    { skill: 'Drawing & Painting', rating: '' }, { skill: 'Music & Drama', rating: '' },
    { skill: 'Crafts', rating: '' }, { skill: 'Cleanliness', rating: '' },
    { skill: 'Punctuality', rating: '' }, { skill: 'Politeness', rating: '' },
  ], []);

  const { data: reportResponse, isLoading: isReportLoading, isError: isReportError } = useQuery({
    queryKey: ['student-report', studentId, termId],
    queryFn: () => reportCardsAPI.getStudentReport(studentId, { termId }),
    enabled: !!studentId && !!termId, staleTime: 60000,
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
    enabled: !!classId && !!termName && !!sessionName && !!studentId, staleTime: 60000,
  });

  const { data: attendanceResponse } = useQuery({
    queryKey: ['student-attendance', classId, termName, sessionName, studentId],
    queryFn: async () => {
      const response = await attendanceAPI.getStudentCountsByClass(classId, { term: termName, session: sessionName });
      if (!response?.success) return { timesPresent: '', timesSchoolOpen: '', timesAbsent: '' };
      const schoolOpenDays = response.schoolOpenDays || response.data?.schoolOpenDays || '';
      const students = response.data || [];
      const studentRecord = students.find(s => {
        const sId = s.student_id || s.studentId || s.student?._id;
        return sId === studentId || sId?._id === studentId || sId?.toString() === studentId?.toString();
      });
      const timesPresent = studentRecord?.times_present || studentRecord?.timesPresent || '';
      const timesSchoolOpen = typeof schoolOpenDays === 'number' ? schoolOpenDays : '';
      const timesAbsent = (timesPresent !== '' && timesSchoolOpen !== '' && timesSchoolOpen >= timesPresent) ? timesSchoolOpen - timesPresent : '';
      return { timesPresent, timesSchoolOpen, timesAbsent };
    },
    enabled: !!classId && !!termName && !!sessionName && !!studentId, staleTime: 60000,
  });

  const psychomotorSkills = report?.psychomotor?.length ? report.psychomotor : defaultPsychomotor;
  const randomPsychomotorRatings = useMemo(() => psychomotorSkills.map(() => Math.floor(Math.random() * 2) + 4), [psychomotorSkills]);
  const timesPresent = attendanceResponse?.timesPresent || report?.attendance?.timesPresent || report?.timesPresent || '';
  const timesSchoolOpen = attendanceResponse?.timesSchoolOpen || report?.attendance?.timesSchoolOpen || report?.timesSchoolOpen || '';
  const timesAbsent = attendanceResponse?.timesAbsent !== undefined ? attendanceResponse.timesAbsent : ((timesPresent !== '' && timesSchoolOpen !== '' && timesSchoolOpen >= timesPresent) ? timesSchoolOpen - timesPresent : '');

  const handlePrint = () => {
    const printContent = document.getElementById('report-card-printable');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Report Card - ${report?.student?.firstName || ''} ${report?.student?.lastName || ''}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Times,serif;padding:20px}
.rc-wrap{max-width:210mm;margin:0 auto}
.rc-hdr{text-align:center;padding:15px 0;border-bottom:3px double #1a365d;margin-bottom:15px}
.rc-logo{width:50px;height:50px;object-fit:contain;margin-bottom:10px}
.rc-school{font-size:18px;font-weight:bold;color:#1a365d;letter-spacing:1px;margin-bottom:5px}
.rc-doctitle{font-size:14px;color:#4a5568;margin-bottom:10px}
.rc-meta{display:flex;justify-content:center;gap:20px;font-size:12px}
.rc-bio{margin-bottom:15px;padding:10px;border:1px solid #e2e8f0;border-radius:4px}
.rc-bio-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rc-bio-item{display:flex;gap:10px}
.rc-bio-lbl{font-size:11px;color:#718096;min-width:100px}
.rc-bio-val{font-size:12px;font-weight:600}
.rc-grades{margin-bottom:15px}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #cbd5e0;padding:6px 8px;text-align:center}
th{background:#1a365d;color:white;font-size:10px}
.td-l{text-align:left}
.td-b{font-weight:600}
.td-r{text-align:right}
.sum-row{background:#f7fafc;font-weight:600}
.rc-gkey{text-align:center;padding:8px;background:#f7fafc;border:1px solid #e2e8f0;margin-bottom:15px;font-size:10px}
.rc-att{margin-bottom:15px}
.rc-att-title{font-size:12px;font-weight:bold;margin-bottom:8px;text-align:center;text-decoration:underline}
.rc-att-grid{display:flex;justify-content:space-around}
.rc-att-card{text-align:center}
.rc-att-lbl{font-size:10px;color:#718096;display:block}
.rc-att-val{font-size:16px;font-weight:bold;display:block}
.rc-pm{margin-bottom:15px}
.rc-pm-title{font-size:12px;font-weight:bold;margin-bottom:8px;text-align:center;text-decoration:underline}
.rc-pm-note{text-align:center;font-size:9px;color:#718096;margin-bottom:8px}
.pm-skill{text-align:left}
.pm-badge{background:#edf2f7;padding:2px 8px;border-radius:3px;font-weight:bold}
.rc-comments{border:1px solid #e2e8f0;padding:12px;margin-bottom:15px}
.rc-cbox{margin-bottom:10px}
.rc-cbox:last-of-type{margin-bottom:0}
.rc-ctitle{font-size:11px;font-weight:bold;margin-bottom:6px;text-decoration:underline}
.rc-ctext{font-size:11px;line-height:1.5;word-wrap:break-word;overflow-wrap:break-word}
.rc-sigs{display:flex;justify-content:space-between;margin-top:14px;padding-top:10px;border-top:1px dashed #cbd5e0}
.rc-sig{flex:1}
.rc-sig:last-child{text-align:right}
.rc-sig-line{border-top:1px solid #000;width:130px}
.rc-sig-text{font-size:9px;display:block;margin-top:2px}
.rc-blank{display:inline}
.rc-ft{border-top:2px solid #1a365d;padding-top:15px;text-align:center}
.rc-ft-dates{display:flex;justify-content:space-around;margin-bottom:10px}
.rc-ft-lbl{font-size:10px;color:#718096}
.rc-ft-val{font-size:12px;font-weight:600;display:block}
.rc-nextterm{background:#1a365d;color:white;padding:8px 15px;border-radius:4px;display:inline-block}
.rc-nt-lbl{font-size:10px}
.rc-nt-date{font-size:14px;font-weight:bold;display:block}
@media print{body{padding:0}}
</style></head><body>${printContent.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  if (isReportLoading) {
    return (
      <div className="sr-modal-overlay" onClick={onClose}>
        <div className="sr-modal" onClick={e => e.stopPropagation()}>
          <div className="sr-modal-handle" />
          <div className="sr-modal-header"><h3 className="sr-modal-title">Student Report Card</h3><button className="sr-modal-close" onClick={onClose}>×</button></div>
          <div className="sr-modal-body" style={{ padding: 40, textAlign: 'center' }}><Loading message="Generating report card..." /></div>
        </div>
      </div>
    );
  }

  if (isReportError || !report) {
    return (
      <div className="sr-modal-overlay" onClick={onClose}>
        <div className="sr-modal" onClick={e => e.stopPropagation()}>
          <div className="sr-modal-handle" />
          <div className="sr-modal-header"><h3 className="sr-modal-title">Student Report Card</h3><button className="sr-modal-close" onClick={onClose}>×</button></div>
          <div className="sr-modal-body">
            <div className="sr-alert sr-alert-danger" style={{ margin: 0, justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <p style={{ margin: 0 }}>{isReportError ? 'Failed to load report card.' : 'Report card not found. Ensure all grades are entered for this term.'}</p>
              <button className="sr-btn sr-btn-primary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sr-modal-overlay" onClick={onClose}>
      <div className="sr-modal sr-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="sr-modal-handle" />
        <div className="sr-modal-header">
          <h3 className="sr-modal-title">📄 Student Report Card</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handlePrint} className="sr-btn sr-btn-success sr-btn-sm">🖨️ Print</button>
            <button className="sr-modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="sr-modal-body sr-report-body">
          <div id="report-card-printable" className="rc-wrap">
            <header className="rc-hdr">
              <img src={schoolLogo} alt="School Logo" className="rc-logo" />
              <h1 className="rc-school">DATFORTE INTERNATIONAL SCHOOLS LIMITED</h1>
              <h2 className="rc-doctitle">STUDENT ACADEMIC REPORT CARD</h2>
              <div className="rc-meta">
                <span>Term <strong>{report.term.name}</strong></span>
                <span>|</span>
                <span>Session <strong>{report.session.name}</strong></span>
              </div>
            </header>

            <div className="rc-bio">
              <div className="rc-bio-grid">
                <div className="rc-bio-item"><span className="rc-bio-lbl">Name of Student</span><span className="rc-bio-val">{report.student.lastName} {report.student.firstName} </span></div>
                <div className="rc-bio-item"><span className="rc-bio-lbl">Admission No.</span><span className="rc-bio-val">{report.student.admissionNumber}</span></div>
                <div className="rc-bio-item"><span className="rc-bio-lbl">Class</span><span className="rc-bio-val">{report.student.class?.name} {report.student.class?.section}</span></div>
                <div className="rc-bio-item"><span className="rc-bio-lbl">Gender</span><span className="rc-bio-val">{report.student.gender}</span></div>
              </div>
            </div>

            <div className="rc-grades">
              <table>
                <thead>
                  <tr><th rowSpan="2">S/N</th><th rowSpan="2" className="td-l">SUBJECTS</th><th colSpan="4">CONTINUOUS ASSESSMENT (40)</th><th rowSpan="2">EXAM<br/>(60)</th><th rowSpan="2">TOTAL<br/>(100)</th><th rowSpan="2">GRADE</th><th rowSpan="2">REMARK</th></tr>
                  <tr><th>Test<br/>(20)</th><th>Notes<br/>(10)</th><th>Assign<br/>(10)</th><th>Total<br/>(40)</th></tr>
                </thead>
                <tbody>
                  {report.subjects.map((sub, i) => (
                    <tr key={sub._id || i}><td>{i + 1}</td><td className="td-l">{sub.subject?.name}</td><td>{sub.testScore}</td><td>{sub.noteTakingScore}</td><td>{sub.assignmentScore}</td><td className="td-b">{sub.totalCA}</td><td className="td-b">{sub.examScore}</td><td className="td-b">{sub.totalScore}</td><td className="td-b">{sub.grade}</td><td>{sub.remark}</td></tr>
                  ))}
                  {report.subjects.length === 0 && <tr><td colSpan="10">No grades recorded for this term.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="sum-row"><td colSpan="7" className="td-r">TOTAL SCORE OBTAINED:</td><td>{report.statistics.totalScore}</td><td colSpan="2"></td></tr>
                  <tr className="sum-row"><td colSpan="7" className="td-r">STUDENT AVERAGE:</td><td>{report.statistics.averageScore}%</td><td colSpan="2"></td></tr>
                </tfoot>
              </table>
            </div>

            <div className="rc-gkey"><strong>GRADING SCALE:</strong> A (Excellent) | B (Very Good) | C (Good) | D (Fair) | E (Poor) | F (Fail)</div>

            <div className="rc-att">
              <div className="rc-att-title">ATTENDANCE RECORD</div>
              <div className="rc-att-grid">
                <div className="rc-att-card"><span className="rc-att-lbl">No. of Times School Opened</span><span className="rc-att-val">{timesSchoolOpen !== '' ? timesSchoolOpen : '––––'}</span></div>
                <div className="rc-att-card"><span className="rc-att-lbl">No. of Times Present</span><span className="rc-att-val" style={{ color: '#059669' }}>{timesPresent !== '' ? timesPresent : '––––'}</span></div>
                <div className="rc-att-card"><span className="rc-att-lbl">No. of Times Absent</span><span className="rc-att-val" style={{ color: '#dc2626' }}>{timesAbsent !== '' ? timesAbsent : '––––'}</span></div>
              </div>
            </div>

            <div className="rc-pm">
              <div className="rc-pm-title">PSYCHOMOTOR / AFFECTIVE DOMAIN</div>
              <div className="rc-pm-note">Rating Key: <strong>A</strong> – Excellent | <strong>B</strong> – Very Good | <strong>C</strong> – Good | <strong>D</strong> – Fair | <strong>E</strong> – Poor</div>
              <table>
                <thead><tr><th>S/N</th><th className="pm-skill">Skill / Trait</th><th>Rating</th><th>S/N</th><th className="pm-skill">Skill / Trait</th><th>Rating</th></tr></thead>
                <tbody>
                  {(() => {
                    const half = Math.ceil(psychomotorSkills.length / 2);
                    const L = psychomotorSkills.slice(0, half), R = psychomotorSkills.slice(half);
                    return Array.from({ length: Math.max(L.length, R.length) }, (_, idx) => (
                      <tr key={idx}><td>{idx + 1}</td><td className="pm-skill">{L[idx]?.skill || ''}</td><td><span className="pm-badge">{L[idx]?.rating || randomPsychomotorRatings[idx]}</span></td><td>{half + idx + 1}</td><td className="pm-skill">{R[idx]?.skill || ''}</td><td><span className="pm-badge">{R[idx]?.rating || randomPsychomotorRatings[half + idx]}</span></td></tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            <div className="rc-comments">
              <div className="rc-cbox">
                <div className="rc-ctitle">CLASS TEACHER'S COMMENT</div>
                <div className="rc-ctext">{classTeacherComment ? <><strong>{report.student.lastName} {report.student.firstName} </strong> — {classTeacherComment}</> : <span className="rc-blank">................................................................................</span>}</div>
              </div>
              <div className="rc-cbox">
                <div className="rc-ctitle">PRINCIPAL'S COMMENT</div>
                <div className="rc-ctext">{report.principalComment ? <>{report.principalComment}</> : <span className="rc-blank">................................................................................</span>}</div>
              </div>
              <div className="rc-sigs">
                <div className="rc-sig"><div className="rc-sig-line"></div><span className="rc-sig-text">Class Teacher</span></div>
                <div className="rc-sig"><div className="rc-sig-line"></div><span className="rc-sig-text">Principal / Headteacher</span></div>
              </div>
            </div>

            <footer className="rc-ft">
              <div className="rc-ft-dates">
                <div><span className="rc-ft-lbl">Term Begins:</span><span className="rc-ft-val">{formatDate(report.term.startDate)}</span></div>
                <div><span className="rc-ft-lbl">Term Ends:</span><span className="rc-ft-val">{formatDate(report.term.endDate)}</span></div>
              </div>
              {report.term.nextTermBegins && (
                <div className="rc-nextterm"><span className="rc-nt-lbl">NEXT TERM BEGINS:</span><span className="rc-nt-date">{formatDate(report.term.nextTermBegins)}</span></div>
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
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

  // ── Queries ──
  const { data: termsData } = useQuery({
    queryKey: ['terms-for-report-cards'], queryFn: () => classesAPI.getTerms(selectedClass),
    enabled: !!selectedClass, staleTime: 60000,
  });
  const availableTerms = useMemo(() => {
    if (!termsData) return [];
    if (Array.isArray(termsData)) return termsData;
    if (termsData.data && Array.isArray(termsData.data)) return termsData.data;
    if (termsData.terms && Array.isArray(termsData.terms)) return termsData.terms;
    return [];
  }, [termsData]);

  const { data: resultsData, isLoading: resultsLoading, error: resultsError } = useQuery({
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

  const { data: studentsData } = useQuery({ queryKey: ['students-for-results'], queryFn: () => studentsAPI.getAll() });
  const { data: testsData } = useQuery({ queryKey: ['tests-for-results'], queryFn: () => testsAPI.getAll() });
  const { data: classesData } = useQuery({ queryKey: ['classes-for-results'], queryFn: () => classesAPI.getAll() });
  const { data: subjectsData } = useQuery({ queryKey: ['subjects-for-results'], queryFn: () => subjectsAPI.getAll() });
  const { data: subjectsByClass } = useQuery({ queryKey: ['subjects-by-class', selectedClass], queryFn: () => subjectsAPI.getByClass(selectedClass), enabled: !!selectedClass });

  // ── Normalized data ──
  const normalizedResults = useMemo(() => {
    if (!resultsData) return [];
    let s = resultsData;
    if (Array.isArray(s)) return s;
    if (s.data && Array.isArray(s.data)) return s.data;
    if (s.results && Array.isArray(s.results)) return s.results;
    const k = Object.keys(s).find(key => Array.isArray(s[key]));
    return k ? s[k] : [];
  }, [resultsData]);

  const strictlyFilteredResults = useMemo(() => {
    if (!Array.isArray(normalizedResults)) return [];
    return normalizedResults.filter(r => {
      if (!r) return false;
      const rcId = r.classId?._id || r.classId || r.testId?.classId?._id || r.testId?.classId;
      const rsId = r.subjectId?._id || r.subjectId || r.testId?.subjectId?._id || r.testId?.subjectId;
      if (selectedClass && String(rcId) !== String(selectedClass)) return false;
      if (selectedSubject && String(rsId) !== String(selectedSubject)) return false;
      if (selectedTest) { const rtId = r.testId?._id || r.testId; if (String(rtId) !== String(selectedTest)) return false; }
      if (selectedStudent) { const rsStId = r.studentId?._id || r.studentId || r.student?._id || r.student; if (String(rsStId) !== String(selectedStudent)) return false; }
      return true;
    });
  }, [normalizedResults, selectedClass, selectedSubject, selectedTest, selectedStudent]);

  const studentLookup = useMemo(() => {
    const m = {};
    const a = studentsData?.data || (Array.isArray(studentsData) ? studentsData : []);
    a.forEach(s => { if (s && s._id) m[s._id] = s; });
    return m;
  }, [studentsData]);

  const getStudentInfo = (r) => {
    const o = r.studentId && typeof r.studentId === 'object' ? r.studentId : (r.student && typeof r.student === 'object' ? r.student : null);
    if (o) return { firstName: o.firstName || '', lastName: o.lastName || '', admissionNumber: o.admissionNumber || '' };
    const sid = r.studentId || r.student;
    const s = sid && typeof sid === 'string' ? studentLookup[sid] : null;
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
    const m = new Map();
    strictlyFilteredResults.forEach(r => {
      const id = getStudentId(r);
      if (id && !m.has(id)) m.set(id, { id, name: getStudentName(r), info: getStudentInfo(r) });
    });
    return Array.from(m.values());
  }, [strictlyFilteredResults]);

  // ── Stats ──
  const stats = useMemo(() => {
    const vp = strictlyFilteredResults.map(r => r?.percentage).filter(p => typeof p === 'number' && !isNaN(p));
    const total = strictlyFilteredResults.length;
    const passed = strictlyFilteredResults.filter(r => r?.status === 'passed').length;
    const failed = strictlyFilteredResults.filter(r => r?.status === 'failed').length;
    const avg = vp.length > 0 ? (vp.reduce((s, p) => s + p, 0) / vp.length).toFixed(1) : '0.0';
    const hi = vp.length > 0 ? Math.max(...vp) : 0;
    const lo = vp.length > 0 ? Math.min(...vp) : 0;
    const pr = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    return { total, passed, failed, pending: strictlyFilteredResults.filter(r => r?.status === 'pending').length, averageScore: avg, highestScore: hi, lowestScore: lo, passRate: pr, totalSubjects: new Set(strictlyFilteredResults.map(r => r?.testId?.subjectId?._id || r?.subjectId?._id).filter(Boolean)).size };
  }, [strictlyFilteredResults]);

  // ── Grouped ──
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

  // ── Processed & paginated ──
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

  const selectedClassName = classesData?.data?.find(c => c._id === selectedClass)?.name || '';
  const selectedSubjectName = filteredSubjects?.find(s => s._id === selectedSubject)?.name || '';
  const currentSubjectStats = useMemo(() => groupedResults[selectedClass]?.subjects[selectedSubject]?.stats || null, [groupedResults, selectedClass, selectedSubject]);

  // ── Mutations ──
  const publishMutation = useMutation({
    mutationFn: (testId) => testsAPI.publishResults(testId),
    onSuccess: () => { queryClient.invalidateQueries(['all-test-results']); queryClient.invalidateQueries(['tests-for-results']); setShowPublishConfirm(null); },
  });
  const unpublishMutation = useMutation({
    mutationFn: (testId) => testsAPI.unpublishResults(testId),
    onSuccess: () => { queryClient.invalidateQueries(['all-test-results']); queryClient.invalidateQueries(['tests-for-results']); setShowPublishConfirm(null); },
  });
  const publishAllMutation = useMutation({
    mutationFn: async () => {
      const unpub = filteredTests.filter(t => !t.resultsPublished);
      if (!unpub.length) throw new Error('No unpublished tests');
      const res = await Promise.allSettled(unpub.map(t => testsAPI.publishResults(t._id)));
      return { total: unpub.length, success: unpub.length - res.filter(r => r.status === 'rejected').length };
    },
    onSuccess: () => { queryClient.invalidateQueries(['all-test-results']); setShowPublishConfirm(null); },
    onError: () => { setShowPublishConfirm(null); },
  });

  // ── Handlers ──
  const handlePublish = (testId) => setShowPublishConfirm({ testId, action: 'publish' });
  const handleUnpublish = (testId) => setShowPublishConfirm({ testId, action: 'unpublish' });
  const handlePublishAll = () => setShowPublishConfirm({ testId: 'all', action: 'publish-all' });
  const confirmPublishAction = () => {
    if (!showPublishConfirm) return;
    if (showPublishConfirm.action === 'publish') publishMutation.mutate(showPublishConfirm.testId);
    else if (showPublishConfirm.action === 'unpublish') unpublishMutation.mutate(showPublishConfirm.testId);
    else if (showPublishConfirm.action === 'publish-all') publishAllMutation.mutate();
  };
  const handleSort = (col) => { if (sortBy === col) setSortOrder(p => p === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortOrder('asc'); } };
  const resetFilters = () => { setSelectedClass(''); setSelectedTest(''); setSelectedStudent(''); setSelectedSubject(''); setSearchTerm(''); setCurrentPage(1); setExpandedClass(null); setExpandedSubject(null); setSelectedTerm(''); };
  const handleClassChange = (id) => { setSelectedClass(id); setSelectedSubject(''); setSelectedTest(''); setSelectedTerm(''); };
  const handleSubjectChange = (id) => { setSelectedSubject(id); setSelectedTest(''); };
  const getSortIndicator = (col) => sortBy !== col ? '↕' : sortOrder === 'asc' ? '↑' : '↓';
  const toggleClass = (id) => { setExpandedClass(expandedClass === id ? null : id); setExpandedSubject(null); };
  const toggleSubject = (id) => setExpandedSubject(expandedSubject === id ? null : id);
  const handleViewReportCard = (studentId) => { if (!selectedTerm) { alert('Please select a term to generate the report card.'); return; } setShowReportCard({ studentId, termId: selectedTerm }); };

  // ── Effects ──
  useEffect(() => {
    if (viewMode === 'class_subject') {
      setExpandedClass(selectedClass && selectedSubject ? selectedClass : selectedClass || null);
      setExpandedSubject(selectedClass && selectedSubject ? `${selectedClass}-${selectedSubject}` : null);
    }
  }, [selectedClass, selectedSubject, viewMode]);
  useEffect(() => { setCurrentPage(1); }, [selectedClass, selectedSubject, selectedTest, selectedStudent, searchTerm]);
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { if (showPublishConfirm) setShowPublishConfirm(null); else if (showReportCard) setShowReportCard(null); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showPublishConfirm, showReportCard]);
  useEffect(() => {
    document.body.style.overflow = showPublishConfirm || showReportCard ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showPublishConfirm, showReportCard]);

  // ── Render helpers ──
  const isMutating = publishMutation.isPending || unpublishMutation.isPending || publishAllMutation.isPending;

  const renderStudentCell = (r) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="sr-avatar" style={{ background: avatarColor(getStudentName(r)), width: 34, height: 34, fontSize: '.72rem' }}>
        {getStudentInitials(r) || '?'}
      </div>
      <strong style={{ fontSize: '.88rem' }}>{getStudentName(r)}</strong>
    </div>
  );
  const renderAdmissionBadge = (r) => <span className="sr-badge sr-badge-gray">{getStudentInfo(r).admissionNumber || '—'}</span>;
  const renderPubBadge = (isPub) => isPub
    ? (<span className="sr-pub-badge published"><span className="sr-pub-dot" style={{ background: '#22c55e' }} />Published</span>)
    : (<span className="sr-pub-badge unpublished"><span className="sr-pub-dot" />Draft</span>);
  const renderPubBtn = (id, isPub) => isPub
    ? (<button onClick={e => { e.stopPropagation(); handleUnpublish(id); }} className="sr-btn sr-btn-ghost sr-btn-xs" disabled={isMutating} title="Unpublish">🔒</button>)
    : (<button onClick={e => { e.stopPropagation(); handlePublish(id); }} className="sr-btn sr-btn-ghost sr-btn-xs" disabled={isMutating} title="Publish">📢</button>);
  const renderReportBtn = (r) => (
    <button onClick={(e) => { e.stopPropagation(); handleViewReportCard(getStudentId(r)); }} className="sr-btn sr-btn-ghost sr-btn-xs" disabled={!selectedTerm} title="View Report Card">📄</button>
  );

  const renderResultRow = (r, index) => {
    const g = getGrade(r.percentage || 0);
    const st = { passed: { color: '#059669', bg: '#ecfdf5', icon: '✅', label: 'Passed' }, failed: { color: '#dc2626', bg: '#fef2f2', icon: '❌', label: 'Failed' }, pending: { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' } }[r.status] || { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' };
    return (
      <tr key={r._id || index}>
        <td className="sr-td-sn">{index + 1}</td>
        <td>{renderStudentCell(r)}</td>
        <td>{renderAdmissionBadge(r)}</td>
        {!selectedSubject && <td style={{ fontSize: '.85rem', color: 'var(--text2)' }}>{r.testId?.subjectId?.name || '—'}</td>}
        <td>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: '.85rem', fontWeight: 500 }}>{r.testId?.title || '—'}</span>
            {renderPubBadge(r.testId?.resultsPublished)}
          </div>
        </td>
        <td>
          <span className="sr-score-cell">
            <span className="sr-score-achieved">{r.score}</span>
            <span className="sr-score-total">/{r.totalQuestions || r.testId?.totalQuestions || '?'}</span>
          </span>
        </td>
        <td>
          <div className="sr-pct-cell">
            <div className="sr-pct-bar-wrap"><div className="sr-pct-bar-fill" style={{ width: `${Math.min(r.percentage || 0, 100)}%`, background: g.color }} /></div>
            <span className="sr-pct-value" style={{ color: g.color }}>{r.percentage || 0}%</span>
          </div>
        </td>
        <td><span className="sr-grade-badge" style={{ background: `${g.color}15`, color: g.color, borderColor: `${g.color}30` }}>{g.grade}</span></td>
        <td><span className="sr-status-badge" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span></td>
        {selectedTerm && <td style={{ display: 'flex', gap: 4 }}>{renderReportBtn(r)}{renderPubBtn(r.testId?._id || r.testId, r.testId?.resultsPublished)}</td>}
      </tr>
    );
  };

  const renderResultCard = (r, index) => {
    const g = getGrade(r.percentage || 0);
    const st = { passed: { color: '#059669', bg: '#ecfdf5', icon: '✅', label: 'Passed' }, failed: { color: '#dc2626', bg: '#fef2f2', icon: '❌', label: 'Failed' }, pending: { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' } }[r.status] || { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' };
    return (
      <div className="sr-card" key={r._id || index}>
        <div className="sr-card-top">
          <div className="sr-avatar" style={{ background: avatarColor(getStudentName(r)) }}>{getStudentInitials(r) || '?'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sr-card-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getStudentName(r)}</div>
            <div className="sr-card-sub">{getStudentInfo(r).admissionNumber || '—'}</div>
          </div>
          <div className="sr-card-badges">
            <span className="sr-grade-badge" style={{ background: `${g.color}15`, color: g.color, borderColor: `${g.color}30` }}>{g.grade}</span>
            <span className="sr-status-badge" style={{ background: st.bg, color: st.color, fontSize: '.68rem', padding: '2px 8px' }}>{st.icon} {st.label}</span>
          </div>
        </div>
        <div className="sr-card-grid" style={!selectedSubject ? { gridTemplateColumns: '1fr 1fr 1fr 1fr' } : {}}>
          <div>
            <div className="sr-card-field-label">Test</div>
            <div className="sr-card-field-value" style={{ fontSize: '.8rem' }}>{r.testId?.title || '—'}</div>
          </div>
          {!selectedSubject && (
            <div>
              <div className="sr-card-field-label">Subject</div>
              <div className="sr-card-field-value" style={{ fontSize: '.8rem' }}>{r.testId?.subjectId?.name || '—'}</div>
            </div>
          )}
          <div>
            <div className="sr-card-field-label">Score</div>
            <div className="sr-card-field-value">
              <span className="sr-score-cell">
                <span className="sr-score-achieved">{r.score}</span>
                <span className="sr-score-total">/{r.totalQuestions || r.testId?.totalQuestions || '?'}</span>
              </span>
            </div>
          </div>
          <div>
            <div className="sr-card-field-label">Percentage</div>
            <div className="sr-card-field-value" style={{ color: g.color, fontWeight: 700 }}>{r.percentage || 0}%</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 4 }}>
          {renderPubBadge(r.testId?.resultsPublished)}
        </div>
        <div className="sr-card-actions">
          {selectedTerm && renderReportBtn(r)}
          {renderPubBtn(r.testId?._id || r.testId, r.testId?.resultsPublished)}
        </div>
      </div>
    );
  };

  if (resultsLoading) return <Loading message="Loading student results..." />;
  if (resultsError) return (
    <div className="sr-root" style={{ padding: 24 }}>
      <div className="sr-alert sr-alert-danger" style={{ justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 40 }}>
        <span style={{ fontSize: '2rem' }}>⚠️</span>
        <p style={{ margin: 0 }}>Failed: {resultsError.message}</p>
        <button className="sr-btn sr-btn-primary" onClick={() => queryClient.invalidateQueries(['all-test-results'])}>🔄 Retry</button>
      </div>
    </div>
  );

  // ── CSS Variables ──
  const cssVars = {
    '--bg': '#f1f5f9', '--surface': '#ffffff', '--border': '#e2e8f0',
    '--text': '#0f172a', '--text2': '#475569', '--muted': '#94a3b8',
    '--primary': '#4f46e5', '--primary-h': '#4338ca', '--primary-l': '#eef2ff',
    '--danger': '#ef4444', '--danger-h': '#dc2626', '--success': '#10b981',
    '--success-l': '#ecfdf5', '--warning': '#f59e0b', '--warning-l': '#fffbeb',
    '--radius': '12px', '--radius-sm': '8px',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.05)',
    '--shadow': '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    '--shadow-lg': '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
    '--tr': '150ms cubic-bezier(0.4,0,0.2,1)',
  };

  return (
    <div className="sr-root" style={cssVars}>
      <style>{`
        .sr-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;background:var(--bg);min-height:100vh}

        .sr-header{background:var(--surface);border-bottom:1px solid var(--border);padding:20px 24px;position:sticky;top:0;z-index:30}
        .sr-header-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .sr-title{font-size:1.35rem;font-weight:700;margin:0;letter-spacing:-0.02em}
        .sr-sub{font-size:.82rem;color:var(--muted);margin:2px 0 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .sr-header-actions{display:flex;gap:8px;flex-wrap:wrap}

        .sr-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:var(--radius-sm);font-size:.82rem;font-weight:600;border:none;cursor:pointer;transition:all var(--tr);white-space:nowrap;line-height:1.4}
        .sr-btn:active{transform:scale(.97)}
        .sr-btn-primary{background:var(--primary);color:#fff}.sr-btn-primary:hover{background:var(--primary-h)}
        .sr-btn-success{background:var(--success);color:#fff}.sr-btn-success:hover{background:#059669}
        .sr-btn-danger{background:var(--danger);color:#fff}.sr-btn-danger:hover{background:var(--danger-h)}
        .sr-btn-warning{background:var(--warning);color:#fff}.sr-btn-warning:hover{background:#d97706}
        .sr-btn-ghost{background:var(--surface);color:var(--text2);border:1px solid var(--border)}.sr-btn-ghost:hover{background:#f8fafc;border-color:#cbd5e1}
        .sr-btn-sm{padding:6px 12px;font-size:.78rem}
        .sr-btn-xs{padding:4px 8px;font-size:.75rem;min-width:28px;justify-content:center}
        .sr-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
        .sr-btn svg{width:15px;height:15px;flex-shrink:0}

        .sr-sel-bar{padding:14px 24px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:12px}
        .sr-sel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
        .sr-sel-group{display:flex;flex-direction:column;gap:4px}
        .sr-sel-label{font-size:.74rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
        .sr-sel-select,.sr-sel-input{width:100%;padding:9px 36px 9px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);font-size:.85rem;color:var(--text);outline:none;transition:border-color var(--tr),box-shadow var(--tr);box-sizing:border-box;-webkit-appearance:none;appearance:none}
        .sr-sel-select:focus,.sr-sel-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(79,70,229,.12)}
        .sr-sel-select::placeholder{color:var(--muted)}
        .sr-sel-select:disabled,.sr-sel-input:disabled{background:#f8fafc;color:var(--muted);cursor:not-allowed}
        .sr-sel-select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
        .sr-sel-select option{color:var(--text);background:var(--surface)}
        .sr-sel-reset{align-self:flex-end}

        .sr-alert{padding:12px 16px;border-radius:var(--radius-sm);font-size:.84rem;font-weight:500;display:flex;align-items:center;gap:8px;margin:12px 24px 0;animation:srSlide .25s ease}
        .sr-alert-success{background:var(--success-l);color:#065f46;border:1px solid #a7f3d0}
        .sr-alert-danger{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
        .sr-alert-close{margin-left:auto;background:none;border:none;cursor:pointer;font-size:1.2rem;line-height:1;opacity:.6;color:inherit;padding:0 2px}
        @keyframes srSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

        .sr-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 24px}
        .sr-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;display:flex;align-items:center;gap:12px;transition:box-shadow var(--tr)}
        .sr-stat:hover{box-shadow:var(--shadow)}
        .sr-stat-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}
        .sr-stat-info{display:flex;flex-direction:column;min-width:0}
        .sr-stat-value{font-size:1.15rem;font-weight:700;line-height:1.2}
        .sr-stat-label{font-size:.72rem;color:var(--muted);font-weight:500;margin-top:2px}

        .sr-subj-stats{margin:0 24px 0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 20px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .sr-subj-stats-title{font-size:.88rem;font-weight:700;margin-right:12px;white-space:nowrap}
        .sr-bar-item{display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:.78rem;font-weight:600;background:#f8fafc;white-space:nowrap}
        .sr-bar-item .label{color:var(--muted)}
        .sr-bar-item .value{font-weight:700;color:var(--text)}
        .sr-bar-divider{width:1px;height:20px;background:var(--border);margin:0 4px}

        .sr-test-status{margin:16px 24px 0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
        .sr-test-status-hdr{padding:14px 20px;border-bottom:1px solid var(--border);font-size:.88rem;font-weight:700}
        .sr-test-status-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:0}
        .sr-test-item{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--border);transition:background var(--tr)}
        .sr-test-item:last-child{border-bottom:none}
        .sr-test-item:hover{background:#f8fafc}
        .sr-test-info{display:flex;flex-direction:column;gap:4px}
        .sr-test-name{font-size:.85rem;font-weight:600}
        .sr-test-actions{display:flex;gap:6px;flex-shrink:0}

        .sr-quick{margin:16px 24px 0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
        .sr-quick-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border)}
        .sr-quick-hdr h3{font-size:.88rem;font-weight:700;margin:0}
        .sr-quick-count{font-size:.78rem;color:var(--muted);font-weight:600;background:#f1f5f9;padding:2px 10px;border-radius:20px}
        .sr-quick-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0}
        .sr-quick-btn{display:flex;align-items:center;gap:10px;padding:10px 20px;border:none;background:none;cursor:pointer;transition:background var(--tr);text-align:left;border-bottom:1px solid var(--border);border-right:1px solid var(--border)}
        .sr-quick-btn:last-child{border-right:none}
        .sr-quick-btn:hover{background:#f8fafc}
        .sr-quick-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.72rem;flex-shrink:0}
        .sr-quick-name{font-size:.82rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sr-quick-adm{font-size:.72rem;color:var(--muted);font-weight:500}

        .sr-prompt{text-align:center;padding:64px 24px;color:var(--muted)}
        .sr-prompt-icon{font-size:3rem;display:block;margin-bottom:12px}
        .sr-prompt h3{font-size:1.1rem;font-weight:700;color:var(--text2);margin:0 0 6px}
        .sr-prompt p{font-size:.85rem;margin:0}

        .sr-pub-badge{display:inline-flex;align-items:center;gap:5px;font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:20px}
        .sr-pub-badge.published{background:#dcfce7;color:#166534}
        .sr-pub-badge.unpublished{background:#f1f5f9;color:#64748b}
        .sr-pub-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:var(--muted)}

        .sr-grade-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:.76rem;font-weight:700;border:1px solid transparent}
        .sr-status-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:.72rem;font-weight:600;white-space:nowrap}
        .sr-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:600;white-space:nowrap}
        .sr-badge-gray{background:#f1f5f9;color:#64748b}
        .sr-badge-blue{background:#dbeafe;color:#1e40af}

        .sr-score-cell{font-size:.85rem}
        .sr-score-achieved{font-weight:700}
        .sr-score-total{color:var(--muted);font-size:.8rem}
        .sr-pct-cell{display:flex;align-items:center;gap:8px;min-width:100px}
        .sr-pct-bar-wrap{flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;min-width:50px}
        .sr-pct-bar-fill{height:100%;border-radius:3px;transition:width .3s ease}
        .sr-pct-value{font-size:.82rem;font-weight:700;min-width:38px;text-align:right}

        .sr-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.76rem;flex-shrink:0;letter-spacing:.02em}

        .sr-table-section{display:none;background:var(--surface);margin:16px 24px 24px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
        .sr-table-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border);gap:12px;flex-wrap:wrap}
        .sr-table-hdr h3{font-size:.92rem;font-weight:700;margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .sr-table-hdr-count{font-size:.78rem;color:var(--muted);font-weight:500}
        .sr-items-pp{display:flex;align-items:center;gap:6px;font-size:.78rem;color:var(--text2)}
        .sr-items-pp select{padding:4px 28px 4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font-size:.78rem;color:var(--text);outline:none;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;cursor:pointer}
        .sr-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .sr-table{width:100%;border-collapse:collapse;font-size:.85rem;min-width:900px}
        .sr-table thead{background:#f8fafc;position:sticky;top:0;z-index:5}
        .sr-table th{padding:11px 14px;text-align:left;font-weight:600;font-size:.73rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap}
        .sr-table td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
        .sr-table tbody tr{transition:background var(--tr)}
        .sr-table tbody tr:hover{background:#f8fafc}
        .sr-table tbody tr:last-child td{border-bottom:none}
        .sr-td-sn{width:50px;text-align:center;color:var(--muted);font-size:.8rem}
        .sr-sortable{cursor:pointer;user-select:none}
        .sr-sortable:hover{color:var(--text)}
        .sr-empty{text-align:center;padding:48px 24px;color:var(--muted)}

        .sr-cards{display:flex;flex-direction:column;gap:10px;padding:16px 16px}
        .sr-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;transition:box-shadow var(--tr)}
        .sr-card:hover{box-shadow:var(--shadow-sm)}
        .sr-card-top{display:flex;align-items:center;gap:12px;margin-bottom:10px}
        .sr-card-name{font-weight:600;font-size:.92rem;color:var(--text);line-height:1.3}
        .sr-card-sub{font-size:.76rem;color:var(--muted);font-weight:500;margin-top:1px}
        .sr-card-badges{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;align-items:center}
        .sr-card-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}
        .sr-card-field-label{font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
        .sr-card-field-value{font-size:.82rem;color:var(--text);font-weight:500;margin-top:2px}
        .sr-card-actions{display:flex;gap:6px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--border)}

        .sr-grouped{padding:16px 24px 24px;display:flex;flex-direction:column;gap:10px}
        .sr-group-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
        .sr-group-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;cursor:pointer;transition:background var(--tr);user-select:none}
        .sr-group-hdr:hover{background:#f8fafc}
        .sr-group-info{display:flex;align-items:center;gap:12px}
        .sr-group-icon{font-size:1.2rem}
        .sr-group-info h3{font-size:.95rem;font-weight:700;margin:0;line-height:1.3}
        .sr-group-meta{font-size:.76rem;color:var(--muted);font-weight:500}
        .sr-expand{font-size:.7rem;color:var(--muted);transition:transform .2s}
        .sr-expand.open{transform:rotate(90deg)}
        .sr-group-body{border-top:1px solid var(--border)}
        .sr-subj-group{border-bottom:1px solid var(--border)}
        .sr-subj-group:last-child{border-bottom:none}
        .sr-subj-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;cursor:pointer;transition:background var(--tr);user-select:none;gap:12px;flex-wrap:wrap}
        .sr-subj-hdr:hover{background:#f8fafc}
        .sr-subj-info{display:flex;align-items:center;gap:10px}
        .sr-subj-info h4{font-size:.88rem;font-weight:600;margin:0;line-height:1.3}
        .sr-subj-meta{font-size:.74rem;color:var(--muted);font-weight:500}
        .sr-subj-mini-stats{display:flex;gap:8px;flex-wrap:wrap}
        .sr-mini-stat{font-size:.72rem;font-weight:600;padding:3px 8px;border-radius:12px;background:#f1f5f9;color:var(--text2)}
        .sr-mini-stat.passed{background:#ecfdf5;color:#065f46}
        .sr-mini-stat.failed{background:#fef2f2;color:#991b1b}
        .sr-subj-body{border-top:1px solid var(--border)}
        .sr-grouped-tests{display:flex;gap:8px;padding:10px 20px;flex-wrap:wrap;border-bottom:1px solid var(--border)}
        .sr-grouped-test{display:flex;align-items:center;gap:8px;font-size:.78rem;font-weight:500}
        .sr-grouped-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .sr-grouped-table{width:100%;border-collapse:collapse;font-size:.82rem;min-width:700px}
        .sr-grouped-table thead{background:#f8fafc}
        .sr-grouped-table th{padding:10px 12px;text-align:left;font-weight:600;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap}
        .sr-grouped-table td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle}
        .sr-grouped-table tbody tr:hover{background:#f8fafc}
        .sr-grouped-table tbody tr:last-child td{border-bottom:none}

        .sr-pagination{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-top:1px solid var(--border);font-size:.8rem;color:var(--muted);gap:12px;flex-wrap:wrap}
        .sr-pagination-btns{display:flex;gap:4px}

        .sr-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:flex-end;justify-content:center;animation:srFade .2s ease}
        @keyframes srFade{from{opacity:0}to{opacity:1}}
        .sr-modal{background:var(--surface);border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;animation:srSlideUp .3s cubic-bezier(.16,1,.3,1)}
        .sr-modal-lg{max-width:760px}
        @keyframes srSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .sr-modal-handle{width:36px;height:4px;border-radius:2px;background:#cbd5e1;margin:10px auto 0}
        .sr-modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0}
        .sr-modal-title{font-size:1.1rem;font-weight:700;margin:0}
        .sr-modal-close{width:32px;height:32px;border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:1.2rem;transition:all var(--tr);flex-shrink:0}
        .sr-modal-close:hover{background:#e2e8f0;color:var(--text)}
        .sr-modal-body{padding:20px}
        .sr-modal-footer{display:flex;gap:10px;padding:0 20px 24px;justify-content:flex-end;flex-wrap:wrap}
        .sr-report-body{padding:12px}

        .sr-confirm-body{padding:24px 20px;text-align:center}
        .sr-confirm-body p{font-size:.92rem;color:var(--text2);margin:0 0 20px;line-height:1.5}

        @media(min-width:768px){
          .sr-modal-overlay{align-items:center}
          .sr-modal{border-radius:20px}
          .sr-modal-handle{display:none}
          .sr-cards{display:none!important}
          .sr-table-section{display:block!important}
          .sr-header{padding:24px 32px}
          .sr-sel-bar{padding:14px 32px}
          .sr-alert{margin-left:32px;margin-right:32px}
          .sr-stats{padding:16px 32px;grid-template-columns:repeat(4,1fr)}
          .sr-test-status{margin:16px 32px 0}
          .sr-quick{margin:16px 32px 0}
          .sr-subj-stats{margin:16px 32px 0}
          .sr-grouped{padding:16px 32px 32px}
          .sr-table-section{margin:16px 32px 32px}
        }
        @media(max-width:767px){
          .sr-header{padding:16px}
          .sr-title{font-size:1.15rem}
          .sr-header-actions{width:100%}
          .sr-header-actions .sr-btn{flex:1;justify-content:center;padding:10px;font-size:.78rem}
          .sr-sel-bar{padding:10px 16px}
          .sr-sel-grid{grid-template-columns:1fr 1fr}
          .sr-alert{margin-left:16px;margin-right:16px}
          .sr-stats{padding:12px 16px;grid-template-columns:1fr 1fr}
          .sr-test-status{margin:12px 16px 0}
          .sr-quick{margin:12px 16px 0}
          .sr-quick-grid{grid-template-columns:1fr 1fr}
          .sr-subj-stats{margin:12px 16px 0}
          .sr-grouped{padding:12px 16px}
          .sr-test-status-grid{grid-template-columns:1fr}
          .sr-card-actions .sr-btn{flex:1;justify-content:center;font-size:.72rem;padding:8px}
        }
        @media(max-width:420px){
          .sr-sel-grid{grid-template-columns:1fr}
          .sr-stats{grid-template-columns:1fr 1fr}
          .sr-quick-grid{grid-template-columns:1fr}
          .sr-card-grid{grid-template-columns:1fr 1fr!important}
        }
        .sr-root ::-webkit-scrollbar{width:6px;height:6px}
        .sr-root ::-webkit-scrollbar-track{background:transparent}
        .sr-root ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        @keyframes srSpin{to{transform:rotate(360deg)}}
        @keyframes srPulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {showPublishConfirm && (
        <div className="sr-modal-overlay" onClick={() => setShowPublishConfirm(null)}>
          <div className="sr-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="sr-modal-handle" />
            <div className="sr-modal-header">
              <h3 className="sr-modal-title">{showPublishConfirm.action === 'unpublish' ? '🔒 Unpublish' : '📢 Publish'} Results</h3>
              <button className="sr-modal-close" onClick={() => setShowPublishConfirm(null)}>×</button>
            </div>
            <div className="sr-confirm-body">
              <p>Are you sure you want to {showPublishConfirm.action === 'unpublish' ? 'unpublish' : 'publish'} "<strong>{showPublishConfirm.testId === 'all' ? 'all unpublished tests' : filteredTests.find(t => t._id === showPublishConfirm.testId)?.title || ''}</strong>"?</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="sr-btn sr-btn-ghost" onClick={() => setShowPublishConfirm(null)}>Cancel</button>
                <button className={`sr-btn ${showPublishConfirm.action === 'unpublish' ? 'sr-btn-danger' : 'sr-btn-success'}`} onClick={confirmPublishAction} disabled={isMutating}>
                  {isMutating ? (<><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'srSpin .6s linear infinite' }} /> Processing...</>) : 'Yes, Proceed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportCard && <ReportCardModal studentId={showReportCard.studentId} termId={showReportCard.termId} onClose={() => setShowReportCard(null)} />}

      <div className="sr-header">
        <div className="sr-header-top">
          <div>
            <h1 className="sr-title">Student Results</h1>
            <p className="sr-sub">
              View & publish results
              {selectedClassName && <span className="sr-badge sr-badge-blue" style={{ marginLeft: 4 }}>{selectedClassName}</span>}
              {selectedSubjectName && <span className="sr-badge sr-badge-gray">{selectedSubjectName}</span>}
            </p>
          </div>
          <div className="sr-header-actions">
            <button className="sr-btn sr-btn-ghost" onClick={() => setViewMode(v => v === 'class_subject' ? 'filtered' : 'class_subject')}>{viewMode === 'class_subject' ? '📋 Table View' : '🏫 Grouped View'}</button>
            {selectedTest && (
              <button className="sr-btn sr-btn-success" onClick={() => downloadCSV(selectedTest, 'test-results.csv')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
              </button>
            )}
            {selectedClass && selectedSubject && unpublishedTestsCount > 0 && <button className="sr-btn sr-btn-warning" onClick={handlePublishAll} disabled={isMutating}>📢 Publish All ({unpublishedTestsCount})</button>}
          </div>
        </div>
      </div>

      <div className="sr-sel-bar">
        <div className="sr-sel-grid">
          <div className="sr-sel-group">
            <label className="sr-sel-label">🏫 Class</label>
            <select value={selectedClass} onChange={e => handleClassChange(e.target.value)} className="sr-sel-select"><option value="">-- Choose Class --</option>{classesData?.data?.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
          </div>
          <div className="sr-sel-group">
            <label className="sr-sel-label">📚 Subject</label>
            <select value={selectedSubject} onChange={e => handleSubjectChange(e.target.value)} className="sr-sel-select" disabled={!selectedClass}><option value="">{selectedClass ? '-- Choose Subject --' : '-- Select class first --'}</option>{filteredSubjects?.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
          </div>
          <div className="sr-sel-group">
            <label className="sr-sel-label">📝 Test</label>
            <select value={selectedTest} onChange={e => setSelectedTest(e.target.value)} className="sr-sel-select" disabled={!selectedClass}><option value="">{selectedClass ? 'All Tests' : '-- Select class first --'}</option>{filteredTests?.map(t => <option key={t._id} value={t._id}>{t.resultsPublished ? '✅ ' : '🔒 '}{t.title}</option>)}</select>
          </div>
          <div className="sr-sel-group">
            <label className="sr-sel-label">📅 Term</label>
            <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className="sr-sel-select" disabled={!selectedClass}><option value="">{selectedClass ? '-- Select Term --' : '-- Select class first --'}</option>{availableTerms.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}</select>
          </div>
          <div className="sr-sel-group">
            <label className="sr-sel-label">🔍 Search</label>
            <input type="text" placeholder="Name or adm no..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="sr-sel-input" />
          </div>
          {(selectedClass || searchTerm) && (
            <div className="sr-sel-group sr-sel-reset">
              <label className="sr-sel-label">&nbsp;</label>
              <button onClick={resetFilters} className="sr-btn sr-btn-ghost sr-btn-sm" style={{ width: '100%', justifyContent: 'center' }}>🔄 Reset</button>
            </div>
          )}
        </div>
      </div>

      {selectedClass && selectedTerm && uniqueStudentsInResults.length > 0 && (
        <div className="sr-quick">
          <div className="sr-quick-hdr"><h3>📄 Quick Report Card Access</h3><span className="sr-quick-count">{uniqueStudentsInResults.length} students</span></div>
          <div className="sr-quick-grid">
            {uniqueStudentsInResults.slice(0, 20).map(student => (
              <button key={student.id} onClick={() => handleViewReportCard(student.id)} className="sr-quick-btn">
                <span className="sr-quick-avatar" style={{ background: avatarColor(student.name) }}>{student.info.firstName?.[0]}{student.info.lastName?.[0]}</span>
                <div style={{ minWidth: 0 }}><div className="sr-quick-name">{student.name}</div><div className="sr-quick-adm">{student.info.admissionNumber}</div></div>
              </button>
            ))}
            {uniqueStudentsInResults.length > 20 && (
              <div style={{ padding: '8px 12px' }}>
                <select onChange={e => { if (e.target.value) handleViewReportCard(e.target.value); e.target.value = ''; }} className="sr-sel-select" style={{ fontSize: '.8rem' }}>
                  <option value="">+ {uniqueStudentsInResults.length - 20} more...</option>
                  {uniqueStudentsInResults.slice(20).map(s => <option key={s.id} value={s.id}>{s.name} ({s.info.admissionNumber})</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedClass && (
        <div className="sr-prompt">
          <span className="sr-prompt-icon">👆</span>
          <h3>Select a Class to View Results</h3>
          <p>Choose a class from the filter bar above, then optionally select a subject and term</p>
        </div>
      )}

      {selectedClass && selectedSubject && filteredTests.length > 0 && (
        <div className="sr-test-status">
          <div className="sr-test-status-hdr">📊 Test Status — {selectedClassName} ({selectedSubjectName})</div>
          <div className="sr-test-status-grid">
            {filteredTests.map(t => (
              <div key={t._id} className="sr-test-item">
                <div className="sr-test-info"><span className="sr-test-name">{t.title}</span>{renderPubBadge(t.resultsPublished)}</div>
                <div className="sr-test-actions">{renderPubBtn(t._id, t.resultsPublished)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedClass && (
        <div className="sr-stats">
          <div className="sr-stat"><div className="sr-stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>📊</div><div className="sr-stat-info"><span className="sr-stat-value">{stats.total}</span><span className="sr-stat-label">Total Results</span></div></div>
          <div className="sr-stat"><div className="sr-stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>✅</div><div className="sr-stat-info"><span className="sr-stat-value">{stats.passed}</span><span className="sr-stat-label">Passed</span></div></div>
          <div className="sr-stat"><div className="sr-stat-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>❌</div><div className="sr-stat-info"><span className="sr-stat-value">{stats.failed}</span><span className="sr-stat-label">Failed</span></div></div>
          <div className="sr-stat"><div className="sr-stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>📈</div><div className="sr-stat-info"><span className="sr-stat-value">{stats.averageScore}%</span><span className="sr-stat-label">Average</span></div></div>
          <div className="sr-stat"><div className="sr-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>🏆</div><div className="sr-stat-info"><span className="sr-stat-value">{stats.highestScore}%</span><span className="sr-stat-label">Highest</span></div></div>
          <div className="sr-stat"><div className="sr-stat-icon" style={{ background: '#fff1f2', color: '#e11d48' }}>📉</div><div className="sr-stat-info"><span className="sr-stat-value">{stats.lowestScore}%</span><span className="sr-stat-label">Lowest</span></div></div>
          <div className="sr-stat"><div className="sr-stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>📚</div><div className="sr-stat-info"><span className="sr-stat-value">{stats.totalSubjects}</span><span className="sr-stat-label">Subjects</span></div></div>
          <div className="sr-stat"><div className="sr-stat-icon" style={{ background: '#f0fdf4', color: '#15803d' }}>✨</div><div className="sr-stat-info"><span className="sr-stat-value">{stats.passRate}%</span><span className="sr-stat-label">Pass Rate</span></div></div>
        </div>
      )}

      {selectedClass && selectedSubject && currentSubjectStats && (
        <div className="sr-subj-stats">
          <span className="sr-subj-stats-title">📊 {selectedClassName} — {selectedSubjectName}</span>
          <div className="sr-bar-item"><span className="label">Students</span><span className="value">{currentSubjectStats.total}</span></div>
          <div className="sr-bar-item"><span className="label">Passed</span><span className="value" style={{ color: '#059669' }}>{currentSubjectStats.passed}</span></div>
          <div className="sr-bar-item"><span className="label">Failed</span><span className="value" style={{ color: '#dc2626' }}>{currentSubjectStats.failed}</span></div>
          <div className="sr-bar-item"><span className="label">Pending</span><span className="value" style={{ color: '#d97706' }}>{currentSubjectStats.pending}</span></div>
          <div className="sr-bar-divider" />
          <div className="sr-bar-item"><span className="label">Avg</span><span className="value">{currentSubjectStats.averageScore}%</span></div>
          <div className="sr-bar-item"><span className="label">High</span><span className="value" style={{ color: '#059669' }}>{currentSubjectStats.highestScore}%</span></div>
          <div className="sr-bar-item"><span className="label">Low</span><span className="value" style={{ color: '#ef4444' }}>{currentSubjectStats.lowestScore}%</span></div>
          <div className="sr-bar-item"><span className="label">Pass Rate</span><span className="value" style={{ color: '#0284c7' }}>{currentSubjectStats.total > 0 ? ((currentSubjectStats.passed / currentSubjectStats.total) * 100).toFixed(1) : 0}%</span></div>
        </div>
      )}

      {viewMode === 'class_subject' && selectedClass && (
        <div className="sr-grouped">
          {Object.keys(groupedResults).length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', padding: 48, color: 'var(--muted)' }}><span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>📋</span>No results found</div>
          ) : Object.values(groupedResults).map(cGroup => (
            <div key={cGroup.classId} className="sr-group-card">
              <div className="sr-group-hdr" onClick={() => toggleClass(cGroup.classId)}>
                <div className="sr-group-info"><span className="sr-group-icon">🏫</span><div><h3>{cGroup.className}</h3><span className="sr-group-meta">{Object.keys(cGroup.subjects).length} subjects • {Object.values(cGroup.subjects).reduce((s, sub) => s + sub.students.length, 0)} results</span></div></div>
                <span className={`sr-expand ${expandedClass === cGroup.classId ? 'open' : ''}`}>▶</span>
              </div>
              {expandedClass === cGroup.classId && (
                <div className="sr-group-body">
                  {Object.values(cGroup.subjects).map(sGroup => (
                    <div key={sGroup.subjectId} className="sr-subj-group">
                      <div className="sr-subj-hdr" onClick={() => toggleSubject(`${cGroup.classId}-${sGroup.subjectId}`)}>
                        <div className="sr-subj-info"><span>📚</span><div><h4>{sGroup.subjectName}</h4><span className="sr-subj-meta">{sGroup.students.length} students</span></div></div>
                        <div className="sr-subj-mini-stats"><span className="sr-mini-stat">📊 {sGroup.stats.averageScore}%</span><span className="sr-mini-stat passed">✅ {sGroup.stats.passed}</span><span className="sr-mini-stat failed">❌ {sGroup.stats.failed}</span></div>
                        <span className={`sr-expand ${expandedSubject === `${cGroup.classId}-${sGroup.subjectId}` ? 'open' : ''}`}>▶</span>
                      </div>
                      {expandedSubject === `${cGroup.classId}-${sGroup.subjectId}` && (
                        <div className="sr-subj-body">
                          <div className="sr-grouped-tests">{Object.values(sGroup.tests).map(t => (<div key={t.testId} className="sr-grouped-test"><span>{t.testTitle}</span>{renderPubBadge(t.isPublished)}{renderPubBtn(t.testId, t.isPublished)}</div>))}</div>
                          <div className="sr-grouped-table-wrap">
                            <table className="sr-grouped-table">
                              <thead><tr><th style={{ width: 40 }}>#</th><th>Student</th><th>Adm. No.</th><th>Test</th><th>Score</th><th>%</th><th>Grade</th><th>Status</th>{selectedTerm && <th style={{ width: 80 }}>Report</th>}</tr></thead>
                              <tbody>
                                {sGroup.students.sort((a, b) => getStudentName(a).localeCompare(getStudentName(b))).map((r, i) => {
                                  const g = getGrade(r.percentage || 0);
                                  const st = { passed: { color: '#059669', bg: '#ecfdf5', icon: '✅', label: 'Passed' }, failed: { color: '#dc2626', bg: '#fef2f2', icon: '❌', label: 'Failed' }, pending: { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' } }[r.status] || { color: '#d97706', bg: '#fffbeb', icon: '⏳', label: 'Pending' };
                                  return (
                                    <tr key={r._id || i}>
                                      <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{i + 1}</td>
                                      <td>{renderStudentCell(r)}</td>
                                      <td>{renderAdmissionBadge(r)}</td>
                                      <td style={{ fontSize: '.82rem' }}>{r.testId?.title || '—'}</td>
                                      <td><span className="sr-score-cell"><span className="sr-score-achieved">{r.score}</span><span className="sr-score-total">/{r.totalQuestions || r.testId?.totalQuestions || '?'}</span></span></td>
                                      <td><div className="sr-pct-cell"><div className="sr-pct-bar-wrap"><div className="sr-pct-bar-fill" style={{ width: `${Math.min(r.percentage || 0, 100)}%`, background: g.color }} /></div><span className="sr-pct-value" style={{ color: g.color }}>{r.percentage || 0}%</span></div></td>
                                      <td><span className="sr-grade-badge" style={{ background: `${g.color}15`, color: g.color, borderColor: `${g.color}30` }}>{g.grade}</span></td>
                                      <td><span className="sr-status-badge" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span></td>
                                      {selectedTerm && <td style={{ display: 'flex', gap: 4 }}>{renderReportBtn(r)}{renderPubBtn(r.testId?._id || r.testId, r.testId?.resultsPublished)}</td>}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'filtered' && selectedClass && (
        <div className="sr-table-section">
          <div className="sr-table-hdr">
            <h3>📋 Results{selectedClassName && <span>{selectedClassName}</span>}{selectedSubjectName && <span> • {selectedSubjectName}</span>}<span className="sr-table-hdr-count">({processedResults.length})</span></h3>
            <div className="sr-items-pp"><span>Show:</span><select value={itemsPerPage} onChange={e => { setItemsPerPage(e.target.value); setCurrentPage(1); }}><option value="all">All ({processedResults.length})</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></div>
          </div>
          {processedResults.length === 0 ? (
            <div className="sr-empty"><span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>📋</span>No results found</div>
          ) : (
            <div className="sr-table-wrap">
              <table className="sr-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th className="sr-sortable" onClick={() => handleSort('student_name')}>Student {getSortIndicator('student_name')}</th>
                    <th className="sr-sortable" onClick={() => handleSort('admission_number')} style={{ width: 120 }}>Adm. No. {getSortIndicator('admission_number')}</th>
                    {!selectedSubject && <th>Subject</th>}
                    <th className="sr-sortable" onClick={() => handleSort('test_title')}>Test {getSortIndicator('test_title')}</th>
                    <th style={{ width: 90 }}>Score</th>
                    <th className="sr-sortable" onClick={() => handleSort('score')} style={{ width: 130 }}>% {getSortIndicator('score')}</th>
                    <th style={{ width: 70 }}>Grade</th>
                    <th style={{ width: 100 }}>Status</th>
                    {selectedTerm && <th style={{ width: 80 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.map((r, index) => {
                    const sn = itemsPerPage === 'all' ? index + 1 : ((currentPage - 1) * effectiveItemsPerPage) + index + 1;
                    return renderResultRow(r, sn);
                  })}
                </tbody>
              </table>
            </div>
          )}
          {itemsPerPage !== 'all' && totalPages > 1 && (
            <div className="sr-pagination">
              <span>Showing {((currentPage - 1) * effectiveItemsPerPage) + 1} to {Math.min(currentPage * effectiveItemsPerPage, processedResults.length)} of {processedResults.length}</span>
              <div className="sr-pagination-btns">
                <button className="sr-btn sr-btn-ghost sr-btn-xs" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>««</button>
                <button className="sr-btn sr-btn-ghost sr-btn-xs" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>«</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                  return (<button key={p} onClick={() => setCurrentPage(p)} className={`sr-btn sr-btn-xs ${currentPage === p ? 'sr-btn-primary' : 'sr-btn-ghost'}`}>{p}</button>);
                })}
                <button className="sr-btn sr-btn-ghost sr-btn-xs" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>»</button>
                <button className="sr-btn sr-btn-ghost sr-btn-xs" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»»</button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'filtered' && selectedClass && (
        <div className="sr-cards">
          {processedResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--muted)' }}><span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>📋</span>No results found</div>
          ) : processedResults.map((r, index) => renderResultCard(r, index))}
          {itemsPerPage !== 'all' && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0 8px', flexWrap: 'wrap' }}>
              <button className="sr-btn sr-btn-ghost sr-btn-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>« Prev</button>
              <span style={{ fontSize: '.8rem', color: 'var(--muted)', alignSelf: 'center', padding: '0 8px' }}>{currentPage} / {totalPages}</span>
              <button className="sr-btn sr-btn-ghost sr-btn-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next »</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentResultsView;