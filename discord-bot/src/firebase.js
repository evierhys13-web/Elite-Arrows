// Firebase Admin data layer for the bot.
//
// Reading strategy (Firestore Spark quotas + huge proof images in `results` docs):
//  - Live onSnapshot ONLY on cheap collections: news, users, fixtures, seasons, adminData.
//  - `results` documents embed large proof images, and select() is NOT supported on
//    real-time listeners, so we never watch them. Instead:
//      * a small watcher on the 30 newest docs detects newly approved results (auto-post),
//      * `refreshResultsCache()` fetches the current season's results with select()
//        on demand (startup, season change, commands, table refresh).
//
// Quota resilience (no paid plan needed):
//  - The last good data snapshot is persisted to data/cache.json, so the bot can keep
//    serving real (if slightly stale) snapshots whenever Firestore is unavailable.
//  - `isCoreDataAvailable()` tells post code whether we can safely render empty states:
//    if we haven't successfully read anything and have no cache, we skip posting
//    entirely instead of posting "no data" embeds that would be misleading.
//  - Failed reads are cheap (they return immediately when the project is over quota).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'
import 'dotenv/config'
import { getResultPlayerId } from './scoring.js'

const DEFAULT_SEASON = 'Elite Arrows Season 5'

const RESULT_SELECT = [
  'player1Id', 'player2Id', 'player1', 'player2',
  'score1', 'score2', 'gameType', 'status', 'season', 'division', 'week',
  'date', 'submittedAt', 'approvedAt', 'updatedAt', 'createdAt',
  'excludeFromLeague', 'cupId', 'matchId', 'tournamentId', 'fixtureId',
  'forfeit', 'forfeitWinner', 'player1Stats', 'player2Stats', 'player1Avg', 'player2Avg'
]

const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')
const CACHE_FILE = path.join(CACHE_DIR, 'cache.json')

let firestore = null

function resolveCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const raw = fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, 'utf8')
    return admin.credential.cert(JSON.parse(raw))
  }
  return admin.credential.applicationDefault()
}

export function initFirebase() {
  if (firestore) return firestore
  admin.initializeApp({
    credential: resolveCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'elitearrowsapp'
  })
  firestore = admin.firestore()
  return firestore
}

const state = {
  users: [],
  results: [],
  fixtures: [],
  seasons: [],
  news: [],
  adminData: null
}

const listeners = {
  changed: [],
  newResult: [],
  newNews: []
}

// true once we have successfully read from Firestore this session (or loaded a cache).
let dataAvailable = false

// per-collection "we have a live, real value" flags (avoid rendering misleading empties)
const synced = {
  adminData: false,
  news: false,
  users: false,
  fixtures: false,
  seasons: false
}
let resultsFetchOk = false

function emit(list, payload) {
  for (const entry of [...list]) {
    if (typeof entry !== 'function') continue
    try { entry(payload) } catch (e) { console.error('listener error:', e) }
  }
}

const seenResults = new Set()
const seenNews = new Set()
let resultsWatcher = null

const toArray = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }))

// Mirror the app: current season comes from adminData; when that isn't readable yet,
// fall back to the latest non-archived season in the watched `seasons` collection.
const currentSeason = () => {
  if (state.adminData?.currentSeason) return state.adminData.currentSeason
  if (Array.isArray(state.seasons) && state.seasons.length) {
    const active = state.seasons.filter(s => !s.isArchived && s.name)
    if (active.length) {
      const latest = active.sort((a, b) =>
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )[0]
      return latest.name
    }
  }
  return DEFAULT_SEASON
}

// Matches scoring.js: legacy seasons store results under ''/'2026'/'legacy'/etc.
const isLegacySeason = (season) =>
  ['season1', '2026', 'legacy'].includes(String(season || '').replace(/\s+/g, '').toLowerCase())

// Whether a collection has a real (non-empty or sync-confirmed) value to render.
export function isCollectionSynced(name) {
  return Boolean(synced[name]) || state[name]?.length > 0 || Boolean(state.adminData)
}

// Whether the standings/results snapshots can be trusted (results read once since boot,
// or cached results exist from a previous successful read).
export function getResultsReadable() {
  return resultsFetchOk || state.results.length > 0
}

const stripProof = (doc) => {
  if (!doc) return
  for (const key of ['proofImage', 'proofImage2', 'proof', 'proofUrl', 'proofImageUrl', 'proofFile']) {
    if (typeof doc[key] === 'string' && doc[key].startsWith('data:image')) delete doc[key]
  }
}

