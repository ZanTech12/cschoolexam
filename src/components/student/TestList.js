
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentAPI } from '../../api';
import Loading from '../common/Loading';
import { useNavigate } from 'react-router-dom';

const TestList = ({ showSchedule = false }) => {
  const navigate = useNavigate();

  // ✅ FIXED: useQuery v5 syntax
  const { data: testsData, isLoading: testsLoading } = useQuery({
    queryKey: showSchedule ? ['studentTestSchedule'] : ['studentTests'],
    queryFn: showSchedule ? studentAPI.getTestSchedule : studentAPI.getAvailableTests
  });

  if (testsLoading) return <Loading message="Loading tests..." />;

  const tests = testsData?.data || [];

  return (
    <div>
      <h1 className="page-title">{showSchedule ? 'Test Schedule' : 'Available Tests'}</h1>
      <p className="page-subtitle">
        {showSchedule
          ? 'View all tests including upcoming and completed'
          : 'Tests currently available for you to take'}
      </p>

      {tests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">
            {showSchedule ? 'No Tests Found' : 'No Available Tests'}
          </div>
          <div className="empty-state-text">
            {showSchedule
              ? 'There are no tests scheduled for your class'
              : 'There are no tests currently available. Check back later.'}
          </div>
        </div>
      ) : (
        <div className="stats-grid">
          {tests.map((test) => (
            <div key={test._id} className="card">
              <div
                className="card-header"
                style={{
                  background: test.status === 'active' ? 'var(--success-dark)' : test.status === 'upcoming' ? 'var(--info-color)' : 'var(--gray-600)',
                  color: 'white',
                }}
              >
                <h3>{test.title}</h3>
                <span className={`badge ${test.status === 'active' ? 'badge-success' : test.status === 'upcoming' ? 'badge-info' : 'badge-secondary'}`}
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                  {test.statusText || test.status}
                </span>
              </div>
              <div className="card-body">
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Subject:</strong> {test.subjectId?.name}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Duration:</strong> {test.duration} minutes
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Questions:</strong> {test.questions?.length || 'N/A'}
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Pass Mark:</strong> {test.passMark}%
                </div>
                {showSchedule && (
                  <>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Start:</strong> {new Date(test.startDate).toLocaleString()}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>End:</strong> {new Date(test.endDate).toLocaleString()}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Time:</strong> {test.timeRemaining}
                    </div>
                  </>
                )}
                {test.hasTakenTest && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <span className="badge badge-warning">Already Taken</span>
                  </div>
                )}
              </div>
              <div className="card-footer">
                {test.canTake ? (
                  <button
                    className="btn btn-success btn-block"
                    onClick={() => navigate(`/student/tests/${test._id}`)}
                  >
                    Start Test
                  </button>
                ) : test.hasTakenTest ? (
                  <button className="btn btn-secondary btn-block" disabled>
                    Test Completed
                  </button>
                ) : (
                  <button className="btn btn-secondary btn-block" disabled>
                    {test.status === 'upcoming' ? 'Not Yet Available' : 'Test Ended'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestList;
