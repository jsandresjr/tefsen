# Tefsen Web — Full Completion Master Plan

Tefsen Web is being finished as a product in small, testable milestones. We do not mark the website complete because one page looks better; each core student journey must work end-to-end.

## Completion sequence

1. **Opportunity catalogue bootstrap + remove dead-end empty state**
2. Opportunity search, filters, sorting and closing-soon views
3. Opportunity card information hierarchy and trust labels
4. Opportunity detail page completeness and source/freshness UX
5. Eligibility experience and explainable match results
6. Student Passport onboarding and first-run guidance
7. Student Passport form quality, validation and completion guidance
8. Home dashboard next-action logic and empty/new-user state
9. Saved opportunities experience
10. Journey list experience and deadline priority
11. Journey detail checklist/stage/planning polish
12. Post-acceptance journey foundation
13. Public profile final design and photo management
14. Other-student public profile and privacy review
15. Community home redesign and usefulness
16. Subject communities
17. University and intake communities
18. Success story publishing and reading experience
19. Journey story publishing and reading experience
20. Global search across students, opportunities and community
21. Notifications real data model and useful events
22. Private messaging decision + implementation or clean removal
23. Following/follower system implementation or clean removal
24. Saved community posts implementation
25. Settings, account controls and subscription polish
26. Admin opportunity review experience
27. Admin import/data-quality/freshness workflow
28. Public SEO scholarship routes
29. Public university and subject SEO routes
30. Landing page final conversion + trust pass
31. Mobile/tablet responsive pass across every route
32. Accessibility WCAG-oriented audit
33. Performance, CSS consolidation and code splitting
34. PWA/offline/update-state pass
35. App Check, abuse controls and production security review
36. Analytics/error diagnostics without private-data leakage
37. Automated browser E2E tests
38. Real-device/browser launch QA
39. Production opportunity data expansion and freshness operations
40. Final release audit and handoff

## Definition of complete

The Web product is complete only when a real student can:

**Sign in → build Student Passport → discover a real official-source opportunity → understand match/eligibility → save → start Journey → prepare tasks → track deadline → update outcome → optionally share a success story → manage privacy/profile**

without encountering dead ends, fake controls, disabled placeholder features, broken responsive layouts, or unclear trust/source states.

## Current progress

- Product direction / V2 shell: complete
- V3 global polish foundation: complete
- Profile V4 + profile-photo management: complete
- **Step 1: Opportunity catalogue bootstrap — complete on branch `tefsen-web-completion-01-opportunities`**
- Firestore-empty dead end removed
- 4 official-source starter opportunities added
- starter records are clearly labelled and source-dated
- dated starter records age out automatically
- live Firestore catalogue remains primary when published records exist
- starter detail pages resolve without relying on nonexistent Firestore documents
- service-worker cache updated for the starter catalogue

**Step 2: Opportunity search, filters, sorting and closing-soon views — complete on branch `tefsen-web-completion-02-opportunity-discovery`**
- live search across title, provider, university, country, subject and study level
- country, study level, funding and opportunity-type filters
- All / Closing Soon / Saved quick views
- Best Match / Deadline Soonest / A–Z sorting
- active filter chips + per-filter removal
- clear-all action + meaningful no-results state
- result counts update immediately
- filter/sort runs on already-loaded catalogue with no extra Firestore reads
- responsive mobile discovery controls
- service-worker cache bumped for the discovery UI

**Step 3: Opportunity card information hierarchy and trust labels — complete on branch `tefsen-web-completion-03-opportunity-cards`**
- provider and opportunity type promoted into clear card hierarchy
- funding, destination and study level separated from secondary tags
- Student Passport match signal separated from source verification
- profile-match score excludes source-verification bonus
- match reason text explains which profile factors align
- deadline urgency states: today / urgent / soon / watch / normal / varies / expired
- source trust states: official-source starter / verified / review soon / stale / unverified / preview
- source-check context and direct official-source link
- Saved / In Journey state visible without opening the detail page
- subject tags reduced to a scannable maximum with overflow count
- Save and View Opportunity actions simplified
- mobile card layout collapses signals cleanly
- source trust and deadline state remain independent
- service-worker cache bumped for new card UI

**Step 4: Opportunity detail page completeness and source/freshness UX — complete on branch `tefsen-web-completion-04-opportunity-detail`**
- rebuilt opportunity detail into a decision-oriented student page
- clear provider, funding, destination, study level, intake and audience facts
- structured nationality/country eligibility scope shown without assuming any default country
- separate profile-match and deadline decision signals
- detailed study-area, funding, eligibility, document and language sections
- source trust panel with provider, source-check context and official-source warning
- official source remains authoritative for eligibility, deadlines and funding
- sticky desktop action/source sidebar with mobile fallback
- Save / Start Journey integrated into the decision flow
- Student Passport completeness and structured eligibility comparison surfaced clearly
- country-specific opportunities remain scoped to their stored provider rules
- removed Sri Lanka-specific Student Passport placeholders from the core UI
- added `docs/GLOBAL_STUDENT_PRODUCT_RULES.md`
- service-worker cache bumped for the new detail experience

**Global product rule:** Tefsen is for students in every country. Nationality/current country are user profile data, never a platform default.

**Step 5: Eligibility experience and explainable match results — complete on branch `tefsen-web-completion-05-eligibility`**
- eligibility results use four explicit states: Meets / Action needed / Structured mismatch / Unknown
- overall outcome is descriptive, not a prediction of admission or scholarship success
- comparison coverage shows how much Tefsen can safely compare
- known-criteria match rate is explicitly labelled as not an acceptance probability
- Student Passport completeness remains separate from eligibility
- requirement rows include evidence/basis via “Why Tefsen says this”
- unknown and mismatch criteria identify when official-source verification is required
- next actions direct students to Student Passport or the official provider source
- document readiness is treated as preparation guidance, not an automatic eligibility blocker
- GPA scale mismatches remain unknown; Tefsen does not auto-convert grades
- nationality logic remains global and uses stored opportunity rules + Student Passport data only
- deterministic eligibility-engine tests added
- CI now runs when the eligibility engine changes
- service-worker cache bumped for the new eligibility experience

**Step 6: Student Passport onboarding and first-run guidance — complete on branch `tefsen-web-completion-06-passport-onboarding`**
- brand-new students are guided into Student Passport on first sign-in when no route is already selected
- existing useful Passport data is not forced back into onboarding
- completed and skipped onboarding states are persisted
- guided onboarding uses intro + three short data steps + completion state
- essential first-run fields: current country, nationality, current education level, target education level, main field and funding preference
- preferred destination countries and study goal remain optional during onboarding
- GPA, language tests, skills and document readiness are deferred to the full editor
- global-first copy explicitly says Tefsen does not assume a default country
- Student Passport privacy is explained before data entry
- Skip for now is supported and preserves partially entered data
- completion screen ends with “Your Tefsen journey is ready”
- completion CTAs lead to global opportunity discovery or the full Passport editor
- first-run detection regression tests added
- onboarding state resets safely on account change/logout
- responsive desktop/tablet/mobile onboarding design added
- service-worker cache bumped for the onboarding experience

**Step 7: Student Passport form quality, validation and completion guidance — complete on branch `tefsen-web-completion-07-passport-quality`**
- full Student Passport editor reorganized into Essentials / Academic profile / Preferences / Document readiness
- live completion guide shows section-by-section progress
- overall Passport completion is weighted toward essential profile data and explicitly separated from eligibility
- sticky desktop completion guide with responsive tablet/mobile fallback
- “Improve next” guidance prioritizes missing essential fields before recommended fields
- field helper text explains how Tefsen uses each value
- current country/nationality remain explicit user-entered global profile data
- GPA validation respects selected 4.0 or 5.0 scale
- impossible GPA values are blocked before save and normalized safely server-side
- Tefsen does not auto-convert GPA scales
- preferred countries, languages and skills are limited to 12 list items
- incomplete essential fields warn but do not block partial Passport saves
- live inline validation and save-state feedback added
- document readiness stays a private preparation tracker, not proof of eligibility
- completion score is described as profile completeness, not admission probability
- deterministic Passport quality tests added
- service-worker cache bumped for the editor redesign

**Step 8: Home dashboard next-action logic and empty/new-user state — complete on branch `tefsen-web-completion-08-home-next-actions`**
- Home now uses a deterministic next-action model instead of Passport-completeness gating
- action priority: urgent saved deadline → accepted next-stage planning → active Journey → incomplete Passport essentials → saved opportunity review → strongest profile match → global discovery
- terminal application outcomes do not surface stale original application deadlines
- multiple active Journeys use one consistent priority Journey across the primary action and Journey panel
- new/empty students get a three-step getting-started experience instead of a zero-heavy dashboard
- saved-but-not-started opportunities route back through opportunity review before Journey start
- Home cards show profile-based match only when meaningful; no source-verification bonus is presented as profile fit
- accepted students get a dedicated next-stage state
- dashboard explains why the recommended next action was chosen
- KPI strip uses softer empty states instead of emphasizing zeros
- opportunity discovery remains available even before full Passport completion
- global-first copy remains country-neutral
- responsive desktop/tablet/mobile Home redesign added
- deterministic Home next-action tests added
- CI now runs when the Home dashboard service changes
- service-worker cache bumped for the new Home experience

