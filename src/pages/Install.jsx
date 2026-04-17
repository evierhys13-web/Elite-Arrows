import { useState, useEffect } from 'react'

export default function Install() {
  const [isStandalone, setIsStandalone] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true)
    }
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      window.deferredPrompt = e
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    if (window.deferredPrompt) {
      setCanInstall(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!window.deferredPrompt) {
      alert('Install option not available.\n\nPlease use the manual steps below.')
      return
    }

    setInstalling(true)
    window.deferredPrompt.prompt()
    const { outcome } = await window.deferredPrompt.userChoice
    setInstalling(false)

    if (outcome === 'accepted') {
      setIsStandalone(true)
      setCanInstall(false)
    }
    window.deferredPrompt = null
  }

  if (isStandalone) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">App Installed ✓</h1>
        </div>
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              background: 'rgba(34, 197, 94, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <span style={{ fontSize: '2.5rem' }}>✓</span>
            </div>
            <h2 style={{ color: 'var(--success)', marginBottom: '10px' }}>App Already Installed!</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Elite Arrows is installed on your device. Open it from your home screen!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📱 Install Elite Arrows</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
          Add the app to your home screen for a better experience
        </p>
      </div>

      {canInstall && (
        <div className="card" style={{ 
          marginBottom: '20px', 
          border: '2px solid var(--accent-cyan)',
          background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 153, 204, 0.05))'
        }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📲</div>
            <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Quick Install Available!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              One-tap install - takes just a few seconds
            </p>
            <button 
              className="btn btn-primary btn-block"
              onClick={handleInstall}
              disabled={installing}
              style={{ 
                padding: '15px 30px', 
                fontSize: '1.1rem',
                background: 'linear-gradient(135deg, #00d4ff, #0099cc)'
              }}
            >
              {installing ? 'Installing...' : '⬇️ Install Now'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '20px' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{ 
              width: '50px', 
              height: '50px', 
              borderRadius: '12px', 
              background: 'rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              🍎
            </div>
            <div>
              <h3 style={{ margin: 0 }}>iPhone / iPad</h3>
              <p style={{ color: 'var(--text-muted)', margin: '5px 0 0', fontSize: '0.9rem' }}>
                Using Safari browser
              </p>
            </div>
          </div>
          <ol style={{ color: 'var(--text)', paddingLeft: '24px', lineHeight: '2.2', margin: 0 }}>
            <li>Open this page in <strong>Safari</strong> browser</li>
            <li>Tap the <strong>Share</strong> button at the bottom of the screen</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>Add</strong> in the top right corner</li>
            <li>Done! The app will appear on your home screen</li>
          </ol>
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: 'var(--bg-secondary)', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.2rem' }}>💡</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <strong>Important:</strong> You must use Safari, not Chrome or other browsers
            </span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{ 
              width: '50px', 
              height: '50px', 
              borderRadius: '12px', 
              background: 'rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              🤖
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Android</h3>
              <p style={{ color: 'var(--text-muted)', margin: '5px 0 0', fontSize: '0.9rem' }}>
                Using Chrome browser
              </p>
            </div>
          </div>
          <ol style={{ color: 'var(--text)', paddingLeft: '24px', lineHeight: '2.2', margin: 0 }}>
            <li>Open this page in <strong>Chrome</strong> browser</li>
            <li>Look for the <strong>blue banner</strong> at the bottom of the screen</li>
            <li>Tap <strong>"Add to Home screen"</strong></li>
            <li>Or tap the <strong>three dots (⋮)</strong> menu</li>
            <li>Select <strong>"Add to Home screen"</strong></li>
            <li>Tap <strong>Add</strong> to confirm</li>
          </ol>
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: 'rgba(34, 197, 94, 0.1)', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              The app works <strong>offline</strong> and loads <strong>faster</strong> when installed!
            </span>
          </div>
        </div>

        <div className="card" style={{ border: '1px solid var(--accent-cyan)' }}>
          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>✨</span> Benefits of Installing
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--success)' }}>✓</span>
              <span>Faster loading - pages load instantly</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--success)' }}>✓</span>
              <span>Full screen - no browser address bar</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--success)' }}>✓</span>
              <span>Home screen icon - easy to find</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--success)' }}>✓</span>
              <span>Works offline - basic viewing available</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--success)' }}>✓</span>
              <span>Push notifications (coming soon)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
