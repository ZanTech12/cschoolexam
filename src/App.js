import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { getUserRole, isAuthenticated } from './api';

// Pages
import LoginPage from './pages/LoginPage';
import AdminLayout from './pages/AdminLayout';
import TeacherLayout from './pages/TeacherLayout';
import StudentLayout from './pages/StudentLayout';
import { LayoutProvider } from './context/LayoutContext';
import { DeviceProvider } from './context/DeviceContext'; // <-- Import Device Provider

// Components
import PrivateRoute from './components/common/PrivateRoute';

function App() {
  return (
    <DeviceProvider> {/* <-- Wrap App here */}
      <LayoutProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminLayout />
              </PrivateRoute>
            }
          />

          {/* Teacher Routes */}
          <Route
            path="/teacher/*"
            element={
              <PrivateRoute allowedRoles={['teacher']}>
                <TeacherLayout />
              </PrivateRoute>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student/*"
            element={
              <PrivateRoute allowedRoles={['student']}>
                <StudentLayout />
              </PrivateRoute>
            }
          />

          {/* Default redirect based on role */}
          <Route
            path="/"
            element={<RootRedirect />}
          />

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="not-found">
                <h1>404</h1>
                <p>Page not found</p>
                <a href="/">Go Home</a>
              </div>
            }
          />
        </Routes>
      </LayoutProvider>
    </DeviceProvider>
  );
}

const RootRedirect = () => {
  const role = getUserRole();
  const authenticated = isAuthenticated();

  if (!authenticated) {
    return <Navigate to="/login" />;
  }

  switch (role) {
    case 'admin':
      return <Navigate to="/admin" />;
    case 'teacher':
      return <Navigate to="/teacher" />;
    case 'student':
      return <Navigate to="/student" />;
    default:
      return <Navigate to="/login" />;
  }
};

export default App;