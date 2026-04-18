import React, { useState, useEffect } from 'react';
import { reportCardsAPI, termsAPI, sessionsAPI } from '../../api';
import './StudentReportCard.css';

const StudentReportCard = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [terms, setTerms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState('');

  // Fetch terms and sessions for filtering
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [termsRes, sessionsRes] = await Promise.all([
          termsAPI.getAll(),
          sessionsAPI.getAll()
        ]);
        if (termsRes.success) {
          setTerms(termsRes.data);
          // Auto-select active term if available
          const activeTerm = termsRes.data.find(t => t.isActive);
          if (activeTerm) setSelectedTerm(activeTerm._id);
        }
        if (sessionsRes.success) {
          setSessions(sessionsRes.data);
          // Auto-select active session if available
          const activeSession = sessionsRes.data.find(s => s.isActive);
          if (activeSession) setSelectedSession(activeSession._id);
        }
      } catch (err) {
        console.error('Error fetching filters:', err);
      }
    };
    fetchFilters();
  }, []);

  // Fetch report when student ID or filters change
  useEffect(() => {
    const { user } = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?._id) {
      fetchReport(user._id, selectedTerm, selectedSession);
    }
  }, [selectedTerm, selectedSession]);

  const fetchReport = async (studentId, termId, sessionId) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (termId) params.termId = termId;
      if (sessionId) params.sessionId = sessionId;
      
      const response = await reportCardsAPI.getStudentReport(studentId, params);
      
      if (response.success) {
        setReport(response.data);
      } else {
        setError(response.message || 'Failed to load report card');
        setReport(null);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.response?.data?.message || 'An error occurred while loading your report card');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const getGradeClass = (grade) => {
    if (!grade) return '';
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return 'grade-a';
    if (g.startsWith('B')) return 'grade-b';
    if (g.startsWith('C')) return 'grade-c';
    if (g.startsWith('D')) return 'grade-d';
    return 'grade-f';
  };

  if (loading) return <div className="loading">Loading your grades...</div>;
  
  if (error) return (
    <div className="no-data" style={{ color: '#e53e3e' }}>
      <p>{error}</p>
    </div>
  );
  
  if (!report) return <div className="no-data">No report card available yet.</div>;

  return (
    <div className="student-report-page">
      <div className="sr-header">
        <h2>My Report Card</h2>
        <p>{report.term?.name} | {report.session?.name}</p>
      </div>

      {/* Term/Session Filters */}
      {(terms.length > 0 || sessions.length > 0) && (
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          {terms.length > 0 && (
            <select 
              value={selectedTerm} 
              onChange={(e) => setSelectedTerm(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.9rem',
                minWidth: '150px'
              }}
            >
              <option value="">All Terms</option>
              {terms.map(term => (
                <option key={term._id} value={term._id}>{term.name}</option>
              ))}
            </select>
          )}
          {sessions.length > 0 && (
            <select 
              value={selectedSession} 
              onChange={(e) => setSelectedSession(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.9rem',
                minWidth: '150px'
              }}
            >
              <option value="">All Sessions</option>
              {sessions.map(session => (
                <option key={session._id} value={session._id}>{session.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="sr-info-box">
        <p><strong>Class:</strong> {report.student?.class?.name} {report.student?.class?.section}</p>
        <p><strong>Position:</strong> {report.statistics?.position} out of {report.statistics?.totalInClass}</p>
        <p><strong>Average:</strong> {report.statistics?.averageScore}%</p>
      </div>

      <div className="sr-table-container">
        <table className="sr-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>CA (40)</th>
              <th>Exam (60)</th>
              <th>Total (100)</th>
              <th>Grade</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {report.subjects?.map((sub, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{sub.subject?.name}</td>
                <td>{sub.totalCA}</td>
                <td>{sub.examScore}</td>
                <td style={{ fontWeight: 700 }}>{sub.totalScore}</td>
                <td className={getGradeClass(sub.grade)} style={{ fontWeight: 700 }}>{sub.grade}</td>
                <td>{sub.remark}</td>
              </tr>
            ))}
            {(!report.subjects || report.subjects.length === 0) && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>
                  Grades have not been uploaded for this term yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {report.principalComment && (
        <div className="sr-comment">
          <h4>Principal's Comment:</h4>
          <p>{report.principalComment}</p>
        </div>
      )}
    </div>
  );
};

export default StudentReportCard;