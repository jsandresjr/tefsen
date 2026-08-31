# Tefsen Social Education Transformation — Phase 0 Audit / Phase 1 Checkpoint

Branch: `feature/social-education-phase1`

## Repository reality

- This repository is **not an Android Studio project**. No Gradle wrapper, `settings.gradle`, `AndroidManifest.xml`, `app/src`, Kotlin, or Java Android source was found in the repository tree inspected for this checkpoint.
- The repository contains:
  - a GitHub Pages public/marketing website at the repository root;
  - an authenticated Firebase-powered web app under `/app`.
- Public/legal routes and GitHub Pages files must remain untouched: `CNAME`, privacy, account deletion, root marketing site, robots, sitemap, and 404.

## Web architecture

- Entry point: `app/index.html`
- Main application shell and routes: `app/js/app.js`
- Firebase initialization: `app/js/firebase-client.js`
- Authentication: `app/js/services/auth-service.js`
- Data access and compatibility normalization: `app/js/services/data-service.js`
- Central collection/field mapping: `app/js/config/schema.js`
- State: `app/js/store.js`
- Core styles: `app/css/app.css`
- Service worker/PWA: `app/sw.js`
- Firebase SDKs are loaded directly from Google's CDN; there is no package/build pipeline in this repository.

## Existing routes

Authenticated web routes currently include Home, Explore, Notifications, Messages, Leaderboard, Saved, Subscription, Profile, Settings, Post detail, and Search.

Phase 1 changes the **primary visible navigation** to:

1. Home
2. Explore
3. Create
4. Activity
5. Profile

Legacy routes remain available for backward compatibility. Leaderboard remains reachable from Explore, and Saved/Subscription/Settings remain available through existing account surfaces.

## Authentication

Current web authentication supports:

- Email/password sign in
- Email/password registration
- Password reset
- Google sign in

The existing Firebase user document sync is preserved.

## Firestore model inferred from code

Top-level collections:

- `users`
- `posts`
- `notifications`
- `conversations`
- `reports`

Known/declared subcollections:

- `comments`
- `answers`
- `likes`
- `savedPosts`
- `messages`
- `followers`
- `following`

The current production-compatible question model is stored in `posts`. `normalizePost()` already acts as a compatibility adapter across several legacy field aliases.

## Important existing limitations / risks

1. **Hardcoded admin email fallback** exists in both authentication and data normalization. This is a security/design smell and must be replaced by trusted role/claim handling in a later backend-safe migration. It is not removed in this checkpoint because doing so without verifying production role data could lock out the existing administrator.
2. **Follow writes are not implemented** in the current web data service. `toggleFollow()` intentionally throws.
3. **Private Save is not implemented** in the current web data service. `toggleSave()` intentionally throws.
4. **Private messaging backend is not implemented** in the current web data service.
5. Notifications currently return an empty list in the web service.
6. The main posts subscription uses a bounded `limit(50)` query and client-side sorting. Phase 1 adds visible incremental loading inside that bounded batch, but **true Firestore cursor pagination still requires a safe indexed query design**.
7. Search downloads bounded candidate sets and filters client-side. It should move toward normalized searchable fields in a later discovery phase.
8. Some authorization checks exist in client UI logic. Firestore/Storage rules remain the source of truth and must be reviewed before enabling new write types.

## Phase 1 implementation in this branch

Added a progressive social-learning shell rather than rewriting the existing app:

- New five-destination primary navigation
- Notifications relabeled as **Activity** without breaking the legacy route
- Centered/prominent **Create** action on desktop and mobile
- Create sheet with Post, Notes, Question, Spark, and Study Update
- Existing Question composer remains the only enabled creation format in this checkpoint
- Home feed changed to **For You / Following**
- Topic rail for Mathematics, Physics, Chemistry, Biology, ICT/Computer Science, Study Tips, Engineering, Medicine, Technology
- Existing questions rendered as social-learning cards through a compatibility view
- Creator identity, verification indicator, subject, time, media, Like, Comment, Share
- Helpful and Save shown as intentionally disabled Phase 2 actions rather than fake functionality
- Honest Following empty state because the backend does not yet support real follows
- Incremental visible loading for the current bounded feed batch
- Explore gains a direct **Top Scholars** route
- Primary copy shifts from question-only language toward social education
- New design tokens and responsive social-feed styling
- Existing auth, Firebase data services, public/legal routes, and production collections are not renamed or deleted

## Files changed

- `app/index.html` — loads Phase 1 progressive stylesheet/module
- `app/css/phase1-social.css` — Phase 1 design tokens and social shell/feed styles
- `app/js/phase1-social.js` — progressive navigation, feed, topic filters, create sheet, Activity/Explore enhancements
- `docs/phase1-checkpoint.md` — this audit/checkpoint

## Baseline / verification

Baseline repository has no npm/Gradle build configuration, so there is no real project build command to run.

Checks performed for the new Phase 1 module before commit:

- JavaScript syntax check: `node --check app/js/phase1-social.js` — PASS
- CSS brace balance — PASS
- Existing files are not deleted or renamed
- Root marketing/legal files are not modified

Not yet verified in this connector-only checkpoint:

- Real Firebase authenticated browser session
- Firestore/Storage security rules
- Real Google sign-in after deployment
- Mobile browser visual regression
- GitHub Pages deployment output
- Android/Play Store behavior (Android source is not in this repository)

## Exact next milestone

Phase 2 should implement the shared post write model and secure backend/rules support for:

1. `EDUCATIONAL_POST`
2. Like + Helpful as independent reactions
3. Private Save
4. Paginated comments
5. required Firestore indexes/rules

Do not enable those writes in UI until the rules/backend path is verified.
