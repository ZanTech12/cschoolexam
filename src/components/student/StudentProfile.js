<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
import { getAuthData, studentAPI } from '../../api'; // ✅ Import studentAPI
import './StudentProfile.css';

const StudentProfile = () => {
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null); // ✅ Store full profile with image
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authUser = getAuthData().user;
    setUser(authUser);

    // ✅ Fetch the full profile from backend to get the image URL
    const fetchFullProfile = async () => {
      try {
        const response = await studentAPI.getProfile();
        // Handle different possible response structures
        setProfileData(response.data || response);
      } catch (error) {
        console.error('Failed to load profile image:', error);
      } finally {
        setLoading(false);
      }
    };

    if (authUser?.id) {
      fetchFullProfile();
    } else {
      setLoading(false);
    }
  }, []);

  // Use backend data if available, otherwise fallback to JWT data
  const displayUser = profileData || user;
  const profileImageUrl = displayUser?.profileImage?.url;

  return (
    <div className="profile-page student-profile">
      <h2>My Profile</h2>
      
      {loading ? (
        <div className="loading">Loading...</div>
      ) : displayUser ? (
        <div className="profile-card">
          <div className="profile-avatar student-avatar">
            {/* ✅ Show image if it exists, otherwise show initials */}
            {profileImageUrl ? (
              <img 
                src={profileImageUrl} 
                alt={`${displayUser.firstName} ${displayUser.lastName}`}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  borderRadius: '50%' 
                }} 
              />
            ) : (
              <>{displayUser.firstName?.[0]}{displayUser.lastName?.[0]}</>
            )}
          </div>
          
          <div className="profile-details">
            <p><strong>Name:</strong> {displayUser.firstName} {displayUser.lastName}</p>
            <p><strong>Admission No:</strong> {displayUser.admissionNumber}</p>
            <p><strong>Role:</strong> Student</p>
          </div>
        </div>
      ) : (
        <div className="loading">No profile data found.</div>
      )}
    </div>
  );
};
=======
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
>>>>>>> 691cb9110a3f4ea67e81ae9bd75d409e1b4d6012
export default StudentProfile;