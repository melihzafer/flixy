# Maestro E2E flows for Flixy

These YAML files describe end-to-end user journeys that map to **FSD § 15**.

| File | Journey | FSD ref |
|------|---------|---------|
| `new-user.yaml` | Sign-up + onboarding + first cold-start swipe + notif prompt | § 15 New User |
| `returning-user.yaml` | Open deck → swipe a few cards → verify watchlist row appears | § 15 Returning User |

## Running locally

```bash
# install: https://maestro.mobile.dev
maestro test apps/mobile/e2e/returning-user.yaml
maestro test apps/mobile/e2e/new-user.yaml
```

## CI

A scheduled Maestro Cloud run is added in a follow-up PR once the EAS preview
build channel is wired (Phase 5).

## TestIDs

The flows reference these stable IDs (do not rename without updating the YAML):

- `deck-button`, `search-button`, `watchlist-button` — home menu
- `swipe-card` — top card in the deck
- `watchlist-row` — each watchlist item row
