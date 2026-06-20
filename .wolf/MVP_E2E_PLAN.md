# Flixy — End-to-End MVP Completion Plan

> Target decided 2026-06-12: **Local-first personal MVP.**
> No Supabase. Catalogue comes from the **TMDB API only** (fetched live, not
> persisted). All user data (auth session, preferences, swipes, watchlist,
> profile) lives in **local device storage** (`AsyncStorage` via `localDb`).
> A real database will be introduced later; this plan keeps a clean seam for
> that swap. Commercial licensing is a later, human step (email for an offer).

This plan finishes the app so that every flow works on a real device with no
backend — a fully usable single-device app — and leaves a documented path to
plug in a server later.

---

## 0. Current State (verified, not assumed)

What is **already wired and working** end-to-end as a local prototype:

- **Routing gate** (`app/index.tsx`): session → onboarding → app. Correct.
- **Mock auth** (`features/auth/hooks.ts` + `useSession.ts`): sign-up, sign-in,
  anonymous, Google, sign-out, upgrade all create a local session in
  `AsyncStorage`. The app treats any credentials as valid.
- **Onboarding** (region, services, genres, cold-start, notifications): reads
  fallback service/genre lists, writes prefs to `localDb`. Cold-start deck is
  fully wired to TMDB + `useRecordSwipe`. Working.
- **Catalogue** (`lib/tmdb.ts` + `features/catalogue/hooks.ts`): live TMDB
  discover/detail/search with a local `FALLBACK_TITLES` safety net. Working.
- **Deck swipes** (`features/swipe/*`): swipe → haptics → telemetry → optimistic
  watchlist projection → `localDb`. The "queue" drains into `localDb`, not a
  server. Working locally.
- **Watchlist** (`features/watchlist/hooks.ts`): read/filter/mark-watched/remove/
  set-priority against `localDb`. Working.
- **i18n** (en/tr/bg), theme tokens, shared components. Working.

What is **stubbed, fake, or risky** (the real "not built / not wired" list):

| # | Item | File | Problem |
|---|------|------|---------|
| G1 | Avatar upload | `features/profile/hooks.ts:123` | Returns a hardcoded Unsplash URL; image never saved. |
| G2 | Handle availability | `features/profile/hooks.ts:115` | Always returns `true`. |
| G3 | Password reset / update | `features/auth/hooks.ts:124-138` | No-ops. |
| G4 | Sign-in validation | `features/auth/hooks.ts:60` | Any email+password "succeeds"; no local credential store. |
| G5 | TMDB key in source | `lib/tmdb.ts:12` | Hardcoded API key fallback committed to git. |
| G6 | TMDB N+1 provider calls | `lib/tmdb.ts:376` | Each discover item triggers a separate watch/providers call → slow + rate-limit risk. |
| G7 | `localDb` durability | `lib/localDb.ts` | Single JSON blob in AsyncStorage; module-level cache; no migration/versioning beyond key suffix. Fine for MVP but needs the DB seam (see §6). |
| G8 | Dead Supabase surface | `lib/supabase.ts`, ingestion pkgs, supabase functions | Disabled mock + unused server code create confusion. Decide: keep dormant or quarantine. |
| G9 | Taste personalization | `features/deck/hooks.ts` (verify) | Confirm whether deck ordering uses recorded swipes or is pure TMDB popularity. |
| G10 | Notifications | `lib/notifications.ts` | Confirm local scheduling + deep-link handling actually fire on device. |

---

## Phase 1 — Make the local data layer real and trustworthy

Goal: user data survives, is per-user isolated, and has a documented swap seam.

1. **Per-user isolation audit** — `localDb` filters by `user_id`, but the
   module-level caches are shared across account switches in one session.
   - On sign-out (`useSignOut`) and account upgrade, reset in-memory caches so a
     second account in the same launch can't read the first one's data.
   - Add a `localDb.clearUser(userId)` helper used by sign-out for true logout.
2. **Versioned storage + migration shim** — wrap reads so a future schema bump
   can migrate the JSON blobs instead of silently dropping them. Keys already
   carry `.v3`; add a `__schema_version` field and a no-op migrator now so the
   hook exists when the real DB lands.
3. **Define the repository seam** — `localDb` is the single data boundary.
   Document that every feature hook talks to `localDb`, never to storage
   directly, so swapping `localDb`'s internals for a real DB client later is a
   one-file change. Add `docs/DATA_LAYER.md` describing the contract
   (methods, shapes, invariants).
4. **Tests**: extend existing jest specs to cover sign-out isolation and the
   migration shim. `pnpm --filter @flixy/mobile test`.

Acceptance: sign in as A, swipe, sign out, sign in as B → B sees an empty
watchlist; A's data returns on re-login.

---

## Phase 2 — Finish the stubbed user-facing features

These are the items a user will actually hit. Do them in order of visibility.

1. **Avatar upload (G1)** — for a no-backend app, store the picked image
   locally.
   - Use `expo-image-picker` to pick, `expo-file-system` to copy the file into
     the app's document directory, and persist the local `file://` URI as
     `avatar_url` in `localDb`.
   - Update `uploadAvatar` to return that local URI; render it everywhere the
     profile avatar shows. No network, no Unsplash.
   - Edge cases: permission denied, cancel, oversized image (downscale via
     `expo-image-manipulator`).
2. **Handle availability (G2)** — single-user device: a handle is "taken" only
   if a *different* local profile already uses it. Implement a real local
   uniqueness check against `localDb` profiles instead of `return true`. Keep
   the async signature so a server check can replace it later.
3. **Password flows (G3, G4)** — for local mock auth, make behavior honest:
   - Either (a) store a salted local credential per email so sign-in actually
     validates and reset/update mutate it, **or** (b) clearly present sign-in as
     "device profile" (no password) and remove the password field.
   - Recommended for personal MVP: option (b) — simpler and not misleading.
     Keep email as the profile key. Hide reset-password route from the UI if we
     go password-less (leave the screen for the future server version).
4. **Settings actions audit** — walk every row in `settings*.tsx` (account,
   region, language, notifications, services, genres, privacy, help, terms).
   Confirm each navigates and persists. Wire any dead rows; remove or disable
   any that point nowhere.

Acceptance: profile edit (name, handle, avatar) persists across app restart;
no screen shows a fake/remote placeholder.

---

## Phase 3 — Catalogue hardening (TMDB-only)

Goal: fast, reliable, rate-limit-safe browsing with no persisted movie data.

1. **Move the TMDB key out of source (G5)** — read only from
   `app.config.ts` extra (env-injected); remove the hardcoded fallback literal.
   Add `EXPO_PUBLIC_TMDB_*` to `.env.local` and document in README. Rotate the
   exposed key (human step — add to `docs/HUMAN_BLOCKERS.md`).
2. **Kill the N+1 provider calls (G6)** — use `append_to_response=watch/providers`
   on detail fetches and, for discover lists, defer provider badges:
   - Discover returns titles immediately (popularity + poster).
   - Fetch watch/providers lazily per card as it becomes visible, or only for
     the title-detail screen. This removes ~30 extra calls per deck load.
3. **Caching + throttle** — TMDB free tier is ~50 req/s but bursts hurt. Add:
   - React Query `staleTime` (e.g. 1h for discover, 24h for detail) — partly
     present; verify and standardize.
   - A small in-memory request de-dupe / concurrency limiter in `callTmdb`.
4. **Region/provider correctness** — verify `watch_region` + provider mapping
   match the user's onboarding region (not hardcoded `US`). The swipe event
   currently hardcodes `region: 'US'` (`swipe/hooks.ts:70`) — pull from prefs.
5. **Offline behavior** — when TMDB is unreachable, the fallback catalogue
   already kicks in. Confirm the deck and search show a clear "offline / limited
   results" banner rather than silently degrading.

Acceptance: cold deck loads in < 2s on a normal connection; no rate-limit
errors over a 5-minute swiping session; region from onboarding is respected.

---

## Phase 4 — Deck intelligence, swipe loop, and watchlist polish

1. **Taste-aware deck ordering (G9)** — confirm `features/deck/hooks.ts`. If the
   deck is pure TMDB popularity, add lightweight local personalization:
   - Down-rank genres/services the user repeatedly passes on; boost ones they
     save. Pure client-side, computed from `localDb` swipes. No ML, just a
     weighted sort. This is the core product promise ("swipe-based discovery").
2. **De-dupe seen titles** — never show a title the user already swiped. Filter
   the TMDB result set against `localDb` swipe history.
3. **Deck refill / pagination** — when the deck runs low, fetch the next TMDB
   page with the same filters. Verify this exists; wire if missing.
4. **Undo** — `useUndoSwipe` exists; confirm the deck exposes an undo affordance
   and it restores the card + reverses the watchlist projection.
5. **Watchlist polish** — confirm filters (all/top/watched), mark-watched,
   remove, and priority all reflect instantly (optimistic) and survive restart.
   Confirm titles render from live TMDB by id (`useTitlesByIds`).

