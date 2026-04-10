import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Contact() {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    category: '',
    firstName: '',
    lastName: '',
    email: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.category || !formData.firstName || !formData.lastName || !formData.email || !formData.message) {
      alert('Please fill in all required fields')
      return
    }

    const contactMessages = JSON.parse(localStorage.getItem('eliteArrowsContactMessages') || '[]')
    contactMessages.push({
      id: Date.now(),
      ...formData,
      fromUser: user?.username,
      fromEmail: user?.email,
      toEmail: 'rhyshowe2023@outlook.com',
      timestamp: new Date().toISOString(),
      status: 'pending'
    })
    localStorage.setItem('eliteArrowsContactMessages', JSON.stringify(contactMessages))
    
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setFormData({ category: '', firstName: '', lastName: '', email: '', message: '' })
    }, 3000)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Contact Us</h1>
      </div>

      <div className="card">
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          Any questions, ideas, or feedback? Contact us below.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Category</label>
            <select 
              value={formData.category} 
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              required
            >
              <option value="">Select a category</option>
              <option value="question">Question</option>
              <option value="idea">Idea</option>
              <option value="feedback">Feedback</option>
              <option value="bug">Report a Bug</option>
              <option value="payment">Payment Issue</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>First Name</label>
              <input 
                type="text" 
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Last Name</label>
              <input 
                type="text" 
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>Message</label>
            <textarea 
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              rows={5}
              placeholder="Write your message here..."
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            {submitted ? 'Sent!' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  )
}