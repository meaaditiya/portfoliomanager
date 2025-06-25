import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import BlogEditor from '../Components/BlogEditor';
import Messages from '../Components/Messages';
import '../ComponentsCSS/mainsection.css';
import  Adminpost from '../Components/Adminpost';
import Socialpost from '../Components/SocialPost';
import Project from '../Components/Project';
// Placeholder component for Snippets
const Snippets = () => (
  <div className="content-section">
    <h2>Snippets Manager</h2>
    <p>Manage your code snippets here.</p>
    <div className="placeholder-content">
      <p>This is a placeholder for the Snippets component.</p>
      <p>Add, edit, or delete code snippets for your portfolio.</p>
    </div>
  </div>
);

// Placeholder component for Settings
const Settings = () => (
  <div className="content-section">
    <h2>Site Settings</h2>
    <p>Configure your portfolio site settings here.</p>
    <div className="placeholder-content">
      <p>This is a placeholder for the Settings component.</p>
      <p>Update themes, layouts, or other site preferences.</p>
    </div>
  </div>
);

const PortfolioSiteManager = () => {
  const navigate = useNavigate(); // ✅ Moved here correctly

  const [activeSection, setActiveSection] = useState('snippets');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Check authentication status on mount
 
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Make request with Authorization header
        const response = await axios.get(
          'https://connectwithaaditiyamg.onrender.com/api/admin/verify',
          {
            withCredentials: true, // Still try to send cookies
            headers: {
              Authorization: token ? `Bearer ${token}` : '' // Also send token in header
            }
          }
        );
        
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Authentication failed:', err);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
  
    verifyToken();
  }, []);
  // Handle logout
  const handleLogout = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');

      // Call logout API
      await axios.post(
        'https://connectwithaaditiyamg.onrender.com/api/admin/logout',
        {},
        { withCredentials: true }
      );

      // Clear any client-side token (if stored in localStorage, optional)
      localStorage.removeItem('token');

      // Update state to reflect logged-out status
      setIsAuthenticated(false);
      setSuccessMessage('Logout successful!');
      navigate('/login');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to log out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render the appropriate component based on activeSection
  const renderContent = () => {
    switch (activeSection) {
      case 'blog-editor':
        return <BlogEditor />;
      case 'message':
        return <Messages />;
      case 'adminpost':
        return<Adminpost/>;
     case 'socialpost':
      return<Socialpost/>
     case 'project':
       return<Project/>
      case 'snippets':
      default:
        return <Snippets />;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="portfolio-site-manager">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className="portfolio-site-manager">
        <div className="auth-section">
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}
          <h2>Please Log In</h2>
          <p>You need to be authenticated to access the Portfolio Site Manager.</p>
          {/* Add a link to login page if available */}
          <button className="btn btn-primary" onClick={() => window.location.href = '/login'}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Authenticated state
  return (
    <div className="portfolio-site-manager">
      {/* Header */}
      <header className="site-header">
        <h1>Portfolio Site Manager</h1>
        <nav className="header-nav">
          <button
            className={`nav-btn ${activeSection === 'snippets' ? 'active' : ''}`}
            onClick={() => setActiveSection('snippets')}
          >
            Snippets
          </button>
          <button
            className={`nav-btn ${activeSection === 'blog-editor' ? 'active' : ''}`}
            onClick={() => setActiveSection('blog-editor')}
          >
            Blog Editor
          </button>
          <button
            className={`nav-btn ${activeSection === 'message' ? 'active' : ''}`}
            onClick={() => setActiveSection('message')}
          >
            Messages
          </button>
           <button
            className={`nav-btn ${activeSection === 'adminpost' ? 'active' : ''}`}
            onClick={() => setActiveSection('adminpost')}
          >
            Posts
          </button>
           <button
            className={`nav-btn ${activeSection === 'socialpost' ? 'active' : ''}`}
            onClick={() => setActiveSection('socialpost')}
          >
            Social Posts
          </button>
            <button
            className={`nav-btn ${activeSection === 'project' ? 'active' : ''}`}
            onClick={() => setActiveSection('project')}
          >
            Project Requests
          </button>
          <button className="nav-btn btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      {/* Content Area */}
      <main className="content-area">
        {successMessage && <div className="success-message">{successMessage}</div>}
        {error && <div className="error-message">{error}</div>}
        {renderContent()}
      </main>
    </div>
  );
};

export default PortfolioSiteManager;