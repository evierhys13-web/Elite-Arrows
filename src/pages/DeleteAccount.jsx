import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { auth, db, doc, deleteDoc } from '../firebase'

export default function DeleteAccount() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('info')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm')
      return
    }

    if (!user) {
      setError('You must be logged in to delete your account')
      return
    }

    try {
      await deleteDoc(doc(db, 'users', user.id))
      await auth.currentUser.delete()
      localStorage.removeItem('eliteArrowsCurrentUser')
      signOut()
      setStep('deleted')
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        setError('For security, please log out and log back in, then try again.')
      } else {
        setError('Error: ' + error.message)
      }
    }
  }

  if (step === 'deleted') {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>✓</div>
        <h1 style={{ color: 'var(--success)', marginBottom: '12px' }}>Account Deleted</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Your Elite Arrows account and all associated data have been permanently deleted.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/auth')}>
          Return to Login
        </button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h1 style={{ marginBottom: '12px' }}>Delete Account</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          You must be logged in to delete your account.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/auth')}>
          Go to Login
        </button>
      </div>
    )
  }

  return (
    <div className="page" style={{ padding: '20px' }}>
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ color: 'var(--error)', marginBottom: '16px', fontSize: '1.5rem' }}>
          Delete Your Account
        </h1>

        {step === 'info' && (
          <>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
              This will permanently delete your Elite Arrows account and all associated data, including:
            </p>
            <ul style={{ color: 'var(--text-muted)', marginBottom: '24px', paddingLeft: '20px' }}>
              <li>Your profile and settings</li>
              <li>Match history and statistics</li>
              <li>Chat messages</li>
              <li>Support requests</li>
              <li>Subscription data</li>
            </ul>
            <p style={{ color: 'var(--error)', marginBottom: '24px', fontWeight: '600' }}>
              This action cannot be undone.
            </p>
            <button className="btn btn-danger btn-block" onClick={() => setStep('confirm')}>
              Continue to Delete
            </button>
            <button className="btn btn-secondary btn-block" style={{ marginTop: '8px' }} onClick={() => navigate('/home')}>
              Cancel
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
              To confirm, type <strong>DELETE</strong> in the box below:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => { setConfirmText(e.target.value); setError('') }}
              placeholder="Type DELETE"
              style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
            />
            {error && (
              <p style={{ color: 'var(--error)', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>
            )}
            <button className="btn btn-danger btn-block" onClick={handleDelete}>
              Permanently Delete Account
            </button>
            <button className="btn btn-secondary btn-block" style={{ marginTop: '8px' }} onClick={() => setStep('info')}>
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
