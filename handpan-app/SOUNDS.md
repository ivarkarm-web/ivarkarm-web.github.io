# Handpan App — Recording Guide

The production app currently uses its synthesized voices. Real handpan recordings can be added later through handpan-app/sounds/manifest.json.

## Recording target

Record the same instrument, microphone position, room and gain for every note.

- WAV, mono, 48 kHz, 24-bit PCM preferred.
- Record every playable note used by the selected scale/layout.
- Capture at least 3 useful velocity layers: soft, medium, strong.
- Leave 2–4 seconds of natural decay after the impact.
- Record 3 clean takes per note so the best take can be selected.
- Avoid clipping. Leave sensible headroom rather than normalising aggressively.
- Keep the microphone position fixed and document it.
- Record a short room-tone sample with no playing.

## File naming

Use: <voice-id>/<note-name>--v<velocity>.wav

Example: steel/D3--v1.wav

Velocity values:

- v1 — soft
- v2 — medium
- v3 — strong

The manifest key should match: <voice-id>:<note-name>

Example: steel:D3

## Capture checklist

1. Tune/check the instrument before recording.
2. Disable compressors, limiters and automatic gain on the recorder.
3. Record one note at a time, centred and clean.
4. Do not trim away the attack.
5. Keep the complete natural tail.
6. Remove only obvious handling noise or accidental hits.
7. Do not apply loudness normalisation that changes the envelope.
8. Export the final WAVs without MP3/AAC conversion.
9. Update manifest.json with the selected take.
10. Verify the app falls back to the synthesized voice when a sample is missing.

## Test fixtures

scripts/generate-audio-fixtures.mjs can generate synthetic WAV fixtures for automated tests. These files are explicitly test fixtures, not recordings of the real instrument, and must not be shipped or cached as production sounds.
