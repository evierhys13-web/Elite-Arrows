export function precacheAssets(urls) {
  const clean = (urls || []).filter(Boolean)
  if (!clean.length) return
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready
    .then((reg) => {
      if (reg.active) {
        reg.active.postMessage({ type: 'PRECACHE_ASSETS', urls: clean })
      }
    })
    .catch(() => {})
}