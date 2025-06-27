
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Welcome.css';

const Welcome = () => {
  const navigate = useNavigate();

  const handleOkClick = () => {
    navigate('/adminpost'); // Redirect to admin dashboard or another route
  };

  return (
    <div className="welcome-container">
      <h1 className="welcome-title">Welcome to Your Portfolio Site</h1>
      <p className="welcome-message">
        Manage your site effortlessly with powerful features: create and edit blog posts, monitor messages, oversee projects, and schedule social posts.
      </p>
      <button className="welcome-btn" onClick={handleOkClick}>
        OK
      </button>
    </div>
  );
};

export default Welcome;
