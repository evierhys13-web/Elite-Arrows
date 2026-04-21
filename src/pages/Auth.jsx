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

  const { signUp, signIn, isAuthenticated, loading: authLoading, getAllUsers } = useAuth()
  const navigate = useNavigate()

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
      alert('Error: ' + err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <BackgroundDecor />
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/logo.jpg" alt="Elite Arrows" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', marginBottom: '10px' }} />
          <h1>Elite Arrows</h1>
          <p>Darts League</p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${!isSignUp ? 'active' : ''}`}
              onClick={() => { setIsSignUp(false); setError('') }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${isSignUp ? 'active' : ''}`}
              onClick={() => { setIsSignUp(true); setError('') }}
            >
              Sign Up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>
            )}

            {!isSignUp && (
              <>
                <div className="form-group">
                  <label htmlFor="email">Email Address (or DartCounter Username)</label>
                  <input
                    type="text"
                    id="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    placeholder="Enter your email or DartCounter username"
                    autoComplete="off"
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-10px', marginBottom: '15px' }}>
                  You can sign in with either your email address or your DartCounter username
                </p>
              </>
            )}

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>

            {isSignUp && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                />
              </div>
            )}

            {isSignUp && (
              <>
                <div className="form-group">
                  <label htmlFor="dartCounterUsername">DartCounter Username</label>
                  <input
                    type="text"
                    id="dartCounterUsername"
                    name="dartCounterUsername"
                    value={formData.dartCounterUsername || ''}
                    onChange={handleChange}
                    placeholder="Enter your DartCounter username"
                    autoComplete="off"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="threeDartAverage">3-Dart Average</label>
                  <input
                    type="number"
                    id="threeDartAverage"
                    name="threeDartAverage"
                    value={formData.threeDartAverage}
                    onChange={handleChange}
                    placeholder="Enter your 3-dart average"
                    step="0.01"
                    min="0"
                    autoComplete="off"
                  />
                </div>
              </>
            )}

          <div className="checkbox-group">
              <input
                type="checkbox"
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
              />
              <label htmlFor="rememberMe">Remember me</label>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>

            {!isSignUp && (
              <p style={{ textAlign: 'center', marginTop: '15px' }}>
                <button 
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setError(''); setResetSent(false); setResetEmail(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}
                >
                  Forgot Password?
                </button>
              </p>
            )}
          </form>
        </div>
      </div>

      {showForgotPassword && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '400px',
            width: '100%',
            border: '1px solid var(--border)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '15px', color: 'var(--accent-cyan)' }}>Reset Password</h2>
            {resetSent ? (
              <>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Password reset email sent! Check your inbox for instructions on how to reset your password.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  If you don't see the email, check your spam folder.
                </p>
                <button 
                  className="btn btn-primary btn-block" 
                  onClick={() => setShowForgotPassword(false)}
                  style={{ marginTop: '20px' }}
                >
                  Back to Sign In
                </button>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <form onSubmit={handleForgotPassword}>
                  <div className="form-group">
                    <label htmlFor="resetEmail">Email Address</label>
                    <input
                      type="email"
                      id="resetEmail"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email"
                      autoComplete="email"
                    />
                  </div>
                  {error && <p className="form-error">{error}</p>}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
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
                      style={{ flex: 1 }}
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