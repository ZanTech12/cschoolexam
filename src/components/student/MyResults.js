import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentAPI } from '../../api';
import Loading from '../common/Loading';
import { useNavigate } from 'react-router-dom';

const MyResults = () => {
  const navigate = useNavigate();
  
  // ✅ FIXED: useQuery v5 syntax
  const { data: resultsData, isLoading } = useQuery({
    queryKey: ['studentResults'],
    queryFn: studentAPI.getTestResults
  });

  const results = resultsData?.data || [];

  if (isLoading) return <Loading message="Loading results..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">My Results</h1>
          <p className="page-subtitle">View your published test scores</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/student/tests')}>
          Take a Test
        </button>
      </div>

      {results.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No Results Yet</div>
          <div className="empty-state-text">
            Your results will appear here once your teacher publishes them.
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Test Title</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Status</th>
                  <th>Date Taken</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <td><strong>{result.test?.title || 'Unknown Test'}</strong></td>
                    <td>{result.test?.subjectId?.name || '-'}</td>
                    <td>{result.test?.classId?.name || '-'}</td>
                    <td>
                      {result.score} / {result.totalQuestions}
                    </td>
                    <td>
                      <strong style={{ 
                        color: result.percentage >= (result.test?.passMark || 50) ? 'var(--success-dark)' : 'var(--danger-color)' 
                      }}>
                        {result.percentage}%
                      </strong>
                    </td>
                    <td>
                      {result.passed ? (
                        <span className="badge badge-success">Passed</span>
                      ) : (
                        <span className="badge badge-danger">Failed</span>
                      )}
                    </td>
                    <td>
                      {result.date 
                        ? new Date(result.date).toLocaleDateString() 
                        : '-'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h3>Performance Summary</h3>
          </div>
          <div className="card-body">
            <div className="stats-grid">
              <div className="stat-card primary">
                <div className="stat-card-value">{results.length}</div>
                <div className="stat-card-label">Tests Taken</div>
              </div>
              <div className="stat-card success">
                <div className="stat-card-value">
                  {results.filter(r => r.passed).length}
                </div>
                <div className="stat-card-label">Tests Passed</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-card-value">
                  {results.length > 0 
                    ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length) 
                    : 0}%
                </div>
                <div className="stat-card-label">Average Score</div>
              </div>
              <div className="stat-card info">
                <div className="stat-card-value">
                  {results.length > 0 
                    ? Math.max(...results.map(r => r.percentage)) 
                    : 0}%
                </div>
                <div className="stat-card-label">Highest Score</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyResults;