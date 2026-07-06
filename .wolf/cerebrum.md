# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-26

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->
- [2026-05-01] User wants rebuild planning and tracking artifacts saved under `.wolf` for easy tracking.
- [2026-05-02] User wants every created Supabase migration pushed/applied to the DB as part of the task, not only written.
- [2026-05-02] User expects feature flags to be read through the real API/PostHog path, not approximated with local hardcoded switches.
- [2026-06-20] User wants the running Android emulator used for mobile UI/testing whenever available, including future sessions.

## Key Learnings

- **Project:** flixy
- **Description:** Flixy — swipe-based movie & TV discovery app
- **Current MVP state:** The mobile app has Expo/Supabase core screens and schema scaffolded; remaining MVP work is mainly wiring/polish, real title/trailer/availability data, profile/settings editability, and watchlist actions.
- Catalogue/deck resilience now depends on `apps/mobile/src/lib/fallbackCatalogue.ts`: Supabase remains primary, but local schema-validated titles/services/genres keep dev, export, and e2e flows usable when the remote catalogue is empty or env vars are absent.
- Onboarding preferences must store lowercase snake_case service and genre IDs, never display labels; deck queries normalize legacy labels before filtering.
- Mobile OAuth callbacks are centralized in `apps/mobile/src/features/auth/oauthCallback.ts`; keep both PKCE `?code=` exchange and fragment-token handling wired through this helper.
- Mobile Google OAuth hardening depends on classifying `WebBrowser.openAuthSessionAsync` results before mutating session state, then accepting Android dismiss/cancel only if a fresh session arrives via deep link shortly after.
- Persisted catalogue query cache can survive data-shape changes; version query keys/persister keys when `useTitlesQuery` return shapes change.
- [2026-05-01] Brand source of truth is `docs\ui-images`: visible app name is Flixy only, with orange-red italic serif wordmark, near-black cinematic UI, and concise reference copy.
- [2026-05-01] Deck/catalogue cache hardening uses `TITLE_QUERY_RESULT_SHAPE_VERSION`, `flixy.query-cache.v2`, and `normalizeTitleQueryData` to absorb legacy persisted `Title[]` results.
- [2026-05-01] Auth routes should use shared `AuthSheet` primitives (`AuthHeader`, `AuthDivider`, `AuthMessage`, `AuthFooterLink`) plus shared `Input`/`SocialButton`, not local form-card/divider clones.

- [2026-05-01] Core mobile brand surfaces are aligned through existing primitives: `ListRow` and `Chip` should stay compact, dark, warm-bordered, and tactile rather than generic large pills/cards.
- [2026-05-01] Catalogue cache versioning should cover detail/title-id query keys as well as `useTitlesQuery`; stale persisted title rows can otherwise bypass shape fixes.
- [2026-05-01] Watchlist empty states should use localized, filter-aware copy; avoid generic “Nothing here yet” even when the CTA points back to Discover.

- [2026-05-01] Mobile already depends on lucide-react-native; UI icon cleanup should replace literal emoji/glyph text with Lucide components rather than adding a new icon library.

- [2026-05-01] Auth UI footer actions should be real background buttons via shared `AuthFooterLink`; keep auth control typography in Space Grotesk and provider marks as icons, not text glyphs.
- [2026-05-02] Auth welcome should use shared `Button` for the primary create-account CTA, `SocialButton` for Google only, and shared `AuthTertiaryAction` for browse/back/forgot text actions.

- [2026-05-01] Core app product UI should use Space Grotesk for dense labels, rows, buttons, tab text, and settings/profile titles; keep Newsreader for brand/emotional/movie-title moments.

- [2026-05-02] Deck and title-detail swipe actions should use the shared `ActionButton` primitive with Lucide icons, semantic tones, visible labels, and dark foreground on orange save actions; avoid local Pressable clones for these controls.

