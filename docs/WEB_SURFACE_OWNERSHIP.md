# Canonical Tefsen Web Surface

This repository is published from the repository root with GitHub Pages.

There are two intentional Web surfaces.

## 1. Public website

Canonical root:

`https://www.tefsen.com/`

Source:
- `index.html`
- `css/home.css`
- `css/home-v2.css`
- `js/home.js`
- public assets and legal/support pages

The public website is marketing, product information, founder information, legal/support content, SEO files and links into the authenticated app.

It must not contain a second copy of the Firebase-authenticated Tefsen application.

## 2. Authenticated Tefsen Web app

Canonical path:

`https://www.tefsen.com/app/`

Source:
- `app/index.html`
- `app/js/app.js`
- `app/js/services/**`
- `app/css/**`
- `app/sw.js`
- `app/manifest.webmanifest`

All authenticated Web product work belongs under `app/`.

This includes:
- Firebase Authentication
- Student Passport
- opportunities and Journeys
- Community posts and stories
- notifications
- settings/account controls
- public profile projection
- moderation/admin tools
- Storage uploads
- App Check client initialization

## Removed legacy public application copies

Step 33 removed stale, unreferenced application artifacts that GitHub Pages could otherwise expose directly:

- root `app.js`
- root `services/data-service.js`
- `js/main.js`
- root `script.js`
- root `style.css`
- `tefsen-web-signup-like-fix/**`

Those files contained older product/security behavior and must not return.

Examples of obsolete behavior found in the removed copies included:
- the retired points leaderboard
- public lookup through private `users` documents
- client-asserted role/verification metadata
- old random Storage upload names
- old like-count aggregation/client counter writes
- obsolete follow/follower state

Keeping those copies publicly reachable would create two inconsistent Tefsen Web implementations and make security hardening unreliable.

## Firebase deployment boundary

GitHub Pages deploys static Web files only.

This repository currently does **not** contain Tefsen's complete production Firebase deployment configuration. In particular, the root intentionally does not contain production:
- `firebase.json`
- `.firebaserc`
- complete `firestore.rules`
- complete `storage.rules`
- Functions source/config

The `firebase-tests/` rules are an isolated, deny-by-default Web security contract for emulator validation.

They must not be deployed over the existing Android/backend production rules.

Before production Firebase security deployment:
1. obtain the current complete production Firestore/Storage rules from the authoritative Firebase/backend project
2. merge the tested Web clauses into those full rules
3. rerun Android/backend rule tests
4. rerun the Web Firestore + Storage emulator suite
5. review the diff before deployment
6. validate App Check traffic before enabling enforcement

Do not create a root Firebase deployment config by guessing missing Android/backend requirements.

## Repository invariant

There must be exactly one authenticated browser application implementation: `app/`.

Do not add:
- another root authenticated `app.js`
- another root Firebase data service
- temporary deploy-patch folders containing copies of `app/`
- old app snapshots under public GitHub Pages paths

Use a Git branch or pull request for temporary patches instead of committing deploy-copy directories.
