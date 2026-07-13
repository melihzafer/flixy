# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-07-13T23:15:29.820Z
> Files: 32 tracked | Anatomy hits: 0 | Misses: 0

## ./


## .agents/skills/ckm-banner-design/


## .agents/skills/ckm-banner-design/references/


## .agents/skills/ckm-brand/


## .agents/skills/ckm-brand/references/


## .agents/skills/ckm-brand/scripts/


## .agents/skills/ckm-brand/templates/


## .agents/skills/ckm-design-system/


## .agents/skills/ckm-design-system/data/


## .agents/skills/ckm-design-system/references/


## .agents/skills/ckm-design-system/scripts/


## .agents/skills/ckm-design-system/templates/


## .agents/skills/ckm-design/


## .agents/skills/ckm-design/data/cip/


## .agents/skills/ckm-design/data/icon/


## .agents/skills/ckm-design/data/logo/


## .agents/skills/ckm-design/references/


## .agents/skills/ckm-design/scripts/cip/


## .agents/skills/ckm-design/scripts/icon/


## .agents/skills/ckm-design/scripts/logo/


## .agents/skills/ckm-slides/


## .agents/skills/ckm-slides/references/


## .agents/skills/ckm-ui-styling/


## .agents/skills/ckm-ui-styling/canvas-fonts/


## .agents/skills/ckm-ui-styling/references/


## .agents/skills/ckm-ui-styling/scripts/


## .agents/skills/ckm-ui-styling/scripts/tests/


## .agents/skills/design-taste-frontend/


## .agents/skills/full-output-enforcement/


## .agents/skills/impeccable/


## .agents/skills/impeccable/agents/


## .agents/skills/impeccable/reference/


## .agents/skills/impeccable/scripts/


## .agents/skills/minimalist-ui/


## .agents/skills/redesign-existing-projects/


## .agents/skills/stitch-design-taste/


## .agents/skills/ui-ux-pro-max/


## .claude/


## .claude/rules/


## .design-bundle/flixy/


## .design-bundle/flixy/chats/


## .design-bundle/flixy/project/


## .design-bundle/flixy/project/flixy/


## .design-bundle/flixy/project/uploads/


## .expo/


## .github/


## .github/workflows/


## .husky/


## .husky/_/


## C:/Users/melih/.claude/plans/


## C:/Users/melih/.claude/projects/D--Projects-Flixy/memory/


## UI_UX_Claude_Design/


## UI_UX_Claude_Design/flixy/


## UI_UX_Claude_Design/uploads/


## apps/mobile/

- `metro.config.js` — Declares path (~511 tok)

## apps/mobile/.expo/


## apps/mobile/.expo/types/


## apps/mobile/app/

- `_layout.tsx` — Holds the native splash screen until the auth session has actually resolved, (~1834 tok)

## apps/mobile/app/(app)/

- `settings-account.tsx` — WELCOME_ROUTE (~739 tok)
- `settings.tsx` — Unified settings hub. Reachable from the Profile tab via the "Settings" row. (~3322 tok)
- `trailers.tsx` — TrailersScreen (~6007 tok)

## apps/mobile/app/(app)/(tabs)/

- `deck.tsx` — DeckScreen (~12381 tok)

## apps/mobile/app/(app)/title/

- `[id].tsx` — TitleDetail (~5998 tok)

## apps/mobile/app/(auth)/


## apps/mobile/app/(onboarding)/


## apps/mobile/e2e/


## apps/mobile/src/


## apps/mobile/src/components/

- `CustomTabBar.tsx` — TABS (~1214 tok)
- `PwaInstallModal.tsx` — Web-only "Add to Home Screen" prompt. Renders nothing on the native APK (~1800 tok)

## apps/mobile/src/components/__tests__/


## apps/mobile/src/features/auth/


## apps/mobile/src/features/auth/__tests__/


## apps/mobile/src/features/catalogue/


## apps/mobile/src/features/catalogue/__tests__/


## apps/mobile/src/features/deck/

- `hooks.ts` — When the remaining deck drops below this threshold, fetch the next TMDB (~9425 tok)
- `queueFilter.ts` — Live filter for the deck screen's append-only card queue. (~352 tok)

## apps/mobile/src/features/deck/__tests__/

- `queueFilter.test.ts` — Declares mkCard (~661 tok)

## apps/mobile/src/features/entitlements/


## apps/mobile/src/features/entitlements/__tests__/


## apps/mobile/src/features/notifications/


## apps/mobile/src/features/onboarding/


## apps/mobile/src/features/onboarding/__tests__/


## apps/mobile/src/features/profile/


## apps/mobile/src/features/search/


## apps/mobile/src/features/search/__tests__/


## apps/mobile/src/features/swipe/

- `hooks.ts` — High-level swipe API consumed by the deck screen. Wraps queue + haptics + (~3259 tok)
- `queue.ts` — Swipe queue (FSD section 3.6.4). Every swipe is an immutable event with a (~1859 tok)

## apps/mobile/src/features/swipe/__tests__/

- `queue.test.ts` — Declares insert (~1474 tok)

## apps/mobile/src/features/telemetry/


## apps/mobile/src/features/watchlist/

- `hooks.ts` — Watchlist read/write APIs (FSD section 3.7). Reads come from (~1229 tok)

## apps/mobile/src/features/watchlist/__tests__/


## apps/mobile/src/hooks/

- `usePwaInstallPrompt.ts` — Wait for onboarding value before asking, per the UX research: never on the first paint. (~923 tok)

## apps/mobile/src/i18n/


## apps/mobile/src/i18n/locales/

- `en.json` (~5838 tok)
- `tr.json` (~5953 tok)

## apps/mobile/src/lib/

- `localDb.ts` — A card the user actually SAW at the top of the deck but did not swipe. (~4948 tok)
- `pwaInstall.ts` — PWA "Add to Home Screen" install-prompt persistence. (~624 tok)
- `pwaInstallPlatform.ts` — Flixy ships as a native APK (Platform.OS === 'ios' | 'android') and as a (~506 tok)
- `query.ts` — Exports queryClient, queryPersister (~311 tok)

## apps/mobile/src/lib/__tests__/

- `localDb.test.ts` — store: makeWatchlistItem (~5232 tok)
- `pwaInstall.test.ts` — Declares store (~538 tok)

## apps/mobile/src/stores/


## apps/mobile/src/theme/


## apps/mobile/store/app-store/


## apps/mobile/store/play-store/


## apps/web/


## apps/web/scripts/

- `build.js` — fs: cleanDir, copyRecursiveSync, getAllFiles, build (~2583 tok)

## docs/


## packages/catalogue-ingest/


## packages/catalogue-ingest/src/


## packages/catalogue-ingest/src/__tests__/


## packages/shared/


## packages/shared/src/

- `composer.ts` — 7-layer deck composer (FSD section 3.5.3). Pure function: takes a candidate (~6482 tok)

## packages/shared/src/__tests__/

- `composer.test.ts` — Declares mkTitle (~6353 tok)

## packages/shared/src/schemas/

- `swipe.ts` — Client-emitted swipe event. The `eventId` is a client UUID used for (~520 tok)

## packages/shared/src/schemas/__tests__/


## scripts/


## supabase/


## supabase/.temp/


## supabase/functions/_shared/catalogue/


## supabase/functions/catalogue-ingest/


## supabase/functions/embed-titles/


## supabase/functions/omdb-enrich/


## supabase/functions/trakt-sync/


## supabase/migrations/

