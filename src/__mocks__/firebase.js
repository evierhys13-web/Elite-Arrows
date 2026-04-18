/**
 * Manual mock for src/firebase.js
 * Vitest picks this up when tests call vi.mock('../firebase') (no factory).
 */
import { vi } from "vitest";

export const db = {};
export const auth = {};

// Collection references – just plain strings so comparisons work
export const usersCollection = "usersCollection";
export const resultsCollection = "resultsCollection";
export const tournamentsCollection = "tournamentsCollection";
export const tournamentSignupsCollection = "tournamentSignupsCollection";
export const betsCollection = "betsCollection";
export const notificationsCollection = "notificationsCollection";
export const chatMessagesCollection = "chatMessagesCollection";
export const adminDataCollection = "adminDataCollection";
export const fixturesCollection = "fixturesCollection";
export const cupsCollection = "cupsCollection";
export const supportRequestsCollection = "supportRequestsCollection";
export const seasonsCollection = "seasonsCollection";
export const fcmTokensCollection = "fcmTokensCollection";

export const doc = vi.fn((db, col, id) => ({ _path: `${col}/${id}` }));
export const setDoc = vi.fn().mockResolvedValue(undefined);
export const getDoc = vi.fn();
export const getDocs = vi.fn();
export const query = vi.fn((...args) => ({ _queryArgs: args }));
export const where = vi.fn();
export const orderBy = vi.fn((field, dir) => ({ _field: field, _dir: dir }));
export const onSnapshot = vi.fn(() => vi.fn());
export const deleteDoc = vi.fn();
export const addDoc = vi.fn();
export const updateDoc = vi.fn();
export const collection = vi.fn((_db, name) => name);

export const signInWithEmailAndPassword = vi.fn();
export const createUserWithEmailAndPassword = vi.fn();
export const signOut = vi.fn();
export const onAuthStateChanged = vi.fn(() => vi.fn());
export const setPersistence = vi.fn();
export const browserSessionPersistence = "session";
export const browserLocalPersistence = "local";
export const sendPasswordResetEmail = vi.fn();

export const FieldValue = {};
export const getMessagingInstance = vi.fn().mockResolvedValue(null);
export const getToken = vi.fn();
export const onMessage = vi.fn();
export const isSupported = vi.fn().mockResolvedValue(false);
