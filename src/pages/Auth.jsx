import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BackgroundDecor from '../components/BackgroundDecor'

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        if (!formData.dartCounterUsername || !formData.email || !formData.password) {
          throw new Error('All fields are required')
        }
        const avg = parseFloat(formData.threeDartAverage) || 0;

        await signUp({
          username: formData.dartCounterUsername,
          email: formData.email,
          password: formData.password,
          threeDartAverage: avg,
          dartCounterUsername: formData.dartCounterUsername,
          dartCounterLink: formData.dartCounterUsername ? `https://dartcounter.net/player/${formData.dartCounterUsername}` : ''
        }, formData.rememberMe)
        alert('Sign up successful!')
      } else {
        if ((!formData.dartCounterUsername && !formData.email) || !formData.password) {
          throw new Error('DartCounter username (or email) and password are required')
        }

        const allUsers = getAllUsers()
        
        let user = null
        
        if (formData.email && formData.email.includes('@')) {
          user = allUsers.find(u => u.email?.toLowerCase() === formData.email.toLowerCase())
        }
        
        if (!user && formData.dartCounterUsername) {
          user = allUsers.find(u => u.dartCounterUsername?.toLowerCase() === formData.dartCounterUsername.toLowerCase())
        }
        
        if (!user) {
          throw new Error('User not found. Use your DartCounter username or email address.')
        }
        if (!user.email) {
          throw new Error('No email associated with this account')
        }

        await signIn(user.email, formData.password, formData.rememberMe)
        alert('Sign in successful!')
      }

      window.location.href = '/home'
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
              <>
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
              </>
            )}
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
          </form>
        </div>
      </div>
    </div>
  )
}