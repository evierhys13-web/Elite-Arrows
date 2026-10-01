import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { db, collection, doc, getDocs, onSnapshot, setDoc, deleteDoc, serverTimestamp } from '../firebase'
import { precacheAssets } from '../utils/swPrecache'
import { loadCachedBackgrounds, saveCachedBackgrounds } from '../utils/bgCache'

const BackgroundContext = createContext(null)

// A pageBackgrounds snapshot is expensive (images are multi-hundred-KB data
// URLs), so the single onSnapshot below is the only thing that should ever
// read it. Do not add ad-hoc getDocs calls on route changes.
function mapBackgrounds(snap) {
  const map = {}
  snap.docs.forEach((d) => {
    const data = d.data() || {}
    map[d.id] = {
      imageUrl: data.imageUrl || '',
      opacity: typeof data.opacity === 'number' ? data.opacity : 0.5,
      blur: typeof data.blur === 'number' ? data.blur : 0,
      fit: data.fit === 'contain' ? 'contain' : 'cover'
    }
  })
  return map
}

export function BackgroundProvider({ children }) {
  const [backgrounds, setBackgrounds] = useState({})
  const [loading, setLoading] = useState(true)
  const hydratedRef = useRef(false)

  // Hydrate from IndexedDB first so returning visitors see their background on
  // the very first paint, before any network round-trip.
  useEffect(() => {
    let cancelled = false
    loadCachedBackgrounds().then((cached) => {
      if (cancelled) return
      if (cached && Object.keys(cached).length > 0) {
        setBackgrounds(cached)
      }
      hydratedRef.current = true
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    saveCachedBackgrounds(backgrounds)
    precacheAssets(
      Object.values(backgrounds)
        .map((b) => b.imageUrl)
        .filter((u) => typeof u === 'string' && u.startsWith('http'))
    )
  }, [backgrounds])

  useEffect(() => {
    let unsub
    try {
      unsub = onSnapshot(collection(db, 'pageBackgrounds'), (snap) => {
        setBackgrounds(mapBackgrounds(snap))
        setLoading(false)
      }, (err) => {
        console.warn('pageBackgrounds listener error:', err)
        setLoading(false)
      })
    } catch (e) {
      console.warn('pageBackgrounds init error:', e)
      setLoading(false)
    }
    return () => { if (unsub) unsub() }
  }, [])

  const saveBackground = useCallback(async (pageKey, data) => {
    const ref = doc(db, 'pageBackgrounds', pageKey)
    await setDoc(ref, {
      imageUrl: data.imageUrl || '',
      opacity: typeof data.opacity === 'number' ? data.opacity : 0.5,
      blur: typeof data.blur === 'number' ? data.blur : 0,
      fit: data.fit === 'contain' ? 'contain' : 'cover',
      updatedAt: serverTimestamp()
    }, { merge: true })
  }, [])

  const removeBackground = useCallback(async (pageKey) => {
    const ref = doc(db, 'pageBackgrounds', pageKey)
    try {
      await deleteDoc(ref)
    } catch (e) {
      console.warn('remove background error:', e)
    }
  }, [])

  const [activeDivision, setActiveDivision] = useState(null)

  // Explicit opt-in re-read, for the Admin "save background" flow. Never call
  // this on navigation — it duplicates the live listener and costs a full
  // read of every stored image.
  const refresh = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'pageBackgrounds'))
      setBackgrounds(mapBackgrounds(snap))
    } catch (e) {
      console.warn('pageBackgrounds refresh error:', e)
    }
  }, [])

  const value = useMemo(() => ({
    backgrounds,
    loading,
    saveBackground,
    removeBackground,
    refresh,
    activeDivision,
    setActiveDivision
  }), [backgrounds, loading, saveBackground, removeBackground, refresh, activeDivision])

  return (
    <BackgroundContext.Provider value={value}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function usePageBackgrounds() {
  const context = useContext(BackgroundContext)
  if (!context) {
    return {
      backgrounds: {},
      loading: false,
      saveBackground: async () => {},
      removeBackground: async () => {},
      refresh: async () => {},
      activeDivision: null,
      setActiveDivision: () => {}
    }
  }
  return context
}