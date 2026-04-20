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
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    admissionNumber: '',
    classId: '',
    gender: '',
  });
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

  const toggleFeesAccessMutation = useMutation({
    mutationFn: ({ studentId }) => studentsAPI.toggleFeesAccess(studentId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSuccessMessage(data.message);
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to toggle fees access');
      setTimeout(() => setError(''), 3000);
    }
  });

  const toggleOwingMutation = useMutation({
    mutationFn: ({ studentId }) => studentsAPI.toggleOwing(studentId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSuccessMessage(data.message);
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to toggle owing status');
      setTimeout(() => setError(''), 3000);
    }
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

  const getFeesStatusBadge = (student) => {
    if (!student.owingFees) {
      return { label: 'Clear', color: 'green', icon: '✓' };
    }
    if (student.owingFees && student.feesAccessGranted) {
      return { label: 'Access Granted', color: 'amber', icon: '⚡' };
    }
    return { label: 'Blocked', color: 'red', icon: '🚫' };
  };

  const handleToggleFeesAccess = (studentId, e) => {
    if (e) e.stopPropagation();
    toggleFeesAccessMutation.mutate({ studentId });
  };

  const handleToggleOwing = (studentId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm("Are you sure you want to toggle this student's owing status?")) {
      toggleOwingMutation.mutate({ studentId });
    }
  };

  const exportStudentsCSV = () => {
    const dataToExport = searchTerm.trim() ? filteredStudents : (students?.data || []);
    if (dataToExport.length === 0) {
      setError('No students available to export.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const headers = ['Admission Number', 'First Name', 'Last Name', 'Full Name', 'Gender', 'Class Name', 'Section', 'Tests Taken', 'Owing Fees', 'Fees Access Granted'];
    const escapeCSV = (value) => {
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };
    const rows = dataToExport.map(student => {
      const cls = classes?.data?.find(c => c._id === student.classId || c._id === student.classId?._id);
      return [
        student.admissionNumber || '', student.firstName || '', student.lastName || '',
        `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        student.gender || '', cls?.name || 'Not Assigned', cls?.section || '',
        student.testResults?.length || 0, student.owingFees ? 'Yes' : 'No',
        student.feesAccessGranted ? 'Yes' : 'No'
      ];
    });
    const csvContent = [headers.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');
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

  const downloadSampleCSV = () => {
    const csvContent = ['FirstName,LastName,Gender,ClassName,Section', 'John,Doe,Male,JSS 1,A', 'Jane,Smith,Female,JSS 2,B', 'Samuel,Ethan,Male,SSS 1,C', 'Alice,Johnson,Female,SSS 2,A'].join('\n');
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

  const handleOpenUploadModal = () => {
    setParsedStudents([]);
    setUploadLog([]);
    setCsvError('');
    setUploadProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        if (lines.length < 2) { setCsvError('CSV file is empty or missing data rows.'); return; }
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
          if (!firstName || !lastName) { errors.push(`Row ${i + 1}: Missing First or Last name.`); continue; }
          let classId = '';
          if (className) {
            const matchedClass = classes?.data?.find(c => c.name.toLowerCase() === className.toLowerCase() && c.section.toLowerCase() === section.toLowerCase());
            if (matchedClass) { classId = matchedClass._id; }
            else { errors.push(`Row ${i + 1}: Class "${className} - ${section}" not found in system.`); }
          }
          mappedData.push({ firstName, lastName, gender: gender === 'Male' || gender === 'Female' || gender === 'Other' ? gender : '', classId, _rowNumber: i + 1, _className: className, _section: section });
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

  const toggleActionMenu = (id, e) => {
    e.stopPropagation();
    setOpenActionMenu(openActionMenu === id ? null : id);
  };

  if (studentsLoading || classesLoading) return <Loading message="Loading students..." />;

  const getClassName = (classId) => {
    if (!classId) return 'Not Assigned';
    const cls = classes?.data?.find(c => c._id === classId || c._id === classId._id);
    return cls ? `${cls.name} - ${cls.section}` : 'Unknown';
  };

  const getResultText = () => {
    if (searchTerm.trim() && filteredStudents.length !== students?.data?.length) return `Showing ${filteredStudents.length} of ${students?.data?.length}`;
    return `${students?.data?.length || 0} students`;
  };

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="ms-root">
      <style>{`
        /* ===== BASE RESET & TOKENS ===== */
        .ms-root { --bg: #f1f5f9; --surface: #ffffff; --border: #e2e8f0; --text: #0f172a; --text-secondary: #475569; --text-muted: #94a3b8; --primary: #4f46e5; --primary-hover: #4338ca; --primary-light: #eef2ff; --danger: #ef4444; --danger-hover: #dc2626; --success: #10b981; --success-light: #ecfdf5; --warning: #f59e0b; --warning-light: #fffbeb; --radius: 12px; --radius-sm: 8px; --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--text); -webkit-font-smoothing: antialiased; }

        /* ===== PAGE HEADER ===== */
        .ms-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; position: sticky; top: 0; z-index: 30; }
        .ms-header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .ms-header-title { font-size: 1.35rem; font-weight: 700; color: var(--text); margin: 0; letter-spacing: -0.02em; }
        .ms-header-sub { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; }
        .ms-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .ms-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; transition: all var(--transition); white-space: nowrap; text-decoration: none; line-height: 1.4; }
        .ms-btn:active { transform: scale(0.97); }
        .ms-btn-primary { background: var(--primary); color: #fff; }
        .ms-btn-primary:hover { background: var(--primary-hover); }
        .ms-btn-success { background: var(--success); color: #fff; }
        .ms-btn-success:hover { background: #059669; }
        .ms-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
        .ms-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
        .ms-btn-danger { background: var(--danger); color: #fff; }
        .ms-btn-danger:hover { background: var(--danger-hover); }
        .ms-btn-sm { padding: 6px 12px; font-size: 0.78rem; }
        .ms-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .ms-btn-icon { padding: 8px; min-width: 36px; justify-content: center; }
        .ms-btn-icon svg { width: 16px; height: 16px; }

        /* ===== SEARCH BAR ===== */
        .ms-search-bar { padding: 12px 24px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
        .ms-search-wrap { flex: 1; max-width: 420px; position: relative; }
        .ms-search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); width: 16px; height: 16px; pointer-events: none; }
        .ms-search-input { width: 100%; padding: 10px 36px 10px 38px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; -webkit-appearance: none; }
        .ms-search-input::placeholder { color: var(--text-muted); }
        .ms-search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .ms-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: #e2e8f0; border: none; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); font-size: 14px; line-height: 1; }
        .ms-result-count { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; white-space: nowrap; }
        .ms-result-count svg { width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px; }

        /* ===== ALERTS ===== */
        .ms-alert { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500; display: flex; align-items: center; gap: 8px; margin: 12px 24px 0; animation: msSlideDown 0.25s ease; }
        .ms-alert-success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
        .ms-alert-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .ms-alert-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
        .ms-alert-close { margin-left: auto; background: none; border: none; cursor: pointer; font-size: 1.2rem; line-height: 1; opacity: 0.6; color: inherit; padding: 0 2px; }
        .ms-alert-close:hover { opacity: 1; }
        @keyframes msSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

        /* ===== DESKTOP TABLE ===== */
        .ms-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .ms-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 800px; }
        .ms-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 5; }
        .ms-table th { padding: 12px 16px; text-align: left; font-weight: 600; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
        .ms-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .ms-table tbody tr { transition: background var(--transition); }
        .ms-table tbody tr:hover { background: #f8fafc; }
        .ms-table tbody tr:last-child td { border-bottom: none; }
        .ms-empty { text-align: center; padding: 48px 24px; color: var(--text-muted); }
        .ms-empty-icon { font-size: 2.5rem; margin-bottom: 8px; display: block; }
        .ms-empty strong { color: var(--text-secondary); }

        /* ===== BADGES ===== */
        .ms-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
        .ms-badge-green { background: #dcfce7; color: #166534; }
        .ms-badge-amber { background: #fef3c7; color: #92400e; }
        .ms-badge-red { background: #fee2e2; color: #991b1b; }
        .ms-badge-blue { background: #dbeafe; color: #1e40af; }
        .ms-badge-purple { background: #f3e8ff; color: #6b21a8; }
        .ms-badge-gray { background: #f1f5f9; color: #64748b; }
        .ms-badge-indicator { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .ms-badge-indicator-green { background: #22c55e; }
        .ms-badge-indicator-red { background: #ef4444; }
        .ms-badge-indicator-amber { background: #f59e0b; }

        /* ===== MOBILE CARDS ===== */
        .ms-cards { display: none; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
        .ms-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; transition: box-shadow var(--transition); }
        .ms-card:active { box-shadow: var(--shadow); }
        .ms-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .ms-avatar { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; letter-spacing: 0.02em; }
        .ms-card-name { font-weight: 600; font-size: 0.95rem; color: var(--text); line-height: 1.3; }
        .ms-card-adm { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; margin-top: 1px; }
        .ms-card-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
        .ms-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .ms-card-field { display: flex; flex-direction: column; gap: 2px; }
        .ms-card-field-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
        .ms-card-field-value { font-size: 0.85rem; color: var(--text); font-weight: 500; }
        .ms-card-actions { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--border); }

        /* ===== FEES ACTION BUTTONS ===== */
        .ms-fees-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; border: 1px solid; font-size: 0.72rem; font-weight: 600; cursor: pointer; transition: all var(--transition); white-space: nowrap; background: var(--surface); }
        .ms-fees-btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
        .ms-fees-btn:active { transform: scale(0.97); }
        .ms-fees-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
        .ms-fees-btn-grant { border-color: #f59e0b; color: #92400e; background: #fffbeb; }
        .ms-fees-btn-grant:hover { background: #fef3c7; }
        .ms-fees-btn-revoke { border-color: #22c55e; color: #166534; background: #f0fdf4; }
        .ms-fees-btn-revoke:hover { background: #dcfce7; }
        .ms-fees-btn-owing { border-color: #ef4444; color: #991b1b; background: #fef2f2; }
        .ms-fees-btn-owing:hover { background: #fee2e2; }
        .ms-fees-btn-clear { border-color: #6366f1; color: #3730a3; background: #eef2ff; }
        .ms-fees-btn-clear:hover { background: #e0e7ff; }

        /* ===== TABLE ACTION MENU ===== */
        .ms-action-menu-wrap { position: relative; }
        .ms-action-trigger { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition); }
        .ms-action-trigger:hover { background: #f8fafc; border-color: #cbd5e1; }
        .ms-action-trigger svg { width: 16px; height: 16px; color: var(--text-muted); }
        .ms-action-menu { position: absolute; right: 0; top: calc(100% + 4px); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); min-width: 180px; z-index: 50; overflow: hidden; animation: msMenuIn 0.15s ease; }
        @keyframes msMenuIn { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .ms-action-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: none; background: none; font-size: 0.82rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: background var(--transition); text-align: left; }
        .ms-action-menu-item:hover { background: #f8fafc; }
        .ms-action-menu-item svg { width: 15px; height: 15px; flex-shrink: 0; }
        .ms-action-menu-item.danger { color: var(--danger); }
        .ms-action-menu-item.danger:hover { background: #fef2f2; }
        .ms-action-menu-sep { height: 1px; background: var(--border); margin: 2px 0; }
        .ms-action-menu-label { padding: 6px 14px 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }

        /* ===== MODAL ===== */
        .ms-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: flex-end; justify-content: center; animation: msFadeIn 0.2s ease; }
        @keyframes msFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .ms-modal { background: var(--surface); border-radius: 20px 20px 0 0; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; -webkit-overflow-scrolling: touch; animation: msSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes msSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .ms-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: #cbd5e1; margin: 10px auto 0; }
        .ms-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; }
        .ms-modal-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
        .ms-modal-close { width: 32px; height: 32px; border-radius: 50%; border: none; background: #f1f5f9; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 1.2rem; transition: all var(--transition); }
        .ms-modal-close:hover { background: #e2e8f0; color: var(--text); }
        .ms-modal-body { padding: 20px; }
        .ms-modal-footer { display: flex; gap: 10px; padding: 0 20px 24px; justify-content: flex-end; flex-wrap: wrap; }

        /* ===== FORM ===== */
        .ms-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .ms-form-group { display: flex; flex-direction: column; gap: 5px; }
        .ms-form-group.full { grid-column: 1 / -1; }
        .ms-form-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
        .ms-form-input, .ms-form-select { width: 100%; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; -webkit-appearance: none; appearance: none; }
        .ms-form-input::placeholder { color: var(--text-muted); }
        .ms-form-input:focus, .ms-form-select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .ms-form-input:disabled, .ms-form-select:disabled { background: #f8fafc; color: var(--text-muted); cursor: not-allowed; }
        .ms-form-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }
        .ms-form-select option { color: var(--text); background: var(--surface); }
        .ms-form-hint { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }

        /* ===== UPLOAD PROGRESS ===== */
        .ms-progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
        .ms-progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s ease; }
        .ms-upload-log { max-height: 160px; overflow-y: auto; background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.76rem; line-height: 1.6; color: var(--text-secondary); }
        .ms-upload-preview { max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .ms-upload-preview table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .ms-upload-preview th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); background: #f8fafc; position: sticky; top: 0; }
        .ms-upload-preview td { padding: 7px 10px; border-top: 1px solid var(--border); }

        /* ===== RESPONSIVE ===== */
        @media (min-width: 768px) {
          .ms-modal-overlay { align-items: center; }
          .ms-modal { border-radius: 20px; max-width: 560px; }
          .ms-modal-handle { display: none; }
          .ms-cards { display: none !important; }
          .ms-table-section { display: block !important; }
          .ms-header { padding: 24px 32px; }
          .ms-search-bar { padding: 12px 32px; }
          .ms-alert { margin-left: 32px; margin-right: 32px; }
          .ms-form-row { gap: 16px; }
        }

        @media (max-width: 767px) {
          .ms-header { padding: 16px; }
          .ms-header-title { font-size: 1.15rem; }
          .ms-header-sub { font-size: 0.78rem; }
          .ms-header-actions { width: 100%; }
          .ms-header-actions .ms-btn { flex: 1; justify-content: center; padding: 10px 10px; font-size: 0.78rem; }
          .ms-search-bar { padding: 10px 16px; }
          .ms-search-wrap { max-width: 100%; }
          .ms-alert { margin-left: 16px; margin-right: 16px; }
          .ms-table-section { display: none !important; }
          .ms-card-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .ms-card-actions { gap: 6px; }
          .ms-card-actions .ms-btn { flex: 1; justify-content: center; font-size: 0.72rem; padding: 8px 8px; }
          .ms-form-row { grid-template-columns: 1fr; }
          .ms-modal { max-height: 95vh; border-radius: 16px 16px 0 0; }
        }

        @media (max-width: 380px) {
          .ms-header-actions { flex-direction: column; }
          .ms-card-grid { grid-template-columns: 1fr; }
        }

        /* ===== SCROLLBAR ===== */
        .ms-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .ms-root ::-webkit-scrollbar-track { background: transparent; }
        .ms-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .ms-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        /* ===== CLICK OUTSIDE OVERLAY ===== */
        .ms-click-outside { position: fixed; inset: 0; z-index: 40; }
      `}</style>

      {/* ===== PAGE HEADER ===== */}
      <div className="ms-header">
        <div className="ms-header-top">
          <div>
            <h1 className="ms-header-title">Students</h1>
            <p className="ms-header-sub">Manage student accounts &amp; fees access</p>
          </div>
          <div className="ms-header-actions">
            <button className="ms-btn ms-btn-ghost" onClick={exportStudentsCSV} disabled={!students?.data?.length} title={searchTerm.trim() ? 'Export filtered results' : 'Export all students'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span className="hide-mobile-label">Export</span>
            </button>
            <button className="ms-btn ms-btn-success" onClick={handleOpenUploadModal}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload CSV</span>
            </button>
            <button className="ms-btn ms-btn-primary" onClick={handleOpenCreate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add Student</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== ALERTS ===== */}
      {error && (
        <div className="ms-alert ms-alert-danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16,flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
          <button className="ms-alert-close" onClick={() => setError('')}>×</button>
        </div>
      )}
      {successMessage && (
        <div className="ms-alert ms-alert-success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16,flexShrink:0}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          {successMessage}
          <button className="ms-alert-close" onClick={() => setSuccessMessage('')}>×</button>
        </div>
      )}

      {/* ===== SEARCH BAR ===== */}
      <div className="ms-search-bar">
        <div className="ms-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" className="ms-search-input" placeholder="Search by name or admission no..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {searchTerm && <button className="ms-search-clear" onClick={() => setSearchTerm('')}>×</button>}
        </div>
        <span className="ms-result-count">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          {getResultText()}
        </span>
      </div>

      {/* ===== DESKTOP TABLE ===== */}
      <div className="ms-table-section" style={{ background: 'var(--surface)', minHeight: '200px' }}>
        <div className="ms-table-wrap">
          <table className="ms-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Fees</th>
                <th>Gender</th>
                <th>Class</th>
                <th>Tests</th>
                <th style={{width: 50}}></th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan="6" className="ms-empty">
                  <span className="ms-empty-icon">🎓</span>
                  {searchTerm.trim() ? <>No students found for "<strong>{searchTerm}</strong>"</> : 'No students yet. Add your first student to get started.'}
                </td></tr>
              ) : filteredStudents.map((student) => {
                const feesBadge = getFeesStatusBadge(student);
                return (
                  <tr key={student._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="ms-avatar" style={{ background: getAvatarColor(`${student.firstName}${student.lastName}`), width: 36, height: 36, fontSize: '0.78rem' }}>
                          {getInitials(student.firstName, student.lastName)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>{student.firstName} {student.lastName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{student.admissionNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span className={`ms-badge ms-badge-${feesBadge.color}`}>
                          <span className={`ms-badge-indicator ms-badge-indicator-${feesBadge.color === 'green' ? 'green' : feesBadge.color === 'amber' ? 'amber' : 'red'}`}></span>
                          {feesBadge.label}
                        </span>
                        {student.owingFees && !student.feesAccessGranted && (
                          <button className="ms-fees-btn ms-fees-btn-grant" onClick={(e) => handleToggleFeesAccess(student._id, e)} disabled={toggleFeesAccessMutation.isPending} title="Grant temporary access">⚡ Grant Access</button>
                        )}
                        {student.owingFees && student.feesAccessGranted && (
                          <button className="ms-fees-btn ms-fees-btn-revoke" onClick={(e) => handleToggleFeesAccess(student._id, e)} disabled={toggleFeesAccessMutation.isPending} title="Revoke access">↩ Revoke</button>
                        )}
                        {!student.owingFees && (
                          <button className="ms-fees-btn ms-fees-btn-owing" onClick={(e) => handleToggleOwing(student._id, e)} disabled={toggleOwingMutation.isPending} title="Mark as owing">$ Mark Owing</button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`ms-badge ${student.gender === 'Male' ? 'ms-badge-blue' : student.gender === 'Female' ? 'ms-badge-purple' : 'ms-badge-gray'}`}>
                        {student.gender === 'Male' ? '♂' : student.gender === 'Female' ? '♀' : '○'} {student.gender || 'N/A'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{getClassName(student.classId)}</td>
                    <td style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{student.testResults?.length || 0}</td>
                    <td>
                      <div className="ms-action-menu-wrap">
                        <button className="ms-action-trigger" onClick={(e) => toggleActionMenu(student._id, e)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                        {openActionMenu === student._id && (
                          <>
                            <div className="ms-click-outside" onClick={() => setOpenActionMenu(null)} />
                            <div className="ms-action-menu">
                              <button className="ms-action-menu-item" onClick={() => { setOpenActionMenu(null); handleOpenEdit(student); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit Student
                              </button>
                              <div className="ms-action-menu-sep" />
                              <button className="ms-action-menu-item danger" onClick={() => { setOpenActionMenu(null); handleDelete(student._id); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Delete Student
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MOBILE CARDS ===== */}
      <div className="ms-cards">
        {filteredStudents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>🎓</span>
            {searchTerm.trim() ? <>No students found for "<strong>{searchTerm}</strong>"</> : 'No students yet. Add your first student.'}
          </div>
        ) : filteredStudents.map((student) => {
          const feesBadge = getFeesStatusBadge(student);
          return (
            <div className="ms-card" key={student._id}>
              <div className="ms-card-top">
                <div className="ms-avatar" style={{ background: getAvatarColor(`${student.firstName}${student.lastName}`) }}>
                  {getInitials(student.firstName, student.lastName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ms-card-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.firstName} {student.lastName}</div>
                  <div className="ms-card-adm">{student.admissionNumber}</div>
                </div>
                <div className="ms-card-badges">
                  <span className={`ms-badge ms-badge-${feesBadge.color}`}>
                    <span className={`ms-badge-indicator ms-badge-indicator-${feesBadge.color === 'green' ? 'green' : feesBadge.color === 'amber' ? 'amber' : 'red'}`}></span>
                    {feesBadge.label}
                  </span>
                </div>
              </div>
              <div className="ms-card-grid">
                <div className="ms-card-field">
                  <span className="ms-card-field-label">Gender</span>
                  <span className="ms-card-field-value">{student.gender || 'N/A'}</span>
                </div>
                <div className="ms-card-field">
                  <span className="ms-card-field-label">Class</span>
                  <span className="ms-card-field-value">{getClassName(student.classId)}</span>
                </div>
                <div className="ms-card-field">
                  <span className="ms-card-field-label">Tests Taken</span>
                  <span className="ms-card-field-value">{student.testResults?.length || 0}</span>
                </div>
                <div className="ms-card-field">
                  <span className="ms-card-field-label">Fees</span>
                  <span className="ms-card-field-value" style={{ color: student.owingFees ? 'var(--danger)' : 'var(--success)' }}>
                    {student.owingFees ? '🔴 Owing' : '🟢 Clear'}
                  </span>
                </div>
              </div>
              <div className="ms-card-actions">
                {student.owingFees && !student.feesAccessGranted && (
                  <button className="ms-btn ms-btn-sm ms-fees-btn-grant" style={{ flex: 'none' }} onClick={(e) => handleToggleFeesAccess(student._id, e)} disabled={toggleFeesAccessMutation.isPending}>⚡ Grant</button>
                )}
                {student.owingFees && student.feesAccessGranted && (
                  <button className="ms-btn ms-btn-sm ms-fees-btn-revoke" style={{ flex: 'none' }} onClick={(e) => handleToggleFeesAccess(student._id, e)} disabled={toggleFeesAccessMutation.isPending}>↩ Revoke</button>
                )}
                {!student.owingFees && (
                  <button className="ms-btn ms-btn-sm ms-fees-btn-owing" style={{ flex: 'none' }} onClick={(e) => handleToggleOwing(student._id, e)} disabled={toggleOwingMutation.isPending}>$ Owing</button>
                )}
                <button className="ms-btn ms-btn-ghost ms-btn-sm" onClick={() => handleOpenEdit(student)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button className="ms-btn ms-btn-danger ms-btn-sm" onClick={() => handleDelete(student._id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== MODAL: ADD/EDIT STUDENT ===== */}
      {showModal && (
        <div className="ms-modal-overlay" onClick={handleCloseModal}>
          <div className="ms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-handle" />
            <div className="ms-modal-header">
              <h3 className="ms-modal-title">{editingStudent ? 'Edit Student' : 'Add New Student'}</h3>
              <button className="ms-modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="ms-modal-body">
              {error && <div className="ms-alert ms-alert-danger" style={{margin:0}}>{error}</div>}
              {successMessage && <div className="ms-alert ms-alert-success" style={{margin:0}}>{successMessage}</div>}
              <form onSubmit={handleSubmit}>
                <div className="ms-form-row">
                  <div className="ms-form-group">
                    <label className="ms-form-label">First Name *</label>
                    <input type="text" name="firstName" className="ms-form-input" value={formData.firstName} onChange={handleChange} required disabled={!!successMessage} placeholder="e.g. John" />
                  </div>
                  <div className="ms-form-group">
                    <label className="ms-form-label">Last Name *</label>
                    <input type="text" name="lastName" className="ms-form-input" value={formData.lastName} onChange={handleChange} required disabled={!!successMessage} placeholder="e.g. Doe" />
                  </div>
                </div>
                <div className="ms-form-row">
                  <div className="ms-form-group">
                    <label className="ms-form-label">Admission Number</label>
                    {editingStudent ? (
                      <input type="text" className="ms-form-input" value={formData.admissionNumber} disabled />
                    ) : (
                      <input type="text" className="ms-form-input" value="Auto-generated" disabled />
                    )}
                    <span className="ms-form-hint">{editingStudent ? 'Cannot be changed' : 'Assigned automatically after creation'}</span>
                  </div>
                  <div className="ms-form-group">
                    <label className="ms-form-label">Gender</label>
                    <select name="gender" className="ms-form-input ms-form-select" value={formData.gender} onChange={handleChange} disabled={!!successMessage}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="ms-form-row">
                  <div className="ms-form-group full">
                    <label className="ms-form-label">Class</label>
                    <select name="classId" className="ms-form-input ms-form-select" value={formData.classId} onChange={handleChange} disabled={!!successMessage}>
                      <option value="">Select Class</option>
                      {classes?.data?.map((cls) => (
                        <option key={cls._id} value={cls._id}>{cls.name} - {cls.section} ({cls.level})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div className="ms-modal-footer">
              <button type="button" className="ms-btn ms-btn-ghost" onClick={handleCloseModal}>
                {successMessage ? 'Close' : 'Cancel'}
              </button>
              {!successMessage && (
                <button type="button" className="ms-btn ms-btn-primary" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? (
                    <><span style={{display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'msSpin 0.6s linear infinite'}}></span> Saving...</>
                  ) : 'Save Student'}
                </button>
              )}
              {successMessage && (
                <button type="button" className="ms-btn ms-btn-primary" onClick={handleOpenCreate}>+ Add Another</button>
              )}
            </div>
            <style>{`@keyframes msSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}

      {/* ===== MODAL: UPLOAD CSV ===== */}
      {showUploadModal && (
        <div className="ms-modal-overlay" onClick={() => !isUploading && setShowUploadModal(false)}>
          <div className="ms-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-handle" />
            <div className="ms-modal-header">
              <h3 className="ms-modal-title">Upload Students (CSV)</h3>
              <button className="ms-modal-close" onClick={() => setShowUploadModal(false)} disabled={isUploading}>×</button>
            </div>
            <div className="ms-modal-body">
              <div className="ms-alert ms-alert-info" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.84rem' }}>CSV Format Requirements</strong>
                  <button type="button" className="ms-btn ms-btn-success ms-btn-sm" onClick={downloadSampleCSV} style={{ flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Sample CSV
                  </button>
                </div>
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.7 }}>
                  <li>File must be <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4, fontSize: '0.78rem' }}>.csv</code> format</li>
                  <li>Do <strong>NOT</strong> include an Admission Number column</li>
                  <li>Required columns: <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4, fontSize: '0.78rem' }}>FirstName, LastName, Gender, ClassName, Section</code></li>
                </ul>
              </div>

              <div className="ms-form-group" style={{ marginTop: 16 }}>
                <label className="ms-form-label">Select CSV File</label>
                <input ref={fileInputRef} type="file" accept=".csv" className="ms-form-input" onChange={handleFileChange} disabled={isUploading} style={{ padding: '8px 12px' }} />
              </div>

              {csvError && <div className="ms-alert ms-alert-danger" style={{ marginTop: 10, margin: '10px 0 0' }}>{csvError}</div>}

              {parsedStudents.length > 0 && (
                <>
                  <div style={{ marginTop: 16, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>
                    Preview — {parsedStudents.length} student{parsedStudents.length !== 1 ? 's' : ''} found
                  </div>
                  <div className="ms-upload-preview" style={{ marginTop: 8 }}>
                    <table>
                      <thead><tr><th>Row</th><th>Name</th><th>Gender</th><th>Class</th></tr></thead>
                      <tbody>
                        {parsedStudents.map((s, i) => (
                          <tr key={i}>
                            <td>{s._rowNumber}</td>
                            <td style={{ fontWeight: 500 }}>{s.firstName} {s.lastName}</td>
                            <td>{s.gender || '—'}</td>
                            <td style={{ color: s.classId ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                              {s.classId ? `${s._className} - ${s._section}` : 'NOT FOUND'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {isUploading && (
                <div style={{ marginTop: 16 }}>
                  <div className="ms-progress-bar">
                    <div className="ms-progress-fill" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>
                    Uploading {uploadProgress.current} of {uploadProgress.total}...
                  </div>
                </div>
              )}

              {uploadLog.length > 0 && (
                <div className="ms-upload-log" style={{ marginTop: 12 }}>
                  {uploadLog.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              )}
            </div>
            <div className="ms-modal-footer">
              <button type="button" className="ms-btn ms-btn-ghost" onClick={() => setShowUploadModal(false)} disabled={isUploading}>Close</button>
              <button type="button" className="ms-btn ms-btn-success" onClick={handleBulkUpload} disabled={isUploading || parsedStudents.length === 0}>
                {isUploading ? (
                  <><span style={{display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'msSpin 0.6s linear infinite'}}></span> Uploading...</>
                ) : (
                  `Upload ${parsedStudents.length} Student${parsedStudents.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStudents;