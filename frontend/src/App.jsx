
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Header from './Components/Header'; // Keep the original import name
import Home from './Components/Home';
import Login from './Components/Login';
import BlogEditor from './Components/BlogEditor';
import Messages from './Components/Messages';
import Adminpost from './Components/Adminpost';
import Admincommunitypost from './Components/Community';
import SocialPost from './Components/SocialPost';
import Project from './Components/Project';
import Welcome from './Components/Welcome';
import AdminMail from './Components/Adminmail';
import Profile from './Components/Profile';
import Audio from './Components/Audiomessage';
import Stream from './Components/Stream';
import './index.css';
import Announcement from './Components/Announcement';
import Query from './Components/Query';
import Admins from './Components/Admins';
import BlogSubmissions from './Components/BlogSubmissions';
function AppContent() {
  const [activeSection, setActiveSection] = useState('/adminpost'); // Initialize with default path
  const [redirectMessage, setRedirectMessage] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Update activeSection when location changes
  useEffect(() => {
    setActiveSection(location.pathname);
  }, [location.pathname]);

  // Check token and redirect if necessary
  useEffect(() => {
    const publicRoutes = ['/', '/login'];
    const token = localStorage.getItem('token');
    if (!token && !publicRoutes.includes(location.pathname)) {
      // Show redirect message briefly
      setRedirectMessage('Please log in to access this page.');
      setTimeout(() => {
        navigate('/'); // Redirect to home
        setTimeout(() => {
          navigate('/login'); // Then to login
          setRedirectMessage(null);
        }, 500); // Brief pause on home for smooth UX
      }, 1000); // Show message for 1 second
    }
  }, [location.pathname, navigate]);

  const handleLogout = () => {
    // Implement logout logic here, e.g., clear auth tokens and redirect to login
    console.log('Logout triggered');
    window.location.href = '/login'; // Simple redirect for now
  };

  // Define routes where header should be hidden
  const hideHeaderRoutes = ['/', '/login'];
  const shouldShowHeader = !hideHeaderRoutes.includes(location.pathname);

  return (
    <div className="app-container">
      {redirectMessage && (
        <div className="redirect-message">{redirectMessage}</div>
      )}
      {shouldShowHeader && (
        <Header
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          onLogout={handleLogout}
        />
      )}
      <main className={shouldShowHeader ? "main main-with-header" : "main main-without-header"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/blog-editor" element={<BlogEditor />} /> {/* Aligned with Header.jsx */}
          <Route path="/message" element={<Messages />} /> {/* Aligned with Header.jsx */}
          <Route path="/adminpost" element={<Adminpost />} />
          <Route path="/socialpost" element={<SocialPost />} />
          <Route path="/project" element={<Project />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/adminmail" element={<AdminMail/>}/>
          <Route path="/profile" element={<Profile/>}/>
          <Route path="/admincommunitypost" element={<Admincommunitypost/>}/>
          <Route path="/audiomessage" element={<Audio/>}/>
          <Route path="/stream" element={<Stream/>}/>
          <Route path="/announcement" element={<Announcement/>}/>
          <Route path="/query" element={<Query/>}/>
          <Route path="/admins" element={<Admins/>}/>
          <Route path="/blogsubmissions" element={<BlogSubmissions/>}/>
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
