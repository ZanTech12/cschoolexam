import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentAPI } from '../../api';
import Loading from '../common/Loading';
import { useNavigate } from 'react-router-dom';

const StudentDashboard = () => {
  const navigate = useNavigate();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['studentDashboard'],
    queryFn: studentAPI.getDashboard
  });

  if (isLoading) return <Loading message="Initializing System..." />;

  const { student, availableTests, recentResults, stats } = dashboardData?.data || {};

  // JAMB Color Palette
  const colors = {
    primaryGreen: '#006633',
    darkGreen: '#004d25',
    accentGreen: '#28a745',
    lightGreen: '#e8f5e9',
    headerText: '#ffffff',
    bodyBg: '#f0f2f5',
    cardBg: '#ffffff',
    textMain: '#1a1a1a',
    textSecondary: '#555555',
    border: '#d4edda',
    warningOrange: '#e67e22',
    dangerRed: '#dc3545'
  };

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
  };

  // Check if exam is taken or submitted
  const isTaken = (test) =>
    test.isTaken === true ||
    test.hasSubmitted === true ||
    test.status === 'completed' ||
    (test.submission !== null && test.submission !== undefined) ||
    test.submissionStatus === 'submitted';

  // Check if exam has expired
  const isExpired = (test) => {
    const now = new Date();
    const endDate = test.endDate || test.expiresAt || test.expiryDate || test.endTime || test.deadline;
    return endDate && new Date(endDate) < now;
  };

  // Combined check for row styling
  const isUnavailable = (test) => isTaken(test) || isExpired(test);

  // Popup handler
  const handleUnavailableClick = (test) => {
    if (isTaken(test)) {
      alert("You have already taken this examination.");
    } else if (isExpired(test)) {
      alert("This examination has expired and is no longer available.");
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", backgroundColor: colors.bodyBg, minHeight: '100vh' }}>

      {/* JAMB CBT Top Header Bar */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.primaryGreen} 0%, ${colors.darkGreen} 100%)`,
        color: colors.headerText,
        padding: '1.5rem 2rem',
        borderRadius: '0 0 12px 12px',
        marginBottom: '2rem',
        boxShadow: '0 4px 15px rgba(0, 102, 51, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '1.8rem',
            fontWeight: 'bold',
            letterSpacing: '1px',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            CBT
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', letterSpacing: '0.5px' }}>
              EXAMINATION PORTAL
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85, fontWeight: '400' }}>
              Computer Based Testing System v2.0
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{student?.firstName} {student?.lastName}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9, fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>
              REG: {student?.admissionNumber || 'N/A'}
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>
              {student?.class ? `${student.class.name} - ${student.class.section}` : 'No class assigned'}
            </div>
          </div>
          <div style={{
            width: '55px',
            height: '55px',
            borderRadius: '50%',
            backgroundColor: colors.warningOrange,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            border: '3px solid rgba(255,255,255,0.5)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}>
            {getInitials(student?.firstName, student?.lastName)}
          </div>
        </div>
      </div>

      {/* Dashboard Content Container */}
      <div style={{ padding: '0 2rem 2rem' }}>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {[
            { title: 'AVAILABLE TESTS', value: availableTests?.length || 0, icon: '📝', color: colors.primaryGreen },
            { title: 'TESTS TAKEN', value: stats?.totalTests || 0, icon: '✅', color: colors.accentGreen },
            { title: 'AVERAGE SCORE', value: `${stats?.averageScore || 0}%`, icon: '📈', color: colors.warningOrange },
            { title: 'SYSTEM STATUS', value: 'ACTIVE', icon: '🟢', color: '#28a745' }
          ].map((stat, index) => (
            <div key={index} style={{
              backgroundColor: colors.cardBg,
              borderRadius: '8px',
              borderTop: `4px solid ${stat.color}`,
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            }}
            >
              <div style={{ fontSize: '2rem', opacity: 0.8 }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: '600', letterSpacing: '1px', marginBottom: '4px' }}>
                  {stat.title}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.textMain }}>
                  {stat.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

          {/* Available Tests */}
          <div style={{ backgroundColor: colors.cardBg, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{
              background: `linear-gradient(90deg, ${colors.lightGreen} 0%, #ffffff 100%)`,
              padding: '1rem 1.5rem',
              borderBottom: `2px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: colors.darkGreen, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: colors.primaryGreen }}>▶</span> ACTIVE EXAMINATIONS
              </h3>
              <button
                onClick={() => navigate('/student/tests')}
                style={{ fontSize: '0.8rem', color: colors.primaryGreen, background: 'none', border: '1px solid #c3e6cb', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
              >
                VIEW ALL
              </button>
            </div>

            <div style={{ padding: '0.5rem 0' }}>
              {availableTests?.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: colors.textSecondary }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                  NO ACTIVE EXAMINATIONS FOUND
                </div>
              ) : (
                availableTests?.slice(0, 5).map((test, idx) => {
                  const unavailable = isUnavailable(test);
                  const taken = isTaken(test);
                  const expired = isExpired(test);

                  return (
                    <div
                      key={test._id}
                      style={{
                        padding: '1rem 1.5rem',
                        borderBottom: `1px solid #f0f0f0`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.2s',
                        cursor: 'default',
                        opacity: unavailable ? 0.65 : 1,
                        backgroundColor: unavailable ? '#f8f9fa' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!unavailable) e.currentTarget.style.backgroundColor = '#f8fdf8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = unavailable ? '#f8f9fa' : 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          width: '35px',
                          height: '35px',
                          borderRadius: '6px',
                          backgroundColor: unavailable ? '#e9ecef' : colors.lightGreen,
                          color: unavailable ? '#6c757d' : colors.darkGreen,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          flexShrink: 0
                        }}>
                          {unavailable ? '✓' : String(idx + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: colors.textMain, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {test.title}
                            {unavailable && (
                              <span style={{
                                fontSize: '0.6rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#e9ecef',
                                color: '#495057',
                                fontWeight: '800',
                                letterSpacing: '0.5px'
                              }}>
                                {taken ? 'COMPLETED' : 'EXPIRED'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'flex', gap: '1rem', marginTop: '2px' }}>
                            <span>📘 {test.subjectId?.name}</span>
                            <span>⏱️ {test.duration} mins</span>
                            <span>❓ {test.questions?.length || 0} Qs</span>
                          </div>
                        </div>
                      </div>

                      {/* GREY BUTTON WITH POPUP vs GREEN START BUTTON */}
                      {unavailable ? (
                        <button
                          onClick={() => handleUnavailableClick(test)}
                          style={{
                            background: '#e9ecef',
                            color: '#6c757d',
                            border: '1px solid #dee2e6',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer', // Changed to pointer so user knows to click
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            userSelect: 'none'
                          }}
                          title="Click for details"
                        >
                          {taken ? 'TAKEN' : 'EXPIRED'}
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/student/tests/${test._id}`)}
                          style={{
                            background: `linear-gradient(135deg, ${colors.accentGreen} 0%, #218838 100%)`,
                            color: '#fff',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(40, 167, 69, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                          title="Start this examination"
                        >
                          START <span>▶</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Results */}
          <div style={{ backgroundColor: colors.cardBg, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{
              background: `linear-gradient(90deg, #f8f9fa 0%, #ffffff 100%)`,
              padding: '1rem 1.5rem',
              borderBottom: `2px solid #dee2e6`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: colors.textMain, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: colors.textSecondary }}>📋</span> PERFORMANCE HISTORY
              </h3>
              <button
                onClick={() => navigate('/student/results')}
                style={{ fontSize: '0.8rem', color: colors.textSecondary, background: 'none', border: '1px solid #dee2e6', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
              >
                VIEW ALL
              </button>
            </div>

            <div style={{ padding: '0.5rem 0' }}>
              {recentResults?.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: colors.textSecondary }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                  NO PERFORMANCE RECORDS AVAILABLE
                </div>
              ) : (
                recentResults?.map((result, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '1rem 1.5rem',
                      borderBottom: `1px solid #f0f0f0`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background 0.2s',
                      cursor: 'default'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fcfcfc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '45px',
                        height: '45px',
                        borderRadius: '50%',
                        border: `3px solid ${result.passed ? colors.accentGreen : colors.dangerRed}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        color: result.passed ? colors.accentGreen : colors.dangerRed,
                        fontSize: '0.85rem',
                        flexShrink: 0
                      }}>
                        {result.percentage}%
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: colors.textMain, fontSize: '0.95rem' }}>
                          {result.testTitle || 'Unknown Test'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginTop: '2px' }}>
                          {result.subjectName}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      letterSpacing: '0.5px',
                      backgroundColor: result.passed ? '#d4edda' : '#f8d7da',
                      color: result.passed ? '#155724' : '#721c24'
                    }}>
                      {result.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Bottom System Footer */}
      <div style={{
        textAlign: 'center',
        padding: '1.5rem',
        color: colors.textSecondary,
        fontSize: '0.8rem',
        borderTop: '1px solid #e0e0e0',
        backgroundColor: '#ffffff',
        marginTop: '2rem',
        fontFamily: 'monospace'
      }}>
        © {new Date().getFullYear()} SCHOOL MANAGEMENT SYSTEM • STRICTLY CONFIDENTIAL • UNAUTHORIZED ACCESS IS PROHIBITED
      </div>
    </div>
  );
};

export default StudentDashboard;