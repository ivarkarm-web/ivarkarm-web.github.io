# Pionier app audit — 2026-10-18

## Scope and baseline

Repository: `ivarkarm-web/ivarkarm-web.github.io`, default branch `main`.
Live route: `/handpan-app/`. Static HTML/CSS/ES modules; no build step is required.
This is a source-level audit. No physical iOS/Android device or browser automation was run as part of this audit, so the user-reported mobile failures below remain reproduction targets rather than independently reproduced findings.

## Reference screenshots found

The app folder contains five reference captures dated 2026-10-18:

- `Screenshot 2026-10-18 at 15.42.51.png`
- `Screenshot 2026-10-18 at 15.43.33.png`
- `Screenshot 2026-10-18 at 15.43.54.png`
- `Screenshot 2026-10-18 at 15.44.25.png`
- `Screenshot 2026-10-18 at 15.44.46.png`
- `Screenshot 2026-10-18 at 15.45.06.png`

There are six files, despite the original task's wording not specifying a count. Image pixels have not yet been visually inspected in this source-only pass, so I do not claim an exact per-capture screen inventory. The current HTML identifies the visible screen elements below; screenshot-by-screenshot comparison is a required next verification step.

## Current screen / UI inventory from source

- Global app status message and Retry action.
- Top bar: menu, centered mode label, add button, help button.
- Instrument row: previous/next arrows and instrument-name dropdown.
- Instrument dropdown menu.
- Mobile control drawer and control panel.
- Scale stepper/menu and root/octave/note-count controls.
- Main stage and radial `#pan` surface with note labels.
- Effects/filter controls and XY/effect surface (depending on active markup).
- Looper/transport controls and loop/layer UI.
- Soundscapes / Bedroom Sessions player entry points and playlist-related code.
- Skin/customization, ambient, Learn, and other legacy UI hooks still have CSS/JS references even though screenshot CSS hides some of them.

## Reported live-phone bugs to reproduce first

These were reported by the owner and have not yet been independently reproduced in this audit:

1. After skin customization, the pan cannot be played and notes cannot be added.
2. Loop button is clipped inside its bar.
3. Instrument and scale dropdowns fail to appear.
4. Root note and +/- note-count controls do not work.
5. Loop menu glitches on Soundscapes.

Treat these as release blockers. First inspect event propagation, hidden/overlay elements, pointer capture and z-index, and ensure all skin states preserve pad hit-testing.

## Architecture observed

- `index.html`: static app shell, many layered CSS stylesheets and status/retry UI.
- `pionier-core.js`: locally vendored core; wires audio context, registry, gesture tracker, handpan, instrument library, FX, Catch Mode, debug tools, and surface.
- `js/audio-core.js`: shared Web Audio context/master.
- `js/instruments/handpan.js` + `handpan-scales.js`: note layout, scale/root/transpose behavior, samples and synthesis fallback.
- `js/gesture.js`, `js/pionier-surface.js`, `js/pad-layout.js`: pointer/gesture and radial interaction layers.
- `js/looper.js`: current multi-layer looper; its header documents up to eight layers and FREE/LOOP/BEAT/SERIAL modes. It does not match the requested new four-track design.
- `screenshot-ui.css`, `legacy-hide.css`, `topbar-narrow.css`, `looper.css`, `scale-menu.css`, `atelier.css`, `ui-stability.css`: layered UI overrides. Their cascade is a likely source of regressions and needs consolidation only after behavior is stable.
- `README.md`: says Bedroom Sessions is the owner's eight archive.org recordings only, no Learn mode, no third-party embeds and no generated ambience; it also notes the panel remains experimentally present.
- Five/six reference screenshot assets live in the app folder.

## Reuse / rewrite / remove

### Reuse initially
- Existing AudioContext lifecycle and master gain.
- Existing owner recordings and note sample bank after sample provenance and mapping are checked.
- Scale data and note-name calculation, after regression tests cover root/octave/note count.
- Existing radial canvas/DOM surface and pointer-ID gesture foundation if hit-testing is sound.
- Owner-only Bedroom Sessions source list/player assets.

### Rewrite in small, independently testable steps
- Skin/customization state-to-surface synchronization and pad hit testing.
- Instrument/scale/root/octave/note-count/tuning controls and dropdown open/close behavior.
- Responsive layout and safe-area sizing; remove contradictory CSS only after visual baseline capture.
- Looper UI and engine toward four fixed tracks, AudioContext-clock scheduling, explicit trim/export and automated drift tests.
- Soundscapes navigation and loop-menu state so the main player and pan cannot leave overlays stuck.

### Remove only after reference and dependency checks
- Learn Mode runtime, styles, menu hooks and orphaned lesson modules.
- Bird/kitchen instrument entries and generated ambience controls/beds.
- Dead/duplicate styles and unreachable customization UI. Do not delete assets/modules merely because a stylesheet currently hides their UI until imports and tests prove them unused.

## Validation status

- [x] Repository access and current main source confirmed.
- [x] Six screenshot files located by repository tree.
- [x] Active entry, core, stylesheet and handpan module inspected.
- [ ] Per-screenshot visual inventory and exact reference comparison.
- [ ] Reproduce the five reported phone bugs.
- [ ] Automated tests at 360×640, 390×844 and tablet/desktop viewport.
- [ ] Real iOS Safari and Android Chrome checks.
- [ ] Multitouch, rapid strikes, audio latency, looper drift, export, offline and accessibility checks.

## Release posture

Do not claim the requested 8/10 reliability or production-readiness score until the blocker regressions and acceptance matrix pass. No live-device test is claimed here.
