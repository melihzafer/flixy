# Flixy product context

register: product

## Product purpose

Flixy is a mobile-first movie and TV discovery app. It turns the frustrating act of choosing what to watch into a fast, low-effort swipe loop. Users see one cinematic card at a time, make a decision in seconds, and build a useful watchlist as a side effect.

## Launch scope

The current launch pass covers the full existing mobile app surface:

- Email, anonymous preview, and Google auth.
- Region, service, genre, cold-start, and notification onboarding.
- Swipe deck, filters, title detail, search, watchlist, profile, and settings.
- Supabase-backed user data with local catalogue fallback for resilience.

Phase 2 social features, admin tooling, payments, smart TV apps, and streaming playback are outside this pass.

## Users

- Casual streaming subscribers with multiple services who do not want to browse poster grids.
- Couples, families, and friend groups who need a faster way to agree on what to watch, with social flows deferred.
- Film and series fans who want a watchlist that reflects current mood, not stale saved items.

## Core product principles

1. Gesture beats menu.
2. One card at a time on the main discovery surface.
3. Cards must feel cinematic and decisive.
4. A user should be able to decide on a card in under two seconds.
5. The watchlist builds as a side effect of swiping.
6. Recommendations are streaming-aware, not tied to one service.
7. Social features should later improve the single-player loop without adding noise.

## Product tone

Flixy should feel confident, cinematic, direct, and calm. Copy should help users act quickly. Avoid generic streaming-app filler, overexplaining, loud success messages, and vague error text.

## Key flows

- New user: welcome, auth or anonymous preview, onboarding, cold-start swipes, notification decision, discover.
- Returning user: restore session, land on Discover, continue swiping, search, open details, manage watchlist.
- Anonymous preview: let the user experience the swipe loop, then nudge sign-up after a few meaningful saves/swipes.
- Recovery: fallback catalogue keeps the app usable when remote catalogue data is empty or unavailable, with telemetry.

## Important decisions

- Anonymous mode is preview-only, with a sign-up prompt after a few swipes.
- Fallback catalogue is allowed in production as graceful degradation, with telemetry.
- Cold-start swipes create real swipe events immediately.
- Seen state uses swipe-down plus `watchlist_items.watched_at` projection.
- Settings edits should use dedicated edit screens.
- Launch auth providers are Email, Anonymous, and Google.

## Anti-references

- Infinite poster grids as the primary experience.
- Search-first or tracker-first workflows.
- Database-style title pages that feel like IMDb clones.
- Decorative motion that delays the task.
- Generic AI gradient aesthetics.
- Copy that says only “Something went wrong” when the user can take a specific action.