Acceptance: swiping feels personalized after ~20 swipes; no repeats; watchlist
mirrors swipe actions and persists.

---

## Phase 5 — Notifications, telemetry, and app chrome

1. **Local notifications (G10)** — verify `lib/notifications.ts` +
   `useNotificationDeepLinks`:
   - Permission request flows from onboarding `notifications.tsx`.
   - At least one real, useful local notification scheduled (e.g. "X titles
     waiting on your watchlist" weekly) since there's no server to push.
   - Deep link from a tapped notification routes correctly.
2. **Telemetry** — `features/telemetry/events.ts` + `lib/analytics.ts`. For a
   personal MVP, ensure analytics is **safe to run with no key** (no crash, no
   PII). PostHog construction must stay gated (already a known rule). Decide:
   keep disabled locally, enable later.
3. **Error surfaces** — confirm a top-level error boundary and that TMDB/storage
   failures show friendly states, not red screens.
4. **App config** — icon, splash, name "Flixy", scheme `flixy`, version. Verify
   `app.config.ts` is launch-ready.

Acceptance: fresh install → onboarding → permission prompt → swipe → background
the app → receive the scheduled notification → tap → lands on watchlist.

---

## Phase 6 — Quarantine dead backend code (G8)

The Supabase client is a disabled mock; the ingestion packages and edge
functions are unused under this MVP target. To stop them confusing future work:

1. Add a top-of-file banner to `lib/supabase.ts` (already says "disabled") and
   reference `DATA_LAYER.md`.
2. Move `packages/catalogue-ingest`, `supabase/functions`, and `supabase/`
   migrations under a documented "dormant / future server" note in the repo
   README — **do not delete** (user rule: edit, don't delete; this is real prior
   work worth keeping for the future DB).
3. Record in `.wolf/cerebrum.md` Decision Log: MVP is local-first, no Supabase,
   TMDB-live-only; server code is parked for the future-DB phase.

Acceptance: a fresh contributor reading the README understands the app is
local-first and where the parked server code lives.

---

## Phase 7 — End-to-end verification on device

1. **Manual E2E pass** (the two personas the e2e/ yaml files describe):
   - **New user**: install → welcome → sign up (or anonymous) → region →
     services → genres → cold-start swipes → notifications → main deck → swipe →
     open a title → save → watchlist → mark watched → edit profile + avatar →
     settings (change language/region) → sign out.
   - **Returning user**: relaunch → lands on deck with prefs intact → watchlist
     intact → personalized ordering.
2. **Maestro flows** — update `e2e/new-user.yaml` and `e2e/returning-user.yaml`
   to match the final routes/testIDs; run them.
3. **Quality gates**: `pnpm --filter @flixy/mobile typecheck`,
   `pnpm --filter @flixy/mobile test`, `biome check`. All green.
4. **Build**: `eas build --profile preview` (Android first — unblocked;
   iOS/Play submission remain human blockers HB-001/002/003).

Acceptance: both persona flows pass on a physical Android device; CI green.

---

## Execution order (dependency-aware)

1. Phase 1 (data layer seam) — everything else writes through it.
2. Phase 2 (stubs) — highest user-visible payoff, low risk.
3. Phase 3 (catalogue hardening) — fixes the most likely real-device failure
   (rate limits / slow deck).
4. Phase 4 (deck intelligence) — the core product differentiator.
5. Phase 5 (notifications/telemetry/chrome).
6. Phase 6 (quarantine) — cleanup, no functional risk.
7. Phase 7 (verify + build).

Phases 2–5 are largely independent and can interleave; 1 must come first, 7 last.

---

## Human blockers (cannot be done by Claude)

- Rotate the TMDB API key currently committed in `lib/tmdb.ts` (G5) and any R2
  keys (existing HB-008).
- EAS/Expo account, Play Console, Apple Developer enrollment (HB-001/002/003) —
  only needed at submission time, not for personal device use.
- Future commercial licensing: send the licensing email for an offer (user's
  note) — track as a new human blocker when ready.

## Definition of Done (MVP)

- App installs and runs with **no backend** and **no committed secrets**.
- Every user action persists locally and survives restart and sign-out/in.
- No stubbed/fake data reaches the UI (avatars, handles, etc.).
- Deck is personalized, de-duped, and refills; catalogue is TMDB-live only.
- One useful local notification works end-to-end.
- typecheck + tests + biome green; both Maestro persona flows pass on device.
- README documents local-first architecture and the parked server code.
