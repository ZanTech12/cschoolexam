import React, { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportCardsAPI } from '../../api';
import schoolLogo from '../../pages/logo.png';
import principalSignature from './principal_signature.png';
import './ReportCardsPrintView.css';

const ReportCardsPrintView = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const termId = searchParams.get('termId');
  const classIdsString = searchParams.get('classIds') || '';

  const defaultPsychomotor = useMemo(() => [
    { skill: 'Handwriting', rating: 'A' },
    { skill: 'Sports', rating: 'B' },
    { skill: 'Drawing & Painting', rating: 'A' },
    { skill: 'Music & Drama', rating: 'B' },
    { skill: 'Crafts', rating: 'C' },
    { skill: 'Cleanliness', rating: 'A' },
    { skill: 'Punctuality', rating: 'B' },
    { skill: 'Politeness', rating: 'A' },
  ], []);

  const normalizePsychomotorRating = (rating) => {
    if (!rating) return '';
    const upperRating = rating.toString().toUpperCase().trim();
    if (['A', 'B', 'C'].includes(upperRating)) return upperRating;
    return 'C';
  };

  // ============================================
  // MAIN QUERY
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

  // ============================================
  // HELPERS
  // ============================================
  const getAbsentDays = (present, total) => {
    if (present === '' || present === undefined || present === null ||
        total === '' || total === undefined || total === null || total === 0) return '';
    const absent = total - present;
    return absent > 0 ? absent : 0;
  };

  // Updated formatDate: Falls back to '––––' for missing/empty dates instead of 'N/A'
  const formatDate = (date) => {
    if (!date) return '––––';
    const parsedDate = new Date(date);
    return isNaN(parsedDate.getTime()) 
      ? '––––' 
      : parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const renderPsychomotorTable = (psychomotorData) => {
    const rawSkills = psychomotorData?.length ? psychomotorData : defaultPsychomotor;
    const skills = rawSkills.map(skill => ({
      ...skill,
      rating: normalizePsychomotorRating(skill.rating)
    }));
    const half = Math.ceil(skills.length / 2);
    const leftCol = skills.slice(0, half);
    const rightCol = skills.slice(half);
    const rows = Math.max(leftCol.length, rightCol.length);

    return (
      <div className="psychomotor-section-compact">
        <div className="psychomotor-title-compact">
          PSYCHOMOTOR / AFFECTIVE DOMAIN
          <span className="psychomotor-key-inline">
            &nbsp; (A – Excellent | B – Very Good | C – Good)
          </span>
        </div>
        <table className="psychomotor-table-compact">
          <thead>
            <tr>
              <th className="pmc-th-sn">S/N</th>
              <th className="pmc-th-skill">Skill / Trait</th>
              <th className="pmc-th-rating">Rating</th>
              <th className="pmc-th-sn">S/N</th>
              <th className="pmc-th-skill">Skill / Trait</th>
              <th className="pmc-th-rating">Rating</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, idx) => (
              <tr key={idx}>
                <td className="pmc-td-sn">{idx + 1}</td>
                <td className="pmc-td-skill">{leftCol[idx]?.skill || ''}</td>
                <td className="pmc-td-rating">
                  <span className="pmc-rating-letter">{leftCol[idx]?.rating || '–'}</span>
                </td>
                <td className="pmc-td-sn">{half + idx + 1}</td>
                <td className="pmc-td-skill">{rightCol[idx]?.skill || ''}</td>
                <td className="pmc-td-rating">
                  <span className="pmc-rating-letter">{rightCol[idx]?.rating || '–'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ============================================
  // COMPACT A4 STYLES
  // ============================================
  const compactA4Styles = `
    .a4-document {
      width: 210mm; min-height: 297mm; padding: 8mm 12mm !important;
      background-color: #ffffff !important; position: relative;
      box-sizing: border-box !important; margin: 20px auto;
      box-shadow: 0 0 15px rgba(0,0,0,0.1);
      display: flex !important; flex-direction: column !important;
    }
    .a4-document::before, .a4-document::after {
      content: "" !important; position: absolute !important; pointer-events: none !important;
      z-index: 1000 !important; border: 3px solid #111 !important; border-radius: 0 !important;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    .a4-document::before { inset: 0 !important; }
    .a4-document::after { inset: 7px !important; border-width: 1.5px !important; }

    .a4-document .school-header-elegant { text-align: center; margin-bottom: 2mm !important; flex-shrink: 0 !important; }
    .a4-document .header-ornament { height: 2px !important; margin: 0.5mm 0 !important; background: #111 !important; }
    .a4-document .header-ornament.top { margin-bottom: 1mm !important; }
    .a4-document .header-ornament.bottom { margin-top: 1mm !important; }
    .a4-document .header-logo-wrap { margin-bottom: 0.5mm !important; }
    .a4-document .header-logo { width: 28px !important; height: 28px !important; }
    .a4-document .school-name { font-size: 11pt !important; margin: 0 !important; padding: 0 !important; letter-spacing: 0.5px !important; line-height: 1.2 !important; }
    .a4-document .doc-title { font-size: 7.5pt !important; margin: 0 !important; padding: 0 !important; line-height: 1.2 !important; }
    .a4-document .header-meta-box { display: flex !important; justify-content: center !important; align-items: center !important; gap: 3mm !important; margin-top: 0.5mm !important; }
    .a4-document .meta-text { font-size: 6.5pt !important; }
    .a4-document .meta-divider { width: 1px !important; height: 8px !important; background: #333 !important; display: inline-block !important; }

    .a4-document .bio-data-section { margin-bottom: 2mm !important; flex-shrink: 0 !important; }
    .a4-document .bio-grid { display: grid !important; grid-template-columns: 1fr 1fr 1fr 1fr !important; gap: 0 !important; border: 0.5px solid #555 !important; background: #555 !important; }
    .a4-document .bio-item { background: #fff !important; padding: 1mm 2mm !important; border-right: 0.5px solid #555 !important; }
    .a4-document .bio-item:nth-child(4n) { border-right: none !important; }
    .a4-document .bio-label { font-size: 6pt !important; display: block !important; color: #444 !important; margin-bottom: 0.2mm !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; }
    .a4-document .bio-value { font-size: 7.5pt !important; display: block !important; font-weight: 600 !important; line-height: 1.2 !important; }
    .a4-document .name-highlight { font-weight: 700 !important; }

    .a4-document .grades-container { margin-bottom: 1.5mm !important; flex-shrink: 0 !important; }
    .a4-document .grades-table-elegant { width: 100% !important; border-collapse: collapse !important; font-size: 7pt !important; table-layout: fixed !important; }
    .a4-document .grades-table-elegant th, .a4-document .grades-table-elegant td { padding: 0.8mm 1.5px !important; border: 0.5px solid #444 !important; line-height: 1.15 !important; vertical-align: middle !important; }
    .a4-document .th-sn { width: 6% !important; }
    .a4-document .th-subject { width: 26% !important; text-align: left !important; }
    .a4-document .th-sub-ca { width: 10% !important; font-size: 5.5pt !important; }
    .a4-document .th-ca-header { font-size: 5.5pt !important; }
    .a4-document .th-score { width: 9% !important; font-size: 5.5pt !important; }
    .a4-document .th-grade { width: 7% !important; font-size: 5.5pt !important; }
    .a4-document .th-remark { width: 13% !important; font-size: 5.5pt !important; }
    .a4-document .td-subject { text-align: left !important; padding-left: 2px !important; }
    .a4-document .td-center { text-align: center !important; }
    .a4-document .td-bold { font-weight: 600 !important; }
    .a4-document .td-total { font-weight: 700 !important; }
    .a4-document .td-remark { text-align: left !important; font-size: 6pt !important; padding-left: 2px !important; }
    .a4-document .td-right { text-align: right !important; }
    .a4-document .td-empty { text-align: center !important; font-style: italic !important; }
    .a4-document .summary-row td { padding: 0.6mm 1.5px !important; }
    .a4-document .summary-label { font-size: 6.5pt !important; }

    .a4-document .grading-key-elegant { font-size: 6pt !important; margin-bottom: 1.5mm !important; flex-shrink: 0 !important; text-align: center !important; }
    .a4-document .key-label { font-weight: 700 !important; }
    .a4-document .key-text { margin-left: 1mm !important; }

    .a4-document .attendance-section { margin-bottom: 1.5mm !important; flex-shrink: 0 !important; }
    .a4-document .attendance-title { font-size: 7pt !important; font-weight: 700 !important; margin-bottom: 0.5mm !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; }
    .a4-document .attendance-grid { display: grid !important; grid-template-columns: 1fr 1fr 1fr !important; gap: 0 !important; border: 0.5px solid #555 !important; background: #555 !important; }
    .a4-document .attendance-card { background: #fff !important; padding: 1mm 2mm !important; text-align: center !important; border-right: 0.5px solid #555 !important; }
    .a4-document .attendance-card:nth-child(3) { border-right: none !important; }
    .a4-document .attendance-label { font-size: 5.5pt !important; display: block !important; color: #444 !important; text-transform: uppercase !important; letter-spacing: 0.2px !important; }
    .a4-document .attendance-value { font-size: 8.5pt !important; font-weight: 700 !important; display: block !important; margin-top: 0.2mm !important; }

    .a4-document .psychomotor-section-compact { margin-bottom: 1.5mm !important; flex-shrink: 0 !important; }
    .a4-document .psychomotor-title-compact { font-size: 7pt !important; font-weight: 700 !important; margin-bottom: 0.5mm !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; }
    .a4-document .psychomotor-key-inline { font-size: 5.5pt !important; font-weight: 400 !important; }
    .a4-document .psychomotor-table-compact { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
    .a4-document .psychomotor-table-compact th, .a4-document .psychomotor-table-compact td { padding: 0.5mm 1.5px !important; border: 0.5px solid #444 !important; line-height: 1.15 !important; vertical-align: middle !important; }
    .a4-document .pmc-th-sn { width: 6% !important; font-size: 5.5pt !important; }
    .a4-document .pmc-th-skill { width: 25% !important; font-size: 5.5pt !important; text-align: left !important; }
    .a4-document .pmc-th-rating { width: 13% !important; font-size: 5.5pt !important; }
    .a4-document .pmc-td-sn { text-align: center !important; font-size: 6.5pt !important; }
    .a4-document .pmc-td-skill { font-size: 6.5pt !important; text-align: left !important; padding-left: 2px !important; }
    .a4-document .pmc-td-rating { text-align: center !important; font-size: 7pt !important; }
    .a4-document .pmc-rating-letter { font-weight: 700 !important; }

    .a4-document .comments-container { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 2mm !important; margin-bottom: 1mm !important; flex-shrink: 0 !important; }
    .a4-document .comment-box-elegant { border: 0.5px solid #555 !important; padding: 1.5mm 2mm !important; display: flex !important; flex-direction: column !important; }
    .a4-document .comment-title { font-size: 6.5pt !important; font-weight: 700 !important; text-align: center !important; margin-bottom: 0.5mm !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; }
    .a4-document .comment-text-area { font-size: 6.5pt !important; flex: 1 !important; line-height: 1.3 !important; margin-bottom: 0.5mm !important; min-height: 8mm !important; max-height: none !important; overflow: visible !important; }
    .a4-document .comment-text-area strong { font-size: 6.5pt !important; }
    .a4-document .blank-line { font-size: 6.5pt !important; letter-spacing: 1px !important; }
    .a4-document .signature-section { display: flex !important; flex-direction: column !important; align-items: center !important; }
    .a4-document .sig-line { width: 35mm !important; border-top: 0.5px solid #333 !important; margin-bottom: 0.3mm !important; }
    .a4-document .sig-text { font-size: 5.5pt !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; }
    .a4-document .principal-sig-img { height: 8mm !important; width: auto !important; }

    .a4-document .sheet-footer-elegant { margin-top: auto !important; flex-shrink: 0 !important; border-top: 0.5px solid #999 !important; padding-top: 1mm !important; }
    .a4-document .footer-dates-grid { display: flex !important; justify-content: space-between !important; }
    .a4-document .fd-label { font-size: 5.5pt !important; text-transform: uppercase !important; letter-spacing: 0.2px !important; }
    .a4-document .fd-value { font-size: 7pt !important; font-weight: 600 !important; }
    .a4-document .next-term-highlight { text-align: center !important; margin-top: 0.5mm !important; }
    .a4-document .nt-label { font-size: 5.5pt !important; text-transform: uppercase !important; letter-spacing: 0.2px !important; }
    .a4-document .nt-date { font-size: 7.5pt !important; font-weight: 700 !important; }
  `;

  // ============================================
  // ROBUST PRINT HANDLER
  // ============================================
  const handlePrint = () => {
    const printArea = document.querySelector('.print-area');
    if (!printArea) return;

    const clonedElement = printArea.cloneNode(true);
    const screenControls = clonedElement.querySelector('.screen-controls');
    if (screenControls) screenControls.remove();

    const headStyles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    const a4PrintStyles = `
      @page { size: A4 portrait; margin: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; padding: 0; background: #fff !important; }
      .print-view-wrapper { margin: 0 !important; padding: 0 !important; }
      .print-area { display: block !important; }
      .print-class-section { display: block !important; }
      .a4-document {
        width: 210mm; min-height: 297mm; padding: 8mm 12mm !important;
        background-color: #ffffff !important; position: relative;
        box-sizing: border-box !important; margin: 0 !important; box-shadow: none !important;
        page-break-inside: avoid !important; page-break-after: always !important;
      }
      .a4-document:last-child { page-break-after: auto !important; }
      .a4-document::before, .a4-document::after {
        content: "" !important; position: absolute !important; pointer-events: none !important;
        z-index: 1000 !important; border: 3px solid #111 !important; border-radius: 0 !important;
      }
      .a4-document::before { inset: 0 !important; }
      .a4-document::after { inset: 7px !important; border-width: 1.5px !important; }
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Please allow pop-ups for this site to print the report cards.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Student Report Cards - Batch Print</title>
        ${headStyles}
        <style>${a4PrintStyles}</style>
      </head>
      <body>
        ${clonedElement.outerHTML}
        <script>
          window.onafterprint = () => window.close();
          document.fonts.ready.then(() => {
            setTimeout(() => window.print(), 250);
          });
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ============================================
  // UI RENDERING
  // ============================================
  if (isLoading) {
    return (
      <div className="print-loading">
        <div className="spinner"></div>
        <p>Gathering Report Cards...</p>
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

  if (!printData) {
    return (
      <div className="print-error-page">
        <p>No Data Available</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const { term, session, classes } = printData;

  return (
    <div className="print-view-wrapper">
      <div className="screen-controls">
        <button onClick={() => navigate(-1)} className="ctrl-btn back">&larr; Back</button>
        <button onClick={handlePrint} className="ctrl-btn print">Print All Report Cards</button>
      </div>

      <div className="print-area">
        <style>{compactA4Styles}</style>

        {classes.map((classObj, classIdx) => (
          <div
            key={classObj.classInfo._id}
            className="print-class-section"
            style={classIdx > 0 ? { pageBreakBefore: 'always' } : undefined}
          >
            {classObj.students.map((student) => {
              const timesSchoolOpen = student.attendance?.timesOpen || '';
              const timesPresent = student.attendance?.timesPresent || '';
              const timesAbsent = getAbsentDays(timesPresent, timesSchoolOpen);
              const totalScoreObtainable = student.subjects.length * 100;

              return (
                <div key={student.student._id} className="a4-document print-student-card">
                  {/* ===== SCHOOL HEADER ===== */}
                  <header className="school-header-elegant">
                    <div className="header-ornament top"></div>
                    <div className="header-logo-wrap">
                      <img src={schoolLogo} alt="DATFORTE International School Logo" className="header-logo" />
                    </div>
                    <h1 className="school-name">DATFORTE INTERNATIONAL SCHOOLS LIMITED</h1>
                    <h2 className="doc-title">STUDENT ACADEMIC REPORT CARD</h2>
                    <div className="header-meta-box">
                      <span className="meta-text">Term <strong>{term.name}</strong></span>
                      <span className="meta-divider"></span>
                      <span className="meta-text">Session <strong>{session.name}</strong></span>
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
                        <span className="bio-value">{student.student.admissionNumber}</span>
                      </div>
                      <div className="bio-item">
                        <span className="bio-label">Class</span>
                        <span className="bio-value">{classObj.classInfo.name} {classObj.classInfo.section}</span>
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
                        {student.subjects.map((sub, i) => (
                          <tr key={sub.subjectId || sub._id || i}>
                            <td className="td-center">{i + 1}</td>
                            <td className="td-subject">{sub.subjectName || sub.subject?.name}</td>
                            <td className="td-center">{sub.testScore ?? '–'}</td>
                            <td className="td-center">{sub.noteTakingScore ?? '–'}</td>
                            <td className="td-center">{sub.assignmentScore ?? '–'}</td>
                            <td className="td-center td-bold">{sub.totalCA}</td>
                            <td className="td-center td-bold">{sub.examScore}</td>
                            <td className="td-center td-bold td-total">{sub.totalScore}</td>
                            <td className="td-center td-bold">{sub.grade}</td>
                            <td className="td-remark">{sub.remark}</td>
                          </tr>
                        ))}
                        {student.subjects.length === 0 && (
                          <tr><td colSpan="10" className="td-empty">No grades recorded for this term.</td></tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="summary-row">
                          <td colSpan="7" className="td-right summary-label">TOTAL SCORE OBTAINABLE:</td>
                          <td className="td-center td-total">{totalScoreObtainable}</td>
                          <td colSpan="2"></td>
                        </tr>
                        <tr className="summary-row">
                          <td colSpan="7" className="td-right summary-label">TOTAL SCORE OBTAINED:</td>
                          <td className="td-center td-total">{student.statistics.totalScore}</td>
                          <td colSpan="2"></td>
                        </tr>
                        <tr className="summary-row">
                          <td colSpan="7" className="td-right summary-label">STUDENT AVERAGE:</td>
                          <td className="td-center td-total">{student.statistics.averageScore}%</td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* ===== GRADING KEY ===== */}
                  <div className="grading-key-elegant">
                    <span className="key-label">GRADING SCALE:</span>
                    <span className="key-text">
                      A (Excellent) | B (Very Good) | C (Good) | D (Fair) | E (Poor) | F (Fail)
                    </span>
                  </div>

                  {/* ===== ATTENDANCE RECORD ===== */}
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

                  {/* ===== PSYCHOMOTOR / AFFECTIVE DOMAIN ===== */}
                  {renderPsychomotorTable(student.psychomotor)}

                  {/* ===== COMMENTS & SIGNATURES ===== */}
                  <div className="comments-container">
                    <div className="comment-box-elegant">
                      <div className="comment-title" style={{ textAlign: 'center' }}>CLASS TEACHER'S COMMENT</div>
                      <div className="comment-text-area">
                        {student.classTeacherComment 
                          ? <><strong>{student.student.firstName} {student.student.lastName}</strong> - {student.classTeacherComment}</>
                          : <span className="blank-line">................................................................................</span>
                        }
                      </div>
                      <div className="signature-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div className="sig-line"></div>
                        <span className="sig-text">Class Teacher</span>
                      </div>
                    </div>

                    <div className="comment-box-elegant">
                      <div className="comment-title" style={{ textAlign: 'center' }}>PRINCIPAL'S COMMENT</div>
                      <div className="comment-text-area">
                        {student.principalComment 
                          ? <>{student.principalComment}</>
                          : <span className="blank-line">................................................................................</span>
                        }
                      </div>
                      <div className="signature-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img 
                          src={principalSignature} 
                          alt="Principal's Signature" 
                          className="principal-sig-img"
                        />
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
                        <span className="fd-value">{formatDate(result.term.startDate)}</span>
                      </div>
                      <div className="footer-date-item">
                        <span className="fd-label">Term Ends:</span>
                        <span className="fd-value">{formatDate(result.term.endDate)}</span>
                      </div>
                    </div>
                    
                    {/* Removed the && wrapper so it always displays visually like the rest of the empty fields */}
                    <div className="next-term-highlight">
                      <span className="nt-label">NEXT TERM BEGINS:</span>
                      <span className="nt-date">{formatDate(term?.nextTermBegins)}</span>
                    </div>
                  </footer>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportCardsPrintView;