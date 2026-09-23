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

**Step 13: Public profile final design and photo management — complete on branch `tefsen-web-completion-13-public-profile`**
- public profile rebuilt around student identity instead of private dashboard metrics
- profile photo changed from a heavy circular frame to a cleaner editorial avatar treatment
- add / change / remove photo controls are directly visible on the owner profile
- selected profile photos are clearly labelled as preview-only until Save
- JPG / PNG / WebP and 5 MB photo limits remain enforced
- public name, username, bio and photo are visually separated from private Student Passport and application data
- own Student Passport / saved opportunities / active Journeys moved into a distinct Private Workspace section
- other students never receive the owner-only private workspace model
- public profile completeness tracks only name / username / bio / photo and explicitly states it is not an admission or reputation score
- missing username or bio gives guidance without blocking profile save
- invalid public name / username / bio is blocked in both UI validation and data-service persistence
- username supports letters, numbers, dots, underscores and hyphens
- bio character count and inline validation added
- public activity empty state no longer encourages filler posting
- profile editor explicitly labels which fields are public and which student data remains private
- deterministic public-profile model and validation tests added
- responsive desktop / tablet / mobile profile redesign added
- CI now runs when profile service or final profile CSS changes
- service-worker cache bumped to V40 and includes the public-profile model

**Step 14: Other-student public profile and privacy review — complete on branch `tefsen-web-completion-14-public-profile-privacy`**
- non-owner profile reads now pass through an explicit public-user whitelist instead of retaining the raw user document in the web profile object
- public projection includes only uid, public name, username, bio, photo, role, verification marker, public points and aggregate public counters
- email, subscription metadata, Student Passport, saved opportunities, Journey data and private notes are not included in the visitor profile object
- people search and leaderboard user results now use the same public projection
- post/answer author enrichment now receives only the projected public-user shape
- other-student profiles no longer show Follow or Message controls while those features are intentionally unimplemented
- visitor action now moves directly to that student’s public activity instead of triggering a guaranteed error
- follower/following counts are no longer presented as usable social features on the public profile surface
- profile activity is defensively limited to published + public records
- legacy demo posts remain visible for preview compatibility when status/visibility flags are absent
- visitor privacy notice explicitly lists what is public and what is not part of the public profile
- public/private projection, capabilities and activity-filter regression tests added
- production network-level field isolation for legacy `users/{uid}` reads is not falsely claimed here; the production Firestore rules/data-model review is explicitly part of Step 35
- responsive visitor-profile privacy polish added
- service-worker cache bumped to V41

**Step 15: Community home redesign and usefulness — complete on branch `tefsen-web-completion-15-community-home`**
- Community home rebuilt around student purpose instead of three undifferentiated data sections
- primary actions now clearly separate asking/sharing knowledge from success and Journey story publishing
- main Community feed is discussion-first so ordinary student questions and explanations are not buried under outcome stories
- discussion ordering uses public replies, saves and likes and explicitly says it is not a quality or accuracy score
- hidden/private posts are excluded from the Community home model
- a dedicated “Needs a response” section surfaces public discussions with zero replies
- students are prompted to respond only when they genuinely know something useful
- subject discovery remains a lightweight home preview; deeper subject-community work stays in Step 16
- university discovery remains a lightweight home preview; deeper university/intake work stays in Step 17
- student outcomes are separated into their own “Experiences, not promises” section
- outcome copy explicitly states that student stories do not prove current eligibility, funding or admission requirements
- Community summary shows public discussions, subject spaces, university spaces and shared outcomes
- no country is treated as a platform default
- deterministic Community home model and regression tests added
- desktop/tablet/mobile Community home redesign added
- CI now runs when Community service or Community CSS changes
- service-worker cache bumped to V42

**Step 16: Subject communities — complete on branch `tefsen-web-completion-16-subject-communities`**
- subject pages rebuilt as focused public learning spaces instead of one mixed feed with a small opportunity sidebar
- subject-community model applies public-only filtering before counts, ranking or grouping
- hidden/private posts and unrelated subjects are excluded from subject pages
- ordinary discussions are separated from success and Journey stories
- zero-reply subject discussions receive a dedicated “Needs a response” area
- subject discussion ordering uses public replies, saves and likes and explicitly states it is not a quality or accuracy score
- subject hero clearly explains the space is for questions, explanations, study methods, useful learning context and voluntary student experiences
- public-posting safety copy reminds students not to publish application IDs, identity documents, addresses or private Journey details
- linked opportunities are separated into discovery cards with destination, study level, intake and funding context when available
- linked opportunity copy explicitly says official provider sources remain authoritative for eligibility, funding, deadlines and application requirements
- unique linked universities, destinations and funding types are derived without assuming any default country
- subject pages connect to university spaces without attempting the deeper university/intake redesign reserved for Step 17
- student outcomes are presented as experiences, not evidence that the same result or requirements apply to another student
- deterministic subject-community regression tests added
- desktop/tablet/mobile subject-community redesign added
- service-worker cache bumped to V43

