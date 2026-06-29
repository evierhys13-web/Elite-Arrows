import React from 'react'

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

    const isChunkError = error?.name === 'ChunkLoadError' ||
                         error?.message?.includes('chunk') ||
                         error?.message?.includes('Loading chunk')

    if (isChunkError) {
      setTimeout(() => window.location.reload(), 0)
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.name === 'ChunkLoadError' ||
                           this.state.error?.message?.includes('chunk') ||
                           this.state.error?.message?.includes('Loading chunk')

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
              : "The app encountered an unexpected error. We're attempting to reload for you automatically."}
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
