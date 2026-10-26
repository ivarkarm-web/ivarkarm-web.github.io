# Pionier Handoff State

**Updated:** 2026-10-26  
**Branch:** `main`  
**App version:** 170 (`handpan-app/APP_VERSION`)

## Current focus (2026-10-26)

Hygiene and correctness pass on `main`:

1. **Unit test** — `owner-controls.test.mjs` aggregates `css-parts/layout-*.css` (or resolves legacy `@import`) so the looper toolbar `position: relative` assertion is no longer stale.
2. **CSS delivery** — layout and ambient ship as parallel `<link>` tags under `css-parts/` (no sequential `@import`). PurgeCSS sees every rule; deploy truncation of one part cannot drop the whole toolbar sheet.
3. **Docs** — `handpan-app/ARCHITECTURE.md`, `docs/HANDOFF_STATE.md`, and `docs/AUDIT.md` updated for v170, AudioWorklet looper, real stylesheet names, and CSS budget reality.
4. **Lockfile** — `package-lock.json` added when available so `npm install` is reproducible (vite remains a dependency; prefer exact resolved versions via the lockfile).
5. **Leftovers** — Learn mode gone; catch-mode still wired in core but not product UI; mandala path retired; `skin-palette.js` kept for neutral finish.
6. **Real devices** — still **owner-gated**. No claim of iOS Safari / Android Chrome pass.

## Release gates still open

- Owner pass on real phone hardware (picker open, pan placement, Loop Studio, root/note-count, Soundscapes return).
- Confirm Pages deploy workflow green after this push.
- CSS shipping budget remains tight after PurgeCSS (~250 KB ceiling); any new CSS needs a budget check.
- Broad reduction of thousands of `!important` rules remains technical debt.

## Do not claim

- 8/10 production readiness
- Physical iOS/Android verification
- That raw source CSS size equals shipping size (optimizer runs only in CI workspace)
