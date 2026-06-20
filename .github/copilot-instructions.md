# Copilot instructions for Flixy

## Repository operating rules

- This project uses OpenWolf. Read `.wolf\OPENWOLF.md` each session, check `.wolf\anatomy.md` before reading files, and check `.wolf\cerebrum.md` before generating code.
- Honor OpenWolf bookkeeping: append significant actions to `.wolf\memory.md`, update `.wolf\anatomy.md` after creating/deleting/renaming files, and add durable project learnings to `.wolf\cerebrum.md`.
- Quote Expo Router paths that contain route groups in PowerShell, for example `"apps\mobile\app\(app)\deck.tsx"`.

## Build, test, and lint commands

Requires Node 20+ and pnpm 10+ (`packageManager` is `pnpm@10.33.0`). CI runs install, lint, typecheck, and tests.

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Start Expo | `pnpm start` |
| Start Android/iOS | `pnpm android` / `pnpm ios` |
| Start Expo web | `pnpm --filter @flixy/mobile web` |
| Lint + format check | `pnpm lint` |
| Auto-fix lint/format | `pnpm lint:fix` |
| Typecheck all workspaces | `pnpm typecheck` |
| Test all workspaces | `pnpm test` |
| Typecheck one package | `pnpm --filter @flixy/mobile typecheck` |
| Mobile single Jest test | `pnpm --filter @flixy/mobile test -- src\features\catalogue\__tests__\hooks.test.ts` |
| Shared single Jest test | `pnpm --filter @flixy/shared test -- src\schemas\__tests__\title.test.ts` |
| Ingestion single Jest test | `pnpm --filter @flixy/catalogue-ingest test -- src\__tests__\mapper.test.ts` |
| One Maestro flow | `maestro test apps\mobile\e2e\returning-user.yaml` |
| Build catalogue CLI | `pnpm --filter @flixy/catalogue-ingest build` |

There is no root app build script. The static `@flixy/web` package currently has no-op `typecheck` and `test` scripts so recursive workspace checks pass.

Catalogue ingestion and Supabase commands:

```powershell
pnpm --filter @flixy/catalogue-ingest build
pnpm --filter @flixy/catalogue-ingest ingest -- --dry-run --region=US --tv=1100
pnpm --filter @flixy/catalogue-ingest ingest -- --write --region=US,TR
pnpm exec supabase db push --linked
```

## High-level architecture

- **Workspace shape:** `pnpm-workspace.yaml` includes `apps\*` and `packages\*`. `apps\mobile` is the primary Expo app, `apps\web` is a static landing page, `packages\shared` owns runtime-free Zod schemas/types/composer logic, and `packages\catalogue-ingest` owns the Node ingestion CLI.
- **Mobile shell:** Expo Router groups routes under `app\(auth)`, `app\(onboarding)`, and `app\(app)`. `app\_layout.tsx` loads fonts, initializes Sentry, installs gesture/safe-area providers, and wraps the app in a persisted TanStack Query client. `app\index.tsx` gates users by session and onboarding state before redirecting.
- **Server state:** Mobile feature hooks use TanStack Query. The query cache is persisted to AsyncStorage through `src\lib\query.ts`; version persisted query keys and persister keys when return shapes change.
- **Supabase boundary:** `src\lib\supabase.ts` reads Expo `extra` values from `app.config.ts` and stores auth through SecureStore. Feature hooks validate Supabase rows with Zod schemas before mapping to shared types.
- **Catalogue and deck flow:** `useTitlesQuery` reads `titles` and `title_availability` from Supabase, normalizes service/genre IDs, and falls back to `src\lib\fallbackCatalogue.ts` with diagnostics when Supabase is unconfigured, empty, or failing. `useDeck` composes candidates with `composeDeck` from `@flixy/shared`, user preferences, taste signal, exclusions, and watchlist state.
- **Swipe and watchlist flow:** Swipes are immutable client-generated events persisted in the Zustand/AsyncStorage queue at `src\features\swipe\queue.ts`, then idempotently upserted to `swipes`. Positive/seen swipes project into `watchlist_items`; watchlist screens use direct Supabase mutations and invalidate TanStack Query state.
- **Auth/OAuth:** `useSession` keeps Supabase auth state in TanStack Query. OAuth callback parsing/completion is centralized in `src\features\auth\oauthCallback.ts`; keep both PKCE `?code=` and fragment-token flows, allowed `flixy` / `https://flixy.app` callbacks, duplicate-callback dedupe, and sanitized logging.
- **Ingestion architecture:** Server-side catalogue ingestion is canonical in `packages\catalogue-ingest`. Supabase Edge Functions in `supabase\functions` import mirrored shared catalogue sources for scheduled TMDB/OMDb/Trakt work. The Expo app must never receive TMDB, OMDb, Trakt, or service-role credentials.
- **Database:** SQL migrations live in `supabase\migrations` and are append-only. Tables/columns use `snake_case`; user-owned tables enable RLS with self-only policies; `updated_at` uses the shared trigger convention. When adding a migration, apply/push it as part of the task.

## Key conventions

- Use Biome, not ESLint/Prettier. The repo enforces 2-space indent, single quotes, semicolons, trailing commas, organized imports, `import type`, no `any`, and no `console` except `console.warn` / `console.error`.
- Keep TypeScript strict. Prefer shared Zod schemas and typed guards over casts; avoid non-null assertions unless there is a checked invariant.
- `@flixy/shared` must stay runtime-free of React Native, Expo, Node-specific APIs, and app-side globals.
- Feature flags must go through `isFeatureEnabled(featureFlags.*)` and the real PostHog path; do not approximate rollout behavior with local hardcoded switches.
- Onboarding preferences store lowercase snake_case service and genre IDs, not display labels. Normalize legacy labels before filtering deck/catalogue results.
- Fallback catalogue diagnostics are for logging/telemetry, not UI copy. Search/detail/deck degraded states should use user-facing recovery copy, not developer language like "fallback" or "catalogue diagnostics".
- Design source of truth is `DESIGN.md` plus `apps\mobile\src\theme\tokens.ts`; mirror token changes in `apps\mobile\tailwind.config.js`. The product UI is dark, cinematic, poster-first, low-glare, with orange primary CTAs and semantic swipe colors.
- Reuse existing mobile primitives: `AppHeader` for main tab headers, `ActionButton` for deck/detail swipe actions, `AuthSheet` primitives plus shared `Input`/`SocialButton` for auth screens, and compact `ListRow`/`Chip` for settings/profile surfaces.
- Use `lucide-react-native` for UI icons instead of emoji/glyph text or a new icon library.
- On Android, `Pressable` with `accessibilityRole="button"` may not honor row flex layout on children. Put row layout on an inner `View` and keep `Pressable` as the touch shell.
- Keep stable Maestro `testID`s documented in `apps\mobile\e2e\README.md` when changing flows or interactive controls.