- [2026-05-02] Server-side catalogue ingestion lives in `packages/catalogue-ingest`; it owns TMDB calls, Supabase service-role writes, dry-run mode, DB-backed TMDB cache, and UUID-preserving `(tmdb_id, content_type)` title upserts.
- [2026-05-02] Main tab headers should use `AppHeader` so the italic Flixy wordmark gets safe-area padding and glyph-overhang width consistently across deck, watchlist, search, and profile.
- [2026-05-03] Repo-level Copilot guidance lives in `.github\copilot-instructions.md`; update it when build/test commands, architecture, or repo-specific conventions change.
- [2026-05-03] Global TMDB backfill uses `catalogue_backfill_jobs`, `catalogue_backfill_cursors`, `catalogue_backfill_batches`, and `catalogue_backfill_candidates`; candidates are persisted once from TMDB daily exports and scheduled steps advance by cursor.
- [2026-05-07] Supabase catalogue cron requires Vault secrets `catalogue_ingest_function_url` and `catalogue_ingest_cron_secret`; if absent, `catalogue_ingest_invoke` returns null and pg_cron silently skips ingestion.
- [2026-05-07] Node catalogue export startup should use `node:zlib` for TMDb `.json.gz` exports; Web `DecompressionStream` can stall on the large movie export while TV-sized exports may appear fine.
- [2026-05-07] Auth screens must use the same shell as onboarding: `Screen` chrome, dark canvas, accent CTA, Newsreader hero, Space Grotesk body. Do not introduce a separate AuthSheet shell — every (auth) screen should mount `useAuthRedirect` so a session lands them at root regardless of OAuth quirks.
- [2026-05-09] Supabase Auth error `error finding refresh token for update: cannot execute SELECT FOR UPDATE in a read-only transaction (SQLSTATE 25006)` comes from refresh-token rotation on the Auth service/DB side. Client code should classify it as a refresh/session failure, return a null session instead of crashing auth screens, and let a fresh login create a new session.
- [2026-05-09] Expo filesystem deprecation warnings can fire before `app/_layout.tsx`; warning suppression must be installed from a custom app entrypoint before importing `expo-router/entry`.
- [2026-05-09] In React Native, `signInWithOAuth` does not browser-redirect automatically, so passing `skipBrowserRedirect: true` is unnecessary for WebBrowser flows and can expose Supabase's raw `skip_http_redirect` JSON behavior. Open the returned normal authorize URL with `WebBrowser.openAuthSessionAsync` instead.
- [2026-05-09] Supabase hosted project `mgnbvhnhjresbnblytuk` returns `500 unexpected_failure: Error creating flow state` directly from `/auth/v1/authorize?provider=google`, independent of the mobile app. Invalid PKCE params return 400, so this is an Auth DB/internal `flow_state` persistence problem to diagnose in Supabase Auth logs with `error_id`.
- [2026-05-09] Catalogue offload target is Cloudflare R2. Use `pnpm --filter @flixy/catalogue-ingest ingest -- r2-export` with env-only R2 credentials to export `titles` plus embedded `title_availability`/`title_videos` as gzipped JSON objects and a slim index; keep Supabase for auth/user data.

