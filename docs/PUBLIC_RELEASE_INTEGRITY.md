# Tefsen Web Public Release Integrity

Step 39 defines the static release contract for the public Tefsen website and authenticated Web entry point.

## Canonical public routes

The indexable public surface is:

- `https://www.tefsen.com/`
- `https://www.tefsen.com/founder.html`
- `https://www.tefsen.com/privacy-policy/`
- `https://www.tefsen.com/terms.html`
- `https://www.tefsen.com/delete-account/`

These are the only URLs that belong in `sitemap.xml`.

## Legacy redirects

These routes remain for compatibility only:

- `/privacy.html` → `/privacy-policy/`
- `/delete-account.html` → `/delete-account/`

Legacy redirect URLs must not appear in the sitemap and normal navigation should link directly to the canonical destination.

## Authenticated app indexing

The authenticated Web app is:

`https://www.tefsen.com/app/`

It intentionally includes:

`<meta name="robots" content="noindex,follow">`

The app is a signed-in application surface, not an SEO landing page.

Therefore:

- `/app/` must not be listed in the public sitemap
- public marketing pages may link to it
- crawlers may follow links into it, but the document requests no indexing

If product strategy later changes and public app pages become indexable, update the sitemap and robots metadata together in one reviewed change.

## Custom domain

`CNAME` must remain:

`www.tefsen.com`

`robots.txt` must continue pointing to:

`https://www.tefsen.com/sitemap.xml`

## Firebase runtime readiness

The checked-in Firebase Web configuration is public client configuration and must contain the real Web app identifiers rather than `PASTE_` placeholders.

Production release checks verify:

- apiKey is populated
- authDomain is populated
- projectId is populated
- storageBucket is populated
- messagingSenderId is populated
- appId is populated
- `TEFSEN_FORCE_DEMO_MODE = false`

The expected Firebase project ID is currently:

`tefsen-fa2b5`

A change to a different Firebase project should be treated as a deliberate infrastructure migration and reviewed accordingly.

## App Check external readiness

The repository currently leaves:

`TEFSEN_APPCHECK_SITE_KEY = ""`

This is intentional until the Web reCAPTCHA v3 App Check provider is configured in Firebase Console.

An empty App Check key is **not** proof of enforcement.

Before enabling App Check enforcement in Firebase Console:

1. register/configure the Web provider
2. add the public site key
3. deploy the static Web update
4. validate legitimate Web traffic
5. verify App Check metrics
6. enable enforcement service-by-service only after valid traffic is confirmed

Step 39 treats this as an external release dependency, not something to fake in source code.

## Static asset integrity

CI validates that critical public and authenticated entry assets exist, including:

- homepage HTML/CSS/JS
- founder page
- Terms
- Privacy Policy
- deletion page
- app entry point
- Firebase config
- manifest
- service worker
- logo assets

The manifest's local icon paths must resolve to repository files.

## Canonical-link integrity

CI checks that:

- sitemap pages expose the expected canonical URL
- redirect pages expose the destination canonical
- normal navigation does not route through legacy redirect pages
- the noindex authenticated app is absent from the sitemap

## PWA versioning

Step 39 uses:

`tefsen-web-shell-v65-public-release-integrity`

Any future change to cached `app.js`, `index.html`, CSS, service modules or service-worker behavior should continue to bump the PWA shell version.

## Final Step 40 handoff

Step 39 is the final automated static-release gate before Step 40.

Step 40 should not invent missing external infrastructure. It should report, explicitly and separately:

- repository checks that are complete
- PR/CI status
- external Firebase Console actions still required
- production Firebase rule-deployment parity status
- App Check readiness
- any deployment verification that cannot be proven from source alone
