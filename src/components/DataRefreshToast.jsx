import { useState, useEffect } from 'react'

export default function DataRefreshToast({ refreshTrigger }) {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (refreshTrigger > 0) {
      const messages = [
        '🔄 Data updated in real-time!',
        '📊 Table refreshed!',
        '✅ New data available!',
        '⚡ Live update received!'
      ]
      const randomMessage = messages[Math.floor(Math.random() * messages.length)]
      setMessage(randomMessage)
      setVisible(true)
      
      const timer = setTimeout(() => {
        setVisible(false)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [refreshTrigger])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
      color: '#fff',
      padding: '15px 25px',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0, 212, 255, 0.4)',
      zIndex: 10000,
      animation: 'slideIn 0.3s ease-out',
      fontWeight: '600',
      fontSize: '0.95rem'
    }}>
      {message}
      <style>{`
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
      `}</style>
    </div>
  )
}
