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

**Next: Step 2 — opportunity search, filters, sorting and closing-soon views**
