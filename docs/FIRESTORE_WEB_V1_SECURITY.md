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
6. existing Tefsen posts/profile access remains unchanged

Do not deploy rules from this document directly without merging them into and testing the current production rule set.
