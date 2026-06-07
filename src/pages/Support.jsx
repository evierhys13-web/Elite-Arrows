import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, supportRequestsCollection, doc, setDoc } from '../firebase'
import { DiagnosticBot } from '../utils/DiagnosticBot'

export default function Support() {
  const { user, getAllUsers, getResults, getCups, advanceCupBracket, triggerDataRefresh } = useAuth()
  const [activeTab, setActiveTab] = useState('bot')
  const [supportForm, setSupportForm] = useState({ issue: '', description: '' })
  const [reportForm, setReportForm] = useState({ reportType: '', targetUser: '', description: '' })
  const [submitted, setSubmitted] = useState(false)

  // AI Assistant State
  const [messages, setMessages] = useState([
    { text: `Hello ${user?.username || ''}! I'm your Elite Arrows Assistant. How can I help you today?`, isBot: true }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg = input
    setMessages(prev => [...prev, { text: userMsg, isBot: false }])
    setInput('')
    setIsTyping(true)

    const canFix = user.isAdmin || user.isSubscribed

    // Simulate bot delay
    setTimeout(async () => {
      let botResponse = DiagnosticBot.getResponseFor(userMsg, canFix)

      const lowerMsg = userMsg.toLowerCase()

      // Handle Admin/Subscriber Fixes
      if (canFix && (lowerMsg.includes('duplicate') || lowerMsg.includes('double')) && lowerMsg.includes('result')) {
        setMessages(prev => [...prev, { text: "Scanning for duplicates...", isBot: true }])
        const res = await DiagnosticBot.fixDuplicatedLeagueResults(getResults())
        botResponse = res.message
        if (res.fixed > 0) triggerDataRefresh('results')
      }
      else if (canFix && (lowerMsg.includes('bracket') || lowerMsg.includes('cup')) && (lowerMsg.includes('fix') || lowerMsg.includes('sync'))) {
        setMessages(prev => [...prev, { text: "Synchronizing cup brackets...", isBot: true }])
        const res = await DiagnosticBot.fixCupBrackets(getCups(), getResults(), advanceCupBracket)
        botResponse = res.message
        if (res.fixed > 0) triggerDataRefresh('all')
      }
      // Standard Diagnostic
      else if (lowerMsg.includes('diagnostic') || lowerMsg.includes('fix') || lowerMsg.includes('check')) {
        setMessages(prev => [...prev, { text: "Running diagnostics...", isBot: true }])
        const results = await DiagnosticBot.runFullCheck()

        let report = "Diagnostics Complete:\n"
        report += `• Network: ${results.network.connected ? '✅ Online' : '❌ Offline'}\n`
        report += `• Camera: ${results.camera.status === 'granted' ? '✅ Ready' : '⚠️ ' + results.camera.status}\n`

        if (results.camera.action) {
          botResponse = report + "\n" + results.camera.action
        } else if (!results.network.connected) {
          botResponse = report + "\n" + results.network.action
        } else {
          botResponse = report + "\nEverything seems to be working correctly! If you're still having trouble, please describe the issue."
        }
      }

      setMessages(prev => [...prev, { text: botResponse, isBot: true }])
      setIsTyping(false)
    }, 1000)
  }

  const runQuickFix = async () => {
    setMessages(prev => [...prev, { text: "Starting quick fix...", isBot: false }])
    setIsTyping(true)

    const results = await DiagnosticBot.runFullCheck()
    let fixApplied = false

    if (results.camera.status !== 'granted') {
      await DiagnosticBot.checkCamera().then(c => c.fix?.())
      fixApplied = true
    }

    setTimeout(() => {
      setMessages(prev => [...prev, {
        text: fixApplied ? "I've attempted to fix your camera permissions. Please try again!" : "I checked everything and it looks good. If you're still having issues, try restarting the app.",
        isBot: true
      }])
      setIsTyping(false)
    }, 1500)
  }

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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '5px' }}>
        <button
          className={`division-tab ${activeTab === 'bot' ? 'active' : ''}`}
          onClick={() => setActiveTab('bot')}
        >
          AI Assistant
        </button>
        <button
          className={`division-tab ${activeTab === 'support' ? 'active' : ''}`}
          onClick={() => setActiveTab('support')}
        >
          Submit Ticket
        </button>
        <button
          className={`division-tab ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          Report
        </button>
      </div>

      {activeTab === 'bot' && (
        <div className="card" style={{ height: '500px', display: 'flex', flexDirection: 'column', padding: '0' }}>
          <div style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>Elite Assistant</h3>
              <p style={{ fontSize: '12px', color: 'var(--success)', margin: 0 }}>● Online & Ready to Fix</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={runQuickFix} style={{ fontSize: '12px' }}>
              Run Quick Fix
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.isBot ? 'flex-start' : 'flex-end',
                background: m.isBot ? 'var(--card-bg)' : 'var(--primary)',
                color: m.isBot ? 'var(--text-main)' : 'white',
                padding: '10px 15px',
                borderRadius: m.isBot ? '15px 15px 15px 0' : '15px 15px 0 15px',
                maxWidth: '85%',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                whiteSpace: 'pre-line'
              }}>
                {m.text}
              </div>
            ))}
            {isTyping && (
              <div style={{ alignSelf: 'flex-start', background: 'var(--card-bg)', padding: '10px 15px', borderRadius: '15px 15px 15px 0', fontSize: '14px' }}>
                Assistant is thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={{ padding: '15px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Type your problem here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }}>
              Send
            </button>
          </form>
        </div>
      )}

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