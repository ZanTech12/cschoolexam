import React from 'react';
import { Navigate } from 'react-router-dom';
import { getUserRole, isAuthenticated } from '../../api';

const PrivateRoute = ({ children, allowedRoles }) => {
  const authenticated = isAuthenticated();
  const role = getUserRole();

  if (!authenticated) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard based on role
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
  }

  return children;
};

export default PrivateRoute;