/**
 * Tefsen Web production Firebase client configuration.
 *
 * These values identify the public Firebase Web app for the Tefsen project.
 * They are client configuration, not service-account credentials or private keys.
 *
 * If Tefsen intentionally migrates to another Firebase project, update this file
 * from Firebase Console → Project settings → General → Your apps → Web app and
 * review the project/auth/storage/App Check implications in the same change.
 */
window.TEFSEN_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDZG1UISLv-Q-l-xTmrytldWO3dp0MPGuY",
  authDomain: "tefsen-fa2b5.firebaseapp.com",
  projectId: "tefsen-fa2b5",
  storageBucket: "tefsen-fa2b5.firebasestorage.app",
  messagingSenderId: "76407763303",
  appId: "1:76407763303:web:1c0efe04b5f6636815ffc2",
  measurementId: "G-VQ8W2H5YD2"
};

// Optional: reCAPTCHA v3 site key for Firebase App Check.
// This Web build currently uses ReCaptchaV3Provider. A site key is public client
// configuration, not a secret. Leave it empty until the Web App Check provider
// is registered in Firebase Console, then validate traffic before enforcement.
window.TEFSEN_APPCHECK_SITE_KEY = "";

// Keep production Web in Firebase mode. Set true only for an intentional preview/demo build.
window.TEFSEN_FORCE_DEMO_MODE = false;
