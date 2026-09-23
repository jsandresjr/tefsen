# Tefsen Web ↔ Android parity audit

Status: Stage 0 audit based on the current `main` web source and the Android screenshots/requirements supplied by the product owner. No production runtime changes are included in this stage.

## Source-of-truth rule

The existing Firebase data model and working web code remain authoritative for anything that is already implemented. Android source files, Firestore rules, Cloud Functions source, FCM token schema, and verification/admin backend code are not present in this repository at the time of this audit. Those items are therefore marked **Blocked / needs source verification** rather than guessed.

The web app is a plain JavaScript/Firebase PWA under `/app/`. It currently loads several UI layers (`app.css`, `premium.css`, `premium-v2.css`, `android-parity.css`, `web-polish.css` plus multiple UI scripts). Previous mobile regressions showed that replacing or stacking large override layers is risky. Future visual work must be incremental and tested route-by-route.

## Current architecture

- Public site: repository root (`index.html`, root CSS/JS).
- Web app: `/app/`.
- App shell/runtime: `app/js/app.js`.
- Firebase initialization: `app/js/firebase-client.js`.
- Authentication: `app/js/services/auth-service.js`.
- Firestore/storage mapping: `app/js/services/data-service.js` and `app/js/config/schema.js`.
- PWA: `app/manifest.webmanifest` and `app/sw.js`.
- Existing UI enhancement layers: `android-parity.*`, `web-polish.*`, `premium*`.

## Feature-parity checklist

Legend: ✅ implemented, 🟡 partial/UI exists but incomplete, ❌ missing/disabled, ⛔ blocked until Android/backend source is verified.

