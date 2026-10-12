# Android parity — backend integration and release gates

**Status: development branch only. Do not merge/deploy before the checks below.**

This branch modifies only `/app/` plus a PR-only test workflow and documentation.
The separate public website remains untouched. Firebase project IDs, user IDs and
production data are not migrated. The connected GitHub account exposes only
`jsandresjr/tefsen` (Web); the Android repository, authoritative Cloud Functions
source and complete production Firestore/Storage rules are not available here.

## Implemented in the review branch

- Silver transparent brand asset is preserved from the existing repository.
- Authenticated Web UI displays after essential account profile lookup; reactions,
  notification reads and administration checks are requested subsequently.
- Production Firebase initialization failure no longer silently opens demo users.
- Free/paid composer shows 300/1000 character limits. Post/day UI check is
  20/40. Backend quota enforcement across Android/Web is **not verified**.
- Account-scoped local draft storage with explicit clear and pending-submit lock.
- People/Posts search modes, @ selection, case normalization and exact/prefix
  ranking against the *existing bounded public search*. This is not full indexed search.
- Password account email confirmation screen and Firebase resend/status refresh.
- Client validates profile-photo file type and <= 5 MiB before decoding.
  Photo changes call `us-central1.updateProfilePhoto` with
  `{action:'upload',imageBase64}` or `{action:'remove'}`. No client
  direct-Storage photo uploads/deletions. If the callable is absent, the
  operation fails closed instead of bypassing the quota.
- Existing owner profile fields remain editable. The profile editor now provides drag, arrow-key positioning, zoom,
  reset and optimized JPEG output; Android crop parity still needs a device test.
- The browser shell has a focus/keyboard-aware mobile navigation rule and
  scroll restoration.

## Required before declaring Android parity

1. **Android source**: obtain current app UI, account/username reservation logic,
   signed-in state rules, following/blocks, badge dialog, notification deletion
   and swipe contracts, and photo crop behavior.
2. **Firebase deployments**: export authoritative Firebase Functions source,
   Firestore/Storage rules and indexes from the real project. The repository's
   `firebase-tests/` rules are isolated and must not overwrite production rules.
3. **Profile photos**: verify `updateProfilePhoto` is deployed in `us-central1`,
   accepts raw JPEG Base64, and atomically enforces 3 uploads per calendar
   month in `Asia/Colombo` from trusted server time. Verify quota includes the
   first confirmed signup photo, removal is free, and failed uploads do not count.
   Test concurrent uploads and direct Storage denial.
4. **Identity**: confirm username reservation and email/username login trusted
   lookup, signup with/without optional photo and photo persistence through
   confirmation, existing 7-day username rule, and account deletion callable.
5. **Following and blocks**: verify exact Android paths and callable contracts.
   The current Web Following tab is intentionally marked unavailable; do not
   guess collection names or produce local-only follow records. Block checks must
   happen server-side for posts, reactions, replies and follows.
6. **People search**: implement a trusted indexed lookup or migration/backfill.
   Current public-profile search only scans a fixed capped window; it will miss
   valid legacy users. Do not fetch the full private directory into browsers.
7. **Publishing**: reconcile shared 20/40 posts/day in Colombo time, server
   entitlement validation, idempotent submit IDs, pending moderation status,
   post deletion cleanup and cross-device quotas. Current Web `createPost`
   still writes a published post directly and requires rules/Android review.
8. **Notifications**: confirm collection owner fields and exact backend mutation
   for delete, bulk-delete snapshot safety and swipe recovery. Current Web only
   has basic inbox/read behavior.
9. **Verification/Plus**: verify administrator badge, paid-badge priority/dialog,
   backend-proven expiry and accurate hosted browser purchase availability.
10. **Admin**: confirm trusted custom claims/functions for ban/unban, review
    queues, protected accounts, moderation audit and revocation. Never use
    mutable UI role fields for authorization.
11. **Full validation**: test responsive browser and accessibility behavior,
    Android/Web shared records, every private data boundary, offline/error/
    retry, search races, 5 MiB boundary, 4th photo refusal, Kolkata/Colombo
    rollover (must use Colombo), and new-notification-only foreground banners.

## Test commands

From the repository root using Node.js 22:

```sh
node --test app/tests/*.test.mjs
node --check app/js/app.js
node --check app/js/services/data-service.js
node --check app/js/services/auth-service.js
node --check app/js/services/profile-photo-callable.js
```

The PR workflow performs the same dependency-free tests and syntax checks. They
are not Firebase emulator, browser E2E, or Android cross-device tests.

## Local preview

Serve the repository root over HTTP from a local development server (not
`file://`). Open `http://localhost:<port>/app/`. Firebase Authentication
must authorize the origin; configure a safe test Firebase project or emulator
for interactive testing. **Do not test live moderation, subscriptions, photo
quotas or destructive account operations against production.** The public
Firebase Web config is already present, but private keys must never be added.

## Merge policy

Production deployment requires explicit owner approval, matching Android
backend source, verified security rules/indexes/functions, test evidence and a
nonproduction preview. Merging this branch into `main` may auto-deploy via
GitHub Pages, so leave the pull request as draft until all gates pass.
