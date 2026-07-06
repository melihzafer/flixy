# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-07-06T13:58:34.614Z
> Files: 33 tracked | Anatomy hits: 0 | Misses: 0

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

- `MEMORY.md` (~152 tok)
- `project_flixy_localization.md` (~410 tok)

## UI_UX_Claude_Design/


## UI_UX_Claude_Design/flixy/


## UI_UX_Claude_Design/uploads/


## apps/mobile/

- `app.config.ts` — Declares process (~1142 tok)

## apps/mobile/.expo/


## apps/mobile/.expo/types/


## apps/mobile/app/

- `_layout.tsx` — Holds the native splash screen until the auth session has actually resolved, (~1480 tok)

## apps/mobile/app/(app)/

- `settings-language.tsx` — LANGUAGES (~629 tok)
- `settings-promo.tsx` — Promo code redemption screen: Input + Button, success/error states (~2100 tok)
- `trailers.tsx` — TrailersScreen (~5534 tok)
- `watchlist-triage.tsx` — WatchlistTriageScreen (~3178 tok)

## apps/mobile/app/(app)/(tabs)/

- `deck.tsx` — DeckScreen (~10378 tok)
- `watchlist.tsx` — FILTERS (~6472 tok)

## apps/mobile/app/(app)/title/

- `[id].tsx` — TitleDetail (~6068 tok)

## apps/mobile/app/(auth)/


## apps/mobile/app/(onboarding)/

- `region.tsx` — REGIONS (~2012 tok)

## apps/mobile/e2e/


## apps/mobile/src/


## apps/mobile/src/components/


## apps/mobile/src/components/__tests__/


## apps/mobile/src/features/auth/

- `useSession.ts` — Whether the persisted local session has been read from storage at least (~1175 tok)

## apps/mobile/src/features/auth/__tests__/

- `useSession.test.ts` — Regression tests for the startup session hydration race (login flash). (~1381 tok)

## apps/mobile/src/features/catalogue/

- `display.ts` — Exports TitleDisplay, toTitleDisplay (~676 tok)
- `hooks.ts` — Origin country ISO-3166 alpha-2 filter (e.g. "TR", "US", "KR"). (~3579 tok)

## apps/mobile/src/features/catalogue/__tests__/


## apps/mobile/src/features/deck/

- `FilterSheet.tsx` — MOODS — renders modal (~4610 tok)
- `hooks.ts` — When the remaining deck drops below this threshold, fetch the next TMDB (~7158 tok)

## apps/mobile/src/features/entitlements/


## apps/mobile/src/features/entitlements/__tests__/


## apps/mobile/src/features/notifications/


## apps/mobile/src/features/onboarding/


## apps/mobile/src/features/onboarding/__tests__/


## apps/mobile/src/features/profile/


## apps/mobile/src/features/search/


## apps/mobile/src/features/search/__tests__/


## apps/mobile/src/features/swipe/

- `hooks.ts` — High-level swipe API consumed by the deck screen. Wraps queue + haptics + (~3161 tok)
- `SwipeCard.tsx` — Drag distance before the gesture hard-locks to one axis (no diagonals). (~5078 tok)

## apps/mobile/src/features/telemetry/


## apps/mobile/src/features/watchlist/


## apps/mobile/src/features/watchlist/__tests__/


## apps/mobile/src/i18n/

- `index.ts` — Exports ENABLED_LANGUAGES, EnabledLanguage, isLanguageEnabled (~562 tok)

## apps/mobile/src/i18n/locales/

- `en.json` (~4953 tok)
- `tr.json` (~2943 tok)

## apps/mobile/src/lib/

- `tmdb.ts` — Returns the current TMDB language tag (e.g. "tr-TR"). (~4414 tok)

## apps/mobile/src/lib/__tests__/


## apps/mobile/src/stores/


## apps/mobile/src/theme/


## apps/mobile/store/app-store/


## apps/mobile/store/play-store/


## apps/web/


## docs/

- `BRAINSTORM_FILTERS_FEATURES.md` — Brainstorming blueprint for advanced filtering and features (~1800 tok)

## packages/catalogue-ingest/


## packages/catalogue-ingest/src/


## packages/catalogue-ingest/src/__tests__/


## packages/shared/


## packages/shared/src/

- `composer.ts` — 7-layer deck composer (FSD section 3.5.3). Pure function: takes a candidate (~4708 tok)
- `index.ts` (~132 tok)
- `taste.ts` — Taste signal builder — turns raw swipe history into the weighted, (~1080 tok)

## packages/shared/src/__tests__/

- `composer.test.ts` — Declares mkTitle (~4580 tok)
- `taste.test.ts` — Declares NOW (~1215 tok)

## packages/shared/src/schemas/

- `deck.ts` — A scored deck candidate plus the rule trace explaining why it landed in the (~1343 tok)
- `tasteEvent.ts` — Zod schemas: TasteEventTypeSchema, TasteEventSchema (~142 tok)
- `title.ts` — Zod schemas: TitleKindSchema, OfferTypeSchema, TitleAvailabilitySchema, TitleSchema (~502 tok)

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

