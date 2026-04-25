# Software Requirements Specification — Flixy

> Companion to the Flixy PRD. Maps the product vision to formal, testable software requirements.

---

## 0. Document Control

| Field | Value |
| --- | --- |
| Document Title | Software Requirements Specification — Flixy |
| Version | 1.2 (Draft) |
| Status | Draft for review |
| Author | Melih |
| Date | April 26, 2026 |
| Standard | Adapted from IEEE 830-1998 |
| Audience | Engineering, QA, DevOps, Security, Architects |
| Companion Documents | PRD, FSD |

### 0.1 Revision History
| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0 | 2026-04-25 | Melih | Initial complete draft |
| 1.1 | 2026-04-26 | Melih | Renamed product SwipeReel → Flixy; added § 7.4 Brand Typography Requirements (NFR-BRAND-001..003) |
| 1.2 | 2026-04-26 | Claude Code | Locked mobile stack: replaced § 2.5 Mobile framework choice paragraph; added § 7.5 Technical Stack Requirements (NFR-TECH-001..012); removed Open Issue § 9.3 #1 (Final mobile framework selection) |

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) describes the functional and non-functional requirements for Flixy, a mobile content-discovery application. The document is intended to be the authoritative engineering reference for what the system must do (functional requirements) and how well it must do it (non-functional requirements). It is the basis for technical design, implementation, testing, and acceptance.

The SRS focuses on the MVP (Phase 1) in full requirement detail, with Phase 2 (Social) and Phase 3 (Platform) features described at a level sufficient to ensure that MVP architecture decisions are forward-compatible.

### 1.2 Document Conventions

- **Requirement IDs.** Functional requirements are prefixed with `FR-`, non-functional with `NFR-`, data with `DR-`, interface with `IR-`. IDs are sequential within their section. New requirements are appended; existing IDs are never reused.
- **Priority.** Each requirement carries a MoSCoW priority: **MUST**, **SHOULD**, **COULD**, **WON'T (this release)**.
- **Verifiability.** Each requirement is written so that it can be verified by inspection, demonstration, test, or analysis. Vague verbs ("user-friendly," "robust") are avoided in favour of measurable language.
- **Phase tags.** Requirements tagged `[P1]` are MVP. `[P2]` are Phase 2 (Social). `[P3]` are Phase 3 (Platform).

### 1.3 Intended Audience and Reading Suggestions

- **Engineers and architects:** Read in full. Sections 3, 4, 5, 6 are normative.
- **QA engineers:** Use this document to derive test cases. Every `MUST` requirement should have at least one test.
- **Product managers and designers:** Sections 2 and 4 give a comprehensive view of what the product does.
- **DevOps and security:** Sections 3.3, 3.4, 5.2, 5.3, 5.6 are the most relevant.
- **External reviewers:** Sections 1 and 2 give an overview suitable for context without diving into requirement IDs.

### 1.4 Product Scope

Flixy is a cross-platform mobile application (iOS and Android) backed by a cloud-hosted backend. The application allows authenticated and unauthenticated users to discover movies, TV series, documentaries, and anime through a swipe-based interface, build a personal watchlist, and check streaming availability. Phase 2 introduces a social network on top of this single-player core: friends, taste profiles, mutual matching, and synchronized co-swiping. Phase 3 introduces curation, monetization, and a B2B data product.

The system covers:

- A native or hybrid mobile client.
- A backend that hosts authentication, user data, the content catalogue, the recommendation engine, and supporting services.
- Background services for catalogue ingestion and freshness syncing from third-party APIs.
- Push notification infrastructure.
- Analytics and feature-flag infrastructure.

The system does **not** cover:

- Streaming playback itself (we deeplink out to streaming services).
- Hosting or licensing of any video content.
- Payment processing for streaming services (only for our own premium tier).
- Smart TV apps (Phase 3+).

### 1.5 References

- Product Requirements Document (PRD) — Flixy v1.0.
- Functional Specification Document (FSD) — Flixy v1.0.
- TMDB API documentation (developer reference).
- Watchmode / JustWatch API documentation.
- Apple App Store Review Guidelines.
- Google Play Developer Program Policies.
- WCAG 2.2 AA Accessibility Guidelines.
- GDPR (EU 2016/679), Turkish KVKK, and equivalent regional privacy frameworks.

### 1.6 Definitions and Acronyms

See PRD § 15. Additional acronyms:

- **API** — Application Programming Interface.
- **CDN** — Content Delivery Network.
- **MAU / DAU / WAU** — Monthly / Daily / Weekly Active Users.
- **PII** — Personally Identifiable Information.
- **RBAC** — Role-Based Access Control.
- **RLS** — Row-Level Security.
- **TMDB** — The Movie Database.
- **WCAG** — Web Content Accessibility Guidelines.

---

## 2. Overall Description

### 2.1 Product Perspective

Flixy is a self-contained product. It is not an extension of an existing system. Its closest reference designs are dating apps (Tinder, Hinge) for the gesture interaction model, content tracker apps (Letterboxd, Trakt) for the data model, and aggregator apps (JustWatch, Reelgood) for streaming-availability integration. It does not depend on or extend any of those products.

The system is composed of three logical tiers:

- **Client tier:** Mobile applications for iOS and Android.
- **Application tier:** Stateless API services, recommendation services, real-time services (Phase 2 Co-Swipe), and asynchronous job workers.
- **Data tier:** Primary relational database, cache, object storage for user-generated and cached media, search index, analytics warehouse.

External system dependencies (TMDB, Watchmode, push providers, auth providers) are integrated through adapter layers that abstract the application from the specifics of any single provider, allowing replacement.

### 2.2 Product Functions (Summary)

The system, at the highest level:

- Authenticates users.
- Captures user preferences via onboarding.
- Maintains a global, multi-region content catalogue (movies, TV, documentaries, anime).
- Generates a personalized, ordered deck of cards for each user session.
- Captures swipe gestures and updates the user's taste model and lists.
- Maintains a watchlist, seen list, and pass list per user.
- Surfaces streaming availability per region per user.
- Plays trailers.
- Sends transactional and behavioural notifications.
- (P2) Maintains a friend graph, computes matches, and runs synchronized co-swipe sessions.
- (P2) Surfaces an activity feed.
- (P3) Hosts curated lists and surfaces curator profiles.
- Captures product analytics events.

### 2.3 User Classes and Characteristics

| Class | Description | Frequency | Technical Skill | Notes |
| --- | --- | --- | --- | --- |
| Anonymous user | Pre-account user, mid-onboarding | Once per install | Low | Gets a session-bound device identity |
| Registered free user | Authenticated, non-paying | Daily | Low | Primary user class |
| Registered premium user | Authenticated, paying | Daily | Low | Same UI, fewer limits |
| Friend / follower (P2) | A registered user from another user's perspective | Daily | Low | |
| Curator (P3) | Public list-maker | Weekly | Medium | Subject to moderation |
| Internal admin / moderator | Internal staff | As needed | High | Access to admin tools |
| Internal data analyst | Internal staff | Daily | High | Read-only data warehouse access |

### 2.4 Operating Environment

- **Mobile clients:** iOS 15+ and Android 9 (API 28)+.
- **Network:** Designed for variable mobile networks (3G+); graceful degradation on 2G; full functionality on Wi-Fi.
- **Backend:** Cloud-hosted on a major provider (target Vercel for web edge + Supabase for managed Postgres + storage + auth, Trigger.dev for jobs).
- **Geographic reach at MVP:** Turkey, Bulgaria, USA, UK, Germany, France, Spain, Italy, Netherlands, Brazil. Architecturally global from day one.

### 2.5 Design and Implementation Constraints

- **Stack alignment.** The team's existing stack proficiency (Next.js, Supabase, Trigger.dev, Resend, Vercel, BetterAuth, OpenRouter, Langfuse) constrains the backend technology selection. New components must integrate cleanly.
- **Mobile framework.** **React Native** (latest stable, New Architecture enabled) on **Expo SDK 52+**, with TypeScript in strict mode. This decision is locked; rationale tracked in PRD § 16.5.5 Technical Foundations and enforced via NFR-TECH requirements in § 7.5. Native swipe physics quality remains non-negotiable — the chosen framework must demonstrably deliver 60 fps gesture-driven animation on mid-tier hardware (Pixel 6a / iPhone 12 reference devices).
- **No video hosting.** The system never hosts streaming content.
- **Catalogue sourced from third parties.** No content metadata is authored in-house at MVP scale (titles, synopses, posters all flow from TMDB).
- **Data residency.** EU users' personal data must be storable in EU regions per GDPR. Architecture must permit region-aware storage by Phase 3.
- **Brand independence.** No use of "Tinder," "Netflix," or other trademarked names in product surfaces, store listings, or marketing copy.
- **Mobile-first.** No requirement to support desktop web or tablet at MVP, but the API design must not preclude them.

### 2.6 User Documentation

- In-app onboarding screens (covers ~90% of feature discovery).
- Help center accessible from settings, with searchable FAQ entries.
- Email-only support channel at MVP. In-app chat support deferred.
- Public-facing privacy policy and terms of service hosted on the marketing site.
- App store listings with screenshots and feature descriptions.

### 2.7 Assumptions and Dependencies

- TMDB metadata access remains available under acceptable terms.
- Streaming-availability data is available for all launch regions through at least one provider with acceptable freshness (≤24h staleness).
- Apple and Google deeplink schemes for at least Netflix, Prime Video, Disney+, Apple TV, HBO Max, BluTV (Turkey), Hulu (US), and YouTube remain stable.
- Push notifications providers remain stable and free at our scale.
- The mobile framework's gesture-handling primitives are sufficient for the swipe physics target.

---

## 3. External Interface Requirements

### 3.1 User Interfaces (`IR-UI-`)

- **IR-UI-001 [P1, MUST].** The system shall expose a mobile UI on iOS and Android with a primary "Discover" deck surface, a watchlist surface, a search surface, and a profile/settings surface.
- **IR-UI-002 [P1, MUST].** All primary destructive actions (delete account, clear watchlist, sign out) shall require an explicit confirmation step.
- **IR-UI-003 [P1, MUST].** All primary discovery actions (the four swipes) shall have both a gesture and an equivalent button affordance for accessibility.
- **IR-UI-004 [P1, MUST].** The UI shall meet WCAG 2.2 AA: minimum contrast, scalable type up to 200%, screen-reader labels for all interactive elements, focus order, and accessible gestures (alternate buttons).
- **IR-UI-005 [P1, MUST].** The UI shall support light mode and dark mode and follow the system theme by default.
- **IR-UI-006 [P1, MUST].** Localization is supported; copy is externalized in resource files.
- **IR-UI-007 [P1, SHOULD].** The UI shall provide haptic feedback on right and up swipes.
- **IR-UI-008 [P1, MUST].** The UI shall not require landscape orientation; portrait is canonical.

### 3.2 Hardware Interfaces (`IR-HW-`)

- **IR-HW-001 [P1, MUST].** The application uses standard mobile hardware: touchscreen, network adapter, optional camera (Phase 2: avatar), optional GPS (region detection only, never tracked).
- **IR-HW-002 [P1, MUST].** No specialized hardware is required.

### 3.3 Software Interfaces (`IR-SW-`)

- **IR-SW-001 [P1, MUST] — TMDB.** The system integrates with TMDB for content metadata: titles, descriptions, posters, backdrops, runtime, genres, cast/crew, trailer references. The integration must support pagination, language, and region parameters.
- **IR-SW-002 [P1, MUST] — Watchmode (or equivalent).** The system integrates with a streaming-availability provider that returns, per title and region, the list of services where the title is available, plus deeplinks where possible.
- **IR-SW-003 [P1, MUST] — Authentication providers.** The system integrates with email/password (via the auth backend), Sign in with Apple, and Sign in with Google.
- **IR-SW-004 [P1, MUST] — Push notification providers.** APNs for iOS, FCM for Android.
- **IR-SW-005 [P1, MUST] — Analytics.** The system integrates with PostHog for product analytics and feature flags.
- **IR-SW-006 [P1, MUST] — Email.** Transactional email via Resend.
- **IR-SW-007 [P2, SHOULD] — Contact import.** With explicit user consent, the system reads device contacts to suggest friends already on the platform.
- **IR-SW-008 [P2, COULD] — LLM provider.** For Phase 2 "why this card" explainability, the system may call an LLM via OpenRouter.
- **IR-SW-009 [P1, MUST] — Trailer playback.** The system embeds YouTube playback via the official iframe player or platform-native YouTube SDK.
- **IR-SW-010 [P1, MUST] — Image CDN.** Catalogue artwork is served via TMDB's CDN with our own caching layer.

### 3.4 Communications Interfaces (`IR-COMM-`)

- **IR-COMM-001 [P1, MUST].** All client-server traffic is encrypted in transit using TLS 1.2 or higher.
- **IR-COMM-002 [P1, MUST].** API responses are JSON. Binary assets are served as standard image/video MIME types.
- **IR-COMM-003 [P1, MUST].** The client supports offline degraded mode: cached deck, cached watchlist read-only, queued swipes that sync on reconnect.
- **IR-COMM-004 [P2, MUST].** Real-time co-swipe sessions use a WebSocket-class transport with reconnection and missed-event replay.
- **IR-COMM-005 [P1, MUST].** All API requests include client version and platform; requests from unsupported client versions receive a versioned upgrade-required response.

---

## 4. System Features (Functional Requirements)

Each subsection below describes a feature, its priority, its inputs, its behaviour, and its testable requirements.

### 4.1 Authentication and Account Management

#### 4.1.1 Description
Provides identity to the user. Anonymous use is supported during onboarding. Registered accounts persist user data across devices and unlock notifications.

