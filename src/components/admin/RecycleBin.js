import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { studentsAPI } from '../../api'; // adjust this import path to match your project

// ─── Icon Components (inline SVG, no external deps) ───────────────────────────
const TrashIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const RestoreIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const DeleteForeverIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

const SearchIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const WarningIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const EmptyBinIcon = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CheckIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SpinnerIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const RefreshIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const BackIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const SortAscIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const SortDescIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

// ─── Utility Helpers ──────────────────────────────────────────────────────────
function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysAgo(dateString) {
  if (!dateString) return null;
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

function getStudentDisplayName(student) {
  if (!student) return 'Unknown';
  const parts = [student.firstName, student.middleName, student.lastName].filter(Boolean);
  return parts.join(' ') || student.admissionNumber || 'Unknown Student';
}

// ─── Toast Notification System ────────────────────────────────────────────────
function Toast({ toasts, removeToast }) {
  return (
    <div style={styles.toastContainer}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            ...styles.toast,
            ...(toast.type === 'success' ? styles.toastSuccess : null),
            ...(toast.type === 'error' ? styles.toastError : null),
            ...(toast.type === 'warning' ? styles.toastWarning : null),
            ...(toast.type === 'info' ? styles.toastInfo : null),
            animation: 'toastSlideIn 0.35s cubic-bezier(0.21,1.02,0.73,1) forwards',
          }}
          onClick={() => removeToast(toast.id)}
        >
          <span style={{ flex: 1 }}>{toast.message}</span>
          <CloseIcon size={14} />
        </div>
      ))}
    </div>
  );
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel, variant }) {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...styles.modalIconWrap, background: isDanger ? '#FEF2F2' : '#F0FDF4' }}>
          <WarningIcon size={24} style={{ color: isDanger ? '#DC2626' : '#16A34A' }} />
        </div>
        <h3 style={styles.modalTitle}>{title}</h3>
        <p style={styles.modalMessage}>{message}</p>
        <div style={styles.modalActions}>
          <button style={styles.modalCancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{
              ...styles.modalConfirmBtn,
              background: isDanger ? '#DC2626' : '#16A34A',
            }}
            onClick={onConfirm}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Student Detail Drawer ────────────────────────────────────────────────────
function StudentDetailDrawer({ student, isOpen, onClose, onRestore, onPermanentDelete }) {
  if (!isOpen || !student) return null;

  const infoRows = [
    { label: 'Admission Number', value: student.admissionNumber },
    { label: 'Full Name', value: getStudentDisplayName(student) },
    { label: 'Email', value: student.email },
    { label: 'Phone', value: student.phone || '—' },
    { label: 'Gender', value: student.gender || '—' },
    { label: 'Class', value: student.className || student.class?.name || '—' },
    { label: 'Deleted On', value: formatDate(student.deletedAt) },
    { label: 'Time Since', value: daysAgo(student.deletedAt) },
  ];

  return (
    <>
      <div style={styles.drawerOverlay} onClick={onClose} />
      <div style={styles.drawer}>
        <div style={styles.drawerHeader}>
          <h3 style={styles.drawerTitle}>Student Details</h3>
          <button style={styles.drawerCloseBtn} onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </div>
        <div style={styles.drawerBody}>
          <div style={styles.drawerAvatar}>
            {getStudentDisplayName(student)
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <h4 style={{ textAlign: 'center', margin: '12px 0 4px', color: '#1E293B', fontSize: '16px' }}>
            {getStudentDisplayName(student)}
          </h4>
          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', marginBottom: '24px' }}>
            {student.admissionNumber}
          </p>

          <div style={styles.infoGrid}>
            {infoRows.map((row) => (
              <div key={row.label} style={styles.infoRow}>
                <span style={styles.infoLabel}>{row.label}</span>
                <span style={styles.infoValue}>{row.value || '—'}</span>
              </div>
            ))}
          </div>

          {student.owingFees && (
            <div style={styles.feeWarningBadge}>
              Had outstanding fees at time of deletion
            </div>
          )}
        </div>
        <div style={styles.drawerFooter}>
          <button style={styles.drawerRestoreBtn} onClick={() => onRestore(student)}>
            <RestoreIcon size={16} />
            Restore Student
          </button>
          <button style={styles.drawerDeleteBtn} onClick={() => onPermanentDelete(student)}>
            <DeleteForeverIcon size={16} />
            Delete Permanently
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Recycle Bin Component ───────────────────────────────────────────────
export default function RecycleBin() {
  // ── State ──
  const [deletedStudents, setDeletedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Bulk operations
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modals
  const [restoreModal, setRestoreModal] = useState({ open: false, student: null });
  const [permanentDeleteModal, setPermanentDeleteModal] = useState({ open: false, student: null });
  const [bulkRestoreModal, setBulkRestoreModal] = useState({ open: false, count: 0 });
  const [bulkDeleteModal, setBulkDeleteModal] = useState({ open: false, count: 0 });

  // Sort
  const [sortField, setSortField] = useState('deletedAt');
  const [sortDir, setSortDir] = useState('desc');

  // Action states per student id
  const [restoringIds, setRestoringIds] = useState(new Set());
  const [deletingIds, setDeletingIds] = useState(new Set());

  // ── Toast Helpers ──
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Data Fetching ──
  const fetchRecycleBin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await studentsAPI.getRecycleBin();
      const data = response.data || response;
      setDeletedStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch recycle bin:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load recycle bin data');
      addToast('Failed to load recycle bin', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchRecycleBin();
  }, [fetchRecycleBin]);

  // ── Restore Logic ──
  const handleRestore = async (student) => {
    setRestoreModal({ open: false, student: null });
    setRestoringIds((prev) => new Set(prev).add(student._id));
    try {
      await studentsAPI.restoreFromRecycleBin(student._id);
      setDeletedStudents((prev) => prev.filter((s) => s._id !== student._id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(student._id);
        return next;
      });
      addToast(`${getStudentDisplayName(student)} has been restored`, 'success');
      if (drawerOpen) setDrawerOpen(false);
    } catch (err) {
      console.error('Restore failed:', err);
      addToast(err.response?.data?.message || 'Failed to restore student', 'error');
    } finally {
      setRestoringIds((prev) => {
        const next = new Set(prev);
        next.delete(student._id);
        return next;
      });
    }
  };

  // ── Permanent Delete Logic ──
  const handlePermanentDelete = async (student) => {
    setPermanentDeleteModal({ open: false, student: null });
    setDeletingIds((prev) => new Set(prev).add(student._id));
    try {
      await studentsAPI.permanentlyDelete(student._id);
      setDeletedStudents((prev) => prev.filter((s) => s._id !== student._id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(student._id);
        return next;
      });
      addToast(`${getStudentDisplayName(student)} has been permanently deleted`, 'warning');
      if (drawerOpen) setDrawerOpen(false);
    } catch (err) {
      console.error('Permanent delete failed:', err);
      addToast(err.response?.data?.message || 'Failed to permanently delete student', 'error');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(student._id);
        return next;
      });
    }
  };

  // ── Bulk Restore ──
  const handleBulkRestore = async () => {
    const ids = Array.from(selectedIds);
    setBulkRestoreModal({ open: false, count: 0 });
    setRestoringIds((prev) => new Set([...prev, ...ids]));
    try {
      await Promise.all(ids.map((id) => studentsAPI.restoreFromRecycleBin(id)));
      setDeletedStudents((prev) => prev.filter((s) => !selectedIds.has(s._id)));
      addToast(`${ids.length} student(s) restored successfully`, 'success');
      setSelectedIds(new Set());
    } catch (err) {
      addToast('Some students could not be restored', 'error');
    } finally {
      setRestoringIds(new Set());
    }
  };

  // ── Bulk Permanent Delete ──
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setBulkDeleteModal({ open: false, count: 0 });
    setDeletingIds((prev) => new Set([...prev, ...ids]));
    try {
      await Promise.all(ids.map((id) => studentsAPI.permanentlyDelete(id)));
      setDeletedStudents((prev) => prev.filter((s) => !selectedIds.has(s._id)));
      addToast(`${ids.length} student(s) permanently deleted`, 'warning');
      setSelectedIds(new Set());
    } catch (err) {
      addToast('Some students could not be deleted permanently', 'error');
    } finally {
      setDeletingIds(new Set());
    }
  };

  // ── Selection ──
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s._id)));
    }
  };

  // ── Sorting ──
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIndicator = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <SortAscIcon /> : <SortDescIcon />;
  };

  // ── Filtered & Sorted ──
  const filteredStudents = useMemo(() => {
    let list = [...deletedStudents];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const name = getStudentDisplayName(s).toLowerCase();
        const adm = (s.admissionNumber || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const cls = (s.className || '').toLowerCase();
        return name.includes(q) || adm.includes(q) || email.includes(q) || cls.includes(q);
      });
    }

    // Sort
    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'name':
          valA = getStudentDisplayName(a).toLowerCase();
          valB = getStudentDisplayName(b).toLowerCase();
          break;
        case 'admissionNumber':
          valA = a.admissionNumber || '';
          valB = b.admissionNumber || '';
          break;
        case 'class':
          valA = a.className || '';
          valB = b.className || '';
          break;
        case 'deletedAt':
        default:
          valA = a.deletedAt || '';
          valB = b.deletedAt || '';
          break;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [deletedStudents, searchQuery, sortField, sortDir]);

  const allSelected = filteredStudents.length > 0 && selectedIds.size === filteredStudents.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // ── Render ──
  return (
    <div style={styles.page}>
      {/* Toasts */}
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Modals */}
      <ConfirmModal
        isOpen={restoreModal.open}
        onClose={() => setRestoreModal({ open: false, student: null })}
        onConfirm={() => handleRestore(restoreModal.student)}
        title="Restore Student"
        message={`Are you sure you want to restore ${getStudentDisplayName(restoreModal.student)}? They and all their associated data will become visible again.`}
        confirmLabel="Yes, Restore"
        variant="safe"
      />
      <ConfirmModal
        isOpen={permanentDeleteModal.open}
        onClose={() => setPermanentDeleteModal({ open: false, student: null })}
        onConfirm={() => handlePermanentDelete(permanentDeleteModal.student)}
        title="Permanently Delete Student"
        message={`This will permanently erase ${getStudentDisplayName(permanentDeleteModal.student)} and ALL their data from the database forever. This action cannot be undone.`}
        confirmLabel="Yes, Delete Forever"
        variant="danger"
      />
      <ConfirmModal
        isOpen={bulkRestoreModal.open}
        onClose={() => setBulkRestoreModal({ open: false, count: 0 })}
        onConfirm={handleBulkRestore}
        title="Restore Selected Students"
        message={`Are you sure you want to restore ${bulkRestoreModal.count} student(s)? They and all their associated data will become visible again.`}
        confirmLabel={`Restore ${bulkRestoreModal.count} Student(s)`}
        variant="safe"
      />
      <ConfirmModal
        isOpen={bulkDeleteModal.open}
        onClose={() => setBulkDeleteModal({ open: false, count: 0 })}
        onConfirm={handleBulkDelete}
        title="Permanently Delete Selected"
        message={`This will permanently erase ${bulkDeleteModal.count} student(s) and ALL their data from the database forever. This action cannot be undone.`}
        confirmLabel={`Delete ${bulkDeleteModal.count} Student(s) Forever`}
        variant="danger"
      />

      {/* Student Detail Drawer */}
      <StudentDetailDrawer
        student={selectedStudent}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRestore={(s) => setRestoreModal({ open: true, student: s })}
        onPermanentDelete={(s) => setPermanentDeleteModal({ open: true, student: s })}
      />

      {/* Page Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            style={styles.backBtn}
            onClick={() => window.history.back()}
            title="Go back"
          >
            <BackIcon size={18} />
          </button>
          <div>
            <h1 style={styles.title}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <TrashIcon size={26} />
                Recycle Bin
              </span>
            </h1>
            <p style={styles.subtitle}>
              {loading
                ? 'Loading deleted students...'
                : `${deletedStudents.length} deleted student${deletedStudents.length !== 1 ? 's' : ''} in the bin`}
            </p>
          </div>
        </div>
        <button
          style={styles.refreshBtn}
          onClick={fetchRecycleBin}
          disabled={loading}
          title="Refresh"
        >
          <RefreshIcon size={16} />
          Refresh
        </button>
      </div>

      {/* Info Banner */}
      <div style={styles.infoBanner}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          Students placed in the recycle bin are hidden from the system but their data is preserved.
          You can <strong>restore</strong> them at any time or <strong>permanently delete</strong> them to erase all data.
        </span>
      </div>

      {/* Toolbar: Search + Bulk Actions */}
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Search by name, admission number, email, or class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button style={styles.searchClear} onClick={() => setSearchQuery('')}>
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div style={styles.bulkActions}>
            <span style={styles.bulkCount}>{selectedIds.size} selected</span>
            <button
              style={styles.bulkRestoreBtn}
              onClick={() => setBulkRestoreModal({ open: true, count: selectedIds.size })}
            >
              <RestoreIcon size={15} />
              Restore
            </button>
            <button
              style={styles.bulkDeleteBtn}
              onClick={() => setBulkDeleteModal({ open: true, count: selectedIds.size })}
            >
              <DeleteForeverIcon size={15} />
              Delete Forever
            </button>
            <button
              style={styles.bulkClearBtn}
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={styles.loadingState}>
          <div style={styles.spinner} />
          <p style={{ color: '#64748B', marginTop: '16px' }}>Loading recycle bin...</p>
        </div>
      ) : error && deletedStudents.length === 0 ? (
        <div style={styles.errorState}>
          <WarningIcon size={40} style={{ color: '#F59E0B', marginBottom: '12px' }} />
          <p style={{ color: '#334155', fontWeight: 600, marginBottom: '4px' }}>Failed to Load</p>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
          <button style={styles.retryBtn} onClick={fetchRecycleBin}>
            <RefreshIcon size={14} />
            Try Again
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div style={styles.emptyState}>
          <EmptyBinIcon />
          <h3 style={{ color: '#334155', fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>
            {searchQuery ? 'No matches found' : 'Recycle bin is empty'}
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '14px', maxWidth: '360px', textAlign: 'center', lineHeight: 1.6 }}>
            {searchQuery
              ? `No deleted students match "${searchQuery}". Try a different search term.`
              : 'When you delete students, they appear here. You can restore them or permanently erase their data.'}
          </p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '44px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleSelectAll}
                    style={styles.checkbox}
                  />
                </th>
                <th style={styles.th} onClick={() => handleSort('name')} className="sortable-col">
                  <span style={styles.thContent}>
                    Student
                    <SortIndicator field="name" />
                  </span>
                </th>
                <th style={{ ...styles.th, width: '140px' }} onClick={() => handleSort('admissionNumber')} className="sortable-col">
                  <span style={styles.thContent}>
                    Admission No.
                    <SortIndicator field="admissionNumber" />
                  </span>
                </th>
                <th style={{ ...styles.th, width: '130px' }} onClick={() => handleSort('class')} className="sortable-col">
                  <span style={styles.thContent}>
                    Class
                    <SortIndicator field="class" />
                  </span>
                </th>
                <th style={{ ...styles.th, width: '170px' }} onClick={() => handleSort('deletedAt')} className="sortable-col">
                  <span style={styles.thContent}>
                    Deleted On
                    <SortIndicator field="deletedAt" />
                  </span>
                </th>
                <th style={{ ...styles.th, width: '180px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, idx) => {
                const isRestoring = restoringIds.has(student._id);
                const isDeleting = deletingIds.has(student._id);
                const isBusy = isRestoring || isDeleting;
                const isSelected = selectedIds.has(student._id);

                return (
                  <tr
                    key={student._id}
                    style={{
                      ...styles.tr,
                      ...(isSelected ? styles.trSelected : null),
                      ...(idx % 2 === 1 ? styles.trStriped : null),
                    }}
                  >
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(student._id)}
                        style={styles.checkbox}
                        disabled={isBusy}
                      />
                    </td>
                    <td style={styles.td}>
                      <div style={styles.studentCell}>
                        <div style={styles.avatar}>
                          {getStudentDisplayName(student)
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div style={styles.studentInfo}>
                          <button
                            style={styles.studentNameBtn}
                            onClick={() => {
                              setSelectedStudent(student);
                              setDrawerOpen(true);
                            }}
                            title="View details"
                          >
                            {getStudentDisplayName(student)}
                          </button>
                          <span style={styles.studentEmail}>{student.email || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...styles.td, fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: '13px', color: '#475569' }}>
                      {student.admissionNumber || '—'}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.classBadge}>{student.className || '—'}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.dateCell}>
                        <span>{formatDate(student.deletedAt)}</span>
                        <span style={styles.dateAgo}>{daysAgo(student.deletedAt)}</span>
                      </div>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={styles.actionBtns}>
                        <button
                          style={{
                            ...styles.actionBtn,
                            ...styles.restoreBtn,
                            ...(isRestoring ? styles.actionBtnBusy : null),
                          }}
                          onClick={() => setRestoreModal({ open: true, student })}
                          disabled={isBusy}
                          title="Restore student"
                        >
                          {isRestoring ? <SpinnerIcon size={14} /> : <RestoreIcon size={15} />}
                          {isRestoring ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          style={{
                            ...styles.actionBtn,
                            ...styles.permDeleteBtn,
                            ...(isDeleting ? styles.actionBtnBusy : null),
                          }}
                          onClick={() => setPermanentDeleteModal({ open: true, student })}
                          disabled={isBusy}
                          title="Permanently delete student"
                        >
                          {isDeleting ? <SpinnerIcon size={14} /> : <DeleteForeverIcon size={15} />}
                          {isDeleting ? 'Deleting...' : 'Delete Forever'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Summary */}
      {!loading && deletedStudents.length > 0 && (
        <div style={styles.footerBar}>
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>
            Showing {filteredStudents.length} of {deletedStudents.length} deleted student(s)
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
        </div>
      )}

      {/* Global style tag for animations and hover */}
      <style>{`
        .sortable-col {
          cursor: pointer;
          user-select: none;
        }
        .sortable-col:hover {
          background: rgba(0,0,0,0.02);
        }
        @keyframes toastSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: '#F8FAFC',
    padding: '32px 24px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    color: '#1E293B',
    boxSizing: 'border-box',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
    cursor: 'pointer',
    color: '#475569',
    flexShrink: 0,
    marginTop: '2px',
    transition: 'all 0.15s',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
    letterSpacing: '-0.025em',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94A3B8',
    margin: '4px 0 0 0',
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },

  // Info Banner
  infoBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    background: '#F0F9FF',
    border: '1px solid #BAE6FD',
    color: '#0369A1',
    fontSize: '13px',
    lineHeight: 1.6,
    marginBottom: '20px',
  },

  // Toolbar
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: '280px',
    maxWidth: '480px',
    padding: '0 14px',
    height: '40px',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
    transition: 'border-color 0.15s',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    color: '#1E293B',
    background: 'transparent',
    fontFamily: 'inherit',
  },
  searchClear: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94A3B8',
    padding: '2px',
  },

  // Bulk Actions
  bulkActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '10px',
    background: '#FFF7ED',
    border: '1px solid #FED7AA',
  },
  bulkCount: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#C2410C',
    marginRight: '4px',
  },
  bulkRestoreBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #BBF7D0',
    background: '#F0FDF4',
    color: '#16A34A',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  bulkDeleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #FECACA',
    background: '#FEF2F2',
    color: '#DC2626',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  bulkClearBtn: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: '#94A3B8',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },

  // Table
  tableWrap: {
    background: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E2E8F0',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E2E8F0',
    background: '#F8FAFC',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  thContent: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  tr: {
    transition: 'background 0.1s',
  },
  trStriped: {
    background: '#FAFBFC',
  },
  trSelected: {
    background: '#EFF6FF !important',
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#334155',
    borderBottom: '1px solid #F1F5F9',
    verticalAlign: 'middle',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
    accentColor: '#3B82F6',
  },

  // Student Cell
  studentCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '9px',
    background: 'linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%)',
    color: '#4338CA',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    letterSpacing: '0.02em',
  },
  studentInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  studentNameBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: '#1E293B',
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '220px',
    display: 'block',
  },
  studentEmail: {
    fontSize: '12px',
    color: '#94A3B8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '220px',
    display: 'block',
  },
  classBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '6px',
    background: '#F1F5F9',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 500,
  },
  dateCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  dateAgo: {
    fontSize: '11px',
    color: '#94A3B8',
    fontStyle: 'italic',
  },

  // Action Buttons
  actionBtns: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    justifyContent: 'center',
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 10px',
    borderRadius: '7px',
    border: '1px solid',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  actionBtnBusy: {
    opacity: 0.65,
    cursor: 'not-allowed',
  },
  restoreBtn: {
    background: '#F0FDF4',
    borderColor: '#BBF7D0',
    color: '#16A34A',
  },
  permDeleteBtn: {
    background: '#FEF2F2',
    borderColor: '#FECACA',
    color: '#DC2626',
  },

  // Loading State
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid #E2E8F0',
    borderTopColor: '#3B82F6',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },

  // Error State
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  retryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },

  // Empty State
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    background: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E2E8F0',
  },

  // Footer Bar
  footerBar: {
    marginTop: '12px',
    padding: '0 4px',
  },

  // Toast
  toastContainer: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '400px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 500,
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    cursor: 'pointer',
  },
  toastSuccess: { background: '#059669', color: '#FFFFFF' },
  toastError: { background: '#DC2626', color: '#FFFFFF' },
  toastWarning: { background: '#D97706', color: '#FFFFFF' },
  toastInfo: { background: '#2563EB', color: '#FFFFFF' },

  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8000,
    animation: 'fadeIn 0.2s ease',
  },
  modalBox: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '420px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    textAlign: 'center',
    animation: 'fadeIn 0.25s ease',
  },
  modalIconWrap: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  modalTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: '8px',
  },
  modalMessage: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: 1.7,
    marginBottom: '24px',
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    padding: '10px 20px',
    borderRadius: '9px',
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modalConfirmBtn: {
    padding: '10px 20px',
    borderRadius: '9px',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },

  // Drawer
  drawerOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(2px)',
    zIndex: 7000,
    animation: 'fadeIn 0.2s ease',
  },
  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '400px',
    maxWidth: '92vw',
    background: '#FFFFFF',
    boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 7001,
    animation: 'drawerSlideIn 0.3s cubic-bezier(0.21,1.02,0.73,1)',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #F1F5F9',
  },
  drawerTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  drawerCloseBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid #E2E8F0',
    background: '#F8FAFC',
    cursor: 'pointer',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  drawerAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%)',
    color: '#4338CA',
    fontSize: '22px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
  },
  infoGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    background: '#F8FAFC',
    borderRadius: '10px',
    border: '1px solid #F1F5F9',
    overflow: 'hidden',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '11px 14px',
    borderBottom: '1px solid #F1F5F9',
    gap: '12px',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#94A3B8',
    fontWeight: 500,
    flexShrink: 0,
  },
  infoValue: {
    fontSize: '13px',
    color: '#1E293B',
    fontWeight: 500,
    textAlign: 'right',
    wordBreak: 'break-word',
  },
  feeWarningBadge: {
    marginTop: '16px',
    padding: '10px 14px',
    borderRadius: '8px',
    background: '#FFFBEB',
    border: '1px solid #FDE68A',
    color: '#92400E',
    fontSize: '12px',
    fontWeight: 500,
    textAlign: 'center',
  },
  drawerFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #F1F5F9',
    display: 'flex',
    gap: '10px',
  },
  drawerRestoreBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 14px',
    borderRadius: '9px',
    border: '1px solid #BBF7D0',
    background: '#F0FDF4',
    color: '#16A34A',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  drawerDeleteBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 14px',
    borderRadius: '9px',
    border: '1px solid #FECACA',
    background: '#FEF2F2',
    color: '#DC2626',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};