**Step 9: Saved opportunities experience — complete on branch `tefsen-web-completion-09-saved-opportunities`**
- saved-but-not-started opportunities now live in a dedicated decision workspace
- active Journeys are separated from simple bookmarks
- accepted / rejected / withdrawn outcomes are separated from both saved review and active applications
- saved cards show funding, destination, study level, profile-match context, deadline state and source trust
- saved deadlines sort by urgency while expired items remain visible for manual review
- expired saved items are clearly marked and never assumed to recur automatically
- students can compare up to 3 saved opportunities side-by-side
- comparison includes funding, destination, study level, profile match, deadline and source status
- private decision notes can be written before starting a Journey
- private decision notes survive when a saved opportunity becomes an active Journey
- saved-only records can be removed cleanly; started Journey history is never deleted by Remove saved
- remove confirmation warns when a private decision note will also be deleted
- unavailable/archived saved records remain removable even when the public opportunity record cannot be loaded
- unsaving from Opportunity cards now uses the same safe cleanup behavior
- owner-only Journey deletion is covered by Firestore rules tests
- deterministic saved-workspace grouping/comparison tests added
- CI now runs when the saved-workspace service changes
- responsive desktop/tablet/mobile saved decision workspace added
- service-worker cache bumped for the saved workspace

**Step 10: Journey list experience and deadline priority — complete on branch `tefsen-web-completion-10-journey-priority`**
- active application Journeys now use deterministic attention priority instead of a flat list
- priority is based on actionable dates, planning conflicts, checklist state and Journey stage
- official deadline today / within 3 / 7 / 14 days receives clear pre-submission attention states
- missed personal targets and personal targets after the official deadline are surfaced separately
- checklist progress and the next unfinished task are visible directly on active Journey cards
- ready-to-apply Journeys get a dedicated state when no more urgent deadline condition overrides it
- applied and interview/review stages no longer treat the old application deadline as a live action alert
- accepted / rejected / withdrawn records are separated into an outcomes section
- terminal outcomes never participate in active deadline ordering
- “Attention first” banner points to the highest-priority active Journey
- active Journey ordering is deterministic and explainable; no hidden success probability is used
- official deadline and private personal target remain visibly separate
- Journey list cards explain that provider sources remain authoritative for official dates
- deterministic Journey priority regression tests added
- CI now runs when the Journey priority service changes
- responsive desktop/tablet/mobile priority and outcome cards added
- service-worker cache bumped for the Journey priority model

**Step 11: Journey detail page and preparation workflow polish — complete on branch `tefsen-web-completion-11-journey-detail`**
- Journey detail page rebuilt around stage-aware guidance instead of a generic two-column form
- hero explains the current application phase and what to focus on now
- current stage, checklist completion and next unfinished task are visible immediately
- stage updates explicitly tell students to update only after the real application stage changes
- checklist separates unfinished and completed work and highlights the next task
- system-generated tasks remain distinguishable from private custom tasks
- stage-aware custom task prompts support preparation, submitted follow-up and interview/review work
- personal preparation target is editable only before submission
- personal target after the stored official deadline is blocked before save
- missing personal target remains optional and does not block saving
- applied/interview stages keep old targets only as historical context
- original application deadline is no longer shown as active urgency after submission
- official source trust/status is visible directly in the Journey detail page
- official provider source link is prominent when available
- missing source link shows a clear warning not to rely on Tefsen alone
- accepted stage includes explicit official visa/legal/admissions guidance disclaimer
- private notes remain editable across submitted and outcome stages
- private note character counter added
- Journey stage history redesigned as a clearer timeline
- deterministic Journey detail model and planning-validation tests added
- CI now runs when the Journey detail service changes
- responsive desktop/tablet/mobile Journey detail experience added
- service-worker cache bumped for the Journey detail workflow

**Step 12: Post-acceptance journey foundation — complete on branch `tefsen-web-completion-12-post-acceptance`**
- accepted Journeys now continue into a separate private next-stage workspace instead of ending as a dead-end outcome
- the original application checklist becomes read-only after accepted / rejected / withdrawn outcomes
- accepted Journeys keep the completed application record separate from post-acceptance planning
- post-acceptance planning tracks a private offer decision without pretending to be provider status
- optional offer-response and enrollment dates can be stored only when the student has real provider dates
- missing dates are never invented by Tefsen
- stored offer-response dates receive deterministic attention states for passed / today / within 3 / within 7 days
- the default next-stage plan covers offer conditions, funding/fees, enrollment, visa/immigration verification when applicable, and arrival preparation
- all suggested next-stage tasks explicitly require provider or official-authority verification
- custom next-stage tasks can be added and removed privately
- suggested system next-stage tasks cannot be deleted accidentally; they can be completed when verified or no longer relevant
- offer accepted / offer declined remain private student planning decisions and do not rewrite the provider acceptance history
- Tefsen explicitly states that it is not an admissions authority and does not provide visa, immigration or legal advice
- provider and relevant government sources remain authoritative
- deterministic post-acceptance model and validation tests added
- accepted Journey detail regression test confirms the separate next-stage plan
- CI now runs when post-acceptance service/view files change
- responsive desktop/tablet/mobile post-acceptance workspace added
- service-worker cache bumped to V39 and includes the post-acceptance model/view

**Next: Step 13 — Public profile final design and photo management**
