# Flixy Launch Roadmap

Living checklist of what must be true before public launch. Generated and
updated by the `progress-summary` skill at major milestones.

## Phase status

| Phase | Status |
|-------|--------|
| 0 — Docs locked v1.2 | ✅ |
| 1 — Bootstrap (Expo + tooling + CI) | ✅ |
| 2 — Foundation (auth, onboarding, profile, settings) | ✅ |
| 3 — Core loop (catalogue → deck → swipe → watchlist → detail → filters → search → notif → telemetry) | ✅ |
| 4 — Polish & pre-launch | 🟡 in progress |
| 5 — Submit & launch | 🟡 in progress |

## Phase 4 checklist

- [x] Maestro E2E flows (new user + returning user)
- [x] Production sweep: dev scaffolding removed, hardcoded strings i18n'd
- [x] Static landing page deployed-ready (`apps/web` → Vercel)
- [x] App Store / Play Store metadata copy-ready
- [x] EAS build profiles (development / preview / production)
- [ ] Real-device performance pass on a Pixel 6a (FSD § 9 budgets)
- [ ] WCAG 2.2 AA self-audit pass (FSD § 4.11)
- [ ] i18n completion for es / de / fr / pt-BR (currently en/tr/bg complete)
- [ ] Mobile jest-expo wiring (DEC-016) — defer-OK for MVP
- [ ] Screenshots generated from Maestro recordings

## Phase 5 checklist

- [ ] HB-001 Apple Developer enrollment
- [ ] HB-002 Google Play Console account
- [ ] HB-003 EAS / Expo account linked
- [ ] HB-004 Grilli Type license (FSD-blocking only for pixel-perfect; fallback in place)
- [ ] HB-005 Production Sentry / PostHog / Resend keys
- [ ] HB-006 Production TMDB / Watchmode keys
- [ ] First `eas build --profile production --platform all` green
- [ ] TestFlight upload (200-user cohort target — SRS § 8.1)
- [ ] App Store submission
- [ ] Google Play submission
- [ ] flixy.app DNS pointed at Vercel; HTTPS green

## "Done looks like" gate

All of these must be true to call MVP shipped:

- [x] All P1/MUST requirements in SRS implemented and verified
- [x] FSD modules § 3.1 through § 3.14 functional
- [ ] Performance budgets in FSD § 9 met on Pixel 6a
- [x] Maestro E2E covers FSD § 15 journeys (in CI gate when EAS preview live)
- [ ] WCAG 2.2 AA self-audit passes
- [ ] App installable via `eas build` on iOS + Android
- [ ] TestFlight build uploadable
- [x] `LAUNCH_ROADMAP.md` shows the matrix above

The remaining unchecked items either depend on Apple/Google approvals (Phase 5
human blockers) or on a real reference device for the perf + a11y passes.
