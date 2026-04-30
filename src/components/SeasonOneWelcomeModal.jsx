import { useState } from 'react'

export default function SeasonOneWelcomeModal({ isOpen, onAcknowledge, userName }) {
  const [refundAcknowledged, setRefundAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleContinue = async () => {
    if (!refundAcknowledged || submitting) return
    setSubmitting(true)
    await onAcknowledge()
    setSubmitting(false)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 6px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
            Season 1
          </p>
          <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '1.55rem' }}>
            Welcome to Season 1 of Elite Arrows{userName ? `, ${userName}` : ''}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '12px' }}>
            Season 1 officially begins on 1 May 2026. This is the first full league season, so the focus is simple:
            arrange your matches, play fairly, submit clear results, and keep the league moving.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '14px' }}>
          <section style={{ padding: '15px', background: 'var(--bg-primary)', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1rem' }}>How The Season Runs</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <li>Players compete in their assigned division.</li>
              <li>League fixtures are played against players in the same division.</li>
              <li>Each league match is Best of 8 legs, first to 5.</li>
              <li>Results must be submitted through the app and approved by admins before counting.</li>
            </ul>
          </section>

          <section style={{ padding: '15px', background: 'var(--bg-primary)', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1rem' }}>League Points</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <li>Win: 3 points</li>
              <li>Draw: 1 point</li>
              <li>Loss: 0 points</li>
              <li>Friendly games do not affect the league table.</li>
            </ul>
          </section>

          <section style={{ padding: '15px', background: 'var(--bg-primary)', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1rem' }}>What Players Need To Do</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <li>Use Fixtures to propose dates and times.</li>
              <li>Respond to fixture proposals quickly so opponents are not left waiting.</li>
              <li>Upload proof when submitting league results.</li>
              <li>Contact an admin if there is a dispute, mistake, or scheduling issue.</li>
            </ul>
          </section>

          <section style={{
            padding: '15px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px'
          }}>
            <h3 style={{ margin: '0 0 8px', color: '#ef4444', fontSize: '1rem' }}>Refund Notice</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Refunds are not available after the 14th day of the league. By continuing, you confirm you understand
              that once day 14 has passed, subscription refunds for this league season are not offered.
            </p>
          </section>
        </div>

        <label className="checkbox-group" style={{
          marginTop: '20px',
          alignItems: 'flex-start',
          color: 'var(--text)',
          lineHeight: 1.5
        }}>
          <input
            type="checkbox"
            checked={refundAcknowledged}
            onChange={(event) => setRefundAcknowledged(event.target.checked)}
            style={{ marginTop: '4px' }}
          />
          <span>
            I understand there are no refunds after the 14th day of the league.
          </span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            className="btn btn-primary"
            disabled={!refundAcknowledged || submitting}
            onClick={handleContinue}
          >
            {submitting ? 'Saving...' : 'Skip and continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
