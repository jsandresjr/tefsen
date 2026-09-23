# Tefsen Web V1 — Production Launch Checklist

## Repository status

The 40-step Web completion program is source-complete after Step 40 is reviewed and merged.

The repository now contains automated checks for the authenticated Web app, public website, isolated Firestore security contract, isolated Cloud Storage contract, PWA behavior, privacy/account flows, accessibility, and public release routing.

The Step 39 PR head passed **363/363 tests with 0 failures**. Step 40 reruns the full suite and adds final handoff-consistency tests.

## Completed in source / CI

- [x] Opportunity discovery/detail/trust/eligibility experience
- [x] Student Passport onboarding/editor
- [x] Saved opportunities and private Journey workflow
- [x] Post-acceptance planning
- [x] Public profile / private account separation
- [x] Community + subject + university + intake experiences
- [x] Success/Journey story publishing and readers
- [x] Public/global search integrity
- [x] Notifications and Saved Community
- [x] Settings/account/subscription presentation
- [x] Reports/moderation center
- [x] Claim-gated admin opportunity workflow
- [x] Unsupported messaging/following removed cleanly
- [x] Untrusted leaderboard retired
- [x] Firestore isolated emulator security tests
- [x] Cloud Storage isolated emulator security tests
- [x] Community interaction rules/tests
- [x] Auth account bootstrap/rule compatibility tests
- [x] App Check readiness model
- [x] PWA/document security
- [x] Account deletion/privacy request integrity
- [x] Keyboard/dialog accessibility baseline
- [x] Canonical public routes/sitemap/static-release checks
- [x] Production Firebase Web client config populated
- [x] Production Web not forced into demo mode

## External production gates

Do not describe these as complete until verified in the authoritative external systems.

### A. Production Firestore + Storage rule deployment

- [ ] Obtain the current complete production rules used by Android/backend.
- [ ] Merge the tested Web clauses from `firebase-tests/`.
- [ ] Preserve all Android/backend requirements.
- [ ] Run Android/backend security tests.
- [ ] Run this Web emulator suite again against the merged rule set when practical.
- [ ] Review the final production diff.
- [ ] Deploy only the merged complete production rules.

The isolated Web test rules must **not** overwrite the complete production rules.

### B. Web App Check

- [ ] Register/configure Web reCAPTCHA v3 App Check provider.
- [ ] Add the public site key to the Web config.
- [ ] Deploy with monitoring first.
- [ ] Confirm legitimate Web requests receive valid App Check signals.
- [ ] Enable enforcement gradually per supported Firebase service.

### C. Admin custom claim

- [ ] Confirm the intended production admin account has a trusted Auth custom claim.
- [ ] Refresh the ID token/sign out-in.
- [ ] Confirm Admin review is available to the claimed admin.
- [ ] Confirm Admin review is denied to an ordinary student.

### D. Real-domain authentication smoke test

- [ ] Existing email/password login
- [ ] New email/password registration
- [ ] Google sign-in
- [ ] Password reset
- [ ] Sign-out/sign-in persistence
- [ ] Old-account bootstrap recovery
- [ ] New-account bootstrap creation

### E. Real production data smoke test

- [ ] Student Passport create/update
- [ ] Opportunity save/unsave
- [ ] Journey start/update
- [ ] Notification/read-state behavior
- [ ] Profile photo upload/remove
- [ ] Community post create/delete
- [ ] Post image upload/delete
- [ ] Saved Community
- [ ] Success story
- [ ] Journey story
- [ ] Report/moderation flow
- [ ] Admin opportunity review/import

### F. Opportunity freshness operations

- [ ] Curate a small real official-source opportunity set.
- [ ] Verify deadlines/funding/study fields.
- [ ] Verify stale/review states.
- [ ] Confirm imports begin non-public and require trusted review.
- [ ] Expand catalogue only after review workflow is proven.

### G. Browser/device QA

- [ ] Android Chrome
- [ ] desktop Chrome
- [ ] desktop Safari
- [ ] mobile Safari when available
- [ ] keyboard-only navigation
- [ ] larger text/browser zoom
- [ ] reduced motion
- [ ] slow network
- [ ] temporary offline
- [ ] service-worker upgrade from an older cache

## Post-merge route checks

After GitHub Pages deploys the final merge:

- [ ] `/`
- [ ] `/app/`
- [ ] `/founder.html`
- [ ] `/privacy-policy/`
- [ ] `/terms.html`
- [ ] `/delete-account/`
- [ ] `/robots.txt`
- [ ] `/sitemap.xml`
- [ ] `/privacy.html` redirects to `/privacy-policy/`
- [ ] `/delete-account.html` redirects to `/delete-account/`

## Release sequence

1. Merge Step 40 after green CI.
2. Allow GitHub Pages to deploy.
3. Complete post-merge public-route smoke checks.
4. Merge/test the Web security clauses into the authoritative production Firebase rules.
5. Verify trusted admin claim.
6. Configure App Check Web provider and deploy the site key.
7. Run real-domain auth/data smoke tests.
8. Observe App Check traffic.
9. Enable enforcement gradually only after valid traffic is confirmed.
10. Expand curated opportunity data after the admin freshness/review workflow is proven.

## Rollback principle

If authentication, private-data access, Storage ownership, admin authorization, or service-worker behavior is wrong after deployment, revert/disable the affected release or feature before considering any security-rule relaxation.
