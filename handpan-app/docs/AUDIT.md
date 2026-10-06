# Handpan App Audit — Phase 0

**Date:** 2026-10-06  
**Repo:** `ivarkarm-web/ivarkarm-web.github.io` @ `main` (`7f977d4`)  
**Branch for work:** `handpan-app-v1`  
**Auditor method:** full source read of `handpan-app/` + main-site `:root` tokens; static analysis of gain staging, event paths, CSS tokens and layout; theoretical level calculation from code constants. Offline spectral renders and Playwright viewport captures deferred to measurement harness in Phase 1 (no browser audio context available in this audit environment for full offlineAudioContext runs).

---

## Findings table

| ID | Severity | Status | Evidence | Fix |
|----|----------|--------|----------|-----|
| **A1** | P0 | **CONFIRMED** | `js/ambient.js`: `natureGain = 0.24`, rain layers `0.026` and `0.010`, stream `0.045`/`0.014`, storm `0.038`/`0.014`, forest `0.012`, birds `0.018`, thunder peak `0.07`. Product at bus ≈ 0.002–0.011 linear. Backing tones `0.055` × bus `0.22` ≈ 0.012. Master chain then compresses at −14 dB. Theoretical peak roughly **−39 to −54 dBFS** before master; RMS lower still. Inaudible on phone speakers. | Rebuild gain staging; target ambience beds −26…−20 dBFS RMS (Phase 4). |
| **A2** | P0 | **CONFIRMED** | `makeNoise` produces 2 s looped pink/brown noise; rain = LPF pink; stream = LPF brown; birds = 0.11 s sine chirps at random 900–2600 Hz; storm = brown + sine sweep 70→28 Hz. No droplets, no stereo movement, no granular texture, audible loop seam on 2 s buffer. | Procedural layered soundscapes (Phase 4). |
| **A3** | P0 | **CONFIRMED** | `app-shell.js` `setMode`: `if (mode !== 'ambient') { HandpanAtmosphere.backing('off'); HandpanAtmosphere.set('off'); }`. Dropdowns (`#natureSelect`, `#backingSelect`) are never reset. Re-selecting the same value does not fire `change`. Dock only shown in loop/ambient. Play mode has no ambience controls. | Persist ambience across modes; global mixer sheet; UI always reflects audio state (Phase 4 + 6). |
| **A4** | P1 | **CONFIRMED** | Backing uses `setInterval(musicTick, 420|620|900)`. Nature chirps/thunder use `setTimeout`. Not tied to `AudioContext.currentTime`. | Single lookahead scheduler on audio clock (Phase 1). |
| **A5** | P0 | **CONFIRMED** | `voice-presets.js`: 5 presets, each 5 partials of sine/triangle + short noise burst. Shared structure; differ mainly in decay and ratios. No modal doublets (beating), no body resonance, no per-partial decay curve matching real handpan (fund + 2× + 3× dominant), no articulation model beyond velocity→gain. `sounds/manifest.json` has `"samples": {}` — sample path never used. | Modal-synthesis handpan voice (Phase 2). |
| **A6** | P1 | **CONFIRMED** | Single convolution reverb: `makeImpulse(ctx, 2.8, 3.2)`, fixed send `0.34`. No delay, no per-instrument FX chain, no tempo sync. | FX engine: delay + multi-IR reverb + macros (Phase 3). |
| **L1** | P0 | **CONFIRMED** | `loop.js` `playEvent` calls `HandpanGame.strike(n, v, { source: 'loop' })`. `strikeNote(idx, vel, impact)` treats 3rd arg as impact geometry, not options. Event always dispatched without `source`. `noteHandler` records every `handpan:note` in overdub with no source filter. Overdub records its own playback. | Source-tagged events; never record `source === 'loop'` (Phase 5). |
| **L2** | P0 | **CONFIRMED** | Clock: `performance.now()` + `requestAnimationFrame`. No lookahead, no `AudioContext.currentTime`, no latency compensation. ~16 ms frame jitter; throttled in background. | Audio-clock scheduler with latency compensation (Phase 1 + 5). |
| **L3** | P1 | **CONFIRMED** | Count-in exists (visual only, no audible click). No start-on-first-note, no undo/redo, no per-layer mute/solo/volume/delete, tempo/bars locked until Clear, no save/export, no loop FX. `transport.js` is a second unused rAF clock. | Rebuild looper from scratch (Phase 5). |
| **U1** | P0 | **CONFIRMED** | Site tokens: `--accent-gold #c9a227`, `--metal #c4a35a`, editorial ~6 px radii, hairline `rgba(255,255,255,0.07)`, Fraunces + Inter, motion family (`--ease-resonance`, `--dur-impact 0.22s`, etc.). App hard-codes `rgba(212,175,55,…)`, `border-radius: 999px` / `20px` / `16px` / `18px`, own timings. No light theme (`data-theme` present but unused). | `tokens.css` mirroring site; replace hard-coded golds and radii (Phase 6). |
| **U2** | P0 | **CONFIRMED** | Bottom mode bar + separate back pill + top scale dropdown + right dock toggle (loop/ambient only) + Learn panel + Learn modal + hidden `#appPanel`. Magic bottoms: `+9.25rem`, `+7.05rem`, `+4.85rem`. | Single shell: top bar + canvas + bottom tabs + bottom-sheet system (Phase 6). |
| **U3** | P0 | **CONFIRMED** | Labels at `0.34–0.56rem` (~5.5–9 px). Controls `min-height: 27–38 px` (below 44 px). Viewport: `maximum-scale=1, user-scalable=no`. Heights use `100vh` / fixed offsets that break under iOS dynamic toolbars. | Min 12 px type, 44 px targets, `dvh`/`svh`, remove zoom lock (Phase 6). |
| **U4** | P1 | **CONFIRMED** | (1) `goBack` falls back to `./index.html` (the app), not `../`. (2) Learn is opened on mode enter but never stopped on mode leave; close path incomplete. (3) `app-shell.js` is a classic script; `window.HandpanApp.instrument = window.HandpanGame || null` runs before the module loads → always `null`. | Fix URL, mode enter/exit lifecycle, convert to ES modules (Phase 6). |
| **U5** | P1 | **CONFIRMED** | No `localStorage` / IndexedDB usage anywhere in `handpan-app/`. No web manifest, no service worker, no app icons. Fonts hotlinked from Google Fonts. | Persistence module + manifest + SW + self-hosted fonts (Phase 6). |
| **U6** | P1 | **CONFIRMED** | `app.css` ~1000 lines, repeated media queries, dead rules. Modules communicate via `window.*` globals and custom events. `handpan.js` is a drifted fork of root `js/handpan.js`. CI: app tests on PRs only; deploy runs smoke only. | Split CSS, explicit imports, strengthen CI (Phase 6). |
| **U7** | P2 | **CONFIRMED** | Portfolio easter egg opens root `handpan.html`, not `handpan-app/`. No public nav link to the app. | Propose link in final report; do not edit main site in this work. |

