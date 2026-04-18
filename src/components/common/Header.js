import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthData, getAuthData } from '../../api';
import './header.css';

const Header = ({ title, onToggleSidebar, onMobileMenuClick }) => {
  const navigate = useNavigate();
  const { user } = getAuthData();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Close dropdown on route change or scroll
  useEffect(() => {
    setMenuOpen(false);
  }, [navigate]);

  const handleLogout = () => {
    setMenuOpen(false);
    clearAuthData();
    navigate('/login');
  };

  const handleToggleSidebar = () => {
    setMenuOpen(false);
    // on mobile, open overlay sidebar; on desktop, collapse
    if (onMobileMenuClick && window.innerWidth < 768) {
      onMobileMenuClick();
    } else if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  const getInitials = () => {
    if (!user) return '?';
    if (user.role === 'admin') return 'A';
    return `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`;
  };

  const getDisplayName = () => {
    if (!user) return 'User';
    if (user.role === 'admin') return user.name || 'Admin';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  };

  return (
    <header className="header">
      {/* Left section */}
      <div className="header-left">
        <button
          className="header-toggle"
          onClick={handleToggleSidebar}
          type="button"
          aria-label="Toggle menu"
        >
          <span className="header-toggle-bar"></span>
          <span className="header-toggle-bar"></span>
          <span className="header-toggle-bar"></span>
        </button>
        <h2 className="header-title">{title}</h2>
      </div>

      {/* Right section */}
      <div className="header-right" ref={menuRef}>
        {/* Desktop: show full user info + logout button */}
        <div className="header-user-desktop">
          <div className="header-user-avatar-sm">{getInitials()}</div>
          <div className="header-user-info">
            <div className="header-user-name">{getDisplayName()}</div>
            <div className="header-user-role">{user?.role || 'Unknown'}</div>
          </div>
        </div>
        <button className="header-logout-desktop" onClick={handleLogout} type="button">
          Logout
        </button>

        {/* Mobile: avatar that opens dropdown */}
        <button
          className="header-avatar-trigger"
          onClick={toggleMenu}
          type="button"
          aria-label="User menu"
          aria-expanded={menuOpen}
        >
          {getInitials()}
        </button>

        {/* Dropdown menu */}
        <div className={`header-dropdown ${menuOpen ? 'header-dropdown--open' : ''}`}>
          <div className="header-dropdown-user">
            <div className="header-dropdown-avatar">{getInitials()}</div>
            <div className="header-dropdown-info">
              <div className="header-dropdown-name">{getDisplayName()}</div>
              <div className="header-dropdown-role">{user?.role || 'Unknown'}</div>
            </div>
          </div>
          <div className="header-dropdown-divider"></div>
          <button className="header-dropdown-item header-dropdown-item--logout" onClick={handleLogout} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;