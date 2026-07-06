import { auth } from '../firebase-client.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup, updateProfile
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { db } from '../firebase-client.js';
import { DEMO_USERS } from './demo-data.js';

const DEMO_KEY = 'tefsen_demo_user';
const demoListeners = new Set();

function emitDemo(user) { demoListeners.forEach(fn => fn(user)); }
function currentDemo() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { return null; }
}

export function observeAuth(mode, callback) {
  if (mode === 'firebase') return onAuthStateChanged(auth, callback);
  demoListeners.add(callback);
  queueMicrotask(() => callback(currentDemo()));
  return () => demoListeners.delete(callback);
}

export async function signIn(mode, email, password) {
  if (mode === 'firebase') return signInWithEmailAndPassword(auth, email, password);
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
    await setDoc(doc(db, 'users', credential.user.uid), {
      uid: credential.user.uid,
      fullName,
      displayName: fullName,
      email,
      role: 'Student',
      verified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return credential;
  }
  const user = { id: `demo-${Date.now()}`, uid: `demo-${Date.now()}`, fullName, displayName: fullName, email, username: email.split('@')[0], role: 'Student', verified: false, points: 0 };
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  emitDemo(user);
  return { user };
}

export async function signInGoogle(mode) {
  if (mode === 'firebase') {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
    await setDoc(doc(db, 'users', credential.user.uid), {
      uid: credential.user.uid,
      fullName: credential.user.displayName || 'Tefsen User',
      displayName: credential.user.displayName || 'Tefsen User',
      email: credential.user.email || '',
      profileImageUrl: credential.user.photoURL || '',
      photoURL: credential.user.photoURL || '',
      updatedAt: serverTimestamp()
    }, { merge: true });
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
