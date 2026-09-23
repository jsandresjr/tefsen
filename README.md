# Tefsen Website

Production Web repository for `tefsen.com`, deployed with GitHub Pages.

## Canonical Web surfaces

### Public website

`https://www.tefsen.com/`

Primary files:
- `index.html`
- `css/home.css`
- `css/home-v2.css`
- `js/home.js`
- public assets
- legal/support routes
- SEO files

### Authenticated Tefsen Web app

`https://www.tefsen.com/app/`

Canonical application source:
- `app/index.html`
- `app/js/**`
- `app/css/**`
- `app/sw.js`
- `app/manifest.webmanifest`

There must be only one authenticated browser-app implementation. Do not commit copied app trees or temporary deploy-patch folders into public GitHub Pages paths.

See:
`docs/WEB_SURFACE_OWNERSHIP.md`

## Protected public routes

Keep these paths available when deploying:

- `/privacy-policy/` (canonical)
- `/privacy.html` (legacy redirect only)
- `/delete-account/` (canonical)
- `/delete-account.html` (legacy redirect only)
- `/founder.html`
- `/app/`
- `/CNAME`

## GitHub Pages deployment

1. Keep `CNAME`.
2. Commit reviewed changes to `main`.
3. GitHub Pages deploys from **main / root**.
4. Verify the public homepage and protected legal routes.
5. Verify `/app/` loads the canonical authenticated Web app.
6. Do not publish alternate copies of `app/` elsewhere in the repository.

## Firebase boundary

GitHub Pages deployment is separate from Firebase backend deployment.

The repository currently does **not** contain Tefsen's complete production Firebase deployment configuration.

The rules under `firebase-tests/` are isolated emulator security contracts for Web validation. They are intentionally deny-by-default and must not replace the existing complete Android/backend production rules.

Before production Firestore or Storage deployment:
1. obtain the current authoritative full production rules
2. merge the tested Web clauses
3. rerun Android/backend tests
4. rerun the Web Firestore + Storage emulator suite
5. review the production diff
6. deploy only the merged full rules

For App Check, validate real Web traffic before enabling enforcement service-by-service in Firebase Console.

## Public-launch quality

Do not publish fake usage statistics, fake availability claims, unverified security claims, or duplicate application implementations.

The public website and authenticated `/app/` experience should describe only functionality that actually exists.
