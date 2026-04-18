import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachersAPI } from '../../api';
import Loading from '../common/Loading';
import './ManageTeachers.css';

// Simple CSV parser (for production, consider using 'papaparse' library)
const parseCSV = (text) => {
  const lines = text.split(/\r\n|\n/).filter(line => line.trim());
  if (lines.length < 2) return { headers: [], rows: [], error: 'CSV must have a header row and at least one data row' };

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));
  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every(v => !v)) continue; // Skip empty rows
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Validate required fields
    const rowErrors = [];
    if (!row.firstname) rowErrors.push('First name is required');
    if (!row.lastname) rowErrors.push('Last name is required');
    if (!row.email) rowErrors.push('Email is required');
    if (!row.username) rowErrors.push('Username is required');
    if (!row.password) rowErrors.push('Password is required');
    
    if (rowErrors.length > 0) {
      errors.push({ row: i + 1, errors: rowErrors, data: row });
    } else {
      rows.push({
        firstName: row.firstname || '',
        lastName: row.lastname || '',
        email: row.email || '',
        username: row.username || '',
        password: row.password || '',
        phone: row.phone || '',
        address: row.address || '',
        qualification: row.qualification || '',
        experience: parseInt(row.experience) || 0,
      });
    }
  }

  return { headers, rows, errors, error: null };
};

// Generate sample CSV template
const generateCSVTemplate = () => {
  const headers = ['firstName', 'lastName', 'email', 'username', 'password', 'phone', 'address', 'qualification', 'experience'];
  const sampleRow = ['John', 'Doe', 'john.doe@example.com', 'johndoe', 'password123', '1234567890', '123 Main St', 'PhD', '5'];
  return [headers.join(','), sampleRow.join(',')].join('\n');
};

const downloadTemplate = () => {
  const csv = generateCSVTemplate();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'teachers_template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
};

// Only changes the text color to black
const inputStyle = {
  color: 'black',
};

