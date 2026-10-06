# Handpan App Audit — Phase 0

**Date:** 2026-10-06  
**Repo:** `ivarkarm-web/ivarkarm-web.github.io` @ `main`  
**App path:** `handpan-app/`  
**Version under audit:** 0.4.1  
**Auditor method:** Full source read of every file under `handpan-app/`; comparison against main-site `:root` tokens in `styles.css`; static gain-graph level estimates; existing unit-test baseline (`npm run test:app`); structural analysis of timing, event contracts, and CSS layout. Offline spectral renders require a Web Audio implementation in Node or Playwright OfflineAudioContext and are scheduled for the measurement harness in Phase 1; theoretical levels are reported here with explicit method.

---

## Baseline metrics

| Metric | Value | How measured |
|--------|-------|--------------|
| Unit tests (`npm run test:app`) | **17/17 pass** | `node --test scripts/app-tests/*.test.mjs` |
| Playwright / full `check:app` | Not run in this sandbox (Chromium install + serve required) | Deferred to CI / Phase 1 |
| `sounds/manifest.json` samples | **0** (`status: "fallback-synth"`) | File read |
| Lines of code (app JS+CSS+HTML) | ~3,934 | `wc -l` |
| `handpan.js` | 1,129 lines | Engine + canvas fork |
| `app.css` | 1,014 lines | Many repeated media queries |
| Modes | Play / Learn / Loop / Ambient | `app-shell.js` |
| Voice presets | 5 (Steel, Warm, Bell, Soft, Deep) | `voice-presets.js` |
| Scales | 9 (D Kurd … E Integral Extended) | `handpan.js` SCALES |
| Loop max layers | 7 | `loop-core.js` |
| Transport module | Present, **unused by looper** | `transport.js` vs `loop.js` |

### What is already good (must not regress)

- Canvas instrument look: steel plate, note fields, glow, ripples, particle bursts.
- Multi-touch and keyboard (QWERTY map) input paths.
- Haptics on coarse pointers (`navigator.vibrate`).
- DPR / resolution cap awareness in the canvas path.
- Safe-area insets used in several places (`env(safe-area-inset-*)`).
- SampleBank graceful fallback when manifest is empty.
- Loop-core pure functions (quantize, phase wrap, eventsBetween) are tested and sound.
- Shared `audio-core` single context + master + compressor topology.
- Learn curriculum: 16 lessons, TimingScorer grades, four levels.
- Static hosting, ES modules, no runtime framework dependency for the app itself.

---

## Findings table

| ID | Severity | Status | Evidence | Fix (phase) |
|----|----------|--------|----------|-------------|
| **A1** | P0 | **CONFIRMED** | `ambient.js`: `natureGain=.24`, layer gains rain `.026`/`.010`, stream `.045`/`.014`, storm `.038`/`.014`, forest `.012`, birds `.018`, thunder `.07`. Backing tones `.055` (or lower) × `backingGain=.22`. Effective linear ≈ nature 0.002–0.011, backing ~0.012. Estimated RMS at bus before master: roughly **−39 to −54 dBFS** for beds, chirps quieter. Master 0.9 + compressor (−14 dB thresh) does not lift noise floor into phone-speaker audibility. | Phase 4: recalibrate beds to −26…−20 dBFS RMS at default; separate faders; ducking |
| **A2** | P0 | **CONFIRMED** | Rain = 2 s looped pink noise LPF 6800/1800 Hz; stream = brown + pink LPF; storm = brown + pink + sine sweep 70→28 Hz; birds = 0.11 s sine blips at random 900–2600 Hz. No droplet events, no stereo width/movement, no distance model, audible 2 s loop period. | Phase 4: layered procedural stereo soundscapes, long/crossfaded buffers |
| **A3** | P0 | **CONFIRMED** | `app-shell.js` `setMode()`: `if(mode!=='ambient' && window.HandpanAtmosphere){ backing('off'); set('off'); }` — always kills nature/backing when leaving Ambient. Selects keep previous `value`; re-selecting same option does not fire `change`. Dock only allowed in loop/ambient; Play has no ambience UI. Ambient mode has no dedicated panel (only shared dock). | Phase 4 + 6: persist ambience across modes; mixer always reachable; UI mirrors playing state |
| **A4** | P1 | **CONFIRMED** | Backing uses `setInterval(musicTick, 420|620|900)`; nature chirps/thunder use `setTimeout`. Not tied to `AudioContext.currentTime`. Loop uses `requestAnimationFrame` + `performance.now()`. | Phase 1: single lookahead scheduler on audio clock |
| **A5** | P0 | **CONFIRMED** | `voice-presets.js`: five presets, same structure (5 partials sine/triangle + noise burst). Partials are simple ratio lists, not tuned modal doublets with per-partial T60 and body resonance. `manifest.json` samples empty → sample path never used in production. | Phase 2: modal synthesis with doublets, strike transient, body, velocity/position response; finish sample pipeline |
| **A6** | P1 | **CONFIRMED** | Single generated impulse `makeImpulse(ctx, 2.8, 3.2)`, fixed wet send ~0.34. No delay, no chorus, no per-instrument FX chain. | Phase 3: FX engine (reverb variants, tempo-synced delay, macros) |
| **L1** | P0 | **CONFIRMED** | `loop.js` `playEvent` → `HandpanGame.strike(n, v, { source: 'loop' })`. `strikeNote(idx, vel, impact)` treats 3rd arg as impact and **always** dispatches `handpan:note` with no `source` field. `noteHandler` records every event in overdub with no source filter. | Phase 5: event `source` field; ignore non-user sources when recording |
| **L2** | P0 | **CONFIRMED** | Playback driven by `requestAnimationFrame` / `performance.now()`; ~16 ms frame quantisation, background-tab throttling, no lookahead, no latency compensation on record. | Phase 5 + 1: audio-clock schedule + input timestamp map |
| **L3** | P1 | **CONFIRMED** | Count-in is visual only (no click). No start-on-first-note, no undo/redo, no per-layer mute/solo/volume/delete, tempo/bars locked until Clear, no save/export, no loop FX. `transport.js` is a second rAF clock unused by the looper. | Phase 5: full rebuild |
| **U1** | P0 | **CONFIRMED** | Site tokens: `--accent-gold: #c9a227`, `--metal: #c4a35a`, `--border-color: rgba(255,255,255,0.07)`, motion family `--ease-resonance` etc., Fraunces + Inter. App hard-codes `rgba(212,175,55,…)`, pill radii `999px`, many `20px`/`16px` cards, own timings; no light theme hook beyond `data-theme="dark"` on html. | Phase 6: `tokens.css` mirroring site; theme support |
| **U2** | P0 | **CONFIRMED** | Bottom mode bar + separate back pill + top scale menu + right-edge dock toggle (2 modes only) + Learn panel/modal + hidden `#appPanel`. Magic bottoms: `+9.55rem`, `+7.05rem`, `+4.85rem`. | Phase 6: single bottom-sheet system + hash router + CSS variables for chrome |
| **U3** | P0 | **CONFIRMED** | Labels at `0.39rem`–`0.52rem` (~6–8 px); many controls 28–38 px; viewport `maximum-scale=1, user-scalable=no`; Learn panel uses `100vh`. | Phase 6: ≥12 px type, ≥44 px targets, `dvh`/`svh`, allow zoom, touch-action only on canvas |
| **U4** | P1 | **CONFIRMED** | `goBack()` fallback `location.href = './index.html'` (app itself); anchor href is `../`. Learn not stopped on mode change; close path incomplete. `app-shell.js` is classic IIFE capturing `window.HandpanGame` at load time → `HandpanApp.instrument` stays null (modules load after). | Phase 6: resolve site URL once; mode enter/exit lifecycle; ES modules |
| **U5** | P1 | **CONFIRMED** | No `localStorage` / IndexedDB in handpan-app; no manifest, SW, or icons; Google Fonts hotlink. | Phase 6: versioned storage, web manifest, SW, self-host fonts |
| **U6** | P1 | **CONFIRMED** | Globals + window events; handpan.js is a drifted fork of root engine; CI app tests on PRs only; deploy runs smoke only. | Phase 1–6: module graph; extend CI |
| **U7** | P2 | **CONFIRMED** | Portfolio easter egg opens root `handpan.html`, not `handpan-app/`. | Propose link in final report only (no root edits) |

### Additional findings (not in original hypothesis list)

