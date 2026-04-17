import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setShowBanner(false)
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
  }

  if (isInstalled || !showBanner) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
      padding: '15px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 -4px 20px rgba(0, 212, 255, 0.3)',
      zIndex: 9999,
      gap: '10px'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ 
          color: '#fff', 
          fontWeight: '600', 
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '1.2rem' }}>📱</span>
          Get the Elite Arrows App
        </div>
        <div style={{ 
          color: 'rgba(255,255,255,0.85)', 
          fontSize: '0.8rem',
          marginTop: '2px'
        }}>
          Add to home screen for a better experience
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleInstall}
          style={{
            background: '#fff',
            color: '#00d4ff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            border: 'none',
            padding: '10px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