**Step 17: University and intake communities — complete on branch `tefsen-web-completion-17-university-intake-communities`**
- university pages rebuilt as public student spaces instead of one mixed feed with generic intake/opportunity sidebars
- university-community model filters to public activity before counts, grouping or ranking
- hidden/private posts and posts from other universities are excluded
- university discussions, unanswered questions and voluntary outcome stories are separated
- university discussion ordering uses public replies, saves and likes and explicitly states it is not a quality or accuracy score
- intake spaces are derived from public posts and exact stored opportunity intake labels
- intake cards show discussion, outcome and exact intake-opportunity counts
- linked subjects, countries and funding types are derived from stored public/opportunity data without assuming a default country
- university pages clearly state they are not official university channels
- admissions, fees, funding, deadlines, visas and enrollment requirements are explicitly delegated to official institution/provider sources
- intake pages now have their own public-only model and exclude other intakes
- opportunities carrying the selected intake label are separated from university-wide opportunities with no intake value
- opportunities with no intake value are never presented as exact intake matches
- intake pages explain that private Tefsen Journey data is not imported or exposed
- intake privacy guidance blocks publication of application IDs, passport/visa numbers, booking references, exact addresses and private documents
- university and intake outcomes are presented as voluntary experiences, not guarantees or current official requirements
- deterministic university/intake regression tests added
- desktop/tablet/mobile university and intake redesign added
- service-worker cache bumped to V44

**Step 18: Success story publishing and reading experience — complete on branch `tefsen-web-completion-18-success-stories`**
- dedicated success-story validation/model service added instead of keeping publishing rules only inside UI handlers
- required institution, scholarship/program/offer and subject fields are validated before publishing
- success narrative requires useful minimum context instead of accepting near-empty outcome posts
- headline falls back safely to the opportunity name when omitted
- supported funding labels are normalized before storage
- obvious sensitive-identifier phrases such as application IDs, passport/visa numbers, booking references, financial account/card numbers, identity numbers and home/residential addresses are blocked before publishing
- sensitive-text detection is explicitly a heuristic safety layer, not comprehensive data-loss prevention; students are still instructed to review public content before publishing
- data-service enforces the same success-story validation as a defense-in-depth check before writes
- success publishing UI now explains what happened / useful context / private-data boundaries before the form
- public-story warning explains that structured facts and narrative may appear across matching Community/subject/university/intake surfaces
- success-story feed previews are compact instead of rendering every structured fact and full trust banner in ordinary post cards
- success-story posts now open a dedicated reader instead of the generic discussion detail layout
- dedicated reader separates author, outcome facts, narrative, context navigation, trust guidance and community replies
- reader links back to matching subject, university and intake community spaces when those public context fields exist
- reader explicitly states that a student outcome is not proof of current eligibility, funding, admission requirements or future outcomes
- reader delegates current scholarship/university/funding/deadline/visa/enrollment requirements to official provider or institution sources
- reader explains that private Tefsen Journey data and private documents are not part of the public story
- non-public success stories are blocked at the app reader layer for non-owners/non-admins; production network-level enforcement remains part of Step 35
- dedicated Success-story regression tests added
- desktop/tablet/mobile publishing and reader redesign added
- CI now watches the success-story and data-service paths
- service-worker cache bumped to V45

**Step 19: Journey story publishing and reading experience — complete on branch `tefsen-web-completion-19-journey-stories`**
- dedicated Journey-story validation/reader service added
- Journey-story form continues to start from explicit public fields and does not read private Journey checklists, notes, target dates, stage history or post-acceptance planning
- subject, title, meaningful introduction and at least one public milestone are required
- public milestone form supports up to four explicitly entered milestones
- each milestone requires a stage name; optional notes require useful context
- public timing is month-level only; exact private dates are intentionally not requested by the publisher
- invalid milestone month values are rejected
- obvious sensitive-identifier phrases reuse the public-story heuristic safety layer and block publication before write
- Journey-story sensitive-text checks cover title, introduction, university/intake context and public milestone text
- data-service validates Journey stories again before creating a post
- publisher explains that nothing from the private Journey workspace is imported automatically
- publisher explicitly warns against application IDs, passport/visa numbers, booking references, exact addresses, financial account/card numbers and private documents
- Journey-story feed previews are compact and show only a short selected-milestone timeline
- Journey-story posts now open a dedicated timeline reader instead of the generic discussion reader
- reader separates author identity, subject/university/intake context, introduction, selected milestone timeline, trust/privacy guidance and replies
- reader states that exact private dates are not requested in the public publisher
- reader explicitly says private stages, checklists, target dates, notes and post-acceptance planning are not automatically shown
- Journey stories are presented as personal context, not a recommended sequence or official admissions guidance
- current admissions, scholarship, funding, deadline, visa, enrollment and arrival requirements are delegated to official university/provider sources
- non-public Journey stories are blocked at the app reader layer for non-owners/non-admins; production network-level enforcement remains Step 35
- reader links to matching subject, university and intake community spaces when public context exists
- deterministic Journey-story regression tests added, including a check that private Journey-like properties do not enter the reader model
- desktop/tablet/mobile publisher and timeline reader redesign added
- CI now watches the Journey-story service
- service-worker cache bumped to V46

**Next: Step 20 — Global search**