### Additional findings (not in original hypothesis list)

| ID | Severity | Status | Evidence | Fix |
|----|----------|--------|----------|-----|
| **X1** | P0 | **CONFIRMED** | `HandpanGame.strike` signature is `(idx, vel, impact)`. Loop passes `{ source: 'loop' }` as the third argument; it is interpreted as impact geometry (`impact.center`), corrupting velocity. | Unify strike API with explicit `options` object including `source` (Phase 1/5). |
| **X2** | P1 | **CONFIRMED** | Dual master chains: `audio-core.js` builds master+compressor; `HandpanEngine._build` builds its own bus→comp→master→`getAudioMaster()`. Two compressors in series, no shared analyser for ambience/backing. | Single mixer graph (Phase 1). |
| **X3** | P2 | **CONFIRMED** | Instrument grid in ambient.js builds from `VOICE_PRESETS` (5 items) while scale sheet is separate; UI presents “instruments” as the 5 synth voices, not the 9 handpan scales. Confusing dual browser. | One instrument library: 9 handpans + 9 synths (Phase 3). |

---

## Baseline metrics

### Audio levels (theoretical, from code constants)

Computed as linear product of source gain × bus gain, expressed as peak dBFS assuming full-scale source. RMS will be lower (noise ~−10 dB relative to peak; short tones lower still). Master gain 0.9 and compressor (−14 dB threshold) apply after.

| Source | Source gain | Bus | Product | Peak dBFS (approx) | Audible? |
|--------|-------------|-----|---------|--------------------|----------|
| Rain bed (pink) | 0.026 | 0.24 | 0.0062 | −44 | No |
| Rain texture | 0.010 | 0.24 | 0.0024 | −52 | No |
| Stream | 0.045 | 0.24 | 0.0108 | −39 | Marginal |
| Storm bed | 0.038 | 0.24 | 0.0091 | −41 | Marginal |
| Forest bed | 0.012 | 0.24 | 0.0029 | −51 | No |
| Bird chirp | 0.018 | 0.24 | 0.0043 | −47 | Barely |
| Thunder | 0.07 | 0.24 | 0.0168 | −36 | Quiet |
| Backing drone/pulse | 0.055 | 0.22 | 0.0121 | −38 | Quiet |
| Handpan voice (nominal) | ~0.2–0.5 peak partial | 1.0 → eng master 0.85 → audio master 0.9 | ~0.15–0.4 | −16…−8 | Yes |

Full offline spectra will be written to `docs/audio-baseline.json` once the Phase 1 harness runs.

### Code / structure

| Metric | Value |
|--------|-------|
| `handpan.js` | ~1,125 lines (engine + canvas + input) |
| `app.css` | ~1,000 lines |
| Voice presets | 5 (Steel, Warm, Bell, Soft, Deep) |
| Scales | 9 (D Kurd … E Integral Extended) |
| Sample coverage | 0 (empty manifest) |
| Persistence | None |
| Tests | Unit (`node --test`) + Playwright `handpan.spec.mjs` + smoke |
| Version | 0.4.1 |

### Performance (static estimate)

- Canvas + particle system runs every frame; DPR capped (good).
- No measured load time / long-task data in this environment; to be captured with Playwright in Phase 1.

---

## What is already good (do not regress)

1. **Canvas instrument look** — steel disc, note fields, glow, ripples, sparks; visually coherent and satisfying.
2. **Multi-touch** — pointer map, multi-note chords, velocity from movement speed.
3. **Haptics** — short vibration on strike (coarse pointer).
4. **DPR cap** — sensible devicePixelRatio limit for mid-range phones.
5. **Safe-area usage** — `env(safe-area-inset-*)` already present on several fixed elements.
6. **9 real scales** with correct note layouts and ding-centred geometry.
7. **SampleBank scaffold** — velocity buckets, detune, graceful fallback already sketched.
8. **Learn core** — TimingScorer and 16 lessons exist and should be preserved/adapted.
9. **Keyboard map** — QWERTY path works.
10. **Isolation** — app lives under `handpan-app/` and does not touch the main site.

---

## Ranked plan (evidence-driven order)

The original phase order is validated by the audit. One reordering note:

1. **Phase 0** — this audit (done).
2. **Phase 1 — Audio foundation** (mandatory first): single clock, single mixer, gain contract. Unblocks every subsequent audio claim.
3. **Phase 2 — Handpan sound engine** (P0 A5): the product’s reason for existing.
4. **Phase 4 — Ambience & backing** (P0 A1–A3): gain staging is the loudest user complaint; can share the new mixer from Phase 1. *Consider running Level calibration of ambience immediately after Phase 1 before full procedural rebuild.*
5. **Phase 5 — Looper rebuild** (P0 L1–L2): depends on audio clock.
6. **Phase 3 — Instrument library + FX**: depends on solid voice engine; can proceed in parallel with Phase 4 once Phase 2 voice API is stable.
7. **Phase 6 — UI cohesion**: last, so it wraps the new surfaces rather than being torn up again.

**Rationale for not swapping Phase 3 and 4:** ambience silence (A1) is the most embarrassing live bug; FX can wait until voices exist.

---

## Measurement backlog (Phase 1 harness)

- Offline render of every nature mode and backing mode → peak/RMS dBFS, spectrum, duration, seam detector.
- Offline render of each of 5 current voices × 3 notes (low/mid/high) × 2 velocities → partial ratios, T60, centroid.
- Loop playback jitter vs `AudioContext.currentTime` over 60 s.
- Playwright screenshots at 390×844, 360×740, 844×390, 768×1024, 1440×900 for every mode + open dock/sheet.

Until those numbers exist, no claim of “sounds right” or “audible” will be made beyond the theoretical levels above.

---

## Baseline test status

Existing suite (`npm run check:app`) was not executed in this audit environment (Playwright + full node deps not installed here). Contract tests assert HTML surface and script order; they should still pass. Full green run is a Phase 1 exit criterion.

---

*End of Phase 0 audit. Next commit after this file: Phase 1 audio foundation.*
