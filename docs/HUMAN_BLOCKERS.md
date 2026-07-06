# Human Blockers

Action items that require Melih (the human) — Claude Code cannot complete these.

## ACTIVE

### HB-001 — Apple Developer Program enrollment
**Status:** Pending
**Blocks:** `eas build --platform ios --profile production`, TestFlight, App Store submission
**Required for:** Phase 5 iOS submission
**Action:**
1. Enroll at https://developer.apple.com/programs/
2. Create App ID for `app.flixy.mobile` with associated domain `applinks:flixy.app`
3. Create App Store Connect app record using metadata in `apps/mobile/store/app-store/`
4. Provide `APPLE_ID`, `APPLE_TEAM_ID`, `ASC_APP_ID` as EAS secrets:
   ```
   eas secret:create --scope project --name APPLE_ID --value <email>
   eas secret:create --scope project --name APPLE_TEAM_ID --value <team-id>
   eas secret:create --scope project --name ASC_APP_ID --value <numeric-id>
   ```

**Parallel work unblocked:** Android build + Play Store submission, EAS preview builds.

### HB-002 — Google Play Console developer account
**Status:** Pending
**Blocks:** `eas submit --platform android`
**Required for:** Phase 5 Android submission
**Action:**
1. Register at https://play.google.com/console (one-time $25 fee)
2. Create app listing using metadata in `apps/mobile/store/play-store/`
3. Generate a service account JSON key with Play Developer API access
4. Place at `secrets/play-service-account.json` (gitignored) — referenced from `eas.json`

### HB-003 — EAS / Expo account
**Status:** Pending
**Blocks:** Any `eas build` or `eas update`
**Required for:** Phase 1 ongoing, Phase 5 critical
**Action:**
1. Sign up at https://expo.dev
2. Run `pnpm dlx eas-cli login` and link the project
3. Confirm `extra.eas.projectId` in `app.config.ts` matches the EAS project

### HB-004 — Grilli Type license (GT Sectra + GT America)
**Status:** Pending
**Blocks:** Pixel-perfect typography per FSD § 4.0.2
**Workaround in place:** Fraunces + Inter from Google Fonts as fallback (NFR-BRAND-004 permits this)
**Action:** Procure a multi-platform license at https://grillitype.com when ready;
drop TTF files into `apps/mobile/assets/fonts/` and update `expo-font` loader.

### HB-005 — Sentry DSN, PostHog API key, Resend API key
**Status:** Stubs in `.env.local` are present; production keys must replace them before launch
**Blocks:** Production telemetry + transactional email
**Action:** Provision production projects, paste keys into the EAS production env profile:
```
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>
eas secret:create --scope project --name EXPO_PUBLIC_POSTHOG_KEY --value <key>
eas secret:create --scope project --name RESEND_API_KEY --value <key>
```

### HB-006 — TMDB + Watchmode production API keys
**Status:** Dev keys in `.env.local`
**Blocks:** Catalogue ingestion at scale
**Action:** Apply for higher-tier TMDB key + Watchmode plan; rotate via EAS secrets.

### HB-007 — Google OAuth / Supabase Auth dashboard verification
**Status:** Pending verification
**Blocks:** Reliable Google sign-up/sign-in in preview and production builds
**Action:**
1. In Google Cloud, keep the OAuth client authorized redirect URI set to the Supabase callback endpoint: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In Supabase Auth → Providers → Google, enable Google and configure the Google OAuth client credentials from the dashboard only; do not commit the values.
3. In Supabase Auth → URL Configuration, allow the native app redirect URI `flixy:///` and the production app link `https://flixy.app`.
4. Confirm the Expo native identifiers still match `app.config.ts`: iOS bundle ID `app.flixy.mobile`, Android package `app.flixy.mobile`, scheme `flixy`.
5. Verify on a preview build that Google returns to Flixy once. If the account picker reappears repeatedly, check exact redirect URI spelling in Google Cloud and Supabase before retrying.

### HB-009 — Mobile runtime env vars missing from release/preview builds
**Status:** Pending — this is why an installed APK shows "couldn't connect to the server" with no data
**Blocks:** Any catalogue data (TMDB) and auth/watchlist (Supabase) in a preview or production build
**Root cause:** `app.config.ts` bakes these values into `expoConfig.extra` at build time by
reading `process.env`. EAS cloud builds never see the gitignored `.env.local`, and the build
profiles did not declare these variables — so the APK shipped with empty credentials. `tmdb.ts`
then throws `TMDB_API_KEY is not configured` and `supabase.ts` falls back to `disabledClient()`.
**Fix applied in repo:** `eas.json` now maps each build profile to an EAS `environment`
(`development`/`preview`/`production`), so EAS auto-injects environment-scoped variables at build
time. A build-time guard in `app.config.ts` refuses preview/production builds when these are missing,
preventing an install that silently falls back to development-only local auth.
**Action (required before the next build):** create the variables in EAS for each environment you
build. These are safe to mark `sensitive`; the Supabase URL/anon key are client-public by design,
the TMDB token should be kept out of the repo. Run for `preview` and `production`:
```
eas env:create --environment preview --name TMDB_API_KEY --value <tmdb-v3-key> --visibility sensitive
eas env:create --environment preview --name TMDB_READ_ACCESS_TOKEN --value <tmdb-v4-token> --visibility sensitive
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_OAUTH_REDIRECT_URI --value flixy:///auth/callback
```
Repeat with `--environment production`. Then rebuild: `eas build --profile preview --platform android`.
Verify with `eas env:list --environment preview`; the build cannot proceed while required values are
missing.

### HB-008 — Rotate Cloudflare R2 credentials shared in chat
**Status:** Pending
**Blocks:** Safe production R2 export automation
**Action:** Rotate the R2 access key and Cloudflare API token that were pasted into chat/session logs. Store the new values only in `.env.local`, CI secrets, or a password manager; never commit them.

## HB-010 — Subscription billing and entitlement deployment
**Status:** Pending
**Blocks:** Paid Bronze/Gold purchases and remote quota enforcement
**Action:**
1. Migration `0024_subscription_entitlements.sql` was applied on 2026-07-06. Keep linked Supabase credentials available for future entitlement migrations.
2. Configure Apple products `flixy_bronze_monthly`, `flixy_bronze_yearly`, `flixy_gold_monthly`, and `flixy_gold_yearly`.
3. Configure matching Google Play subscriptions.
4. Create the RevenueCat project (or approved native billing service), map products to `bronze` and `gold`, and configure webhook-driven `user_subscriptions` updates.
5. Store provider keys and webhook secrets in EAS/Supabase secrets. Do not add them to `.env` files or source control.
6. Keep Platinum unavailable for purchase until shared discovery ships.

## RESOLVED

_(none yet)_
