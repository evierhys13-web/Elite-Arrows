import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AverageUpdateModal({ isOpen, onClose }) {
  const { user, updateUser } = useAuth()
  const [average, setAverage] = useState(user?.threeDartAverage || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const numAvg = parseFloat(average)
    if (isNaN(numAvg) || numAvg < 0 || numAvg > 180) {
      alert('Please enter a valid 3-dart average (0-180)')
      return
    }

    setIsSubmitting(true)
    try {
      await updateUser({
        threeDartAverage: numAvg,
        averageLastUpdated: new Date().toISOString()
      }, false)
      onClose()
    } catch (error) {
      alert('Failed to update: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal-content glass" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎯</div>
        <h2 className="text-gradient" style={{ marginBottom: '12px' }}>Update Your Average</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
          To ensure our league tables are accurate, please confirm your current **3-Dart Average**.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Current 3-Dart Average</label>
            <input
              type="number"
              step="0.01"
              value={average}
              onChange={(e) => setAverage(e.target.value)}
              placeholder="e.g. 45.5"
              className="glass"
              style={{ fontSize: '1.5rem', textAlign: 'center', fontWeight: 900 }}
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isSubmitting}
            style={{ marginTop: '10px' }}
          >
            {isSubmitting ? 'Updating...' : 'Confirm \u0026 Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
