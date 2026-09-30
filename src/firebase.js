import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, getDoc, getDocFromServer, getDocs, getDocsFromServer, query, where, orderBy, onSnapshot, deleteDoc, addDoc, updateDoc, writeBatch, runTransaction, limit, arrayUnion, serverTimestamp, increment, deleteField as deleteFieldFirestore } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence, sendPasswordResetEmail, signInAnonymously } from 'firebase/auth'


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

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

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
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously,
  setPersistence, browserSessionPersistence, browserLocalPersistence,
  sendPasswordResetEmail
}
