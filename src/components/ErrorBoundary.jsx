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

    // Auto-refresh after 3 seconds if it's the first time
    const crashCount = parseInt(sessionStorage.getItem('crashCount') || '0')
    if (crashCount < 2) {
      sessionStorage.setItem('crashCount', (crashCount + 1).toString())
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    }
  }

  render() {
    if (this.state.hasError) {
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
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ marginBottom: '10px' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px', maxWidth: '400px' }}>
            The app encountered an unexpected error. We're attempting to reload for you automatically.
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
