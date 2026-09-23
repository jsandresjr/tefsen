# Web V1 isolated Firestore security tests

This directory is intentionally **not** the production Firebase deployment configuration.

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

The catch-all rule denies all legacy collections because this isolated file must never be deployed over Tefsen's real production rules.

Run locally:

```bash
cd firebase-tests
npm install
npm run test:emulator
```

The GitHub Actions workflow `.github/workflows/web-v1-firestore-rules.yml` runs the same tests automatically.

Before production deployment, merge the tested rule clauses into Tefsen's current full production Firestore rules and rerun the existing Android/backend rule tests.
