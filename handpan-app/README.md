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
