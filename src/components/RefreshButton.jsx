import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RefreshButton({ size = 24, style = {} }) {
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()
  const { refreshUserData } = useAuth()

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    
    try {
      if (refreshUserData) {
        await refreshUserData()
      }
      window.location.reload()
    } catch (e) {
      console.error('Refresh error:', e)
      setRefreshing(false)
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--text-primary)',
        cursor: refreshing ? 'wait' : 'pointer',
        padding: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        background: 'var(--bg-primary)',
        transition: 'all 0.2s',
        transform: refreshing ? 'rotate(360deg)' : 'none',
        ...style
      }}
      aria-label={refreshing ? 'Refreshing...' : 'Refresh data'}
      title="Refresh data"
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={{
          animation: refreshing ? 'spin 1s linear infinite' : 'none'
        }}
      >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}