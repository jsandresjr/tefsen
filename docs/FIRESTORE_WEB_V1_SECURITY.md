# Tefsen Web V1 — Firestore Security Contract

This document describes the security behavior required before the Student Passport feature is merged to production.

The repository currently contains the web client but does not contain the production Firestore rules file. Do **not** treat UI privacy as security. Firestore rules must enforce these boundaries.

## Public profile vs private account boundary

Tefsen Web must not rely on client-side field projection as a privacy boundary.

Private account data remains in:

`users/{uid}`

Public profile identity is mirrored separately to:

`public_profiles/{uid}`

The public profile document is intentionally limited to:

- `uid`
- schema version
- public name
- optional public username
- optional public bio
- public profile image URL fields
- update timestamp

It must not contain:

- email
- subscription/billing fields
- account role or admin authorization
- verification authority
- Student Passport data
- Journey data
- saved content
- notification/settings state

Public Search and other-user profile lookup should read `public_profiles`, not `users`.

The signed-in owner may read their own `users/{uid}` document for account/subscription/profile editing. Ordinary users must not read another student's private user document.

Public profile writes must not allow a student to publish privileged fields such as role, verified status, subscription state, or admin claims.

Active users can be migrated safely by mirroring only the allowed public identity fields when they sign in or save their public profile. Do not backfill by exposing the full private user document to browsers.

## Community interaction security

Tefsen Web uses authenticated subcollections for Community interactions rather than letting browsers rewrite public aggregate counters.

### Posts

An ordinary signed-in student may create a public Web post only as themselves.

The Web security contract should require:

- `authorId`, `firebaseUid`, and `userId` all equal `request.auth.uid`
- public author name/photo match the student's `public_profiles/{uid}` record
- new posts start as `published + public`
- source is explicitly Web
- all public counters start at zero
- clients cannot include role/admin, verification, billing, or subscription claims
- clients cannot later update like/comment/answer/save counters
- post owners may delete their own post
- moderation-field updates remain trusted-admin only

### Likes

Likes are stored at:

`posts/{postId}/likes/{uid}`

The liking identity is private account interaction data.

Required behavior:

- only `uid == request.auth.uid` may create/delete that like document
- the parent post must currently be public/published
- the like payload must bind uid/userId/postId to the authenticated user/path
- an ordinary client may read only its own like document
- clients must not list the full likes collection to discover who liked a post
- Web must not regenerate public aggregate like counters from browser-side collection scans

If a public aggregate like count is needed, maintain it from trusted backend/server logic.

### Answers

Answers are stored at:

`posts/{postId}/answers/{answerId}`

Required behavior:

- the parent post must be public/published
- answer author identity IDs must equal `request.auth.uid`
- displayed public author name/photo must match `public_profiles/{uid}`
- answer content aliases must represent the same submitted content
- new answers start as `published + public`
- clients cannot claim role/verified/admin metadata
- ordinary clients cannot edit counters
- answer owners may delete their own answer

### Legacy compatibility script

The former `app/js/latest-rules-sync.js` browser compatibility layer has been removed.

It previously attempted to:

- recompute like counts in the browser and update parent posts
- recompute answer counts in the browser and update parent posts
- hydrate obsolete follow/follower UI
- rewrite answer profile-photo metadata client-side

Those behaviors conflict with least-privilege rules and should not be restored. Counter denormalization and cross-document maintenance belong in trusted backend code when needed.

## Required Student Passport rule

Student Passport data is stored separately from the public user profile:

`student_passports/{uid}`

Required behavior:

- only an authenticated user may read their own Student Passport
- only an authenticated user may create/update/delete their own Student Passport
- no other student may read it
- community/profile reads must never depend on this private document

Conceptual rule:

```text
match /student_passports/{uid} {
  allow read, create, update, delete:
    if request.auth != null && request.auth.uid == uid;
}
```

Adapt this to the existing production rules structure rather than replacing the whole rules file.

## Required Application Journey rule

Application journey data is stored under the owning user:

`journeys/{uid}/opportunities/{opportunityId}`

This data includes saved state, application stage, personal target dates, private notes, checklist status and stage history.

Required behavior:

- only the authenticated owner may list/read their journey documents
- only the authenticated owner may create/update their journey documents
- another student must never be able to read a journey document
- journey notes/checklists/status must never become public profile or community data automatically
- opportunity IDs may reference public opportunities, but that does not make the user's journey document public

Conceptual rule:

```text
match /journeys/{uid}/opportunities/{opportunityId} {
  allow read, create, update, delete:
    if request.auth != null && request.auth.uid == uid;
}
```

Adapt this to the existing production rule tree and emulator-test it before deployment.

## Required Opportunities rule

For the initial read-only public opportunity catalogue:

`opportunities/{opportunityId}`

Public/authenticated reads should only be allowed for records intended for public discovery, for example:

- `status == "published"`
- `visibility == "public"`

Ordinary users must not be able to set or change privileged fields such as:

