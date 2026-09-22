# Tefsen Web V1 — Engineering Audit

## Automated/static checks completed

- JavaScript syntax checks passed for:
  - app.js
  - opportunity admin service
  - opportunity service
  - journey service
  - community service
- structured import tests confirmed that imported records are forced to:
  - pending
  - draft
  - private
- duplicate detection passed for:
  - duplicate URL inside the same batch
  - duplicate URL against existing opportunity data
- opportunity freshness tests confirmed:
  - deadline day itself is not expired
  - a prior date is expired
  - old verification timestamps become stale
- external links using `target="_blank"` in the audited Web app include `rel="noopener noreferrer"`
- no inline click/load/error/submit event-handler attributes were found in the audited primary HTML/app surfaces
- focus-visible and reduced-motion CSS hardening added

## Security design checks

- admin UI requires a Firebase Auth custom claim in Firebase mode
- profile role alone does not unlock admin tooling
- imported opportunity data cannot request verified/published/public status
- review actions cannot use arbitrary UI-supplied patch fields to overwrite opportunity records
- public success/journey story metadata remains separate from private Student Passport/Journey records
- App Check is supported but currently not configured

## Checks not possible from this repository

These remain external blockers:

- Firebase Emulator Suite security-rule test run
- Storage-rule regression test
- real Firebase App Check traffic validation
- real-domain Google sign-in smoke test
- production opportunity-data verification
- browser/device performance profiling against the deployed site

Reason: the production Firestore/Storage rules and Firebase deployment project configuration are not present in this repository.
