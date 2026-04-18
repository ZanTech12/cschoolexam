import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useLayout } from '../context/LayoutContext';
import { useDevice } from '../context/DeviceContext';

import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import StudentDashboard from '../components/student/StudentDashboard';
import TestList from '../components/student/TestList';
import TakeTest from '../components/student/TakeTest';
import MyResults from '../components/student/MyResults';

// ============================================
// GRADING SYSTEM IMPORTS
// ============================================
import StudentReportCard from '../components/student/StudentReportCard';
import StudentProfile from '../components/student/StudentProfile';

const studentMenuItems = [
  // --- Main ---
  { path: '/student', label: 'Dashboard', icon: '📊', exact: true },
  
  // --- Divider: Examinations ---
  { divider: true, label: 'EXAMINATIONS' },
  
  { path: '/student/tests', label: 'Available Tests', icon: '📝' },
  { path: '/student/results', label: 'Test Results', icon: '📈' },
  { path: '/student/schedule', label: 'Test Schedule', icon: '📅' },
  
  // --- Divider: Academics ---
  { divider: true, label: 'ACADEMICS' },
  
  { path: '/student/report-card', label: 'My Grades', icon: '📋' },
  
  // --- Divider: Account ---
  { divider: true, label: 'ACCOUNT' },
  
  { path: '/student/profile', label: 'Profile', icon: '👤' },
];

const StudentLayout = () => {
  const { layoutHidden } = useLayout();
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

  // When TakeTest sets layoutHidden = true, render ONLY the page content (Fullscreen mode)
  if (layoutHidden) {
    return (
      <Routes>
        {/* Main Routes */}
        <Route path="/" element={<StudentDashboard />} />
        
        {/* Examination Routes */}
        <Route path="/tests" element={<TestList />} />
        <Route path="/tests/:testId" element={<TakeTest />} />
        <Route path="/results" element={<MyResults />} />
        <Route path="/schedule" element={<TestList showSchedule />} />
        
        {/* Academic Routes */}
        <Route path="/report-card" element={<StudentReportCard />} />
        
        {/* Account Routes */}
        <Route path="/profile" element={<StudentProfile />} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Routes>
    );
  }

  // Normal Layout (Header + Sidebar + Content)
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
        items={studentMenuItems}
        collapsed={!isMobile && sidebarCollapsed}
        isOpen={isMobile && sidebarOpen}
        onCloseMobile={handleMobileClose}
      />

      {/* Main content */}
      <div className="main-content">
        <Header
          title="Student Panel"
          onToggleSidebar={handleDesktopToggle}
          onMobileMenuClick={handleMobileOpen}
          showMobileMenu={isMobile}
        />
        <div className="page-content">
          <Routes>
            {/* Main Routes */}
            <Route path="/" element={<StudentDashboard />} />
            
            {/* Examination Routes */}
            <Route path="/tests" element={<TestList />} />
            <Route path="/tests/:testId" element={<TakeTest />} />
            <Route path="/results" element={<MyResults />} />
            <Route path="/schedule" element={<TestList showSchedule />} />
            
            {/* Academic Routes */}
            <Route path="/report-card" element={<StudentReportCard />} />
            
            {/* Account Routes */}
            <Route path="/profile" element={<StudentProfile />} />
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default StudentLayout;