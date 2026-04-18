import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, saveAuthData } from '../api';
import './LoginPage.css';

// Import images so the bundler resolves them correctly
import res1 from './res1.png';
import res2 from './res2.jpg';
import res3 from './res3.jpeg';
import logo from './logo.png'; // Imported logo

const SLIDE_IMAGES = [res1, res2, res3];

const LoginPage = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('admin');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    admissionNumber: '',
    firstName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Added state for password toggle

  const roles = [
    { id: 'admin', label: 'Admin', icon: '👨‍💼' },
    { id: 'teacher', label: 'Teacher', icon: '👨‍🏫' },
    { id: 'student', label: 'Student', icon: '👨‍🎓' },
  ];

  // ==================== SLIDESHOW ====================
  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % SLIDE_IMAGES.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 5500);
    return () => clearInterval(interval);
  }, [nextSlide]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // ==================== FORM ====================
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;

      if (selectedRole === 'admin' || selectedRole === 'teacher') {
        if (!formData.username || !formData.password) {
          setError('Username and password are required');
          setLoading(false);
          return;
        }
        result = await authAPI.login({
          role: selectedRole,
          username: formData.username,
          password: formData.password,
        });
      } else if (selectedRole === 'student') {
        if (!formData.admissionNumber || !formData.firstName) {
          setError('Admission Number and First Name are required');
          setLoading(false);
          return;
        }
        result = await authAPI.loginStudent({
          admissionNumber: formData.admissionNumber,
          firstName: formData.firstName,
        });
      }

      if (result.success) {
        saveAuthData(result.token, result.user);
        switch (result.user.role) {
          case 'admin': navigate('/admin'); break;
          case 'teacher': navigate('/teacher'); break;
          case 'student': navigate('/student'); break;
          default: navigate('/');
        }
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const marqueeContent = (
    <>
      <span>Datforte International School Management System Application</span>
      <span className="dot">◆</span>
      <span>Datforte International School Management System Application</span>
      <span className="dot">◆</span>
      <span>Datforte International School Management System Application</span>
      <span className="dot">◆</span>
      <span>Datforte International School Management System Application</span>
      <span className="dot">◆</span>
    </>
  );

  return (
    <>
      {/* Scrolling Marquee */}
      <div className="marquee-bar">
        <div className="marquee-track">
          {marqueeContent}
          {marqueeContent}
        </div>
      </div>

      {/* Bottom Accent Bar */}
      <div className="bottom-bar" />

      <div className="login-container">
        {/* Background Slideshow */}
        <div className="bg-slides">
          {SLIDE_IMAGES.map((img, i) => (
            <div
              key={i}
              className={`bg-slide ${currentSlide === i ? 'active' : ''}`}
              style={{ backgroundImage: `url(${img})` }}
            />
          ))}
        </div>

        {/* Dark Overlay */}
        <div className="bg-overlay" />

        {/* Noise Texture */}
        <div className="bg-noise" />

        {/* Slide Indicators */}
        <div className="slide-indicators">
          {SLIDE_IMAGES.map((_, i) => (
            <div
              key={i}
              className={`slide-dot ${currentSlide === i ? 'active' : ''}`}
              onClick={() => goToSlide(i)}
            />
          ))}
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="login-header">
            <div className="school-badge">
              <div className="school-crest">🎓</div>
            </div>
            
            {/* Updated H1 with logo */}
            <h1>
              <img 
                src={logo} 
                alt="CBT System Logo" 
                style={{ height: '1.2rem', marginRight: '8px', verticalAlign: 'middle' }} 
              />
              Software Management System
            </h1>

            <div className="school-name">Datforte International School</div>
            <p>Software Management System</p>
          </div>

          <div className="login-body">
            {/* Role Selector */}
            <div className="login-role-selector">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className={`login-role-btn ${selectedRole === role.id ? 'active' : ''}`}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <div className="icon">{role.icon}</div>
                  <div className="label">{role.label}</div>
                </div>
              ))}
            </div>

            {error && (
              <div className="alert alert-danger">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Admin/Teacher Fields */}
              {(selectedRole === 'admin' || selectedRole === 'teacher') && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">👤</span> Username
                    </label>
                    <input
                      type="text"
                      name="username"
                      className="form-control"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="Enter username"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">🔒</span> Password
                    </label>
                    <div className="password-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        className="form-control password-input"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter password"
                        required
                      />
                      <button 
                        type="button" 
                        className="toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Student Fields */}
              {selectedRole === 'student' && (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <span className="student-tag">
                      <span className="pulse-dot" />
                      Student Login
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">🔢</span> Admission Number
                    </label>
                    <input
                      type="text"
                      name="admissionNumber"
                      className="form-control"
                      value={formData.admissionNumber}
                      onChange={handleChange}
                      placeholder="e.g. DIS/2025/001"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="login-divider">
                    <span>verify identity</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">👤</span> First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      className="form-control"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="Enter your first name"
                      required
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></span>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>

          <div className="login-footer">
            <span className="powered">Datforte International School</span> — CBT Platform<br />
            Secure Computer Based Testing System
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;