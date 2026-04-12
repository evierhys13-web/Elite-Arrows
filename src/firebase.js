import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence } from 'firebase/auth'

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

export const usersCollection = collection(db, 'users')
export const resultsCollection = collection(db, 'results')
export const tournamentsCollection = collection(db, 'tournaments')
export const tournamentSignupsCollection = collection(db, 'tournamentSignups')
export const betsCollection = collection(db, 'bets')
export const notificationsCollection = collection(db, 'notifications')
export const chatMessagesCollection = collection(db, 'chatMessages')

export { 
  doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, collection,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserSessionPersistence, browserLocalPersistence
}