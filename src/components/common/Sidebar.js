import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import logoImg from '../../pages/logo.png';
import './sidebar.css';

const Sidebar = ({ items, collapsed, isOpen }) => {
  const location = useLocation();
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Clear hovered tooltip when sidebar collapses
  useEffect(() => {
    if (collapsed) setHoveredIndex(null);
  }, [collapsed]);

  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${isOpen ? 'open' : ''}`}
    >
      {/* Ambient floating glow orbs */}
      <div className="sidebar-ambient" aria-hidden="true">
        <div className="ambient-orb ambient-orb--1" />
        <div className="ambient-orb ambient-orb--2" />
      </div>

      {/* Subtle glass layer */}
      <div className="sidebar-glass" aria-hidden="true" />

      {/* Actual content — sits above effects */}
      <div className="sidebar-content">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-mark">
            <img
              src={logoImg}
              alt="DATFORTE SCH Logo"
              className="logo-mark-img"
            />
          </div>
          <div className="logo-text">
            <h2>DATFORTE SCH</h2>
            <p>Application System</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {items.map((item, index) => (
            <div
              key={index}
              className="nav-item-wrapper"
              style={{ '--stagger': `${index * 45}ms` }}
            >
              <NavLink
                to={item.path}
                end
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {/* Animated glow layer on active item */}
                <span className="nav-active-glow" aria-hidden="true" />
              </NavLink>

              {/* Tooltip — only visible when collapsed & hovered */}
              {collapsed && hoveredIndex === index && (
                <div className="nav-tooltip" role="tooltip">
                  {item.label}
                  <span className="nav-tooltip-arrow" aria-hidden="true" />
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom accent line */}
        <div className="sidebar-footer" aria-hidden="true">
          <div className="sidebar-footer-line" />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;