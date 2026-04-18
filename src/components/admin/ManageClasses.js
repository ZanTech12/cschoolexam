import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesAPI, teachersAPI, subjectsAPI } from '../../api';
import Loading from '../common/Loading';

const inputStyle = {
  color: 'black',
};

const ManageClasses = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const modalBodyRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    section: '',
    session: '',
    teacherId: '',
    capacity: '',
    subjects: [],
  });
  const [error, setError] = useState('');

  const handleModalScroll = () => {
    if (modalBodyRef.current) {
      const { scrollTop } = modalBodyRef.current;
      setShowScrollBtn(scrollTop > 50);
    }
  };

  const scrollToTop = () => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (showModal && modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
      setShowScrollBtn(false);
    }
  }, [showModal]);

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesAPI.getAll({ limit: 100 })
  });

  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: teachersAPI.getAll
  });

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: subjectsAPI.getAll
  });

  const createMutation = useMutation({
    mutationFn: classesAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create class'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => classesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update class'),
  });

  const deleteMutation = useMutation({
    mutationFn: classesAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete class'),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  // New function to handle checkbox toggles for subjects
  const handleSubjectToggle = (subjectId) => {
    setFormData((prev) => {
      const isSelected = prev.subjects.includes(subjectId);
      return {
        ...prev,
        subjects: isSelected
          ? prev.subjects.filter((id) => id !== subjectId)
          : [...prev.subjects, subjectId],
      };
    });
    setError('');
  };

  const handleOpenCreate = () => {
    setEditingClass(null);
    setFormData({
      name: '',
      level: '',
      section: '',
      session: '2024-2025',
      teacherId: '',
      capacity: '',
      subjects: [],
    });
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (cls) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name || '',
      level: cls.level || '',
      section: cls.section || '',
      session: cls.session || '',
      teacherId: cls.teacherId?._id || '',
      capacity: cls.capacity || '',
      subjects: cls.subjects?.map(s => s._id) || [],
    });
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClass(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      capacity: parseInt(formData.capacity),
    };
    if (editingClass) {
      updateMutation.mutate({ id: editingClass._id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (cls) => {
    if (window.confirm(`Delete class "${cls.name} - ${cls.section}"?`)) {
      deleteMutation.mutate(cls._id);
    }
  };

  if (classesLoading || teachersLoading || subjectsLoading) {
    return <Loading message="Loading classes..." />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Classes</h1>
          <p className="page-subtitle">Manage class sections</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          + Add Class
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Level</th>
                <th>Section</th>
                <th>Session</th>
                <th>Teacher</th>
                <th>Students</th>
                <th>Capacity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes?.data?.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                    No classes found
                  </td>
                </tr>
              ) : (
                classes?.data?.map((cls) => (
                  <tr key={cls._id}>
                    <td><strong>{cls.name}</strong></td>
                    <td>{cls.level}</td>
                    <td>{cls.section}</td>
                    <td>{cls.session}</td>
                    <td>{cls.teacherId ? `${cls.teacherId.firstName} ${cls.teacherId.lastName}` : 'Not Assigned'}</td>
                    <td>{cls.students?.length || 0}</td>
                    <td>{cls.capacity}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-info btn-sm" onClick={() => handleOpenEdit(cls)}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cls)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div 
            className="modal modal-lg" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              display: 'flex', 
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
          >
            <div className="modal-header">
              <h3>{editingClass ? 'Edit Class' : 'Add New Class'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div 
              ref={modalBodyRef}
              onScroll={handleModalScroll}
              style={{ 
                overflowY: 'auto',
                flex: 1,
                position: 'relative'
              }}
            >
              {error && <div className="alert alert-danger">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Class Name *</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Class 10"
                    required
                    style={inputStyle}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Level *</label>
                  <input
                    type="text"
                    name="level"
                    className="form-control"
                    value={formData.level}
                    onChange={handleChange}
                    placeholder="e.g., Secondary"
                    required
                    style={inputStyle}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Section *</label>
                  <input
                    type="text"
                    name="section"
                    className="form-control"
                    value={formData.section}
                    onChange={handleChange}
                    placeholder="e.g., A"
                    required
                    style={inputStyle}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Session *</label>
                  <input
                    type="text"
                    name="session"
                    className="form-control"
                    value={formData.session}
                    onChange={handleChange}
                    placeholder="e.g., 2024-2025"
                    required
                    style={inputStyle}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Capacity *</label>
                  <input
                    type="number"
                    name="capacity"
                    className="form-control"
                    value={formData.capacity}
                    onChange={handleChange}
                    min="1"
                    max="200"
                    required
                    style={inputStyle}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Class Teacher *</label>
                  <select
                    name="teacherId"
                    className="form-control form-select"
                    value={formData.teacherId}
                    onChange={handleChange}
                    required
                    style={inputStyle}
                  >
                    <option value="">Select Teacher</option>
                    {teachers?.data?.map((teacher) => (
                      <option key={teacher._id} value={teacher._id}>
                        {teacher.firstName} {teacher.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Checkbox Group for Subjects */}
                <div className="form-group">
                  <label className="form-label">Subjects</label>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.75rem', 
                    maxHeight: '150px', 
                    overflowY: 'auto',
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px',
                    padding: '0.75rem',
                    backgroundColor: '#fff'
                  }}>
                    {subjects?.data?.length === 0 ? (
                      <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>No subjects available</p>
                    ) : (
                      subjects?.data?.map((subject) => (
                        <label 
                          key={subject._id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            margin: 0
                          }}
                        >
                          <input
                            type="checkbox"
                            value={subject._id}
                            checked={formData.subjects.includes(subject._id)}
                            onChange={() => handleSubjectToggle(subject._id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          {subject.name} ({subject.code})
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </form>

              {/* Scroll to top button */}
              <button
                onClick={scrollToTop}
                style={{
                  position: 'sticky',
                  bottom: '16px',
                  left: '100%',
                  transform: 'translateX(-60px)',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)',
                  opacity: showScrollBtn ? '1' : '0',
                  visibility: showScrollBtn ? 'visible' : 'hidden',
                  transition: 'all 0.3s ease',
                  zIndex: 10,
                  pointerEvents: showScrollBtn ? 'auto' : 'none',
                }}
                aria-label="Scroll to top"
                title="Scroll to top"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </button>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={handleSubmit}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClasses;