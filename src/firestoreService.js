import { db, resultsCollection, tournamentsCollection, betsCollection, notificationsCollection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot } from '../firebase'

export const resultsCollectionName = 'results'
export const tournamentsCollectionName = 'tournaments'
export const betsCollectionName = 'bets'
export const notificationsCollectionName = 'notifications'

export async function getResults() {
  const q = query(resultsCollection, orderBy('date', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function addResult(result) {
  const id = Date.now().toString()
  await setDoc(doc(db, 'results', id), result)
  return id
}

export async function updateResult(id, updates) {
  await setDoc(doc(db, 'results', id), updates, { merge: true })
}

export async function getTournaments() {
  const snapshot = await getDocs(tournamentsCollection)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function addTournament(tournament) {
  const id = Date.now().toString()
  await setDoc(doc(db, 'tournaments', id), tournament)
  return id
}

export async function updateTournament(id, updates) {
  await setDoc(doc(db, 'tournaments', id), updates, { merge: true })
}

export async function deleteTournament(id) {
  await setDoc(doc(db, 'tournaments', id), { deleted: true }, { merge: true })
}

export async function getBets() {
  const snapshot = await getDocs(betsCollection)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function addBet(bet) {
  const id = Date.now().toString()
  await setDoc(doc(db, 'bets', id), bet)
  return id
}

export async function updateBet(id, updates) {
  await setDoc(doc(db, 'bets', id), updates, { merge: true })
}

export async function getNotifications() {
  const q = query(notificationsCollection, orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function addNotification(notification) {
  const id = Date.now().toString()
  await setDoc(doc(db, 'notifications', id), notification)
  return id
}

export async function updateNotification(id, updates) {
  await setDoc(doc(db, 'notifications', id), updates, { merge: true })
}

export function subscribeToResults(callback) {
  return onSnapshot(query(resultsCollection, orderBy('date', 'desc')), (snapshot) => {
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    callback(results)
  })
}

export function subscribeToTournaments(callback) {
  return onSnapshot(tournamentsCollection, (snapshot) => {
    const tournaments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    callback(tournaments)
  })
}

export function subscribeToBets(callback) {
  return onSnapshot(betsCollection, (snapshot) => {
    const bets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    callback(bets)
  })
}