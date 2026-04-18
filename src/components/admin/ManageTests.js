import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testsAPI, classesAPI, subjectsAPI, questionSetsAPI, dashboardAPI, authAPI } from '../../api';
import Loading from '../common/Loading';

const ManageTests = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [showModalScrollBtn, setShowModalScrollBtn] = useState(false);
  const modalBodyRef = useRef(null);
  
  const [formData, setFormData] = useState({
    title: '',
    classId: '',
    subjectId: '',
    duration: 60,
    startDate: '',
    endDate: '',
    passMark: 50,
    instructions: '',
    questions: [],
    questionSetId: '',
  });
  const [error, setError] = useState('');
  const [selectedQuestionSet, setSelectedQuestionSet] = useState('');

  // ==================== CURRENT USER QUERY ====================
  // Fetch the currently logged-in user to determine role and ID
  const { data: currentUserData, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authAPI.getCurrentUser, // Adjust to match your auth API endpoint
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: false,
  });

  const currentUser = currentUserData?.data;
  const currentUserId = currentUser?._id;
  const isTeacher = currentUser?.role === 'teacher';

  // ==================== TEACHER ASSIGNMENTS QUERY ====================
  // Only fetch assignments if user is a teacher
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['my-teacher-assignments'],
    queryFn: dashboardAPI.getTeacherAssignments,
    enabled: isTeacher && !!currentUserId, // Only run for teachers
  });

  // ==================== STANDARD DATA QUERIES ====================
  
  const { data: tests, isLoading: testsLoading } = useQuery({
    queryKey: ['tests'],
    queryFn: testsAPI.getAll
  });

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesAPI.getAll({ limit: 100 })
  });

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: subjectsAPI.getAll
  });

  const { data: questionSets, isLoading: qsLoading } = useQuery({
    queryKey: ['questionSets', formData.classId, formData.subjectId],
    queryFn: () => questionSetsAPI.getAll({ classId: formData.classId, subjectId: formData.subjectId }),
    enabled: !!formData.classId && !!formData.subjectId
  });

  // ==================== TEACHER-SPECIFIC DERIVED DATA ====================
  
  // Extract only this teacher's assignments from all assignments
  const myAssignments = useMemo(() => {
    if (!isTeacher || !assignmentsData?.data || !currentUserId) return [];
    return assignmentsData.data.filter((assignment) => {
      const aTeacherId = assignment.teacher_id?._id || assignment.teacherId?._id;
      return aTeacherId === currentUserId;
    });
  }, [isTeacher, assignmentsData, currentUserId]);

  // Build a mapping: classId -> [array of allowed subjectIds]
  // This ensures teachers can only pick subjects they're assigned to for a given class
  const classSubjectMap = useMemo(() => {
    const map = {};
    myAssignments.forEach((assignment) => {
      const classId = assignment.class_id?._id || assignment.classId?._id;
      const subjectId = assignment.subject_id?._id || assignment.subjectId?._id;
      
      if (classId && subjectId) {
        if (!map[classId]) {
          map[classId] = [];
        }
        if (!map[classId].includes(subjectId)) {
          map[classId].push(subjectId);
        }
      }
    });
    return map;
  }, [myAssignments]);

  // Get unique class IDs the teacher is assigned to
  const allowedClassIds = useMemo(() => {
    if (!isTeacher) return null; // null means no restriction (admin)
    return [
      ...new Set(
        myAssignments
          .map((a) => a.class_id?._id || a.classId?._id)
          .filter(Boolean)
      ),
    ];
  }, [isTeacher, myAssignments]);

  // Get unique subject IDs the teacher is assigned to (across all classes)
  const allowedSubjectIds = useMemo(() => {
    if (!isTeacher) return null; // null means no restriction (admin)
    return [
      ...new Set(
        myAssignments
          .map((a) => a.subject_id?._id || a.subjectId?._id)
          .filter(Boolean)
      ),
    ];
  }, [isTeacher, myAssignments]);

  // Filter classes: teachers see only their assigned classes, admins see all
  const myClasses = useMemo(() => {
    if (!classes?.data) return [];
    if (!isTeacher || !allowedClassIds) return classes.data;
    return classes.data.filter((cls) => allowedClassIds.includes(cls._id));
  }, [classes, isTeacher, allowedClassIds]);

  // Filter subjects based on selected class in the form
  // Teachers can only see subjects assigned to them for the selected class
  const mySubjectsForForm = useMemo(() => {
    if (!subjects?.data) return [];
    
    // If not a teacher or no class selected yet, show all allowed subjects
    if (!isTeacher) return subjects.data;
    
    if (!formData.classId) {
      // No class selected - show all subjects the teacher is assigned to (across any class)
      if (!allowedSubjectIds) return subjects.data;
      return subjects.data.filter((s) => allowedSubjectIds.includes(s._id));
    }
    
    // Class is selected - only show subjects assigned to this teacher for THIS class
    const allowedForThisClass = classSubjectMap[formData.classId] || [];
    return subjects.data.filter((s) => allowedForThisClass.includes(s._id));
  }, [subjects, isTeacher, formData.classId, classSubjectMap, allowedSubjectIds]);

  // Filter tests: teachers see only tests for their assigned class+subject combos
  const myTests = useMemo(() => {
    if (!tests?.data) return [];
    
    // Admin sees all tests
    if (!isTeacher || myAssignments.length === 0) return tests.data;
    
    return tests.data.filter((test) => {
      const testClassId = test.classId?._id || test.classId;
      const testSubjectId = test.subjectId?._id || test.subjectId;
      
      // Check if this test's class+subject matches any of teacher's assignments
      return myAssignments.some((assignment) => {
        const aClassId = assignment.class_id?._id || assignment.classId?._id;
        const aSubjectId = assignment.subject_id?._id || assignment.subjectId?._id;
        return aClassId === testClassId && aSubjectId === testSubjectId;
      });
    });
  }, [tests, isTeacher, myAssignments]);

  // Check if teacher has any assignments (for empty state messaging)
  const hasNoAssignments = isTeacher && myAssignments.length === 0 && !assignmentsLoading;

  // ==================== MUTATIONS ====================
  
  const createMutation = useMutation({
    mutationFn: testsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create test'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => testsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update test'),
  });

  const deleteMutation = useMutation({
    mutationFn: testsAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tests'] }),
  });

  const publishMutation = useMutation({
    mutationFn: testsAPI.publishResults,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tests'] }),
  });

  const unpublishMutation = useMutation({
    mutationFn: testsAPI.unpublishResults,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tests'] }),
  });

  // ==================== MODAL SCROLL LOGIC ====================
  
  const handleModalScroll = () => {
    if (!modalBodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = modalBodyRef.current;
    const isScrolled = scrollTop > 50;
    const hasMoreContent = scrollTop + clientHeight < scrollHeight - 50;
    setShowModalScrollBtn(isScrolled && hasMoreContent);
  };

  const scrollModalToBottom = () => {
    modalBodyRef.current?.scrollTo({ top: modalBodyRef.current.scrollHeight, behavior: 'smooth' });
  };

  // ==================== FORM HANDLERS ====================
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // When class changes, reset subject and questions
    // because the available subjects will change based on class
    if (name === 'classId') {
      setFormData({
        ...formData,
        [name]: value,
        subjectId: '',
        questions: [],
        questionSetId: '',
      });
      setSelectedQuestionSet('');
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setError('');
  };

  const handleQuestionSetSelect = (e) => {
    const qsId = e.target.value;
    setSelectedQuestionSet(qsId);
    
    if (qsId) {
      const qs = questionSets?.data?.find((q) => q._id === qsId);
      if (qs) {
        setFormData({ ...formData, questions: qs.questions, questionSetId: qsId });
      }
    } else {
      setFormData({ ...formData, questions: [] });
    }
  };

  const handleOpenCreate = () => {
    // Prevent teachers with no assignments from creating tests
    if (isTeacher && myAssignments.length === 0) {
      setError('You have no class/subject assignments. Contact admin to get assigned.');
      return;
    }
    
    setEditingTest(null);
    setFormData({
      title: '',
      classId: '',
      subjectId: '',
      duration: 60,
      startDate: '',
      endDate: '',
      passMark: 50,
      instructions: '',
      questions: [],
      questionSetId: '',
    });
    setSelectedQuestionSet('');
    setError('');
    setShowModalScrollBtn(false);
    setShowModal(true);
  };

  const handleOpenEdit = (test) => {
    // Verify teacher is allowed to edit this test
    if (isTeacher) {
      const testClassId = test.classId?._id || test.classId;
      const testSubjectId = test.subjectId?._id || test.subjectId;
      const canEdit = myAssignments.some((a) => {
        const aClassId = a.class_id?._id || a.classId?._id;
        const aSubjectId = a.subject_id?._id || a.subjectId?._id;
        return aClassId === testClassId && aSubjectId === testSubjectId;
      });
      
      if (!canEdit) {
        setError('You do not have permission to edit this test.');
        return;
      }
    }
    
    setEditingTest(test);
    setFormData({
      title: test.title || '',
      classId: test.classId?._id || '',
      subjectId: test.subjectId?._id || '',
      duration: test.duration || 60,
      startDate: test.startDate ? new Date(test.startDate).toISOString().slice(0, 16) : '',
      endDate: test.endDate ? new Date(test.endDate).toISOString().slice(0, 16) : '',
      passMark: test.passMark || 50,
      instructions: test.instructions || '',
      questions: test.questions || [],
      questionSetId: '',
    });
    setSelectedQuestionSet('');
    setError('');
    setShowModalScrollBtn(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTest(null);
    setError('');
    setShowModalScrollBtn(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Final validation for teachers: ensure class+subject is in their assignments
    if (isTeacher) {
      const isAssigned = myAssignments.some((a) => {
        const aClassId = a.class_id?._id || a.classId?._id;
        const aSubjectId = a.subject_id?._id || a.subjectId?._id;
        return aClassId === formData.classId && aSubjectId === formData.subjectId;
      });
      
      if (!isAssigned) {
        setError('You are not assigned to this class and subject combination.');
        return;
      }
    }
    
    const submitData = {
      ...formData,
      duration: parseInt(formData.duration),
      passMark: parseInt(formData.passMark),
    };

    if (editingTest) {
      updateMutation.mutate({ id: editingTest._id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (test) => {
    // Verify teacher is allowed to delete this test
    if (isTeacher) {
      const testClassId = test.classId?._id || test.classId;
      const testSubjectId = test.subjectId?._id || test.subjectId;
      const canDelete = myAssignments.some((a) => {
        const aClassId = a.class_id?._id || a.classId?._id;
        const aSubjectId = a.subject_id?._id || a.subjectId?._id;
        return aClassId === testClassId && aSubjectId === testSubjectId;
      });
      
      if (!canDelete) {
        alert('You do not have permission to delete this test.');
        return;
      }
    }
    
    if (window.confirm(`Delete test "${test.title}"?`)) {
      deleteMutation.mutate(test._id);
    }
  };

  const handlePublish = (testId) => {
    if (window.confirm('Publish results? Students will be able to view their scores.')) {
      publishMutation.mutate(testId);
    }
  };

  const handleUnpublish = (testId) => {
    if (window.confirm('Unpublish results? Students will no longer see their scores.')) {
      unpublishMutation.mutate(testId);
    }
  };

  // ==================== HELPERS ====================
  
  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const getTestStatus = (test) => {
    const now = new Date();
    const start = new Date(test.startDate);
    const end = new Date(test.endDate);
    
    if (now < start) return { label: 'Upcoming', class: 'badge-info' };
    if (now >= start && now <= end) return { label: 'Active', class: 'badge-success' };
    return { label: 'Expired', class: 'badge-secondary' };
  };

  // ==================== LOADING STATE ====================
  
  if (userLoading || testsLoading || classesLoading || subjectsLoading || assignmentsLoading) {
    return <Loading message="Loading tests..." />;
  }

  // ==================== RENDER ====================
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Tests</h1>
          <p className="page-subtitle">
            {isTeacher 
              ? `Manage tests for your assigned classes and subjects (${myClasses.length} classes, ${allowedSubjectIds?.length || 0} subjects)` 
              : 'Manage all tests'
            }
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          + Create Test
        </button>
      </div>

      {/* Teacher Assignment Info Banner */}
      {isTeacher && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.2rem' }}>👤</span>
            <div>
              <strong>Your Assignments:</strong>
              {myAssignments.length === 0 ? (
                <span style={{ color: '#dc3545', marginLeft: '0.5rem' }}>
                  No class/subject assignments found. Contact your administrator.
                </span>
              ) : (
                <span style={{ marginLeft: '0.5rem' }}>
                  {myAssignments.map((a, idx) => (
                    <span 
                      key={a.id || idx} 
                      className="badge badge-info" 
                      style={{ marginRight: '0.25rem', marginBottom: '0.25rem' }}
                    >
                      {a.class_name} - {a.subject_name}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Assignments Empty State for Teachers */}
      {hasNoAssignments && (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📋</span>
            <h3>No Assignments Found</h3>
            <p style={{ color: '#6c757d', marginBottom: '1rem' }}>
              You haven't been assigned to any class and subject combination yet.
              Please contact your administrator to get assigned before you can manage tests.
            </p>
          </div>
        </div>
      )}

      {/* Tests Table */}
      {(!hasNoAssignments) && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Duration</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Questions</th>
                  <th>Results</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myTests?.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>
                      {isTeacher 
                        ? 'No tests found for your assigned classes and subjects' 
                        : 'No tests found'
                      }
                    </td>
                  </tr>
                ) : (
                  myTests?.map((test) => {
                    const status = getTestStatus(test);
                    return (
                      <tr key={test._id}>
                        <td><strong>{test.title}</strong></td>
                        <td>{test.classId?.name || '-'}</td>
                        <td>{test.subjectId?.name || '-'}</td>
                        <td>{test.duration} min</td>
                        <td>{formatDate(test.startDate)}</td>
                        <td>{formatDate(test.endDate)}</td>
                        <td><span className={`badge ${status.class}`}>{status.label}</span></td>
                        <td>{test.questions?.length || 0}</td>
                        <td>
                          {test.resultsPublished ? (
                            <span className="badge badge-success">Published</span>
                          ) : (
                            <span className="badge badge-secondary">Draft</span>
                          )}
                        </td>
                        <td>
                          <div className="btn-group">
                            <button className="btn btn-info btn-sm" onClick={() => handleOpenEdit(test)}>
                              Edit
                            </button>
                            {test.resultsPublished ? (
                              <button
                                className="btn btn-warning btn-sm"
                                onClick={() => handleUnpublish(test._id)}
                              >
                                Unpublish
                              </button>
                            ) : (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handlePublish(test._id)}
                              >
                                Publish
                              </button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(test)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTest ? 'Edit Test' : 'Create New Test'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            
            <div 
              className="modal-body" 
              ref={modalBodyRef} 
              onScroll={handleModalScroll}
              style={{ 
                position: 'relative', 
                overflowY: 'auto', 
                maxHeight: 'calc(100vh - 150px)' 
              }}
            >
              {error && <div className="alert alert-danger">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Test Title *</label>
                  <input
                    type="text"
                    name="title"
                    className="form-control"
                    value={formData.title}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Class *
                      {isTeacher && <span style={{ fontWeight: 'normal', color: '#6c757d' }}> (your assigned classes only)</span>}
                    </label>
                    <select
                      name="classId"
                      className="form-control form-select"
                      value={formData.classId}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Class</option>
                      {myClasses.map((cls) => (
                        <option key={cls._id} value={cls._id}>
                          {cls.name} - {cls.section}
                        </option>
                      ))}
                    </select>
                    {isTeacher && myClasses.length === 0 && (
                      <span className="form-text" style={{ color: '#dc3545' }}>
                        No classes assigned to you. Contact admin.
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Subject *
                      {isTeacher && <span style={{ fontWeight: 'normal', color: '#6c757d' }}> (for selected class)</span>}
                    </label>
                    <select
                      name="subjectId"
                      className="form-control form-select"
                      value={formData.subjectId}
                      onChange={handleChange}
                      required
                      disabled={!formData.classId}
                    >
                      <option value="">
                        {formData.classId ? '-- Select Subject --' : '-- Select a class first --'}
                      </option>
                      {mySubjectsForForm.map((subject) => (
                        <option key={subject._id} value={subject._id}>
                          {subject.name} ({subject.code})
                        </option>
                      ))}
                    </select>
                    {isTeacher && formData.classId && mySubjectsForForm.length === 0 && (
                      <span className="form-text" style={{ color: '#dc3545' }}>
                        No subjects assigned to you for this class.
                      </span>
                    )}
                  </div>
                </div>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Duration (minutes) *</label>
                    <input
                      type="number"
                      name="duration"
                      className="form-control"
                      value={formData.duration}
                      onChange={handleChange}
                      min="1"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pass Mark (%) *</label>
                    <input
                      type="number"
                      name="passMark"
                      className="form-control"
                      value={formData.passMark}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Questions</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.questions?.length || 0}
                      disabled
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="datetime-local"
                      name="startDate"
                      className="form-control"
                      value={formData.startDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input
                      type="datetime-local"
                      name="endDate"
                      className="form-control"
                      value={formData.endDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Load from Question Set</label>
                  <select
                    className="form-control form-select"
                    value={selectedQuestionSet}
                    onChange={handleQuestionSetSelect}
                    disabled={!formData.classId || !formData.subjectId}
                  >
                    <option value="">
                      {!formData.classId || !formData.subjectId 
                        ? '-- Select class and subject first --' 
                        : '-- Select Question Set --'}
                    </option>
                    {questionSets?.data?.map((qs) => (
                      <option key={qs._id} value={qs._id}>
                        {qs.title} ({qs.questions?.length} questions)
                      </option>
                    ))}
                  </select>
                  {formData.questions?.length > 0 && (
                    <span className="form-text">{formData.questions.length} questions loaded</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Instructions</label>
                  <textarea
                    name="instructions"
                    className="form-control"
                    value={formData.instructions}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Enter any special instructions for students..."
                  />
                </div>
                <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Test'}
                  </button>
                </div>
              </form>

              {/* Scroll to Bottom Button inside Modal */}
              {showModalScrollBtn && (
                <button 
                  type="button"
                  onClick={scrollModalToBottom}
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '50px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 25px rgba(99, 102, 241, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.4)';
                  }}
                >
                  Scroll Down <span style={{fontSize: '1rem'}}>⬇</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageTests;