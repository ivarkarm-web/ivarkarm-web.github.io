# Handpan App — Prototype

This branch is the isolated development space for the future standalone handpan instrument app.

## Product direction

The handpan Easter egg on the Ivar Karm website is the **prototype**, not the final architecture. The website should remain stable while this branch becomes the laboratory for the instrument.

The future app combines:

- playable virtual handpan
- multiple scales / tunings
- Guitar-Hero-style guided learning
- lessons and note-by-note tutorials
- recording and looping
- overdub layers
- ambient landscape / generative modes
- scale-aware pattern suggestions
- effects and spatial sound
- performance mode
- touch, mouse and keyboard input
- eventually saved compositions / presets


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

5. **Learning system**
   - lessons
   - note sequences
   - visual timing cues
   - progressive difficulty
   - scoring / accuracy

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

Then build **Learn Mode** and **Ambient Mode** on top of the same audio/instrument core.


## Sound architecture

The app ships with five synthesized voices: Steel, Warm, Bell, Soft, and Deep. Voice selection accepts the previous preset names/indices and maps them to the new set so existing saved selections can migrate safely.

Real recordings are supported behind the same voice interface through `sounds/manifest.json` and `js/sample-bank.js`. The production manifest currently contains no samples, so the synthesized voice remains the authoritative fallback. Real recordings should follow `SOUNDS.md`.

Synthetic WAV fixtures can be generated with `node scripts/generate-audio-fixtures.mjs`. The fixture directory is ignored by Git and is never a production sound asset.
