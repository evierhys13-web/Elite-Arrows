import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, addDoc, updateDoc, writeBatch, runTransaction, deleteField as deleteFieldFirestore } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence, sendPasswordResetEmail } from 'firebase/auth'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { getAnalytics, logEvent } from 'firebase/analytics'

export const FieldValue = deleteFieldFirestore

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null

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
export const betsCollection = collection(db, 'bets')
export const notificationsCollection = collection(db, 'notifications')
export const chatMessagesCollection = collection(db, 'chatMessages')
export const adminDataCollection = collection(db, 'adminData')
export const fixturesCollection = collection(db, 'fixtures')
export const cupsCollection = collection(db, 'cups')
export const supportRequestsCollection = collection(db, 'supportRequests')
export const seasonsCollection = collection(db, 'seasons')
export const fcmTokensCollection = collection(db, 'fcmTokens')
export const newsCollection = collection(db, 'news')

export { 
  doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, collection, addDoc, updateDoc, writeBatch, runTransaction,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserSessionPersistence, browserLocalPersistence,
  sendPasswordResetEmail,
  getMessaging, getToken, onMessage, isSupported,
  logEvent
}
