# Maestro E2E flows for Flixy

These YAML files describe end-to-end user journeys that map to **FSD § 15**.

| File | Journey | FSD ref |
|------|---------|---------|
| `new-user.yaml` | Sign-up + onboarding + first cold-start swipe + notif prompt | § 15 New User |
| `returning-user.yaml` | Open deck → swipe a few cards → verify watchlist row appears | § 15 Returning User |
| `search-detail-settings.yaml` | Search → detail action → watchlist filters → settings edits | § 15 Library + Account |

## Running locally

```bash
# install: https://maestro.mobile.dev
maestro test apps/mobile/e2e/returning-user.yaml
maestro test apps/mobile/e2e/new-user.yaml
maestro test apps/mobile/e2e/search-detail-settings.yaml
```

The sign-up journey requires a preview build with Supabase Auth configured and
email confirmation disabled for QA addresses.

## CI

A scheduled Maestro Cloud run is added in a follow-up PR once the EAS preview
build channel is wired (Phase 5).

## TestIDs

The flows reference these stable IDs (do not rename without updating the YAML):

- `deck-button`, `search-button`, `watchlist-button` — tab bar buttons
- `swipe-card` — top card in the deck
- `deck-pass-button`, `deck-seen-button`, `deck-save-button`, `deck-top-button`, `deck-info-button`, `deck-undo-button` — Discover actions
- `detail-pass-button`, `detail-save-button`, `detail-top-button`, `detail-seen-button`, `detail-trailer-button` — title detail actions
- `search-clear-button`, `search-result-row` — search clear action and tappable result rows
- `watchlist-row` — each watchlist item row
- `watchlist-filter-all`, `watchlist-filter-top`, `watchlist-filter-watched` — watchlist filters
- `profile-settings-row`, `settings-services-row`, `settings-genres-row` — Profile → Settings navigation
- `settings-service-<id>`, `settings-services-save`, `settings-genre-<id>`, `settings-genres-save` — settings edit screens
