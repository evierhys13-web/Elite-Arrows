import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, getDoc, getDocFromServer, getDocs, getDocsFromServer, query, where, orderBy, onSnapshot, deleteDoc, addDoc, updateDoc, writeBatch, runTransaction, limit, arrayUnion, serverTimestamp, increment, deleteField as deleteFieldFirestore } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence, sendPasswordResetEmail } from 'firebase/auth'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { getAnalytics, logEvent, setConsent } from 'firebase/analytics'
import { getPerformance, trace } from 'firebase/performance'
import { getStorage, ref, uploadString, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

export const FieldValue = deleteFieldFirestore

const firebaseConfig = {
  apiKey: "AIzaSyBRAM_91550mH8OUGiVlaL1ewWjrCWhgkY",
  authDomain: "elitearrowsapp.firebaseapp.com",
  projectId: "elitearrowsapp",
  storageBucket: "elitearrowsapp.appspot.com",
  messagingSenderId: "848326452210",
  appId: "1:848326452210:web:3626c7f4214167d51ec16b",
  measurementId: "G-6BPQKR71P5"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

// Analytics and Performance require a linked Google Analytics property (measurementId).
// They are only initialised AFTER the user grants cookie/analytics consent (see
// utils/analytics.js + CookieConsentBanner) so nothing is sent before consent.
export let analytics = null
export let perf = null

export const initAnalytics = () => {
  if (analytics || typeof window === 'undefined') return analytics
  try {
    analytics = getAnalytics(app)
  } catch (e) {
    console.warn('Firebase Analytics not available:', e.message)
  }
  return analytics
}

export const initPerformance = () => {
  if (perf || typeof window === 'undefined') return perf
  try {
    perf = getPerformance(app)
  } catch (e) {
    console.warn('Firebase Performance not available:', e.message)
  }
  return perf
}
export { trace }

let messaging = null
export const getMessagingInstance = async () => {
  if (messaging) return messaging
  const supported = await isSupported()
  if (supported) {
    messaging = getMessaging(app)
    return messaging
  }
  return null
}

export const usersCollection = collection(db, 'users')
export const resultsCollection = collection(db, 'results')
export const tournamentsCollection = collection(db, 'tournaments')
export const tournamentSignupsCollection = collection(db, 'tournamentSignups')
export const notificationsCollection = collection(db, 'notifications')
export const chatMessagesCollection = collection(db, 'chatMessages')
export const adminDataCollection = collection(db, 'adminData')
export const fixturesCollection = collection(db, 'fixtures')
export const cupsCollection = collection(db, 'cups')
export const supportRequestsCollection = collection(db, 'supportRequests')
export const seasonsCollection = collection(db, 'seasons')
export const fcmTokensCollection = collection(db, 'fcmTokens')
export const newsCollection = collection(db, 'news')
export const liveGamesCollection = collection(db, 'liveGames')
export const gameInvitesCollection = collection(db, 'gameInvites')
export const openLeagueDuosCollection = collection(db, 'openLeagueDuos')
export const openLeagueSinglesCollection = collection(db, 'openLeagueSingles')

export { 
  doc, setDoc, getDoc, getDocFromServer, getDocs, getDocsFromServer, query, where, orderBy, onSnapshot, deleteDoc, collection, addDoc, updateDoc, writeBatch, runTransaction, limit, arrayUnion, serverTimestamp, increment, deleteFieldFirestore as deleteField,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserSessionPersistence, browserLocalPersistence,
  sendPasswordResetEmail,
  getMessaging, getToken, onMessage, isSupported,
  logEvent, setConsent,
  ref, uploadString, uploadBytes, uploadBytesResumable, getDownloadURL
}
