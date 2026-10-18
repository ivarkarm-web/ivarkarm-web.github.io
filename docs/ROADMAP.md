# Pionier roadmap

Last updated: 2026-10-18. This roadmap reflects the requested Oval-inspired interaction and visual reference direction, while retaining the static/no-build-step architecture.

## P0 — restore dependable playing (release blockers)

- Reproduce and fix skin-customization state breaking pad play/add-note.
- Fix instrument and scale dropdown visibility, outside-tap close, focus/stacking, iOS Safari and Android Chrome behavior.
- Verify root, octave, tuning and +/- note-count controls update both pitch and labels immediately.
- Fix clipped loop button and Soundscapes loop-menu state.
- Add regression tests for skin changes, repeated pad strikes, multitouch pointer-up, menu state and all pitch/layout controls.
- Capture baseline screenshots at 390×844 and tablet/desktop before visual cleanup.

Exit gate: no regression in tap/hold/slide/bend, multitouch, keyboard input or pad hit-testing.

## P1 — align visual structure to reference captures

- Inspect all six screenshots in `handpan-app/` and build a per-screen/per-element comparison checklist.
- Phone portrait: pan as home view, positioned lower as specified, safe-area aware bottom controls, no clipped controls.
- Tablet/landscape: left sound/tuning controls, central pan, right XY/effects/looper zones.
- Keep menus anchored to edges and outside the pad hit area; no modal/full-screen play-mode overlays.
- Consolidate conflicting CSS overrides only after tests capture the intended behavior.
- Honor `prefers-reduced-motion`; keep decorative animation from blocking pointer events or consuming excessive frame time.

## P2 — controls and expressive playing

- Complete instrument class selector: 9 original handpans and 9 synthesized ambient/long-note instruments; remove bird and kitchen entries.
- Validate worldwide and microtonal scale library, root selector, octave, note count and A=415–466 Hz calibration.
- Add velocity sensitivity and smoothed per-pointer X/Y gesture mapping for held notes.
- XY pad maps X to filter and Y to effect wet/dry; validate one-hand effects while the other hand plays.
- Verify sample-backed notes and synthesized fallback for every instrument/scale combination.

## P3 — rebuild looper

- Replace the current multi-layer/gesture-heavy looper UI with four consistent track strips.
- Transport: play/pause, tap tempo/BPM, downbeat metronome pulse.
- Per track: record/overdub, mute, solo, volume ring and phase/progress ring.
- Quantized 2/4/8-bar loops scheduled against AudioContext time.
- Trim with short automatic fades and export mix as WAV.
- Add automated tests for record/overdub, pause/resume, mute/solo, trim/export and long-duration drift. Prefer AudioWorklet where practical; avoid a build tool requirement.

## P4 — Soundscapes and cleanup

- Soundscapes contains only Ivar's Bedroom Sessions tracks from the portfolio player.
- Remove generated ambience, third-party platform connections, Learn Mode UI/runtime/styles/menu references and bird/kitchen voices.
- Keep audio playback persistent and prevent loop/effect overlays from leaking across page transitions.
- Audit service worker caching, lazy loading and offline startup/error states.

## P5 — optional / deferred

- MIDI output: feature-detect Web MIDI; scale-locked note on/off and velocity; gesture pitch bend; hide gracefully where unsupported.
- User song sharing is explicitly out of scope. Keep an extension point only; no upload/download backend, accounts or user content.
- Do not add external audio samples without documented rights.

## Acceptance matrix

Run automated checks at 360×640, 390×844, and tablet/desktop. Then test on real iOS Safari and Android Chrome. Record each result as pass/fail with device/browser/version; never infer real-device success from desktop emulation. Require stable 5+ minute looper timing and a measured interaction latency target before calling the app production-ready.
