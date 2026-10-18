# Pionier — samples needed

Last updated: 2026-10-18.

## Rules

Use only Ivar's own recordings or audio with documented license and commercial-use permission. Do not download or synthesize substitute samples for shipping. Keep the natural attack and decay; avoid chopping a recording into short artificial fragments. Synthesized voices remain the fallback where a clean sample is unavailable.

## Existing source of truth

- `handpan-app/SOUNDS.md` describes preferred capture format: mono WAV, 48 kHz, 24-bit PCM, natural decay, no clipping, three useful velocity layers, three takes per note.
- `handpan-app/SOURCES.md` identifies owner-recorded E Amara notes under `sounds/notes/` and `sounds/notes/manifest.json`.
- Verify actual repository manifest and files before treating any pitch/name as correct. Some previously uploaded filenames were reported by the owner as potentially incorrect; do not infer pitch solely from a filename.
- The owner has described nine one-shot recordings spanning D3–A4 and per-scale WAVs. Actual note coverage and tuning must be measured before finalizing the gap list.

## Record or verify

1. **Inventory first:** enumerate every audio file in `sounds/notes/`, read the manifest, and measure duration, peak/RMS, sample rate and pitch center. Flag duplicate pitch labels, missing manifest entries, clipping, noise, and recordings whose measured pitch disagrees with the filename.
2. **Per-note coverage:** for each of the 9 original handpan voices/scales, compare the playable pad pitches against verified clean samples. Record only missing playable pitches; do not assume every scale needs a separate recording if pitch-mapped samples are musically acceptable.
3. **Velocity variation:** for every important sampled pitch where recording time permits, capture soft, medium and strong attacks, with three takes per velocity. If only one take exists, document that limitation and use a conservative velocity response instead of inventing layers.
4. **Tails and loopability:** preserve at least 2–4 seconds of decay where the instrument naturally provides it. Prefer natural decay or tested short crossfaded loops; never force a loop point into the audible attack.
5. **Calibration references:** record a clean tuning reference / room tone and note the instrument's measured pitch standard, microphone position, recorder gain and room. Avoid automatic gain, compression and aggressive normalization.

## Capture checklist per recording session

- [ ] Instrument tuning checked and documented.
- [ ] Fixed microphone placement and gain; no clipping.
- [ ] One centered, isolated strike per take; attack retained.
- [ ] Natural decay captured.
- [ ] Three takes and velocity labels recorded where feasible.
- [ ] File name and manifest entry match verified pitch.
- [ ] Listen-test on headphones and on a phone speaker.
- [ ] Verify sample fallback and note release in the app.

## Current exact missing-note list

**Not yet determined.** It would be unsafe to list exact missing pitches until the current manifest and audio files are measured and the questionable filenames are resolved. The next sample-audit task is to generate a measured inventory, then list only missing notes by instrument and scale here.
