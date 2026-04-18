import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionSetsAPI, classesAPI, subjectsAPI, dashboardAPI, getUserRole } from '../../api';
import Loading from '../common/Loading';

const QuestionSetManager = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const modalBodyRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [inputMethod, setInputMethod] = useState('manual');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [formData, setFormData] = useState({
    title: '',
    classId: '',
    subjectId: '',
    questions: [{ questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' }],
  });
  const [error, setError] = useState('');

  // ==================== USER ROLE CONTEXT ====================
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userRole = getUserRole();
  const isTeacher = userRole === 'teacher';
  const teacherId = user?._id || user?.id;

  // ==================== QUERIES ====================
  
  const { data: questionSets, isPending: qsPending } = useQuery({ 
    queryKey: ['questionSets'], 
    queryFn: questionSetsAPI.getAll 
  });
  
  const { data: classes, isPending: classesPending } = useQuery({ 
    queryKey: ['classes'], 
    queryFn: () => classesAPI.getAll({ limit: 100 }) 
  });
  
  const { data: subjects, isPending: subjectsPending } = useQuery({ 
    queryKey: ['subjects'], 
    queryFn: subjectsAPI.getAll 
  });

  // Admin view: Get all assignments to map teachers to sets
  const { data: allTeacherAssignments } = useQuery({
    queryKey: ['teacherAssignments'],
    queryFn: dashboardAPI.getTeacherAssignments,
    enabled: !isTeacher && !showModal, 
  });

  // Teacher view: Get ONLY their specific assignments
  const { data: myAssignments, isPending: myAssignmentsPending } = useQuery({
    queryKey: ['my-assignments', teacherId],
    queryFn: () => dashboardAPI.getAssignmentsByTeacher(teacherId),
    enabled: isTeacher && !!teacherId,
  });

  // Modal view: Fetch class assignments (used ONLY for showing assigned teacher badge for Admins)
  const { data: classAssignments } = useQuery({
    queryKey: ['classAssignments', formData.classId],
    queryFn: () => dashboardAPI.getAssignmentsByClass(formData.classId),
    enabled: !!formData.classId && showModal && !isTeacher,
  });

  // ==================== MUTATIONS ====================

  const createMutation = useMutation({
    mutationFn: questionSetsAPI.create,
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['questionSets'] }); 
      handleCloseModal(); 
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create question set'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => questionSetsAPI.update(id, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['questionSets'] }); 
      handleCloseModal(); 
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        setError('Authorization failed. Your backend might not be configured to allow teachers to edit sets they are assigned to (only sets they created). Please update your backend controller.');
      } else {
        setError(err.response?.data?.message || 'Failed to update question set');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: questionSetsAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questionSets'] }),
    onError: (err) => {
      alert(err.response?.data?.message || 'Failed to delete question set. You might not have permission.');
    },
  });

  // ==================== HELPERS (MOVED BEFORE useMemo) ====================

  const formatName = (name) => {
    if (!name) return '';
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getAssignedTeacher = (classId, subjectId, assignmentsData) => {
    if (!assignmentsData?.data || !classId || !subjectId) return null;
    const classIdStr = classId.toString();
    const subjectIdStr = subjectId.toString();
    
    return assignmentsData.data.find((a) => {
      const aClassId = (a.class_id?._id || a.class_id || a.classId?._id || a.classId)?.toString();
      const aSubjectId = (a.subject_id?._id || a.subject_id || a.subjectId?._id || a.subjectId)?.toString();
      return aClassId === classIdStr && aSubjectId === subjectIdStr;
    });
  };

  const getTeacherDisplayInfo = (assignment) => {
    if (!assignment) return null;
    const name = assignment.teacher_name || 
      `${assignment.teacher_id?.firstName || ''} ${assignment.teacher_id?.lastName || ''}`.trim();
    return name || null;
  };

  // ==================== DERIVED DATA & FILTERING ====================

  // 1. Filter Classes (Teachers ONLY see assigned classes)
  const availableClasses = useMemo(() => {
    if (!classes?.data) return [];
    if (!isTeacher) return classes.data;
    
    if (!myAssignments?.data) return [];
    const assignedClassIds = new Set(
      myAssignments.data.map(a => (a.class_id?._id || a.class_id)?.toString()).filter(Boolean)
    );
    return classes.data.filter(c => assignedClassIds.has(c._id));
  }, [isTeacher, classes?.data, myAssignments?.data]);

  // 2. Filter Subjects 
  //    - Teachers: ONLY see subjects assigned to them for the selected class
  //    - Admins: See ALL subjects (no filtering)
  const availableSubjects = useMemo(() => {
    if (!subjects?.data) return [];
    
    // Teacher: Filter subjects based on their assignments for the selected class
    if (isTeacher) {
      if (!formData.classId || !myAssignments?.data) return [];
      return subjects.data.filter(sub => 
        myAssignments.data.some(a => {
          const aClassId = (a.class_id?._id || a.class_id)?.toString();
          const aSubjectId = (a.subject_id?._id || a.subject_id)?.toString();
          return aClassId === formData.classId && aSubjectId === sub._id;
        })
      );
    } 
    
    // Admin: See ALL subjects unconditionally
    return subjects.data;
  }, [isTeacher, formData.classId, subjects?.data, myAssignments?.data]);

  // 3. Filter Question Sets - Teachers ONLY see sets for their assigned subjects
  const filteredQuestionSets = useMemo(() => {
    if (!questionSets?.data) return [];
    
    // Admin sees all question sets
    if (!isTeacher) return questionSets.data;
    
    // Teacher: Only show question sets that match their class/subject assignments
    if (!myAssignments?.data) return [];
    
    const assignedPairs = myAssignments.data.map(a => ({
      classId: (a.class_id?._id || a.class_id)?.toString(),
      subjectId: (a.subject_id?._id || a.subject_id)?.toString(),
    })).filter(pair => pair.classId && pair.subjectId);
    
    return questionSets.data.filter(qs => {
      const qsClassId = (qs.classId?._id || qs.classId)?.toString();
      const qsSubjectId = (qs.subjectId?._id || qs.subjectId)?.toString();
      
      return assignedPairs.some(pair => 
        pair.classId === qsClassId && pair.subjectId === qsSubjectId
      );
    });
  }, [isTeacher, questionSets?.data, myAssignments?.data]);

  // 4. Assigned Teacher for Modal Display (Admins only)
  const currentAssignedTeacher = !isTeacher && formData.classId && formData.subjectId
    ? getAssignedTeacher(formData.classId, formData.subjectId, classAssignments)
    : null;

  // ==================== SAMPLE JSON ====================
  const sampleJSON = `[
  {
    "questionText": "What is the chemical symbol for water?",
    "options": ["H2O", "CO2", "NaCl", "O2"],
    "correctAnswer": 0,
    "difficulty": "easy",
    "explanation": "H2O consists of two hydrogen atoms and one oxygen atom."
  }
]`;

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(sampleJSON);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ==================== SCROLL HANDLERS ====================
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollBtn(scrollHeight - (scrollTop + clientHeight) >= 100);
  };

  const scrollToBottom = () => {
    modalBodyRef.current?.scrollTo({ top: modalBodyRef.current.scrollHeight, behavior: 'smooth' });
  };

  // ==================== FORM HANDLERS ====================
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'classId') {
      setFormData(prev => ({ ...prev, classId: value, subjectId: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError('');
  };

  const handleQuestionChange = (field, value) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[currentQuestionIndex][field] = value;
    setFormData({ ...formData, questions: updatedQuestions });
  };

  const handleOptionChange = (optionIndex, value) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[currentQuestionIndex].options[optionIndex] = value;
    setFormData({ ...formData, questions: updatedQuestions });
  };

  const handleAddOption = () => {
    const updatedQuestions = [...formData.questions];
    if (updatedQuestions[currentQuestionIndex].options.length >= 8) return;
    updatedQuestions[currentQuestionIndex].options.push('');
    setFormData({ ...formData, questions: updatedQuestions });
  };

  const handleRemoveOption = (index) => {
    const updatedQuestions = [...formData.questions];
    const currentOpts = updatedQuestions[currentQuestionIndex].options;
    if (currentOpts.length <= 2) return;
    const correctText = currentOpts[updatedQuestions[currentQuestionIndex].correctAnswer];
    currentOpts.splice(index, 1);
    let newCorrect = currentOpts.indexOf(correctText);
    if (newCorrect === -1) newCorrect = 0;
    updatedQuestions[currentQuestionIndex].correctAnswer = newCorrect;
    setFormData({ ...formData, questions: updatedQuestions });
  };

  const handleDuplicateQuestion = () => {
    const updatedQuestions = [...formData.questions];
    const clonedQuestion = JSON.parse(JSON.stringify(updatedQuestions[currentQuestionIndex]));
    updatedQuestions.splice(currentQuestionIndex + 1, 0, clonedQuestion);
    setFormData({ ...formData, questions: updatedQuestions });
    setCurrentQuestionIndex(prev => prev + 1);
  };

  const handleShuffleOptions = () => {
    const updatedQuestions = [...formData.questions];
    const q = { ...updatedQuestions[currentQuestionIndex] };
    const optionsCopy = [...q.options];
    const correctText = optionsCopy[q.correctAnswer]; 
    for (let i = optionsCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionsCopy[i], optionsCopy[j]] = [optionsCopy[j], optionsCopy[i]];
    }
    q.options = optionsCopy;
    q.correctAnswer = optionsCopy.indexOf(correctText); 
    if (q.correctAnswer === -1) q.correctAnswer = 0;
    updatedQuestions[currentQuestionIndex] = q;
    setFormData({ ...formData, questions: updatedQuestions });
  };

  const handleNext = () => {
    if (currentQuestionIndex < formData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      const newQuestion = { questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' };
      setFormData(prev => ({ ...prev, questions: [...prev.questions, newQuestion] }));
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const removeQuestion = () => {
    if (formData.questions.length <= 1) return;
    const updatedQuestions = formData.questions.filter((_, i) => i !== currentQuestionIndex);
    setFormData({ ...formData, questions: updatedQuestions });
    if (currentQuestionIndex >= updatedQuestions.length) setCurrentQuestionIndex(updatedQuestions.length - 1);
  };

  // ==================== FILE & EXPORT HANDLERS ====================
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let parsedQuestions = [];
        const text = event.target.result;
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          if (!Array.isArray(json)) throw new Error("JSON must be an array of questions.");
          parsedQuestions = json.map(q => ({ 
            questionText: q.questionText || '', 
            options: Array.isArray(q.options) ? q.options : ['', ''], 
            correctAnswer: parseInt(q.correctAnswer) || 0, 
            difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium', 
            explanation: q.explanation || '' 
          }));
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(line => line.trim() !== '');
          if (lines.length < 2) throw new Error("CSV is empty or missing headers.");
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length >= 6) {
              const opts = [cols[1] || '', cols[2] || '', cols[3] || '', cols[4] || ''].filter(opt => opt !== null);
              parsedQuestions.push({ 
                questionText: cols[0], 
                options: opts, 
                correctAnswer: parseInt(cols[5]) || 0, 
                difficulty: ['easy', 'medium', 'hard'].includes(cols[6]) ? cols[6] : 'medium', 
                explanation: cols[7] || '' 
              });
            }
          }
        } else { 
          throw new Error("Invalid file type. Please upload .json or .csv"); 
        }
        if (parsedQuestions.length === 0) throw new Error("No valid questions found in the file.");
        setFormData(prev => ({ ...prev, questions: parsedQuestions }));
        setCurrentQuestionIndex(0); 
        setError(''); 
        setInputMethod('manual');
      } catch (err) { 
        setError(`Upload failed: ${err.message}`); 
      } finally { 
        e.target.value = ''; 
      }
    };
    reader.readAsText(file);
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(formData.questions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `${formData.title || 'question-set'}.json`;
    document.body.appendChild(a); 
    a.click();
    window.URL.revokeObjectURL(url); 
    document.body.removeChild(a);
  };

  // ==================== MODAL STATE HANDLERS ====================
  const handleOpenCreate = () => {
    setEditingSet(null);
    setFormData({ 
      title: '', 
      classId: '', 
      subjectId: '', 
      questions: [{ questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' }] 
    });
    setCurrentQuestionIndex(0); 
    setInputMethod('manual'); 
    setError(''); 
    setShowModal(true); 
    setShowScrollBtn(false); 
    setCopied(false);
  };

  const handleOpenEdit = (qs) => {
    setEditingSet(qs);
    setFormData({ 
      title: qs.title || '', 
      classId: qs.classId?._id || qs.classId || '', 
      subjectId: qs.subjectId?._id || qs.subjectId || '', 
      questions: qs.questions && qs.questions.length > 0 
        ? qs.questions 
        : [{ questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' }] 
    });
    setCurrentQuestionIndex(0); 
    setInputMethod('manual'); 
    setError(''); 
    setShowModal(true); 
    setShowScrollBtn(false); 
    setCopied(false);
  };

  const handleCloseModal = () => { 
    setShowModal(false); 
    setEditingSet(null); 
    setError(''); 
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validQuestions = formData.questions.filter(q => 
      q.questionText.trim() !== '' && q.options.filter(o => o.trim() !== '').length >= 2
    );
    if (validQuestions.length === 0) { 
      setError('Questions must have text and at least 2 non-empty options'); 
      return; 
    }
    const submitData = { ...formData, questions: validQuestions };
    if (editingSet) { 
      updateMutation.mutate({ id: editingSet._id, data: submitData }); 
    } else { 
      createMutation.mutate(submitData); 
    }
  };

  const handleDelete = (qs) => { 
    if (window.confirm(`Delete question set "${qs.title}"?`)) 
      deleteMutation.mutate(qs._id); 
  };

  // ==================== LOADING & STATE ====================
  const isLoading = qsPending || classesPending || subjectsPending || (isTeacher && myAssignmentsPending);
  if (isLoading) return <Loading message="Loading question sets..." />;

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const currentQuestion = formData.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === formData.questions.length - 1;
  const tableColSpan = isTeacher ? 4 : 7;

  const styles = {
    overlay: { 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
    },
    modal: { 
      background: '#f8fafc', borderRadius: '16px', 
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
      display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '900px', 
      height: '90vh', maxHeight: '90vh', overflow: 'hidden' 
    },
    header: { 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
      padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff' 
    },
    body: { 
      flex: 1, overflowY: 'auto', padding: '1.5rem', position: 'relative', scrollBehavior: 'smooth' 
    },
    footer: { 
      display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', 
      padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#ffffff' 
    },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
    input: { 
      width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', 
      borderRadius: '8px', fontSize: '0.875rem', background: '#ffffff', 
      transition: 'all 0.2s', outline: 'none', boxSizing: 'border-box' 
    },
    label: { fontSize: '0.875rem', fontWeight: '600', color: '#334155' },
    card: { 
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', 
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden', marginTop: '1.25rem' 
    },
    cardHeader: { 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
      padding: '0.875rem 1.25rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' 
    },
    cardBody: { padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
    optionWrapper: (isCorrect) => ({ 
      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', 
      border: `2px solid ${isCorrect ? '#6366f1' : '#e2e8f0'}`, borderRadius: '10px', 
      background: isCorrect ? '#eef2ff' : '#ffffff', transition: 'all 0.2s' 
    }),
    radioCustom: (isCorrect) => ({ 
      width: '20px', height: '20px', borderRadius: '50%', 
      border: `2px solid ${isCorrect ? '#6366f1' : '#94a3b8'}`, 
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, 
      background: isCorrect ? '#6366f1' : 'transparent', cursor: 'pointer' 
    }),
    scrollBtn: { 
      position: 'sticky', bottom: '20px', float: 'right', clear: 'both', marginRight: '10px', 
      width: '44px', height: '44px', borderRadius: '50%', border: 'none', 
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', 
      boxShadow: '0 8px 16px rgba(99, 102, 241, 0.4)', cursor: 'pointer', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      transition: 'all 0.3s ease', opacity: showScrollBtn ? 1 : 0, 
      visibility: showScrollBtn ? 'visible' : 'hidden', 
      transform: showScrollBtn ? 'translateY(0)' : 'translateY(20px)', zIndex: 50 
    },
    navBar: { 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
      marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' 
    },
    teacherBadge: { 
      display: 'inline-flex', alignItems: 'center', gap: '0.375rem', 
      padding: '0.25rem 0.625rem', borderRadius: '20px', fontSize: '0.75rem', 
      fontWeight: 500, background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' 
    },
    noTeacherBadge: { 
      display: 'inline-flex', alignItems: 'center', gap: '0.375rem', 
      padding: '0.25rem 0.625rem', borderRadius: '20px', fontSize: '0.75rem', 
      fontWeight: 500, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' 
    }
  };

  return (
    <div>
      <div className="page-header-actions">
        <div>
          <h1 className="page-title">Question Sets</h1>
          <p className="page-subtitle">
            {isTeacher 
              ? 'Manage question sets for your assigned subjects' 
              : 'Create and manage question sets for tests'
            }
          </p>
        </div>
        
        {!(isTeacher && availableClasses.length === 0) && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>+ Create Question Set</button>
        )}
      </div>

      {isTeacher && availableClasses.length === 0 && (
        <div className="card" style={{ borderColor: '#fde68a' }}>
          <div style={{ padding: '2rem', textAlign: 'center', color: '#92400e' }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>No Access Granted</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              You have not been assigned to any classes or subjects yet. Please contact the administrator.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Class</th>
                <th>Subject</th>
                {!isTeacher && <th>Assigned Teacher</th>}
                <th>Questions</th>
                {!isTeacher && <th>Created By</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestionSets.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="table-empty-state">
                    {isTeacher 
                      ? 'No question sets found for your assigned subjects' 
                      : 'No question sets found'
                    }
                  </td>
                </tr>
              ) : (
                filteredQuestionSets.map((qs) => {
                  const qsClassId = qs.classId?._id || qs.classId;
                  const qsSubjectId = qs.subjectId?._id || qs.subjectId;
                  const teacherAssignment = !isTeacher 
                    ? getAssignedTeacher(qsClassId, qsSubjectId, allTeacherAssignments) 
                    : null;
                  const teacherName = getTeacherDisplayInfo(teacherAssignment);
                  
                  return (
                    <tr key={qs._id}>
                      <td><strong>{qs.title}</strong></td>
                      <td>{qs.classId?.name || '-'}</td>
                      <td>{qs.subjectId?.name || '-'}</td>

                      {!isTeacher && (
                        <td>
                          {teacherName ? (
                            <span style={styles.teacherBadge}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                              {formatName(teacherName)}
                            </span>
                          ) : (
                            <span style={styles.noTeacherBadge}>Not Assigned</span>
                          )}
                        </td>
                      )}
                      
                      <td>
                        <span className="badge badge-primary">{qs.questions?.length || 0}</span>
                      </td>
                      
                      {!isTeacher && (
                        <td>
                          {qs.teacherId 
                            ? `${qs.teacherId.firstName || ''} ${qs.teacherId.lastName || ''}`.trim() || '-' 
                            : '-'
                          }
                        </td>
                      )}
                      
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-info btn-sm" onClick={() => handleOpenEdit(qs)}>
                            Edit
                          </button>
                          <button 
                            className="btn btn-danger btn-sm" 
                            onClick={() => handleDelete(qs)} 
                            disabled={deleteMutation.isPending}
                          >
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

      {showModal && (
        <div style={styles.overlay} onClick={handleCloseModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                {editingSet ? 'Edit Question Set' : 'Create New Question Set'}
              </h3>
              <button 
                onClick={handleCloseModal} 
                style={{ 
                  background: 'none', border: 'none', fontSize: '1.5rem', 
                  color: '#64748b', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1 
                }}
              >
                ×
              </button>
            </div>
            
            <div ref={modalBodyRef} onScroll={handleScroll} style={styles.body}>
              {error && (
                <div style={{ 
                  padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', 
                  borderRadius: '8px', color: '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem' 
                }}>
                  {error}
                </div>
              )}
              
              <div style={{ 
                display: 'flex', gap: '0.5rem', background: '#e2e8f0', 
                padding: '4px', borderRadius: '10px', width: 'fit-content' 
              }}>
                <button 
                  type="button" 
                  onClick={() => setInputMethod('manual')} 
                  style={{ 
                    padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', 
                    fontWeight: 500, fontSize: '0.875rem', transition: 'all 0.2s', 
                    background: inputMethod === 'manual' ? '#ffffff' : 'transparent', 
                    color: inputMethod === 'manual' ? '#0f172a' : '#64748b', 
                    boxShadow: inputMethod === 'manual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' 
                  }}
                >
                  ✍️ Manual Entry
                </button>
                <button 
                  type="button" 
                  onClick={() => setInputMethod('upload')} 
                  style={{ 
                    padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', 
                    fontWeight: 500, fontSize: '0.875rem', transition: 'all 0.2s', 
                    background: inputMethod === 'upload' ? '#ffffff' : 'transparent', 
                    color: inputMethod === 'upload' ? '#0f172a' : '#64748b', 
                    boxShadow: inputMethod === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' 
                  }}
                >
                  📁 Upload File
                </button>
                {inputMethod === 'manual' && formData.questions.length > 0 && (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', padding: '0 0.75rem', 
                    fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 
                  }}>
                    {formData.questions.length} Questions
                  </div>
                )}
              </div>

              {inputMethod === 'upload' && (
                <div>
                  <div 
                    onClick={() => fileInputRef.current.click()} 
                    style={{ 
                      marginTop: '1.5rem', border: '2px dashed #cbd5e1', borderRadius: '12px', 
                      padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer', 
                      background: '#f8fafc', transition: 'all 0.2s' 
                    }} 
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.borderColor = '#6366f1'; 
                      e.currentTarget.style.background = '#eef2ff'; 
                    }} 
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.borderColor = '#cbd5e1'; 
                      e.currentTarget.style.background = '#f8fafc'; 
                    }}
                  >
                    <input 
                      type="file" 
                      accept=".json, .csv" 
                      style={{ display: 'none' }} 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                    />
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>☁️</div>
                    <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>Click to upload JSON or CSV</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                      After uploading, you can review and edit the questions.
                    </p>
                  </div>
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                      marginBottom: '0.5rem' 
                    }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#334155' }}>
                        Sample JSON Format
                      </span>
                      <button 
                        type="button" 
                        onClick={handleCopyJSON} 
                        style={{ 
                          padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #334155', 
                          background: 'transparent', color: '#334155', cursor: 'pointer', 
                          fontSize: '0.75rem', fontWeight: 600, display: 'flex', 
                          alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s' 
                        }} 
                        onMouseEnter={(e) => { 
                          e.currentTarget.style.background = '#334155'; 
                          e.currentTarget.style.color = '#fff'; 
                        }} 
                        onMouseLeave={(e) => { 
                          e.currentTarget.style.background = 'transparent'; 
                          e.currentTarget.style.color = '#334155'; 
                        }}
                      >
                        {copied ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div style={{ 
                      background: '#1e293b', borderRadius: '10px', padding: '1rem', 
                      overflow: 'auto', maxHeight: '250px' 
                    }}>
                      <pre style={{ 
                        color: '#e2e8f0', fontSize: '0.8rem', margin: 0, 
                        fontFamily: "'Fira Code', 'Courier New', monospace", 
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.5' 
                      }}>
                        {sampleJSON}
                      </pre>
                    </div>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      * <strong>correctAnswer</strong> is the index of the correct option (starts at 0).
                    </p>
                  </div>
                </div>
              )}

              {inputMethod === 'manual' && currentQuestion && (
                <form onSubmit={handleSubmit} id="question-set-form" style={{ overflow: 'visible' }}>
                  <div style={{ 
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                    gap: '1rem' 
                  }}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Set Title *</label>
                      <input 
                        type="text" name="title" style={styles.input} 
                        value={formData.title} onChange={handleChange} 
                        required placeholder="e.g., Midterm Science" 
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Class *</label>
                      <select 
                        name="classId" style={styles.input} 
                        value={formData.classId} onChange={handleChange} required
                      >
                        <option value="">Select Class</option>
                        {availableClasses.map((cls) => (
                          <option key={cls._id} value={cls._id}>{cls.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Subject *</label>
                      <select 
                        name="subjectId" style={styles.input} 
                        value={formData.subjectId} onChange={handleChange} required
                      >
                        <option value="">Select Subject</option>
                        {availableSubjects.map((sub) => (
                          <option key={sub._id} value={sub._id}>{sub.name}</option>
                        ))}
                      </select>
                      {isTeacher && formData.classId && availableSubjects.length === 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '0.25rem' }}>
                          You are not assigned to any subjects for this class.
                        </span>
                      )}
                    </div>
                  </div>

                  {currentAssignedTeacher ? (
                    <div style={{ 
                      marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#eef2ff', 
                      border: '1px solid #c7d2fe', borderRadius: '10px', 
                      display: 'flex', alignItems: 'center', gap: '0.75rem' 
                    }}>
                      <div style={{ 
                        width: '36px', height: '36px', borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        color: '#fff', fontWeight: 600, fontSize: '0.875rem' 
                      }}>
                        {formatName(getTeacherDisplayInfo(currentAssignedTeacher) || '')
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#312e81' }}>
                          {formatName(getTeacherDisplayInfo(currentAssignedTeacher) || '')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6366f1' }}>
                          Assigned Teacher for this Class & Subject
                        </div>
                      </div>
                    </div>
                  ) : !isTeacher && formData.classId && formData.subjectId ? (
                    <div style={{ 
                      marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#fef3c7', 
                      border: '1px solid #fde68a', borderRadius: '10px', 
                      display: 'flex', alignItems: 'center', gap: '0.75rem' 
                    }}>
                      <div style={{ 
                        width: '36px', height: '36px', borderRadius: '50%', background: '#f59e0b', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' 
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#92400e' }}>
                          No Teacher Assigned
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                          No teacher is assigned to this class and subject combination. You can still create the question set.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div style={styles.card}>
                    <div style={styles.cardHeader}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        Question {currentQuestionIndex + 1}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          type="button" onClick={handleShuffleOptions} 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
                        >
                          🔀 Shuffle
                        </button>
                        <button 
                          type="button" onClick={handleDuplicateQuestion} 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
                        >
                          📋 Clone
                        </button>
                        {currentQuestion.options.length < 8 && (
                          <button 
                            type="button" onClick={handleAddOption} 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer' }}
                          >
                            + Option
                          </button>
                        )}
                        {formData.questions.length > 1 && (
                          <button 
                            type="button" onClick={removeQuestion} 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer' }}
                          >
                            🗑️ Del Q
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div style={styles.cardBody}>
                      <div style={styles.inputGroup}>
                        <label style={styles.label}>Question Text *</label>
                        <textarea 
                          rows={3} 
                          style={{...styles.input, resize: 'vertical', fontFamily: 'inherit'}} 
                          value={currentQuestion.questionText} 
                          onChange={(e) => handleQuestionChange('questionText', e.target.value)} 
                          required placeholder="Type your question here..." 
                        />
                      </div>
                      
                      <div style={styles.inputGroup}>
                        <label style={{...styles.label, marginBottom: '0.5rem'}}>
                          Options (Click circle to set correct answer)
                        </label>
                        <div style={{ 
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                          gap: '0.75rem' 
                        }}>
                          {currentQuestion.options.map((opt, optIndex) => {
                            const isCorrect = currentQuestion.correctAnswer === optIndex;
                            return (
                              <div key={optIndex} style={styles.optionWrapper(isCorrect)}>
                                <div 
                                  style={styles.radioCustom(isCorrect)} 
                                  onClick={() => handleQuestionChange('correctAnswer', optIndex)}
                                >
                                  {isCorrect && (
                                    <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                                  )}
                                </div>
                                <input 
                                  type="text" 
                                  style={{ 
                                    flex: 1, border: 'none', outline: 'none', fontSize: '0.875rem', 
                                    background: 'transparent', color: '#334155' 
                                  }} 
                                  placeholder={`Option ${String.fromCharCode(65 + optIndex)}`} 
                                  value={opt} 
                                  onChange={(e) => handleOptionChange(optIndex, e.target.value)} 
                                  required={optIndex < 2} 
                                />
                                {currentQuestion.options.length > 2 && (
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveOption(optIndex)} 
                                    style={{ 
                                      background: 'none', border: 'none', color: '#94a3b8', 
                                      cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: 0 
                                    }} 
                                    onMouseEnter={(e) => e.target.style.color = '#ef4444'} 
                                    onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ 
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                        gap: '1rem' 
                      }}>
                        <div style={styles.inputGroup}>
                          <label style={styles.label}>Difficulty</label>
                          <select 
                            style={styles.input} 
                            value={currentQuestion.difficulty} 
                            onChange={(e) => handleQuestionChange('difficulty', e.target.value)}
                          >
                            <option value="easy">🟢 Easy</option>
                            <option value="medium">🟡 Medium</option>
                            <option value="hard">🔴 Hard</option>
                          </select>
                        </div>
                        <div style={styles.inputGroup}>
                          <label style={styles.label}>Explanation (Optional)</label>
                          <input 
                            type="text" style={styles.input} 
                            value={currentQuestion.explanation || ''} 
                            onChange={(e) => handleQuestionChange('explanation', e.target.value)} 
                            placeholder="Why is this the correct answer?" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={styles.navBar}>
                    <button 
                      type="button" onClick={handlePrev} disabled={currentQuestionIndex === 0} 
                      style={{ 
                        padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', 
                        background: '#fff', cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer', 
                        fontWeight: 500, fontSize: '0.875rem', 
                        color: currentQuestionIndex === 0 ? '#94a3b8' : '#334155', 
                        opacity: currentQuestionIndex === 0 ? 0.5 : 1 
                      }}
                    >
                      ← Previous
                    </button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>
                      Q {currentQuestionIndex + 1} of {formData.questions.length}
                    </span>
                    <button 
                      type="button" onClick={handleNext} 
                      style={{ 
                        padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', 
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
                        color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem', 
                        boxShadow: '0 4px 6px rgba(99, 102, 241, 0.2)' 
                      }}
                    >
                      {isLastQuestion ? '+ Add Next Question' : 'Next →'}
                    </button>
                  </div>

                  <button 
                    type="button" onClick={scrollToBottom} style={styles.scrollBtn} title="Scroll to bottom"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </form>
              )}
            </div>

            {inputMethod === 'manual' && (
              <div style={styles.footer}>
                <button 
                  type="button" className="btn btn-secondary" onClick={handleCloseModal} 
                  style={{ borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button 
                  type="button" onClick={handleExportJSON} 
                  disabled={formData.questions.length === 0} 
                  style={{ 
                    padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #f59e0b', 
                    background: '#fff', color: '#d97706', 
                    cursor: formData.questions.length === 0 ? 'not-allowed' : 'pointer', 
                    fontWeight: 500, fontSize: '0.875rem' 
                  }}
                >
                  ⬇ Export JSON
                </button>
                <button 
                  type="submit" form="question-set-form" disabled={isSaving} 
                  style={{ 
                    padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', 
                    background: isSaving ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
                    color: '#fff', cursor: isSaving ? 'not-allowed' : 'pointer', 
                    fontWeight: 600, fontSize: '0.875rem', 
                    boxShadow: '0 4px 6px rgba(99, 102, 241, 0.2)' 
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Question Set'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionSetManager;