# Secure Tefsen Admin Access

Tefsen Web intentionally requires a Firebase Authentication custom claim for admin access.
A public profile role or username must never be used as the authorization boundary.

## 1. Find the Firebase Authentication UID

Open Firebase Console → Authentication → Users and locate the account that should become an admin.
Copy its exact UID.

The authenticated Tefsen Web admin page also shows the signed-in UID when the claim is missing.

## 2. Grant the claim from a trusted Admin SDK environment

Use Google Cloud Shell, a trusted backend machine, or another environment that is authenticated to the
correct Firebase / Google Cloud project. Do not put service-account credentials in this repository or in
browser JavaScript.

Example Node.js script:

```js
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const uid = process.env.TEFSEN_ADMIN_UID;
if (!uid) throw new Error('Set TEFSEN_ADMIN_UID first.');

const user = await admin.auth().getUser(uid);
await admin.auth().setCustomUserClaims(uid, {
  ...(user.customClaims || {}),
  admin: true,
  role: 'ADMIN'
});

console.log('Admin claim granted to', uid);
```

Install and run in the trusted environment:

```bash
npm install firebase-admin
export TEFSEN_ADMIN_UID="PASTE_THE_EXACT_FIREBASE_UID"
node grant-admin.mjs
```

If using Google Cloud Shell, first make sure the active project is the production Tefsen Firebase project.

## 3. Refresh the user's ID token

After the claim is written, sign out of Tefsen Web and sign back in.
The Admin review navigation should then appear.

## Security rules

- Do not grant admin by checking the username `JsJr` in client-side code.
- Do not commit Firebase service-account JSON files.
- Keep Firestore rules and backend admin operations checking authenticated admin claims.
- Imported opportunities stay draft/private/pending until an authorized admin verifies the official source.
