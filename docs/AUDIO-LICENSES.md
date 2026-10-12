# Audio Asset Inventory and Licensing

**Last audited:** 2026-10-13  
**Scope:** audio files and generated audio used by Pionier in this repository.

## Current shipped audio

### Owner-recorded handpan prototype (2026-10-13)

Source session: owner WAV recorded by **Ivar Karm** (`handpan settings - 13.10.2026, 02.28.wav`). Nine one-shots cut from an ascending pass (D Kurd layout). Ring-outs are truncated (~0.7s). **Prototype quality only** — replace with isolated full-decay takes when available. Synth fallback remains if a file is missing or fails to decode.

| File | Note | MIDI | Creator | License | Commercial / redistribute |
|---|---|---:|---|---|---|
| `handpan-app/sounds/notes/D3_v1.wav` | D3 | 50 | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/A3_v1.wav` | A3 | 57 | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/Bb3_v1.wav` | Bb3 | 58 | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/C4_v1.wav` | C4 | 60 | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/D4_v1.wav` | D4 | 62 | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/E4_v1.wav` | E4 | 64 | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/F4_v1.wav` | F4 | 65 | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/G4_v1.wav` | G4 | 67 | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/A4_v1.wav` | A4 | 69 | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |

Ambient beds remain procedural (no external recording files).

Do not add a downloaded third-party sound until source, creator, license, commercial-use, redistribution, and attribution are recorded here.

## Removed sample files — provenance record

Prior Haganenote-attributed MP3s were removed because redistribution rights were not established. See repository history and prior audit notes. Those files remain **not cleared**.

Source references (historical):
- Upstream project: https://github.com/haganenote/virtual-handpan
- Official virtual instrument: https://www.haganenote.com/vst/handpan-virtual-instrument.html

## Procedural audio

| Engine / sound | Source / author | License | Commercial use | Notes |
|---|---|---|---|---|
| Handpan fallback synthesis | Original code in this repository; Ivar Karm project | No external audio asset | No third-party recording is bundled | Synthetic approximation; not equivalent to a real recorded handpan |
| Backdrop ambient beds | Original Web Audio synthesis in `handpan-app/js/backdrop-player.js` | No external audio asset | No third-party recording is bundled | Procedural beds; generated noise loops use eased boundaries |

## Release blockers and options

- **Realistic handpan recordings:** owner prototype nine-note bank documented (truncated tails). Production path: re-record isolated full ring-outs. Haganenote files still not cleared.
- **External ambient beds:** prefer procedural or CC0 with full license text retained here.
