import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { db, collection, doc, onSnapshot, setDoc, serverTimestamp, deleteField } from '../firebase'

const SponsorshipContext = createContext(null)

export function SponsorshipProvider({ children }) {
  const [configs, setConfigs] = useState({})
  const [assets, setAssets] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubs = []
    try {
      unsubs.push(
        onSnapshot(collection(db, 'sponsoredLeagues'), (snap) => {
          const map = {}
          snap.docs.forEach((d) => { map[d.id] = d.data() })
          setConfigs(map)
        }, (err) => console.warn('sponsoredLeagues listener error:', err)),
      )
      unsubs.push(
        onSnapshot(collection(db, 'leaguePageAssets'), (snap) => {
          const map = {}
          snap.docs.forEach((d) => { map[d.id] = d.data() })
          setAssets(map)
        }, (err) => console.warn('leaguePageAssets listener error:', err)),
      )
      setLoading(false)
    } catch (e) {
      console.warn('sponsorship init error:', e)
      setLoading(false)
    }
    return () => unsubs.forEach((u) => { if (u) u() })
  }, [])

  const saveConfig = useCallback(async (leagueId, patch) => {
    await setDoc(doc(db, 'sponsoredLeagues', leagueId), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
  }, [])

  const saveAssets = useCallback(async (leagueId, patch) => {
    await setDoc(doc(db, 'leaguePageAssets', leagueId), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
  }, [])

  const removeAssetFields = useCallback(async (leagueId, keys) => {
    await setDoc(
      doc(db, 'leaguePageAssets', leagueId),
      Object.fromEntries(keys.map((k) => [k, deleteField()])),
      { merge: true },
    )
  }, [])

  const value = useMemo(
    () => ({ configs, assets, loading, saveConfig, saveAssets, removeAssetFields }),
    [configs, assets, loading, saveConfig, saveAssets, removeAssetFields],
  )

  return (
    <SponsorshipContext.Provider value={value}>
      {children}
    </SponsorshipContext.Provider>
  )
}

export function useSponsorship() {
  const context = useContext(SponsorshipContext)
  if (!context) {
    throw new Error('useSponsorship must be used within a SponsorshipProvider')
  }
  return context
}