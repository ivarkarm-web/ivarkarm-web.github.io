# Pionier release checklist

Complete before claiming a production deploy or score ≥ 8 on production readiness.

## Scope lock
- [ ] No Learn mode / lessons UI or modules
- [ ] No community uploads / User-Created / Cloudflare song worker
- [ ] Soundscapes = owner Bedroom Sessions only
- [ ] README “What it is / is not” matches the live app

## Assets & rights
- [ ] Every shipped sample listed in `docs/AUDIO-LICENSES.md` with provenance
- [ ] No uncleared third-party handpan samples in the bundle
- [ ] Owner-recorded multi-velocity samples preferred for Handpan (or documented procedural fallback)

## Service worker / offline
- [ ] `CACHE_VERSION` bumped for this deploy
- [ ] `SHELL` in `sw.js` matches `index.html` query stamps (`?v=`)
- [ ] Deleted modules (e.g. repository-loop-save) are **not** in SHELL
- [ ] Manual offline check: load once online, go offline, reload → instrument shell loads

## Quality gates (CI)
- [ ] `npm test` (smoke) passes
- [ ] `npm run test:app` (unit) passes
- [ ] `npx playwright test` passes on mobile-360, mobile-390, desktop
- [ ] No known flaky tests marked as “ignore”

## Performance budgets (see `docs/PERFORMANCE-BUDGETS.md`)
- [ ] Shell HTML + critical CSS under budget
- [ ] First interactive on mid-tier phone acceptable (owner timed)
- [ ] No unbounded audio node growth under 200-strike stress

## Accessibility
- [ ] Primary controls have accessible names (`aria-label` or visible text)
- [ ] Keyboard: scale/root/instrument steppers and pad keys work
- [ ] Focus visible on interactive chrome
- [ ] Reduced-motion path does not break playability

## Device matrix (owner)
- [ ] Fill `docs/DEVICE-CHECKLIST.md` for at least one iOS Safari and one Android Chrome session

## Deploy
- [ ] Push to `main` → GitHub Pages green
- [ ] Live URL smoke: open app, strike pads, change scale, open Soundscapes, record a loop layer
- [ ] Scorecard updated only with **linked evidence**
