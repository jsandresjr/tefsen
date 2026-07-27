import { auth, db } from '../firebase-client.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup, updateProfile
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { DEMO_USERS } from './demo-data.js';

const DEMO_KEY = 'tefsen_demo_user';
const demoListeners = new Set();
const ALLOWED_ROLES = new Set(['student', 'HS_STUDENT', 'UNI_STUDENT', 'MENTOR', 'ADMIN']);
const ADMIN_EMAIL = 'jsandresjr@gmail.com';

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

function normalizeStoredRole(role, email = '') {
  const raw = String(role || '').trim();
  if (ALLOWED_ROLES.has(raw)) return raw;
  if (raw.toLowerCase() === 'admin' || String(email).toLowerCase() === ADMIN_EMAIL) return 'ADMIN';
  if (raw.toLowerCase() === 'hs_student') return 'HS_STUDENT';
  if (raw.toLowerCase() === 'uni_student') return 'UNI_STUDENT';
  if (raw.toLowerCase() === 'mentor') return 'MENTOR';
  return 'student';
}

async function syncUserDocument(user, { isRegistration = false } = {}) {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? snap.data() : {};
  const email = String(existing.email || user.email || '').trim();
  const role = normalizeStoredRole(existing.role, email);
  const fullName = String(user.displayName || existing.fullName || existing.displayName || email || 'Tefsen User').trim();

  const payload = {
    uid: user.uid,
    email,
    fullName,
    displayName: fullName,
    role,
    updatedAt: serverTimestamp()
  };

  if (user.photoURL) {
    payload.profileImageUrl = user.photoURL;
    payload.photoURL = user.photoURL;
  }

  if (!snap.exists() || isRegistration) {
    payload.verified = false;
    payload.createdAt = serverTimestamp();
  }

  await setDoc(userRef, payload, { merge: true });
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
    await syncUserDocument(credential.user, { isRegistration: true });
    return credential;
  }

  const user = {
    id: `demo-${Date.now()}`,
    uid: `demo-${Date.now()}`,
    fullName,
    displayName: fullName,
    email,
    username: email.split('@')[0],
    role: 'student',
    verified: false,
    points: 0
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
    await syncUserDocument(credential.user);
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
