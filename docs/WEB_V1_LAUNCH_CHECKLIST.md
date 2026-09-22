# Tefsen Web V1 — Production Launch Checklist

## Current code status

Implemented in the Web V1 branches and merged progressively into the product:

- opportunity discovery and detail pages
- Student Passport
- rule-based eligibility matching
- saved opportunities
- deadline tracking
- private application journey
- preparation checklists
- success stories
- public journey stories
- subject communities
- university and intake communities
- claim-gated opportunity admin review
- JSON/CSV import preview
- duplicate source detection
- stale/expired opportunity review states
- opportunity audit-log writes
- accessibility focus/reduced-motion hardening
- expanded offline shell cache

## Production blockers

Do not call Web V1 production-ready until all of these are completed.

### 1. Firestore rules

The production Firestore rules are not stored in this repository, so they could not be emulator-tested from this repo.

Merge and test owner-only rules for:

- `student_passports/{uid}`
- `journeys/{uid}/opportunities/{opportunityId}`

Add admin-only write rules for:

- `opportunities/{opportunityId}`
- `opportunity_audit/{auditId}`

Preserve existing secure behavior for:

- users
- posts
- comments/answers
- likes
- notifications
- conversations/messages
- reports

Required negative tests:

- user A cannot read user B Student Passport
- user A cannot read user B Journey
- ordinary user cannot publish/verify an opportunity
- ordinary user cannot write an audit log
- unauthenticated user cannot read private profile/journey data
- ordinary user cannot forge admin/moderation fields on public posts

### 2. Firebase Auth admin custom claim

Create admin authorization only through a trusted Admin SDK/server environment.

Recommended claim:

`admin: true`

or:

`role: "ADMIN"`

After changing the claim, sign out/in or refresh the Firebase ID token before testing the Admin page.

Never use a client-editable profile field as the real authorization boundary.

### 3. Web App Check

The current repository has:

`window.TEFSEN_APPCHECK_SITE_KEY = ""`

Before launch:

1. configure Firebase App Check for the Tefsen Web app
2. add the public reCAPTCHA v3/App Check site key
3. deploy with monitoring first
4. verify valid requests in App Check metrics
5. then enable enforcement gradually

Do not enable enforcement blindly.

### 4. Real opportunity data

Before public launch, replace preview-only/demo entries with curated real opportunity records.

Every public verified record should have:

- official provider URL
- provider/university
- country
- opportunity type
- funding type when known
- structured study level/subject where known
- real deadline when known
- verification timestamp

Never invent missing deadlines or carry an old deadline into a new year automatically.

### 5. Admin import workflow test

Use a non-production/test project first.

Verify:

- JSON import preview
- CSV import preview
- duplicate URL detection
- invalid URL rejection
- maximum batch limits
- imports remain pending/draft/private
- admin verifies one record manually
- published record becomes visible in Opportunities
- audit record is created

### 6. Authentication and release smoke test

Test on the real domain:

- email sign-in
- Google sign-in
- sign-out/sign-in
- old Tefsen user account
- new user
- Student Passport persistence
- opportunity save
- journey persistence
- public success story
- subject/university community navigation
- admin access with claim
- admin denial without claim

### 7. Accessibility smoke test

Check at minimum:

- keyboard-only navigation
- visible focus
- large text/browser zoom
- reduced-motion preference
- screen-reader labels on icon buttons
- form labels and error states
- deadline/eligibility meaning without relying only on color

### 8. Mobile and poor-network test

Test:

- Android Chrome
- mobile Safari if available
- desktop Chrome/Safari
- slow network
- temporary offline mode
- service-worker update after deployment

The service-worker cache version was bumped for Web V1 so old shell files are removed after activation.

## Release sequence

1. Merge the launch PR.
2. Merge/test production Firestore rules.
3. Configure admin custom claim.
4. Configure Web App Check site key.
5. Deploy Web app with App Check monitoring but without new enforcement.
6. Add a small curated set of real opportunities.
7. Complete smoke tests on `tefsen.com`.
8. Review App Check traffic.
9. Enable enforcement gradually when valid traffic is confirmed.
10. Expand opportunity data only after the review workflow is proven.

## Rollback principle

If authentication, private-data access, or opportunity verification behaves incorrectly after launch, revert the Web release or disable the affected feature before weakening security rules.
