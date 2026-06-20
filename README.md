# Flixy

Swipe-based mobile app for movie & TV discovery.

> **Current MVP target:** Supabase Auth + watchlist, API-backed catalogue.
> Auth sessions and saved watchlist rows use Supabase. Movie and TV metadata
> stays live through TMDB and is not persisted by the mobile app. Swipes,
> onboarding preferences, and profile polish still use the local repository
> seam for the MVP.

See `docs/PRD.md`, `docs/SRS.md`, `docs/FSD.md` for product, requirements, and feature specs.

## Architecture

```
+------------------------+      +------------------------+
|  Auth (Supabase Auth)  |      |  Catalogue (TMDB live) |
|  secure token storage  |      |  src/lib/tmdb.ts       |
+----------+-------------+      +-----------+------------+
           |                                |
           v                                v
+------------------------+      +------------------------+
| Watchlist (Supabase)   |      | Local MVP data seam    |
| watchlist_items only   |      | prefs/profile/swipes   |
+------------------------+      +------------------------+
```

- `apps/mobile/src/lib/supabase.ts` creates a real Supabase client when
  `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set.
- `apps/mobile/src/features/watchlist/store.ts` writes watchlist rows to
  Supabase when configured and falls back to local storage for tests/dev.
- Catalogue hooks read live TMDB data through `apps/mobile/src/lib/tmdb.ts`;
  mobile never stores movie or TV metadata in Supabase.

## Stack

React Native + Expo SDK 54 (New Architecture), TypeScript strict, expo-router,
NativeWind, TanStack Query, Zustand, Reanimated v3, Gesture Handler, Sentry,
PostHog, Biome, Jest, Maestro. Full rationale in `docs/SRS.md § 7.5` and
`docs/PRD.md Appendix E § 16.5`.

## Layout

```
apps/mobile          Expo app (expo-router)
packages/shared      zod schemas + shared types
packages/catalogue-ingest  [dormant] TMDB → Supabase backfill worker
supabase/            [dormant] migrations + edge functions
docs/                PRD / SRS / FSD / DECISIONS / DATA_LAYER
```

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill Supabase Auth/watchlist + TMDB keys
pnpm --filter @flixy/mobile start   # expo start
```

Requires Node 20+, pnpm 10+.

Required mobile env vars are `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `TMDB_API_KEY`. Add
`TMDB_READ_ACCESS_TOKEN` when using TMDB bearer auth. Supabase OAuth redirects
should allow `flixy:///auth/callback`.

## Quality

- `pnpm lint` — Biome (formatter + linter, replaces ESLint + Prettier)
- `pnpm typecheck` — TypeScript strict, `noUncheckedIndexedAccess`
- `pnpm test` — Jest unit + component tests

CI runs all three on every PR. Pre-commit hook formats staged files and
validates commit messages (conventional commits).

## Human blockers

See `docs/HUMAN_BLOCKERS.md`. The MVP does not need a backend, but launch
(Play Store / TestFlight) requires several human-only actions (Apple /
Google developer enrollment, EAS account, key rotation).
