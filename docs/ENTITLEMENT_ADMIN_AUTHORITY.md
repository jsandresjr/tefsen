# Tefsen Web Entitlement & Admin Authority

Tefsen Web has two different concepts that must not be conflated:

1. **administrative authorization**
2. **student subscription entitlement**

They come from different trusted sources.

## Administrative authorization

Real Firebase-mode admin capability is derived from Firebase Auth ID-token custom claims.

The Web app uses:

- `claims.admin === true`
- or a trusted custom `claims.role === "ADMIN"`

through the existing admin-capability service.

A private user document field such as:

`users/{uid}.role`

may still exist for legacy/display compatibility, but it is **not** an authorization source for:

- Admin navigation
- Admin opportunity review
- Community moderation
- deleting another student's post
- bypassing student posting limits
- viewing otherwise non-public student stories
- displaying Admin Full Access in account/subscription UI

The authenticated custom claim controls those behaviors.

Hard-coded email addresses must never grant admin capability.

## Demo mode

Demo mode is not a production authorization boundary.

It may simulate an ADMIN profile so the preview can expose admin UI.

Firebase mode must always use trusted token claims.

## Subscription entitlement

Student Plus entitlement is read from the private account subscription state populated by Tefsen's trusted billing/backend synchronization.

The Web owner cannot update subscription fields through the owner profile rule.

Subscription state may affect Web product limits such as:

- daily text-post allowance
- daily image-post allowance
- images per post
- per-post image-byte limit

The subscription field is not an admin authorization mechanism.

## Posting policy

`getWebPostingPolicy(profile, { admin })`

requires the caller to pass the trusted admin capability explicitly.

The policy must not infer admin from:

- profile.role
- email
- username
- public profile data

When the caller has no trusted admin capability, a profile role of ADMIN alone must not produce Admin Full Access.

## Profile editing

Editing a public profile updates only presentation fields in the private account document:

- fullName
- displayName
- username
- bio
- profileImageUrl
- photoURL
- updatedAt

The profile editor must not write:

- uid
- email
- role
- verified status
- subscription state
- billing/admin fields

This keeps profile editing compatible with the strict owner-update Firestore rule.

## Google Play billing authority

Tefsen Web does not process Google Play Billing directly.

The Web subscription page may:

- show the current synchronized entitlement state
- show current Web posting limits
- link to Tefsen on Google Play
- link to Google Play subscription management

The Web page must not hard-code a price, trial length, or promotion as if it were authoritative.

Google Play is the authority for:

- current localized price
- taxes
- free-trial eligibility
- introductory/promotional offers
- renewal terms
- cancellation terms

If Google Play changes an offer, Web should not need a code deployment merely to stop displaying stale pricing.

## Removed trial overlay

Step 36 removed the old `app/js/trial-ui.js` DOM patch.

That patch hard-coded:

- a 3-day trial
- USD 2.99/month

and rewrote the subscription page after render.

It must not return unless pricing/promotion data is supplied from a trusted, current billing source rather than hard-coded client constants.

## Regression expectations

CI should continue proving:

1. no email-derived admin capability exists
2. Web posting policy receives explicit admin capability
3. profile edits cannot write role/email/admin fields
4. Settings admin state uses trusted capability
5. subscription UI contains no fixed dollar price or trial duration
6. the legacy trial patch remains deleted/unloaded
7. the service worker does not cache the deleted patch
