// Firebase Admin data layer for the bot.
//
// Reading strategy (Firestore Spark quotas + huge proof images in `results` docs):
//  - Live onSnapshot ONLY on cheap collections: news, users, fixtures, seasons, adminData.
//  - `results` documents embed large proof images, and select() is NOT supported on
//    real-time listeners, so we never watch them. Instead:
//      * a small watcher on the 30 newest docs detects newly approved results (auto-post),
//      * `refreshResultsCache()` fetches the current season's results with select()
//        on demand (startup, season change, commands, table refresh).
//  - All listeners pass an error callback and emit() guards against malformed entries.

import fs from 'node:fs'
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

const currentSeason = () => state.adminData?.currentSeason || DEFAULT_SEASON

const stripProof = (doc) => {
  if (!doc) return
  for (const key of ['proofImage', 'proofImage2', 'proof', 'proofUrl', 'proofImageUrl', 'proofFile']) {
    if (typeof doc[key] === 'string' && doc[key].startsWith('data:image')) delete doc[key]
  }
}

// Fetch the current season's approved results (field-projected) for standings.
export async function refreshResultsCache() {
  const db = firestore
  const season = currentSeason()
  try {
    const snap = await db.collection('results')
      .where('season', '==', season)
      .select(...RESULT_SELECT)
      .get()
    const docs = toArray(snap)
    docs.forEach(stripProof)
    state.results = docs
    emit('changed', { kind: 'results' })
    return docs
  } catch (e) {
    console.error(`refreshResultsCache failed: ${e.message}`)
    return state.results
  }
}

// Watch only the newest results to detect newly approved ones without a full scan.
async function attachResultsWatcher() {
  if (resultsWatcher) {
    resultsWatcher()
    resultsWatcher = null
  }
  const db = firestore
  const query = db.collection('results')
    .orderBy('submittedAt', 'desc')
    .limit(30)

  try {
    const snap = await query.get()
    snap.docs.forEach(d => seenResults.add(d.id))

    resultsWatcher = query.onSnapshot(
      snap => {
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
      err => console.error('results watcher error:', err.message)
    )
  } catch (e) {
    console.error('results watcher init failed:', e.message)
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export async function startListeners() {
  const db = initFirebase()

  // adminData first (tells us the current season) with retry for quota hiccups.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const adminSnap = await db.collection('adminData').doc('main').get()
      state.adminData = adminSnap.exists ? { id: adminSnap.id, ...adminSnap.data() } : null
      break
    } catch (e) {
      console.error(`adminData fetch attempt ${attempt} failed: ${e.message}`)
      await sleep(attempt * 5000)
    }
  }

  db.collection('adminData').doc('main').onSnapshot(
    doc => {
      const before = state.adminData?.currentSeason
      state.adminData = doc.exists ? { id: doc.id, ...doc.data() } : null
      emit('changed', { kind: 'adminData' })
      if (before !== currentSeason()) {
        refreshResultsCache().catch(e => console.error('season change refresh failed:', e.message))
      }
    },
    err => console.error('adminData listener error:', err.message)
  )

  db.collection('news').onSnapshot(
    snap => {
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
    },
    err => console.error('news listener error:', err.message)
  )

  db.collection('users').onSnapshot(
    snap => {
      state.users = toArray(snap)
      emit('changed', { kind: 'users' })
    },
    err => console.error('users listener error:', err.message)
  )

  db.collection('fixtures').onSnapshot(
    snap => {
      state.fixtures = toArray(snap)
      emit('changed', { kind: 'fixtures' })
    },
    err => console.error('fixtures listener error:', err.message)
  )

  db.collection('seasons').onSnapshot(
    snap => {
      state.seasons = toArray(snap)
      emit('changed', { kind: 'seasons' })
    },
    err => console.error('seasons listener error:', err.message)
  )

  await attachResultsWatcher()
  await refreshResultsCache()

  // Self-heal: the project can hit its Firestore daily read quota (Spark). Once the
  // quota resets, keep retrying in the background so the bot recovers without a restart.
  setInterval(async () => {
    try {
      if (!state.adminData) {
        const adminSnap = await db.collection('adminData').doc('main').get()
        state.adminData = adminSnap.exists ? { id: adminSnap.id, ...adminSnap.data() } : null
        emit('changed', { kind: 'adminData' })
      }
      if (!resultsWatcher) await attachResultsWatcher()
      if (!state.results.length) await refreshResultsCache()
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