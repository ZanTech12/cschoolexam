import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDevice } from '../context/DeviceContext';

import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import TeacherDashboard from '../components/teacher/TeacherDashboard';
import CreateTest from '../components/teacher/CreateTest';
import QuestionSetManager from '../components/teacher/QuestionSetManager';
import TestResults from '../components/teacher/TestResults';
import MyClasses from '../components/teacher/MyClasses';

// ============================================
// GRADING SYSTEM IMPORTS
// ============================================
import ContinuousAssessment from '../components/teacher/ContinuousAssessment';
import Broadsheet from '../components/teacher/Broadsheet';
import MyStudents from '../components/teacher/MyStudents';
import TeacherSubmissions from '../components/teacher/TeacherSubmissions';
import TeacherProfile from '../components/teacher/TeacherProfile';

const teacherMenuItems = [
  // --- Main ---
  { path: '/teacher', label: 'Dashboard', icon: '📊', exact: true },
  { path: '/teacher/classes', label: 'My Classes', icon: '🏫' },
  { path: '/teacher/my-students/:classId', label: 'My Students', icon: '👨‍🎓', hidden: true },
  
  // --- Divider: Grading System ---
  { divider: true, label: 'GRADING' },
  
  { path: '/teacher/continuous-assessment', label: 'Enter CA', icon: '📝' },
  { path: '/teacher/broadsheet', label: 'Broadsheet', icon: '📋' },
  
  // --- Divider: Examinations ---
  { divider: true, label: 'EXAMINATIONS' },
  
  { path: '/teacher/question-sets', label: 'Question Sets', icon: '📚' },
  { path: '/teacher/create-test', label: 'Create Test', icon: '✏️' },
  { path: '/teacher/results', label: 'Test Results', icon: '📈' },
  { path: '/teacher/submissions', label: 'Submissions', icon: '📨' },
  
  // --- Divider: Account ---
  { divider: true, label: 'ACCOUNT' },
  
  { path: '/teacher/profile', label: 'Profile', icon: '👤' },
];

const TeacherLayout = () => {
  const { isMobile } = useDevice();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-close mobile sidebar if screen resizes to desktop
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
      
      {/* Backdrop for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={handleMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        items={teacherMenuItems}
        collapsed={!isMobile && sidebarCollapsed}
        isOpen={isMobile && sidebarOpen}
        onCloseMobile={handleMobileClose}
      />

      {/* Main content */}
      <div className="main-content">
        <Header
          title="Teacher Panel"
          onToggleSidebar={handleDesktopToggle}
          onMobileMenuClick={handleMobileOpen}
          showMobileMenu={isMobile}
        />
        <div className="page-content">
          <Routes>
            {/* Main Routes */}
            <Route path="/" element={<TeacherDashboard />} />
            <Route path="/classes" element={<MyClasses />} />
            <Route path="/my-students/:classId" element={<MyStudents />} />
            
            {/* Grading Routes */}
            <Route path="/continuous-assessment" element={<ContinuousAssessment />} />
            <Route path="/broadsheet" element={<Broadsheet />} />
            
            {/* Examination Routes */}
            <Route path="/question-sets" element={<QuestionSetManager />} />
            <Route path="/create-test" element={<CreateTest />} />
            <Route path="/results" element={<TestResults />} />
            <Route path="/submissions" element={<TeacherSubmissions />} />
            
            {/* Account Routes */}
            <Route path="/profile" element={<TeacherProfile />} />
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/teacher" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default TeacherLayout;