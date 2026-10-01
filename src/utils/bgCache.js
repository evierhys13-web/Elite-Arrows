const DB_NAME = 'elite-arrows-cache'
const STORE = 'backgrounds'
const RECORD_KEY = 'pageBackgrounds'
const DB_VERSION = 1
const LEGACY_KEY = 'eliteArrowsPageBackgrounds'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const idb = req.result
      if (!idb.objectStoreNames.contains(STORE)) {
        idb.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
}

function readStore(idb) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(RECORD_KEY)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function writeStore(idb, value) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, RECORD_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function readLegacy() {
  try {
    const saved = localStorage.getItem(LEGACY_KEY)
    return saved && saved !== 'undefined' ? JSON.parse(saved) : null
  } catch (e) {
    return null
  }
}

export async function loadCachedBackgrounds() {
  try {
    const idb = await openDb()
    try {
      const value = await readStore(idb)
      if (value && typeof value === 'object') return value
      const legacy = readLegacy()
      if (legacy) {
        await writeStore(idb, legacy)
        return legacy
      }
      return {}
    } finally {
      idb.close()
    }
  } catch (e) {
    return readLegacy() || {}
  }
}

export async function saveCachedBackgrounds(map) {
  try {
    const idb = await openDb()
    try {
      await writeStore(idb, map)
    } finally {
      idb.close()
    }
  } catch (e) {}
}