#### 4.1.2 Functional Requirements
- **FR-AUTH-001 [P1, MUST].** The system shall allow a user to begin onboarding without an account using a device-bound anonymous identity.
- **FR-AUTH-002 [P1, MUST].** The system shall allow account creation via email + password.
- **FR-AUTH-003 [P1, MUST].** The system shall allow account creation via Sign in with Apple.
- **FR-AUTH-004 [P1, MUST].** The system shall allow account creation via Sign in with Google.
- **FR-AUTH-005 [P1, MUST].** Email/password accounts shall require a verified email before notifications are sent and before social features are usable (P2).
- **FR-AUTH-006 [P1, MUST].** Password resets shall be available via email.
- **FR-AUTH-007 [P1, MUST].** When an anonymous user creates an account, the system shall migrate all anonymous data (watchlist, swipes, preferences) to the new account atomically.
- **FR-AUTH-008 [P1, MUST].** The system shall allow a user to delete their account, which permanently deletes personal data within 30 days (with confirmation flow).
- **FR-AUTH-009 [P1, MUST].** The system shall support session refresh tokens that allow long-lived sessions without re-authentication.
- **FR-AUTH-010 [P1, MUST].** The system shall lock the account after 10 failed password attempts within 15 minutes for 30 minutes (rate-limit).
- **FR-AUTH-011 [P1, MUST].** The system shall support sign-out from a single device and sign-out from all devices.
- **FR-AUTH-012 [P1, SHOULD].** The system shall support changing email address with re-verification.
- **FR-AUTH-013 [P1, MUST].** The system shall not require a phone number for any user class.
- **FR-AUTH-014 [P1, MUST].** The system shall provide a data export option compliant with GDPR Article 20 (data portability).

### 4.2 Onboarding and Taste Profile

#### 4.2.1 Description
Captures initial signal in 60 seconds. Mixes preferences (declared) and behaviour (cold-start swipes).

#### 4.2.2 Functional Requirements
- **FR-ONB-001 [P1, MUST].** The system shall detect the user's region via locale, with manual override.
- **FR-ONB-002 [P1, MUST].** The system shall present a multi-select list of supported streaming services for the user's region; the user must select at least one.
- **FR-ONB-003 [P1, MUST].** The system shall present a list of genres; the user must select at least three and at most twelve.
- **FR-ONB-004 [P1, MUST].** The system shall run a cold-start swipe round of exactly 10 popular and varied titles, the swipes from which contribute to the taste model.
- **FR-ONB-005 [P1, MUST].** The system shall ask for notification permission with a clear value statement before invoking the OS prompt.
- **FR-ONB-006 [P1, MUST].** The system shall persist the onboarding state across app restarts so a user can resume mid-onboarding.
- **FR-ONB-007 [P1, MUST].** The system shall not show the onboarding flow more than once unless the user explicitly resets it from settings.
- **FR-ONB-008 [P1, SHOULD].** The system shall offer a "skip" affordance for the genre and cold-start steps that uses a sensible default profile (popular generalist).

### 4.3 Content Catalogue and Ingestion

#### 4.3.1 Description
The system maintains a normalized catalogue ingested from TMDB and enriched with availability data from Watchmode/JustWatch.

#### 4.3.2 Functional Requirements
- **FR-CAT-001 [P1, MUST].** The system shall ingest from TMDB the following fields per title: ID, title, original title, release year, runtime (movies) or seasons/episodes count (series), genres, primary language, country of origin, synopsis (English + per supported locale), poster URL, backdrop URL, trailer reference, cast (top 8), director, content rating, popularity score.
- **FR-CAT-002 [P1, MUST].** The system shall update titles' freshness data daily for the top 50,000 most-popular titles globally and weekly for the long tail.
- **FR-CAT-003 [P1, MUST].** Streaming availability shall be refreshed daily per region for the top 20,000 most-popular titles and weekly for the rest.
- **FR-CAT-004 [P1, MUST].** The system shall maintain region-specific availability records without duplicating title metadata.
- **FR-CAT-005 [P1, MUST].** Soft-delete is supported for titles withdrawn from TMDB; the system shall not display soft-deleted titles in cards but shall preserve historical user references.
- **FR-CAT-006 [P1, MUST].** The system shall reject malformed ingestion records and log them without halting the pipeline.
- **FR-CAT-007 [P1, MUST].** The catalogue shall include movies, TV series, mini-series, documentary films, documentary series, and animated content. Stand-up specials, kids-only content, and adult-only content are excluded by default but the data model supports their inclusion.
- **FR-CAT-008 [P1, MUST].** The catalogue shall record at least one trailer reference (YouTube ID) per title where available.
- **FR-CAT-009 [P1, SHOULD].** The system shall expose admin tools to manually flag titles as unavailable, low-quality, or restricted.

### 4.4 Recommendation Engine

#### 4.4.1 Description
Generates the deck — an ordered queue of titles for the user's next session — combining personalization signal, freshness, availability, and exploration.

#### 4.4.2 Functional Requirements
- **FR-REC-001 [P1, MUST].** The deck shall be personalized to the user using:
  - declared preferences (services, genres, language, region),
  - swipe history (right/up positive, left/down negative),
  - title-similarity (content-based),
  - popularity (collaborative-flavoured fallback for cold start),
  - availability on the user's services.
- **FR-REC-002 [P1, MUST].** The deck shall never include titles in the user's seen list, watchlist, or recently passed list (≤ 90 days).
- **FR-REC-003 [P1, MUST].** The deck shall maintain at least 80% availability on the user's selected services unless filters dictate otherwise.
- **FR-REC-004 [P1, MUST].** The deck shall include an exploration quota of 10–20% titles outside the user's strict preference profile, to combat filter bubbles and improve discovery.
- **FR-REC-005 [P1, MUST].** The deck shall be generated in batches of 50 cards and pre-fetched on the client.
- **FR-REC-006 [P1, MUST].** The deck shall apply user filters (mood, genre, runtime, decade, etc.) at generation time.
- **FR-REC-007 [P1, MUST].** The deck shall be reproducible on the server side from a session seed for debugging and A/B test analysis.
- **FR-REC-008 [P1, MUST].** The system shall log the reason for each card's selection (rule trace) for premium "why this card" UX and for internal evaluation.
- **FR-REC-009 [P1, SHOULD].** The system shall demote titles that the user passed within the last 24 hours (cool-down).
- **FR-REC-010 [P1, SHOULD].** Recommendation quality shall be evaluable via an offline test harness using held-out swipe data.

### 4.5 Swipe Mechanic

#### 4.5.1 Description
The core interaction. Four directions with mapped meanings, plus undo.

