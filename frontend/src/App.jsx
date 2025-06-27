import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './Components/Header'; // Keep the original import name
import Home from './Components/Home';
import Login from './Components/Login';
import BlogEditor from './Components/BlogEditor';
import Messages from './Components/Messages';
import Adminpost from './Components/Adminpost';
import SocialPost from './Components/SocialPost';
import Project from './Components/Project';
import Welcome from './Components/Welcome';
import './index.css';

function AppContent() {
  const [activeSection, setActiveSection] = useState('/adminpost'); // Initialize with default path
  const location = useLocation();

  // Update activeSection when location changes
  useEffect(() => {
    setActiveSection(location.pathname);
  }, [location.pathname]);

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
          <Route path="/welcome" element={<Welcome/>}/>
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