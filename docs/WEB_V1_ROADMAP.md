# Tefsen Web V1 Roadmap

## Product direction

Tefsen Web is evolving from a general social education network into a student opportunity and education journey platform.

Core journey:

**Discover → Understand → Prepare → Apply → Progress → Travel/Study → Career → Help the next student**

The existing community, profiles, authentication, posts, answers and Firebase integration should be preserved and reused rather than rewritten.

## Current web architecture

- Static GitHub Pages deployment from the repository root
- Authenticated web app under `/app/`
- Plain HTML, CSS and ES modules
- Firebase Authentication, Firestore, Storage and App Check support
- Existing user profiles and community post/answer system
- Existing Android-parity compatibility work

## Milestone 1 — Opportunities foundation

Status: **Implemented on `tefsen-web-v1`**

- Added `Opportunities` navigation
- Added opportunity catalogue route
- Added opportunity detail route
- Added normalized opportunity data service
- Added Firestore collection mapping
- Added clearly labelled preview data for demo mode
- Added responsive opportunity UI
- Updated public homepage positioning around student opportunities and journeys
- No production opportunity data was written
- No production Firebase rules were changed

## Milestone 2 — Student Passport

Status: **Implemented on `tefsen-web-v1` (production security-rule deployment still required)**

- Extend existing user profile safely
- Current country and nationality
- Current and target education level
- Main field/subject
- Preferred countries
- Funding preference
- English-test status
- Skills and goals
- Document-readiness statuses only
- Profile completeness
- Private-by-default fields

## Milestone 3 — Eligibility and matching

Status: **Implemented on `tefsen-web-v1` for structured matching and explainable eligibility checks**

- Rule-based "Can I Apply?" checks
- Explainable matches and gaps
- Unknown/verify-officially state
- No generative-AI eligibility decisions
- Opportunity recommendations based on structured Student Passport fields

## Milestone 4 — Save, deadlines and application journey

Status: **Implemented on `tefsen-web-journey-v1` (production journey security rules still required)**

- Save opportunity
- Personal status
- Preparation checklist
- Deadline tracking
- Journey stages from interested to accepted/rejected
- Private notes and progress

## Milestone 5 — Success stories and communities

Status: **Implemented on `tefsen-web-communities-v1` using explicit public post metadata and aggregated community pages**

- Scholarship/university success post type
- Public journey milestones as explicit opt-in
- Subject communities
- University/intake communities
- Student questions and answers
- Strong privacy separation between private journey data and public posts

## Milestone 6 — Trust, admin and launch hardening

Status: **Implemented on `tefsen-web-launch-v1`; production launch remains blocked by external Firebase configuration/tests listed in the launch checklist**

- Verified/pending/stale opportunity states
- Admin opportunity review
- CSV/JSON import preview
- Opportunity freshness checks
- Security rules and emulator tests
- App Check review
- Performance/accessibility pass
- Production deployment checklist

## Trust principles

1. The official provider source remains authoritative.
2. Missing opportunity data must never be invented.
3. Community-submitted opportunities are not automatically verified.
4. Private student journey data is private by default.
5. AI may explain information but must not silently replace structured eligibility logic.
6. Existing Tefsen accounts and community data must remain backward-compatible.
