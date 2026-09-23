# Tefsen Web — Final Release Handoff

**Completion milestone:** Step 40 of 40  
**Source status:** Web completion work is complete in the repository after this PR is reviewed and merged.  
**Production status:** Final production launch still depends on a small set of external Firebase/deployment checks that cannot be proven or safely performed from this static Web repository alone.

## What “40/40 complete” means

The Tefsen Web source now has a coherent, tested student journey and a hardened release surface.

Repository completion includes:

- authenticated Firebase Web app
- Student Passport
- opportunity discovery, detail, trust and eligibility guidance
- saved opportunities
- application Journeys and post-acceptance planning
- public student profiles with private-account separation
- Community, subject, university and intake spaces
- Success stories and Journey stories
- public/global search integrity
- notifications
- Saved Community
- settings/account controls
- Google Play subscription presentation without client-side billing authority
- admin opportunity review/import workflow
- reports/moderation center
- removal of unsupported messaging/following/leaderboard surfaces
- claim-based admin authority
- private/public Firestore boundary tests
- Community interaction security tests
- Cloud Storage ownership/type/size tests
- account bootstrap integrity
- App Check readiness modeling
- account-deletion/privacy request integrity
- PWA/document security
- keyboard/dialog accessibility
- canonical public routes and release-integrity tests

## Steps 25–39 — reconciled merged history

The original master-plan order was reprioritized after Step 24 to close the highest-risk product/security gaps first.

| Step | Merged milestone |
| --- | --- |
| 25 | Settings, account and subscription experience — PR #67 |
| 26 | Notification center hardening — PR #69 |
| 27 | Reports and moderation center — PR #70 |
| 28 | Retire untrusted leaderboard — PR #71 |
| 29 | Public search integrity — PR #72 |
| 30 | Separate public profiles from private accounts — PR #73 |
| 31 | Secure Community interactions — PR #74 |
| 32 | Secure Storage and App Check readiness — PR #75 |
| 33 | Canonicalize the public Web surface — PR #76 |
| 34 | Fix auth account bootstrap integrity — PR #77 |
| 35 | Harden PWA and document security — PR #78 |
| 36 | Unify entitlement and admin authority — PR #79 |
| 37 | Align account deletion and privacy requests — PR #80 |
| 38 | Accessibility and dialog integrity — PR #81 |
| 39 | Public route and release integrity — PR #82 |
| 40 | Final release audit and handoff — this PR |

## Automated repository gates now in place

GitHub Actions validates:

- public-home JavaScript syntax
- authenticated app JavaScript syntax
- Firebase service/module syntax
- Firestore isolated security rules
- Cloud Storage isolated security rules
- owner/cross-user/anonymous negative security cases
- Student Passport/Journey privacy boundaries
- public profile/private account separation
- Community create/delete/like/answer safety
- moderation/report ownership
- admin claim boundaries
- notification read-state privacy
- auth bootstrap compatibility with account rules
- Storage MIME/type/size/owner boundaries
- App Check readiness semantics
- PWA cache/fallback integrity
- account deletion/privacy request consistency
- accessibility/dialog keyboard behavior
- canonical routes/sitemap/static assets
- production Firebase Web client configuration shape

The Step 39 PR head passed **363/363 tests with 0 failures** before this final handoff PR was created.

Step 40 reruns the complete suite and adds final documentation-consistency checks.

## Source-proven release state

These items are proven by repository source/tests:

- canonical public domain config is `www.tefsen.com`
- authenticated app source is only under `/app/`
- production Web Firebase project is `tefsen-fa2b5`
- production Web is not forced into demo mode
- admin Web capability is custom-claim based
- private account fields are separated from public profile projection
- isolated Web Firestore/Storage contracts pass emulator tests
- public release routes are canonicalized
- authenticated `/app/` intentionally requests `noindex,follow`
- legacy Privacy/Delete Account URLs are compatibility redirects only
- PWA shell/runtime config handling is explicitly tested
- App Check client readiness never claims enforcement is active
- full browser-side account deletion is intentionally not faked

## External production gates still required

These are **not code-completion failures**. They require authoritative production systems or real deployed traffic.

### 1. Merge Web rule clauses into the real production Firebase rules

This repository intentionally does not contain Tefsen's complete Android/backend production:

- root `firebase.json`
- root `.firebaserc`
- complete production `firestore.rules`
- complete production `storage.rules`
- complete Functions source/configuration

