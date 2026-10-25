# Pionier release checklist

Complete before claiming a production deploy or score ≥ 8 on production readiness.

## Scope lock
- [ ] No Learn mode / lessons UI or modules in the active shell
- [ ] No community uploads / User-Created / Cloudflare song worker
- [ ] Soundscapes = owner Bedroom Sessions only
- [ ] README “What it is / is not” matches the live app

## Assets & rights
- [ ] Every shipped sample listed in `docs/AUDIO-LICENSES.md` with provenance
- [ ] No uncleared third-party handpan samples in the bundle
- [ ] Owner-recorded multi-velocity samples preferred for Handpan (or documented procedural fallback)

## Service worker / offline
- [ ] `CACHE_VERSION` bumped for this deploy (`handpan-app/APP_VERSION`)
- [ ] `npm run sync:handpan` run; `npm run check:handpan-cache` green
- [ ] Deleted modules are **not** in SHELL
- [ ] Manual offline check: load once online, go offline, reload → instrument shell loads

## Quality gates (CI) — required
- [ ] `npm run check:app` (cache check + smoke + unit + **performance budgets** + Playwright)
- [ ] phase8 dock/root smoke green
- [ ] phase9 multi-touch stress green on mobile projects
- [ ] No known flaky tests marked as “ignore”

## iOS Safari — **hard release gate**
- [ ] Complete `handpan-app/IOS-SAFARI-CHECKLIST.md` on a real device
- [ ] Sign-off table filled (device / iOS / APP_VERSION / tester / date / pass)
- [ ] Failures either fixed or documented as known limits in QUALITY-BASELINE

## Performance budgets (see `docs/PERFORMANCE-BUDGETS.md`)
- [ ] `npm run lighthouse:app` green (file size budgets)
- [ ] First interactive on mid-tier phone acceptable (owner timed)
- [ ] No unbounded audio node growth under multi-touch / 200-strike stress

## Accessibility
- [ ] Primary controls have accessible names
- [ ] Keyboard: scale/root/instrument and pad keys work
- [ ] Focus visible on interactive chrome (`focus-visible.css`)
- [ ] High-contrast toggle available; axe color-contrast passes under `.high-contrast`

## Device matrix (owner)
- [ ] Fill `docs/DEVICE-CHECKLIST.md` for at least one iOS Safari and one Android Chrome session

## Deploy
- [ ] Push to `main` → GitHub Actions green
- [ ] Live URL smoke: open app, strike pads, change scale/root, open Soundscapes, record a loop layer
- [ ] Scorecard updated only with **linked evidence**
