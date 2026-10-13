# Pionier sound library — integration

Drop this folder in as `handpan-app/js/sound/`. Open `preview.html` (on GitHub Pages: `/handpan-app/js/sound/preview.html`) to listen before touching anything else.

## What's in it

| File | Role |
|------|------|
| `dsp.js` | Pure DSP: modal synth, tuned delay loop (plucks, blown tubes), filters, crush, reverb IR |
| `voices.js` | 11 voices: handpan, koto, harp, kalimba, singing bowl, breath flute, tine piano, music box, choir, open-fifth drone, grain cloud |
| `library.js` | `renderNote()` (pure) + `SoundLibrary` (cache, velocity layers, playback) |
| `space.js` | One shared reverb + ping-pong delay that every voice sends into |
| `render-voices.mjs` | `node render-voices.mjs out/` → WAVs + audit table (tuning, loudness, NaN) |

## Design rules

- **Frequency in, sound out.** Voices take any Hz value, so the scale system only has to compute frequencies (cents from root). No per-scale sample sets, so microtonal scales work.
- **Cohesion by measurement, not by hand-tuned gains.** `renderNote()` scales every note so its loudest 1.5 s sits at -21 dBFS RMS, with a gentle bass lift below 220 Hz and a soft limiter on transients. Last audit: every voice × (110, 261.63, 880 Hz) within ±0.5 dB of target, pitch within 10 cents, no NaNs.
- **One room.** Voices have no effects of their own, only send levels (`voice.send`). `lib.setSpace({ reverb, delay, feedback, time, tone })` changes the room for all of them.

## How the app uses it

- `js/instruments/library-family.js` creates one `LibraryInstrument` per voice and owns the shared `SoundLibrary` (`getSoundLibrary(ctx, bus)`).
- `js/instruments/handpan.js` plays the `handpan` voice through the same library. Its scale, root, octave and note-count logic only produce frequencies. The E Amara recorded scale still uses its real samples, loaded on demand.
- `pionier-core.js` registers the handpan plus `createLibraryInstruments()`.
- Pressure maps to live level, vertical drag to pitch bend (±2 semitones), pad position to stereo pan. Bowl, breath, choir, drone and cloud sustain while the finger is down and fade on release.
- Moving between pads re-strikes instead of sliding, since notes are pre-rendered.

Removed: `voice-presets.js`, `instruments/tonal-family.js`, the oscillator synth fallback, and per-scale sample loading for the synthesised scales. The chopped per-scale WAVs in `sounds/notes/` are still in the repo (untouched) and can be deleted once you're sure you don't want them.

## Known limits

- Notes are pre-rendered, fixed length (3–7.5 s tails). Pads and drones do not sustain indefinitely while a key is held; `stop()` fades them.
- Pads (choir, drone, cloud) take ~0.1–0.4 s to render in Node, probably longer on older phones. Use `prewarm()` for the notes of the selected scale.
- Cache is capped at 96 MB by default (`new SoundLibrary(ctx, out, { maxCacheMB })`).
- Tuning and levels are measured; how it sounds is a matter of taste. Listen in `preview.html` and rework any voice that feels off.