| ID | Severity | Status | Evidence | Fix |
|----|----------|--------|----------|-----|
| **X1** | P1 | CONFIRMED | `HandpanGame.strike` signature is `(idx, vel, impact)`; loop’s `{source:'loop'}` is misinterpreted as impact geometry. | Align public API with `{ source, impact }` options object |
| **X2** | P2 | CONFIRMED | Visibility handler suspends audio on hidden but never auto-resumes with UI affordance (“tap to resume”). | Phase 1 lifecycle |
| **X3** | P2 | CONFIRMED | No analyser-driven visuals for ambience; atmosphere layer is decorative. | Phase 4 |
| **X4** | P1 | CONFIRMED | Learn demo/practice timers use `setTimeout`/`setInterval` + `performance.now()`, not audio clock — same class of timing issue as A4/L2. | Phase 1 + Learn adapt in Phase 6 |

---

## Audio baseline (theoretical gain-graph)

Method: product of source gain × bus gain × master (0.9), ignoring compressor makeup. Converted as `20·log10(linear)`. Offline buffer renders with spectra will replace these in `docs/audio-baseline.json` once the harness lands (Phase 1).

| Source | Source gain | Bus | Bus gain | Approx linear @ master | Est. peak dBFS |
|--------|-------------|-----|----------|------------------------|----------------|
| Rain layer high | 0.026 | nature | 0.24 | ~0.0056 | **≈ −45** |
| Rain layer low | 0.010 | nature | 0.24 | ~0.0022 | **≈ −53** |
| Stream primary | 0.045 | nature | 0.24 | ~0.0097 | **≈ −40** |
| Storm primary | 0.038 | nature | 0.24 | ~0.0082 | **≈ −42** |
| Forest bed | 0.012 | nature | 0.24 | ~0.0026 | **≈ −52** |
| Bird chirp | 0.018 | nature | 0.24 | ~0.0039 | **≈ −48** |
| Thunder peak | 0.07 | nature | 0.24 | ~0.015 | **≈ −36** |
| Backing tone | 0.055 | backing | 0.22 | ~0.011 | **≈ −39** |
| Handpan voice (nominal) | ~0.2–0.5 envelope | instrument bus | ~1 | higher | sits above beds |

**Conclusion:** Ambience and backing are effectively silent on phone speakers relative to the instrument. Target for Phase 4: beds −26…−20 dBFS RMS, peaks < −6 dBFS; backing −24…−18 dBFS RMS; instrument always above.

---

## Screenshots

Playwright mobile/desktop captures at the five required viewports will be stored under `docs/screens/` after the local serve + Playwright pass in Phase 1. Static structure confirms: mode bar bottom, back top-left, scale menu top, dock right (loop/ambient only), loop orb bottom-right with magic offsets.

---

## Ranked plan (evidence-driven)

Evidence supports the original phase order with one emphasis change:

1. **Phase 0** — this audit (done).  
2. **Phase 1 — Audio foundation** — mandatory before any audible work: one clock, one mixer, documented gain staging, lifecycle. Fixes A4, L2 root, X2, X4 class.  
3. **Phase 2 — Handpan sound engine** — A5 is P0 product quality; do modal voice before library expansion.  
4. **Phase 4 — Ambience & backing** — A1/A2/A3 are P0 “feature is broken”; fix levels and state *before* or tightly with Phase 3 so FX has something audible to process. *Slight reorder option:* run Phase 4 level calibration immediately after Phase 1 mixer exists, then Phase 3 FX, then polish ambience layers. Documented choice: keep Phase 3 then 4 as specified unless mixer lands early enough to parallelize level work.  
5. **Phase 3 — Instrument library + FX** — A6; needs stable engine + mixer.  
6. **Phase 5 — Looper rebuild** — L1/L2/L3; depends on Phase 1 clock and event `source`.  
7. **Phase 6 — UI cohesion** — U1–U7; can start token extraction in parallel once Phase 1 is stable.

No finding justified skipping Phase 1.

---

## Measurement harness (next)

- `scripts/analyze-voice.mjs` + OfflineAudioContext (Playwright or `node-web-audio-api`) for peak/RMS/spectrum/T60.  
- Seam-click / autocorrelation test for ambience loops.  
- Loop jitter harness against `AudioContext.currentTime`.  
- Replace theoretical rows in `audio-baseline.json` with measured values before claiming Phase 4 exit.

---

## Commit note

This file is the first commit on branch `handpan-app-v1`. No production code changed yet.
