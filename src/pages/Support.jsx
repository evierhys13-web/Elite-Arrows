import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Support() {
  const { user, getAllUsers } = useAuth()
  const [formData, setFormData] = useState({
    issue: '',
    description: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const admins = getAllUsers().filter(u => u.isAdmin)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.issue || !formData.description) {
      alert('Please fill in all fields')
      return
    }

    const supportRequests = JSON.parse(localStorage.getItem('eliteArrowsSupportRequests') || '[]')
    supportRequests.push({
      id: Date.now(),
      userId: user.id,
      username: user.username,
      email: user.email,
      issue: formData.issue,
      description: formData.description,
      status: 'pending',
      createdAt: new Date().toISOString()
    })
    localStorage.setItem('eliteArrowsSupportRequests', JSON.stringify(supportRequests))

    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setFormData({ issue: '', description: '' })
    }, 3000)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Support</h1>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Need Help?</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
          Submit a support request and all admins will be notified to help you.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Issue Type</label>
            <select 
              value={formData.issue} 
              onChange={(e) => setFormData({...formData, issue: e.target.value})}
              required
            >
              <option value="">Select an issue type</option>
              <option value="technical">Technical Problem</option>
              <option value="payment">Payment Issue</option>
              <option value="account">Account Issue</option>
              <option value="match">Match Result Issue</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={5}
              placeholder="Describe your issue in detail..."
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            {submitted ? 'Request Submitted!' : 'Submit Support Request'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">Contact Admins Directly</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
          You can also message admins directly through the chat for urgent issues.
        </p>
        <div>
          {admins.map(admin => (
            <div key={admin.id} className="player-card">
              <div className="player-avatar">{admin.username.charAt(0).toUpperCase()}</div>
              <div className="player-info">
                <h3>{admin.username}</h3>
                <p>{admin.email}</p>
              </div>
              <span className="admin-badge">Admin</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}