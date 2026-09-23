# Web V1 isolated Firebase security tests

This directory is intentionally **not** the production Firebase deployment configuration.

It runs both Firestore and Cloud Storage emulators for the Web security contract.

It tests the isolated Tefsen Web security contract, including:

- private owner account and public-profile separation
- owner-only Student Passport, settings, saved content and application Journey
- public Community post creation/deletion ownership
- private self-owned likes
- self-authored public answers
- private notification/read-state boundaries
- report/moderation ownership and immutable audits
- published/public opportunity reads
- admin-claim-only opportunity writes and audit records

The Firestore catch-all denies unmodeled legacy collections, and the Storage catch-all denies unknown object paths. These isolated rules must not be deployed over Tefsen's full production rules without merging existing Android/backend requirements.

Run locally:

```bash
cd firebase-tests
npm install
npm run test:emulator
```

The GitHub Actions workflow `.github/workflows/web-v1-firestore-rules.yml` runs the same tests automatically.

Before production deployment, merge the tested Firestore and Storage clauses into Tefsen's current full production rules and rerun the existing Android/backend rule tests. App Check enforcement must be enabled separately in Firebase Console only after valid Web traffic is observed.
