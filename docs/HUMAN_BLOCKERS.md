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

## RESOLVED

_(none yet)_
