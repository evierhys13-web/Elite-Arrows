import { app } from './firebase'

let analytics = null
let perf = null

export const getAnalyticsRef = () => analytics
export const getPerfRef = () => perf

export async function initAnalytics() {
  if (analytics || typeof window === 'undefined') return analytics
  try {
    const { getAnalytics } = await import('firebase/analytics')
    analytics = getAnalytics(app)
  } catch (e) {
    console.warn('Firebase Analytics not available:', e.message)
  }
  return analytics
}

export async function initPerformance() {
  if (perf || typeof window === 'undefined') return perf
  try {
    const { getPerformance } = await import('firebase/performance')
    perf = getPerformance(app)
  } catch (e) {
    console.warn('Firebase Performance not available:', e.message)
  }
  return perf
}

export async function setAnalyticsConsent(settings) {
  try {
    const { setConsent } = await import('firebase/analytics')
    setConsent(settings)
  } catch (e) {}
}

export async function fireAnalyticsEvent(eventName, params) {
  if (!analytics) return
  try {
    const { logEvent } = await import('firebase/analytics')
    logEvent(analytics, eventName, params)
  } catch (e) {}
}

export const safeTrace = (name) => {
  const instance = perf
  if (!instance) return () => {}
  let done = false
  let t = null
  import('firebase/performance')
    .then((m) => {
      if (done) return
      try {
        t = m.trace(instance, name)
        t.start()
      } catch (e) {}
    })
    .catch(() => {})
  return (attributes = {}) => {
    if (t) {
      try {
        Object.entries(attributes).forEach(([key, value]) => {
          t.putAttribute(key, String(value))
        })
        t.stop()
      } catch (e) {}
    } else {
      done = true
    }
  }
}