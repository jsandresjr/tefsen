/**
 * Tefsen Web Firebase configuration.
 *
 * Replace ONLY the placeholder values below with the Web App config from:
 * Firebase Console → Project settings → General → Your apps → Web app.
 *
 * Do not paste service-account JSON or private keys here.
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

// Demo mode lets you preview the complete interface before Firebase is connected.
// It automatically turns off once the config above no longer contains placeholders.
window.TEFSEN_FORCE_DEMO_MODE = false;