The rules in `firebase-tests/` are isolated, deny-by-default Web contracts.

Before production rule deployment:

1. obtain the current authoritative full production Firestore/Storage rules
2. merge the tested Web clauses into those full rules
3. preserve Android/backend requirements
4. rerun Android/backend rule tests
5. rerun this Web Firestore + Storage emulator suite
6. review the production diff
7. deploy only the merged full rules

**Never deploy the isolated `firebase-tests/*.rules` files over the complete production rules.**

### 2. Configure Web App Check in Firebase Console

Current source intentionally has:

`window.TEFSEN_APPCHECK_SITE_KEY = ""`

Required external sequence:

1. register/configure the Tefsen Web reCAPTCHA v3 App Check provider
2. add the public Web site key to `firebase-config.js`
3. deploy the static update
4. observe legitimate Web App Check traffic
5. verify valid requests in Firebase metrics
6. enable enforcement service-by-service only after traffic is healthy

Do not enable enforcement blindly.

### 3. Verify real admin claim

Admin capability must come from a trusted Firebase Admin SDK/server environment.

Verify the intended admin account has:

- `admin: true`

or the trusted equivalent supported by the current admin-capability service.

Then refresh the ID token/sign out and back in before testing.

Do not use a client-editable profile role as authorization.

### 4. Real-domain authentication smoke test

On the deployed `https://www.tefsen.com/app/`, test:

- existing email/password account
- new email/password account
- Google sign-in
- sign-out/sign-in
- password-reset email
- account bootstrap after first sign-in
- old/legacy account bootstrap recovery
- admin allowed with custom claim
- admin denied without custom claim

### 5. Real-data workflow smoke test

With real Firebase production data/rules:

- create/edit Student Passport
- save an opportunity
- start a Journey
- update checklist/stage
- test deadline/notification state
- upload/remove profile photo
- create/delete a Community post
- upload/delete post images
- save/unsave Community post
- publish/read Success story
- publish/read Journey story
- test report/moderation path
- test opportunity admin review/import with trusted admin

### 6. Opportunity freshness operations

Before broad public promotion:

- ensure public opportunity records point to official provider sources
- verify current deadline/funding/study-level fields
- do not carry old deadlines forward automatically
- keep stale/review states operational
- prove the admin import/review workflow with a small curated batch first

### 7. Real-device/browser QA

After the final merge/deployment, test at minimum:

- Android Chrome
- desktop Chrome
- desktop Safari
- mobile Safari when available
- keyboard-only navigation
- browser zoom / larger text
- reduced-motion preference
- slow connection
- temporary offline mode
- service-worker update from an older Tefsen cache
- sign-in popup/redirect behavior on the real domain

## Post-merge live-route verification

After Step 40 merges and GitHub Pages deploys, verify:

- `https://www.tefsen.com/`
- `https://www.tefsen.com/app/`
- `https://www.tefsen.com/founder.html`
- `https://www.tefsen.com/privacy-policy/`
- `https://www.tefsen.com/terms.html`
- `https://www.tefsen.com/delete-account/`
- `https://www.tefsen.com/robots.txt`
- `https://www.tefsen.com/sitemap.xml`

Also verify legacy redirects:

- `/privacy.html` → `/privacy-policy/`
- `/delete-account.html` → `/delete-account/`

## Release decision language

Use these terms precisely:

### Source complete

Yes, after Step 40 is merged and CI is green.

### Security contract tested

Yes, for the isolated Web Firestore/Storage contracts in this repository.

### Production Firebase rules deployed

Do not claim this until the merged authoritative full production rules have actually been deployed.

### App Check enforced

Do not claim this until Firebase Console traffic has been validated and enforcement is actually enabled.

### Production launch verified

Do not claim this until real-domain authentication/data/device smoke tests are complete.

## Rollback principle

If the deployed release shows:

- broken authentication
- private-data leakage
- incorrect cross-user access
- broken Storage ownership
- admin authorization failure
- destructive account/profile behavior
- a service-worker update loop

revert/disable the affected Web release or feature.

Do **not** weaken security rules merely to make the UI appear functional.

## Final ownership

After Step 40, future Tefsen Web work should be ordinary product maintenance, data operations, and new-feature development—not completion of known placeholder/dead-end Web surfaces.

New high-risk features such as private messaging or following should only return with:

- an explicit data model
- authorization rules
- abuse/block/report behavior
- deletion/retention behavior
- automated security tests
- real-device QA
