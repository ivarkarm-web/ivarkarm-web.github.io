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
- `js/looper.js` now supports seven layers. Its recording tap is connected only while recording and takes its signal from the instrument FX output rather than the shared master output, so existing loop playback is no longer deliberately fed back into new recordings. The capture still uses deprecated `ScriptProcessorNode`; a modern AudioWorklet path and shared loop timeline remain open work.
- The active handpan instrument imports `NoteSampleBank` from `js/note-sample-bank.js` and loads `sounds/notes/manifest.json`. That manifest has the per-scale recording metadata the active bank expects. The top-level `sounds/manifest.json` is only a metadata pointer and is not the active bank's sample map.
- The separate legacy `js/sample-bank.js` expects a key-indexed `samples` object from the top-level manifest; that shape does not match the pointer document. It is imported by the legacy `js/handpan.bundle.js`, not by the active `pionier-core.js` instrument path. Treat it as legacy and do not consolidate until standalone route references are fully mapped.
- `js/handpan.bundle.js` and `js/handpan-src-*.js` represent a legacy bundled engine/source-template arrangement. Do not delete them until all references and the standalone Easter egg route are mapped.

## Remaining work / verification gates

1. Active runtime and sample paths are now traced at the module level; legacy engine cleanup remains deferred until the old standalone page/entry references are located.
2. A `ResizeObserver` and visual-viewport resize hook now complement window resize. Canvas centering and touch-zone behavior still require screenshot/browser checks at 390×844 and 1280×800.
3. The looper capture tap no longer captures already-playing loop layers and is disconnected outside recording. Loop duration/phase synchronization, AudioWorklet migration, and real-device checks remain unfinished.
4. The active FX chain routes instrument audio through the modular FX chain and then the shared master/compressor. Further gain-staging and parameter testing remain open.
5. No automated browser suite or real mobile-device test has been run from this environment; this must be completed before calling the app production-ready.

## Safety

No files were deleted. No changes were made to the repository's default branch. Changes must be reviewed on this recovery branch before merging.