- `verificationStatus`
- `verifiedBySystemOrAdmin`
- `lastVerifiedAt`
- official/provider trust fields

Opportunity writes should remain admin/backend controlled until the community-submission workflow is implemented with separate pending data.

## Important privacy note

These fields belong in Student Passport/private data, not the public `users` document by default:

- nationality
- GPA
- funding preference
- English-test status
- document readiness
- private study goals
- preferred destination countries when the user has not chosen to share them

## Required tests before production

Use Firebase Emulator Suite to verify:

1. user A can read/write `student_passports/userA`
2. user A cannot read/write `student_passports/userB`
3. unauthenticated users cannot read Student Passport data
4. public opportunity reads succeed only for published/public records
5. ordinary users cannot change opportunity verification/admin fields
6. user A can list/read/write `journeys/userA/opportunities/*`
7. user A cannot read/write `journeys/userB/opportunities/*`
8. unauthenticated users cannot read journey data
9. existing Tefsen posts/profile access remains unchanged

Do not deploy rules from this document directly without merging them into and testing the current production rule set.


## Public success and journey stories

Success stories and public journey stories use the existing public `posts/{postId}` collection.

Privacy boundary:

- private `student_passports/{uid}` documents are never copied automatically into a post
- private `journeys/{uid}/opportunities/{opportunityId}` documents are never copied automatically into a post
- success posts contain only explicit public fields entered by the student
- public journey stories contain only milestones explicitly typed into the public story form
- application IDs, passport/visa numbers, addresses, booking references, financial-account details and private documents should never be accepted as structured public fields

The web client currently whitelists these structured public metadata fields:

- `postType`
- `successData.university`
- `successData.opportunityName`
- `successData.country`
- `successData.subject`
- `successData.studyLevel`
- `successData.intake`
- `successData.fundingType`
- `publicMilestones[].stage`
- `publicMilestones[].month`
- `publicMilestones[].note`
- `communitySubject`
- `communityUniversity`
- `communityIntake`

Production post-write rules should continue enforcing that an authenticated user can create content only as themselves and cannot forge privileged moderation/admin fields.

## Subject, university and intake communities

Initial community pages are read-only aggregations of already-public opportunities and public posts.

They do not create a separate public copy of Student Passport or private Journey data.

Required behavior:

- subject pages use public post subject/community tags plus published opportunities
- university pages use public university metadata plus published opportunities
- intake pages use explicit public intake tags plus published opportunities
- community discussion creation continues through the existing authenticated public-post path
- community pages must never query private Student Passport or Journey collections

Additional recommended tests:

1. a success story cannot serialize unexpected nested private fields through the structured metadata helper
2. a public journey story serializes only explicitly entered public milestones
3. community aggregation reads only public posts and published/public opportunities
4. deleting a public post removes it from subject/university/intake aggregation without touching private Journey data


## Admin authorization and opportunity verification

The web admin interface must **not** rely on the public/private user profile role as its security boundary.

Production admin access should be granted by a Firebase Auth custom claim created from a trusted server/Admin SDK environment, for example one of:

- `admin: true`
- `role: "ADMIN"`

The client checks the ID-token claim before showing admin tools, but Firestore rules remain the authoritative boundary.

Conceptual helper:

```text
function isAdmin() {
  return request.auth != null
    && (request.auth.token.admin == true
        || request.auth.token.role == "ADMIN");
}
```

Conceptual opportunity rules to merge into the existing production ruleset:

```text
match /opportunities/{opportunityId} {
  allow read:
    if resource.data.status == "published"
       && resource.data.visibility == "public";

  allow create, update, delete:
    if isAdmin();
}

match /opportunity_audit/{auditId} {
  allow read, create:
    if isAdmin();

  allow update, delete:
    if false;
}
```

Do not copy this fragment over the entire production rules file. Merge it with existing Tefsen rules and emulator-test all old and new flows.

### Verification rules

A verified opportunity must have:

- a valid official/provider source URL
- `verificationStatus == "verified"`
- `status == "published"`
- `visibility == "public"`
- a recent `lastVerifiedAt` timestamp

Normal users must never be able to modify:

- verification status
- publication status
- visibility
- last verified date
- admin/audit fields

Imports always enter as:

- `verificationStatus = "pending"`
- `status = "draft"`
- `visibility = "private"`

The client enforces this as a safety layer; Firestore rules must still enforce the privileged write boundary.

## App Check launch requirement

The current Web client supports Firebase App Check with a reCAPTCHA v3 site key through `TEFSEN_APPCHECK_SITE_KEY`.

At the time of the V1 hardening pass, that value is still empty in the repository configuration.

Before enforcement:

1. register/configure the Tefsen Web app in Firebase App Check
2. add the correct public site key to Web configuration
3. deploy without enforcement first
4. confirm valid production requests in Firebase App Check metrics
5. enable enforcement service-by-service only after validation

Do not place server secrets, service-account JSON, or private keys in the web repository.
