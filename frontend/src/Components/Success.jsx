import React from 'react';
import { useNavigate } from 'react-router-dom';

const Success = () => {
  const navigate = useNavigate();
  
  // Simple logout handler
  const handleLogout = () => {
    // Clear any stored data
    // No need for complex logic as you mentioned you need a simple page
    navigate('/login');
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      padding: '20px'
    }}>
      <h1>Login Successful</h1>
      <p>You have successfully logged into the Portfolio Admin Dashboard.</p>
      <button 
        onClick={handleLogout}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          background: '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>
    </div>
  );
};

export default Success;