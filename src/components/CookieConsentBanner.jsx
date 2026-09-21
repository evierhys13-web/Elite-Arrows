import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { grantAnalyticsConsent, denyAnalyticsConsent, CONSENT_KEY } from '../utils/analytics'

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        const timer = setTimeout(() => setVisible(true), 4000)
        return () => clearTimeout(timer)
      }
    } catch (e) {}
  }, [])

  if (!visible) return null

  const handleAccept = () => {
    grantAnalyticsConsent()
    setVisible(false)
  }

  const handleReject = () => {
    denyAnalyticsConsent()
    setVisible(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        maxWidth: '420px',
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        border: '1px solid var(--accent-primary)',
        padding: '16px',
        zIndex: 9999,
        animation: 'slideInUp 0.3s ease'
      }}
    >
      <style>
        {`
          @keyframes slideInUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
          🍪 Cookies &amp; analytics
        </h4>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          We use Google Analytics to understand how the site is used so we can improve it.
          Analytics data is only collected if you accept. See our{' '}
          <Link to="/privacy-policy" style={{ color: 'var(--accent-cyan)' }} onClick={handleReject}>
            privacy policy
          </Link>
          .
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleAccept}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--accent-primary)',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.1s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.1s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}