#### 4.5.2 Functional Requirements
- **FR-SWP-001 [P1, MUST].** The user shall be able to swipe right to add a title to the watchlist.
- **FR-SWP-002 [P1, MUST].** The user shall be able to swipe left to pass a title.
- **FR-SWP-003 [P1, MUST].** The user shall be able to swipe up to add the title to the top of the watchlist (super-like).
- **FR-SWP-004 [P1, MUST].** The user shall be able to swipe down to mark the title as already seen.
- **FR-SWP-005 [P1, MUST].** Each swipe shall trigger the appropriate animation, haptic feedback (where applicable), and a non-blocking server-side write.
- **FR-SWP-006 [P1, MUST].** Swipe writes shall be idempotent — repeated submissions of the same swipe shall not duplicate the action.
- **FR-SWP-007 [P1, MUST].** Swipes performed offline shall queue locally and sync on reconnection in the order performed.
- **FR-SWP-008 [P1, MUST].** The system shall provide an Undo affordance that reverses the immediately previous swipe, removing it from the relevant list and restoring the card.
- **FR-SWP-009 [P1, MUST].** Undo shall be limited to the last 5 swipes for free users and unlimited for premium.
- **FR-SWP-010 [P1, MUST].** Each swipe direction shall have an equivalent button for accessibility.
- **FR-SWP-011 [P1, MUST].** Card animation shall maintain 60 fps on a Pixel 6 / iPhone 12 or newer.
- **FR-SWP-012 [P1, SHOULD].** A first-time user shall be shown a brief gestural hint that fades within 3 seconds or on first swipe.

### 4.6 Watchlist Management

#### 4.6.1 Functional Requirements
- **FR-WL-001 [P1, MUST].** Right-swipes shall append titles to the watchlist with priority `normal`.
- **FR-WL-002 [P1, MUST].** Up-swipes shall append titles to the watchlist with priority `top`.
- **FR-WL-003 [P1, MUST].** The watchlist shall be sortable by: priority (default), date added, runtime ascending, runtime descending, primary streaming service, content type.
- **FR-WL-004 [P1, MUST].** The watchlist shall be filterable by content type, streaming service, and runtime band.
- **FR-WL-005 [P1, MUST].** The user shall be able to reorder watchlist items by drag.
- **FR-WL-006 [P1, MUST].** The user shall be able to remove items from the watchlist.
- **FR-WL-007 [P1, MUST].** The user shall be able to mark items as watched, which moves them to the seen list.
- **FR-WL-008 [P1, MUST].** The watchlist shall display streaming availability state per item, including stale-data indicators where availability data is older than 7 days.
- **FR-WL-009 [P1, MUST].** The watchlist shall show "leaving soon" badges when a streaming-availability provider returns an end-of-availability date within 14 days.
- **FR-WL-010 [P1, SHOULD].** The system shall periodically (weekly) prompt users to review stale watchlist items older than 90 days for clean-up.

### 4.7 Seen and Pass Lists

#### 4.7.1 Functional Requirements
- **FR-SEEN-001 [P1, MUST].** Down-swipes shall add titles to the seen list.
- **FR-SEEN-002 [P1, MUST].** Marking a watchlist item as watched shall add it to the seen list and remove it from the watchlist.
- **FR-SEEN-003 [P1, MUST].** Titles in the seen list shall be excluded from the recommendation deck.
- **FR-SEEN-004 [P1, MUST].** The user shall be able to view, search, and remove items from the seen list.
- **FR-PASS-001 [P1, MUST].** Left-swipes shall add titles to the pass list with a timestamp.
- **FR-PASS-002 [P1, MUST].** Pass list entries older than 90 days may be re-introduced into the deck.
- **FR-PASS-003 [P1, SHOULD].** The pass list is accessible in advanced settings for review and bulk-clear.

### 4.8 Detail View

#### 4.8.1 Functional Requirements
- **FR-DET-001 [P1, MUST].** The detail view shall display the full synopsis, cast (top 8), director, runtime or seasons, genre tags, original language, content rating, primary trailer.
- **FR-DET-002 [P1, MUST].** The detail view shall display all known streaming availabilities for the user's region with deeplinks; the user's owned services shall be visually highlighted.
- **FR-DET-003 [P1, MUST].** The detail view shall display aggregated rating(s) where available (e.g., TMDB user score).
- **FR-DET-004 [P1, MUST].** The detail view shall offer the four swipe actions as buttons.
- **FR-DET-005 [P1, MUST].** The trailer shall not auto-play with sound; it auto-plays muted by default.
- **FR-DET-006 [P1, SHOULD].** The detail view shall display "people also liked" suggestions (deferred to P1.5 if non-trivial).

### 4.9 Filters and Mood Modes

#### 4.9.1 Functional Requirements
- **FR-FLT-001 [P1, MUST].** The user shall be able to apply filters per session: genre (multi), runtime band, decade band, language, content type, streaming services subset.
- **FR-FLT-002 [P1, MUST].** Filters shall persist across sessions until cleared.
- **FR-FLT-003 [P1, MUST].** The system shall provide at least 6 mood presets that map to filter combinations.
- **FR-FLT-004 [P1, MUST].** Applying a filter shall regenerate the deck within 1 second on a typical mobile network.
- **FR-FLT-005 [P1, SHOULD].** The system shall display a count of titles matching the current filters.

### 4.10 Streaming Service Availability

#### 4.10.1 Functional Requirements
- **FR-AVL-001 [P1, MUST].** The system shall display, for each card and detail view, the streaming services that carry the title in the user's region.
- **FR-AVL-002 [P1, MUST].** Services not in the user's region shall not be displayed.
- **FR-AVL-003 [P1, MUST].** Tapping a service shall attempt a deeplink into the streaming app; on failure, fall back to the streaming service's mobile web URL.
- **FR-AVL-004 [P1, MUST].** Each streaming-availability record shall record its source provider and last-refresh timestamp.
- **FR-AVL-005 [P1, MUST].** Stale availability data (older than 14 days) shall be visibly indicated to the user.
- **FR-AVL-006 [P1, SHOULD].** Each click-out shall be logged for analytics and potential affiliate attribution.

### 4.11 Search

#### 4.11.1 Functional Requirements
- **FR-SRC-001 [P1, MUST].** The user shall be able to search the catalogue by title (typeahead).
- **FR-SRC-002 [P1, MUST].** The user shall be able to search by person (actor / director).
- **FR-SRC-003 [P1, MUST].** Search results shall be ranked by popularity within the user's region first, with a secondary cross-region tier for niche queries.
- **FR-SRC-004 [P1, MUST].** Tapping a search result shall open the detail view.
- **FR-SRC-005 [P1, SHOULD].** Search supports fuzzy matching for typos and accent variants.
- **FR-SRC-006 [P1, SHOULD].** Recent searches are remembered locally and shown when the search field is focused.

### 4.12 Notifications

#### 4.12.1 Functional Requirements
- **FR-NTF-001 [P1, MUST].** The user shall be able to opt in or out of each notification category individually.
- **FR-NTF-002 [P1, MUST].** Notification categories at MVP: New on your services, Watchlist heads-up, Re-engagement nudge, Account/security.
- **FR-NTF-003 [P1, MUST].** No notification shall be sent before 9:00 or after 21:00 in the user's local time, except security-critical notifications.
- **FR-NTF-004 [P1, MUST].** The total non-security notification volume shall not exceed 5/week per user without explicit opt-in.
- **FR-NTF-005 [P1, MUST].** Notification taps shall deep-link into the relevant in-app destination.
- **FR-NTF-006 [P1, MUST].** Push tokens shall be securely stored, rotated, and invalidated on sign-out.
- **FR-NTF-007 [P1, SHOULD].** The system shall A/B-test notification copy under feature flags.

