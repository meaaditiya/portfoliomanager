import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css'; // Using the same CSS file as your main header

const AdminHeader = ({ activeSection, setActiveSection, onLogout }) => {
  const navigate = useNavigate();

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
    { name: 'Blog Editor', path: '/blog-editor' },
    { name: 'Messages', path: '/message' },
    { name: 'Projects', path: '/project' },
    { name: 'Social Posts', path: '/socialpost' },
  ];

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
          >
            ↻
          </button>
          <button 
            onClick={handleFullscreen}
            className="control-btn"
            title={document.fullscreenElement ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {document.fullscreenElement ? '⤓' : '⤢'}
          </button>
          <button 
            onClick={onLogout}
            className="control-btn1"
            title="Logout"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;