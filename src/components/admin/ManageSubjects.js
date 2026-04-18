import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectsAPI } from '../../api';
import Loading from '../common/Loading';

const inputStyle = {
  color: 'black',
};

const ManageSubjects = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    classLevel: '',
    description: '',
  });
  const [error, setError] = useState('');

  // ✅ FIXED: useQuery v5 syntax
  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: subjectsAPI.getAll
  });

  // ✅ FIXED: useMutation v5 syntax
  const createMutation = useMutation({
    mutationFn: subjectsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] }); // ✅ FIXED
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create subject'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => subjectsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] }); // ✅ FIXED
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update subject'),
  });

  const deleteMutation = useMutation({
    mutationFn: subjectsAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }), // ✅ FIXED
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete subject'),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  const handleOpenCreate = () => {
    setEditingSubject(null);
    setFormData({ name: '', code: '', classLevel: '', description: '' });
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name || '',
      code: subject.code || '',
      classLevel: subject.classLevel || '',
      description: subject.description || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSubject(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingSubject) {
      updateMutation.mutate({ id: editingSubject._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (subject) => {
    if (window.confirm(`Delete subject "${subject.name}"?`)) {
      deleteMutation.mutate(subject._id);
    }
  };

  if (isLoading) return <Loading message="Loading subjects..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">Manage subjects</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          + Add Subject
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Class Level</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects?.data?.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                    No subjects found
                  </td>
                </tr>
              ) : (
                subjects?.data?.map((subject) => (
                  <tr key={subject._id}>
                    <td><span className="badge badge-primary">{subject.code}</span></td>
                    <td><strong>{subject.name}</strong></td>
                    <td>{subject.classLevel}</td>
                    <td>{subject.description || '-'}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-info btn-sm" onClick={() => handleOpenEdit(subject)}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(subject)}>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Subject Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject Code *</label>
                    <input
                      type="text"
                      name="code"
                      className="form-control"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g., MATH"
                      required
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Class Level</label>
                  <input
                    type="text"
                    name="classLevel"
                    className="form-control"
                    value={formData.classLevel}
                    onChange={handleChange}
                    placeholder="e.g., All, Secondary, Primary"
                    style={inputStyle}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    name="description"
                    className="form-control"
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    style={inputStyle}
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    // ✅ FIXED: v5 renamed mutation isLoading to isPending
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageSubjects;