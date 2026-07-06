import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app-check.js';

export let firebaseApp = null;
export let auth = null;
export let db = null;
export let storage = null;
export let appCheck = null;

export function hasFirebaseConfig() {
  const cfg = window.TEFSEN_FIREBASE_CONFIG || {};
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  return !window.TEFSEN_FORCE_DEMO_MODE && required.every(k => cfg[k] && !String(cfg[k]).includes('PASTE_'));
}

export async function initFirebase() {
  if (!hasFirebaseConfig()) return { mode: 'demo' };
  firebaseApp = getApps()[0] || initializeApp(window.TEFSEN_FIREBASE_CONFIG);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  storage = getStorage(firebaseApp);
  await setPersistence(auth, browserLocalPersistence);

  const key = window.TEFSEN_APPCHECK_SITE_KEY;
  if (key) {
    try {
      appCheck = initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(key),
        isTokenAutoRefreshEnabled: true
      });
    } catch (error) {
      console.warn('App Check initialization skipped:', error);
    }
  }
  return { mode: 'firebase', app: firebaseApp, auth, db, storage };
}
