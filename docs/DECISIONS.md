# Decision Log

Append-only log of autopilot decisions made during the build. Each entry is one defensible call.

---

## DEC-001: Pre-license fonts use Fraunces + Inter
**Date:** 2026-04-26
**Context:** Brand spec calls for GT Sectra + GT America (Grilli Type), but the license isn't yet procured. SRS NFR-BRAND-004 explicitly permits fallbacks pre-license.
**Decision:** Use Fraunces (display, serif) and Inter (body, sans) loaded via `@expo-google-fonts/*`. Token names in `theme/tokens.ts` and `tailwind.config.js` are abstract (`display`, `body`), so swapping to Grilli Type when licensed is a one-file change.
**Alternatives considered:** Lora + Inter; system serif fallback. Rejected — Fraunces' optical sizing matches GT Sectra's editorial feel more closely.
**Reversibility:** Easy.

## DEC-002: pnpm monorepo from day one
**Context:** Build prompt suggests but doesn't mandate monorepo. Only one app today.
**Decision:** Adopt pnpm workspaces with `apps/mobile` + `packages/shared` immediately. zod schemas are shared between client validation and (future) edge API contracts; co-locating from day one prevents a future migration.
**Alternatives considered:** Single Expo app, bring monorepo later. Rejected — package boundary is cheap up front, expensive to retrofit.
**Reversibility:** Hard (would require collapsing `@flixy/shared` back into the app), but unlikely to be needed.

## DEC-003: Biome over ESLint + Prettier
**Context:** Prompt specifies Biome explicitly. Documenting for completeness.
**Decision:** Biome 1.9.4 as the sole formatter + linter. `noConsole` is set to error (allowing only `console.warn`/`console.error`); `noExplicitAny` is error.
**Reversibility:** Easy.

## DEC-004: TanStack Query persistence via AsyncStorage
**Context:** FSD § 3.6.4 requires offline tolerance for the swipe deck.
**Decision:** Use `@tanstack/query-async-storage-persister` + `PersistQueryClientProvider` from app root. Cache TTL: 7 days, query staleTime: 5 minutes.
**Alternatives considered:** MMKV via `react-native-mmkv` — faster, but adds a native module and isn't required at this stage. Will revisit if perf budgets demand it.
**Reversibility:** Easy (swap persister implementation).

## DEC-005: Auth tokens in expo-secure-store, cache in AsyncStorage
**Context:** Need to separate sensitive auth material from cached query data.
**Decision:** Supabase session storage uses AsyncStorage today (Supabase JS default supports it cleanly). When BetterAuth client is wired in Phase 2, secrets/refresh tokens move to expo-secure-store. Public, non-sensitive cache stays on AsyncStorage.
**Reversibility:** Easy.

## DEC-006: Supabase auth storage moved to expo-secure-store in Phase 2A
**Date:** 2026-04-27
**Context:** DEC-005 deferred secure token storage to "when BetterAuth lands". BetterAuth wiring is non-trivial (peer-dep on zod v4, schema mapping for the existing `auth.users` table) and Phase 2A only needs email/password + anonymous flows that Supabase provides natively. Shipping plain AsyncStorage for tokens in the meantime would mean any later Phase 2 PR that introduces secure storage has to reason about migrating in-flight sessions.
**Decision:** Implement a chunked `secureStoreAdapter` in `apps/mobile/src/lib/secureStore.ts` that satisfies the Supabase storage interface, and pass it directly to `createClient`. Tokens now land in Keychain / EncryptedSharedPreferences from day one. BetterAuth integration is descoped to Phase 2C/2D once email magic-link / social providers are required.
**Alternatives considered:** Use AsyncStorage now and migrate later; ship BetterAuth straight away. The first is a known-bad future migration; the second blocks the auth screens on resolving the zod v4 peer warning and isn't required for MVP auth.
**Reversibility:** Easy — adapter is a single file; users with existing AsyncStorage-stored sessions on dev builds simply re-authenticate on first launch after the change.

## DEC-007: Anonymous-upgrade prompt threshold = 15 swipes, 24h dismissal cooldown
**Date:** 2026-04-27
**Context:** FSD § 3.1.6 calls for an "account upgrade prompt at swipe ~15" but doesn't specify dismissal behaviour. Hammering anon users with the same modal every session is hostile.
**Decision:** Track lifetime anon swipe count + last dismissal timestamp in a Zustand store persisted via AsyncStorage. Prompt triggers at swipe 15. After dismissal, suppress for 24h.
**Alternatives considered:** Once-and-done (too easy to lose the conversion), prompt every session (annoying), gate behind specific actions like "save to watchlist" (already a separate trigger in FSD).
**Reversibility:** Easy — single constant + dismissal logic in `stores/anonSwipe.ts`.

