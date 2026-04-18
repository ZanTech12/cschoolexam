import React, { useState, useEffect } from 'react';
import { getAuthData } from '../../api';
import './StudentProfile.css';

const StudentProfile = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const { user } = getAuthData();
    setUser(user);
  }, []);

  return (
    <div className="profile-page student-profile">
      <h2>My Profile</h2>
      {user ? (
        <div className="profile-card">
          <div className="profile-avatar student-avatar">{user.firstName[0]}{user.lastName[0]}</div>
          <div className="profile-details">
            <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
            <p><strong>Admission No:</strong> {user.admissionNumber}</p>
            <p><strong>Role:</strong> Student</p>
          </div>
        </div>
      ) : <div className="loading">Loading...</div>}
    </div>
  );
};
export default StudentProfile;