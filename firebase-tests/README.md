# Web V1 isolated Firestore security tests

This directory is intentionally **not** the production Firebase deployment configuration.

It tests only the new Tefsen Web V1 security contract:

- owner-only Student Passport
- owner-only application Journey
- published/public opportunity reads
- admin-claim-only opportunity writes
- admin-only immutable opportunity audit records

The catch-all rule denies all legacy collections because this isolated file must never be deployed over Tefsen's real production rules.

Run locally:

```bash
cd firebase-tests
npm install
npm run test:emulator
```

The GitHub Actions workflow `.github/workflows/web-v1-firestore-rules.yml` runs the same tests automatically.

Before production deployment, merge the tested rule clauses into Tefsen's current full production Firestore rules and rerun the existing Android/backend rule tests.
