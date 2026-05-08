import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BackgroundDecor from '../components/BackgroundDecor'
import { auth, sendPasswordResetEmail } from '../firebase'

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    dartCounterUsername: '',
    threeDartAverage: '',
    rememberMe: false
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const { signUp, signIn, isAuthenticated, loading: authLoading, getAllUsers, adminData } = useAuth()
  const navigate = useNavigate()

  const registrationsEnabled = adminData?.registrationsEnabled !== false

  if (authLoading) {
    return (
      <div className="auth-page">
        <div style={{ textAlign: 'center', color: 'white' }}>Loading...</div>
      </div>
    )
  }

  if (isAuthenticated) {
    navigate('/home')
    return null
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    setError('')
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setResetLoading(true)

    try {
      if (!resetEmail) {
        throw new Error('Please enter your email address')
      }
      await sendPasswordResetEmail(auth, resetEmail)
      setResetSent(true)
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address')
      }
      throw new Error(err.message)
    } finally {
      setResetLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        if (!formData.email || !formData.password) {
          throw new Error('Email and password are required')
        }
        if (!formData.dartCounterUsername) {
          throw new Error('DartCounter username is required')
        }
        if (!formData.threeDartAverage) {
          throw new Error('3-Dart average is required')
        }
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match')
        }
        const avg = parseFloat(formData.threeDartAverage) || 0;

        const username = formData.dartCounterUsername || formData.email.split('@')[0]
        
        await signUp({
          username: username,
          email: formData.email,
          password: formData.password,
          threeDartAverage: avg,
          dartCounterUsername: formData.dartCounterUsername,
          dartCounterLink: formData.dartCounterUsername ? `https://dartcounter.app/profile/${formData.dartCounterUsername}` : ''
        }, formData.rememberMe)
      } else {
        if (!formData.email || !formData.password) {
          throw new Error('Email and password are required')
        }

        await signIn(formData.email, formData.password, formData.rememberMe)
      }

      navigate('/home')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <BackgroundDecor />
      <div className="auth-container animate-fade-in">
        <div className="auth-logo">
          <div className="avatar-ring" style={{ margin: '0 auto 16px', width: '90px', height: '90px' }}>
            <div className="avatar-inner">
               <img src="/elite arrows.jpg" alt="Elite Arrows" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
          <h1 className="text-gradient">Elite Arrows</h1>
          <p>Darts League</p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${!isSignUp ? 'active' : ''}`}
              onClick={() => { setIsSignUp(false); setError(''); setShowForgotPassword(false); }}
              style={{ flex: registrationsEnabled ? 1 : 'none', width: registrationsEnabled ? 'auto' : '100%' }}
            >
              Sign In
            </button>
            {registrationsEnabled && (
              <button
                className={`auth-tab ${isSignUp ? 'active' : ''}`}
                onClick={() => { setIsSignUp(true); setError(''); setShowForgotPassword(false); }}
              >
                Sign Up
              </button>
            )}
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="form-error">{error}</div>}

            {isSignUp && !registrationsEnabled ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
                <h3 style={{ marginBottom: '8px' }}>Recruitment Closed</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  New player registrations are currently paused. Please check back later or contact an admin if you believe this is an error.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  style={{ marginTop: '24px' }}
                  onClick={() => setIsSignUp(false)}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <>
                {isSignUp && (
                  <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="name@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                )}

                {!isSignUp && (
                  <div className="form-group">
                    <label htmlFor="email">Email or DartCounter Username</label>
                    <input
                      type="text"
                      id="email"
                      name="email"
                      value={formData.email || ''}
                      onChange={handleChange}
                      placeholder="Enter your credentials"
                      autoComplete="username"
                      required
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', display: 'block', paddingLeft: '4px' }}>
                      Use either your email or DartCounter name to sign in
                    </span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    required
                  />
                </div>

                {isSignUp && (
                  <>
                    <div className="form-group">
                      <label htmlFor="confirmPassword">Confirm Password</label>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group">
                        <label htmlFor="dartCounterUsername">DC Username</label>
                        <input
                          type="text"
                          id="dartCounterUsername"
                          name="dartCounterUsername"
                          value={formData.dartCounterUsername || ''}
                          onChange={handleChange}
                          placeholder="Username"
                          autoComplete="off"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="threeDartAverage">3-Dart Avg</label>
                        <input
                          type="number"
                          id="threeDartAverage"
                          name="threeDartAverage"
                          value={formData.threeDartAverage}
                          onChange={handleChange}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          autoComplete="off"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div className="checkbox-group" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      id="rememberMe"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                    />
                    <label htmlFor="rememberMe">Remember me</label>
                  </div>

                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(true); setError(''); setResetSent(false); setResetEmail(''); }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>

                <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ height: '52px', fontSize: '1rem' }}>
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                      {isSignUp ? 'Creating Account...' : 'Signing In...'}
                    </span>
                  ) : (
                    isSignUp ? 'Create Account' : 'Sign In'
                  )}
                </button>
              </>
            )}
          </form>
        </div>
      </div>

      {showForgotPassword && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <h2 style={{ marginTop: 0, marginBottom: '12px', color: 'var(--accent-cyan)', fontSize: '1.5rem', fontWeight: 800 }}>Reset Password</h2>
            {resetSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📧</div>
                <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>Check your email</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '24px' }}>
                  We've sent password reset instructions to <strong>{resetEmail}</strong>.
                </p>
                <button 
                  className="btn btn-primary btn-block" 
                  onClick={() => setShowForgotPassword(false)}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
                  Enter the email address associated with your account and we'll send you a link to reset your password.
                </p>
                <form onSubmit={handleForgotPassword}>
                  <div className="form-group">
                    <label htmlFor="resetEmail">Email Address</label>
                    <input
                      type="email"
                      id="resetEmail"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  {error && <div className="form-error">{error}</div>}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button 
                      type="button"
                      className="btn btn-secondary" 
                      onClick={() => setShowForgotPassword(false)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="btn btn-primary" 
                      disabled={resetLoading}
                      style={{ flex: 2 }}
                    >
                      {resetLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
