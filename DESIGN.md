# Flixy design context

## Design register

Product UI. The interface serves quick decisions, low cognitive load, and confident task completion. Familiar mobile patterns are preferred when they help users move faster.

## Physical scene

A user is on a couch at night, phone brightness low, trying to decide what to watch within a few minutes. The UI should be dark, low-glare, cinematic, and readable over poster art.

## Visual direction

- Dark editorial entertainment product.
- Off-black surfaces, warm ivory text, orange brand accent.
- Poster-first card surfaces with strong contrast protection.
- Restrained product controls outside the card surface.
- Delight appears in swipe feedback and card presentation, not in every button.

## Tokens

Current source: `apps/mobile/src/theme/tokens.ts`.

- Background: `#0A0A0B`
- Surface: `#111113`, `#1A1A1D`, `#242428`
- Text: `#F5F5F0`
- Muted text: `rgba(245,245,240,0.45)`
- Accent: `#FF4D1C`
- Swipe right: `#3DD68C`
- Swipe left: `#E05C4B`
- Swipe up: `#F5C842`
- Swipe down: `#5B8DEF`

Mirror token changes in `apps/mobile/tailwind.config.js`.

## Typography

- Display: Newsreader italic for cinematic headers and title treatment.
- Body: Space Grotesk for controls, labels, metadata, and readable UI text.
- Do not use display typography for dense settings labels or form labels.
- Keep body copy short and line lengths comfortable.

## Component rules

- Primary actions use the orange accent.
- Secondary actions use neutral surfaces with clear borders.
- Every interactive control needs pressed, disabled, loading, and error states where applicable.
- Use skeleton states in content areas instead of isolated spinners.
- Empty states should teach the next useful action.
- Error states should name the failing area and offer retry or recovery.

## Screen guidance

- Discover: immersive card stack, poster art, protected type contrast, visible gesture alternatives.
- Onboarding: one decision per screen, clear validation, progress without pressure.
- Detail: poster/backdrop hero, concise metadata, direct actions, availability links.
- Watchlist: efficient list management, clear top/saved/watched states, no decorative clutter.
- Search: fast query, clear no-results recovery, open detail without dead ends.
- Profile and settings: restrained, familiar, editable, and data-backed.

## Motion

- Swipe physics should feel immediate and natural.
- State transitions should stay short, around 150 to 250ms.
- Motion should communicate action, success, queueing, or reveal. Avoid decorative page-load choreography.

## Accessibility

- Keep touch targets at least 44px.
- Add accessible labels for swipe actions, filter chips, auth buttons, watchlist rows, and settings rows.
- Ensure poster-backed text has strong overlays.
- Provide button alternatives for gesture actions.
- Prefer test IDs for e2e flows over visible translated text.

## Bans

- Pure black or pure white.
- Decorative glassmorphism.
- Gradient text.
- Heavy accent use on inactive states.
- Identical card grids as a default layout.
- Generic “Oops” and vague “Something went wrong” messages.

## Screenshot-locked refinements

The May 2026 mobile references are the current visual source of truth for repair work.

- The visible app name is always Flixy. The italic wordmark needs enough left padding and wrapper width for glyph overhang, especially the F.
- Bottom navigation is part of the product system, not decoration. Icons and labels must never clip, overlap, or bleed off-screen on narrow Android devices.
- The orange CTA system uses orange-red backgrounds with dark foreground text for primary actions. Do not use low-contrast red-on-black primary CTAs.
- Decorative ember shapes must be masked, intentional, and secondary. A loose red circle bleeding from a corner is a layout bug.
- Profile and settings use compact grouped rows: left label, right value, optional chevron or toggle. No centered floating values or orphan chevrons.
- Search and detail screens must never expose developer language such as fallback/catalogue diagnostics. Degraded data states use user-facing recovery copy.
