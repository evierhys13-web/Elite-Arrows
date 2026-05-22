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

    const isChunkError = error?.name === 'ChunkLoadError' ||
                         error?.message?.includes('chunk') ||
                         error?.message?.includes('Loading chunk')

    // Auto-refresh logic
    const crashCount = parseInt(sessionStorage.getItem('crashCount') || '0')

    if (isChunkError || crashCount < 2) {
      sessionStorage.setItem('crashCount', (crashCount + 1).toString())

      // If it's a chunk error, reload immediately as it's almost always a version mismatch
      const delay = isChunkError ? 0 : 3000

      setTimeout(() => {
        window.location.reload()
      }, delay)
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
          <button
            className="btn btn-primary"
            onClick={() => {
              sessionStorage.setItem('crashCount', '0')
              window.location.reload()
            }}
          >
            Refresh Now
          </button>

          <details style={{ marginTop: '40px', opacity: 0.5, fontSize: '0.8rem', textAlign: 'left', width: '100%', maxWidth: '500px' }}>
            <summary>Error Details (Technical)</summary>
            <pre style={{ whiteSpace: 'pre-wrap', padding: '10px', background: '#000', borderRadius: '8px' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