| Area | Android/product requirement | Current web implementation | Status | Required work |
|---|---|---|---|---|
| Auth | Email/password sign-in | Firebase email/password is implemented | ✅ | Regression test on mobile + desktop |
| Auth | Registration | Firebase account creation + user document sync | ✅ | Validate role defaults and duplicate username policy |
| Auth | Google sign-in | `GoogleAuthProvider` + popup + user document sync | ✅ | Verify Firebase authorized domains and mobile popup behavior |
| Auth | Password reset | Firebase reset email | ✅ | Improve recovery UX and error text |
| Auth | Username sign-in/recovery | No verified implementation in current auth service | ❌ | Requires confirmed username index/schema and secure lookup |
| Auth | Session restoration/sign-out | Firebase auth observer and sign-out exist | ✅ | Test PWA relaunch/session expiry |
| Guest | Guest exploration | Demo mode exists, but is not the same as production public guest permissions | 🟡 | Define allowed public reads from real rules before enabling |
| Profiles | Profile view/edit | Profile UI + update path exist | 🟡 | Verify photo upload, school/university fields, badges, full contribution history |
| People | Follow/unfollow | `toggleFollow()` explicitly throws “not enabled” | ❌ | Implement only after confirming Android relationship schema/rules |
| Search | Posts + people search | `searchAll()` exists and web has search results | 🟡 | Test @ handling, dots/underscores, partial/case-insensitive people lookup, users with zero posts |
| Feed | Latest | Core feed supports latest | ✅ | Add pagination/refresh tests |
| Feed | Trending | Core feed has trending scoring | ✅ | Compare ranking semantics with Android |
| Feed | For You | Added via enhancement layer, client-side approximation | 🟡 | Confirm Android recommendation logic before claiming parity |
| Feed | Unanswered | Added client-side using answer/comment count | 🟡 | Confirm exact Android definition and stale-count behavior |
| Feed | Following | UI exists, backend following is disabled | ❌ | Block until relationships are implemented |
| Feed | Saved | Save button/UI exists, but `toggleSave()` explicitly throws | ❌ | Implement after schema confirmation |
| Feed | Liked | Like state is implemented with Firestore/local reconciliation | ✅ | Verify Android vote/like distinction |
| Questions | Create question | Firebase post creation exists with title/body/subject/tags/images | ✅ | Convert all user-facing wording to question-first; add draft/retry safety |
| Publishing | Duplicate prevention | Submit button is disabled during request, but no stable idempotency key/retry protocol is verified | 🟡 | Add draft submission ID + idempotent persistence after backend compatibility review |
| Publishing | Image limits | Web policy currently supports 1–2 images depending on entitlement | 🟡 | Confirm real Android/account limits before changing |
| Publishing | Image optimization | No verified academic-detail-aware compression pipeline | ❌ | Add client preprocessing only after quality/limit requirements are confirmed |
| Galleries | Multi-image display | Normalization and UI currently cap to two images | 🟡 | Support actual existing formats and full gallery after schema audit |
| Post detail | Shared route `/app/#/post/{id}` | Existing route is used by copy-share behavior | ✅ | Preserve permanently; add redirect tests |
| Answers | Add/list answers | Implemented via comments/answers collection mapping | ✅ | Verify accepted answer and vote semantics |
| Accepted answers | Accepted/solved controls | Not verified in current web source | ⛔ | Requires Android/backend source and rules |
| Likes | Like button/counter | Implemented | ✅ | Confirm whether Android also has separate voting |
| Saves | Saved learning | Backend disabled | ❌ | Needs compatible schema/rules |
| Sharing | Copy link | Implemented | ✅ | Expand to six requested targets + native share fallback |
| Sharing | WhatsApp/Telegram/Messenger/Email/More | Not implemented | ❌ | Safe frontend feature; can be Stage 1 |
| Reports | Report post | Report flow exists | 🟡 | Verify admin review destination/status schema |
| Notifications | In-app center UI | UI exists, but `getNotifications()` returns `[]` and mark-read is a no-op | ❌ | Implement after notification collection/schema verification |
| Browser push | FCM/web push | Not present | ⛔ | Needs FCM token schema, service worker strategy, functions source and coordinated Android migration |
| Messages | Private messages | UI remnants exist, backend functions return empty/throw disabled | ❌ | Keep hidden unless product explicitly reintroduces it; requirement says not to invent unrelated features |
| Study | Study Hub | Visual/client additions exist in enhancement code, but data parity is not verified | 🟡 | Rebuild against real activity fields after Android source review |
| Study | Weekly goal/stats | Client derives some values from available counts | 🟡 | Confirm Android source of truth and device-local vs server data |
| Study | Practice sessions | No verified real question/answer practice engine in core web | ❌ | Implement only from existing Android behavior/data |
| Reputation | Leaderboard | Web data service has leaderboard support | 🟡 | Verify eligibility threshold and role/privacy rules |
| Reputation | Badges/achievements | Some profile UI exists; complete logic not verified | 🟡 | Map exact Android achievement definitions |
| Verification | HS/University flows | Not verified in current web repository | ⛔ | Requires Android/backend sources and evidence-security rules |
| Plus | Subscription status | Profile normalization and web posting policy read subscription-like fields; Google Play management links exist | 🟡 | Verify server-verified entitlement source; never trust browser-only flags |
| Settings | Appearance/default feed/learning/notifications/support/privacy/delete | Partial settings UI exists; complete Android parity not verified | 🟡 | Build settings matrix from Android source |
| Admin | Verification/reports/support/deletion/moderation/audit | Complete secure admin workspace not present in current web source | ⛔ | Requires Cloud Functions/rules/admin authorization source before implementation |
| Accessibility | Keyboard/focus/dialog labels | Some semantic attributes exist | 🟡 | Full keyboard, focus, contrast, reduced-motion, enlarged-text audit |
| PWA | Installable manifest/service worker | Implemented | ✅ | Improve offline state and cache-update messaging; never imply Firebase writes succeeded offline |
| Themes | Dark + light | Enhancement layer includes theme behavior | 🟡 | Consolidate into one tested design system instead of competing overrides |

## Critical findings

### 1. Do not treat visible UI as working parity

Several controls are currently visible even though their data-service functions are disabled. Examples include Saved, Following, Notifications and Messages. These should not be presented as completed features until the backend/data model supports them.

### 2. Notifications are currently a shell

`getNotifications()` returns an empty array and `markNotificationRead()` is effectively a no-op. Browser push cannot be safely implemented until the Android notification token schema and Cloud Functions are available.

### 3. Following and Saved are explicitly disabled

`toggleFollow()` and `toggleSave()` throw errors stating those features are not enabled in the current data model. A web-only schema must not be invented because that could split Android and web data.

### 4. Current web UI has too many runtime styling layers

The app shell currently loads multiple CSS/JS enhancement layers. This made earlier “big redesign” attempts fragile. The redesign should move toward a single design-system layer only after each legacy behavior is mapped and regression-tested.

### 5. Publishing works, but reliability needs stronger guarantees

The form disables its submit button during a request, but the requested stable submission identifier/idempotent retry behavior is not verified. That should be implemented with backend-compatible document creation semantics, not only a visual disabled button.

### 6. The current image model is capped in web normalization

The web normalizer and detail UI currently slice image arrays to two images. Increasing the gallery limit must first confirm legacy Android field names, account limits and Firebase Storage/security behavior.

### 7. Sharing is safe to improve first

The current Share action copies `/app/#/post/{id}`. Expanding this to WhatsApp, Telegram, Messenger, Email, Copy link and browser-native More can be done without changing Firestore and is a good first production feature once visually tested.

## Required missing source before backend parity work

Do not guess these items:

1. Android application source for feed modes, accepted answers, Study Hub/practice, settings, verification and subscription behavior.
2. Firestore security rules currently deployed to production.
3. Firebase Storage rules.
4. Cloud Functions source and deployment regions.
5. Current notification document schema and Android FCM token storage format.
6. Follow/saved relationship schema if it exists outside this web repository.
7. Verification evidence schema and admin authorization mechanism.
8. Subscription entitlement verification path used by Android.

## Design system target

Use the supplied visual direction as the target, but implement it progressively:

- Background `#030E12`
- Elevated surface `#0B1E23`
- Cyan `#00BDE2`
- Mint `#22F4A6`
- Main light text `#EAFDFA`
- Restrained achievement/Plus gold `#E7C568`
- Equal-quality light theme
- Reading column: roughly 680–760px on desktop
- Mobile primary navigation: Home / Alerts / Ask / Study / Profile
- No oversized decorative hero inside the signed-in feed
- No horizontal page scrolling
- Cards sized for reading, not dashboard decoration

## Implementation stages

### Stage 1 — Low-risk UX and navigation cleanup

No Firebase schema changes.

- Add six-option share sheet while preserving `/app/#/post/{id}`.
- Hide or clearly mark controls whose backend functions are disabled.
- Normalize question-first wording in composer and feed.
- Fix mobile overflow, safe-area spacing, clipped controls and long excerpts using minimal scoped CSS changes.
- Add explicit loading/retry/empty states where core reads already expose errors.
- Add a manual route test checklist for Home, post detail, Ask, Alerts, Study, Profile, Search, Settings and auth.

### Stage 2 — Search and profile correctness

No schema migration unless Android source proves one is required.

- Make People and Posts results separate and explicit.
- Verify @ stripping, case-insensitive username matching, valid dots/underscores and partial matching.
- Ensure people search does not depend on a user having posts.
- Complete profile fields that are already stored by Android.

### Stage 3 — Publishing reliability and galleries

Requires exact Android image limits/formats and rule review.

- Draft recovery.
- Stable submission identifier.
- Idempotent retry-safe persistence.
- Upload progress/cancel/recoverable failures.
- Compatible multi-image gallery + fullscreen viewer.

### Stage 4 — Relationships and saved learning

Blocked until the existing Android relationship/saved schema is supplied or confirmed absent.

- Follow/unfollow.
- Following feed.
- Saved posts.
- Continue Learning based on real saved records.

### Stage 5 — Study parity

Blocked until Android Study Hub/practice source is supplied.

- Weekly goal source of truth.
- Asked/answered/solved/accepted stats.
- Subject activity.
- Practice filters, reveal, review, session results, streak/progress.

### Stage 6 — Notifications + browser push

Blocked until FCM schema/functions are supplied.

- Real in-app notification reads/read-state/navigation.
- Web FCM token registration without overwriting Android tokens.
- Token refresh/invalidation.
- Contextual permission request.
- Service-worker push handling and fallback center.

### Stage 7 — Verification, Plus and admin

Blocked until trusted backend sources are supplied.

- HS/university verification workflows.
- Server-verified Plus status and usage limits.
- Admin review workspace and moderation actions.
- Audit history and server-side authorization checks.

## Testing gates before any production merge

Every runtime PR must pass these checks before merging to `main`:

1. Sign in with email/password.
2. Google sign-in on desktop and mobile browser.
3. Session reload and sign-out.
4. Home feed loads with no console-blocking exception.
5. Open a shared `/app/#/post/{id}` link directly.
6. Open and close the Ask composer.
7. Publish a test question only in a safe test account/environment; do not create duplicate production content.
8. Open a profile from a post.
9. Search posts and people.
10. Like/unlike and verify the count after refresh.
11. Verify disabled/blocked features do not masquerade as successful actions.
12. Check 360px, 390px, 430px, tablet and desktop widths.
13. Check no horizontal page scroll and bottom navigation does not cover content.
14. Keyboard-only navigation and visible focus.
15. PWA reload/update behavior.

## Stage 0 result

The correct next move is **not another full UI overwrite**. Preserve the currently working app, implement Stage 1 in a small branch, test the actual routes, then merge only after visual verification. Backend parity features remain blocked until the missing Android/Firebase sources are available.