- [2026-06-20] Settings IA is now: Profile tab = identity + stats + single "Settings" row; settings.tsx = the one reachable preferences hub (linked from Profile). Sign-out exists ONLY on Profile + settings-account — one label `t('auth.signOut')`, one redirect-to-`/(auth)/welcome` behavior. Do not add a third sign-out surface (was the antipattern: Profile/Settings/settings-account each had divergent sign-outs).
- [2026-06-20] `useUpdateProfile` must only pass present keys to `localDb.upsertProfile`. upsertProfile merges with `{...existing, ...updates}`, so passing `region: undefined` / `language: undefined` (as a `.partial()` schema yields on a name-only edit) OVERWRITES and wipes the user's region + language. Build the upsert object from defined keys only.
- [2026-06-20] Shared settings design system: `SettingsPage` shell (back + title + subtitle + scroll) + `SettingsGroup` (overline title + grouped card) + `SettingsRow` (ListRow) + `Button` for CTAs + `SelectOption` (Check icon when selected). Every settings subpage — including settings-services and settings-genres — uses SettingsPage, never a raw `Screen` + Newsreader header.
- [2026-06-20] Profile "Swipes" stat uses `useSwipeCount` (`localDb.getSwipes`, excludes `is_undone`), NOT the watchlist count. Saved/Seen come from the watchlist; Swipes comes from the swipe store.
- [2026-06-20] edit-profile uses inline `HandleSchema.safeParse` validation + `isHandleAvailable(handle, userId)` availability check (debounced via useEffect on the trimmed handle) + `Input.error` for surfacing errors + shared `Button` (disabled when invalid/unchanged/saving). Maestro e2e testIDs `settings-service-<id>`, `settings-services-save`, `settings-genre-<id>`, `settings-genres-save` are preserved on the shared Button/chips.
- [2026-06-20] i18n: all settings/profile strings are keyed under `profile.*`, `settings.*`, `settingsPages.*`, `display.*` in en.json. Missing keys fall back to en (i18next fallbackLng) — other locales still need translations for the new keys; screens also pass inline defaults to `t()` so a missing key never shows a raw key string.
- [2026-06-20] Local-first user IDs are NOT UUIDs: anonymous is `anon`, credential users are `user-${email}`. Runtime schemas that validate user IDs must use `UserIdSchema` / `z.string().min(1)`, not `z.string().uuid()`. Keep title/event/session IDs UUID-shaped where they still are UUIDs.
- [2026-06-20] Current mobile data target is Supabase Auth + Supabase `watchlist_items` only. Movie/TV catalogue metadata stays API-backed through `apps/mobile/src/lib/tmdb.ts`; mobile watchlist rows store deterministic TMDB UUIDs and must not require matching `titles` rows.
- [2026-06-20] `apps/mobile/src/features/watchlist/store.ts` is the watchlist persistence seam: use it from hooks/deck/swipe paths so Supabase and local test fallback stay consistent.
- [2026-06-20] Remote Supabase migration apply is blocked in this workspace until `SUPABASE_DB_PASSWORD` or linked project credentials are provided; Supabase CLI returns 401 without it.
- [2026-06-20] Mobile runtime config flows: `app.config.ts` reads `process.env.*` at BUILD time and bakes TMDB (`tmdbApiKey`/`tmdbReadAccessToken`) + Supabase (`supabaseUrl`/`supabaseAnonKey`) into `expoConfig.extra`; `tmdb.ts` and `supabase.ts` read from `Constants.expoConfig.extra`, never `process.env` directly. So any var the release build needs must exist at EAS build time. `.env.local` is gitignored (`.env.*`) and is NOT uploaded to EAS cloud builds — declare vars per-environment via `eas env:create --environment <env>` and map build profiles with the `environment` field in eas.json.

- [2026-07-06] Startup screen-flash invariant: the session query must stay `pending` until storage hydration resolves. `subscribeToSession` is hydration-gated (module flag `isSessionHydrated`) so the placeholder EMPTY_SESSION is never written into the query cache — index.tsx + SplashGate rely on `isLoading` as the "checking" auth state.
- [2026-07-06] Deck stability invariant: `deck.cards` recomposes whenever taste/exclusions/recommendations/pages land, so deck.tsx keeps an append-only display queue per `filterKey` (exposed by `useDeck`) with an accumulated `byId` map — queued cards must never be dropped/re-ordered by a recomposition, only by a filter change.
- [2026-07-06] Query persistence blocklist lives in app/_layout.tsx (`NEVER_PERSIST_QUERY_ROOTS`): auth, deck_exclusions, taste_signal, swipes. Any query whose data holds `Set`s (JSON-serializes to `{}`) or is derived from fast local reads must be added there, not persisted.

