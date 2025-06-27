import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../ComponentsCSS/Home.css';

const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem('token');
    
    if (token) {
      // If token exists, navigate to main section automatically
      navigate('/mainsection');
    }
  }, [navigate]);

  return (
    <div className="home-container">
      <div className="home-content">
        <h1 className="home-title">Portfolio Admin Panel</h1>
        <p className="home-description">
          Welcome to your portfolio website administration panel. 
          Login to manage your content or register for a new account.
        </p>
        <div className="home-actions">
          <Link to="/login" className="btn btn-primary">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Home;