// Drop any big inline blobs (data URLs) so the cache file stays small and clean.
const sanitizeForCache = (value) => {
  if (typeof value === 'string') {
    if (value.startsWith('data:image') || value.length > 20000) return undefined
    return value
  }
  if (Array.isArray(value)) return value.map(sanitizeForCache).filter(v => v !== undefined)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const clean = sanitizeForCache(v)
      if (clean !== undefined) out[k] = clean
    }
    return out
  }
  return value
}

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    if (cached?.state) {
      state.users = Array.isArray(cached.state.users) ? cached.state.users : []
      state.results = Array.isArray(cached.state.results) ? cached.state.results : []
      state.fixtures = Array.isArray(cached.state.fixtures) ? cached.state.fixtures : []
      state.seasons = Array.isArray(cached.state.seasons) ? cached.state.seasons : []
      state.news = Array.isArray(cached.state.news) ? cached.state.news : []
      state.adminData = cached.state.adminData || null
      dataAvailable = true
      console.log(`cache loaded: ${state.users.length} users, ${state.results.length} results, ${state.fixtures.length} fixtures`)
    }
  } catch (e) {
    console.error(`cache load failed: ${e.message}`)
  }
}

let persistTimer = null
function schedulePersist() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(persistState, 3000)
}

function persistState() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
    const snapshot = sanitizeForCache({
      updatedAt: new Date().toISOString(),
      state: {
        users: state.users,
        results: state.results,
        fixtures: state.fixtures,
        seasons: state.seasons,
        news: state.news,
        adminData: state.adminData
      }
    })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(snapshot))
  } catch (e) {
    console.error(`cache save failed: ${e.message}`)
  }
}

function markDataAvailable() {
  dataAvailable = true
}

export function isCoreDataAvailable() {
  return dataAvailable ||
    Boolean(state.adminData) ||
    state.users.length > 0 ||
    state.results.length > 0 ||
    state.fixtures.length > 0
}

// Fetch the current season's approved results (field-projected) for standings.
export async function refreshResultsCache() {
  const db = firestore
  const season = currentSeason()
  try {
    // Mirror the app: legacy seasons (Season 1 / 2026 / legacy) store results without a
    // reliable season label, so fetch all approved; otherwise filter by season.
    const base =
      isLegacySeason(season)
        ? db.collection('results').where('status', '==', 'approved')
        : db.collection('results')
            .where('season', '==', season)
            .where('status', '==', 'approved')
    const snap = await base.select(...RESULT_SELECT).get()
    const docs = toArray(snap)
    docs.forEach(stripProof)
    state.results = docs
    resultsFetchOk = true
    markDataAvailable()
    schedulePersist()
    emit('changed', { kind: 'results' })
    return docs
  } catch (e) {
    console.error(`refreshResultsCache failed: ${e.message} (using ${state.results.length} cached results)`)
    return state.results
  }
}

