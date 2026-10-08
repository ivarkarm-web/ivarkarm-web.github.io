# Pionier Architecture (instrument engine branch)

## Status

Branch: `pionier-instrument-engine`

This branch introduces a shared instrument + gesture + modular FX foundation while preserving the existing playable handpan experience.

## Modules

| Path | Role |
|------|------|
| `js/instrument.js` | Instrument base class + InstrumentRegistry |
| `js/gesture.js` | Gesture model + GestureTracker + gestureFromPointer |
| `js/instruments/handpan.js` | Handpan as Instrument (scales, samples, synth fallback) |
| `js/instruments/kitchen.js` | Kitchen World Instrument (synth placeholder) |
| `js/instruments/bird.js` | Bird World Instrument (hybrid synth placeholder) |
| `js/fx.js` | Modular FX modules + FxChain (comp/delay/reverb + warmth/lowpass/chorus) |
| `js/catch-mode.js` | Catch ritual + wave-based scale sequence |
| `js/debug.js` | `?debug=1` developer panel |
| `js/sample-metadata.js` | Traceable sample metadata helpers |
| `SOURCES.md` | Human-readable license / source ledger |

## Design rules

- Handpan is the flagship implementation of Instrument, not a special case that blocks others.
- Gestures are instrument-agnostic; instruments interpret them.
- FX modules are real Web Audio graphs, not cosmetic UI.
- Kitchen / Bird currently use synthesis placeholders clearly marked in SOURCES.md.
- Catch is not Guitar Hero — waves/rings, scale-driven, setup ritual first.
- Pionier stays independent of the portfolio runtime.

## Next integration steps

1. Wire `pionier-app.js` to InstrumentRegistry + GestureTracker + FxChain.
2. Add instrument selector UI (Handpan / Kitchen / Bird).
3. Route canvas hit-testing through the active instrument's zones.
4. Render Catch waves on the canvas.
5. Mount debug panel when `?debug=1`.
6. Regression-test existing handpan sample + synth paths.

## Compatibility

Existing files (`audio-core.js`, `note-sample-bank.js`, `voice-presets.js`, canvas UI) remain the foundation. New modules import them; they do not replace the audio graph wholesale.
