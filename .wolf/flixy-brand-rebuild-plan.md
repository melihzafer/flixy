# Flixy Brand-Locked Rebuild and Crash/Auth Fix Plan

## Problem statement

The current Flixy build still needs a stricter brand-locked rebuild pass. The supplied `docs\ui-images` references define a much sharper product identity than the current app consistently delivers: dramatic orange-red serif wordmark, near-black cinematic surfaces, editorial italic headlines, compact dark controls, premium negative space, and a boutique film-curation mood.

The plan is not to preserve weak UI because it exists. The plan is to fix the runtime deck crash, harden auth/OAuth and keyboard handling, rebuild auth around the reference visual language, then audit and align onboarding, discovery, empty states, profile, settings, and navigation so the app feels like one premium Flixy product.

IMPECCABLE_PREFLIGHT: context=pass product=pass command_reference=pass shape=not_required image_gate=pass:docs-ui-images-reviewed mutation=open

## Blunt diagnosis

The app has improved technically, but the newest evidence shows it is not trustworthy enough to ship:

- The visual system is still not locked tightly enough to the provided Flixy references.
- Auth remains the highest-risk perception surface because it must feel poster-quality, not form-card generic.
- Password readability and keyboard behavior need a dedicated form-field rebuild, including a show/hide password control.
- Google OAuth must be tested against native redirect, deep-link return, cancellation, failure, and stale session states, not only code-path support.
- The deck crash is likely caused by unsafe assumptions around async/persisted catalogue data shape.
- Previous issues need a regression pass after the new brand and crash fixes, not just spot fixes.

## Flixy brand system from references

- **Cinematic and editorial:** Flixy should feel like a boutique film magazine or premium streaming ritual, not a dashboard or utility app.
- **Luxury-dark:** Backgrounds are near-black with subtle tonal depth. Avoid obvious gray panels and flat template blocks.
- **Orange-red signature:** The wordmark, primary CTAs, active nav, and progress indicators use a vivid warm ember red-orange.
- **Serif as emotion:** The wordmark and major headlines are dramatic, italic, high-contrast serif. Sans-serif is only the utility layer.
- **Compact premium controls:** Service cards, chips, metadata pills, and rows are dark, softly bordered, dense, and tactile.
- **Poster-like composition:** Auth, onboarding, empty states, and discovery should use deliberate vertical space and strong focal hierarchy.

## Root cause analysis

### Wrong brand name risk

User reports visible `Flixv`. Current repository search found no `Flixv`/`flixv`, so the source may be a stale bundle/cache, generated asset, screenshot artifact, external store/build metadata, or a file outside the normal source path. The implementation pass must still audit all visible text and build surfaces.

### Auth UI and input visibility

Current auth screens still use a form-card composition and shared `Input` has no password reveal mode. The field text color is technically set, but the low-contrast dark field, secure-entry dots, muted placeholders, and keyboard compression can make the password field feel hard to see. Auth needs a reference-aligned rebuild, not incremental spacing tweaks.

### Google OAuth

Current callback code supports PKCE and fragments, but Google auth remains unverified end-to-end. The plan must cover Expo redirect generation, Supabase allowlist, deep-link return, browser cancellation, stale session, session hydration, and auth gate transitions.

### Deck crash

Most likely root cause: `useTitlesQuery` changed from returning `Title[]` to `{ titles, diagnostics }`, while TanStack persisted cache still uses `flixy.query-cache.v1` and query keys like `['titles', 'query', key]`. Existing devices can hydrate old `Title[]`; deck code reads `.titles`, gets `undefined`, and passes undefined into `composeDeck`, which calls `candidates.filter`.

Secondary risk: malformed title records with undefined `genres` or `availability`.

## Implementation targets

- Brand audit: all source, metadata, generated/store files, screenshots, and cached text for `Flixv`.
- Auth rebuild: `AuthSheet`, auth route screens, `Input`, `SocialButton`, `Button`, `tokens`.
- OAuth hardening: `oauthCallback`, auth hooks, deep-link hook, session hook, Supabase client, root gate, Expo config.
- Deck crash fix: `composer`, deck hooks, catalogue hooks, query persistence key, deck screen, cold-start screen.
- Core UI brand-lock: onboarding, discovery, empty states, profile, settings, bottom nav.

## Todo plan

1. Brand/reference audit.
2. Deck crash root-cause fix.
3. Auth input and keyboard rebuild.
4. Auth visual rebuild.
5. Google OAuth hardening.
6. Core UI brand-lock pass.
7. Previous issue regression pass.
8. Validation and QA.