// Watch only the newest results to detect newly approved ones without a full scan.
// No initial GET: the watch's first snapshot seeds `seenResults` without emitting,
// so this also works when one-shot GETs are rate-limited.
async function attachResultsWatcher() {
  if (resultsWatcher) {
    try { resultsWatcher() } catch {}
    resultsWatcher = null
  }
  const db = firestore
  const query = db.collection('results')
    .orderBy('submittedAt', 'desc')
    .limit(30)

  let seeded = false
  resultsWatcher = query.onSnapshot(
    snap => {
      markDataAvailable()
      if (!seeded) {
        seeded = true
        snap.docs.forEach(d => seenResults.add(d.id))
        return
      }
      let newApproved = false
      for (const change of snap.docChanges()) {
        if (change.type === 'added') {
          const id = change.doc.id
          if (!seenResults.has(id)) {
            seenResults.add(id)
            const data = { id, ...change.doc.data() }
            if (String(data.status || '').toLowerCase() === 'approved') {
              newApproved = true
              emit('newResult', data)
            }
          }
        }
      }
      if (newApproved) refreshResultsCache().catch(e => console.error('cache refresh failed:', e.message))
    },
    err => {
      console.error('results watcher error:', err.message)
      resultsWatcher = null // allow self-heal to re-attach later
    }
  )
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export async function startListeners() {
  initFirebase()
  loadCache()

  const db = firestore

  // adminData first (tells us the current season) with retry for quota hiccups.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const adminSnap = await db.collection('adminData').doc('main').get()
      state.adminData = adminSnap.exists ? { id: adminSnap.id, ...adminSnap.data() } : null
      synced.adminData = true
      markDataAvailable()
      schedulePersist()
      break
    } catch (e) {
      console.error(`adminData fetch attempt ${attempt} failed: ${e.message}`)
      await sleep(attempt * 5000)
    }
  }

  db.collection('adminData').doc('main').onSnapshot(
    doc => {
      markDataAvailable()
      const before = state.adminData?.currentSeason
      state.adminData = doc.exists ? { id: doc.id, ...doc.data() } : null
      synced.adminData = true
      schedulePersist()
      emit('changed', { kind: 'adminData' })
      if (before !== currentSeason()) {
        refreshResultsCache().catch(e => console.error('season change refresh failed:', e.message))
      }
    },
    err => console.error('adminData listener error:', err.message)
  )

  db.collection('news').onSnapshot(
    snap => {
      markDataAvailable()
      for (const change of snap.docChanges()) {
        if (change.type === 'added') {
          const id = change.doc.id
          if (!seenNews.has(id)) {
            seenNews.add(id)
            emit('newNews', { id, ...change.doc.data() })
          }
        }
      }
      state.news = toArray(snap)
      synced.news = true
      schedulePersist()
    },
    err => console.error('news listener error:', err.message)
  )

  db.collection('users').onSnapshot(
    snap => {
      markDataAvailable()
      state.users = toArray(snap)
      synced.users = true
      schedulePersist()
      emit('changed', { kind: 'users' })
    },
    err => console.error('users listener error:', err.message)
  )

  db.collection('fixtures').onSnapshot(
    snap => {
      markDataAvailable()
      state.fixtures = toArray(snap)
      synced.fixtures = true
      schedulePersist()
      emit('changed', { kind: 'fixtures' })
    },
    err => console.error('fixtures listener error:', err.message)
  )

  db.collection('seasons').onSnapshot(
    snap => {
      markDataAvailable()
      state.seasons = toArray(snap)
      synced.seasons = true
      schedulePersist()
      emit('changed', { kind: 'seasons' })
    },
    err => console.error('seasons listener error:', err.message)
  )

  await attachResultsWatcher()
  await refreshResultsCache()

  // Self-heal: the project can hit its Firestore daily read quota (Spark). Retry in the
  // background so the bot recovers and finally renders snapshots without a restart.
  setInterval(async () => {
    try {
      if (!state.adminData) {
        const adminSnap = await db.collection('adminData').doc('main').get()
        state.adminData = adminSnap.exists ? { id: adminSnap.id, ...adminSnap.data() } : null
        synced.adminData = true
        markDataAvailable()
        schedulePersist()
        emit('changed', { kind: 'adminData' })
      }
      if (!resultsWatcher) await attachResultsWatcher()
      if (!resultsFetchOk) await refreshResultsCache()
    } catch (e) {
      console.error('self-heal cycle failed:', e.message)
    }
  }, 3 * 60 * 1000)

  return state
}

export function getState() {
  return state
}

export function getUsers() {
  return state.users
}

export function getResults() {
  return state.results
}

export function getFixtures() {
  return state.fixtures
}

export function getSeasons() {
  return state.seasons
}

export function getNews() {
  return state.news
}

export function getAdminData() {
  return state.adminData
}

export function onDataChanged(fn) {
  if (typeof fn === 'function') listeners.changed.push(fn)
}

export function onNewResult(fn) {
  if (typeof fn === 'function') listeners.newResult.push(fn)
}

export function onNewNews(fn) {
  if (typeof fn === 'function') listeners.newNews.push(fn)
}

export function resolveResultPlayerName(result, playerNumber) {
  const id = getResultPlayerId(result, playerNumber, state.users)
  const user = id ? state.users.find(u => String(u.id) === id) : null
  if (user) return user.username || user.displayName || user.name || `Player ${playerNumber}`
  return result[`player${playerNumber}`] || result[`player${playerNumber}Name`] || `Player ${playerNumber}`
}

export function getDivisionForResult(result) {
  const players = [1, 2].map(n => getResultPlayerId(result, n, state.users)).filter(Boolean)
  for (const pid of players) {
    const user = state.users.find(u => String(u.id) === pid)
    if (user && user.division) return user.division
  }
  return result.division || ''
}