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
                // Silently skip waiting and reload when a new version is installed
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

// Global handler for script load failures (ChunkLoadError)
window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('chunk') || e.message.includes('Loading chunk'))) {
    console.log('Chunk error detected, reloading...');
    window.location.reload();
  }
}, true);

// Global handler for unhandled promise rejections (often happens with dynamic imports)
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && (e.reason.name === 'ChunkLoadError' || (e.reason.message && e.reason.message.includes('Loading chunk')))) {
    console.log('Chunk load rejection detected, reloading...');
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
