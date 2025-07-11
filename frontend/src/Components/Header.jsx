import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Header.css'; // Using the same CSS file as your main header

const AdminHeader = ({ activeSection, setActiveSection, onLogout }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const adminNavItems = [
    { name: 'Posts', path: '/adminpost' },
    { name: 'Community Posts', path: '/admincommunitypost' },
    { name: 'Blog Editor', path: '/blog-editor' },
    { name: 'Messages', path: '/message' },
    { name: 'Projects', path: '/project' },
    { name: 'Social Posts', path: '/socialpost' },
    {name: 'AdminMail', path:'/adminmail'},
    {name: 'Set Profile', path: '/profile'},
    
  ];

  const handleLogout = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      // Call logout API
      await axios.post(
        'https://connectwithaaditiyamg.onrender.com/api/admin/logout',
        {},
        { withCredentials: true }
      );

      // Clear client-side token
      localStorage.removeItem('token');

      // Show success message
      setMessage({ type: 'success', text: 'Logged out successfully!' });

      // Navigate to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
        setIsLoading(false);
      }, 2000);
    } catch (err) {
      console.error('Logout failed:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Logout failed. Please try again.',
      });
      setIsLoading(false);
    }
  };

  return (
    <header className="portfolio-header">
      <div className="header-content">
        <div className="logo-section" onClick={handleGoHome} style={{ cursor: 'pointer' }}>
          <span className="logo-initials">AT</span>
          <div className="logo-text">
            <span className="logo-name">Admin Panel</span>
            <span className="logo-role">Portfolio Manager</span>
          </div>
        </div>
                
        <nav className="main-navigation">
          {adminNavItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                setActiveSection(item.path);
                navigate(item.path);
              }}
              className={`nav-item ${activeSection === item.path ? 'nav-item-active' : ''}`}
            >
              <span className="nav-label">{item.name}</span>
            </button>
          ))}
        </nav>
                
        <div className="header-controls">
          <button 
            onClick={handleRefresh}
            className="control-btn"
            title="Refresh Page"
            disabled={isLoading}
          >
            ↻
          </button>
          <button 
            onClick={handleFullscreen}
            className="control-btn"
            title={document.fullscreenElement ? "Exit Fullscreen" : "Enter Fullscreen"}
            disabled={isLoading}
          >
            {document.fullscreenElement ? '⤓' : '⤢'}
          </button>
          <button 
            onClick={handleLogout}
            className="control-btn1"
            title="Logout"
            disabled={isLoading}
          >
            {isLoading ? <span className="spinner"></span> : 'Logout'}
          </button>
        </div>
      </div>
      {message && (
        <div className={`${message.type}-message`}>
          {message.text}
          {message.type === 'error' && (
            <button
              className="dismiss-btn"
              onClick={() => setMessage(null)}
            >
              ×
            </button>
          )}
        </div>
      )}
    </header>
  );
};

export default AdminHeader;