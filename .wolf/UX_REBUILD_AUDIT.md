# Flixy UX Rebuild Audit (Mode C — App-wide)

> Run via `/ux-architect` on 2026-06-20. Senior product-design audit of the
> Settings/Profile surface + broken-feature sweep. Baseline: typecheck PASS,
> 63/63 tests PASS, biome 96 errors.

## Verdict

Settings/Profile is structurally broken, not just visually weak. Two complete,
inconsistent settings implementations exist; one is unreachable. The Profile
tab does double duty as a settings page with hardcoded English, a broken
sign-out, and a data-loss bug. This is a Walter-hierarchy failure: the
Reliable/Usable layers are broken, so no amount of surface polish helps.

## Top 3 risks

1. **Editing your profile name silently wipes your region + language**
   (useUpdateProfile spreads `undefined` into upsertProfile).
2. **The main Settings page is unreachable** — settings.tsx is orphaned; the
   user only sees the Profile tab's inline settings, which has a second,
   divergent design system and a sign-out that leaves a dead page.
3. **Settings/Profile is ~100% hardcoded English** despite 7-language i18n
   support — not production-ready for the configured locales.

## Per-flow defect log (severity 0–4)

### Profile tab (`(tabs)/profile.tsx`)
- S4 · Data loss: sign-out `onSuccess` only logs an event, no redirect → dead
  page (Nielsen #3 user control; Norman feedback). settings.tsx/settings-account
  were fixed in bug-108 but profile.tsx was missed.
- S4 · Misleading stat: "Swipes" = savedCount + seenCount (watchlist items),
  not swipes. A swipe store exists (useSwipeStats) but is unused here
  (Norman signifiers / match real world).
- S3 · Hardcoded English throughout (no `t()`) — banner, stats labels,
  section titles, every row label, On/Off (Nielsen consistency; i18n).
- S3 · Re-implements `ProfileRow` + card/divider styles inline instead of the
  shared `SettingsRow`/`ListRow` (Nielsen consistency & standards).
- S3 · Duplicates the entire Settings IA (region/language/services/genres/
  notifications/account) that also lives in settings.tsx (Hick's Law — two
  paths to every setting; user can't form a mental model).
- S2 · `valueNumberOfLines` passed in row objects but unused by ProfileRow
  (dead prop / misleading).
- S2 · Anonymous banner uses raw Pressables instead of shared `Button`.
- S2 · "signed in" truth differs from settings.tsx (session vs profile).

### Settings hub (`(app)/settings.tsx`) — UNREACHABLE
- S4 · No route pushes to `/(app)/settings`; only `deck → settings-services`
  exists. Entire page is dead code with a divergent design.
- S3 · Mixed hardcoded English + `t()` (subtitle, row labels, subtitles).
- S3 · Uses `SettingsRow` (ListRow) — a third row language vs ProfileRow.

### Edit profile (`(app)/edit-profile.tsx`)
- S4 · Saving name/handle/avatar wipes region+language via useUpdateProfile.
- S3 · No inline validation; `isHandleAvailable` exists but is never called
  → duplicate handles not caught at edit time (Norman constraints; Nielsen #5).
- S3 · No error display — `onError` only logs; user gets no feedback
  (Gulf of Evaluation open).
- S2 · Raw Pressable save instead of shared `Button`; no loading spinner
  (only opacity) (Norman feedback).
- S2 · Save enabled even when fields empty — no constraints.
- S3 · Hardcoded English strings.

### Settings subpages — inconsistent shells
- S3 · settings-services.tsx & settings-genres.tsx use raw `Screen` + Newsreader
  italic 31px header, no back button; settings-account/region/language/privacy/
  help use `SettingsPage` (bodyBold 30px, back button). THREE header treatments
  across one settings surface (Nielsen consistency).
- S3 · services/genres use raw Pressable save + Cancel; not `Button`.
- S3 · All subpages: hardcoded English subtitles/labels.
- S2 · settings-notifications shows disabled "Email"/"Frequency" controls with
  fake values ("Off"/"Weekly") — showing non-functional controls (Nielsen #5).
- S2 · SelectOption shows "Selected" text, not a check icon (weak signifier).

### Shared
- S2 · display.ts fallbacks hardcoded English ("Name not set", "Region not
  set", …) — `t` passed in but only used for genres.
- S1 · Three sign-out surfaces with three labels ("Sign out"/"Log out"/
  t('auth.signOut')) and two behaviors.

### Lint
- S2 · biome: 96 errors (formatting/import drift) — not production-ready.

## Systemic issues

1. No single settings design system: 3 shells, 2 row primitives, raw Pressables
   alongside shared `Button`.
2. Split IA: Profile tab = settings page AND a separate (unreachable) Settings
   page, both linking to the same subpages.
3. i18n discipline missing on the settings/profile surface.
4. Walter hierarchy violated: polishing Surface while Reliable (data loss,
  dead sign-out) is broken.

## Prioritized roadmap (this rebuild)

**Wave 1 — Critical reliability/functional blockers**
- Fix useUpdateProfile partial-patch data loss + regression test.
- Fix profile.tsx sign-out redirect; unify sign-out.
- Fix lint to 0.

**Wave 2 — Unified settings design system + IA**
- Profile tab → identity + real swipe stats + single "Settings" entry; delete
  duplicated inline settings; use shared primitives + i18n.
- settings.tsx → the single reachable settings hub; i18n; Button sign-out.
- Migrate services/genres to SettingsPage shell + Button.
- SelectOption → Check icon.
- edit-profile → validation + handle availability + error display + Button.

**Wave 3 — i18n completeness + consistency**
- Add all settings/profile keys to en.json (fallback covers other locales).
- Wire display.ts through `t()`.
- i18n every settings subpage; fix settings-notifications non-functional rows.

**Wave 4 — Verify e2e**
- typecheck + tests + biome all green; update OpenWolf tracking.

## Assumptions

- Local-first MVP (no Supabase) is the target; mock auth + AsyncStorage persist.
- Missing-locale keys fall back to en (i18next fallbackLng) — acceptable for
  this pass; full translations are a follow-up.
- Profile tab stays the identity/stats surface; Settings page owns preferences
  (iOS/Android convention) — reduces Hick's load.
