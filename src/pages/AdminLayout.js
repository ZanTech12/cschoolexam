import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDevice } from '../context/DeviceContext';

import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import AdminDashboard from '../components/admin/AdminDashboard';
import ManageTeachers from '../components/admin/ManageTeachers';
import ManageStudents from '../components/admin/ManageStudents';
import ManageClasses from '../components/admin/ManageClasses';
import ManageSubjects from '../components/admin/ManageSubjects';
import ManageTests from '../components/admin/ManageTests';
import AssignTeachers from '../components/admin/AssignTeachers';
import QuestionSetManager from '../components/admin/QuestionSetManager';
import StudentResultsView from '../components/admin/StudentResultsView';
import RecycleBin from '../components/admin/RecycleBin';
import Settings from '../components/admin/Settings';

// ============================================
// GRADING SYSTEM IMPORTS
// ============================================
import SessionsManager from '../components/admin/SessionsManager';
import TermsManager from '../components/admin/TermsManager';
import GradingSystem from '../components/admin/GradingSystem';
import ApproveAssessments from '../components/admin/ApproveAssessments';
import PrincipalComments from '../components/admin/PrincipalComments';
import ReportCards from '../components/admin/ReportCards';
import ClassReportCards from '../components/admin/ClassReportCards';
import StudentReportCard from '../components/admin/StudentReportCard';
import ReportCardsPrintView from '../components/admin/ReportCardsPrintView';

// ============================================
// CA TEACHER PROGRESS IMPORT
// ============================================
import AdminCATeacherProgress from '../components/admin/AdminCATeacherProgress';

// ============================================
// STUDENTS CLASSES & SCORES IMPORT
// ============================================
import StudentsClassesScoresPage from '../components/admin/StudentsClassesScoresPage';

// ============================================
// BROADSHEET IMPORT
// ============================================
import Broadsheet from '../components/admin/Broadsheet';

import './adminlayout.css';

// ============================================
// ADMIN MENU ITEMS
// ============================================
const adminMenuItems = [
  // --- Core Management ---
  { path: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { path: '/admin/teachers', label: 'Teachers', icon: '👨‍🏫' },
  { path: '/admin/students', label: 'Students', icon: '👨‍🎓' },
  { path: '/admin/recycle-bin', label: 'Recycle Bin', icon: '🗑️' },
  { path: '/admin/classes', label: 'Classes', icon: '🏫' },
  { path: '/admin/subjects', label: 'Subjects', icon: '📚' },
  { path: '/admin/assign-teachers', label: 'Assign Teachers', icon: '🔗' },
  
  // --- Divider: Grading System ---
  { divider: true, label: 'GRADING SYSTEM' },
  
  { path: '/admin/sessions', label: 'Sessions', icon: '📅' },
  { path: '/admin/terms', label: 'Terms', icon: '📝' },
  { path: '/admin/grading-system', label: 'Grading System', icon: '📈' },
  { path: '/admin/approve-assessments', label: 'Approve CA', icon: '✅' },
  { path: '/admin/score-editor', label: 'Score Editor', icon: '✏️' },
  { path: '/admin/students-classes-scores', label: 'Classes & Scores', icon: '📊' },
  { path: '/admin/ca-progress', label: 'CA Progress', icon: '📈' },
  { path: '/admin/principal-comments', label: 'Comments', icon: '💬' },
  { path: '/admin/broadsheet', label: 'Broadsheet', icon: '📋' },
  { path: '/admin/report-cards', label: 'Report Cards', icon: '📄' },
  
  // --- Divider: Examinations ---
  { divider: true, label: 'EXAMINATIONS' },
  
  { path: '/admin/question-sets', label: 'Question Sets', icon: '📑' },
  { path: '/admin/tests', label: 'Tests', icon: '📝' },
  { path: '/admin/results', label: 'Test Results', icon: '📊' },
  
  // --- Divider: System ---
  { divider: true, label: 'SYSTEM' },
  
  { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

const AdminLayout = () => {
  const { isMobile } = useDevice();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // If the user resizes their window from mobile to desktop, close the overlay automatically
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Desktop: toggle collapsed state
  const handleDesktopToggle = () => {
    if (!isMobile) {
      setSidebarCollapsed(prev => !prev);
    }
  };

  // Mobile: open sidebar overlay
  const handleMobileOpen = () => {
    if (isMobile) {
      setSidebarOpen(true);
    }
  };

  // Mobile: close sidebar overlay
  const handleMobileClose = () => {
    setSidebarOpen(false);
  };

  return (
    <div className={`layout-container ${!isMobile && sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      
      {/* Backdrop for mobile sidebar - only renders if mobile AND open */}
      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={handleMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - passes dynamic props based on device type */}
      <Sidebar
        items={adminMenuItems}
        collapsed={!isMobile && sidebarCollapsed}
        isOpen={isMobile && sidebarOpen}
        onCloseMobile={handleMobileClose}
      />

      {/* Main content */}
      <div className="main-content">
        <Header
          title="Admin Panel"
          onToggleSidebar={handleDesktopToggle}
          onMobileMenuClick={handleMobileOpen}
          showMobileMenu={isMobile}
        />
        <div className="page-content">
          <Routes>
            {/* Core Routes */}
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/teachers" element={<ManageTeachers />} />
            <Route path="/students" element={<ManageStudents />} />
            <Route path="/recycle-bin" element={<RecycleBin />} />
            <Route path="/classes" element={<ManageClasses />} />
            <Route path="/subjects" element={<ManageSubjects />} />
            <Route path="/assign-teachers" element={<AssignTeachers />} />
            
            {/* Grading System Routes */}
            <Route path="/sessions" element={<SessionsManager />} />
            <Route path="/terms" element={<TermsManager />} />
            <Route path="/grading-system" element={<GradingSystem />} />
            <Route path="/approve-assessments" element={<ApproveAssessments />} />
            <Route path="/students-classes-scores" element={<StudentsClassesScoresPage />} />
            <Route path="/ca-progress" element={<AdminCATeacherProgress />} />
            <Route path="/principal-comments" element={<PrincipalComments />} />
            <Route path="/broadsheet/:classId?" element={<Broadsheet />} />
            <Route path="/report-cards" element={<ReportCards />} />
            <Route path="/report-cards/class/:classId" element={<ClassReportCards />} />
            <Route path="/report-cards/student/:studentId" element={<StudentReportCard />} />
            
            {/* Print Route - Hidden from sidebar menu */}
            <Route path="/report-cards/print" element={<ReportCardsPrintView />} />
            
            {/* Examination Routes */}
            <Route path="/question-sets" element={<QuestionSetManager />} />
            <Route path="/tests" element={<ManageTests />} />
            <Route path="/results" element={<StudentResultsView />} />
            
            {/* System Routes */}
            <Route path="/settings" element={<Settings />} />
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;