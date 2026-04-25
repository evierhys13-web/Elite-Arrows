import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, supportRequestsCollection, doc, setDoc } from '../firebase'

export default function Support() {
  const { user, getAllUsers } = useAuth()
  const [activeTab, setActiveTab] = useState('support')
  const [supportForm, setSupportForm] = useState({ issue: '', description: '' })
  const [reportForm, setReportForm] = useState({ reportType: '', targetUser: '', description: '' })
  const [submitted, setSubmitted] = useState(false)

  const admins = getAllUsers().filter(u => u.isAdmin)
  const allUsers = getAllUsers().filter(u => u.id !== user.id)

  const handleSupportSubmit = async (e) => {
    e.preventDefault()
    if (!supportForm.issue || !supportForm.description) {
      alert('Please fill in all fields')
      return
    }

    const supportRequests = JSON.parse(localStorage.getItem('eliteArrowsSupportRequests') || '[]')
    const newRequest = {
      id: Date.now(),
      userId: user.id,
      username: user.username,
      email: user.email,
      issue: supportForm.issue,
      description: supportForm.description,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    supportRequests.push(newRequest)
    localStorage.setItem('eliteArrowsSupportRequests', JSON.stringify(supportRequests))

    try {
      await setDoc(doc(supportRequestsCollection, newRequest.id.toString()), newRequest)
    } catch (err) {
      console.error('Error saving to Firestore:', err)
    }

    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setSupportForm({ issue: '', description: '' })
    }, 3000)
  }

  const handleReportSubmit = async (e) => {
    e.preventDefault()
    if (!reportForm.reportType || !reportForm.description) {
      alert('Please fill in all required fields')
      return
    }

    const report = {
      id: Date.now(),
      reporterId: user.id,
      reporterUsername: user.username,
      reportType: reportForm.reportType,
      targetUser: reportForm.targetUser || 'N/A',
      description: reportForm.description,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    try {
      await setDoc(doc(supportRequestsCollection, `report_${report.id}`), report)
    } catch (err) {
      console.error('Error saving report:', err)
    }

    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setReportForm({ reportType: '', targetUser: '', description: '' })
    }, 3000)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Support</h1>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`division-tab ${activeTab === 'support' ? 'active' : ''}`}
          onClick={() => setActiveTab('support')}
        >
          Get Help
        </button>
        <button
          className={`division-tab ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          Report User/Content
        </button>
      </div>

      {activeTab === 'support' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="card-title">Need Help?</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Submit a support request and all admins will be notified to help you.
          </p>

          <form onSubmit={handleSupportSubmit}>
            <div className="form-group">
              <label>Issue Type</label>
              <select 
                value={supportForm.issue} 
                onChange={(e) => setSupportForm({...supportForm, issue: e.target.value})}
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
                value={supportForm.description}
                onChange={(e) => setSupportForm({...supportForm, description: e.target.value})}
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
      )}

      {activeTab === 'report' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="card-title">Report User or Content</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Report inappropriate behavior, content, or users. All reports are reviewed by admins.
          </p>

          <form onSubmit={handleReportSubmit}>
            <div className="form-group">
              <label>Report Type</label>
              <select 
                value={reportForm.reportType} 
                onChange={(e) => setReportForm({...reportForm, reportType: e.target.value})}
                required
              >
                <option value="">Select report type</option>
                <option value="inappropriate_content">Inappropriate Content</option>
                <option value="harassment">Harassment or Bullying</option>
                <option value="spam">Spam</option>
                <option value="cheating">Cheating or Unfair Play</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Target User (optional)</label>
              <select 
                value={reportForm.targetUser} 
                onChange={(e) => setReportForm({...reportForm, targetUser: e.target.value})}
              >
                <option value="">Select user (optional)</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.username}>{u.username}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea 
                value={reportForm.description}
                onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                rows={5}
                placeholder="Describe what happened and include any relevant details..."
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" style={{ background: 'var(--error)' }}>
              {submitted ? 'Report Submitted!' : 'Submit Report'}
            </button>
          </form>
        </div>
      )}

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