# Functional Specification Document — Flixy

> Companion to the Flixy PRD and SRS. Describes module-by-module functional behaviour, data flow, screens, states, business rules, and edge cases in implementation-level detail.

---

## 0. Document Control

| Field | Value |
| --- | --- |
| Document Title | Functional Specification Document — Flixy |
| Version | 1.2 (Draft) |
| Status | Draft for review |
| Author | Melih |
| Date | April 26, 2026 |
| Audience | Engineering, QA, Design (implementation-time reference) |
| Companion Documents | PRD, SRS |

### 0.1 Revision History
| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0 | 2026-04-25 | Melih | Initial complete draft |
| 1.1 | 2026-04-26 | Melih | Renamed product SwipeReel → Flixy; deep link scheme `swipereel://` → `flixy://`; added § 4.0 Design System Foundations (typography tokens, decisions log) |
| 1.2 | 2026-04-26 | Claude Code | Locked mobile stack in § 2.1; logged stack decision in § 4.0.1 Design Decisions Log; closed Open Item § 13 #1 (mobile framework selection) |

---

## 1. Introduction and Scope

This Functional Specification Document (FSD) describes how the Flixy system behaves at a functional level. Where the SRS specifies *what* the system must do, the FSD specifies *how* it behaves — module by module, screen by screen, rule by rule, edge case by edge case. The FSD is the implementation-time reference for engineering and QA; it is normative for behaviour but does not prescribe technology choices unless they are settled.

The FSD is structured as follows:

- A system-overview section (architecture and data flow).
- A module catalogue with a fully detailed specification per module.
- A screen-level UX specification.
- A description of state, navigation, and gestures.
- An API specification (descriptive — endpoints, purpose, inputs, outputs, errors).
- A business rules catalogue.
- An error-handling and edge-cases catalogue.
- A telemetry and analytics catalogue.
- Acceptance criteria and open items.

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture

The Flixy system is composed of seven logical components.

- **Mobile Client.** The user-facing application on iOS and Android. Responsible for rendering the swipe deck, handling gestures, caching, queueing offline writes, and capturing telemetry. Built on **React Native** (latest stable, New Architecture enabled) atop **Expo SDK 54+** with TypeScript strict mode; gestures and animations execute on the UI thread via `react-native-reanimated` v4 and `react-native-gesture-handler`. Stack and rationale are recorded in PRD § 16.5.5 and pinned in SRS § 7.5 (NFR-TECH-001..012).
- **Edge / API Gateway.** The public, internet-facing entry point for all client requests. Handles authentication, rate limiting, request validation, response shaping, and per-region routing. Built as a serverless or edge runtime to minimize p95 latency.
- **Core API Service.** Stateless application services that implement the business logic for accounts, lists, recommendations, search, social, and notifications. Each service is independently deployable but co-located in the MVP for operational simplicity.
- **Recommendation Service.** The deck generator. Reads the user's taste profile, list state, applied filters, and the catalogue index. Produces an ordered batch of cards. Hot path; must be fast.
- **Real-Time Service (Phase 2).** Maintains live Co-Swipe sessions. Uses a websocket-class transport. Stateless application instances with session state in a fast key-value store.
- **Background Job Workers.** Long-running and scheduled work: catalogue ingestion from TMDB, availability sync from Watchmode, notification dispatch, periodic cleanup, analytics roll-ups. Built on Trigger.dev.
- **Data Tier.** Primary relational database (Postgres via Supabase), object storage for cached media and user uploads, a search index, a key-value cache, and an analytics warehouse fed by event streams.

### 2.2 Data Flow — Daily User Session

A typical session executes roughly as follows:

The client opens, restores its session token, and asks the API for the next deck batch with the user's current filters. The API forwards the request to the recommendation service, which composes a deck from the catalogue index, the user's swipe history, the user's taste profile, exploration quotas, and freshness rules. The API returns the deck to the client. The client renders the top card. As the user swipes, the client persists the swipe locally (queueing), animates the card off-screen, displays the next card, and asynchronously sends the swipe to the API. The API updates lists and the user's taste signal. When the deck nears empty, the client requests the next batch. When the user opens a detail view, the client requests detail data and trailer references; the trailer is played by an embedded player. When the user opens the watchlist, the client requests the watchlist with current availability, refreshing stale entries on demand.

### 2.3 Data Flow — Catalogue Ingestion

The ingestion worker runs on a daily schedule. It pulls TMDB's "popular," "trending," and "now playing/airing" lists for each launch region, deduplicates against the existing catalogue, fetches detailed records for new or changed titles, normalizes them, and writes to the catalogue. A separate availability worker queries Watchmode for streaming availability per region per service for the active catalogue. A third worker recomputes popularity rankings and exploration pools. Errors are logged with retry but never block the pipeline.

### 2.4 Data Flow — Notification Dispatch

A scheduled worker queries notification candidates: users who have new releases on their services, watchlist items leaving soon, or who have been inactive for a configurable period. For each candidate, the worker checks notification preferences and quiet-hours rules, composes a payload (with feature-flagged copy variants), and dispatches to APNs/FCM. Delivery results are logged. Open events round-trip back to the analytics pipeline.

### 2.5 Cross-Cutting Concerns

- **Authentication and authorization** are handled by the auth backend (Supabase Auth via BetterAuth); each API request is verified at the edge.
- **Observability** uses structured logs, metrics, and distributed traces with a request ID propagated client-to-server.
- **Feature flags** (PostHog) gate every non-trivial feature for safe rollout.
- **Configuration** is environment-scoped; production secrets are never colocated with development.
- **Resilience** is provided through idempotent writes, retries with backoff, circuit breakers around third-party providers, and a queued-write client model for offline tolerance.

---

## 3. Module Specifications

This section breaks the system into modules. Each module is described with: purpose, responsibilities, inputs, outputs, business rules, state diagram (where relevant), error handling, and edge cases.

### 3.1 Authentication Module

#### 3.1.1 Purpose
Establish and manage the user's identity. Convert anonymous sessions to registered accounts. Issue and refresh tokens. Allow secure sign-in/out and account deletion.

#### 3.1.2 Responsibilities
- Provision a device-bound anonymous identity at first launch.
- Sign up via email/password, Apple, or Google.
- Sign in with the same providers.
- Email verification flow.
- Password reset flow.
- Token issuance, refresh, and revocation.
- Sign out (device, all devices).
- Account deletion with grace period.
- GDPR data export.

#### 3.1.3 State Model — Account
- `anonymous` — device-bound, no email/social provider linked.
- `pending_verification` — registered but email not yet verified.
- `active` — verified or social-provider-backed.
- `deletion_pending` — user requested deletion; 30-day grace.
- `deleted` — terminal; PII purged.
- `locked` — temporary, due to repeated auth failures.

#### 3.1.4 Business Rules
- Anonymous identities are upgraded atomically: when a user signs up, the system attaches their existing device session's data to the new account in a single transaction.
- Email verification is required for notifications and (Phase 2) social features.
- A user signing in via Apple cannot have an unverified email; Apple's relay email is treated as verified.
- Failed-login lockout: 10 failures in 15 minutes triggers a 30-minute lockout. The lockout counter resets after a successful login.
- Password requirements: ≥10 characters, with at least one number or symbol; rejected against a known-breach list.
- Token lifetime: access token 60 minutes, refresh token 60 days, sliding.
- Sign-out from one device revokes the access token and the device's refresh token; sign-out from all devices revokes all refresh tokens.
- Account deletion sets `deletion_pending`, schedules a worker to erase or anonymize within 30 days, and sends a confirmation email with a single-use undo link valid for 7 days.

#### 3.1.5 Error Handling and Edge Cases
- Email already in use → return a generic "this email cannot be used right now" message and an account-recovery affordance.
- Apple/Google token verification failure → fail closed; ask the user to retry.
- Email service outage → block password reset and verification with a friendly retry CTA; do not silently succeed.
- A device with two anonymous sessions (e.g., user reinstalled and then signs in) → on sign-in, prompt to merge if the local data is non-trivial.
- Account in `deletion_pending` attempts to sign in → show "Welcome back — restore your account?" and allow undo.

### 3.2 Onboarding Module

#### 3.2.1 Purpose
Capture the minimal signal needed to make the first 50 swipes feel personalized.

#### 3.2.2 Responsibilities
- Detect region and locale; allow override.
- Collect streaming services owned.
- Collect favorite genres.
- Run a 10-card cold-start swipe round.
- Request notification permission with rationale.

#### 3.2.3 Flow
1. Splash → 2-second brand moment.
2. Welcome screen with one-line value statement and a CTA to begin.
3. Region/locale auto-detected; user confirms.
4. Services screen — multi-select grid of service logos for the user's region. Minimum one selection required.
5. Genres screen — chip selection. Minimum 3, maximum 12. Required.
6. Cold-start swipe round — 10 cards, full deck behaviour but no filters and a curated mix (see PRD Appendix A).
7. Notification permission rationale → OS prompt.
8. Drop into main feed.

#### 3.2.4 Business Rules
- The 10-card cold-start titles are sampled freshly per user from a curated pool, with diversity enforced (genre balance, era balance, language balance).
- Onboarding is resumable; partial state is persisted server-side after step 4.
- Skipping a step that has a "skip" affordance assigns sensible defaults.
- Onboarding completion event triggers the cold-start recommendation seed.

#### 3.2.5 Edge Cases
- A user backgrounds the app mid-onboarding: state is preserved up to and including the last completed step.
- A user's region cannot be detected: default to user's device locale country; allow change.
- A user denies notification permission: app proceeds normally; settings allow re-prompting later via deep link to OS settings.

### 3.3 Profile Module

#### 3.3.1 Purpose
Manage the user's profile attributes: handle, display name, avatar, locale, region, services, content preferences.

#### 3.3.2 Responsibilities
- Store and update profile attributes.
- Validate handle uniqueness (lowercased, 3–20 chars, alphanumeric + underscore).
- Manage avatar upload (Phase 2 if avatars are user-uploaded; MVP can use defaults).
- Expose profile read-only to the user; expose the public-shape projection to friends in Phase 2.

#### 3.3.3 Business Rules
- Handles cannot be re-used within 90 days of release.
- Display names allow Unicode but block formatting tricks (zero-width characters, RTL overrides).
- Region and locale changes invalidate cached availability data and re-personalize the deck.
- A profanity check applies to handles and display names.

#### 3.3.4 Edge Cases
- A region change mid-session refreshes the deck and the watchlist availability data.
- A locale change updates UI strings on the next render and reloads localized titles where available.

### 3.4 Content Catalogue Module

#### 3.4.1 Purpose
Maintain the canonical catalogue of titles with metadata, localization, and availability.

#### 3.4.2 Responsibilities
- Ingest from TMDB on schedule.
- Normalize records; deduplicate; assign internal IDs.
- Maintain a region-aware availability index from Watchmode.
- Expose read APIs to the recommendation service, search service, and detail view.
- Support admin overrides (hide title, fix metadata error, add a manual feature flag to a record).

#### 3.4.3 Business Rules
- A title is identified by its TMDB ID and content type. Cross-content-type titles (e.g., a book and a film with the same name) are distinct.
- Synopses are localized when TMDB provides; English fallback otherwise. Empty synopses are replaced with a generated short string from genre tags.
- Adult content (TMDB `adult` flag) is excluded from the catalogue at MVP.
- Children's content (rated G/U; primary genre `Family` or `Kids`) is excluded from default decks but available via specific filters or modes (Phase 2 candidate).
- Trailer reference is the highest-popularity YouTube reference TMDB returns for the title.
- Availability records older than 14 days are flagged stale; older than 30 days are excluded from the deck unless no fresher data exists.

#### 3.4.4 Ingestion Specification
- Daily job: pull "popular," "trending today," "now playing/airing" for each launch region; merge with existing catalogue.
- Weekly job: long-tail freshness pass.
- Hourly job (lightweight): trigger on TMDB webhook events if available; otherwise nightly delta poll.
- Backfill: a one-shot ingestion that pre-populates catalogue with the top N titles per region at launch.

#### 3.4.5 Edge Cases
- TMDB returns a title with a corrupt poster URL → the record is kept but a fallback poster is shown.
- TMDB merges two title IDs → the system maps the deprecated ID to the survivor and rewrites references.
- Watchmode reports availability for a service the user does not have → still recorded; surfaced in detail view but not highlighted on the card.

### 3.5 Recommendation / Deck Module

#### 3.5.1 Purpose
Generate the next batch of cards for a user.

#### 3.5.2 Responsibilities
- Compose a deck of 50 cards optimized for personalization, availability, freshness, and exploration.
- Honor user filters and mood presets.
- Exclude lists (seen, watchlist already, recent passes).
- Maintain a session seed for reproducibility.
- Log the rule trace per selected card.

#### 3.5.3 Algorithm — Layered Composition

Deck composition uses a **layered, weight-blended approach**:

- **Layer 1 — Hard filters.** Apply user's region, services, content type, and any active mood/genre/runtime/decade filters. Exclude seen, watchlist, recent passes. Result: a candidate pool of eligible titles.
- **Layer 2 — Personalization scoring.** Score each candidate by similarity to the user's positive swipe set (right + up swipes), using a content-based similarity vector built from genre tags, language, era, and top cast. Penalize similarity to the negative set (left + down swipes).
- **Layer 3 — Popularity prior.** Add a popularity prior weighted higher when the user has fewer than 50 swipes (cold start) and lower as the user accumulates signal.
- **Layer 4 — Availability prior.** Boost titles available on the user's owned services. Soft-suppress titles only available on services the user does not own (do not exclude; show to surface "you might like to try this service").
- **Layer 5 — Diversity and exploration.** Sample 10–20% of cards from outside the user's strict preference profile to combat filter bubbles. Enforce diversity: no more than 3 consecutive cards in the same primary genre.
- **Layer 6 — Freshness.** Boost titles released in the last 90 days proportional to their popularity.
- **Layer 7 — Cool-down.** Demote titles passed within 24 hours and titles already shown to the user in the last 7 days that they did not act on (no swipe).

The output is an ordered list of 50 candidates with attached rule traces.

#### 3.5.4 Business Rules
- The recommendation service does not block on availability fetches; it uses cached availability and accepts stale data within freshness limits.
- The deck endpoint always returns a non-empty deck unless the user has truly exhausted the eligible pool, in which case the response is an empty deck plus a recommendation to broaden filters.
- Decks are cached briefly (1–5 minutes per user) to absorb rapid re-renders without recomputation.
- Mood presets translate to filter sets. They are not separate paths in the algorithm.

#### 3.5.5 Edge Cases
- Fewer than 50 candidates after hard filters → return what is available, mark the deck as "narrow," surface a CTA to broaden.
- Empty taste signal (anonymous, day-zero) → degrade gracefully to a popularity-driven deck.
- A title in the deck becomes unavailable between batch generation and client render → client requests a replacement seamlessly.

### 3.6 Swipe Engine Module

#### 3.6.1 Purpose
Capture, persist, and propagate swipes, with offline tolerance and idempotency.

#### 3.6.2 Responsibilities
- Receive swipe events from the client.
- Validate and persist.
- Update the user's taste signal.
- Update derived lists (watchlist, seen, pass).
- Emit telemetry.
- Expose an undo API.

#### 3.6.3 Behaviour
- Each swipe is an immutable event with: user ID, title ID, direction, timestamp, session ID, deck position, applied filters snapshot, region.
- Right and up swipes append to the watchlist (priority differs).
- Left swipes append to the pass list with TTL.
- Down swipes append to the seen list and become a hard exclude in the recommender.
- An undo issues a compensating event that reverses list effects but preserves the swipe history (for analytics integrity).
- Idempotency is achieved via a client-supplied event UUID; duplicate UUIDs are accepted but ignored.

#### 3.6.4 Offline Tolerance
- Swipes performed offline are stored in a client-side queue.
- On reconnection, the queue is drained in order, retried with exponential backoff.
- The client's view of the watchlist is optimistically updated; a server-side reconciliation step adjusts on success/failure.
- If a queued swipe fails permanently (e.g., the user has been deleted server-side), the queue is purged and the user is signed out.

#### 3.6.5 Edge Cases
- A user spam-swipes 50 cards in 5 seconds → all swipes are recorded and animations are queued; the card stack does not desynchronize.
- A user undoes the same swipe twice → the second undo is a no-op.
- A swipe arrives for a title that has been hard-deleted upstream → the swipe is recorded against a soft-deleted reference; the recommender will not re-show it regardless.
- A user toggles airplane mode mid-swipe → the swipe queues; UI shows a small "syncing" indicator on reconnection.

### 3.7 Watchlist Module

#### 3.7.1 Purpose
Maintain the ordered list of titles the user wants to watch.

#### 3.7.2 Responsibilities
- Construct the watchlist from positive swipes minus removals.
- Order by priority then time.
- Provide sort and filter options.
- Surface streaming availability.
- Allow reorder by drag.
- Allow removal and "mark as watched."

#### 3.7.3 Business Rules
- Up-swipes go to top; right-swipes go to bottom (within priority `top` and `normal` partitions, respectively).
- Reordering is allowed within a priority partition; moving an item between partitions changes its priority.
- Marking as watched moves the item to the seen list and emits a watch event.
- Bulk operations (clear all, mark multiple watched) are exposed in the watchlist screen's edit mode.

#### 3.7.4 Sorting Options
- Priority + recency (default).
- Date added (newest, oldest).
- Runtime (shortest, longest).
- Streaming service (groups by service).
- Content type (movies, series, etc.).

#### 3.7.5 Edge Cases
- A title in the watchlist is removed from the user's services → still shown but marked "Not available on your services. Available on X."
- A title is upgraded from `normal` to `top` priority → the watchlist reorders without losing scroll position.
- Two devices modify the watchlist simultaneously → server applies the latest write wins per item; client reconciles.

### 3.8 Detail View Module

#### 3.8.1 Purpose
Present full information about a title and allow swipe-equivalent actions.

#### 3.8.2 Responsibilities
- Fetch full title detail (synopsis, cast, director, trailer, availability, ratings).
- Render hero, scrollable sections.
- Auto-play trailer muted when in view.
- Provide swipe-equivalent action buttons.
- Persist scroll position when dismissed.

#### 3.8.3 Layout (top-to-bottom)
- Hero (backdrop + title + meta line).
- Trailer (auto-muted; tap to unmute).
- Action bar (pass / watchlist / top / seen).
- Synopsis.
- Streaming availability.
- Cast (top 8).
- Director / creator.
- Ratings snapshot.
- "Why this card" (premium, optional).
- Related titles strip (deferred to P1.5 if costly).

#### 3.8.4 Business Rules
- The detail view does not advance the deck. Closing it returns to the same card.
- Performing a swipe-action button advances the deck and dismisses the sheet.
- Trailer is loaded lazily; if no trailer exists, the trailer section is hidden.
- Streaming-availability items deeplink with telemetry.

#### 3.8.5 Edge Cases
- A title's detail load fails → show a friendly "Couldn't load details right now" with retry; the card behind remains intact.
- A trailer is taken down mid-render → the trailer section shows a fallback message.

### 3.9 Filter Module

#### 3.9.1 Purpose
Express what kind of content the user wants this session.

#### 3.9.2 Responsibilities
- Provide a filter sheet with mood presets and manual filters.
- Persist filters per session (not per device).
- Apply filters to the recommendation pipeline.
- Provide a result-count preview.

#### 3.9.3 Mood Presets (initial set)
- "Quick laugh" → Comedy + runtime ≤ 110 minutes.
- "Long film night" → Movies + runtime ≥ 130 minutes + critically loved.
- "True crime binge" → Documentary or crime drama series.
- "Hidden gems" → IMDb popularity below threshold but high score.
- "Comfort watch" → user's positive-swipe genres + repeat-friendly.
- "Indie cinema" → Drama / international + festival-recognized.

Mood presets are configurable via remote config.

#### 3.9.4 Business Rules
- Mood presets and manual filters compose. A user can pick "Quick laugh" then add "Spanish" to get short Spanish comedies.
- "Available on my services" is on by default; turning it off broadens the deck across all services.
- Filters reset to defaults when the user explicitly taps a "reset" affordance.

#### 3.9.5 Edge Cases
- A filter combination yields zero results → the deck endpoint returns empty; UI shows "No matches — try removing a filter" with one-tap removal of each.

### 3.10 Search Module

#### 3.10.1 Purpose
Provide directed access to titles and people.

#### 3.10.2 Responsibilities
- Title typeahead.
- Person typeahead.
- Recent searches (local).
- Tap to open detail view.

#### 3.10.3 Business Rules
- Search is debounced at 250 ms.
- Results are ranked by region-aware popularity.
- Person results show the person's name and top-credits inline; tapping a person opens a person view (Phase 2) or a person-search-as-deck experience (an MVP-friendly alternative: filter the deck by person).

#### 3.10.4 Edge Cases
- Network failure during typeahead → show last cached results with a stale indicator.
- Empty input → show recent searches and trending titles.

### 3.11 Streaming Availability Module

#### 3.11.1 Purpose
Surface where a title can be watched in the user's region and route the user there.

#### 3.11.2 Responsibilities
- Render service badges on cards and detail.
- Track click-out events.
- Maintain availability freshness.

#### 3.11.3 Business Rules
- Services the user owns are highlighted; others are visible but secondary.
- Tapping a service attempts native deeplink; falls back to web URL on failure.
- Availability data older than 14 days surfaces a stale-indicator on the detail view.
- Click-outs are logged with the title, service, region, and a tracking ID.

#### 3.11.4 Edge Cases
- Title is "available" but only as a paid rental on a service: distinguish "Subscription," "Free with ads," "Rent," "Buy" via small inline labels.
- Conflict between providers (Watchmode says yes, JustWatch says no) → trust the most-recent timestamp; in MVP we use a single primary provider to avoid conflicts.

### 3.12 Notification Module

#### 3.12.1 Purpose
Bring users back at the right moments without spamming them.

#### 3.12.2 Responsibilities
- Maintain push tokens.
- Schedule and dispatch notifications by category.
- Honor user preferences and quiet hours.
- Log delivery and engagement.

#### 3.12.3 Notification Categories
- **New on your services.** Daily digest, sent at most once per day, at user's local 18:00–20:00 window.
- **Watchlist heads-up.** Triggered events: title leaving in ≤7 days, new release of a title on user's watchlist.
- **Re-engagement nudge.** Triggered events: 3+ days inactive, with copy that references their watchlist or recent swipe.
- **Account/security.** Sign-in from new device, password reset, account deletion confirmation.
- **(Phase 2) Match.** A friend matched on a watchlist title.
- **(Phase 2) Friend activity.** Highly throttled summary, opt-in only.
- **(Phase 2) Co-Swipe.** Real-time invitations and session events.

#### 3.12.4 Business Rules
- The total non-security notification cap is 5 per week unless the user opts in to a more-frequent setting.
- No notification before 9:00 or after 21:00 user-local time except security.
- A notification is suppressed if its triggering condition has changed (e.g., title no longer leaving soon).
- Notification copy is feature-flagged; A/B variants are tested at the dispatcher.

#### 3.12.5 Edge Cases
- Token is revoked by the OS (user disabled push) → the system stops sending and prompts an in-app re-enable on the next session.
- A user has ≥1000 watchlist items and would receive many heads-ups → coalesced to a single "X items leaving soon" notification.

### 3.13 Settings Module

#### 3.13.1 Purpose
Single surface to manage profile, services, language/region, notifications, content preferences, account, subscription, and legal.

#### 3.13.2 Sub-Sections
- **Profile.** Handle, display name, avatar, region, language.
- **Services.** Multi-select edit of streaming services owned.
- **Notifications.** Per-category toggles and preview times.
- **Content preferences.** Hide genres, hide content types, language preferences, runtime preference, exploration intensity slider.
- **Account.** Email change, password change, sign out, sign out all devices, data export, account deletion.
- **Subscription.** Status, plan, renewal date, manage in store.
- **About / Legal.** Version, privacy policy, terms, attributions.
- **Help.** FAQ, contact email.

#### 3.13.3 Business Rules
- Changes auto-save; UI shows a brief confirmation.
- Data export creates a downloadable archive within 72 hours; a notification is sent when ready.
- Account deletion requires re-authentication and a typed confirmation phrase.

### 3.14 Analytics & Telemetry Module

#### 3.14.1 Purpose
Capture product usage events for analytics, recommender training, and decisioning.

#### 3.14.2 Event Catalogue (initial set)
- `app.opened` — properties: client version, locale, push-source.
- `onboarding.step_completed` — properties: step name.
- `onboarding.completed` — properties: total time, services count, genres count.
- `deck.requested` — properties: filter snapshot, deck size, server-source.
- `deck.empty` — properties: filter snapshot.
- `swipe.right`, `swipe.left`, `swipe.up`, `swipe.down` — properties: title ID, deck position, session ID, dwell time on card.
- `swipe.undo` — properties: original direction.
- `card.detail_opened` — properties: title ID.
- `trailer.played` — properties: title ID, played duration.
- `clickout.streaming` — properties: title ID, service, attribution ID.
- `watchlist.viewed`.
- `watchlist.item_marked_watched` — properties: title ID, dwell time on watchlist.
- `notification.sent`, `notification.delivered`, `notification.opened` — properties: category, variant.
- `account.created` — properties: provider.
- `account.deleted`.
- `(P2) match.created` — properties: pair, title.
- `(P2) coswipe.session_started` — properties: party size, mode.
- `(P2) coswipe.match` — properties: title, party size.

#### 3.14.3 Business Rules
- Events are batched on the client and flushed every 30 seconds or when the app backgrounds.
- All events carry a pseudonymous user ID and a session ID.
- Events are deduplicated server-side via client-supplied event UUIDs.
- No PII shall appear in event properties.

### 3.15 Phase 2 — Social Modules

#### 3.15.1 Friends Module
- Asymmetric follow primitive (Twitter-style).
- Public profiles by default, switchable to private.
- Block, mute, report.
- Contact-import friend discovery.
- Handle search.

#### 3.15.2 Match Module
- Background job evaluates pairs of mutual followers when one swipes positively.
- Match created if both users have positive swipes on the same title within 30 days.
- Notification sent to both users (opt-in).
- Match list screen.

#### 3.15.3 Co-Swipe Module
- Host creates a session, invites by friend list or shareable link.
- Session uses a real-time transport.
- Deck is generated per-session, blending participants' tastes.
- All participants see the same deck in the same order.
- Participants swipe independently; matches are evaluated as the union of right-swipes per card.
- The first card all participants right-swipe ends the session with a Co-Match.
- Sessions cap at 60 cards or 5 minutes.
- A leave-session control is always available.

#### 3.15.4 Activity Feed Module
- Chronological feed of friends' public events: added to watchlist, marked watched, super-liked, posted comment.
- Reactions allowed.
- Mute and hide affordances.
- No algorithmic ranking at MVP of Phase 2.

#### 3.15.5 Comments Module
- ≤140-char comment optionally attached to a swipe.
- Default visibility friends-only; user can publish to public.
- Moderation pipeline: profanity filter, abuse classifier, manual review queue for flagged content.

---

## 4. UI/UX Specifications

This section enumerates the screens of the MVP and their behaviour. Visual styling is owned by Design; this document specifies functional behaviour, design system tokens, and states.

### 4.0 Design System Foundations

This subsection records the foundational design tokens and decisions that bind on all subsequent screen and module specifications. Token values represent the contract — any deviation in implementation must be reviewed and reflected here.

#### 4.0.1 Design Decisions Log

| Date | Decision | Locked | Rationale |
| --- | --- | --- | --- |
| 2026-04-26 | Product name: **Flixy** | Yes | Replaces working name SwipeReel. Locked in design tool and across all docs. |
| 2026-04-26 | Typography pairing: **GT Sectra (display) + GT America (UI)** | Yes | Sharper editorial cuts pair better with poster-driven cards than PP Editorial New + Inter; Grilli Type designs the families to coexist; differentiates from SaaS-default pairings. |
| 2026-04-26 | Mode strategy: **Dark-first** | Yes | OLED-friendly true black; light mode reserved for post-MVP. Token system must accommodate light mode without refactor. |
| 2026-04-26 | Mobile stack: **React Native + Expo (full library set locked)** | Yes | Single TS codebase for iOS/Android, UI-thread gesture physics via Reanimated v3, EAS Build/Update/Submit release pipeline. Full requirement set pinned in SRS § 7.5 (NFR-TECH-001..012); product-level rationale in PRD § 16.5.5. |
| TBD | Accent color | Pending | Awaiting Design proposal. Candidates: warm coral/red-orange, electric chartreuse, deep cinema-curtain magenta. |
| TBD | Final color tokens (semantic + raw) | Pending | Awaiting Design proposal post-typography sign-off. |

#### 4.0.2 Typography Tokens

The application uses two type families exclusively:
- **GT Sectra** (Grilli Type) — display, editorial, title surfaces. Italic cuts preferred for movie titles.
- **GT America** (Grilli Type) — UI, body, controls, labels.

Pre-release fallback (internal/beta builds only): **Fraunces** for GT Sectra, **Inter** for GT America. Production builds must use the licensed Grilli Type families per SRS NFR-BRAND-003.

System fallback stack (when primary fonts fail to load):
- Display: `'GT Sectra', 'Fraunces', Georgia, 'Times New Roman', serif`
- UI: `'GT America', 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif`

**Type scale** (size / line-height in px; pt values in parentheses for iOS reference). Values are starting points pending Design verification at real device sizes:

| Token | Family / Style | Size / Line-height | Tracking | Usage |
| --- | --- | --- | --- | --- |
| `display-xl` | GT Sectra Italic | 40 / 44 | -0.01em | Detail screen hero title; match screen title (P2). |
| `display-l` | GT Sectra Italic | 28 / 32 | -0.005em | Swipe card title; section heroes. |
| `display-m` | GT Sectra Regular | 22 / 28 | 0 | Modal headers; settings section heads. |
| `display-s` | GT Sectra Regular | 18 / 24 | 0 | Watchlist grid card title; search result title. |
| `body-l` | GT America Regular | 16 / 24 | 0 | Detail screen synopsis; primary body copy. |
| `body-m` | GT America Regular | 14 / 20 | 0 | Default body; list rows; settings labels. |
| `body-s` | GT America Regular | 13 / 18 | 0 | Secondary body; helper text. |
| `label` | GT America Medium | 12 / 16 | +0.04em | Uppercase labels, chip text, button text. |
| `caption` | GT America Regular | 11 / 14 | +0.02em | Metadata, attribution, timestamps. |
| `numeric-tabular` | GT America Medium (tabular figures) | 14 / 20 | 0 | Counts, durations, percentages. |

**Weights in use:** GT America Regular (400), Medium (500), Bold (700). GT Sectra Regular (400), Italic. Bold weights of GT Sectra are not used in MVP.

**Title rendering rules:**
- Movie/show titles SHALL render in `display-l` (swipe card) or `display-xl` (detail hero) using GT Sectra Italic.
- Titles longer than 28 characters truncate with ellipsis on the swipe card; full title shown on detail screen with no truncation up to 80 characters, then truncates.
- Titles SHALL preserve original capitalization from TMDB; no forced uppercase on display.

#### 4.0.3 Token Enforcement

- All component implementations consume tokens via the design system, never via raw font-family declarations.
- Code review checklist includes a typography audit: any direct `font-family` or `fontWeight` outside the token system is rejected.
- Visual regression tests cover the type scale on representative screens.

### 4.1 Screen Map

The MVP has the following primary screens, accessed via a bottom tab bar where applicable:

- Splash / launch.
- Onboarding (multi-step, full-screen).
- Discover (the swipe deck, primary tab).
- Watchlist (secondary tab).
- Search (secondary tab).
- Profile / Settings (secondary tab).
- Detail sheet (modal on top of any tab).
- Filter sheet (modal on top of Discover).
- Auth flows (modal on top of any tab when prompted).
- Empty states for each list and the deck.

### 4.2 Splash / Launch
- Brand moment for ≤2 seconds.
- Background: hydrate auth, fetch a small "boot config" payload (feature flags, force-update flags).
- If a force-update flag is present and the client is below the floor version, show a blocking update screen with a link to the store.

### 4.3 Onboarding Screens

Each step has: a clear heading, a single CTA, a back button (except the first step), and optional skip where applicable.

- **Welcome.** One-line value proposition; "Get started" CTA.
- **Region.** Auto-detected; user confirms or changes via picker.
- **Services.** Grid of service logos for the user's region. Multi-select. Minimum one. CTA disabled until met.
- **Genres.** Chip selection. Min 3, max 12. CTA disabled until met.
- **Cold-start swipe.** Tutorial card overlay on first card; gestural hint that fades on first swipe or after 3 seconds. Cards advance as the user swipes.
- **Notifications.** Rationale screen, then OS prompt.
- **Done.** Brief celebratory confirmation, drop into Discover.

### 4.4 Discover (Swipe Deck)

- Top: small header with current filter chip(s) and a filter icon to open the filter sheet.
- Center: a stack of 2–3 cards visually layered. Top card is interactive.
- Bottom: button bar with four action buttons (pass, watchlist, top, seen) and an "undo" affordance.
- Background: soft, content-aware tint (uses the dominant color of the top card) to keep the focus on the artwork.

#### 4.4.1 Card Visual Specification (functional)
- Hero artwork (poster portrait by default, or backdrop if specified by curation).
- Title overlay at the bottom: **title in `display-l` (GT Sectra Italic)**, year and runtime in `caption` (GT America Regular), primary genre chips (max 2) using `label` token, age rating in `caption`.
- Service badge row (the user's owned services that carry the title) — small logos, max 3 visible, with overflow "+2" rendered in `label` token.
- Tap target on the card body opens detail; dragging the card translates and rotates it.
- Decision stamps ("WATCHLIST", "PASS", "TOP", "SEEN") use `display-m` (GT Sectra Regular) at high opacity above gesture threshold.

#### 4.4.2 Gesture Behaviour
- Right drag: card translates and rotates clockwise; threshold at 35% of width or 600 ms with high velocity triggers right-swipe completion. A "WATCHLIST" stamp appears in green at high opacity above threshold.
- Left drag: mirror; "PASS" stamp in red.
- Up drag: card translates upward; "TOP" stamp in gold.
- Down drag: card translates downward; "SEEN" stamp in blue.
- Below threshold release: card snaps back with a spring.
- Velocity-based shortcut: a flick gesture below the visual threshold but with high velocity completes the swipe in the velocity direction.
- Multi-touch: ignored.
- Long press: opens a contextual menu with the four actions plus "Open details" and "Share" (if present).

#### 4.4.3 States
- Loading (deck): skeleton stack with shimmer.
- Empty deck: friendly empty state with three CTAs (broaden filters, open watchlist, refresh).
- Error: "Something went wrong" with retry.
- Offline: banner; cached deck remains usable; queued writes indicator.

### 4.5 Watchlist

- List view, default sort priority + recency.
- Each row: thumbnail; title in `display-s` (GT Sectra Regular); year, runtime, and primary service badge in `caption` (GT America); overflow menu.
- Tap row: open detail.
- Long press: enter selection mode; bulk actions in toolbar (mark watched, remove, change priority).
- Edit mode: drag handles for reorder, priority partition headers ("Top picks," "Watchlist").
- Pull-to-refresh: re-checks availability for visible items.
- Empty state: explains right-swipes build the watchlist; CTA to start swiping.

### 4.6 Search

- Top: search field, focused on enter.
- Body: typeahead results in two sections (Titles, People).
- Empty state (no input): recent searches + trending now.
- Tap result: open detail (titles) or person-filtered deck (people).

### 4.7 Profile / Settings

- Top: avatar, display name, handle.
- Quick stats: number of swipes, watchlist count, seen count.
- Settings list: as enumerated in 3.13.

### 4.8 Detail Sheet

- Bottom-sheet style, drag-down to dismiss.
- Layout per 3.8.3.
- Pull-up extends to full screen.

### 4.9 Filter Sheet

- Bottom sheet.
- Top: mood preset chips.
- Below: manual filters (genre multi-select, runtime band, decade band, language, services).
- "Apply" CTA at the bottom; sticky.
- "Reset" link in the top-right.

### 4.10 Animation and Motion

- All transitions follow a single motion system with durations ≤350 ms.
- Reduced-motion users see simpler transitions (opacity + position; no rotation).
- Haptics: light impact on right and up swipes only; no haptics on left/down (asymmetric design choice — celebrate positive actions).

### 4.11 Accessibility

- Every gesture has a button equivalent.
- Screen-reader labels on all interactive elements.
- Focus order is meaningful and stable.
- Text scales up to 200%.
- Contrast meets WCAG AA on all surfaces.

### 4.12 Localization Surfaces

- All strings externalized.
- Long languages (German, Turkish) handled with flexible layouts; no truncation on primary CTAs.
- Date and number formats follow locale.

---

## 5. Navigation and State

### 5.1 Tab Navigation

- Bottom tabs: Discover, Watchlist, Search, Profile.
- Discover is the default tab on app launch.
- Tabs preserve their internal navigation state when switching.

### 5.2 Modal Navigation

- Detail, Filters, and Auth flows are modals.
- A modal does not change the current tab; closing returns to the tab's prior state.

### 5.3 Deep Linking

- App links: `flixy://title/{id}`, `flixy://watchlist`, `flixy://settings`, `flixy://coswipe/{session}` (Phase 2).
- HTTPS universal links: `https://flixy.app/title/{id}` etc.
- Push notifications carry a deep-link payload and open the relevant destination.

### 5.4 State Restoration

- The client restores the last tab and the last deck position on launch (within 24 hours).
- After 24 hours, the deck is regenerated.

---

## 6. API Specifications (Descriptive)

This section describes API endpoints functionally. Method, route, purpose, inputs (high-level), outputs, errors, and notes.

### 6.1 Authentication
- **Sign up (email).** Inputs: email, password, locale. Output: account state, tokens. Errors: validation, email-in-use.
- **Sign in (email).** Inputs: email, password. Output: tokens.
- **Sign in (Apple/Google).** Inputs: provider token. Output: tokens.
- **Verify email.** Inputs: verification token. Output: success.
- **Request password reset.** Inputs: email. Output: success.
- **Reset password.** Inputs: token, new password. Output: success.
- **Refresh token.** Inputs: refresh token. Output: new access token.
- **Sign out.** Inputs: device flag (this device or all). Output: success.
- **Delete account.** Output: confirmation, schedules deletion.

### 6.2 Profile and Preferences
- **Get profile.**
- **Update profile.** (handle, display name, avatar, region, locale)
- **Get preferences.**
- **Update preferences.** (services, genres, language, runtime, decade, exploration)
- **Reset onboarding.**

### 6.3 Catalogue and Detail
- **Get title detail.** Inputs: title ID, locale. Output: full detail including availability for the user's region.
- **Get title trailer reference.** (often inlined in detail).
- **Search titles.** Inputs: query, type filter. Output: ranked results.

### 6.4 Deck and Swipes
- **Get next deck batch.** Inputs: applied filters, deck cursor. Output: ordered cards with rule traces (premium).
- **Submit swipe.** Inputs: event UUID, title ID, direction, deck position, session ID. Output: ack and updated list state hints.
- **Undo last swipe.** Inputs: event UUID to compensate. Output: ack.

### 6.5 Lists
- **Get watchlist.** Inputs: sort, filter, pagination. Output: items with availability state.
- **Update watchlist item.** (priority, position).
- **Remove from watchlist.**
- **Mark watched.**
- **Get seen list.**
- **Remove from seen list.**

### 6.6 Notifications
- **Register push token.**
- **Get notification preferences.**
- **Update notification preferences.**

### 6.7 Phase 2 — Social
- **Friend search.**
- **Send/cancel/accept friend or follow request.**
- **Get profile (public projection).**
- **Block/unblock user.**
- **Get matches.**
- **Start co-swipe session.**
- **Join co-swipe session.**
- **Submit co-swipe swipe.**
- **Leave co-swipe session.**
- **Get activity feed.**
- **Post comment.**
- **React to feed item.**

### 6.8 Errors

- All errors return a stable error code, a user-safe message, and a debug ID.
- Error codes are documented in a separate engineering reference.
- Auth errors return 401; permission errors return 403; not found returns 404; validation returns 422; rate limited returns 429; server errors return 500.

---

## 7. Business Rules Catalogue

This is a curated set of rules that span modules.

- **BR-01.** A title can appear on a user's deck at most once per 7 days unless explicitly re-introduced via filter/search/detail.
- **BR-02.** A user's seen list is a hard exclude in the deck; nothing overrides it except a user explicitly removing the entry.
- **BR-03.** A pass list entry expires after 90 days unless refreshed by another left-swipe.
- **BR-04.** Up-swipes are stronger personalization signal than right-swipes (weight 1.5x).
- **BR-05.** Down-swipes carry a small *negative* personalization signal (the user has seen it, regardless of like/dislike), unless paired with a future-rating feature in Phase 2.
- **BR-06.** Adult content is excluded at MVP regardless of age verification.
- **BR-07.** Children-only content is excluded from default decks.
- **BR-08.** Non-English titles surface only with localized synopses; if no localization exists for the user's locale, English is used and a discreet language tag is shown.
- **BR-09.** A title's availability is region-scoped; deck candidates respect the user's current region only.
- **BR-10.** A user changing region is treated as a partial reset of availability filters (not a reset of taste signal).
- **BR-11.** Phase 2 matches require mutual following at the time of evaluation; unfollow severs match notifications.
- **BR-12.** Phase 2 Co-Swipe sessions are ephemeral; their state is not persisted beyond the session except for the resulting Co-Match (if any) and aggregated telemetry.
- **BR-13.** Premium status is checked on every premium-gated action server-side; client-side checks are advisory only.
- **BR-14.** Click-out attribution is logged but never affects ranking.
- **BR-15.** Soft-delete of a title hides it from decks and search but preserves user list references.

---

## 8. Error Handling and Edge Cases

This section catalogues recurring failure modes and the canonical handling.

### 8.1 Network Failures
- Read failures: show inline retry with exponential backoff; never lose user state.
- Write failures: queue locally; retry with backoff; surface a non-blocking "syncing" indicator.

### 8.2 Authentication Failures
- Token expiry: client transparently refreshes; only surfaces re-auth if the refresh fails.
- Refresh failure: sign out gracefully; preserve the in-flight queue and present a sign-in prompt.

### 8.3 Catalogue / Recommendation Failures
- Recommendation service degraded: fallback to a popularity-driven cached deck.
- Title detail fails: retry on screen; do not block other actions.

### 8.4 Streaming Availability Failures
- Provider down: serve from cache; mark all entries as stale.
- Deeplink fails: fall back to web URL; if web fails, surface a friendly "Couldn't open the app — try opening from the streaming app directly."

### 8.5 Notification Failures
- Token invalid: silently retire token; prompt re-enable on next session.

### 8.6 Edge Cases (Selected)
- A user signs in on a new device that has its own anonymous swipe history → on sign-in, the system offers a one-time merge with a confirmation.
- A user changes their handle to one that conflicts with a recently released handle (within 90-day reuse window) → handle is rejected with a clear message.
- A user turns off all streaming services → the deck warns "You have no services selected — we'll show titles across all services."
- A user marks every card as 'seen' for a session → the deck refresh shows an empty state suggesting filter changes.
- A title is added to availability for a service but not yet to the catalogue → the availability worker queues the title for catalogue ingestion.
- A user reports another user (Phase 2) → the report enters a moderation queue with SLAs.

---

## 9. Performance Budgets

- Cold start to first interactive frame: 2.5 seconds.
- Deck batch fetch: ≤500 ms p95 on a healthy network.
- Swipe gesture to next card visible: ≤350 ms.
- Detail sheet open to first paint: ≤300 ms.
- Trailer first frame: ≤2 seconds.
- Search typeahead: ≤200 ms p95 server-side, ≤350 ms client-perceived.
- Watchlist load: ≤500 ms p95 for first 50 items.

Each budget has corresponding telemetry (event timing) so regressions trigger alerts.

---

## 10. Security Specifications (Operational)

- **Threat model coverage.** Cover the OWASP Mobile Top 10 and OWASP API Security Top 10. Document assumptions, mitigations, and residual risks.
- **Rate limits.**
  - Auth endpoints: 10 attempts / 15 minutes / IP and / account.
  - Search: 60 / minute / user.
  - Swipe submit: 600 / minute / user (high cap; abuse detection on patterns).
  - Notification token register: 10 / hour / user.
- **Input validation.** All client inputs validated server-side. All catalogue references validated against the catalogue.
- **Authorization.** Row-level security on user-owned data. Admin operations gated behind explicit roles.
- **Secrets management.** Production secrets in a managed store; local development uses isolated secrets that cannot be promoted.
- **Dependency hygiene.** Automated dependency scanning on each pull request.
- **Privacy-by-design.** Data minimization in event payloads; pseudonymous identifiers in analytics.

---

## 11. Telemetry and Observability

- **Logs.** Structured, leveled, JSON. Always include request ID, user pseudonym, client version, route.
- **Metrics.** RED method (rate, errors, duration) for every API. Custom metrics for deck composition, recommendation quality proxies, notification engagement, and offline-queue length.
- **Traces.** End-to-end request traces from client through API to data tier.
- **Alerts.** SLO-based alerts on availability and latency. Anomaly alerts on swipe-submit failure spikes and login-failure spikes.
- **Dashboards.** A small, opinionated set of dashboards: Product (DAU, sessions, swipes, retention), Reliability (SLOs, error budgets), Recommendation Health (CTR, watchlist conversion, exploration share), Notifications (delivery, open, opt-out).

---

## 12. Acceptance Criteria

The MVP is ready for general availability when the following conditions hold:

- All `P1, MUST` requirements in the SRS are implemented and verified.
- All performance budgets in this FSD are met for two consecutive weeks of beta.
- WCAG 2.2 AA review passes with no Severity 1/2 findings.
- Security review passes; no Severity 1 findings open.
- Beta cohort of ≥200 users hits an activation rate ≥55% and D7 retention ≥35%.
- Crash-free session rate ≥99.5%.
- Apple App Store and Google Play approvals received.
- Typography: production builds use licensed GT Sectra and GT America (no Fraunces/Inter fallbacks shipped); design system token usage verified by visual regression suite; type scale matches § 4.0.2.
- Operational runbook complete: incident response, data export request handling, account deletion handling, content moderation (Phase 2 readiness).

---

## 13. Open Items

- Streaming-availability provider final selection.
- Premium tier launch timing — recommendation: month 6 post-launch.
- Co-Swipe session backend (Phase 2) — Supabase Realtime vs dedicated service.
- "Why this card" copy generation — template-based vs LLM-backed.
- Adult content gating: out of scope but track demand.
- Children's content mode: out of scope but track demand.
- TV companion (Phase 3): tracked in roadmap.

---

## 14. Glossary

See PRD § 15 and SRS § 1.6.

---

## 15. Appendix — Sample User Journeys (Functional Walk-Through)

### 15.1 Returning User, 6-Minute Evening Session

The user's phone shows a push at 19:42: "3 titles are leaving Netflix this week." She taps it. The app cold-starts and routes to the watchlist filtered by "leaving soon." She sees three titles. She taps the top one, *Title A*, and reads the synopsis. The trailer auto-plays muted. She taps "Watch on Netflix." The app deeplinks her to Netflix at the title page; the app records a click-out event with the title and service. She watches the film for 30 minutes, then returns to Flixy. The app remembers her last position. She taps Discover. The deck has been freshly fetched in the background. She swipes right on three titles, left on five, down on one (a film she watched last year), then taps the filter icon and selects "Quick laugh." A new deck appears within 800 ms. She swipes right on two more titles, then closes the app.

Behind the scenes: 11 swipe events queued and synced; 1 click-out logged; deck fetch with new filter executed; her taste profile incremented for the new positives. The next morning, the daily digest job sees a new release matching her freshly added watchlist priorities and queues a notification for the next 18:00 window.

### 15.2 New User, First Session

The user installs the app from a TikTok review. The brand splash plays. The welcome screen offers "Get started." Region auto-detected as Bulgaria; she taps next. Services: she selects Netflix and HBO Max. Genres: she taps Drama, Thriller, Documentary, Comedy. Cold-start swipes: she gets 10 cards across genres; she swipes right on five, left on four, down on one. Notifications: she taps "Maybe later." She lands in Discover. After 8 swipes the app shows a soft prompt: "Save your progress?" She taps it, signs in with Google. The anonymous identity is upgraded; her watchlist now persists. She continues to swipe for 4 minutes (45 swipes), her watchlist now has 14 items, and she closes the app.

Behind the scenes: anonymous device session created; onboarding state persisted at each step; 10 cold-start signal events recorded; account created via Google; data migration completed atomically; activation event fired.

### 15.3 (Phase 2) Couple Co-Swipe

The user opens Discover and taps "Watch with…" She picks her partner from her friends list. He gets a push within seconds. He taps it; the Co-Swipe session opens on both phones. Both see the same first card. She swipes right; the UI shows a small "1/2" indicator. He swipes left. The card advances. They go through 11 cards. On the 12th, both swipe right within 200 ms of each other. Both phones show a Match screen: *Title X*, a "Watch now" CTA. They tap the CTA on her phone; it deeplinks to Netflix. Match recorded; session ended; aggregated telemetry written.

---

**End of FSD.**
