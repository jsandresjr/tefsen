# Tefsen Web V1 — Firestore Security Contract

This document describes the security behavior required before the Student Passport feature is merged to production.

The repository currently contains the web client but does not contain the production Firestore rules file. Do **not** treat UI privacy as security. Firestore rules must enforce these boundaries.

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