### 4.13 Settings

#### 4.13.1 Functional Requirements
- **FR-SET-001 [P1, MUST].** Settings shall include: profile (name, handle, avatar, region, language), services owned, notification preferences, content preferences, account (sign out, delete, export), subscription (P1.5+), about/legal.
- **FR-SET-002 [P1, MUST].** Changes shall save without requiring an explicit "save" button (auto-persist with toast feedback).
- **FR-SET-003 [P1, MUST].** Resetting onboarding from settings shall clear taste signal and re-trigger the onboarding flow.

### 4.14 Phase 2 — Friends and Social Graph

- **FR-FRD-001 [P2, MUST].** The system shall provide handle-based friend search.
- **FR-FRD-002 [P2, MUST].** The system shall support contact-import friend discovery with explicit consent.
- **FR-FRD-003 [P2, MUST].** The system shall support follow / unfollow as the social primitive (Twitter-style, asymmetric).
- **FR-FRD-004 [P2, MUST].** Profiles default to public; users can switch to private.
- **FR-FRD-005 [P2, MUST].** Private profiles require an approval step before another user can see their activity.
- **FR-FRD-006 [P2, MUST].** Users can block other users; a block hides the profile bidirectionally and prevents matches and feed appearances.
- **FR-FRD-007 [P2, MUST].** Users can report another user or a comment for moderation.

### 4.15 Phase 2 — Movie Match

- **FR-MTC-001 [P2, MUST].** When two mutually-following users have both right-swiped or up-swiped the same title within the last 30 days, the system shall record a match.
- **FR-MTC-002 [P2, MUST].** Matches shall trigger an opt-in push notification to both users.
- **FR-MTC-003 [P2, MUST].** Matches shall be visible in a dedicated Match list screen.
- **FR-MTC-004 [P2, MUST].** Users can dismiss or hide a match.
- **FR-MTC-005 [P2, SHOULD].** Match suggestions can include "almost matches" (one user has watchlisted, the other has not yet seen the card).

### 4.16 Phase 2 — Co-Swipe

- **FR-COS-001 [P2, MUST].** A user shall be able to start a Co-Swipe session and invite 1–6 friends or generate a shareable invite link.
- **FR-COS-002 [P2, MUST].** Invitees can join from the notification or invite link.
- **FR-COS-003 [P2, MUST].** All session participants see the same deck in the same order.
- **FR-COS-004 [P2, MUST].** Each participant swipes independently; the system signals each participant's progress without revealing individual swipes until a unanimous match.
- **FR-COS-005 [P2, MUST].** The first title that all participants right-swipe ends the session with a Co-Match.
- **FR-COS-006 [P2, MUST].** Sessions cap at 60 cards or 5 minutes by default.
- **FR-COS-007 [P2, MUST].** A participant can leave the session at any time; remaining participants are notified.
- **FR-COS-008 [P2, SHOULD].** A Co-Swipe deck blends participants' taste profiles with availability across the union of their services (or intersection, configurable).

### 4.17 Phase 2 — Activity Feed

- **FR-FED-001 [P2, MUST].** A reverse-chronological feed shall show friends' public activity: added to watchlist, marked as watched, posted a micro-review, super-liked.
- **FR-FED-002 [P2, MUST].** Users can mute specific friends without unfollowing.
- **FR-FED-003 [P2, MUST].** Users can hide specific titles from being shared on their feed (per swipe).
- **FR-FED-004 [P2, SHOULD].** Activity items support reactions (like, "added to mine," "seen it").

### 4.18 Phase 2 — Micro-Reviews

- **FR-RVW-001 [P2, MUST].** Users can attach a one-line text comment (≤140 chars) to any swipe, optionally.
- **FR-RVW-002 [P2, MUST].** Comments are visible to friends only by default; user can publish to public.
- **FR-RVW-003 [P2, MUST].** Comments are moderated; flagged terms trigger a soft block with an appeal path.

### 4.19 Phase 3 — Curators and Lists

- **FR-CUR-001 [P3, MUST].** Users can create named curated lists of titles.
- **FR-CUR-002 [P3, MUST].** Lists can be private, friends-only, or public.
- **FR-CUR-003 [P3, MUST].** Public lists are searchable and shareable.
- **FR-CUR-004 [P3, SHOULD].** A user can "start a swipe session from this list" to discover within a curator's selection.

---

## 5. Non-Functional Requirements

### 5.1 Performance (`NFR-PERF-`)

- **NFR-PERF-001 [P1, MUST].** Cold app start to first interactive frame shall be ≤ 2.5 seconds on a Pixel 6 / iPhone 12 on a healthy network.
- **NFR-PERF-002 [P1, MUST].** A swipe gesture shall produce visual feedback within 16 ms (one frame) of the gesture beginning.
- **NFR-PERF-003 [P1, MUST].** A swipe gesture's full animation shall complete in ≤ 350 ms.
- **NFR-PERF-004 [P1, MUST].** The next card shall be visible and interactive within 100 ms of the prior card's exit.
- **NFR-PERF-005 [P1, MUST].** The deck shall be pre-fetched such that the user does not encounter a loading state during 95% of normal swipe sessions on a Wi-Fi network.
- **NFR-PERF-006 [P1, MUST].** The 95th-percentile API latency for read endpoints shall be ≤ 250 ms in the primary region.
- **NFR-PERF-007 [P1, MUST].** The 95th-percentile API latency for write endpoints (swipe, watchlist mutation) shall be ≤ 350 ms.
- **NFR-PERF-008 [P1, MUST].** Catalogue images shall be served via a CDN with cache hit rate ≥ 95% steady-state.
- **NFR-PERF-009 [P1, SHOULD].** Memory usage on the client shall not exceed 200 MB during typical sessions.
- **NFR-PERF-010 [P1, MUST].** The trailer shall begin playback within 2 seconds of detail view open on a healthy network.

### 5.2 Security (`NFR-SEC-`)

- **NFR-SEC-001 [P1, MUST].** All client-server traffic shall use TLS 1.2+.
- **NFR-SEC-002 [P1, MUST].** Passwords shall be hashed with a modern algorithm (e.g., Argon2id) with per-user salt.
- **NFR-SEC-003 [P1, MUST].** Secrets shall be stored in a managed secret store, never in source control or client bundles.
- **NFR-SEC-004 [P1, MUST].** API tokens shall be short-lived; refresh tokens shall be rotation-based.
- **NFR-SEC-005 [P1, MUST].** Database access shall be scoped using row-level security, ensuring no user can read another user's private data via the API.
- **NFR-SEC-006 [P1, MUST].** Input validation shall be enforced server-side regardless of client validation.
- **NFR-SEC-007 [P1, MUST].** The system shall be hardened against the OWASP Mobile Top 10 vulnerabilities.
- **NFR-SEC-008 [P1, MUST].** Rate limiting shall be applied per IP and per account on auth endpoints, write endpoints, and search.
- **NFR-SEC-009 [P1, MUST].** The system shall log security-relevant events (auth, deletion, role change) to an immutable audit trail.
- **NFR-SEC-010 [P1, SHOULD].** A security review (manual + tool-based scan) shall be performed before each major release.
- **NFR-SEC-011 [P2, MUST].** User-generated content (reviews, list names) shall be validated against a profanity and abuse policy.
- **NFR-SEC-012 [P1, MUST].** Mobile binaries shall be obfuscated and shall not contain any embedded API keys with admin scope.

