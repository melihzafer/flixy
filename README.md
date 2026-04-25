# Flixy

Swipe-based mobile app for movie & TV discovery.

See `docs/PRD.md`, `docs/SRS.md`, `docs/FSD.md` for product, requirements, and feature specs.

## Stack

React Native + Expo SDK 52 (New Architecture), TypeScript strict, expo-router,
NativeWind, TanStack Query, Zustand, Reanimated v3, Gesture Handler, Supabase,
BetterAuth, Sentry, PostHog, Biome, Jest, Maestro. Full rationale in
`docs/SRS.md § 7.5` and `docs/PRD.md Appendix E § 16.5`.

## Layout

```
apps/mobile          Expo app (expo-router)
packages/shared      zod schemas + shared types
docs/                PRD / SRS / FSD / DECISIONS
```

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in secrets
pnpm start                   # expo start
```

Requires Node 20+, pnpm 10+.

## Quality

- `pnpm lint` — Biome (formatter + linter, replaces ESLint + Prettier)
- `pnpm typecheck` — TypeScript strict, `noUncheckedIndexedAccess`
- `pnpm test` — Jest unit + component tests

CI runs all three on every PR. Pre-commit hook formats staged files and validates commit messages (conventional commits).