const ManageTeachers = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  
  const [showModal, setShowModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    address: '',
    qualification: '',
    experience: 0,
  });
  const [error, setError] = useState('');
  
  // CSV states
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvParseError, setCsvParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [csvUploadProgress, setCsvUploadProgress] = useState({ current: 0, total: 0 });

  // ✅ FIXED: useQuery v5 syntax
  const { data: teachers, isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: teachersAPI.getAll,
  });

  // ✅ FIXED: useMutation v5 syntax
  const createMutation = useMutation({
    mutationFn: teachersAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create teacher'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => teachersAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update teacher'),
  });

  const deleteMutation = useMutation({
    mutationFn: teachersAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  // Bulk upload mutation - uploads teachers one by one
  const bulkUploadMutation = useMutation({
    mutationFn: async (teachers) => {
      const results = { success: [], failed: [] };
      
      for (let i = 0; i < teachers.length; i++) {
        setCsvUploadProgress({ current: i + 1, total: teachers.length });
        try {
          await teachersAPI.create(teachers[i]);
          results.success.push(teachers[i]);
        } catch (err) {
          results.failed.push({
            teacher: teachers[i],
            error: err.response?.data?.message || 'Upload failed'
          });
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      
      if (results.failed.length === 0) {
        handleCloseCSVModal();
      }
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  const handleOpenCreate = () => {
    setEditingTeacher(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      phone: '',
      address: '',
      qualification: '',
      experience: 0,
    });
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      firstName: teacher.firstName || '',
      lastName: teacher.lastName || '',
      email: teacher.email || '',
      username: teacher.username || '',
      password: '',
      phone: teacher.phone || '',
      address: teacher.address || '',
      qualification: teacher.qualification || '',
      experience: teacher.experience || 0,
    });
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTeacher(null);
    setError('');
  };

  const handleOpenCSVModal = () => {
    setCsvFile(null);
    setCsvData(null);
    setCsvErrors([]);
    setCsvParseError('');
    setIsDragging(false);
    setCsvUploadProgress({ current: 0, total: 0 });
    setShowCSVModal(true);
  };

  const handleCloseCSVModal = () => {
    setShowCSVModal(false);
    setCsvFile(null);
    setCsvData(null);
    setCsvErrors([]);
    setCsvParseError('');
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCSVFileSelect = (file) => {
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      setCsvParseError('Please select a CSV file');
      return;
    }
    
    setCsvFile(file);
    setCsvData(null);
    setCsvErrors([]);
    setCsvParseError('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCSV(e.target.result);
      if (result.error) {
        setCsvParseError(result.error);
        return;
      }
      setCsvData(result.rows);
      setCsvErrors(result.errors);
    };
    reader.onerror = () => {
      setCsvParseError('Failed to read the file');
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e) => {
    handleCSVFileSelect(e.target.files[0]);
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleCSVFileSelect(files[0]);
    }
  };

  const handleBulkUpload = () => {
    if (!csvData || csvData.length === 0) return;
    bulkUploadMutation.mutate(csvData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTeacher) {
      updateMutation.mutate({ id: editingTeacher._id, data: formData });
    } else {
      if (!formData.password) {
        setError('Password is required for new teachers');
        return;
      }
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this teacher?')) {
      deleteMutation.mutate(id);
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        if (showCSVModal) handleCloseCSVModal();
        else if (showModal) handleCloseModal();
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showModal, showCSVModal]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal || showCSVModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal, showCSVModal]);

  if (isLoading) return <Loading message="Loading teachers..." />;

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isUploading = bulkUploadMutation.isPending;
  const uploadResults = bulkUploadMutation.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">Manage teacher accounts</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleOpenCSVModal}>
            📁 Upload CSV
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            + Add Teacher
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Username</th>
                <th>Phone</th>
                <th>Qualification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers?.data?.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    No teachers found
                  </td>
                </tr>
              ) : (
                teachers?.data?.map((teacher) => (
                  <tr key={teacher._id}>
                    <td>
                      <strong>{teacher.firstName} {teacher.lastName}</strong>
                    </td>
                    <td>{teacher.email}</td>
                    <td>{teacher.username}</td>
                    <td>{teacher.phone || '-'}</td>
                    <td>{teacher.qualification || '-'}</td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-info btn-sm"
                          onClick={() => handleOpenEdit(teacher)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(teacher._id)}
                        >
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

      {/* ==================== ADD/EDIT MODAL ==================== */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseModal()}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-header">
              <h3 id="modal-title">
                {editingTeacher ? '✏️ Edit Teacher' : '➕ Add New Teacher'}
              </h3>
              <button className="modal-close" onClick={handleCloseModal} aria-label="Close modal">
                ×
              </button>
            </div>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger modal-error-alert">
                  <span className="alert-icon">⚠️</span>
                  {error}
                </div>
              )}
              <form id="teacher-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">First Name <span className="required">*</span></label>
                    <input
                      type="text"
                      name="firstName"
                      className="form-control"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      placeholder="Enter first name"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name <span className="required">*</span></label>
                    <input
                      type="text"
                      name="lastName"
                      className="form-control"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      placeholder="Enter last name"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email <span className="required">*</span></label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="Enter email address"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username <span className="required">*</span></label>
                    <input
                      type="text"
                      name="username"
                      className="form-control"
                      value={formData.username}
                      onChange={handleChange}
                      required
                      placeholder="Enter username"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Password {editingTeacher ? '(leave blank to keep current)' : <span className="required">*</span>}
                    </label>
                    <input
                      type="password"
                      name="password"
                      className="form-control"
                      value={formData.password}
                      onChange={handleChange}
                      {...(!editingTeacher ? { required: true } : {})}
                      placeholder={editingTeacher ? 'Leave blank to keep current' : 'Enter password'}
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      name="phone"
                      className="form-control"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Enter phone number"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qualification</label>
                    <input
                      type="text"
                      name="qualification"
                      className="form-control"
                      value={formData.qualification}
                      onChange={handleChange}
                      placeholder="Enter qualification"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Experience (years)</label>
                    <input
                      type="number"
                      name="experience"
                      className="form-control"
                      value={formData.experience}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                  <div className="form-group form-group-full">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      name="address"
                      className="form-control"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Enter full address"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseModal}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="teacher-form"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="btn-loading">
                    <span className="spinner"></span>
                    Saving...
                  </span>
                ) : editingTeacher ? (
                  'Update Teacher'
                ) : (
                  'Create Teacher'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CSV UPLOAD MODAL ==================== */}
      {showCSVModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseCSVModal()}>
          <div className="modal csv-modal" role="dialog" aria-modal="true" aria-labelledby="csv-modal-title">
            <div className="modal-header">
              <h3 id="csv-modal-title">📁 Upload Teachers via CSV</h3>
              <button className="modal-close" onClick={handleCloseCSVModal} aria-label="Close modal">
                ×
              </button>
            </div>
            <div className="modal-body">
              {/* Instructions */}
              <div className="csv-instructions">
                <h4>Instructions:</h4>
                <ul>
                  <li>CSV file must have a header row with column names</li>
                  <li>Required columns: <code>firstName</code>, <code>lastName</code>, <code>email</code>, <code>username</code>, <code>password</code></li>
                  <li>Optional columns: <code>phone</code>, <code>address</code>, <code>qualification</code>, <code>experience</code></li>
                  <li>Each row represents one teacher account</li>
                </ul>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  onClick={downloadTemplate}
                  style={{ marginTop: '0.5rem' }}
                >
                  ⬇️ Download CSV Template
                </button>
              </div>

              {/* Drop Zone */}
              <div
                className={`csv-drop-zone ${isDragging ? 'dragging' : ''} ${csvFile ? 'has-file' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !csvFile && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
                {csvFile ? (
                  <div className="csv-file-selected">
                    <span className="csv-file-icon">📄</span>
                    <span className="csv-file-name">{csvFile.name}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCsvFile(null);
                        setCsvData(null);
                        setCsvErrors([]);
                        setCsvParseError('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="csv-drop-content">
                    <span className="csv-drop-icon">📤</span>
                    <p>Drag & drop your CSV file here</p>
                    <p className="csv-drop-subtext">or click to browse files</p>
                  </div>
                )}
              </div>

              {/* Parse Error */}
              {csvParseError && (
                <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
                  <span className="alert-icon">⚠️</span>
                  {csvParseError}
                </div>
              )}

              {/* Row Validation Errors */}
              {csvErrors.length > 0 && (
                <div className="csv-validation-errors" style={{ marginTop: '1rem' }}>
                  <h4 className="alert alert-warning" style={{ marginBottom: '0.5rem' }}>
                    <span className="alert-icon">⚠️</span>
                    {csvErrors.length} row(s) have validation errors and will be skipped:
                  </h4>
                  <div className="csv-errors-list">
                    {csvErrors.map((err, index) => (
                      <div key={index} className="csv-error-item">
                        <strong>Row {err.row}:</strong> {err.errors.join(', ')}
                        <br />
                        <small style={{ color: '#666' }}>
                          Data: {err.data.firstname} {err.data.lastname} ({err.data.email || 'no email'})
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {csvData && csvData.length > 0 && (
                <div className="csv-preview" style={{ marginTop: '1rem' }}>
                  <h4>Preview ({csvData.length} teacher{csvData.length !== 1 ? 's' : ''} to upload):</h4>
                  <div className="table-container csv-preview-table">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Username</th>
                          <th>Phone</th>
                          <th>Qualification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 10).map((teacher, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{teacher.firstName} {teacher.lastName}</td>
                            <td>{teacher.email}</td>
                            <td>{teacher.username}</td>
                            <td>{teacher.phone || '-'}</td>
                            <td>{teacher.qualification || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvData.length > 10 && (
                      <p className="csv-more-rows">
                        ... and {csvData.length - 10} more rows
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="csv-progress" style={{ marginTop: '1rem' }}>
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill"
                      style={{ width: `${(csvUploadProgress.current / csvUploadProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="csv-progress-text">
                    Uploading {csvUploadProgress.current} of {csvUploadProgress.total}...
                  </p>
                </div>
              )}

              {/* Upload Results */}
              {uploadResults && (
                <div className="csv-results" style={{ marginTop: '1rem' }}>
                  {uploadResults.failed.length === 0 ? (
                    <div className="alert alert-success">
                      <span className="alert-icon">✅</span>
                      Successfully uploaded all {uploadResults.success.length} teachers!
                    </div>
                  ) : (
                    <>
                      <div className="alert alert-warning">
                        <span className="alert-icon">⚠️</span>
                        Uploaded {uploadResults.success.length} teacher(s), but {uploadResults.failed.length} failed.
                      </div>
                      <div className="csv-errors-list">
                        {uploadResults.failed.map((fail, index) => (
                          <div key={index} className="csv-error-item">
                            <strong>{fail.teacher.firstName} {fail.teacher.lastName} ({fail.teacher.email}):</strong>{' '}
                            {fail.error}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseCSVModal}
                disabled={isUploading}
              >
                {uploadResults ? 'Close' : 'Cancel'}
              </button>
              {csvData && csvData.length > 0 && !uploadResults && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleBulkUpload}
                  disabled={isUploading || csvData.length === 0}
                >
                  {isUploading ? (
                    <span className="btn-loading">
                      <span className="spinner"></span>
                      Uploading...
                    </span>
                  ) : (
                    `Upload ${csvData.length} Teacher${csvData.length !== 1 ? 's' : ''}`
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageTeachers;