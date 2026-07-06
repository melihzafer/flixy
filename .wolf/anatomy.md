# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-07-06T14:52:59.637Z
> Files: 12 tracked | Anatomy hits: 0 | Misses: 0

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


## apps/mobile/.expo/


## apps/mobile/.expo/types/


## apps/mobile/app/

- `_layout.tsx` — Holds the native splash screen until the auth session has actually resolved, (~1668 tok)

## apps/mobile/app/(app)/

- `settings-account.tsx` — WELCOME_ROUTE (~739 tok)
- `settings.tsx` — Unified settings hub. Reachable from the Profile tab via the "Settings" row. (~3322 tok)
- `trailers.tsx` — TrailersScreen (~6007 tok)

## apps/mobile/app/(app)/(tabs)/


## apps/mobile/app/(app)/title/


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


## apps/mobile/src/features/entitlements/


## apps/mobile/src/features/entitlements/__tests__/


## apps/mobile/src/features/notifications/


## apps/mobile/src/features/onboarding/


## apps/mobile/src/features/onboarding/__tests__/


## apps/mobile/src/features/profile/


## apps/mobile/src/features/search/


## apps/mobile/src/features/search/__tests__/


## apps/mobile/src/features/swipe/


## apps/mobile/src/features/telemetry/


## apps/mobile/src/features/watchlist/


## apps/mobile/src/features/watchlist/__tests__/


## apps/mobile/src/hooks/

- `usePwaInstallPrompt.ts` — Wait for onboarding value before asking, per the UX research: never on the first paint. (~923 tok)

## apps/mobile/src/i18n/


## apps/mobile/src/i18n/locales/

- `en.json` (~5838 tok)
- `tr.json` (~5953 tok)

## apps/mobile/src/lib/

- `pwaInstall.ts` — PWA "Add to Home Screen" install-prompt persistence. (~624 tok)
- `pwaInstallPlatform.ts` — Flixy ships as a native APK (Platform.OS === 'ios' | 'android') and as a (~506 tok)

## apps/mobile/src/lib/__tests__/

- `pwaInstall.test.ts` — Declares store (~538 tok)

## apps/mobile/src/stores/


## apps/mobile/src/theme/


## apps/mobile/store/app-store/


## apps/mobile/store/play-store/


## apps/web/


## docs/


## packages/catalogue-ingest/


## packages/catalogue-ingest/src/


## packages/catalogue-ingest/src/__tests__/


## packages/shared/


## packages/shared/src/


## packages/shared/src/__tests__/


## packages/shared/src/schemas/


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

