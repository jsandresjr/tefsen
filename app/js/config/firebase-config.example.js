/**
 * Tefsen Web Firebase configuration.
 *
 * Replace ONLY the placeholder values below with the Web App config from:
 * Firebase Console → Project settings → General → Your apps → Web app.
 *
 * Do not paste service-account JSON or private keys here.
 */
window.TEFSEN_FIREBASE_CONFIG = {
  apiKey: "PASTE_FIREBASE_WEB_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_STORAGE_BUCKET",
  messagingSenderId: "PASTE_MESSAGING_SENDER_ID",
  appId: "PASTE_WEB_APP_ID"
};

// Optional: reCAPTCHA v3 site key for Firebase App Check.
// This Web build currently uses ReCaptchaV3Provider. A site key is public client
// configuration, not a secret. Leave it empty until the Web App Check provider
// is registered in Firebase Console, then validate traffic before enforcement.
window.TEFSEN_APPCHECK_SITE_KEY = "";

// Demo mode lets you preview the complete interface before Firebase is connected.
// It automatically turns off once the config above no longer contains placeholders.
window.TEFSEN_FORCE_DEMO_MODE = false;