### 5.3 Privacy and Data Protection (`NFR-PRIV-`)

- **NFR-PRIV-001 [P1, MUST].** The system shall comply with GDPR, KVKK (Turkey), and CCPA (California) at MVP.
- **NFR-PRIV-002 [P1, MUST].** Users shall be able to download a full export of their data within 72 hours of request.
- **NFR-PRIV-003 [P1, MUST].** Users shall be able to delete their account; personal data shall be erased or anonymized within 30 days.
- **NFR-PRIV-004 [P1, MUST].** Aggregate, non-PII analytics may be retained beyond account deletion.
- **NFR-PRIV-005 [P1, MUST].** The privacy policy shall be visible at install, accessible from settings, and reviewed at significant changes with consent capture.
- **NFR-PRIV-006 [P1, MUST].** No PII shall be sent to third-party analytics services. Identifiers used shall be pseudonymous.
- **NFR-PRIV-007 [P1, MUST].** Telemetry events shall be reviewable by the user (a "what we collect" page).
- **NFR-PRIV-008 [P2, MUST].** Friends and followers shall not see content the user has marked private.

### 5.4 Reliability and Availability (`NFR-REL-`)

- **NFR-REL-001 [P1, MUST].** Backend uptime target: 99.5% in the first 6 months, 99.9% thereafter.
- **NFR-REL-002 [P1, MUST].** The system shall recover automatically from a single-AZ outage in the primary region.
- **NFR-REL-003 [P1, MUST].** Daily backups of the primary database with at least 30 days of retention.
- **NFR-REL-004 [P1, MUST].** Point-in-time recovery available for the primary database covering at least 7 days.
- **NFR-REL-005 [P1, MUST].** Background jobs (catalogue ingestion, freshness sync, notifications) shall be idempotent and retried with exponential backoff on failure.
- **NFR-REL-006 [P1, MUST].** The client shall handle backend unavailability gracefully (offline mode, cached deck, queued writes).

### 5.5 Maintainability (`NFR-MNT-`)

- **NFR-MNT-001 [P1, MUST].** Code shall pass automated linting and type-checking on every commit.
- **NFR-MNT-002 [P1, MUST].** Continuous integration shall run unit and integration tests on every pull request.
- **NFR-MNT-003 [P1, MUST].** Test coverage on critical paths (auth, swipe, watchlist) shall be ≥ 80%.
- **NFR-MNT-004 [P1, MUST].** Feature flags shall gate every non-trivial new feature in production.
- **NFR-MNT-005 [P1, MUST].** All deploys shall be reversible within 10 minutes.
- **NFR-MNT-006 [P1, MUST].** Logs and metrics shall be centralized, queryable, and tagged with request and trace IDs.
- **NFR-MNT-007 [P1, SHOULD].** Architectural decisions shall be captured in lightweight ADRs in-repo.

### 5.6 Scalability (`NFR-SCL-`)

- **NFR-SCL-001 [P1, MUST].** The system shall handle 100,000 MAU and a peak of 10,000 concurrent sessions on launch infrastructure.
- **NFR-SCL-002 [P1, MUST].** All API services shall be stateless and horizontally scalable.
- **NFR-SCL-003 [P1, MUST].** The deck-generation service shall maintain p95 latency under load by caching popular deck slices and applying batch generation.
- **NFR-SCL-004 [P1, MUST].** Catalogue ingestion shall be throttled to respect TMDB and Watchmode rate limits with provider-side budget tracking.
- **NFR-SCL-005 [P2, MUST].** Real-time Co-Swipe sessions shall scale to 10,000 concurrent sessions without degradation.
- **NFR-SCL-006 [P3, MUST].** The architecture shall support multi-region read replicas to reduce latency in EU and Americas.

### 5.7 Usability and Accessibility (`NFR-USE-`)

- **NFR-USE-001 [P1, MUST].** UI shall meet WCAG 2.2 AA: contrast, scalable text, screen-reader labels, alternative inputs.
- **NFR-USE-002 [P1, MUST].** Every interactive element shall expose an accessibility label.
- **NFR-USE-003 [P1, MUST].** The four swipe actions shall have button equivalents.
- **NFR-USE-004 [P1, MUST].** Error messages shall be specific, actionable, and free of jargon.
- **NFR-USE-005 [P1, MUST].** The system shall pass a usability test with 8–10 representative users in beta with a Single Ease Question score ≥ 5/7 on the core swipe loop.
- **NFR-USE-006 [P1, SHOULD].** Reduced-motion users shall see simpler card transitions when system reduced-motion is enabled.

### 5.8 Localization and Internationalization (`NFR-I18N-`)

- **NFR-I18N-001 [P1, MUST].** UI copy shall be externalized; the codebase shall not contain hard-coded user-facing strings.
- **NFR-I18N-002 [P1, MUST].** Launch languages: English, Turkish, Bulgarian, Spanish, German, French, Portuguese (BR).
- **NFR-I18N-003 [P1, MUST].** Date, time, runtime, and number formats shall respect user locale.
- **NFR-I18N-004 [P1, MUST].** The catalogue shall surface localized titles and synopses where TMDB provides them; English fallback otherwise.
- **NFR-I18N-005 [P1, MUST].** RTL languages are not in MVP scope but shall not be precluded by the layout system.

### 5.9 Legal and Compliance (`NFR-LGL-`)

- **NFR-LGL-001 [P1, MUST].** The product shall comply with TMDB's terms of use and credit TMDB visibly per their attribution requirement.
- **NFR-LGL-002 [P1, MUST].** The product shall comply with Apple App Store Review Guidelines and Google Play Developer Program Policies.
- **NFR-LGL-003 [P1, MUST].** All third-party trademarks (streaming service logos) shall be used in accordance with each holder's brand guidelines.
- **NFR-LGL-004 [P1, MUST].** A cookie / tracking consent banner shall be displayed in jurisdictions that require it (EU, UK).
- **NFR-LGL-005 [P1, MUST].** Underage users (under 13 / under 16 depending on region) shall not be permitted to register.

---

## 6. Data Requirements

### 6.1 Logical Data Model (entities)

The following entities are the core nouns of the system. Each is described with its essential attributes and relationships. The FSD provides concrete implementation guidance.

