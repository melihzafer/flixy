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
