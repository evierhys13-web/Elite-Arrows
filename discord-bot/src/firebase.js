// Firebase Admin data layer for the bot.
// Maintains a live cache of the collections the bot mirrors and emits change
// events so index.js can react (new approved result -> #results, new news -> #announcements,
// any table-affecting change -> refresh pinned #table messages).

import fs from 'node:fs'
import admin from 'firebase-admin'
import 'dotenv/config'

let firestore = null

function resolveCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const raw = fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, 'utf8')
    return admin.credential.cert(JSON.parse(raw))
  }
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS if set.
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
  changed: [],        // data could affect the league table (results/users/fixtures/seasons/adminData)
  newResult: [],      // a result document was created (previously unseen id)
  newNews: []         // a news document was created (previously unseen id)
}

function emit(list, payload) {
  for (const fn of [...list]) {
    try { fn(payload) } catch (e) { console.error('listener error:', e) }
  }
}

const seenResults = new Set()
const seenNews = new Set()

const toArray = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }))

export async function startListeners() {
  const db = initFirebase()

  // Seed "seen" sets from the current data first, so we only react to NEW docs.
  const [resSnap, newsSnap] = await Promise.all([
    db.collection('results').get(),
    db.collection('news').get()
  ])
  resSnap.docs.forEach(d => seenResults.add(d.id))
  newsSnap.docs.forEach(d => seenNews.add(d.id))
  state.results = toArray(resSnap)
  state.news = toArray(newsSnap)

  db.collection('results').onSnapshot(snap => {
    for (const change of snap.docChanges()) {
      if (change.type === 'added') {
        const id = change.doc.id
        if (!seenResults.has(id)) {
          seenResults.add(id)
          if (String(change.doc.data().status || '').toLowerCase() === 'approved') {
            emit('newResult', { id, ...change.doc.data() })
          }
        }
      }
    }
    const fresh = toArray(snap)
    state.results = fresh
    emit('changed', { kind: 'results' })
  })

  db.collection('news').onSnapshot(snap => {
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
  })

  db.collection('users').onSnapshot(snap => {
    state.users = toArray(snap)
    emit('changed', { kind: 'users' })
  })

  db.collection('fixtures').onSnapshot(snap => {
    state.fixtures = toArray(snap)
    emit('changed', { kind: 'fixtures' })
  })

  db.collection('seasons').onSnapshot(snap => {
    state.seasons = toArray(snap)
    emit('changed', { kind: 'seasons' })
  })

  db.collection('adminData').doc('main').onSnapshot(doc => {
    state.adminData = doc.exists ? { id: doc.id, ...doc.data() } : null
    emit('changed', { kind: 'adminData' })
  })

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
  listeners.changed.push(fn)
}

export function onNewResult(fn) {
  listeners.newResult.push(fn)
}

export function onNewNews(fn) {
  listeners.newNews.push(fn)
}

import { getResultPlayerId } from './scoring.js'

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