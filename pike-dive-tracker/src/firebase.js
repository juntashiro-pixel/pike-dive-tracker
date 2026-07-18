// ─── Firebase Configuration ──────────────────────────────────
// INSTRUCTIONS: Replace the values below with YOUR Firebase project config.
// See SETUP.md for step-by-step instructions.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyBl4KeJ9apzqWf4RSMMjFC6a-JqoHq6CmY",
  authDomain:        "pike-dive-tracker.firebaseapp.com",
  projectId:         "pike-dive-tracker",
  storageBucket:     "pike-dive-tracker.firebasestorage.app",
  messagingSenderId: "610445531469",
  appId:             "1:610445531469:web:d729bc3582374b19d1bf04"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── Firestore Helper Functions ──────────────────────────────

/**
 * Save or update a diver profile
 */
export async function saveDiverProfile(diverId, profileData) {
  const ref = doc(db, 'divers', diverId);
  await setDoc(ref, { ...profileData, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Get a diver profile
 */
export async function getDiverProfile(diverId) {
  const ref = doc(db, 'divers', diverId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Add a practice session
 */
export async function addPracticeSession(diverId, sessionData) {
  const ref = collection(db, 'divers', diverId, 'practices');
  return addDoc(ref, {
    ...sessionData,
    createdAt: serverTimestamp(),
    date: sessionData.date // string "YYYY-MM-DD"
  });
}

/**
 * Get practice sessions for a diver (most recent first)
 */
export async function getPracticeSessions(diverId) {
  const ref = collection(db, 'divers', diverId, 'practices');
  const q = query(ref, orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Delete a practice session
 */
export async function deletePracticeSession(diverId, sessionId) {
  const ref = doc(db, 'divers', diverId, 'practices', sessionId);
  await deleteDoc(ref);
}

/**
 * Add a meet result
 */
export async function addMeetResult(diverId, meetData) {
  const ref = collection(db, 'divers', diverId, 'meets');
  return addDoc(ref, {
    ...meetData,
    createdAt: serverTimestamp()
  });
}

/**
 * Get meet results for a diver
 */
export async function getMeetResults(diverId) {
  const ref = collection(db, 'divers', diverId, 'meets');
  const q = query(ref, orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribe to real-time updates on a diver's practice sessions.
 * Returns an unsubscribe function.
 */
export function onPracticeUpdates(diverId, callback) {
  const ref = collection(db, 'divers', diverId, 'practices');
  const q = query(ref, orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(sessions);
  });
}

/**
 * Subscribe to real-time updates on a diver's meet results.
 * Returns an unsubscribe function.
 */
export function onMeetUpdates(diverId, callback) {
  const ref = collection(db, 'divers', diverId, 'meets');
  const q = query(ref, orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    const meets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(meets);
  });
}

// Check if Firebase is configured
export function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== "YOUR_API_KEY";
}

export { db, Timestamp };
