# Google OAuth Verification Checklist

When the Android Google sign-in flow loops on the account picker or returns to
the app without a session, walk this list before changing code.

## App side (already in repo)
- [ ] `apps/mobile/app.config.ts` declares `scheme: "flixy"`.
- [ ] iOS `CFBundleURLSchemes` includes `flixy`.
- [ ] Android `intentFilters` registers `flixy` scheme + `flixy.app` host.
- [ ] `apps/mobile/src/features/auth/oauthCallback.ts` is the only entry point
  for parsing/completing callbacks (centralized — see cerebrum 2026-05-01).
- [ ] Dev-only structured logs (`auth.oauth_callback start` / `completed` /
  `failed`) appear in Metro logs with `redirectHost`, `callbackType`, and
  `durationMs`. They never log `code`, `access_token`, or email.

## Supabase Dashboard → Authentication → Providers → Google
- [ ] Provider **enabled**.
- [ ] **Client ID (web)** and **Client Secret** match the Google Cloud OAuth
  client used for Supabase.
- [ ] **Authorized redirect URLs** allow-list contains:
  - `flixy:///` (mobile deep link, three slashes — empty host)
  - `https://flixy.app` (universal link)
  - `https://flixy.app/auth/callback`
  - Local Expo dev URL pattern (when developing): `exp://<lan-ip>:8081/--/`
- [ ] Skip nonce check is **off** unless explicitly required.

## Google Cloud Console → APIs & Services → Credentials
- [ ] OAuth client of type **Web application** has Supabase callback in
  *Authorized redirect URIs*: `https://<project-ref>.supabase.co/auth/v1/callback`
- [ ] Separate OAuth client of type **Android** is configured with the app's
  package name and SHA-1 fingerprint (release + dev keystores both).
- [ ] Separate OAuth client of type **iOS** is configured with the app bundle id.
- [ ] OAuth consent screen is published or test-user list includes the dev
  account being used to sign in.

## Mobile-only sanity checks
- [ ] Android device clock is correct (Google rejects tokens with > 5 min skew).
- [ ] No outstanding "Trust device" prompt is buried under the picker (MIUI quirk).
- [ ] `WebBrowser.openAuthSessionAsync` returns `success` with a valid `url`,
  not `dismiss` followed by a deep link race. The classifier in
  `oauthCallback.ts` handles both, but the dev log will tell you which path fired.

## When the loop happens anyway
1. Capture the dev-only `auth.oauth_callback start` log line.
2. Confirm `redirectHost` is `flixy:` or `flixy.app` — anything else means the
   redirect URL list above is wrong.
3. Confirm `callbackType` is `code` (PKCE) or `tokens` (fragment). If the URL
   parsed but neither field was set, the redirect was probably tampered or the
   session expired in transit — re-issue.
4. If `durationMs` > 30000, the user closed the picker; surface the explicit
   "Sign-in did not complete — try again" UI rather than spinning silently.
