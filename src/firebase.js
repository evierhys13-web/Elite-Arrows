import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, addDoc, updateDoc, deleteField as deleteFieldFirestore } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence, sendPasswordResetEmail } from 'firebase/auth'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

export const FieldValue = deleteFieldFirestore

const firebaseConfig = {
  apiKey: "AIzaSyBLuRvmE1UgKvYFw7K0utT11ljjrf52vlA",
  authDomain: "elitearrowsapp.firebaseapp.com",
  projectId: "elitearrowsapp",
  storageBucket: "elitearrowsapp.firebasestorage.app",
  messagingSenderId: "848326452210",
  appId: "1:848326452210:web:3626c7f4214167d51ec16b"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

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
  doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, collection, addDoc, updateDoc,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserSessionPersistence, browserLocalPersistence,
  sendPasswordResetEmail,
  getMessaging, getToken, onMessage, isSupported
}