- **User.** The account. Attributes: user ID (UUID, internal), auth provider IDs, email, handle, display name, avatar URL, region, locale, account status, created date, last seen date, premium tier.
- **DeviceSession.** The anonymous identity for pre-account use. Migrates into a User on account creation.
- **TasteProfile.** Per-user preferences and computed signal. Attributes: preferred services, preferred genres, exclude genres, preferred languages, runtime preference, decade preference, exploration setting.
- **Title.** A catalogue entry. Attributes: ID (internal), TMDB ID, type (movie / series / mini-series / documentary / anime), original title, primary title, year (or first-aired year), runtime (or season/episode info), poster URL, backdrop URL, trailer reference, primary language, genre tags, content rating, popularity score, popularity rank, status (active / hidden), created and updated timestamps.
- **TitleLocalization.** Per-locale title and synopsis.
- **TitleAvailability.** Availability per title per region per service. Attributes: title ID, region code, service code, deeplink URL, source provider, available from / available until, last refresh timestamp.
- **Swipe.** A user action against a title. Attributes: user ID, title ID, direction (right / left / up / down), session ID, deck position, filter snapshot, timestamp, region at time of swipe.
- **Watchlist.** Per-user list. Materialized from up- and right-swipes minus removals; ordered by priority then time.
- **SeenList.** Per-user list. Sourced from down-swipes and "marked as watched" actions.
- **PassList.** Per-user list. Sourced from left-swipes; entries decay after 90 days.
- **Notification.** A delivered push or in-app notification. Attributes: user, type, payload, sent timestamp, opened timestamp.
- **NotificationPreferences.** Per-user toggles per category.
- **AppEvent.** Telemetry event. User-pseudo-anonymous; attributes: event name, properties, session ID, client version, timestamp.
- **(P2) Friendship.** Edges in the social graph. Direction (follow), status (active / blocked / muted).
- **(P2) Match.** Tuple of (user A, user B, title) created when both have positive swipes within 30 days.
- **(P2) CoSwipeSession.** A live session. Attributes: session ID, host, participants, deck seed, status, started, ended, result title.
- **(P2) Comment.** Optional micro-review attached to a swipe. Attributes: text, visibility, moderation state.
- **(P2) ActivityEvent.** A friend-visible activity record.
- **(P3) List.** A curator's list. Attributes: owner, title, description, visibility, items, created/updated.

### 6.2 Data Lifecycle

- **DR-LC-001 [P1, MUST].** Title metadata is created and updated by the ingestion pipeline; never directly by users.
- **DR-LC-002 [P1, MUST].** Swipes are append-only; "undo" creates a compensating record rather than deleting history (for analytics integrity), while honoring user-facing list correctness.
- **DR-LC-003 [P1, MUST].** Pass list entries have a configurable TTL (default 90 days).
- **DR-LC-004 [P1, MUST].** Deleting an account erases user-identifiable rows; aggregate and anonymized swipe data may be retained for product evaluation.
- **DR-LC-005 [P1, MUST].** Catalogue rows are soft-deleted, never hard-deleted, to preserve historical references.

### 6.3 Data Retention

| Data type | Retention | Notes |
| --- | --- | --- |
| Account PII | Until account deletion + 30 days grace | Hard erase on deletion |
| Swipe history | Until account deletion | Anonymized version retained |
| Telemetry events | 24 months | Pseudonymous |
| Audit logs (security) | 7 years | Compliance |
| Backups | 30 days | Encrypted |
| Pass list | 90 days rolling | Per FR-PASS-002 |
| Notification logs | 90 days | |
| Catalogue records | Indefinite | Soft-delete supported |

### 6.4 Data Integrity

- **DR-INT-001 [P1, MUST].** Foreign key relationships shall be enforced by the database where it does not impose unacceptable performance cost.
- **DR-INT-002 [P1, MUST].** Soft-deleted titles shall not appear in deck generation or search.
- **DR-INT-003 [P1, MUST].** A user's lists shall reference titles by stable internal ID, not TMDB ID, to absorb upstream ID changes.
- **DR-INT-004 [P1, MUST].** Migrations shall be backwards-compatible where the application code can run during deploy.

---

## 7. Other Requirements

### 7.1 Compliance and App Store

- **OR-001 [P1, MUST].** The product shall meet Apple App Store Review Guidelines (current version) at submission.
- **OR-002 [P1, MUST].** The product shall meet Google Play Developer Policies at submission.
- **OR-003 [P1, MUST].** The product shall include the App Privacy nutrition label data as required by Apple.
- **OR-004 [P1, MUST].** The product shall provide an in-app age gate where required (defaults to user-declared age 13+).
- **OR-005 [P1, MUST].** Anti-fraud mechanisms (rate limiting, abuse detection) shall protect any future paid features.

### 7.2 Internationalization Maturity

- **OR-010 [P1, MUST].** Initial launch markets: Turkey, Bulgaria, USA, UK, Germany, France, Spain, Italy, Netherlands, Brazil.
- **OR-011 [P1, MUST].** Each launch market shall have, at submission, at least 3 mapped streaming services with availability data.

### 7.3 Brand and Content Policy

- **OR-020 [P1, MUST].** No use of "Tinder" or "Netflix" trademarks in product surfaces, store listing copy, or marketing.
- **OR-021 [P1, MUST].** All TMDB attributions shall appear per TMDB's terms.
- **OR-022 [P2, MUST].** A community guideline / acceptable-use policy shall govern user-generated content (comments, list names, profile copy).

### 7.4 Brand Typography Requirements (`NFR-BRAND-`)

- **NFR-BRAND-001 [P1, MUST].** The application SHALL use **GT Sectra** (Grilli Type) as the primary display typeface for all editorial surfaces — including movie/show titles on cards, detail screen heroes, section headers, and any surface designated as "display" in the design system token spec (FSD § 4 UI/UX Specifications).
- **NFR-BRAND-002 [P1, MUST].** The application SHALL use **GT America** (Grilli Type) as the primary UI typeface for all body copy, navigation, controls, labels, captions, and form inputs.
- **NFR-BRAND-003 [P1, MUST].** A valid commercial app-embedded license for both type families SHALL be procured from Grilli Type prior to public release on the Apple App Store and Google Play Store. Verification: license documentation on file with Engineering Lead before submission.
- **NFR-BRAND-004 [P1, SHOULD].** Pre-release internal and beta builds MAY substitute Fraunces (for GT Sectra) and Inter (for GT America) under their respective open-source licenses. Substitutions SHALL be removed and replaced with the licensed Grilli Type families before any public-facing release.
- **NFR-BRAND-005 [P1, MUST].** The application SHALL define a fallback type stack (system serif → system sans) that activates when primary fonts fail to load, ensuring no surface degrades to an unstyled state.
- **NFR-BRAND-006 [P1, MUST].** Typography token usage SHALL be enforced via the design system; ad-hoc font declarations in component code are prohibited and SHALL be caught in code review.

### 7.5 Technical Stack Requirements (`NFR-TECH-`)

This section pins the mobile stack at the requirement level so deviations require a documented decision reversal, not a silent dependency swap. Each requirement is testable by inspection of `package.json`, build configuration, or runtime behaviour.

