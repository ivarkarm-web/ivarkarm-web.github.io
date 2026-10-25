# Pionier app audit — 2026-10-18

## Scope and baseline

Repository: `ivarkarm-web/ivarkarm-web.github.io`, default branch `main`.
Live route: `/handpan-app/`. Static HTML/CSS/ES modules; no build step is required.
This is a source-level audit. No physical iOS/Android device or browser automation was run as part of this audit, so the user-reported mobile failures below remain reproduction targets rather than independently reproduced findings.

## Measured baseline — app version 167 (2026-10-25)

Source file sizes read from the current `main` branch; these are repository byte counts, not browser transfer sizes or a minified build measurement.

| Stylesheet | Bytes | Decimal kB |
|---|---:|---:|
| `handpan-app/pionier-base.css` | 172,845 | 172.8 |
| `handpan-app/pionier-controls.css` | 77,523 | 77.5 |
| `handpan-app/pionier-layout.css` | 54,108 | 54.1 |
| `handpan-app/pionier-ambient.css` | 23,126 | 23.1 |
| **Total (four linked stylesheets)** | **327,602** | **327.6** |

Target: below 250,000 bytes total for shipped CSS. This baseline is **not yet passing**. No dead-rule removal or minified output is claimed by this measurement. The repository's `package.json` includes Vite, but `handpan-app/index.html` currently links these stylesheets directly; a Vite migration must preserve the GitHub Pages `/handpan-app/` path and service-worker cache behavior.

The shipping app version recorded in `handpan-app/APP_VERSION` is `167`. iOS Safari and Android Chrome remain unverified until a real-device pass is recorded.

## Reference screenshots — inspected individually

All six PNGs were visually inspected. The capture set shows the same dark, restrained interface with orange active controls, blue add action, thin borders, generous negative space, and no decorative mandala background.

1. **15.42.51 — portrait play surface (338 × 982):** top bar with hamburger, centered `play`, blue plus, help; instrument selector row; large centered radial pan with 8 surrounding notes plus center note; bottom scale pill and paired base-note / note-count steppers; page dots. This is the mobile hierarchy to preserve.
2. **15.43.33 — portrait filter view (634 × 1156):** top bar remains; a single large rounded filter graph dominates the upper/middle screen, with Filter title, orange response curve, Cutoff/Resonance labels and four filter-type buttons. Four large circular effect controls sit along the bottom with a page indicator.
3. **15.43.54 — portrait recording modal (634 × 1156):** dimmed play surface behind a centered rounded “New Recording” dialog. The dialog contains a waveform, elapsed/remaining time, trim/stop/discard icons, and bottom Discard/Share actions. Transport bar remains visible underneath the scrim.
4. **15.44.25 — landscape play surface (1406 × 1054):** narrow top bar with play control at far left, centered instrument selector, add/settings/help at right. Left sidebar holds Scale, Base Note, Octave; radial pan dominates the central column; four large effect knobs are vertically aligned on the right; bottom transport centers record, time, BPM and metronome, with master volume at far right.
5. **15.44.46 — landscape filter view (1440 × 1054):** same landscape chrome and left tuning sidebar. Central column shows Filter title, large graph and four filter-type buttons plus Cutoff/Resonance controls. Right column retains four circular effect selectors; bottom transport and master-volume placement remain stable.
6. **15.45.06 — landscape scale browser (1406 × 1054):** left sidebar remains visible; scale browser fills the central/right content area with a search field, filter action, and dense three-column scale grid. Selected scale is clearly highlighted; top and bottom bars remain stable.

### Reference-derived visual acceptance criteria

- Portrait and landscape are distinct layouts, not one mobile layout scaled up.
- Landscape must use a true three-column work area (tuning / pan or FX / effect controls) and a persistent bottom transport.
- The pan stays the primary element in play mode; FX mode replaces the center content with a graph without moving the global chrome.
- Scale browsing is searchable, dense, and keeps tuning controls visible in landscape.
- Recording is a focused modal with waveform and explicit Discard/Share; it must not be confused with loop-track recording.
- Use orange for active/record state, blue for add, muted gray for inactive controls. Avoid new mandala/stick decorations and excess motion.
- Do not claim parity until automated screenshots at matching portrait/landscape dimensions are compared to these references.

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

## Reported live-phone bugs — automated coverage status (2026-10-21)

These were reported by the owner. Source-level unit tests now guard wiring; full visual/device reproduction remains owner-gated or Playwright (W2).

| # | Report | Automated coverage | Notes |
|---|--------|--------------------|-------|
| 1 | After skin customization, the pan cannot be played and notes cannot be added | Partial — `owner-controls.test.mjs` asserts skin modules remain; no hit-test after skin change yet | Playwright skin + pad hit-test planned in W2 |
| 2 | Loop button is clipped inside its bar | Partial — unit test asserts loop button CSS `min-height`/`min-width` ≥ 44–52px and no `top: 25%` | Visual clip needs Playwright screenshot |
| 3 | Instrument and scale dropdowns fail to appear | Partial — overlay-controller wiring + scaleLabel picker tests | Full open/close + viewport tests in W2 |
| 4 | Root note and +/- note-count controls do not work | **Covered by unit tests** — HTML ids, wire() bindings, changeNoteCount clamp 8–13 via `pad-layout.js` | |
| 5 | Loop menu glitches on Soundscapes | Not covered | Playwright soundscapes + looper interaction in W2 |

Treat remaining gaps as release blockers until W2 Playwright suite closes them. First inspect event propagation, hidden/overlay elements, pointer capture and z-index, and ensure all skin states preserve pad hit-testing.

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
- [x] Note-count range unified (8–13) and unit-tested (W1).
- [x] deploy.yml runs full smoke + unit + Playwright before Pages upload (W1).
- [ ] Per-screenshot visual inventory and exact reference comparison.
- [x] Phone bug #4 (root / note-count) covered by unit tests; others partial or planned for W2.
- [ ] Automated tests at 360×640, 390×844 and tablet/desktop viewport (W2).
- [ ] Real iOS Safari and Android Chrome checks (owner-gated).
- [ ] Multitouch, rapid strikes, audio latency, looper drift, export, offline and accessibility checks.

## Release posture

Do not claim the requested 8/10 reliability or production-readiness score until the blocker regressions and acceptance matrix pass. No live-device test is claimed here.