- [2026-07-06] For You algorithm architecture: taste semantics live in `packages/shared/src/taste.ts` (SWIPE_TASTE_WEIGHTS up+4/right+3/down+0.5/left-1, 30-day exp decay, COLD_START_GENRE_PRIOR from onboarding genres) and feed composition in `composer.ts` (deterministic 60/20/10/10 personalized/trending/fresh/exploration mix via MIX_SLOT_PATTERN, trace.source + diagnostics.sources for explainability). Change weights/quotas there, never inline in hooks. 'down' (Seen) is a WEAK POSITIVE, not a dislike.

- [2026-07-06] Local taste events are the recommendation-relevant behavior store (PostHog is analytics-only): `schemas/tasteEvent.ts` enum (open_details +1, watch_trailer +2, share +2.5, search_match_open +1.5), persisted via `localDb.recordTasteEvent` (15-min dedup per title+type, 400-event/user cap), consumed by `buildTasteSignal({tasteEvents})` with the same 30-day decay. Pass-override rule: only open_details can never reverse a pass; later trailer/share/search opens do. Record new engagement signals through `useRecordTasteEvent`, never PostHog alone.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-07-06] Do not `qc.setQueryData` from a subscription's synchronous initial replay while the query's first fetch is still in flight — it flips `isLoading` to false with placeholder data and the root gate routes to the wrong screen (login flash). Gate replays on hydration.
- [2026-07-06] Do not persist TanStack Query entries whose data contains `Set`/`Map` (deck_exclusions) — JSON round-trip silently empties them and the restored entry also skips the loading gate. Blocklist them in shouldDehydrateQuery.
- [2026-07-06] Do not use blanket `placeholderData: keepPreviousData` on a query keyed by an entity id (useTitle): in TanStack v5 placeholder data reports `success`, so a screen renders the PREVIOUS entity (wrong movie) instead of its loading state. Guard the placeholder on the id part of the previous queryKey.
- [2026-06-20] Do not assume a working dev app means the release APK works. If a release/preview build shows "couldn't connect to the server" / no data, the first suspect is missing build-time env vars: `app.config.ts` bakes TMDB/Supabase creds into `extra` from `process.env`, and EAS cloud builds never see gitignored `.env.local`. Fix = `environment` mapping in eas.json + `eas env:create` per environment, not app code.
- [2026-06-20] Do not pass `undefined` for omitted fields into `localDb.upsertProfile` / `upsertPreferences` — the `{...existing, ...updates}` merge OVERWRITES existing values with undefined. Build the patch object from present keys only (see useUpdateProfile). Regression tests in localDb.test.ts guard this.
- [2026-06-20] Do not build a settings subpage with a raw `Screen` + Newsreader italic header and raw `Pressable` save buttons. Use the shared `SettingsPage` shell + `Button` so every settings surface has the same back button, typography, and CTA. (settings-services and settings-genres were the offenders; now migrated.)
- [2026-06-20] Do not add a sign-out surface that lacks `router.replace('/(auth)/welcome')` — it leaves the user on a dead page. Profile tab sign-out had this bug while settings.tsx/settings-account were already fixed.
- [2026-06-20] Do not show disabled controls with fake values (e.g. notifications "Email: Off" / "Frequency: Weekly"). Either omit them or mark them clearly "coming soon" with no value (Nielsen #5).
- [2026-06-20] Do not use UUID validation for local-first `user_id`/`userId` in onboarding, profile, watchlist, or shared swipe/session schemas. It blocks anonymous emulator flows (`anon`) and can surface as Services Continue no-op or Watchlist load failure after saving.
- [2026-05-01] Do not instantiate PostHog during Expo static export/server rendering; gate analytics construction behind a browser/runtime check.
- [2026-05-01] Quote Expo Router paths containing route groups such as `app\(app)` in PowerShell commands; unquoted parentheses are parsed as expressions/commands.
- [2026-05-02] OpenWolf designqc auto-start expects a web server on port 3000; Expo web auth captures need an already responsive explicit `--url` or capture fails.
- [2026-05-02] On Android, RN `Pressable` with `accessibilityRole="button"` renders as a native `android.widget.Button` — flex layout props applied directly to the Pressable (e.g. `flexDirection: 'row'`) are NOT honored on its child arrangement (children stack vertically). Always put row flex on an inner `<View>` and keep the Pressable as a transparent touch shell. This is also why `ListRow.tsx` rendered only the value TextView — its row styles were on the Pressable. Verified via `uiautomator dump`: the row Button bounded the children but laid them out as column.
- [2026-05-07] Android Custom Tabs deep-link delivery for OAuth can outlast `WebBrowser.openAuthSessionAsync`'s grace period — the browser resolves with `dismiss` before the `flixy://` callback arrives. Auth screens MUST subscribe to `useSession` (via `useAuthRedirect`) and redirect on session presence; do not rely on the OAuth mutation result alone. The grace window for `waitForOAuthSession` should be ≥4s.

- [2026-05-01] rg tool uses default Rust regex without look-around; split searches or use supported patterns instead of `(?!...)` lookahead.

- [2026-05-02] Biome forbids `console` even in Node CLIs; use `process.stdout.write`/`process.stderr.write` for committed command output.
- [2026-05-07] Keep pg_net `timeout_milliseconds` longer than catalogue Edge backfill `maxSeconds`; otherwise titles can upsert but batch/cursor checkpoints may never persist.
- [2026-05-09] Do not echo or commit Cloudflare R2 credentials; the user pasted live keys in chat and they should be rotated, then stored only in `.env.local`/CI secrets/password manager.
- [2026-06-20] Do not keep a foreign key from `watchlist_items.title_id` to `titles.id` while the mobile app uses API-backed TMDB catalogue data. Positive swipes/search-detail saves will fail because no title row exists for the deterministic TMDB UUID.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
- [2026-04-27] MVP plan prioritizes making the existing Expo/Supabase implementation work end-to-end over a UI framework rewrite or mobile-direct TMDB integration.
- [2026-05-01] Added an app-local fallback catalogue instead of mobile-direct TMDB fetching so the client stays aligned with the Supabase ingestion architecture while remaining usable in local/e2e environments.

- [2026-05-01] Mobile OAuth redirects are canonicalized to `flixy:///`; Supabase should allow `flixy:///` and `https://flixy.app`, while Google Cloud should authorize the Supabase `/auth/v1/callback` endpoint.
- [2026-05-01] OAuth callback parsing is restricted to Flixy callback origins/paths and duplicate callback dedupe uses hashed code/token keys so raw OAuth credentials are not logged.
- [2026-05-02] Chose a server-side workspace package for TMDB ingestion rather than a Supabase Edge Function because no existing Edge Function conventions existed and the FSD already allowed Trigger.dev/job-runner ingestion.
- [2026-05-02] `flixy_catalogue_v2` is read via `isFeatureEnabled(featureFlags.catalogueV2)` from PostHog; local Supabase search remains the fallback path when the flag is off.
- [2026-05-03] TMDB global ingestion is implemented as both a Node CLI backfill subcommand and a scheduled Supabase Edge `backfill_step`; migrations 0013 and 0014 are applied remotely and `catalogue-ingest` is deployed with `--no-verify-jwt`.
- [2026-06-12] MVP target CHANGED to local-first: **no Supabase**. `lib/supabase.ts` is a disabled mock; auth (`features/auth/hooks.ts`) is mock-session-only; all user data persists to `lib/localDb.ts` (AsyncStorage). Catalogue is **TMDB-live only** (`lib/tmdb.ts`), movies are not persisted. The Supabase ingestion packages + edge functions are parked for a future DB phase, not deleted. Full plan: `.wolf/MVP_E2E_PLAN.md`. User will introduce a real DB later and email for commercial licensing.
- [2026-06-20] MVP target changed again: use Supabase for Auth and watchlist persistence, keep movie/TV metadata out of Supabase and fetched from TMDB APIs at runtime. `lib/supabase.ts` is live when env vars are present and falls back locally only for unconfigured tests/dev.
- [2026-06-12] Local auth keeps salted-credential password flow (option A) so sign-in actually validates against a local store; `useResetPassword` mutates the same store. Password reset screen is honest about being on-device (no fake "check your email" copy).
- [2026-06-12] Deck auto-refills the next TMDB page when remaining cards drop below 5 (bounded to 5 pages per session) — preserves "swipe-based discovery" without exposing the user to repeated exhaustion.
- [2026-06-12] Root `ErrorBoundary` lives at `app/_layout.tsx` so any uncaught render error shows a friendly retry screen instead of a red dev overlay.
- [2026-06-12] `LocalProfile` carries a separate `handle` field; `isHandleTaken` checks the handle first and falls back to `name` for legacy data. `useProfile`/`useUpdateProfile` read and write both fields, so edit-profile's distinct handle input no longer gets silently dropped.
- [2026-06-12] `useI18nLanguage` hook in the root layout keeps i18next aligned with `profile.language`; settings-language.tsx and onboarding/region.tsx also call `i18n.changeLanguage` directly on success so the UI re-renders in the new language without restart.
- [2026-06-12] `(app)/_layout.tsx` is a Stack wrapping `(app)/(tabs)/_layout.tsx` (a Tabs group). Modal screens (settings-*, edit-profile, privacy, terms, title/[id], change-password) live as siblings of `(tabs)/` so router.push from a tab pushes onto the (app) Stack; system back returns to the originating tab instead of falling through to `/(app)/deck`.
- [2026-06-12] `user_id` is stable per credential: `user-${email}` for real accounts, fixed `anon` for anonymous sessions. `useSignOut` no longer wipes user data, so re-sign-in restores prefs/watchlist/profile. Add `useDeleteLocalAccount` for an explicit "Delete account" path.
- [2026-06-12] Real Google OAuth uses `WebBrowser.openAuthSessionAsync` with `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` + `flixy://oauth/google` redirect. Falls back to a device mock when no client_id is configured so the button stays tappable in dev.
- [2026-06-12] i18n resource registry now ships de, es, fr, pt-BR with translated common strings; missing keys fall back to en. `Localization.getLocales()` languageTag detection picks the right initial language.
- [2026-06-12] Anonymous sign-in always goes through the root gate (`router.replace('/')`) so anon users land in onboarding, not the raw app shell.
- [2026-06-12] Project is on Expo SDK 54.0.35; expo-file-system must be ~19.0.23 and expo-image-manipulator must be ~14.0.8 (the 56.x versions are for SDK 56). The `expo-file-system/legacy` subpath import is the safe adapter that works in either SDK and is what profile/hooks.ts uses.
- [2026-07-06] Subscription access is entitlement-driven, never plan-name-driven. Supabase migration 0024 owns plan data, effective subscription resolution, and atomic daily `start_discovery_session` enforcement. The deck requests quota once per filter/session context and passes the returned discovery session UUID into existing swipe events; individual swipe gestures are never quota-checked.
- [2026-07-06] Promo code system (migration 0025): `promo_codes` + `redeemed_promo_codes` tables are server-controlled — clients have NO direct table access (all CRUD revoked, RLS enabled with zero policies = deny-all). Redemption flows only through `redeem_promo_code(input_code)` SECURITY DEFINER RPC, which atomically validates (active, not expired, not sold out, not already redeemed by caller), creates a `user_subscriptions` row with `provider='promo'`, and logs the redemption. MZHUNLIMITED = perpetual Gold (duration_days null), MZH1 = 30-day Gold bonus. Anonymous users are rejected at the RPC level. Mobile `parseRedemptionResult` lives in a pure `promoCodes.ts` file (no native imports) so it is Jest-testable without ESM transform issues.
