# Tefsen Web PWA & Document Security

The authenticated Tefsen Web app is served from:

`https://www.tefsen.com/app/`

GitHub Pages serves the static files, so Tefsen cannot rely on custom application-server response headers from this repository.

## Content Security Policy

`app/index.html` defines a document-level Content Security Policy with a `<meta http-equiv="Content-Security-Policy">` element.

The policy is intentionally limited to:

- same-origin application scripts/assets
- Firebase SDK modules from `www.gstatic.com`
- Google auth bootstrap from `apis.google.com`
- Google/reCAPTCHA origins required by Firebase Auth/App Check
- Firebase/Google API connection origins
- public HTTPS images
- same-origin workers/manifest

The policy explicitly blocks:

- arbitrary script origins
- inline JavaScript
- `eval`-style script execution
- plugin/object content
- unexpected form destinations

Inline CSS remains allowed because the current Tefsen UI still uses inline style attributes in several rendered components.

### GitHub Pages limitation

A meta CSP is useful but is not equivalent to a full set of HTTP response security headers.

For example, this repository cannot enforce server response headers such as all possible framing/cross-origin policies through GitHub Pages alone.

If Tefsen later moves behind a hosting layer that supports custom response headers, migrate the CSP to a response header and add the appropriate platform security headers there.

## Firebase runtime configuration

`app/js/config/firebase-config.js` is public Web client configuration.

It is not a secret, but it is operational runtime configuration and can change independently from the offline application shell.

The service worker therefore treats it as **network-only**:

- it is not pre-cached
- it is fetched with `cache: "no-store"`
- service-worker fallback does not serve a stale cached copy

If the config cannot load while offline, Firebase initialization may not be available for that session. This is preferable to silently using an old App Check/provider configuration.

Never put service-account credentials or private keys in this file.

## Navigation fallback

The service worker may use cached `app/index.html` only for document/navigation requests.

It must not return HTML as a fallback for failed:

- JavaScript modules
- CSS
- images
- manifests
- other static assets

Static asset requests use exact-request cache fallback only.

This prevents a failed `.js` or `.css` request from receiving HTML with HTTP 200 semantics and producing confusing runtime/cache corruption.

## Static asset caching

Same-origin static assets use network-first behavior.

A response is added to the runtime cache only when it is:

- successful
- same-origin/basic

On network failure, only an exact cached response for that request is used.

Unknown/unavailable static assets fail instead of falling back to the app document.

## Offline startup shell

The explicit shell includes the application entry point and required local startup modules, including:

- `app.js`
- `trial-ui.js`
- `firebase-client.js`
- `auth-service.js`
- `account-bootstrap-service.js`
- `data-service.js`
- demo data required by the service layer
- opportunity demo data
- canonical UI/service modules

Firebase runtime config is intentionally excluded.

## Service-worker versioning

Any change that alters:

- cached application assets
- startup modules
- fetch/fallback behavior
- runtime config handling

must bump the service-worker cache version.

Step 35 uses:

`tefsen-web-shell-v61-pwa-document-security`

Older Tefsen shell caches are deleted during service-worker activation.

## Regression requirements

CI must continue proving that:

1. Firebase runtime config is absent from the offline shell.
2. runtime config is fetched network-only.
3. HTML fallback exists only in the navigation path.
4. static asset fallback uses exact cache keys.
5. the CSP does not permit inline/eval JavaScript.
6. required Firebase/Google origins remain explicitly listed.
7. direct startup modules remain present in the shell.
