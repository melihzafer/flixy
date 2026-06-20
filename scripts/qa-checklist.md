# Flixy Pre-Release QA Checklist

Manual verification gates that complement the automated test suite. Run on a
narrow Android device (≤ 360dp width, e.g. Xiaomi/MIUI 1080×2400, status bar visible).

## Catalogue & Data Integrity
- [ ] Search "himym" returns *How I Met Your Mother* with 22m runtime.
- [ ] Game of Thrones detail screen shows no fabricated cast/director, no "1h 0m" runtime token.
- [ ] When `runtime_minutes` is null, the meta row omits the runtime segment entirely.
- [ ] Profile shows real selected streaming services (single summary row), not four "Selected" rows.

## Layout (1080×2400, narrow Android)
- [ ] Flixy wordmark italic "F" is fully visible on every header (deck, watchlist, search, profile, auth).
- [ ] All four bottom tab labels (Discover / Watchlist / Search / Profile) render fully and centered, no clipping at left or right edge.
- [ ] No orphan ember/red circle bleeds out of the Welcome or Sign-up screen viewport.
- [ ] "Create account" button on sign-up renders solid orange with dark legible label.

## Onboarding
- [ ] Notifications screen headline ("Stay in the loop") renders complete, no truncation.
- [ ] "Maybe later" tap target meets 44pt minimum and sits above the gesture bar.
- [ ] Quick-taste round can be skipped; skipping advances to the deck.

## Auth / OAuth
- [ ] Welcome / Sign-in / Sign-up share identical vertical rhythm and CTA stack.
- [ ] Google OAuth completes on Android device; returns to deck within 30s.
- [ ] OAuth `auth_oauth_started` and `auth_oauth_completed` events visible in PostHog.

## Watchlist
- [ ] Rows show poster · title · availability chip · trailing kebab — no header-row label clutter.
- [ ] Kebab opens action sheet (Pass / Mark watched / Mark top / Remove).

## Search
- [ ] Typing "sherlock" shows spinner → results, never "Searching a smaller set" while online.
- [ ] Empty result shows `No results for "<query>"`.
- [ ] Offline mode still falls back to local catalogue with the degraded copy.

## Telemetry
- [ ] PostHog receives `tab_pressed`, `onboarding_notifications_dismissed`, and (when applicable) `onboarding_taste_skipped`, `search_no_result`, `watchlist_row_action`.
