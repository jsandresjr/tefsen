# Tefsen Web UI V2

## Product hierarchy

Tefsen Web V2 is intentionally **not** a social-feed-first interface.

Primary student journey:

**Goal → Student Passport → Opportunity Match → Eligibility → Save → Prepare → Apply → Progress → Outcome → Help the next student**

Primary navigation:

1. Home
2. Opportunities
3. Student Passport
4. Journey
5. Community

Messages, notifications, profile, settings, subscriptions and admin tools are secondary utilities.

## Home dashboard

The signed-in Home route is now a student command center containing:

- current education goal
- Student Passport completeness
- one prioritized next action
- saved-opportunity count
- active-journey count
- nearest official deadline
- top structured opportunity matches
- deadline/progress continuation
- selected student success outcomes

The generic discussion feed no longer owns Home.

Saved community posts remain accessible through the account menu and Community remains a dedicated destination.

## Public homepage

The public hero no longer previews an Instagram-style feed.

It now demonstrates:

- current student goal
- Student Passport readiness
- active journeys
- next action
- structured opportunity match

Feature and journey mockups now use scholarships, official-source verification, deadlines, application tasks and Student Passport readiness rather than generic learning-feed concepts.

## Unified visual system

V2 uses a restrained dark teal system:

- deep background
- structured panels
- cyan/teal accent
- low-noise borders
- limited gradients
- large clear typography
- journey/status cards over social-media ornaments

The V2 stylesheet is loaded last so core screens share one token layer.

## Retired legacy DOM patch layers

These scripts were removed from the app entrypoint because they actively rewrote V2 screens back into the old social-learning UI:

- premium-ui.js
- premium-v2.js
- android-parity.js
- web-polish.js
- reference-interface.js

Core Firebase/data behavior remains in app.js and service modules.

The subscription trial helper and latest-rules sync remain loaded because they are not responsible for the old Home/navigation redesign.

## Preserved product capabilities

The redesign keeps:

- Firebase authentication
- existing public posts/comments
- Student Passport
- opportunity matching
- eligibility checks
- saved opportunities
- private Journey
- deadlines/checklists
- success stories
- university/subject/intake communities
- admin verification
- existing profile/community routes

Community is a supporting layer rather than the product's default home screen.
