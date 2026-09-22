import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { db, collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from '../firebase'

const BackgroundContext = createContext(null)

export function BackgroundProvider({ children }) {
  const [backgrounds, setBackgrounds] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub
    try {
      unsub = onSnapshot(collection(db, 'pageBackgrounds'), (snap) => {
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
        setBackgrounds(map)
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

  const value = useMemo(() => ({
    backgrounds,
    loading,
    saveBackground,
    removeBackground,
    activeDivision,
    setActiveDivision
  }), [backgrounds, loading, saveBackground, removeBackground, activeDivision])

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
      activeDivision: null,
      setActiveDivision: () => {}
    }
  }
  return context
}