import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsAPI, classesAPI } from '../../api';
import Loading from '../common/Loading';

const ManageStudents = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    admissionNumber: '',
    classId: '',
    gender: '',
  });
  
  // Upload states
  const [parsedStudents, setParsedStudents] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadLog, setUploadLog] = useState([]);
  const [csvError, setCsvError] = useState('');
  
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: studentsAPI.getAll
  });

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesAPI.getAll({ limit: 1000 })
  });

  const createMutation = useMutation({
    mutationFn: studentsAPI.create,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSuccessMessage(`Student created successfully! Admission No: ${response.data.admissionNumber}`);
      setError('');
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create student'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => studentsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update student'),
  });

  const deleteMutation = useMutation({
    mutationFn: studentsAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['students'] }),
  });

  const filteredStudents = useMemo(() => {
    if (!students?.data) return [];
    if (!searchTerm.trim()) return students.data;

    const lowerCaseTerm = searchTerm.toLowerCase();
    return students.data.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return (
        student.admissionNumber?.toLowerCase().includes(lowerCaseTerm) ||
        fullName.includes(lowerCaseTerm)
      );
    });
  }, [students?.data, searchTerm]);

  // ==========================================
  // EXPORT STUDENTS TO CSV FUNCTION
  // ==========================================
  const exportStudentsCSV = () => {
    const dataToExport = searchTerm.trim() ? filteredStudents : (students?.data || []);
    
    if (dataToExport.length === 0) {
      setError('No students available to export.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const headers = [
      'Admission Number',
      'First Name',
      'Last Name',
      'Full Name',
      'Gender',
      'Class Name',
      'Section',
      'Tests Taken'
    ];

    const escapeCSV = (value) => {
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = dataToExport.map(student => {
      const cls = classes?.data?.find(c => 
        c._id === student.classId || 
        c._id === student.classId?._id
      );
      
      return [
        student.admissionNumber || '',
        student.firstName || '',
        student.lastName || '',
        `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        student.gender || '',
        cls?.name || 'Not Assigned',
        cls?.section || '',
        student.testResults?.length || 0
      ];
    });

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const timestamp = new Date().toISOString().slice(0, 10);
    const searchSuffix = searchTerm.trim() ? '_filtered' : '';
    link.setAttribute('download', `students_export${searchSuffix}_${timestamp}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // DOWNLOAD SAMPLE CSV FUNCTION
  // ==========================================
  const downloadSampleCSV = () => {
    const csvContent = [
      'FirstName,LastName,Gender,ClassName,Section',
      'John,Doe,Male,JSS 1,A',
      'Jane,Smith,Female,JSS 2,B',
      'Samuel,Ethan,Male,SSS 1,C',
      'Alice,Johnson,Female,SSS 2,A'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_upload_format.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // CSV UPLOAD LOGIC
  // ==========================================
  const handleOpenUploadModal = () => {
    setParsedStudents([]);
    setUploadLog([]);
    setCsvError('');
    setUploadProgress({ current: 0, total: 0 });
    if(fileInputRef.current) fileInputRef.current.value = '';
    setShowUploadModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setCsvError('Invalid file type. Please upload a .csv file.');
      setParsedStudents([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
          setCsvError('CSV file is empty or missing data rows.');
          return;
        }

        const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const getVal = (row, possibleKeys) => {
          const foundKey = possibleKeys.find(k => rawHeaders.includes(k));
          return foundKey ? row[rawHeaders.indexOf(foundKey)].trim() : '';
        };

        const mappedData = [];
        let errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
          if (values.length < 2 || !values[0]) continue;

          const firstName = getVal(values, ['firstname', 'first_name', 'first name']);
          const lastName = getVal(values, ['lastname', 'last_name', 'last name']);
          const gender = getVal(values, ['gender', 'sex']);
          const className = getVal(values, ['classname', 'class_name', 'class name', 'class']);
          const section = getVal(values, ['section', 'sec']);

          if (!firstName || !lastName) {
            errors.push(`Row ${i + 1}: Missing First or Last name.`);
            continue;
          }

          let classId = '';
          if (className) {
            const matchedClass = classes?.data?.find(c => 
              c.name.toLowerCase() === className.toLowerCase() && 
              c.section.toLowerCase() === section.toLowerCase()
            );
            if (matchedClass) {
              classId = matchedClass._id;
            } else {
              errors.push(`Row ${i + 1}: Class "${className} - ${section}" not found in system.`);
            }
          }

          mappedData.push({
            firstName, lastName, 
            gender: gender === 'Male' || gender === 'Female' || gender === 'Other' ? gender : '',
            classId, _rowNumber: i + 1, _className: className, _section: section
          });
        }

        if (errors.length > 0) setCsvError(errors.join(' | '));
        else setCsvError('');
        setParsedStudents(mappedData);
      } catch (err) {
        console.error(err);
        setCsvError('Failed to parse CSV file. Ensure it is formatted correctly.');
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (parsedStudents.length === 0) return;
    setIsUploading(true);
    setUploadLog([]);
    setUploadProgress({ current: 0, total: parsedStudents.length });
    
    let successCount = 0;
    let failCount = 0;

    for (const student of parsedStudents) {
      try {
        const { _rowNumber, _className, _section, ...payload } = student;
        await studentsAPI.create(payload);
        successCount++;
        setUploadLog(prev => [...prev, `✅ Row ${student._rowNumber}: ${student.firstName} ${student.lastName} added`]);
      } catch (err) {
        failCount++;
        const errMsg = err.response?.data?.message || 'Unknown error';
        setUploadLog(prev => [...prev, `❌ Row ${student._rowNumber}: Failed (${errMsg})`]);
      }
      setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ['students'] });
    setUploadLog(prev => [...prev, `--- Upload Complete: ${successCount} succeeded, ${failCount} failed ---`]);
  };

  // ==========================================
  // STANDARD LOGIC
  // ==========================================
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
    setSuccessMessage('');
  };

  const handleOpenCreate = () => {
    setEditingStudent(null);
    setFormData({ firstName: '', lastName: '', admissionNumber: '', classId: '', gender: '' });
    setError(''); setSuccessMessage('');
    setShowModal(true);
  };

  const handleOpenEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      firstName: student.firstName || '', lastName: student.lastName || '',
      admissionNumber: student.admissionNumber || '', classId: student.classId?._id || '',
      gender: student.gender || '',
    });
    setError(''); setSuccessMessage('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false); setEditingStudent(null); setError(''); setSuccessMessage('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingStudent) updateMutation.mutate({ id: editingStudent._id, data: formData });
    else createMutation.mutate(formData);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) deleteMutation.mutate(id);
  };

  if (studentsLoading || classesLoading) return <Loading message="Loading students..." />;

  const getClassName = (classId) => {
    if (!classId) return 'Not Assigned';
    const cls = classes?.data?.find(c => c._id === classId || c._id === classId._id);
    return cls ? `${cls.name} - ${cls.section}` : 'Unknown';
  };

  const getResultText = () => {
    if (searchTerm.trim() && filteredStudents.length !== students?.data?.length) return `Showing ${filteredStudents.length} of ${students?.data?.length} students`;
    return `${students?.data?.length || 0} Total Students`;
  };

  return (
    <div className="ms-root">
      <style>{`
        .ms-root .form-control {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .ms-root .form-control::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }
        .ms-root .form-control:disabled {
          color: #64748b !important;
          -webkit-text-fill-color: #64748b !important;
        }
        .ms-root .form-select {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .ms-root .form-select option {
          color: #0f172a;
          background: #ffffff;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">Manage student accounts</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-info" 
            onClick={exportStudentsCSV}
            disabled={!students?.data?.length}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              opacity: (!students?.data?.length) ? 0.5 : 1
            }}
            title={searchTerm.trim() ? "Download currently filtered students" : "Download all students"}
          >
            ⬇ {searchTerm.trim() ? 'Export Filtered' : 'Export CSV'}
          </button>
          
          <button className="btn btn-success" onClick={handleOpenUploadModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⬆ Upload CSV
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>+ Add Student</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            {getResultText()}
          </div>
          <div style={{ position: 'relative', width: '300px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input type="text" className="form-control" placeholder="Search by name or admission no..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} />
            {searchTerm && <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }} title="Clear search">×</button>}
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead><tr><th>Admission No.</th><th>Name</th><th>Gender</th><th>Class</th><th>Tests Taken</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>{searchTerm.trim() ? <>No students found for "<strong>{searchTerm}</strong>"</> : 'No students found'}</td></tr>
              ) : filteredStudents.map((student) => (
                <tr key={student._id}>
                  <td><strong>{student.admissionNumber}</strong></td>
                  <td>{student.firstName} {student.lastName}</td>
                  <td><span className={`badge badge-${student.gender === 'Male' ? 'info' : student.gender === 'Female' ? 'warning' : 'secondary'}`}>{student.gender || 'Not Set'}</span></td>
                  <td>{getClassName(student.classId)}</td>
                  <td>{student.testResults?.length || 0}</td>
                  <td><div className="btn-group"><button className="btn btn-info btn-sm" onClick={() => handleOpenEdit(student)}>Edit</button><button className="btn btn-danger btn-sm" onClick={() => handleDelete(student._id)}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD/EDIT SINGLE STUDENT */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingStudent ? 'Edit Student' : 'Add New Student'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {successMessage && <div className="alert alert-success">{successMessage}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">First Name *</label><input type="text" name="firstName" className="form-control" value={formData.firstName} onChange={handleChange} required disabled={!!successMessage} /></div>
                  <div className="form-group"><label className="form-label">Last Name *</label><input type="text" name="lastName" className="form-control" value={formData.lastName} onChange={handleChange} required disabled={!!successMessage} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Admission Number</label>
                    {editingStudent ? <input type="text" className="form-control" value={formData.admissionNumber} disabled style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} /> : <input type="text" className="form-control" value="Auto-generated upon creation" disabled style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b', fontStyle: 'italic' }} />}
                  </div>
                  <div className="form-group"><label className="form-label">Gender</label><select name="gender" className="form-control form-select" value={formData.gender} onChange={handleChange} disabled={!!successMessage}><option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
                </div>
                <div className="form-group"><label className="form-label">Class</label><select name="classId" className="form-control form-select" value={formData.classId} onChange={handleChange} disabled={!!successMessage}><option value="">Select Class</option>{classes?.data?.map((cls) => (<option key={cls._id} value={cls._id}>{cls.name} - {cls.section} ({cls.level})</option>))}</select></div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>{successMessage ? 'Close' : 'Cancel'}</button>
                  {!successMessage && <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}</button>}
                  {successMessage && <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>Add Another Student</button>}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: UPLOAD CSV */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => !isUploading && setShowUploadModal(false)}>
          <div className="modal" style={{ maxWidth: '700px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Students (CSV)</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)} disabled={isUploading}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong>CSV Format Requirements:</strong>
                  <button 
                    type="button" 
                    className="btn btn-sm" 
                    onClick={downloadSampleCSV}
                    style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    ⬇ Download Sample Format
                  </button>
                </div>
                <ul style={{ paddingLeft: '20px', margin: '0', color: '#334155' }}>
                  <li>File must be <code>.csv</code> format (Excel "Save As" CSV).</li>
                  <li><strong>Do NOT include an Admission Number column</strong> (it is auto-generated).</li>
                  <li>Columns must be: <br/><code style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>FirstName, LastName, Gender, ClassName, Section</code></li>
                  <li>ClassName and Section must <strong>exactly match</strong> existing classes.</li>
                </ul>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Select CSV File</label>
                <input ref={fileInputRef} type="file" accept=".csv" className="form-control" onChange={handleFileChange} disabled={isUploading} />
              </div>

              {csvError && <div className="alert alert-danger" style={{ marginTop: '10px', fontSize: '0.85rem' }}>{csvError}</div>}

              {parsedStudents.length > 0 && (
                <>
                  <h5 style={{ margin: '15px 0 10px' }}>Preview ({parsedStudents.length} valid students found)</h5>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <table style={{ fontSize: '0.8rem', width: '100%' }}>
                      <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0 }}><tr><th style={{ padding: '8px', textAlign: 'left' }}>Row</th><th style={{ padding: '8px', textAlign: 'left' }}>Name</th><th style={{ padding: '8px', textAlign: 'left' }}>Gender</th><th style={{ padding: '8px', textAlign: 'left' }}>Class Match</th></tr></thead>
                      <tbody>
                        {parsedStudents.map((s, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px' }}>{s._rowNumber}</td>
                            <td style={{ padding: '8px' }}>{s.firstName} {s.lastName}</td>
                            <td style={{ padding: '8px' }}>{s.gender || 'N/A'}</td>
                            <td style={{ padding: '8px', color: s.classId ? '#16a34a' : '#dc2626', fontWeight: 500 }}>{s.classId ? `${s._className} - ${s._section}` : 'NOT FOUND'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {isUploading && (
                <div style={{ marginTop: '15px' }}>
                  <div style={{ backgroundColor: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#3b82f6', height: '100%', width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, transition: 'width 0.3s' }}></div>
                  </div>
                  <small style={{ color: '#64748b' }}>Uploading {uploadProgress.current} of {uploadProgress.total}...</small>
                </div>
              )}

              {uploadLog.length > 0 && (
                <div style={{ marginTop: '15px', maxHeight: '150px', overflowY: 'auto', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {uploadLog.map((log, i) => <div key={i} style={{ marginBottom: '2px' }}>{log}</div>)}
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)} disabled={isUploading}>Close</button>
                <button type="button" className="btn btn-success" onClick={handleBulkUpload} disabled={isUploading || parsedStudents.length === 0}>
                  {isUploading ? 'Uploading...' : `Upload ${parsedStudents.length} Students`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStudents;