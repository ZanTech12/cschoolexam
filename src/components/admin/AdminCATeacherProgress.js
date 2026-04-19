import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminCAProgressAPI, termsAPI, sessionsAPI } from '../../api';
import Loading from '../common/Loading';
import './AdminCATeacherProgress.css';

/* ── Time Formatting Helpers ── */
const formatTimeAgo = (date) => {
  if (!date) return null;
  
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return past.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: past.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

const formatFullDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getTimeColor = (date) => {
  if (!date) return '#94a3b8';
  const now = new Date();
  const past = new Date(date);
  const diffHours = (now - past) / (1000 * 60 * 60);
  
  if (diffHours < 1) return '#059669';
  if (diffHours < 4) return '#0891b2';
  if (diffHours < 24) return '#d97706';
  if (diffHours < 72) return '#ea580c';
  return '#64748b';
};

const getTimeBg = (date) => {
  if (!date) return '#f8fafc';
  const now = new Date();
  const past = new Date(date);
  const diffHours = (now - past) / (1000 * 60 * 60);
  
  if (diffHours < 1) return '#ecfdf5';
  if (diffHours < 4) return '#ecfeff';
  if (diffHours < 24) return '#fffbeb';
  if (diffHours < 72) return '#fff7ed';
  return '#f8fafc';
};

const getLatestSubjectTime = (subjects) => {
  if (!subjects || subjects.length === 0) return null;
  
  let latest = null;
  for (const subject of subjects) {
    const time = subject.lastLoadedAt || subject.lastCAEntryAt || subject.updatedAt || subject.createdAt;
    if (time && (!latest || new Date(time) > new Date(latest))) {
      latest = time;
    }
  }
  return latest;
};

/* ── Clamp percentage to max 100 ── */
const clampPercent = (val) => Math.min(Math.max(val || 0, 0), 100);

/* ── Inline SVG Icon Components ── */
const Icons = {
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  checkCircle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  xCircle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  alertCircle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  chevronDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  chevronRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  filter: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 21 3" />
    </svg>
  ),
  book: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  school: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  mail: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  phone: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  clock: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

const AdminCATeacherProgress = () => {
  const [expandedTeachers, setExpandedTeachers] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [tooltipId, setTooltipId] = useState(null);

  // Fetch terms and sessions for filters
  const { data: termsData } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termsAPI.getAll(),
  });

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsAPI.getAll(),
  });

  // Fetch teacher CA progress
  const { data: progressData, isLoading, refetch } = useQuery({
    queryKey: ['admin-ca-teacher-progress', selectedTermId, selectedSessionId],
    queryFn: () => adminCAProgressAPI.getTeacherProgress({
      termId: selectedTermId || undefined,
      sessionId: selectedSessionId || undefined,
    }),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const terms = termsData?.data || [];
  const sessions = sessionsData?.data || [];
  const summary = progressData?.data?.summary || {};
  const termInfo = progressData?.data?.termInfo;
  const sessionInfo = progressData?.data?.sessionInfo;
  const teachers = progressData?.data?.teachers || [];

  // Close tooltip on outside click
  React.useEffect(() => {
    if (!tooltipId) return;
    const handleClick = (e) => {
      if (!e.target.closest('.acp-time-cell')) {
        setTooltipId(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [tooltipId]);

  // Auto-select active term/session if available
  React.useEffect(() => {
    if (terms.length > 0 && !selectedTermId) {
      const activeTerm = terms.find(t => t.status === 'active');
      if (activeTerm) setSelectedTermId(activeTerm._id);
    }
  }, [terms]);

  React.useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId && termInfo) {
      const matchedSession = sessions.find(s => s._id === termInfo.id || s.name === termInfo.name);
      if (matchedSession) setSelectedSessionId(matchedSession._id);
    }
  }, [sessions, termInfo]);

  // Toggle teacher expansion
  const toggleTeacher = (teacherId) => {
    setExpandedTeachers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teacherId)) {
        newSet.delete(teacherId);
      } else {
        newSet.add(teacherId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedTeachers(new Set(filteredTeachers.map(t => t.teacherId)));
  };

  const collapseAll = () => {
    setExpandedTeachers(new Set());
  };

  // Toggle time tooltip
  const toggleTooltip = (e, id) => {
    e.stopPropagation();
    setTooltipId(prev => prev === id ? null : id);
  };

  // Filter teachers based on search and status
  const filteredTeachers = useMemo(() => {
    let result = teachers;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(teacher =>
        teacher.teacherName.toLowerCase().includes(lowerSearch) ||
        teacher.email?.toLowerCase().includes(lowerSearch) ||
        teacher.username?.toLowerCase().includes(lowerSearch) ||
        teacher.subjects.some(s =>
          s.subjectName.toLowerCase().includes(lowerSearch) ||
          s.className.toLowerCase().includes(lowerSearch)
        )
      );
    }

    if (filterStatus === 'complete') {
      result = result.filter(t => t.completionPercentage === 100);
    } else if (filterStatus === 'incomplete') {
      result = result.filter(t => t.completionPercentage > 0 && t.completionPercentage < 100);
    } else if (filterStatus === 'not-started') {
      result = result.filter(t => t.filledAssignments === 0);
    }

    return result;
  }, [teachers, searchTerm, filterStatus]);

  // Get status badge info
  const getStatusInfo = (teacher) => {
    if (teacher.completionPercentage === 100) {
      return { label: 'Complete', className: 'acp-status--complete', icon: Icons.checkCircle };
    } else if (teacher.filledAssignments === 0) {
      return { label: 'Not Started', className: 'acp-status--not-started', icon: Icons.xCircle };
    } else {
      return { label: 'In Progress', className: 'acp-status--in-progress', icon: Icons.alertCircle };
    }
  };

  // Get subject status info
  const getSubjectStatusInfo = (subject) => {
    if (subject.hasCA && subject.caPercentage >= 100) {
      return { label: 'Complete', className: 'acp-subject--complete', icon: Icons.checkCircle };
    } else if (subject.hasCA) {
      return { label: 'Partial', className: 'acp-subject--partial', icon: Icons.alertCircle };
    } else {
      return { label: 'Pending', className: 'acp-subject--pending', icon: Icons.xpCircle };
    }
  };
  
  if (isLoading) return <Loading message="Loading CA progress..." />;

  return (
    <div className="acp-wrapper">
      {/* ── Header ── */}
      <header className="acp-header">
        <div className="acp-header-left">
          <h1 className="acp-header-title">
            {Icons.users}
            CA Score Entry Progress
          </h1>
          <p className="acp-header-subtitle">
            Monitor teacher compliance with Continuous Assessment score entry
          </p>
        </div>
        <button className="acp-refresh-btn" onClick={() => refetch()} title="Refresh data">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </header>

      {/* ── Filters Bar ── */}
      <div className="acp-filters">
        <div className="acp-filters-row">
          <div className="acp-filter-group">
            <label className="acp-filter-label">Term</label>
            <select
              className="acp-filter-select"
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
            >
              <option value="">Active Term</option>
              {terms.map(term => (
                <option key={term._id} value={term._id}>
                  {term.name} {term.status === 'active' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="acp-filter-group">
            <label className="acp-filter-label">Session</label>
            <select
              className="acp-filter-select"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              <option value="">Auto</option>
              {sessions.map(session => (
                <option key={session._id} value={session._id}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>

          <div className="acp-filter-group">
            <label className="acp-filter-label">Status</label>
            <select
              className="acp-filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Teachers</option>
              <option value="complete">Complete</option>
              <option value="incomplete">In Progress</option>
              <option value="not-started">Not Started</option>
            </select>
          </div>

          <div className="acp-filter-group acp-filter-group--search">
            <label className="acp-filter-label">Search</label>
            <div className="acp-search-wrapper">
              {Icons.search}
              <input
                type="text"
                className="acp-search-input"
                placeholder="Teacher, subject, class..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {(termInfo || sessionInfo) && (
          <div className="acp-context-info">
            <span className="acp-context-badge">{termInfo?.name || 'N/A'}</span>
            <span className="acp-context-separator">•</span>
            <span className="acp-context-badge">{sessionInfo?.name || 'N/A'}</span>
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="acp-summary-grid">
        <div className="acp-summary-card acp-summary-card--primary">
          <div className="acp-summary-card__icon">{Icons.users}</div>
          <div className="acp-summary-card__content">
            <div className="acp-summary-card__value">{summary.totalTeachers || 0}</div>
            <div className="acp-summary-card__label">Total Teachers</div>
          </div>
        </div>

        <div className="acp-summary-card acp-summary-card--success">
          <div className="acp-summary-card__icon">{Icons.checkCircle}</div>
          <div className="acp-summary-card__content">
            <div className="acp-summary-card__value">{summary.teachersWithCA || 0}</div>
            <div className="acp-summary-card__label">Teachers with CA</div>
          </div>
        </div>

        <div className="acp-summary-card acp-summary-card--danger">
          <div className="acp-summary-card__icon">{Icons.alertCircle}</div>
          <div className="acp-summary-card__content">
            <div className="acp-summary-card__value">{summary.teachersWithoutCA || 0}</div>
            <div className="acp-summary-card__label">Teachers Without CA</div>
          </div>
        </div>

        <div className="acp-summary-card acp-summary-card--info">
          <div className="acp-summary-card__icon">{Icons.book}</div>
          <div className="acp-summary-card__content">
            <div className="acp-summary-card__value">
              {summary.assignmentsWithCA || 0}<span className="acp-summary-card__value-sub">/{summary.totalAssignments || 0}</span>
            </div>
            <div className="acp-summary-card__label">Subjects Filled</div>
          </div>
        </div>

        <div className={`acp-summary-card ${clampPercent(summary.completionPercentage) === 100 ? 'acp-summary-card--success' : 'acp-summary-card--warning'}`}>
          <div className="acp-summary-card__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="acp-summary-card__content">
            <div className="acp-summary-card__value">{clampPercent(summary.completionPercentage)}%</div>
            <div className="acp-summary-card__label">Overall Completion</div>
          </div>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      {summary.totalAssignments > 0 && (
        <div className="acp-progress-section">
          <div className="acp-progress-header">
            <span className="acp-progress-label">Overall CA Entry Progress</span>
            <span className="acp-progress-value">{summary.assignmentsWithCA || 0} of {summary.totalAssignments} subjects</span>
          </div>
          <div className="acp-progress-bar">
            <div
              className={`acp-progress-fill ${clampPercent(summary.completionPercentage) === 100 ? 'acp-progress-fill--complete' : ''}`}
              style={{ width: `${clampPercent(summary.completionPercentage)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Expand/Collapse Controls ── */}
      <div className="acp-controls">
        <span className="acp-controls-info">
          Showing {filteredTeachers.length} of {teachers.length} teachers
        </span>
        <div className="acp-controls-actions">
          <button className="acp-control-btn" onClick={expandAll}>Expand All</button>
          <button className="acp-control-btn" onClick={collapseAll}>Collapse All</button>
        </div>
      </div>

      {/* ── Teachers List ── */}
      <div className="acp-teachers-list">
        {filteredTeachers.length === 0 ? (
          <div className="acp-empty">
            <div className="acp-empty__icon">{Icons.users}</div>
            <div className="acp-empty__text">
              {searchTerm || filterStatus !== 'all'
                ? 'No teachers match your filters'
                : 'No teacher assignments found'
              }
            </div>
          </div>
        ) : (
          filteredTeachers.map((teacher) => {
            const isExpanded = expandedTeachers.has(teacher.teacherId);
            const statusInfo = getStatusInfo(teacher);
            const latestTime = getLatestSubjectTime(teacher.subjects);
            const latestTimeAgo = formatTimeAgo(latestTime);
            const latestTimeColor = getTimeColor(latestTime);

            return (
              <div key={teacher.teacherId} className="acp-teacher-card">
                {/* Teacher Header Row */}
                <div
                  className="acp-teacher-header"
                  onClick={() => toggleTeacher(teacher.teacherId)}
                >
                  <div className="acp-teacher-header__left">
                    <div className="acp-teacher-avatar">
                      {teacher.firstName?.[0]}{teacher.lastName?.[0]}
                    </div>
                    <div className="acp-teacher-info">
                      <div className="acp-teacher-name">{teacher.teacherName}</div>
                      <div className="acp-teacher-meta">
                        {teacher.email && (
                          <span className="acp-teacher-meta-item" title={teacher.email}>
                            {Icons.mail} {teacher.email}
                          </span>
                        )}
                        {teacher.username && (
                          <span className="acp-teacher-meta-item">
                            @{teacher.username}
                          </span>
                        )}
                        {latestTimeAgo && (
                          <span className="acp-teacher-meta-item acp-teacher-meta-item--time" style={{ color: latestTimeColor }}>
                            {Icons.clock} Last: {latestTimeAgo}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="acp-teacher-header__right">
                    <div className="acp-teacher-stats">
                      <span className="acp-teacher-stat">
                        <span className="acp-teacher-stat-value">{teacher.filledAssignments}</span>
                        <span className="acp-teacher-stat-label">filled</span>
                      </span>
                      <span className="acp-teacher-stat-divider">/</span>
                      <span className="acp-teacher-stat">
                        <span className="acp-teacher-stat-value">{teacher.totalAssignments}</span>
                        <span className="acp-teacher-stat-label">total</span>
                      </span>
                    </div>

                    <div className={`acp-status-badge ${statusInfo.className}`}>
                      {statusInfo.icon}
                      {statusInfo.label}
                    </div>

                    <div className="acp-mini-progress">
                      <div className="acp-mini-progress-track">
                        <div
                          className={`acp-mini-progress-fill ${clampPercent(teacher.completionPercentage) === 100 ? 'acp-mini-progress-fill--complete' : ''}`}
                          style={{ width: `${clampPercent(teacher.completionPercentage)}%` }}
                        />
                      </div>
                      <span className="acp-mini-progress-label">{clampPercent(teacher.completionPercentage)}%</span>
                    </div>

                    <div className={`acp-chevron ${isExpanded ? 'acp-chevron--expanded' : ''}`}>
                      {Icons.chevronDown}
                    </div>
                  </div>
                </div>

                {/* Expanded Subject Details */}
                {isExpanded && (
                  <div className="acp-teacher-subjects">
                    <div className="acp-subjects-header">
                      <span>Class</span>
                      <span>Subject</span>
                      <span>Students</span>
                      <span>Status</span>
                      <span>Progress</span>
                      <span className="acp-subjects-header-time">Time Loaded</span>
                    </div>
                    {teacher.subjects.map((subject) => {
                      const subjectStatus = getSubjectStatusInfo(subject);
                      const subjectTime = subject.lastLoadedAt || subject.lastCAEntryAt || subject.updatedAt || subject.createdAt;
                      const timeAgo = formatTimeAgo(subjectTime);
                      const timeColor = getTimeColor(subjectTime);
                      const timeBg = getTimeBg(subjectTime);
                      const fullTime = formatFullDateTime(subjectTime);
                      const tooltipKey = subject.assignmentId;
                      const isTooltipOpen = tooltipId === tooltipKey;

                      return (
                        <div key={subject.assignmentId} className="acp-subject-row">
                          <div className="acp-subject-cell acp-subject-cell--class">
                            <span className="acp-subject-cell-icon">{Icons.school}</span>
                            <span>{subject.className} {subject.classSection}</span>
                          </div>
                          <div className="acp-subject-cell acp-subject-cell--subject">
                            <span className="acp-subject-cell-icon">{Icons.book}</span>
                            <span>{subject.subjectName}</span>
                            <span className="acp-subject-code">{subject.subjectCode}</span>
                          </div>
                          <div className="acp-subject-cell acp-subject-cell--students">
                            {subject.studentsWithCA}/{subject.totalStudentsInClass}
                          </div>
                          <div className="acp-subject-cell acp-subject-cell--status">
                            <span className={`acp-subject-status ${subjectStatus.className}`}>
                              {subjectStatus.icon}
                              {subjectStatus.label}
                            </span>
                          </div>
                          <div className="acp-subject-cell acp-subject-cell--progress">
                            <div className="acp-subject-progress-track">
                              <div
                                className={`acp-subject-progress-fill ${clampPercent(subject.caPercentage) === 100 ? 'acp-subject-progress-fill--complete' : clampPercent(subject.caPercentage) > 0 ? 'acp-subject-progress-fill--partial' : ''}`}
                                style={{ width: `${clampPercent(subject.caPercentage)}%` }}
                              />
                            </div>
                            <span className="acp-subject-progress-label">{clampPercent(subject.caPercentage)}%</span>
                          </div>
                          <div className="acp-subject-cell acp-subject-cell--time acp-time-cell" onClick={(e) => toggleTooltip(e, tooltipKey)}>
                            {timeAgo ? (
                              <>
                                <span
                                  className="acp-time-badge"
                                  style={{ color: timeColor, backgroundColor: timeBg }}
                                >
                                  {Icons.clock}
                                  {timeAgo}
                                </span>
                                {isTooltipOpen && (
                                  <div className="acp-time-tooltip">
                                    <div className="acp-time-tooltip-arrow"></div>
                                    <div className="acp-time-tooltip-content">
                                      <div className="acp-time-tooltip-label">
                                        {subject.lastLoadedAt ? 'Last Loaded' : subject.lastCAEntryAt ? 'Last CA Entry' : subject.updatedAt ? 'Last Updated' : 'Created'}
                                      </div>
                                      <div className="acp-time-tooltip-value">{fullTime}</div>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="acp-time-badge acp-time-badge--empty">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Legend ── */}
      <div className="acp-legend">
        <span className="acp-legend-title">Legend:</span>
        <span className="acp-legend-item acp-subject-status acp-subject--complete">
          {Icons.checkCircle} Complete (100%)
        </span>
        <span className="acp-legend-item acp-subject-status acp-subject--partial">
          {Icons.alertCircle} Partial (1-99%)
        </span>
        <span className="acp-legend-item acp-subject-status acp-subject--pending">
          {Icons.xCircle} Pending (0%)
        </span>
      </div>
    </div>
  );
};

export default AdminCATeacherProgress;