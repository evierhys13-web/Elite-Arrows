import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function NotificationPermissionPrompt() {
  const { user, notificationPermission, requestNotificationPermission } = useAuth()
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user) return
    
    const hasBeenPrompted = localStorage.getItem('eliteArrowsNotificationPrompted')
    const permission = localStorage.getItem('eliteArrowsNotificationDismissed')
    
    if (!hasBeenPrompted && notificationPermission === 'default' && !dismissed) {
      const timer = setTimeout(() => setShowPrompt(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [user, notificationPermission, dismissed])

  const handleAccept = async () => {
    const granted = await requestNotificationPermission()
    localStorage.setItem('eliteArrowsNotificationPrompted', 'true')
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('eliteArrowsNotificationDismissed', 'true')
    setDismissed(true)
    setShowPrompt(false)
  }

  if (!showPrompt || !user) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        maxWidth: '360px',
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        border: '1px solid var(--accent-primary)',
        padding: '16px',
        zIndex: 9999,
        animation: 'slideIn 0.3s ease'
      }}
    >
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '2rem' }}>🔔</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
            Enable Notifications
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Get notified when your results are approved, fixtures are scheduled, and more!
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
              Enable
            </button>
            <button
              onClick={handleDismiss}
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
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