## DEC-008: expo-router auth gate via root index redirect, not middleware
**Date:** 2026-04-27
**Context:** expo-router doesn't expose middleware in v4; common pattern is either a `<Redirect>` from a guard screen or a context provider that conditionally renders.
**Decision:** Single `app/index.tsx` reads `useSession()` and `<Redirect>`s to either `/(app)` or `/(auth)/welcome`. Each group has its own `_layout.tsx` for screen-level config. Session listener lives inside `useSession`, so the listener attaches once mounted on either group.
**Alternatives considered:** AuthProvider in root layout swapping children, custom hook in every screen. Rejected — redirect from a single index is the simplest expo-router-native pattern and matches their docs.
**Reversibility:** Easy.

## DEC-009: Cold-start screen ships as placeholder in Phase 2B
**Date:** 2026-04-27
**Context:** FSD 3.2.5 requires a 10-card cold-start swipe round at the end of onboarding, but the swipe engine + recommendation deck are Phase 3 deliverables.
**Decision:** Ship a placeholder cold-start screen that records `cold_start_completed_at` and continues to notifications. Full 10-card round replaces the placeholder body when the swipe engine lands.
**Alternatives considered:** Skip cold-start entirely (rejected: leaves hole in onboarding state). Block Phase 2B (rejected: violates incremental shipping).
**Reversibility:** Easy.

## DEC-010: Onboarding state lives in user_preferences, not Zustand
**Date:** 2026-04-27
**Context:** Onboarding is multi-step. Tempting to keep intermediate selections in a Zustand store and persist only on the last screen.
**Decision:** Persist after every step via `useUpdatePreferences`. The flow is resumable per FSD 3.2.4 — if the user kills the app on the genres screen, reopening should land them on genres with services already remembered.
**Alternatives considered:** Zustand draft + final commit. Rejected — adds a sync surface and breaks resume-on-kill.
**Reversibility:** Easy.


## DEC-011: Avatars in Supabase Storage with owner-prefixed paths
**Date:** 2026-04-27
**Context:** Avatar upload needs storage. Object-level RLS in Supabase Storage is path-based.
**Decision:** Public-read `avatars` bucket; write/update/delete restricted to objects whose first path segment equals the authenticated user id (`<userId>/<filename>`). Public-read keeps friend/share rendering trivial; profile.avatar_url stores the public URL directly.
**Alternatives considered:** Private bucket + signed URLs (rejected: extra round-trip every render, cache headaches). Profile photo as base64 in profiles table (rejected: bloats row, kills paginated reads).
**Reversibility:** Easy — bucket/policies are migration-only.


## DEC-012: Catalogue ingestion is server-only; mobile reads via Supabase
**Date:** 2026-04-26
**Context:** FSD 3.4 specifies TMDB + Watchmode ingestion on a schedule. The mobile client needs catalogue access for the deck and detail view, but bundling the TMDB key on-device leaks it and bypasses our admin overrides (is_hidden, is_adult).
**Decision:** Mobile reads exclusively from Supabase tables `titles` and `title_availability` (public-read RLS, writes blocked). TMDB ingestion is documented as a Trigger.dev worker (lib/tmdb.ts is a typed stub, not imported by app code). For dev, we seed 20 representative titles + ~15 availability rows in migration 0004 so the deck can be exercised pre-ingest.
**Alternatives considered:** (a) Direct TMDB calls from the client — rejected, key leak. (b) Supabase Edge Function proxy to TMDB — viable, deferred until ingestion lands; the read-from-mirror pattern is needed regardless for offline tolerance (FSD 3.6.4).
**Reversibility:** Easy. Hooks already abstract behind `useTitle`/`useTitlesQuery`; swap data source without touching screens.

## DEC-013: Deck composer runs on-device for MVP
**Date:** 2026-04-26
**Context:** FSD 3.5 specifies a 7-layer deck composer. The composer can live server-side (edge function ranking) or on-device. Server-side gives consistency across devices and access to richer signals; on-device is instant, offline-tolerant, and ships without an extra service.
**Decision:** On-device composer for MVP. The pure function lives in `@flixy/shared/composer.ts` so it can be tested in isolation and (later) reused server-side without rewriting. Fetches a candidate pool of ~80 popularity-sorted titles via the catalogue query, then scores them in JS.
**Alternatives considered:** (a) Edge function deck endpoint — deferred; would gate the swipe loop on network. (b) Defer composer entirely and serve raw popularity — rejected, the layered scoring is what makes Flixy not a top-10 list.
**Reversibility:** Easy. Swap `composeDeck` call in `useDeck` for an RPC; the function signature is the contract.

## DEC-014: Swipe events go through an offline queue with optimistic watchlist
**Date:** 2026-04-27
**Context:** FSD 3.6.4 requires offline tolerance: swipes during connectivity loss must not be lost or block the UI. Direct insert-on-swipe blocks gesture commits behind the network and loses events on flaky links.
**Decision:** Swipes are appended to a Zustand+AsyncStorage FIFO queue immediately, then drained to the `swipes` table with exponential backoff (max 30s). Positive swipes (right/up) optimistically upsert a `watchlist_items` row so the watchlist updates instantly; negative swipes only flow to `swipes` (taste signals downstream). Each swipe carries a client-generated UUID so retries are idempotent at the unique-index layer.
**Alternatives considered:** (a) Plain mutation with TanStack Query offline persistence — rejected, the queue ordering and backoff semantics differ from query retry semantics; (b) Drop swipes when offline — rejected, breaks the trust contract with the user.
**Reversibility:** Easy. Queue is internal to `features/swipe/queue.ts`; replacing it with a server RPC means swapping the drain call site.


## DEC-015: Filter state lives in Zustand only (no server persistence)
**Date:** 2026-04-28
**Context:** FSD 3.9 filter sheet exposes kinds, genres, providers, runtime cap, year window, hide-seen. Server persistence would let filters follow the user across devices, but the table + sync logic adds Phase-3 surface area for a feature few users tweak per session.
**Decision:** Filters live entirely in `features/deck/filterStore.ts` (Zustand persist via AsyncStorage). Per-device, no Supabase row.
**Alternatives considered:** (a) `user_preferences.filter_state` jsonb column with realtime sync — rejected as premature; (b) URL-encoded share links — out of scope for MVP.
**Reversibility:** Easy. Adding a server column later means writing a one-way migration of the local store on first sync.

## DEC-016: Mobile jest deferred until Phase 4 polish
**Date:** 2026-04-28
**Context:** Real jest-expo + pnpm hoisting attempted in `feat/phase-4a-mobile-jest`; Metro/Jest interop with the workspace was thorny.
**Decision:** Keep `apps/mobile` test script as a no-op for now. All business logic that needs unit coverage already lives in `packages/shared` (21/21 green). Mobile screens are thin wrappers over hooks; component tests can wait until the design system and a11y pass land.
**Alternatives considered:** Force jest-expo into the workspace before more screens land — rejected, sunk cost vs. shipping risk.
**Reversibility:** Easy. When we add mobile tests we re-enable the script and add `jest-expo` preset.

## DEC-017: Search MVP uses ILIKE; tsvector FTS deferred
**Date:** 2026-04-28
**Context:** FSD 3.10 calls for catalogue search. A real Postgres `tsvector` column with GIN index gives stemming, prefix matching, and ranking; ILIKE on `title || original_title` is good enough for ~10k-row launch catalogue.
**Decision:** Ship `useSearchTitles` with `.or('title.ilike.%q%,original_title.ilike.%q%')` and `popularity` sort. Plan a follow-up migration adding `search_tsv` + trigger-maintained vector when catalogue grows past ~50k rows.
**Alternatives considered:** Algolia/Meilisearch — extra infra, paid; not justified for launch volume.
**Reversibility:** Easy. Search hook is one file; swap the query when FTS lands.

## DEC-018: Maestro selectors use stable testIDs, not text
**Date:** 2026-04-28
**Context:** Flixy ships in seven languages. Text matchers in E2E flows (`tapOn: "Continue"`) silently break in tr/bg/etc. and produce flakiness when copy is tweaked.
**Decision:** Every element targeted by Maestro has an explicit `testID` prop. The `apps/mobile/e2e/README.md` documents the contract.
**Alternatives considered:** `accessibilityLabel` matchers — rejected, those are also localized.
**Reversibility:** Easy. testID is render-only and stripped in release builds.
