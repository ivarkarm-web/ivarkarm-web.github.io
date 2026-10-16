# Pionier quality baseline

Measured facts only. Nothing is marked DONE without a real run.

## Phase 0 — Real-browser baseline (2026-10-16)

Environment: Chromium via browser tooling against https://ivarkarm-web.github.io/handpan-app/

### Boot
- `window.PionierCore` present; `health.instrumentReady === true`
- Status banner `data-state="ready"`, hidden
- No "could not start" banner
- Cold transfer ~119 KB for shell modules (samples not loaded until scale play)
- ~46 network resources for shell; no failed requests observed in the capture

### Layout (measured)
- Stylesheets: 9 app CSS + Inter + 1 inline block
- Fixed overlays: `skinMandalaCanvas`, `ambientFxCanvas`, `stageScaleBar` (z=1000), `pionierTopDock` (z=4000)
- At one measured viewport (780×493), `#pan` reported `left: -120` and `#stageScaleBar` `left: -359` — off-canvas positioning risk under some sizes
- Instrument dropdown opens and lists many voices (46 menu buttons)
- Scale chip does not open `#scaleMenu` (menu stays `display:none`, 0 items) when tapping `#scaleLabel`
- Controls drawer opens (`aria-expanded=true`) but measured height ~40px — content not usefully expanded
- Soundscapes open leaves panel with class `is-active` while `hidden` still true; UI goes mostly blank (pan disappears)

### Product decisions applied next
- Remove generated ambience and user-upload soundscapes paths
- Remove Learn mode artifacts
- Bedroom Sessions only (Phase 3)

### Tests (local sparse clone, 2026-10-16)
- `node scripts/smoke-test.mjs`: PASS (76 checks on sparse tree)
- `npm run test:app`: 18/18 PASS after fixing fetch query-string handling and deleting `backdrop-player.test.mjs`
- Playwright: not fully re-run in this session (install blocked by environment)

## Unverified
- Real-device iOS Safari audio unlock
- Offline play after SW install
- Repeat-visit zero sample network
- Multi-touch chords
- archive.org Bedroom Sessions streaming
