# Setting the Tefsen Web admin custom claim

The Web admin UI requires a Firebase Auth custom claim. A normal Firestore profile field is not accepted as the security boundary.

This script uses the Firebase Admin SDK with **Application Default Credentials**. It contains no private key and no service-account JSON should ever be committed to the repository.

## Requirements

Run only from a trusted developer/admin machine or Cloud environment that is already authenticated to the correct Tefsen Firebase project.

Examples of acceptable credential sources include:

- Google Cloud Application Default Credentials on a trusted machine
- a trusted CI/server identity
- a service-account credential supplied through the environment and never committed

## Dry run

From `firebase-tests/`:

```bash
npm install
npm run admin:claim -- --email=YOUR_ADMIN_EMAIL
```

This only shows the proposed claim change.

## Grant admin

```bash
npm run admin:claim -- --email=YOUR_ADMIN_EMAIL --apply
```

or by UID:

```bash
npm run admin:claim -- --uid=FIREBASE_AUTH_UID --apply
```

## Revoke admin

```bash
npm run admin:claim -- --uid=FIREBASE_AUTH_UID --revoke --apply
```

After granting or revoking, sign out/in on Tefsen Web so Firebase refreshes the ID token.

## Safety

Before using `--apply`, confirm the active Google/Firebase project is `tefsen-fa2b5`.

Never paste a service-account private key into ChatGPT, a GitHub issue, source code, or the public web configuration.
