# Pionier release checklist

Complete before claiming a production deploy or score ≥ 8 on production readiness.

## Release information (confirmed / prepared)
- **Canonical production URL:** https://ivarkarm-web.github.io/handpan-app/
- **Support contact:** Instagram [@ivar.karm](https://www.instagram.com/ivar.karm/)
- **Optional voluntary tip link:** https://busk.co/84950/tip
- **Release documentation:** [RELEASE-NOTES-1.0.0.md](./RELEASE-NOTES-1.0.0.md) (proposed draft, not a published release), [PRIVACY.md](./PRIVACY.md), [ROLLBACK.md](./ROLLBACK.md) (proposed procedure, not tested)
- **Audio/licensing record:** [AUDIO-LICENSES.md](./AUDIO-LICENSES.md) (includes owner rights declaration; not independent legal verification)

## Scope lock
- [ ] No Learn mode / lessons UI or modules in the active shell
- [ ] No community uploads / User-Created / Cloudflare song worker
- [ ] My Library stores recordings locally and exports WAV backups; no account or upload path
- [ ] README “What it is / is not” matches the live app

## Assets & rights
- [x] No shipped note-sample packs (synthesis-first architecture); no shipped sample inventory to list. See `docs/AUDIO-LICENSES.md` for current architecture/provenance record (do not invent an asset inventory).
- [ ] No uncleared third-party handpan samples in the bundle (verify against any shipped/bundled assets before release; none evidenced by synthesis-first architecture)
- [x] Owner audio-rights declaration recorded in `docs/AUDIO-LICENSES.md` (declaration only; not independent legal verification). Any third-party/external material requires documented permission/attribution before inclusion.

## Service worker / offline
- [ ] `CACHE_VERSION` bumped for this deploy (`handpan-app/APP_VERSION`)
- [ ] `npm run sync:handpan` run; `npm run check:handpan-cache` green
- [ ] Deleted modules are **not** in SHELL
- [ ] Manual offline check: load once online, go offline, reload → instrument shell loads
- [ ] **Unresolved:** manual offline/PWA behavior on real devices still requires verification (not passed by source/CI alone)

## Quality gates (CI) — required
- [ ] `npm run check:app` (cache check + smoke + unit + **performance budgets** + Playwright)
- [ ] phase8 dock/root smoke green
- [ ] phase9 multi-touch stress green on mobile projects
- [ ] No known flaky tests marked as “ignore”
- [ ] **Unresolved:** final CI must be green for the actual release commit before release/tag

## iOS Safari — **hard release gate** (unresolved)
- [ ] Complete `handpan-app/IOS-SAFARI-CHECKLIST.md` on a real device
- [ ] Sign-off table filled (device / iOS / APP_VERSION / tester / date / pass)
- [ ] Failures either fixed or documented as known limits in QUALITY-BASELINE
- **Status:** partial owner-reported evidence exists; full iOS Safari sign-off is **not** complete. Do not mark this gate complete without recorded device evidence.

## Performance budgets (see `docs/PERFORMANCE-BUDGETS.md`)
- [ ] `npm run lighthouse:app` green (file size budgets)
- [ ] First interactive on mid-tier phone acceptable (owner timed)
- [ ] No unbounded audio node growth under multi-touch / 200-strike stress

## Accessibility (unresolved on device)
- [ ] Primary controls have accessible names
- [ ] Keyboard: scale/root/instrument and pad keys work
- [ ] Focus visible on interactive chrome (`focus-visible.css`)
- [ ] High-contrast toggle available; axe color-contrast passes under `.high-contrast`
- [ ] **Unresolved:** real-device assistive technology/screen-reader checks (e.g. VoiceOver) not fully verified

## Device matrix (owner) — Android limitation recorded
- [ ] Fill `docs/DEVICE-CHECKLIST.md` for at least one iOS Safari session with recorded evidence (outstanding)
- **Android physical-device testing:** **not completed**. Owner-accepted **documented launch limitation** (not a pass, not tested). Do not mark Android verified without real-device evidence.

## Library / WAV / persistence (unresolved)
- [ ] My Library save/reload persistence verified on real device(s)
- [ ] WAV export generated and **reopened/played in an external player** on real device(s)
- [ ] Browser storage behavior/eviction understood as best-effort (see [PRIVACY.md](./PRIVACY.md))

## Deploy
- [ ] Push to `main` → GitHub Actions green for the release commit
- [ ] Live URL smoke on canonical production URL: open app, strike pads, change scale/root, record and save a loop, reload and export its WAV
- [ ] Verify deployed live `APP_VERSION` and service-worker cache version/state (no stale cache) after deploy
- [ ] Scorecard updated only with **linked evidence**
