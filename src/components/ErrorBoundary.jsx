import React from 'react'

function checkIsChunkError(error) {
  if (!error) return false
  const msg = (error?.message || '').toLowerCase()
  const name = error?.name || ''
  return name === 'ChunkLoadError' ||
         msg.includes('loading chunk') ||
         msg.includes('failed to fetch dynamically imported module') ||
         msg.includes('importing a module script failed')
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo)
    try {
      localStorage.setItem('eliteArrowsLastError', JSON.stringify({
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        time: new Date().toISOString()
      }))
    } catch (e) {}

    if (checkIsChunkError(error)) {
      const reloadKey = 'ea_chunk_reload_done'
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1')
        setTimeout(() => window.location.reload(), 300)
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = checkIsChunkError(this.state.error)

      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-primary)',
          color: 'white'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>
            {isChunkError ? '🔄' : '⚠️'}
          </div>
          <h2 style={{ marginBottom: '10px' }}>
            {isChunkError ? 'Updating App...' : 'Something went wrong'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px', maxWidth: '400px' }}>
            {isChunkError
              ? 'We found a new version of the app. Refreshing to get the latest features for you...'
              : 'The app encountered an unexpected error. Please try refreshing.'}
          </p>
          <div style={{ marginBottom: '30px', fontSize: '0.85rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '16px', borderRadius: '12px', maxWidth: '500px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error?.toString()}
          </div>

          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Refresh Now
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
