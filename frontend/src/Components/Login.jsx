import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Turnstile } from '@marsidev/react-turnstile';
import '../ComponentsCSS/auth.css';
const Login = () => {
  const navigate = useNavigate();
  const turnstileRef = useRef(null);
  
  const [view, setView] = useState('login');
  const [animating, setAnimating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  
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
  
  // Use the direct site key
  const siteKey = import.meta.env.VITE_SITE_KEY
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
      setTurnstileToken(null); // Reset token on view change
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    }, 300);
  };
  
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!turnstileToken) {
      setError('Please complete the CAPTCHA verification');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('https://connectwithaaditiyamg.onrender.com/api/admin/login', {
        email: loginData.email,
        password: loginData.password
      }, {
        withCredentials: true // Important for handling cookies
      });
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      // Navigate to success page
      navigate('/mainsection');
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed');
      setTurnstileToken(null);
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
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
    if (!turnstileToken) {
      setError('Please complete the CAPTCHA verification');
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
      setTurnstileToken(null);
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
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
      case 1: return 'strength-weak';
      case 2: return 'strength-medium';
      case 3: return 'strength-strong';
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
    <div className={`form-container ${animating ? 'fade-out' : 'fade-in'}`}>
      <h2>Portfolio Admin Login</h2>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}
      <form onSubmit={handleLoginSubmit}>
        <div className="form-group">
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
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={loginData.password}
            onChange={handleLoginChange}
            required
          />
        </div>
        <div className="form-group turnstile-container">
          <Turnstile
            ref={turnstileRef}
            siteKey={siteKey}
            onSuccess={(token) => {
              setTurnstileToken(token);
              setError('');
            }}
            onError={() => {
              setError('CAPTCHA verification failed. Please try again.');
              setTurnstileToken(null);
            }}
            onExpire={() => {
              setError('CAPTCHA expired. Please verify again.');
              setTurnstileToken(null);
            }}
            theme="light"
            size="normal"
            responseField={false}
            refreshExpired="auto"
          />
        </div>
        <div className="form-actions">
          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading || !turnstileToken}
          >
            {loading ? 'Processing...' : 'Login'}
          </button>
          <div className="form-links">
            <span 
              onClick={() => changeView('forgotPassword')}
              className="text-link"
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
    <div className={`form-container ${animating ? 'fade-out' : 'fade-in'}`}>
      <h2>Forgot Password</h2>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}
      <form onSubmit={handleForgotPassword}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={forgotEmail}
            onChange={handleForgotEmailChange}
            required
            autoFocus
          />
        </div>
        <div className="form-group turnstile-container">
          <Turnstile
            ref={turnstileRef}
            siteKey={siteKey}
            onSuccess={(token) => {
              setTurnstileToken(token);
              setError('');
            }}
            onError={() => {
              setError('CAPTCHA verification failed. Please try again.');
              setTurnstileToken(null);
            }}
            onExpire={() => {
              setError('CAPTCHA expired. Please verify again.');
              setTurnstileToken(null);
            }}
            theme="light"
            size="normal"
            responseField={false}
            refreshExpired="auto"
          />
        </div>
        <div className="form-actions">
          <button 
            type="button" 
            className="secondary-btn"
            onClick={() => changeView('login')}
          >
            Back to Login
          </button>
          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading || !turnstileToken}
          >
            {loading ? 'Processing...' : 'Send Reset Link'}
          </button>
        </div>
      </form>
    </div>
  );
  
  // OTP Verification & Reset Password Form
  const renderResetOTPForm = () => (
    <div className={`form-container ${animating ? 'fade-out' : 'fade-in'}`}>
      <h2>Enter OTP</h2>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}
      <form onSubmit={handleResetPassword}>
        <div className="form-group">
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
        <div className="form-group">
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
              <div className="password-strength">
                <div className={`password-strength-meter ${getPasswordStrengthClass()}`}></div>
              </div>
              <div className="password-strength-label">
                {getPasswordStrengthLabel()}
              </div>
            </>
          )}
        </div>
        <div className="form-group">
          <label>Confirm New Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={resetData.confirmPassword}
            onChange={handleResetChange}
            required
          />
          {resetData.confirmPassword && resetData.newPassword !== resetData.confirmPassword && (
            <div className="error-text">
              Passwords do not match
            </div>
          )}
        </div>
        <div className="form-actions">
          <button 
            type="button" 
            className="secondary-btn"
            onClick={() => changeView('login')}
          >
            Back to Login
          </button>
          <button 
            type="submit" 
            className="submit-btn"
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
    <div className="auth-container">
      <div className="auth-box">
        <div className="logo-container">
         
          <div className="app-title">Portfolio Admin</div>
        </div>
        {renderCurrentView()}
      </div>
    </div>
  );
};

export default Login;