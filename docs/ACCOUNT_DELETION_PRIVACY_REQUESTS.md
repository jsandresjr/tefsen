# Tefsen Web Account Deletion & Privacy Requests

Tefsen Web distinguishes between:

1. self-service removal of specific public content
2. a full Tefsen account-deletion request
3. privacy access or portability requests

These are different workflows.

## Full account deletion

Tefsen Web does **not** currently perform complete account deletion as a one-click browser action.

The Web app does not call Firebase Auth `deleteUser()` because deleting only the authentication record would not safely clean every related Tefsen data surface.

A complete deletion may involve, depending on the account and platform history:

- Firebase Authentication identity
- private account/profile data
- public profile projection
- Student Passport data
- saved opportunities and Journeys
- settings
- notification state
- authored posts and answers
- uploaded profile/post media
- likes/saves and other interaction records
- moderation/safety records subject to retention requirements
- Android/backend records not represented by the isolated Web repository

Until Tefsen has one trusted backend deletion transaction that knows the full production schema, full deletion is handled as a verified privacy request.

## How Web starts a deletion request

Signed-in users can open:

`Settings → Security → Account deletion`

They can:

- review the canonical deletion-information page
- open a prefilled email request to `support@tefsen.com`

The email helper includes known account identity fields for convenience.

Nothing is sent automatically.

Tefsen may request additional information reasonably necessary to verify account ownership.

Users must never be asked to email:

- passwords
- one-time codes
- recovery codes
- Firebase tokens
- provider authentication secrets

## Canonical public deletion route

Canonical URL:

`https://www.tefsen.com/delete-account/`

Legacy:

`https://www.tefsen.com/delete-account.html`

The legacy path redirects to the canonical route so deletion instructions cannot drift between two public pages.

## Self-service public-content removal

Self-service actions are separate from full account deletion.

### Own post

A user can delete their own post.

For new Web post uploads, deterministic image slots are cleaned up after post deletion.

Historical/legacy media outside the deterministic Web slots may require trusted backend cleanup.

### Profile photo

A user can remove their own profile photo without deleting the account.

The public profile returns to initials.

## Google Play subscriptions

Tefsen account deletion and Google Play subscription cancellation are separate systems.

Deleting a Tefsen account does not automatically cancel a Google Play subscription.

Users who no longer want renewal charges should manage/cancel the subscription in Google Play.

## Privacy access and portability

The published Privacy Policy describes rights that may include access and portability depending on applicable law.

Tefsen Web Settings → Privacy provides prefilled email actions for:

- personal-data access request
- portable-data request

These open the user's email app and are not submitted automatically.

## Published policy alignment

The Privacy Policy and delete-account page must describe the same Web workflow:

- Settings does not claim instant full deletion
- deletion is a verified request
- self-service post/photo removal is separate
- Google Play cancellation is separate
- privacy requests can be sent to `support@tefsen.com`

Any material change to this workflow should update:

- `app/js/app.js`
- `app/js/services/privacy-request-service.js`
- `privacy-policy/index.html`
- `delete-account/index.html`
- this document
- regression tests

in the same reviewed change.
