# PIONIER recovery audit

Date: 2026-10-13
Branch: `recovery/pionier-music-production`
Scope: `handpan-app/` only. The portfolio and website Easter egg are out of scope.

## Product decision

PIONIER is being refocused as a pocket-sized, expressive music-making instrument. The handpan-shaped surface remains the core interaction; lessons, scoring, unlocks, and rhythm-game mechanics are not core product features. No new feature work while recovery is in progress.

## Changes made in this branch

- Removed the Learn launch button from the app shell.
- Removed the Learn stylesheet and runtime module from `index.html`.
- Removed the instrument core's learning-event dispatches and Catch Mode runtime initialization/hooks. The old source files remain in the repository as a reversible archive until the dependency audit is complete.
- Updated README product direction and recovery guardrails.

## Confirmed architecture findings

- `index.html` loads `pionier-app.js`; that shell imports `pionier-core.js` as the required runtime core.
- `pionier-core.js` owns pointer input, instrument selection, the shared instrument bus, an `FxChain`, and the `#pan` surface.
- The same shell independently mounts the ambient backdrop player and looper.
- `js/learn-mode.js` was a separately loaded module listening for `pionier:learn-note`; the core emitted this event on direct touch, glide, and keyboard/demo note paths. Those hooks have now been removed from the active runtime.
- `js/looper.js` currently declares a five-layer maximum and captures the master output using `ScriptProcessorNode`. This is deprecated and requires redesign/testing for a reliable production looper.
- `sounds/manifest.json` is a small metadata document whose `samples` field is a string pointing at `sounds/notes/manifest.json`; it is not itself the sample map shape expected by the legacy `js/sample-bank.js`.
- `SOUNDS.md` and the README describe synthesized voices as authoritative. The active handpan instrument module separately attempts to load `sounds/notes/` samples via its own `NoteSampleBank`. The actual runtime usage and compatibility of both sample systems still need tracing before consolidating anything.
- `js/handpan.bundle.js` and `js/handpan-src-*.js` represent a legacy bundled engine/source-template arrangement. Do not delete them until all references and the standalone Easter egg route are mapped.

## Remaining work / verification gates

1. Trace the full runtime import graph and identify active versus legacy engines and sample banks.
2. Inspect and stabilize canvas geometry and responsive sizing at 390×844 and 1280×800; check every playable zone, pointer capture/release, and multi-touch.
3. Rework the looper around an explicit shared transport/loop timeline; verify synchronization, overdub, mute, deletion, clear, cancellation and layer limits.
4. Audit FX signal routing, parameter ranges, gain staging, and mobile interaction. Avoid changing the current visual layout until the instrument geometry is stable.
5. Run automated checks and real mobile browser tests. No real-device tests have been performed as part of this audit yet.

## Safety

No files were deleted. No changes were made to the repository's default branch. Changes must be reviewed on this recovery branch before merging.
