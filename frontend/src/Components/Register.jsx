import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Turnstile } from '@marsidev/react-turnstile';
import '../ComponentsCSS/auth.css';
const Register = () => {
  const navigate = useNavigate();
  const turnstileRef = useRef(null);
  
  const [view, setView] = useState('register');
  const [animating, setAnimating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [otpData, setOtpData] = useState({
    email: '',
    otp: ''
  });
  
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  // Use the direct site key
  const siteKey = "0x4AAAAAABUex35iY9OmXSBB";
  
  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData({
      ...registerData,
      [name]: value
    });
    if (name === 'password') {
      checkPasswordStrength(value);
    }
  };
  
  const handleOtpChange = (e) => {
    setOtpData({
      ...otpData,
      [e.target.name]: e.target.value
    });
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
  
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!turnstileToken) {
      setError('Please complete the CAPTCHA verification');
      setLoading(false);
      return;
    }

    // Check if passwords match
    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Check password strength
    if (passwordStrength < 2) {
      setError('Please use a stronger password');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('https://connectwithaaditiyamg.onrender.com/api/admin/register', {
        name: registerData.name,
        email: registerData.email,
        password: registerData.password
      });

      setMessage(response.data.message);
      // Save email for OTP verification
      setOtpData(prev => ({...prev, email: registerData.email}));
      // Change view to OTP verification
      changeView('verifyOtp');
    } catch (error) {
      setError(error.response?.data?.message || 'Registration failed');
      setTurnstileToken(null);
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await axios.post('https://connectwithaaditiyamg.onrender.com/api/admin/verify-otp', {
        email: otpData.email,
        otp: otpData.otp
      });

      setMessage(response.data.message);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'OTP verification failed');
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
  
  // Registration Form
  const renderRegisterForm = () => (
    <div className={`form-container ${animating ? 'fade-out' : 'fade-in'}`}>
      <h2>Create Admin Account</h2>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}
      <form onSubmit={handleRegisterSubmit}>
        <div className="form-group">
          <label>Full Name</label>
          <input
            type="text"
            name="name"
            value={registerData.name}
            onChange={handleRegisterChange}
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={registerData.email}
            onChange={handleRegisterChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={registerData.password}
            onChange={handleRegisterChange}
            required
          />
          {registerData.password && (
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
          <label>Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={registerData.confirmPassword}
            onChange={handleRegisterChange}
            required
          />
          {registerData.confirmPassword && registerData.password !== registerData.confirmPassword && (
            <div className="error-text">
              Passwords do not match
            </div>
          )}
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
            disabled={loading || !turnstileToken || 
                     registerData.password !== registerData.confirmPassword || 
                     passwordStrength < 2}
          >
            {loading ? 'Processing...' : 'Register'}
          </button>
          <div className="form-links">
            <span>Already have an account? </span>
            <Link to="/login" className="text-link">
              Login
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
  
  // OTP Verification Form
  const renderVerifyOtpForm = () => (
    <div className={`form-container ${animating ? 'fade-out' : 'fade-in'}`}>
      <h2>Verify Email</h2>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}
      <form onSubmit={handleVerifyOtp}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={otpData.email}
            onChange={handleOtpChange}
            disabled
          />
        </div>
        <div className="form-group">
          <label>Verification Code</label>
          <input
            type="text"
            name="otp"
            value={otpData.otp}
            onChange={handleOtpChange}
            placeholder="Enter 6-digit code from email"
            required
            autoFocus
          />
        </div>
        <div className="form-actions">
          <button 
            type="button" 
            className="secondary-btn"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </button>
          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading || !otpData.otp}
          >
            {loading ? 'Processing...' : 'Verify Email'}
          </button>
        </div>
      </form>
    </div>
  );
  
  const renderCurrentView = () => {
    switch(view) {
      case 'verifyOtp':
        return renderVerifyOtpForm();
      default:
        return renderRegisterForm();
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="logo-container">
          <img 
            src="/logo.svg" 
            alt="Portfolio Admin" 
            className="logo"
          />
          <div className="app-title">Portfolio Admin</div>
        </div>
        {renderCurrentView()}
      </div>
    </div>
  );
};

export default Register;