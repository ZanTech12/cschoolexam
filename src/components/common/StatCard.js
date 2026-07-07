<<<<<<< HEAD
import React from 'react';
import './statcard.css'

const StatCard = ({ title, value, icon, color = 'primary', loading = false }) => {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-card-header">
        <div>
          <div className="stat-card-value">
            {loading ? (
              <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '2px' }}></div>
            ) : (
              value
            )}
          </div>
          <div className="stat-card-label">{title}</div>
        </div>
        <div className={`stat-card-icon ${color}`}>{icon}</div>
      </div>
    </div>
  );
};

=======
import React from 'react';
import './statcard.css'

const StatCard = ({ title, value, icon, color = 'primary', loading = false }) => {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-card-header">
        <div>
          <div className="stat-card-value">
            {loading ? (
              <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '2px' }}></div>
            ) : (
              value
            )}
          </div>
          <div className="stat-card-label">{title}</div>
        </div>
        <div className={`stat-card-icon ${color}`}>{icon}</div>
      </div>
    </div>
  );
};

>>>>>>> 691cb9110a3f4ea67e81ae9bd75d409e1b4d6012
export default StatCard;