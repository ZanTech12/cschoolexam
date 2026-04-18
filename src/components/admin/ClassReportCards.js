import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportCardsAPI } from '../../api';
import './ClassReportCards.css';

const ClassReportCards = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const classId = searchParams.get('classId') || window.location.pathname.split('/').pop();
  const termId = searchParams.get('termId');

  // ✅ UPDATED: Replaced useEffect + useState with useQuery
  // This prevents double-fetching in React Strict Mode and adds caching
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['class-report', classId, termId],
    queryFn: () => reportCardsAPI.getClassReport(classId, { termId }),
    enabled: !!classId && !!termId, // Only fetch if we have both IDs
    staleTime: 60000, // Don't refetch for 1 minute
  });

  // Safely extract data from the Axios response wrapper
  const reportData = response?.data || null;

  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading class report...</p>
      </div>
    );
  }

  if (isError || !reportData) {
    return (
      <div className="class-report-page">
        <button className="back-btn" onClick={() => navigate('/admin/report-cards')}>&larr; Back to Classes</button>
        <div className="no-data">
          <p>Failed to load report data. Please go back and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="class-report-page">
      <button className="back-btn" onClick={() => navigate('/admin/report-cards')}>&larr; Back to Classes</button>
      
      <div className="cr-header">
        <h2>{reportData.class?.name} {reportData.class?.section} - Report Cards</h2>
        <p>Term: {reportData.term?.name} | Session: {reportData.session?.name}</p>
        {reportData.totalStudents > 0 && (
          <p className="cr-subtitle">Total Students: {reportData.totalStudents} | Assessed: {reportData.assessedStudents}</p>
        )}
      </div>

      <div className="cr-table-container">
        {reportData.students && reportData.students.length > 0 ? (
          <table className="cr-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Student Name</th>
                <th>Adm No</th>
                <th>Subjects Taken</th>
                <th>Total Score</th>
                <th>Average</th>
              </tr>
            </thead>
            <tbody>
              {reportData.students.map((student, i) => (
                <tr 
                  key={student.student?._id || i} 
                  onClick={() => navigate(`/admin/report-cards/student/${student.student?._id}?termId=${termId}`)} 
                  style={{cursor: 'pointer'}}
                >
                  <td>{student.position || '-'}</td>
                  <td>{student.student?.lastName} {student.student?.firstName}</td>
                  <td>{student.student?.admissionNumber || '-'}</td>
                  <td>{student.subjectCount || 0}</td>
                  <td>{student.totalScore || 0}</td>
                  <td style={{fontWeight: 700}}>{student.averageScore || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">
            <p>No approved assessment data found for this class in the selected term.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassReportCards;