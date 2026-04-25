# Product Requirements Document — Flixy

> **Working name:** Flixy. Final brand TBD.
> **Tagline (working):** *"Stop browsing. Start watching."*

---

## 0. Document Control

| Field | Value |
| --- | --- |
| Document Title | Product Requirements Document — Flixy |
| Version | 1.0 (Draft) |
| Status | Draft for review |
| Author | Melih |
| Date | April 25, 2026 |
| Document Type | Product Requirements Document (PRD) |
| Audience | Product, Engineering, Design, Data, Marketing, Investors |
| Companion Documents | SRS (Software Requirements Specification), FSD (Functional Specification Document) |

### 0.1 Revision History
| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 0.1 | 2026-04-25 | Melih | Initial outline |
| 1.0 | 2026-04-25 | Melih | First complete draft (MVP + Phase 2 social vision) |

---

## 1. Executive Summary

Flixy is a mobile-first, gesture-driven content discovery and watchlist app for movies, TV series, documentaries, and anime across all major streaming platforms. The interaction model is taken directly from Tinder: one full-screen card at a time, four decisive gestures, no menu trees, no search-first friction, no infinite grids of posters. The user opens the app and is immediately entertained while building a personal taste graph and a useful watchlist as a side effect.

The product solves a problem every streaming subscriber has: **decision fatigue**. The average viewer spends 18 minutes per session deciding what to watch on Netflix alone, and a meaningful share of sessions end without anything being watched at all. Flixy converts that wasted time into a fast, addictive, low-cognitive-load loop.

The product strategy has two phases:

- **Phase 1 — MVP (Single-Player Discovery):** A polished, fast, beautiful swiping experience for one person. The app must feel as good in the hand as Tinder does. Watchlist, filters, streaming availability, trailers, basic taste personalization. This is the wedge.
- **Phase 2 — Social Layer (Network):** Friends, follows, an activity feed, *Movie Match* (when two people both swipe right on the same title), Co-Swipe sessions (real-time joint swiping for couples, families, friend groups), in-thread title chat, ratings, mini-reviews, taste-twin discovery. This is where the product becomes a social network and where retention/virality compound.

This PRD defines the MVP in full detail and frames the Phase 2 envelope so the MVP architecture does not need to be rewritten when social ships.

---

## 2. Background and Problem Statement

### 2.1 The Decision Fatigue Problem

Every major streaming service now has 5,000–15,000 titles. Recommendation algorithms inside those services optimize for retention on that single service, not for the user's overall enjoyment, and they surface the same handful of "originals" repeatedly. The interface is a grid of posters that requires the user to scan, hover, read synopses, sometimes watch a trailer, and ultimately decide — for every potential title. The cognitive cost is high and the activity is *not fun*. It is not entertainment in itself.

The result is a well-documented behavioural pattern:

- Users open the app, scroll for 15–30 minutes, and either watch something they have already seen or watch nothing at all and leave.
- Couples and groups argue about what to watch and frequently default to a known-safe rewatch.
- Users feel frustrated and increasingly believe "there is nothing to watch" despite the catalogue being larger than ever.
- Discovery happens on TikTok, YouTube, Reddit, and friend recommendations — outside the streaming services themselves.

### 2.2 The Discovery Gap

Existing content discovery products fall into three buckets:

- **Tracker / log apps** (Letterboxd, Trakt, Simkl, IMDb watchlists). Powerful but high-effort, search-first, list-driven. Built for the cinephile, not the casual viewer.
- **Aggregators** (JustWatch, Reelgood). Solve the "where is it streaming" problem, but discovery is still a grid + filter experience.
- **Social/recommendation feeds** (Likewise, Letterboxd activity feed). Either too niche or too dependent on the user already having an opinion to share.

None of them treat the *act of choosing what to watch* as the product itself. None of them feel like a game. None of them meet the user where they are: bored on the couch, opening their phone, looking for something to do for 90 seconds before they commit to two hours.

### 2.3 The Social Viewing Gap

What people watch is one of the most common conversational topics among friends, partners, and coworkers, yet it is one of the worst-served social graphs online. The "what are you watching?" question has no good app-shaped answer. Co-watching decisions ("what should *we* watch tonight?") have no app at all. Flixy intends to own this graph.

### 2.4 Why Now

Three forces make this the right moment:

- **Streaming saturation.** Most households now have 3+ services and the catalogue overlap is small. Cross-platform discovery has more value than ever.
- **Trained gesture vocabulary.** Tinder, TikTok, Reels, and Hinge have made swipe gestures universal. New users do not need to learn the metaphor.
- **Mature content APIs.** TMDB, Watchmode, JustWatch, and similar APIs make a global, multi-platform catalogue accessible to a small team.

---

## 3. Vision and Strategy

### 3.1 Long-Term Vision (3–5 years)

> **Flixy becomes the social graph of taste in entertainment — the place where the world decides, together, what to watch next.**

The end-state product is:

- A **network** where everyone you know has a public taste profile.
- A **co-watch decision engine** that solves the "what should we watch tonight" question for any pair or group in under two minutes.
- A **taste-driven recommendation system** that beats every individual streaming service's in-app recommender, because it has cross-platform signal and real social signal.
- A **commerce layer** that drives qualified, attributable click-throughs to streaming services and rentals, with affiliate revenue and, eventually, B2B signal-licensing to studios and platforms.

### 3.2 Product Strategy: Wedge → Network → Platform

| Stage | What it is | Why it matters |
| --- | --- | --- |
| Wedge (MVP) | Single-player swiping discovery + watchlist | Solves a real, daily, individual pain. Attracts users with no social pressure. |
| Network (Phase 2) | Friends, Match, Co-Swipe, activity, chat | Adds retention, virality, and the social moat. Each new friend exponentially increases utility (Co-Swipe, Match). |
| Platform (Phase 3) | Public taste profiles, creators, lists, B2B data, affiliates | Monetization, content marketing flywheel, defensibility through network effects. |

### 3.3 Core Product Principles

1. **Gesture beats menu.** Every primary action is a swipe.
2. **One card at a time.** No grids on the main surface.
3. **Cards must be beautiful.** This is an entertainment product, not a database. The hero artwork, type, and motion are the product.
4. **Decision in under 2 seconds.** A user should be able to make a swipe decision on a card in under two seconds without reading anything.
5. **Watchlist as a side effect.** The user is having fun; the watchlist builds itself.
6. **Streaming-aware, not streaming-tied.** We never assume the user is on any one platform.
7. **The social layer makes the single-player layer better, not noisier.**

---

## 4. Goals and Success Criteria

### 4.1 Business Goals (12 months)

- **G1.** Reach 100,000 monthly active users (MAU) by month 12 post-launch.
- **G2.** Achieve a Day-30 retention rate of 25% or higher.
- **G3.** Validate at least one monetization channel (premium subscription OR streaming affiliate) at $0.50+ ARPU/month.
- **G4.** Establish Flixy as the top result for "tinder for movies" searches in app stores in the launch markets.

### 4.2 Product Goals (MVP)

- **P1.** Deliver a swipe-based discovery loop that is measurably more enjoyable than Netflix's native browse experience (proxied by session length, swipes per session, and self-reported satisfaction).
- **P2.** Make adding to a watchlist effortless (≤1 gesture).
- **P3.** Surface streaming availability for every card in the user's region for the user's services.
- **P4.** Personalize the feed within 50 swipes such that users self-report "good recommendations" at 70%+.
- **P5.** Hit the visual and motion bar of a top-tier consumer app on day one.

### 4.3 User Goals

- "I want to *enjoy* the act of figuring out what to watch."
- "I want a watchlist that actually reflects what I am in the mood for, not what I added six months ago."
- "I want to know what to watch *with* my partner / friends / family without arguing for 40 minutes."
- "I want to know which of my friends loved the show I just finished."

### 4.4 Success Metrics (North Star and KPIs)

**North Star Metric:** *Weekly Engaged Swipers* — users who complete at least one full swipe session (≥10 swipes) in a given week.

| Tier | Metric | Definition | Target (M+6) | Target (M+12) |
| --- | --- | --- | --- | --- |
| North Star | WES | Weekly Engaged Swipers | 30k | 100k |
| Acquisition | New User Activation Rate | % of new installs who finish onboarding and complete first swipe session | 60% | 70% |
| Engagement | Avg. Swipes per Active Day | Mean swipes per DAU | 80 | 120 |
| Engagement | Avg. Session Length | Time per app open | 4 min | 6 min |
| Engagement | Sessions per Active Day | DAU sessions/day | 1.8 | 2.5 |
| Retention | D1 / D7 / D30 | Cohort retention | 50 / 30 / 15 | 60 / 40 / 25 |
| Watchlist | Watchlist-to-Watch Conversion | % of right-swiped titles user later marks as watched | 20% | 30% |
| Quality | "Good Recommendation" Self-Report | Tap-survey % positive | 60% | 75% |
| Phase 2 | Match Rate | Avg matches per pair-day | n/a | 0.5 |
| Phase 2 | Co-Swipe Sessions | Per WAU per week | n/a | 0.6 |
| Monetization | ARPU | Total revenue / MAU | $0.10 | $0.50 |

### 4.5 Anti-Goals (What we will *not* optimize for)

- Total catalogue size on launch.
- Long-form review content (Letterboxd plays this game; we don't).
- Power-user list management (CSV import, complex tagging, etc.).
- Social engagement metrics on day one (we ship social only when it makes the core loop better).

---

## 5. Target Audience

### 5.1 Primary Persona — "The Indecisive Streamer"

- **Name:** Aysu, 27, Istanbul. Marketing manager.
- **Subscriptions:** Netflix, Prime Video, BluTV, Disney+.
- **Behavior:** Opens Netflix every weeknight after dinner. Spends 20–35 minutes scrolling. Often gives up and rewatches Friends or scrolls TikTok instead. Occasionally pulls up IMDb on her phone to check ratings before committing.
- **Pain:** "There's nothing to watch" despite paying for four services.
- **Goal:** Find something good, fast, that suits her mood tonight.
- **What Flixy gives her:** A 3-minute swipe session that ends with 2–3 strong candidates already filtered to what's available on her services.

### 5.2 Secondary Persona — "The Couple"

- **Name:** Burak (32) and Selin (30), Ankara.
- **Behavior:** Negotiate every night. He wants thrillers, she wants comedies or K-dramas. They default to whatever they've already watched.
- **Pain:** Decision conflict, not catalogue size.
- **What Flixy gives them:** Co-Swipe (Phase 2): a shared session where the first title they both swipe right on becomes tonight's pick.

### 5.3 Tertiary Persona — "The Curator"

- **Name:** Deniz, 24, Sofia. Film student.
- **Behavior:** Tracks 200+ films/year, posts mini-reviews on Letterboxd, friends ask her for recommendations.
- **Pain:** Her recommendations live in a niche app her friends don't use.
- **What Flixy gives her:** A profile her friends can follow, taste-twin discovery, the ability to push titles to friends.

### 5.4 Anti-Persona — "The Cinephile Power-User"

The hardcore Letterboxd/IMDb power-user who wants advanced lists, custom tags, and detailed review tooling is **not** a primary target for Flixy. We will not build for them in the MVP. We may serve them later, but we will not bend the product for them.

---

## 6. Market and Competitive Analysis

### 6.1 Competitive Landscape

| Competitor | What they do | Where they win | Where they lose |
| --- | --- | --- | --- |
| Letterboxd | Film social network with reviews and lists | Cinephile community, depth | TV-poor, search-first, slow loop |
| Trakt | Watch tracker for shows + movies | Power-user tracking, integrations | UX feels like a dashboard |
| JustWatch | Streaming availability search | Best availability data | Pure utility, not a product you "use for fun" |
| Reelgood | Same lane as JustWatch + watchlist | Cross-platform watchlist | No discovery loop |
| Likewise | Recommendations across media | Multi-vertical | Diffuse, no killer mechanic |
| TasteDive | Recommendation by taste input | Good for "if you liked X" | One-off, not a habit |
| Native streaming apps | Discovery within a single service | Direct play | Single-service, weak recommendations, decision-fatigue source |

### 6.2 Differentiation

Flixy's defensible difference is **the swipe loop as the product**. Nobody else treats the act of choosing as entertainment. The closest analogue isn't a content app — it's Tinder. The closest *content* analogues (Likewise, TasteDive) lack a daily habit-forming mechanic.

Phase 2's defensible difference is **the taste graph**. Once users have invested swipes and connected friends, they cannot easily move that signal to a competitor.

### 6.3 Why Existing Players Cannot Easily Copy

- **Streaming services won't.** They are conflict-of-interest: every honest cross-platform recommender hurts their retention.
- **Letterboxd / Trakt won't.** Their existing user base depends on the deep, slow, log-and-review experience. A Tinder-mode would alienate them.
- **JustWatch / Reelgood could**, but they are utility-positioned and have not invested in product/brand. The window is open.

### 6.4 Market Sizing (rough order of magnitude)

- Global streaming subscribers: ~1.8B (multi-service ownership common).
- Reachable audience (English + EU + Turkey + LATAM mobile): ~400M.
- Realistic 5-year ceiling at 5% penetration of reachable: ~20M MAU.
- 1% of MAU at $5/mo premium = $12M ARR potential before ads/affiliate.

---

## 7. Product Scope

### 7.1 In Scope — MVP (Phase 1)

1. Account creation and authentication (email + Apple + Google).
2. Onboarding taste profile (favorite genres, services, language preferences, optional cold-start "rate 10 titles").
3. The swipe deck — the core experience.
4. Four-direction swipe gestures with mapped meanings (right = watchlist, left = pass, up = top of watchlist / "must watch", down = already seen).
5. Card content: poster/backdrop, title, year, genres, runtime, rating, streaming availability badges, one-line synopsis, "more info" affordance.
6. Card detail expansion (full synopsis, cast, director, trailer, longer reviews summary, where to watch with deeplinks).
7. Watchlist screen with sorting (priority, recency, runtime, availability) and filters.
8. Seen list (passive logging from down-swipes).
9. Pass list (rarely shown, but accessible — for "oops" recovery).
10. Filters: genre, decade, runtime, language, streaming services, content type (movie / series / documentary / anime).
11. Search (typeahead) — secondary surface, not primary.
12. Streaming availability per region with deeplink-out to the streaming app.
13. Trailer playback (YouTube embed or platform-native player).
14. Lightweight personalization engine using swipe signal + onboarding signal.
15. Settings: services owned, region, language, notifications, account, privacy.
16. Push notifications: light, opt-in, behavioural ("New on your services tonight," "Your watchlist has a fresh release," "You haven't swiped in 3 days").
17. Analytics + telemetry instrumentation.
18. Help / FAQ / contact.

### 7.2 Out of Scope — MVP

- All social features (friends, follows, feed, comments, ratings shared, Co-Swipe, Match).
- Reviews and star ratings authored by the user (we capture *implicit* ratings via swipes only).
- Public profiles.
- Group accounts or family profiles.
- TV apps (we are mobile-first).
- Web app beyond a marketing site.
- AI-generated text summaries on cards (Phase 2 candidate).
- Integrations with streaming history (Netflix viewing history, etc.) — not exposed by their APIs anyway.
- Offline mode.

### 7.3 Phase 2 — Social Network

- Friend graph: follow/unfollow, friend requests, contacts import, find friends by handle.
- Public taste profiles: top genres, taste twins, recently watched, favorite directors.
- **Movie Match:** when User A and User B both right-swipe the same title, both are notified.
- **Co-Swipe:** real-time shared swipe session for 2–N people. First mutual right-swipe wins the night.
- Activity feed: friends' added-to-watchlist, watched, top-picks, but lightweight and chronological — no algorithmic ranking on day one.
- Title threads / micro-reviews: a short, optional comment per swipe, visible to friends.
- DMs around titles (deferred — gated behind real demand).
- Rich notifications around match/social events.
- Privacy controls: private profile, ghost mode, hide specific titles from friends.

### 7.4 Phase 3 — Platform

- Creator/curator profiles and curated lists.
- Public/published lists.
- B2B taste data product.
- Studio promo placements (clearly labelled, never disguised as organic cards).
- Smart TV companion.
- Anonymous taste-twin matching ("people in your city with the closest taste to yours").

---

## 8. Feature Requirements (High-Level)

This section is the high-level inventory. The SRS and FSD describe each in full.

### 8.1 Onboarding

- 60-second flow.
- Step 1: language and region.
- Step 2: pick streaming services owned (multi-select with logos).
- Step 3: pick 5+ favourite genres.
- Step 4: cold-start rating round — show 10 popular titles, user swipes (counts as both signal and a tutorial).
- Step 5: notifications opt-in.
- Account creation deferred to *after* first swipe session (anonymous-first onboarding) to reduce friction; account is required to persist watchlist beyond device.

### 8.2 The Swipe Deck (Core Loop)

- Stack of cards. Top card is interactive.
- Four gestures + four explicit buttons (for accessibility): pass, watchlist, top, seen.
- Smooth physics, haptic feedback, micro-celebration on right-swipe.
- "Undo last swipe" affordance (limited count per session for free; unlimited for premium).
- Card structure (front): hero art (poster or backdrop), title overlay, year, runtime, age rating, primary genre tags, primary streaming availability badge, an "i" tap-target to flip to detail.
- Card detail (back / sheet): full synopsis, cast, director, trailer, all streaming availabilities, review-rating snapshot (e.g., aggregated from Rotten Tomatoes / IMDb / TMDB), why-this-was-recommended one-liner.
- "Out of cards" state with refresh, broaden-filters CTA, or share-feedback hook.

### 8.3 Watchlist

- Default sort: priority (top swipes first), then recency.
- Sort/filter by streaming service, runtime, content type, "in the mood for."
- Tap title → detail view → "Watch now" deeplink.
- Marking as watched (manual or via a "did you watch this?" nudge) moves to Seen.
- Reorder via drag.

### 8.4 Seen List

- Auto-populated from down-swipes and watchlist completions.
- Used as a hard exclude in the recommendation engine.
- Editable (remove if added by mistake).

### 8.5 Filters and Mood Modes

- Persistent filters (settings).
- Session filters ("Tonight I want… short, funny, on Netflix"). Short, runtime ≤90, comedy, single service.
- Mood presets: "Quick laugh," "Long film night," "True crime binge," "Critically loved hidden gems," "Light comfort watch."

### 8.6 Streaming Availability

- For every card, the user's owned services that have the title are highlighted, others greyed.
- Tapping a service opens the streaming app at the title's deeplink (web fallback).
- Region-aware. Offline regions show "Not available in your region" with optional VPN-neutral message.

### 8.7 Search

- Secondary, not primary. Accessible from a tab or top icon.
- Title typeahead, person typeahead (actor/director).
- Result tap → detail view → swipe actions available from detail.

### 8.8 Notifications

- Opt-in only.
- Categories: New on your services, Watchlist heads-up (release, leaving soon), Re-engagement.
- Phase 2 adds Match notifications, friend activity.

### 8.9 Account and Settings

- Profile (avatar, handle, region, language).
- Linked services (streaming services owned).
- Notification toggles per category.
- Data and privacy (export, delete account, hide titles, ghost mode in Phase 2).
- Subscription (free vs premium).

### 8.10 Premium Tier (proposed for monetization validation)

- Unlimited undos.
- Hide ads (if/when ads exist).
- Advanced filters.
- "Why this recommendation" explainer.
- Streaming-cost optimization view ("which 2 services would cover 90% of your watchlist").
- Phase 2: incognito match, advanced taste analytics.

---

## 9. User Flows

### 9.1 First-Time User Flow

1. User opens app for the first time.
2. Splash screen → 2-second brand moment, then animated card stack demo.
3. Onboarding intro screen: "Pick what to watch in 60 seconds. Swipe right to save, left to skip."
4. Language and region (auto-detected, confirmable).
5. Streaming services screen — multi-select with service logos.
6. Genre preference screen — pick 5+.
7. Cold-start swipe tutorial — 10 popular titles, swipes are real and contribute to feed.
8. Optional: notification permission ask, with reason.
9. Drop into main feed. First "real" swipe session begins.
10. After ~15 swipes, soft prompt to create an account to save progress (Apple/Google/email).
11. After account: confirm onboarding complete; show watchlist with the items they've right-swiped so far.

**Activation event:** completed onboarding + 10 swipes.

### 9.2 Returning User — Daily Loop

1. User opens app from home screen or push notification.
2. App restores last filter/mood state and resumes where they left off.
3. Top card pre-fetched and renders in <500ms.
4. User does a swipe session of 30–80 swipes.
5. Watchlist gets new entries.
6. User taps watchlist tab, picks a title, taps "Watch on Netflix," deeplinks to Netflix.
7. Returns later, marks as watched (or app prompts "Did you watch X?").

### 9.3 Filter / Mood Flow

1. From the deck, user taps the filter icon.
2. Bottom sheet: mood presets at top, manual filters below.
3. User picks "Quick laugh."
4. Sheet closes; deck animates a shuffle; a fresh mood-aware stack appears.
5. Filter chip remains visible at the top; one tap clears.

### 9.4 Watchlist Flow

1. Watchlist tab.
2. Default sorted by priority (super-likes on top).
3. Pull to refresh re-checks streaming availability.
4. Tap a title → detail.
5. Detail offers "Watch now," "Mark watched," "Move down," "Remove."
6. "Watch now" opens streaming app with deeplink.

### 9.5 Detail Flow

1. From a card, user taps "i" or swipes up briefly (without releasing).
2. Detail sheet covers ~85% of screen.
3. User can scroll. Trailer auto-plays muted.
4. Persistent action bar at bottom mirrors the four swipe actions.
5. Closing the sheet returns to the card with no state lost.

### 9.6 Streaming Hand-Off Flow

1. User taps a service badge or "Watch now."
2. App attempts native deeplink (e.g., `nflx://...`).
3. If native app not installed, falls back to mobile web (browser).
4. We log the click as an attribution event (for affiliate, where applicable).

### 9.7 Empty / Out-of-Cards Flow

1. Deck empties.
2. Friendly empty state: "You're a power swiper. Want to broaden your filters or check your watchlist?"
3. CTAs: Broaden filters, Open watchlist, Refresh.

### 9.8 Phase 2 — Movie Match Flow

1. User A right-swipes Title X.
2. Backend checks if any friend of A has also right-swiped X.
3. If yes, both users get a Match notification: "You and Selin both want to watch *The Bear*."
4. Tapping the notification opens a Match screen showing both avatars and a "Watch now" CTA.

### 9.9 Phase 2 — Co-Swipe Flow

1. User A taps "Watch with…" and selects friend(s) from contacts/friends list.
2. Friends receive an invite notification.
3. On accept, a synchronized session opens. All participants see the same deck in the same order.
4. Each participant swipes independently. The first title that gets a right-swipe from *all* participants ends the session with a Match.
5. Session caps at 60 cards or 5 minutes by default.

---

## 10. Monetization Strategy

### 10.1 Approach

The MVP is free with no ads and no premium tier. The first monetization tested is a **streaming affiliate** model where outbound clicks to streaming services may earn small commissions where partner programs exist (Apple TV, Prime Video, third-party rentals, etc.). Premium tier is launched in month 6 once the core loop is healthy.

### 10.2 Premium Tier (M+6 onwards)

- **Price target:** $4.99/mo or $39/yr.
- **Free tier limits:** 5 undos per day; standard filters; standard recommendations.
- **Premium benefits:**
  - Unlimited undos.
  - Advanced filters (decade range, IMDb score range, hide-genres-globally, exclude originals of a service).
  - "Why this card" explainability.
  - Service optimization view.
  - Early access to Phase 2 features.
  - No ads (forward compatibility).

### 10.3 Streaming Affiliate

- Opportunistic. Where partner programs exist, attribute click-outs and earn commission.
- Never bias rankings toward affiliate-paying titles. (This is an ethical and trust commitment that we will hold publicly.)

### 10.4 Future B2B Data Product (Phase 3)

- Aggregate, anonymized taste signal sold to studios and platforms (e.g., "trailer-to-swipe-right conversion across 100k users in markets X").
- Strict privacy and aggregation thresholds.

---

## 11. Constraints, Assumptions, and Dependencies

### 11.1 Technical Constraints

- Mobile-first (iOS and Android). No tablet or TV optimization in MVP.
- Reliant on third-party metadata APIs (TMDB primary).
- Reliant on third-party streaming availability data (Watchmode or JustWatch API).
- Trailer playback constrained to YouTube embed quality and licensing.
- Supabase + Trigger.dev backend stack (consistent with team familiarity).

### 11.2 Business Constraints

- Bootstrap-friendly — must launch on a small team budget.
- Cannot license premium content APIs that cost six figures.
- Marketing budget limited; product must be inherently shareable.

### 11.3 Assumptions

- TMDB will continue to allow free-tier non-commercial use of metadata for an MVP-scale app, and a commercial license will be available as we grow.
- Streaming services will continue to allow deeplinking from third-party apps.
- Users will accept anonymous-first onboarding.
- The Tinder gesture vocabulary is universal enough to need no tutorial for ~80% of users.

### 11.4 Dependencies

- **TMDB** for catalogue, metadata, artwork, trailers (links).
- **Watchmode** (or JustWatch, or both) for streaming availability per region.
- **OpenAI / Anthropic / OpenRouter** (optional, Phase 2) for "why this card" and AI-generated mood-based pitches.
- **Apple/Google/Email** auth providers.
- **Push notifications:** APNs, FCM.
- **Supabase** for primary database and auth.
- **Trigger.dev** for background jobs (catalogue ingestion, freshness sync).
- **PostHog** for product analytics + feature flags.
- **Resend** for transactional email.

---

## 12. Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| TMDB rate limits or licensing changes | Medium | High | Cache aggressively, plan for paid tier, build adapter pattern so Watchmode can serve as fallback metadata source |
| Streaming availability data is incomplete or stale | High | Medium | Multi-source (Watchmode + scraping fallback), nightly sync, region-specific QA |
| Cold start: not enough catalogue depth at launch in non-US regions | Medium | High | Region-aware ingestion priorities; manual curation for top markets |
| User does not understand why down-swipe = "seen it" | Medium | Medium | Onboarding tutorial card; tooltip on first down-swipe; iconography on card edges |
| Recommendation quality poor in first 50 swipes | High | High | Strong onboarding signal; collaborative filtering on top of content-based; popular-fallback for cold start |
| Tinder-mode feels "shallow" to cinephiles and reviewers | Medium | Low | Lean into casual positioning; cinephiles aren't ICP |
| App store rejections / brand confusion ("Tinder for Netflix") | Low | Medium | Independent brand, clear positioning, no Netflix or Tinder marks |
| Phase 2 feature creep delays MVP | High | High | Hard MVP scope freeze; phase 2 work happens in parallel only after MVP ships |
| Privacy concerns around taste profile | Medium | High | Default-private profiles in Phase 2; clear export/delete; no third-party data sale of identifiable signal |
| Burnout on small team | Medium | High | Tight scope, automated infra, weekly velocity reviews |

---

## 13. Roadmap and Phasing

### 13.1 Phase 0 — Discovery (complete or in parallel)

- This document and the SRS / FSD.
- Brand and visual direction.
- API contract negotiations (TMDB tier, Watchmode key).

### 13.2 Phase 1 — MVP (Weeks 1–10)

| Week | Focus |
| --- | --- |
| 1 | Project skeleton, auth, database schema, TMDB ingestion pipeline |
| 2 | Onboarding flow + cold-start signal capture |
| 3 | Swipe deck UI, card component, gesture engine |
| 4 | Watchlist, seen list, pass list |
| 5 | Filters, mood presets, search |
| 6 | Streaming availability integration + deeplinks |
| 7 | Recommendation engine v1 (content-based + popularity-weighted) |
| 8 | Notifications, settings, polish |
| 9 | Beta with 200 users, telemetry, instrumentation |
| 10 | Bug fixes, store submission, launch |

### 13.3 Phase 2 — Social (Weeks 11–22)

| Block | Focus |
| --- | --- |
| 11–12 | Friend graph, public profile, contact import |
| 13–14 | Movie Match background job + notifications |
| 15–17 | Co-Swipe real-time session engine |
| 18–19 | Activity feed |
| 20 | Title threads / micro-reviews |
| 21–22 | Polish, scale tests, growth experiments |

### 13.4 Phase 3 — Platform (Quarter 4 onwards)

- Curator profiles and lists.
- Premium tier launch and monetization scale.
- B2B data product.
- TV companion app.

---

## 14. Open Questions

1. Should we allow users to swipe on individual episodes for series, or only on the series itself? (Recommend: series only for MVP.)
2. Should "down = seen" or should "down" be reserved for "not now / hide for 30 days"? (Recommend: seen, for clean signal. Will user-test.)
3. Should we support multiple profiles per account at MVP? (Recommend: no.)
4. Anonymous-first onboarding — is the trade-off of losing some D1 retention worth the reduced friction? (Will A/B test in beta.)
5. Should premium be subscription-only or one-time-purchase available? (Recommend: subscription-only.)
6. How aggressive should re-engagement push be in week 1? (Recommend: max 1 push/day, never before noon local.)
7. Should we allow user-generated lists in MVP? (Recommend: no.)
8. Phase 2 — Co-Swipe over invite link or only via the friend graph? (Recommend: both, link is viral.)

---

## 15. Glossary

- **Swipe right / left / up / down** — gestures with mapped meanings (see Section 8.2).
- **Card** — the unit of content shown in the deck.
- **Deck** — the stack of upcoming cards.
- **Watchlist** — list of titles the user wants to watch (right-swiped + super-liked).
- **Seen list** — auto-populated record of titles the user has already watched.
- **Pass list** — record of left-swiped titles, used to suppress them in future feeds.
- **Match (Phase 2)** — when two friends both right-swipe the same title.
- **Co-Swipe (Phase 2)** — synchronized multi-person swipe session.
- **Mood preset** — a predefined filter combination (e.g., "Quick laugh").
- **Activation** — finishing onboarding + completing first 10-swipe session.
- **WES** — Weekly Engaged Swipers (North Star metric).
- **Cold start** — the first ~50 swipes during which the recommender has limited signal.

---

## 16. Appendices

### 16.1 Appendix A — Example Cold-Start Title Set Criteria

The 10-title cold-start round is curated to maximize signal:

- 2 critically acclaimed dramas with broad appeal.
- 2 popular comedies of the last 5 years.
- 1 prestige TV series.
- 1 animated film.
- 1 documentary.
- 1 popular international/foreign title (non-English).
- 1 thriller or horror.
- 1 polarizing recent release (high variance).

### 16.2 Appendix B — Card Density / Information Hierarchy

In priority order:
1. Hero artwork.
2. Title and year.
3. One-line synopsis or "hook."
4. Streaming availability badges (user's services).
5. Age rating, runtime, primary genre.
6. Rating snapshot.
7. Tap target for full detail.

### 16.3 Appendix C — "Why this card" Explainer Format (Premium)

A one-line, plain-language reason: "Because you liked *The Bear* and *Beef*, and this is critically loved." The string is generated from a template + signal source (no LLM required for MVP).

### 16.4 Appendix D — Voice and Tone

- **Voice:** Confident, witty, never snarky. Speaks like a friend who watches a lot and has good taste.
- **Tone in copy:** Casual, short, no marketing fluff. Loves a good emoji but never overuses.
- **Microcopy examples:**
  - Onboarding: "Quick taste check. Won't take long."
  - Empty deck: "You've out-swiped us. Tweak your filters or check your list."
  - Match: "It's a match. *The Bear* — Selin wants in too."

---

**End of PRD.**
