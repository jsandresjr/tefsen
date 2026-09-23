import { auth, db } from '../firebase-client.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup, updateProfile
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { DEMO_USERS } from './demo-data.js';
import { buildNewAccountDocument, buildExistingAccountProfilePatch } from './account-bootstrap-service.js';

const DEMO_KEY = 'tefsen_demo_user';
const demoListeners = new Set();

function emitDemo(user) {
  demoListeners.forEach(fn => fn(user));
}

function currentDemo() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function ensureUserDocument(user, { fullNameOverride = '' } = {}) {
  if (!user?.uid) return null;
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const timestamp = serverTimestamp();
    const payload = buildNewAccountDocument(user, {
      fullNameOverride,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await setDoc(userRef, payload);
    return payload;
  }

  const patch = buildExistingAccountProfilePatch(user, snap.data(), {
    fullNameOverride,
    updatedAt: serverTimestamp()
  });
  await setDoc(userRef, patch, { merge: true });
  return { ...snap.data(), ...patch };
}

export function observeAuth(mode, callback) {
  if (mode === 'firebase') {
    return onAuthStateChanged(auth, user => {
      if (!user) {
        callback(null);
        return;
      }
      void ensureUserDocument(user)
        .catch(error => console.error('Tefsen account bootstrap failed:', error))
        .finally(() => callback(user));
    });
  }
  demoListeners.add(callback);
  queueMicrotask(() => callback(currentDemo()));
  return () => demoListeners.delete(callback);
}

export async function signIn(mode, email, password) {
  if (mode === 'firebase') {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDocument(credential.user);
    return credential;
  }
  if (!email || !password) throw new Error('Enter your email and password.');
  const base = { ...DEMO_USERS[0], email, displayName: DEMO_USERS[0].fullName };
  localStorage.setItem(DEMO_KEY, JSON.stringify(base));
  emitDemo(base);
  return { user: base };
}

export async function register(mode, { fullName, email, password }) {
  if (mode === 'firebase') {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: fullName });
    await ensureUserDocument(credential.user, { fullNameOverride: fullName });
    return credential;
  }

  const user = {
    id: `demo-${Date.now()}`,
    uid: `demo-${Date.now()}`,
    fullName,
    displayName: fullName,
    email,
    username: '',
    role: 'student',
    verified: false
  };
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  emitDemo(user);
  return { user };
}

export async function signInGoogle(mode) {
  if (mode === 'firebase') {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
    await ensureUserDocument(credential.user);
    return credential;
  }

  const user = { ...DEMO_USERS[0], displayName: DEMO_USERS[0].fullName };
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  emitDemo(user);
  return { user };
}

export async function resetPassword(mode, email) {
  if (mode === 'firebase') return sendPasswordResetEmail(auth, email);
  return true;
}

export async function logout(mode) {
  if (mode === 'firebase') return signOut(auth);
  localStorage.removeItem(DEMO_KEY);
  emitDemo(null);
}
