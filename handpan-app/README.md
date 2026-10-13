# PIONIER — Music-making instrument prototype

This branch is the isolated development space for the future standalone handpan instrument app.

## Product direction

PIONIER is a pocket-sized, touch-responsive music-making instrument inspired by expressive experimental instruments. It is not a handpan clone, rhythm game, or guided-learning app.

Priorities, in order:

1. Reliable, centered, responsive instrument surface.
2. Reliable audio engine and clear ownership of the active instrument/audio path.
3. Musical multi-layer looper with stable synchronization, overdub, mute, undo/delete and clear.
4. Focused, high-quality effects workflow.
5. A small family of distinctive touch-responsive instruments, only after the foundation is reliable.

Learning mechanics, lesson scoring, unlocks, and game modes are out of the main product scope. Do not add new features while stabilizing the existing system.

## Recovery guardrails

- Work on a dedicated recovery branch; never make speculative cleanup directly on `main`.
- Do not delete legacy files until runtime references and history have been checked.
- Keep the website Easter egg and its entry point untouched while working in `handpan-app/`.
- Make one narrow change at a time and verify it before proceeding.
- Do not claim device/browser verification unless it has actually been run on the target device/browser.

## Scale system (9-note dynamic)

The instrument uses **interval-based scales** rather than hardcoded note names:

- Exactly **9 physical pads**: 1 central Ding + 8 surrounding notes in a fluid radial circle
- **10 world scales** defined as semitone intervals relative to the Ding
- **Dynamic transposition**: `baseMidi` (chromatic root) + `octaveOffset` (−1 / 0 / +1)
- Final MIDI: `baseMidi + scale.intervals[i] + (octaveOffset * 12)`
- Changing root or octave remaps all pads instantly without interrupting active voices or loops

### Transposition UI element IDs

Wire these controls in the shell (buttons optional — API is always available on `HandpanGame`):

| Element ID | Action |
|------------|--------|
| `hpRootDown` / `hpRootUp` | Chromatic Ding −1 / +1 |
| `hpOctaveDown` / `hpOctaveUp` | Octave −1 / +1 |
| `hpRootNote` | Displays current root name |
| `hpOctaveLabel` | Displays octave offset |

API: `HandpanGame.shiftRoot(delta)`, `HandpanGame.shiftOctave(delta)`, `HandpanGame.currentRootName()`

## Existing prototype nucleus

The current website instrument already provides a strong base:

- `handpan.html` — isolated instrument page
- `handpan.css` — isolated visual system
- `js/handpan.js` — self-contained instrument engine
- Web Audio synthesis
- polyphonic playing
- 9 scales with 13 notes
- multi-touch
- keyboard input
- animated steel instrument
- particles, ripples and note feedback
- scale switching

The website's `js/easter-egg.js` should remain only the **doorway** into the preview. It should not become the app engine.

## Target architecture

The future standalone app should separate:

1. **Audio engine**
   - note voices
   - envelopes
   - synthesis / samples
   - effects
   - master bus
   - analyser
   - timing / transport

2. **Instrument model**
   - handpan layouts
   - note definitions
   - tunings / scales
   - note positions
   - alternate instruments

3. **Input layer**
   - touch
   - mouse
   - keyboard
   - MIDI later

4. **Sequencer**
   - clock
   - events
   - quantisation
   - patterns
   - looping
   - overdubbing

6. **Ambient system**
   - scale-constrained generators
   - drones
   - textures
   - evolving patterns
   - generative landscapes

7. **UI / presentation**
   - instrument
   - transport
   - modes
   - library
   - tutorials
   - presets

The core should be reusable by both the standalone app and, where useful, the website Easter egg.

## Development rule

**Do not modify the website's main experience while experimenting here.**

Changes should be developed on this branch first. Only deliberately selected improvements should ever be ported back into the website preview.

## First product milestone

Turn the existing playable handpan into a proper **Play Mode** with:

- clean transport bar
- scale/tuning browser
- octave / layout information
- volume and ambience controls
- visual metronome
- record button
- loop capture
- undo/clear
- layered playback

Only add further production features after the instrument, looper, and effects have passed real-device regression checks.


## Sound architecture

The app ships with five synthesized voices: Steel, Warm, Bell, Soft, and Deep. Voice selection accepts the previous preset names/indices and maps them to the new set so existing saved selections can migrate safely.

The active handpan instrument uses `js/note-sample-bank.js` and loads the per-scale recordings from `sounds/notes/manifest.json`, with procedural synthesis as fallback when a matching sample is unavailable. The separate `js/sample-bank.js` is part of the legacy bundled engine and expects a different manifest schema; do not confuse it with the active runtime path.

Synthetic WAV fixtures can be generated with `node scripts/generate-audio-fixtures.mjs`. The fixture directory is ignored by Git and is never a production sound asset.
