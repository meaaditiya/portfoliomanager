import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../ComponentsCSS/auth.css';

const Login = () => {
  const navigate = useNavigate();
  
  const [view, setView] = useState('login');
  const [animating, setAnimating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  
  const [forgotEmail, setForgotEmail] = useState('');
  
  const [resetData, setResetData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const handleLoginChange = (e) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleForgotEmailChange = (e) => {
    setForgotEmail(e.target.value);
  };
  
  const handleResetChange = (e) => {
    const { name, value } = e.target;
    setResetData({
      ...resetData,
      [name]: value
    });
    if (name === 'newPassword') {
      checkPasswordStrength(value);
    }
  };
  
  const checkPasswordStrength = (password) => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    setPasswordStrength(strength >= 4 ? 3 : (strength >= 2 ? 2 : 1));
  };
  
  const changeView = (newView) => {
    setAnimating(true);
    setTimeout(() => {
      setView(newView);
      setError('');
      setMessage('');
      setAnimating(false);
    }, 300);
  };
  
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('https://connectwithaaditiyamg.onrender.com/api/admin/login', {
        email: loginData.email,
        password: loginData.password
      }, {
        withCredentials: true
      });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      navigate('/welcome');
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setError('Please enter your email address');
      return;
    }
    
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await axios.post('https://connectwithaaditiyamg.onrender.com/api/admin/forgot-password', { 
        email: forgotEmail
      });

      setResetData(prev => ({...prev, email: forgotEmail}));
      setMessage(response.data.message);
      changeView('resetOTP');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };
  
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (resetData.newPassword !== resetData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (passwordStrength < 2) {
      setError('Please use a stronger password');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('https://connectwithaaditiyamg.onrender.com/api/admin/reset-password', {
        email: resetData.email,
        otp: resetData.otp,
        newPassword: resetData.newPassword
      });

      setMessage(response.data.message);
      setTimeout(() => {
        changeView('login');
      }, 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };
  
  const getPasswordStrengthClass = () => {
    switch (passwordStrength) {
      case 1: return 'login-strength-weak';
      case 2: return 'login-strength-medium';
      case 3: return 'login-strength-strong';
      default: return '';
    }
  };
  
  const getPasswordStrengthLabel = () => {
    switch (passwordStrength) {
      case 1: return 'Weak';
      case 2: return 'Medium';
      case 3: return 'Strong';
      default: return '';
    }
  };
  
  // Login Form
  const renderLoginForm = () => (
    <div className={`login-form-container ${animating ? 'login-fade-out' : 'login-fade-in'}`}>
      <h2>Portfolio Admin Login</h2>
      {error && <div className="login-error-box">{error}</div>}
      {message && <div className="login-success-box">{message}</div>}
      <form onSubmit={handleLoginSubmit}>
        <div className="login-form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={loginData.email}
            onChange={handleLoginChange}
            required
            autoFocus
          />
        </div>
        <div className="login-form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={loginData.password}
            onChange={handleLoginChange}
            required
          />
        </div>
        <div className="login-form-actions">
          <button 
            type="submit" 
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Login'}
          </button>
          <div className="login-form-links">
            <span 
              onClick={() => changeView('forgotPassword')}
              className="login-text-link"
            >
              Forgot Password?
            </span>
          </div>
        </div>
      </form>
    </div>
  );
  
  // Forgot Password Form
  const renderForgotPasswordForm = () => (
    <div className={`login-form-container ${animating ? 'login-fade-out' : 'login-fade-in'}`}>
      <h2>Forgot Password</h2>
      {error && <div className="login-error-box">{error}</div>}
      {message && <div className="login-success-box">{message}</div>}
      <form onSubmit={handleForgotPassword}>
        <div className="login-form-group">
          <label>Email</label>
          <input
            type="email"
            value={forgotEmail}
            onChange={handleForgotEmailChange}
            required
            autoFocus
          />
        </div>
        <div className="login-form-actions">
          <button 
            type="button" 
            className="login-secondary-btn"
            onClick={() => changeView('login')}
          >
            Back to Login
          </button>
          <button 
            type="submit" 
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Send Reset Link'}
          </button>
        </div>
      </form>
    </div>
  );
  
  // OTP Verification & Reset Password Form
  const renderResetOTPForm = () => (
    <div className={`login-form-container ${animating ? 'login-fade-out' : 'login-fade-in'}`}>
      <h2>Enter OTP</h2>
      {error && <div className="login-error-box">{error}</div>}
      {message && <div className="login-success-box">{message}</div>}
      <form onSubmit={handleResetPassword}>
        <div className="login-form-group">
          <label>OTP Code</label>
          <input
            type="text"
            name="otp"
            value={resetData.otp}
            onChange={handleResetChange}
            placeholder="Enter the OTP sent to your email"
            required
            autoFocus
          />
        </div>
        <div className="login-form-group">
          <label>New Password</label>
          <input
            type="password"
            name="newPassword"
            value={resetData.newPassword}
            onChange={handleResetChange}
            required
          />
          {resetData.newPassword && (
            <>
              <div className="login-password-strength">
                <div className={`login-password-strength-meter ${getPasswordStrengthClass()}`}></div>
              </div>
              <div className="login-password-strength-label">
                {getPasswordStrengthLabel()}
              </div>
            </>
          )}
        </div>
        <div className="login-form-group">
          <label>Confirm New Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={resetData.confirmPassword}
            onChange={handleResetChange}
            required
          />
          {resetData.confirmPassword && resetData.newPassword !== resetData.confirmPassword && (
            <div className="login-error-text">
              Passwords do not match
            </div>
          )}
        </div>
        <div className="login-form-actions">
          <button 
            type="button" 
            className="login-secondary-btn"
            onClick={() => changeView('login')}
          >
            Back to Login
          </button>
          <button 
            type="submit" 
            className="login-submit-btn"
            disabled={loading || resetData.newPassword !== resetData.confirmPassword || passwordStrength < 2}
          >
            {loading ? 'Processing...' : 'Reset Password'}
          </button>
        </div>
      </form>
    </div>
  );
  
  const renderCurrentView = () => {
    switch(view) {
      case 'forgotPassword':
        return renderForgotPasswordForm();
      case 'resetOTP':
        return renderResetOTPForm();
      default:
        return renderLoginForm();
    }
  };

  return (
    <div className="login-auth-container">
      <div className="login-auth-box">
        <div className="login-logo-container">
          <div className="login-app-title">Portfolio Admin</div>
        </div>
        {renderCurrentView()}
      </div>
    </div>
  );
};

export default Login;