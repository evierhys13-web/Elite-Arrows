import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Initialize Capacitor for mobile (only runs when Capacitor is available)
if (typeof window !== 'undefined' && window.Capacitor) {
  import('@capacitor/core')
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // A new version is available, skip waiting and notify
                console.log('New version found, updating...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });

    // Reload when the new service worker has taken over
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('Service worker changed, reloading page...');
        window.location.reload();
      }
    });
  });
}

function isChunkLoadError(value) {
  if (!value) return false
  const message = typeof value.message === 'string' ? value.message : ''
  return value.name === 'ChunkLoadError' ||
         message.includes('Loading chunk') ||
         message.includes('Failed to fetch dynamically imported module') ||
         message.includes('importing a module script failed') ||
         message.includes('before initialization') ||
         message.includes('Cannot access') ||
         message.includes('is not defined') ||
         message.includes('chunk') ||
         /assets\/[^"']*\.js/.test(message)
}

// Global handler for script load failures (ChunkLoadError)
window.addEventListener('error', (e) => {
  if (isChunkLoadError(e.error) || (e.message && isChunkLoadError({ message: e.message }))) {
    console.log('Chunk error detected, reloading...');
    const lastReload = parseInt(sessionStorage.getItem('eliteArrowsLastChunkReload') || '0');
    const now = Date.now();
    if (now - lastReload > 5000) { // Only reload once every 5 seconds to avoid loops
      sessionStorage.setItem('eliteArrowsLastChunkReload', String(now));
      window.location.reload();
    } else {
      console.error('Infinite reload loop detected. Stopping.');
    }
  }
}, true);

// Global handler for unhandled promise rejections (often happens with dynamic imports)
window.addEventListener('unhandledrejection', (e) => {
  if (isChunkLoadError(e.reason) || (e.reason?.message && isChunkLoadError({ message: e.reason.message }))) {
    console.log('Chunk load rejection detected, reloading...');
    const lastReload = parseInt(sessionStorage.getItem('eliteArrowsLastChunkReload') || '0');
    const now = Date.now();
    if (now - lastReload > 5000) {
      sessionStorage.setItem('eliteArrowsLastChunkReload', String(now));
      window.location.reload();
    } else {
      console.error('Infinite reload loop detected. Stopping.');
    }
  }
});

import ErrorBoundary from './components/ErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
