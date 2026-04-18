import React from 'react';
import './Loading.css'; // Make sure to import the CSS

const Loading = ({ message = 'Loading' }) => {
  return (
    // role="status" and aria-live make it accessible for screen readers
    <div className="loading-overlay" role="status" aria-live="polite">
      
      {/* Background Glow Effect */}
      <div className="loading-glow"></div>

      <div className="loading-card">
        
        {/* Spinner Container */}
        <div className="spinner-wrapper">
          <div className="spinner-ring"></div>
          <div className="spinner-inner">
            {/* Simple animated SVG Icon */}
            <svg className="spinner-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
            </svg>
          </div>
        </div>

        {/* Text with CSS animated dots */}
        <p className="loading-text">{message}</p>
        
      </div>
    </div>
  );
};

export default Loading;