- **NFR-TECH-001 [P1, MUST].** The application SHALL be built with **React Native** (latest stable release at project initialization, with the New Architecture / Fabric enabled) on **Expo SDK 52 or later**. The project SHALL be configured via `expo-router` for file-based routing with the deep-link scheme `flixy://` per FSD § 5.3. Rationale: decision locked in PRD § 16.5.5; cross-platform iOS/Android delivery from a single TypeScript codebase.
- **NFR-TECH-002 [P1, MUST].** The application SHALL be written in **TypeScript** with `strict: true` and `noUncheckedIndexedAccess: true` in `tsconfig.json`. Use of `any` in committed code SHALL be prohibited except via `@ts-expect-error` with an inline justification comment. Verification: type-check passes in CI on every pull request.
- **NFR-TECH-003 [P1, MUST].** The application SHALL use **react-native-reanimated v3** and **react-native-gesture-handler** (current stable) for all gesture-driven and physics-based animations. Direct use of the JS-thread `Animated` API for swipe deck or detail-sheet motion is prohibited. Rationale: NFR-PERF-002 (16ms feedback) and NFR-PERF-003 (≤350ms swipe completion) require UI-thread execution.
- **NFR-TECH-004 [P1, MUST].** Server state (catalogue reads, deck batches, watchlist sync, swipe writes) SHALL be managed by **TanStack Query** (`@tanstack/react-query`). Client/UI state (filter sheet open/close, deck position, ephemeral modal stack) SHALL be managed by **Zustand**. Use of Redux, MobX, or Recoil is prohibited at MVP. Rationale: TanStack Query natively supports the offline mutation queue required by FSD § 3.6.4 and the optimistic update patterns required by NFR-PERF-005.
- **NFR-TECH-005 [P1, MUST].** Backend integration SHALL use **`@supabase/supabase-js`** for database, storage, and (Phase 2) realtime. Authentication orchestration SHALL use **better-auth** on top of Supabase Auth. Auth tokens SHALL be persisted via **expo-secure-store**; non-sensitive cache (TanStack Query persistence) SHALL use **@react-native-async-storage/async-storage**. Rationale: meets NFR-SEC-003 (no secrets in client bundles) and NFR-PRIV-006 (pseudonymous identifiers).
- **NFR-TECH-006 [P1, MUST].** The design system SHALL be implemented with **NativeWind v4** consuming token modules under `apps/mobile/src/theme/`. Fonts SHALL be loaded via **expo-font**. Posters SHALL be cached via **expo-image** with blurhash placeholders. Verification: no raw hex colors or `font-family` declarations outside the theme module — caught by lint rule and code review (per NFR-BRAND-006).
- **NFR-TECH-007 [P1, MUST].** Forms SHALL use **react-hook-form** with **zod** schemas. Schemas SHALL be defined once in a shared package (`packages/shared`) and imported by both the mobile client (form validation) and any server-side validation paths. Rationale: eliminates client/server validation drift; meets NFR-SEC-006 (server-side validation) without duplicating definitions.
- **NFR-TECH-008 [P1, MUST].** Observability SHALL use **@sentry/react-native** for crash and error reporting (with source maps uploaded in the EAS build pipeline) and **posthog-react-native** for product analytics and feature flags. Connectivity awareness SHALL use **@react-native-community/netinfo**. Verification: Sentry events appear in the `flixy-mobile` project on test builds; PostHog events appear on test builds.
- **NFR-TECH-009 [P1, MUST].** Internationalization SHALL use **i18next** + **react-i18next** with locale detection via **expo-localization**. All seven launch locales (en, tr, bg, es, de, fr, pt-BR) SHALL be scaffolded at initialization; en, tr, and bg SHALL be fully translated at MVP per NFR-I18N-002 with the remaining four falling back to English until translation completes. No hard-coded user-facing strings shall exist in JSX — verified by lint rule.
- **NFR-TECH-010 [P1, MUST].** Testing SHALL use **Jest** + **@testing-library/react-native** for unit/component tests, **MSW** for API mocking, and **Maestro** for end-to-end flows (one YAML per critical journey from FSD § 15). CI SHALL fail on a coverage drop below 60% lines on business-logic modules (recommendation, swipe engine, watchlist).
- **NFR-TECH-011 [P1, MUST].** Code style and linting SHALL use **Biome** (single tool, replacing ESLint and Prettier). Pre-commit hygiene SHALL be enforced by **husky** and **lint-staged**; commit messages SHALL conform to Conventional Commits, enforced by **commitlint**.
- **NFR-TECH-012 [P1, MUST].** iOS and Android binaries SHALL be produced by **EAS Build**; over-the-air JavaScript fixes SHALL be delivered via **EAS Update**; store submissions SHALL be performed via **EAS Submit** once Apple Developer Program and Google Play Console accounts are procured. Until those accounts exist, internal preview builds via EAS preview profiles SHALL serve QA and beta testers.

---

## 8. Verification and Acceptance

### 8.1 General Acceptance Criteria
- The system shall pass all `MUST` requirements of priority `P1` for MVP release.
- All `P1, MUST` non-functional requirements shall be measured under load test.
- Beta-period field testing with at least 200 users shall complete with no `Severity 1` defects open.
- The product shall pass internal security review.
- The product shall pass internal accessibility review against WCAG 2.2 AA.
- The product shall be approved by Apple App Store and Google Play.

### 8.2 Verification Methods (per requirement)
- **Inspection:** documentation, code review, design review.
- **Demonstration:** scripted manual demonstration that a behaviour works.
- **Test:** automated unit, integration, end-to-end, or load test.
- **Analysis:** modeling or instrumented measurement (e.g., performance budget tracking).

---

## 9. Appendices

### 9.1 Appendix A — Requirement Index

A flat table of all requirement IDs, priority, phase, and verification method shall be maintained in the engineering tracker (e.g., GitHub Issues with labels) and kept in sync with this document. Updates to requirement IDs trigger a document version bump.

### 9.2 Appendix B — Sample Acceptance Test Outline (for FR-SWP-001 "Swipe right to watchlist")

- **Pre-conditions:** User authenticated; deck contains ≥1 title; watchlist count = N.
- **Steps:** Trigger a right-swipe gesture on the top card.
- **Expected:**
  - Card animates off-screen to the right within 350 ms (NFR-PERF-003).
  - Title appears in watchlist with priority `normal`.
  - Watchlist count = N+1.
  - Swipe is recorded server-side with the correct direction and a session ID.
  - Telemetry event `swipe.right` is emitted with the title ID.
  - Re-issuing the same swipe (idempotent) does not result in a duplicate watchlist entry.

### 9.3 Appendix C — Open Issues (Engineering)

1. Streaming-availability provider selection (Watchmode vs JustWatch vs blended).
2. Recommendation engine v1 scope (rule-based + content-similarity vs early collaborative filter).
3. Real-time transport for Co-Swipe (Phase 2; Supabase Realtime vs dedicated service).
4. Payment processor for premium tier (StoreKit/Play Billing vs Stripe via web).

### 9.4 Appendix D — Glossary

See PRD § 15.

---

**End of SRS.**