## Acceptance checklist

- App says Flixy everywhere, never Flixv.
- Auth screen visually matches the reference family, not generic Expo/card UI.
- Email/password typed text is clearly visible.
- Password reveal toggle works.
- Keyboard does not hide active fields or CTA.
- Google auth succeeds, cancels safely, fails with useful feedback, restores session, and routes correctly.
- Deck never crashes with stale cache, empty data, delayed data, malformed records, or fallback data.
- Core screens visually share one Flixy family.
- Previous profile/settings/data/rendering issues are rechecked.
- `pnpm typecheck`, `pnpm test`, and `pnpm lint` pass.

## Brand reference audit - 2026-05-01

### Flixv and app-name leakage search

- Searched visible source, metadata, generated, store, docs, screenshots, design-bundle, and web surfaces for `Flixv`, `flixv`, and `FLIXV`.
- No `Flixv` occurrences were found in `apps\mobile\app.config.ts`, `apps\mobile\app`, `apps\mobile\src`, `apps\mobile\store`, `apps\mobile\dist`, `apps\web`, `docs`, `UI_UX_Claude_Design`, or `.design-bundle`.
- The only `Flixv` hits are tracking references in `.wolf\flixy-brand-rebuild-plan.md` and `.wolf\buglog.json` describing the reported issue.
- Visible app-name surfaces use `Flixy`: `apps\mobile\app.config.ts`, App Store and Play Store metadata, web title/meta/legal pages, mobile i18n, auth/onboarding/deck/profile copy, design bundle, and generated `apps\mobile\dist` export.
- App icon, adaptive icon, splash, and notification icon are near-black image assets with no visible wordmark. They are not `Flixv` sources, but they are stale or incomplete relative to the reference wordmark.

### Likely stale or external places if Flixv is still seen

- Device cache, Expo Go cache, old native build, old static export, app-store preview cache, or screenshot/video collateral outside this checkout.
- OCR or visual misread of the high-contrast italic `Flixy` wordmark is possible, especially at small sizes.
- Google OAuth account chooser screenshots are external browser surfaces and show the Supabase project domain, not a Flixy in-app brand string.

### Reference language and constraints from `docs\ui-images`

- App name must be exactly `Flixy` everywhere. Never `Flixv`, `FLIXV`, or alternate capitalization in visible product or store copy.
- Wordmark: oversized orange-red italic serif on near-black, with boutique cinema energy. Use it sparingly at brand entry points and deck chrome.
- Core line: `Stop browsing. Start watching.` Reference splash also uses tracked uppercase `STOP BROWSING. START WATCHING.`
- Auth create-account reference: `Create your account`, `Save your watchlist. Your taste, your data.`, Apple first, Google second, `or use email`, placeholders `Email address` and `Password`, CTA `Create account`, link `Already have an account? Sign in`.
- Services onboarding reference: `What are you subscribed to?`, `Pick every service you have access to.`, compact two-column service cards, disabled ember CTA until selection.
- Cold-start reference: `Quick taste`, progress `0/10`, poster card with editorial hook, title, metadata, service chips. Current `Quick taste check` should be considered drift.
- Notifications reference: `Never miss a drop`, `We'll let you know when titles leave your services, or when something new lands that you'll love.`, `Enable notifications`, `Maybe later`.
- Discover reference: small orange `Flixy` wordmark, gear control, cinematic card, direct action buttons, bottom tabs. Avoid extra explanatory chrome over the card.
- Watchlist empty reference: `Nothing here yet.`, `Swipe right on films you want to watch - they'll appear here.` Current longer empty copy is drift and should be shortened.
- Profile reference: anonymous upgrade banner, centered anonymous identity, stats row, then explicit selected service rows with checkmarks. A single service summary row is weaker than the reference.

### Implementation guardrails for other agents

- Preserve dark cinematic physical scene: off-black background, warm ivory type, ember accent, poster-first hierarchy.
- Serif is for emotion and product identity: wordmark, major headers, title cards. Sans is for controls, forms, metadata, and dense rows.
- Keep copy short and action-led. Avoid generic streaming filler, vague errors, and long explanatory empty states.
- Do not add new card-grid or glass effects. Keep controls compact, bordered, tactile, and low-glare.
- If assets are rebuilt, replace blank app icon and splash with a legible Flixy mark or approved non-text symbol, never a blank black square.
