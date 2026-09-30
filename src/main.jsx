import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Initialize Capacitor for mobile (only runs when Capacitor is available)
if (typeof window !== 'undefined' && window.Capacitor) {
  import('@capacitor/core')
}

// Collects custom background/banner image URLs already cached in localStorage
// so the service worker can start downloading them the moment it is ready.
function collectCachedBackgroundUrls() {
  const keys = ['eliteArrowsPageBackgrounds', 'eliteArrowsLeaguePageAssets']
  const urls = []
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw || raw === 'undefined') continue
      const map = JSON.parse(raw)
      for (const id in map) {
        const entry = map[id]
        const u = (entry && (entry.imageUrl || entry.bannerImage)) || null
        if (u) urls.push(u)
      }
    } catch (e) {}
  }
  return urls
}

// Posts the cached image URLs to the service worker so it fetches and caches
// them immediately, and kicks off browser-side preloads so the images are
// already in memory/HTTP cache before the first frame of the app is painted.
function warmBackgroundCache() {
  const urls = collectCachedBackgroundUrls()
  for (const u of urls) {
    const img = new Image()
    img.src = u
  }
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready
    .then((reg) => {
      if (reg.active) {
        reg.active.postMessage({ type: 'PRECACHE_ASSETS', urls })
      }
    })
    .catch(() => {})
}

if ('serviceWorker' in navigator) {
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

      warmBackgroundCache();
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
