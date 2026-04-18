import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardAPI } from '../../api';
import Loading from '../common/Loading';
import './AssignTeachers.css';

// ==================== SCROLLABLE SELECT COMPONENT ====================
const ScrollableSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  label,
  required,
  id,
  optionRenderer,
  searchPlaceholder,
  noOptionsText,
  footerLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div className="scrollable-select-wrapper" ref={dropdownRef}>
      {label && (
        <label htmlFor={id}>
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      <div 
        className={`scrollable-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`scrollable-select-value ${!selectedOption ? 'placeholder' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="scrollable-select-actions">
          {value && (
            <button 
              className="scrollable-select-clear" 
              onClick={handleClear}
              type="button"
            >
              ×
            </button>
          )}
          <span className={`scrollable-select-arrow ${isOpen ? 'rotated' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 8L1 3h10z" fill="#6b7280"/>
            </svg>
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="scrollable-select-dropdown">
          <div className="scrollable-select-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder || 'Search...'}
              className="scrollable-select-search-input"
            />
            {searchTerm && (
              <button 
                className="scrollable-select-search-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                }}
                type="button"
              >
                ×
              </button>
            )}
          </div>
          <div className="scrollable-select-list">
            {filteredOptions.length === 0 ? (
              <div className="scrollable-select-no-options">
                {noOptionsText || 'No options found'}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`scrollable-select-option ${option.value === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {optionRenderer ? optionRenderer(option) : option.label}
                </div>
              ))
            )}
          </div>
          <div className="scrollable-select-footer">
            {filteredOptions.length} of {options.length} {footerLabel || 'options'}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================

const AssignTeachers = () => {
  const queryClient = useQueryClient();
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    teacher_id: '',
    class_id: '',
    subject_id: '',
  });
  
  // Filter state
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [searchTeacher, setSearchTeacher] = useState('');
  
  // Notification state
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // ==================== QUERIES ====================
  
  const { data: teachersData, isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: dashboardAPI.getTeachers,
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['classes-list'],
    queryFn: dashboardAPI.getClasses,
  });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: dashboardAPI.getSubjects,
  });

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: dashboardAPI.getTeacherAssignments,
  });

  // ==================== MUTATIONS ====================
  
  const assignmentMutation = useMutation({
    mutationFn: (data) => {
      if (editingId) {
        return dashboardAPI.updateTeacherAssignment(editingId, data);
      }
      return dashboardAPI.createTeacherAssignment(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      showNotification('success', editingId ? 'Assignment updated successfully!' : 'Assignment created successfully!');
      resetForm();
    },
    onError: (error) => {
      showNotification('error', error?.response?.data?.message || 'Failed to save assignment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => dashboardAPI.deleteTeacherAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      showNotification('success', 'Assignment removed successfully!');
    },
    onError: (error) => {
      showNotification('error', error?.response?.data?.message || 'Failed to delete assignment');
    },
  });

  // ==================== DERIVED DATA ====================
  
  const teachers = teachersData?.data || [];
  const classes = classesData?.data || [];
  const subjects = subjectsData?.data || [];
  const assignments = assignmentsData?.data || [];

  // Format options for ScrollableSelect
  const teacherOptions = useMemo(() => {
    return teachers.map((teacher) => ({
      value: teacher._id,
      label: `${teacher.firstName} ${teacher.lastName} (${teacher.email})`,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
    }));
  }, [teachers]);

  const classOptions = useMemo(() => {
    return classes.map((cls) => ({
      value: cls._id,
      label: `${cls.name}${cls.section ? ` - ${cls.section}` : ''}${cls.level ? ` (${cls.level})` : ''}`,
      name: cls.name,
      section: cls.section,
      level: cls.level,
    }));
  }, [classes]);

  const subjectOptions = useMemo(() => {
    return subjects.map((subject) => ({
      value: subject._id,
      label: `${subject.name} (${subject.code})`,
      name: subject.name,
      code: subject.code,
    }));
  }, [subjects]);

  // Filter assignments based on search criteria
  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const aClassId = assignment.class_id?._id || assignment.classId?._id;
      const aSubjectId = assignment.subject_id?._id || assignment.subjectId?._id;
      
      const matchClass = !filterClass || aClassId === filterClass;
      const matchSubject = !filterSubject || aSubjectId === filterSubject;
      const matchTeacher = !searchTeacher || 
        assignment.teacher_name?.toLowerCase().includes(searchTeacher.toLowerCase()) ||
        assignment.teacher_email?.toLowerCase().includes(searchTeacher.toLowerCase());
      return matchClass && matchSubject && matchTeacher;
    });
  }, [assignments, filterClass, filterSubject, searchTeacher]);

  // Check for duplicate assignment
  const isDuplicate = useMemo(() => {
    if (!formData.teacher_id || !formData.class_id || !formData.subject_id) return false;
    return assignments.some((a) => {
      const aTeacherId = a.teacher_id?._id || a.teacherId?._id;
      const aClassId = a.class_id?._id || a.classId?._id;
      const aSubjectId = a.subject_id?._id || a.subjectId?._id;
      
      return (
        aTeacherId === formData.teacher_id &&
        aClassId === formData.class_id &&
        aSubjectId === formData.subject_id &&
        a.id !== editingId
      );
    });
  }, [formData, assignments, editingId]);

  // Get teacher's existing assignments (for warning)
  const selectedTeacherAssignments = useMemo(() => {
    if (!formData.teacher_id) return [];
    return assignments.filter((a) => {
      const aTeacherId = a.teacher_id?._id || a.teacherId?._id;
      return aTeacherId === formData.teacher_id && a.id !== editingId;
    });
  }, [formData.teacher_id, assignments, editingId]);

  // ==================== HANDLERS ====================
  
  const resetForm = () => {
    setFormData({ teacher_id: '', class_id: '', subject_id: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (assignment) => {
    setFormData({
      teacher_id: assignment.teacher_id?._id || assignment.teacherId?._id || '',
      class_id: assignment.class_id?._id || assignment.classId?._id || '',
      subject_id: assignment.subject_id?._id || assignment.subjectId?._id || '',
    });
    setEditingId(assignment.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (assignment) => {
    const message = `Remove ${assignment.teacher_name} from ${assignment.class_name} (${assignment.subject_name})?`;
    if (window.confirm(message)) {
      deleteMutation.mutate(assignment.id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isDuplicate) {
      showNotification('error', 'This teacher is already assigned to this class and subject!');
      return;
    }
    assignmentMutation.mutate({
      teacher_id: formData.teacher_id,
      class_id: formData.class_id,
      subject_id: formData.subject_id,
    });
  };

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 4000);
  };

  // ==================== LOADING STATE ====================
  
  const isLoading = teachersLoading || classesLoading || subjectsLoading || assignmentsLoading;
  if (isLoading) return <Loading message="Loading assignments..." />;

  // ==================== RENDER ====================
  
  return (
    <div className="assign-teachers-container">
      <style>{`
        .assign-teachers-container .filter-input {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .assign-teachers-container .filter-input::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }
        .assign-teachers-container .filter-select {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .assign-teachers-container .filter-select option {
          color: #0f172a;
          background: #ffffff;
        }
        .assign-teachers-container .scrollable-select-search-input {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .assign-teachers-container .scrollable-select-search-input::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }
        .assign-teachers-container .scrollable-select-value {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .assign-teachers-container .scrollable-select-value.placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
        }
        .assign-teachers-container .scrollable-select-option {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
      `}</style>

      {/* Notification Toast */}
      {notification.show && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-icon">
            {notification.type === 'success' ? '✓' : '⚠'}
          </span>
          <span className="notification-message">{notification.message}</span>
          <button 
            className="notification-close" 
            onClick={() => setNotification({ show: false, type: '', message: '' })}
          >
            ×
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div className="header-info">
          <h1 className="page-title">Assign Teachers</h1>
          <p className="page-subtitle">
            Assign teachers to classes and subjects for question setting
          </p>
        </div>
        <button
          className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setShowForm(true);
            }
          }}
        >
          {showForm ? '✕ Cancel' : '+ New Assignment'}
        </button>
      </div>

      {/* Stats Summary */}
      <div className="assignment-stats">
        <div className="stat-item">
          <span className="stat-value">{assignments.length}</span>
          <span className="stat-label">Total Assignments</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{teachers.length}</span>
          <span className="stat-label">Available Teachers</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{classes.length}</span>
          <span className="stat-label">Active Classes</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{subjects.length}</span>
          <span className="stat-label">Subjects</span>
        </div>
      </div>

      {/* Assignment Form */}
      {showForm && (
        <div className="card form-card">
          <div className="card-header">
            <h3>{editingId ? '✏️ Edit Assignment' : '➕ New Assignment'}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="assignment-form">
              <div className="form-row">
                {/* Teacher Select */}
                <div className="form-group">
                  <ScrollableSelect
                    id="teacher"
                    options={teacherOptions}
                    value={formData.teacher_id}
                    onChange={(val) => setFormData({ ...formData, teacher_id: val })}
                    placeholder="-- Select Teacher --"
                    label="Teacher"
                    required={true}
                    searchPlaceholder="Search teachers..."
                    noOptionsText="No teachers found"
                    footerLabel="teachers"
                    optionRenderer={(option) => (
                      <div className="teacher-option">
                        <span className="teacher-option-avatar">
                          {option.firstName.charAt(0)}{option.lastName.charAt(0)}
                        </span>
                        <div className="teacher-option-details">
                          <span className="teacher-option-name">
                            {option.firstName} {option.lastName}
                          </span>
                          <span className="teacher-option-email">{option.email}</span>
                        </div>
                      </div>
                    )}
                  />
                </div>

                {/* Class Select */}
                <div className="form-group">
                  <ScrollableSelect
                    id="class"
                    options={classOptions}
                    value={formData.class_id}
                    onChange={(val) => setFormData({ ...formData, class_id: val })}
                    placeholder="-- Select Class --"
                    label="Class"
                    required={true}
                    searchPlaceholder="Search classes..."
                    noOptionsText="No classes found"
                    footerLabel="classes"
                    optionRenderer={(option) => (
                      <div className="class-option">
                        <span className="class-option-icon">🏫</span>
                        <span className="class-option-name">{option.name}</span>
                        {option.section && (
                          <span className="class-option-section">- {option.section}</span>
                        )}
                        {option.level && (
                          <span className="class-option-level">({option.level})</span>
                        )}
                      </div>
                    )}
                  />
                </div>

                {/* Subject Select */}
                <div className="form-group">
                  <ScrollableSelect
                    id="subject"
                    options={subjectOptions}
                    value={formData.subject_id}
                    onChange={(val) => setFormData({ ...formData, subject_id: val })}
                    placeholder="-- Select Subject --"
                    label="Subject"
                    required={true}
                    searchPlaceholder="Search subjects..."
                    noOptionsText="No subjects found"
                    footerLabel="subjects"
                    optionRenderer={(option) => (
                      <div className="subject-option">
                        <span className="subject-option-icon">📚</span>
                        <span className="subject-option-name">{option.name}</span>
                        <span className="subject-option-code">({option.code})</span>
                      </div>
                    )}
                  />
                </div>
              </div>

              {/* Duplicate Warning */}
              {isDuplicate && (
                <div className="alert alert-error">
                  <span className="alert-icon">⚠️</span>
                  <span>This teacher is already assigned to this class and subject combination.</span>
                </div>
              )}

              {/* Existing Assignments Warning */}
              {selectedTeacherAssignments.length > 0 && (
                <div className="alert alert-warning">
                  <span className="alert-icon">ℹ️</span>
                  <div>
                    <strong>This teacher is already assigned to:</strong>
                    <ul className="existing-assignments-list">
                      {selectedTeacherAssignments.slice(0, 3).map((a) => (
                        <li key={a.id}>
                          {a.class_name} - {a.subject_name}
                        </li>
                      ))}
                      {selectedTeacherAssignments.length > 3 && (
                        <li>...and {selectedTeacherAssignments.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                  disabled={assignmentMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    assignmentMutation.isPending || 
                    isDuplicate || 
                    !formData.teacher_id || 
                    !formData.class_id || 
                    !formData.subject_id
                  }
                >
                  {assignmentMutation.isPending ? (
                    <span className="btn-loading">
                      <span className="spinner"></span>
                      Saving...
                    </span>
                  ) : editingId ? (
                    'Update Assignment'
                  ) : (
                    'Create Assignment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="card filters-card">
        <div className="card-body">
          <div className="filters-row">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by teacher name or email..."
                value={searchTeacher}
                onChange={(e) => setSearchTeacher(e.target.value)}
                className="filter-input"
              />
              {searchTeacher && (
                <button 
                  className="clear-input-btn" 
                  onClick={() => setSearchTeacher('')}
                >
                  ×
                </button>
              )}
            </div>
            <div className="filter-select-wrapper">
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="filter-select"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name} {cls.section ? `- ${cls.section}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-select-wrapper">
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="filter-select"
              >
                <option value="">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            {(filterClass || filterSubject || searchTeacher) && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setFilterClass('');
                  setFilterSubject('');
                  setSearchTeacher('');
                }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Assignments Table */}
      <div className="card">
        <div className="card-header">
          <h3>
            Teacher Assignments
            <span className="count-badge">{filteredAssignments.length}</span>
          </h3>
        </div>
        <div className="card-body">
          {filteredAssignments.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📋</span>
              <h3>No Assignments Found</h3>
              <p>
                {assignments.length === 0
                  ? "No teachers have been assigned yet. Create your first assignment to get started."
                  : "No assignments match your current filters."}
              </p>
              {!showForm && assignments.length === 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowForm(true)}
                >
                  + Create First Assignment
                </button>
              )}
              {(filterClass || filterSubject || searchTeacher) && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setFilterClass('');
                    setFilterSubject('');
                    setSearchTeacher('');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="col-sno">S/N</th>
                    <th className="col-teacher">Teacher</th>
                    <th className="col-class">Class</th>
                    <th className="col-subject">Subject</th>
                    <th className="col-questions">Questions Set</th>
                    <th className="col-date">Date Assigned</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((assignment, index) => (
                    <tr key={assignment.id}>
                      <td className="col-sno">{index + 1}</td>
                      <td className="col-teacher">
                        <div className="teacher-cell">
                          <div className="teacher-avatar">
                            {assignment.teacher_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="teacher-info">
                            <span className="teacher-name">
                              {assignment.teacher_name}
                            </span>
                            <span className="teacher-email">
                              {assignment.teacher_email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="col-class">
                        <span className="badge badge-class">
                          🏫 {assignment.class_name}
                        </span>
                      </td>
                      <td className="col-subject">
                        <span className="badge badge-subject">
                          📚 {assignment.subject_name}
                        </span>
                      </td>
                      <td className="col-questions">
                        <span className={`question-count ${
                          assignment.question_count > 0 ? 'has-questions' : 'no-questions'
                        }`}>
                          {assignment.question_count || 0}
                        </span>
                        <span className="question-label">questions</span>
                      </td>
                      <td className="col-date">
                        {assignment.created_at 
                          ? new Date(assignment.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '-'
                        }
                      </td>
                      <td className="col-actions">
                        <div className="action-buttons">
                          <button
                            className="btn-icon btn-edit"
                            onClick={() => handleEdit(assignment)}
                            title="Edit assignment"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            className="btn-icon btn-delete"
                            onClick={() => handleDelete(assignment)}
                            title="Remove assignment"
                            disabled={deleteMutation.isPending}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              <line x1="10" y1="11" x2="10" y2="17"/>
                              <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignTeachers;