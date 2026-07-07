import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportCardsAPI } from '../../api';
import schoolLogo from '../../pages/logo.png';
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
      <style>{`
        .cr-header-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 16px;
          margin-bottom: 12px;
        }
        .cr-logo-wrap {
          flex-shrink: 0;
        }
        .cr-logo-wrap img {
          width: 75px;
          height: 75px;
          object-fit: contain;
        }
        .cr-header-center-info {
          flex: 1;
          text-align: center;
        }
        .cr-header-center-info h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .cr-header-center-info p {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: #555;
        }
        .cr-header-center-info .cr-subtitle {
          font-size: 12px;
          color: #777;
        }
        .cr-class-photo-wrap {
          flex-shrink: 0;
          width: 75px;
          height: 75px;
          border: 2px solid #333;
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f5f5f5;
        }
        .cr-class-photo-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .cr-class-photo-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #e8e8e8 0%, #d0d0d0 100%);
          color: #555;
          font-size: 28px;
          user-select: none;
        }
      `}</style>

      <button className="back-btn" onClick={() => navigate('/admin/report-cards')}>&larr; Back to Classes</button>
      
      <div className="cr-header">
        <div className="cr-header-top-row">
          <div className="cr-logo-wrap">
            <img src={schoolLogo} alt="DATFORTE International School Logo" />
          </div>
          <div className="cr-header-center-info">
            <h2>{reportData.class?.name} {reportData.class?.section} - Report Cards</h2>
            <p>Term: {reportData.term?.name} | Session: {reportData.session?.name}</p>
            {reportData.totalStudents > 0 && (
              <p className="cr-subtitle">Total Students: {reportData.totalStudents} | Assessed: {reportData.assessedStudents}</p>
            )}
          </div>
          <div className="cr-class-photo-wrap">
            {reportData.class?.image ? (
              <img src={reportData.class.image} alt={`${reportData.class?.name} ${reportData.class?.section}`} />
            ) : (
              <div className="cr-class-photo-placeholder">🏛</div>
            )}
          </div>
        </div>
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