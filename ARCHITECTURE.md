# Architecture – Ivar Karm Resonance

## Overview

The site is a static, GitHub-Pages-compatible interactive artist portfolio.
The core experience is a 2D Canvas “acoustic journey” overlaid on semantic HTML content sections.

No heavy framework is required at runtime. A thin Vite config exists only for local development.

## Module map

| File | Responsibility |
|------|----------------|
| `js/utilities.js` | Pure helpers (PRNG, noise, biome, haptics) |
| `js/core.js` | Lifecycle, capability detection, performance modes |
| `js/content.js` | World data, stones, sections, vegetation builders, ground heights |
| `js/audio.js` | ResonanceAudio physical model + analyser bands |
| `js/physics.js` | Ball state, dash, keys, camera flags |
| `js/scenes.js` | All Canvas drawing + world update logic |
| `js/ui.js` | Modality, touch, music/video drawers, rabbit-hole |
| `js/engine.js` | Documentation placeholder for future pure engine entry |
| `js/analytics.js` | Lightweight non-blocking event queue |
| `script.js` | Thin engine: canvas setup, resize, draw orchestration, RAF loop |

## Load order

Deferred scripts in dependency order (see `index.html`).

## Performance modes

`AppCore` selects `high` | `balanced` | `low` from device memory, cores, `saveData`, connection type, and `prefers-reduced-motion`.

Settings control DPR cap, vegetation density scale, particle limits, and complex foliage.

## Audio reactivity

`ResonanceAudio.updateBands()` produces smoothed `{ bass, mid, high, amplitude }` (0–1).
Visual systems (e.g. starfield) read these values for subtle “breathing” — never a hard equalizer.

## State

Shared mutable state is still used for the Canvas simulation (intentional for sequential-script simplicity on GitHub Pages).
Future work can encapsulate it behind a single `GameState` object and migrate to native ES modules.

## Content vs presentation

Narrative text lives primarily in `index.html` (crawlable).
World coordinates, stones, and vegetation data live in `js/content.js`.

## Additional scene modules

| File | Responsibility |
|------|----------------|
| `js/scenes-effects.js` | Starfield, atmosphere bands, horizon lights, world particles |
| `js/scenes.js` | Botanical models, terrain, landmarks, camera, section update, ball drawing |

Load order places `scenes-effects.js` before `scenes.js`.

## Hidden Handpan (easter egg)

| File | Responsibility |
|------|----------------|
| `js/easter-egg.js` | Reads `x`, `gameStarted`, `leftSecretState` (read-only). At the left-hill summit shows "Easter egg found!", then a "Play Me" button; on click freezes all main-site audio and teleports to `handpan.html` |
| `easter-egg.css` | Notice typography, reuse of `.welcome-enter` for the button, iris / ring / spark transition |
| `handpan.html` | Standalone page (noindex, not in sitemap) |
| `handpan.css` | Dark atmosphere, tokens mirrored from `styles.css`, `touch-action: none` overrides |
| `js/handpan.js` | Own `AudioContext` (polyphonic synth: partials + strike noise + procedural reverb), E Kurd 13-note layout, keyboard (no key-repeat) and multi-touch pointers, particle / ripple backdrop |

The main site and the Handpan never share an `AudioContext`. The road suspends its context (and pauses any music / orb / preview audio) before navigating; if the browser restores the road from the back/forward cache it resumes them.

Notes: `q` E3 · `w` B3 · `e` D4 · `r` E4 · `t` F♯4 · `y` G4 · `u` A4 · `i` B4 · `o` D5 · `p` E5 · `a` F♯5 · `s` G5 · `d` B5.
