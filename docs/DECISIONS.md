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

