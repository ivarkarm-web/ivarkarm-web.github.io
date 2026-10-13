# Audio Asset Inventory and Licensing

**Last audited:** 2026-10-13  
**Scope:** audio files and generated audio used by Pionier in this repository.

## Current shipped audio

### Owner-recorded handpan prototype (2026-10-13)

Owner attestation. The nine handpan one-shots (D3–A4) were recorded by Ivar Karm and mixed in GarageBand using only its built-in effects (EQ, compression, reverb). No Apple Loops, Apple sampled instruments, third-party samples, loops or impulse responses are included. Ivar Karm holds all rights and permits embedding and distribution in this app.

Ring-outs in this prototype pass are truncated (~0.7s sequential takes). Synth fallback remains if a file is missing or fails to decode.

**Third-party plugin / impulse response / preset:** (none)

| File | Note | MIDI | SHA-256 | Creator | License | Commercial / redistribute |
|---|---|---:|---|---|---|---|
| `handpan-app/sounds/notes/owner-notes-9/D3_v1.wav` | D3 | 50 | `de2ac49f37683ff45b3cea73bc060522ac2834c22f2229e2c9cf20ab98028772` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/A3_v1.wav` | A3 | 57 | `38fc0aa1db8ecc4986cd22d4efa15efe72882b485f0a28ee8e5be819b9c38005` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/Bb3_v1.wav` | Bb3 | 58 | `26ca1e18ed9fc3abdcf36453cbd13edb58c3518c8e540eeb9425285a423039d0` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/C4_v1.wav` | C4 | 60 | `3d584969328a84dfc23b378753d078d09a9263031265e3c3186cac7dcffcf3de` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/D4_v1.wav` | D4 | 62 | `0a44d9352a901154f764c11c538c62e4c2c7e1388ee2ae07605b5bb7c6273d97` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/E4_v1.wav` | E4 | 64 | `5b66436b328ad3fe6502eac54c72ed694423e644cc3860683fb604ba26cbe2a2` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/F4_v1.wav` | F4 | 65 | `5b16cf19f0d366d10db43c253f04dc571c0585941875db92ae714f6e2ca10e9c` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/G4_v1.wav` | G4 | 67 | `56899e2f7eb69a857d1d703b0ddac19631497256b961454c50b7d4a089e75c60` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |
| `handpan-app/sounds/notes/owner-notes-9/A4_v1.wav` | A4 | 69 | `f4b87fb409768b906d7a7c0bbc7c646710d0ebb3970335adb553b06778aae6c0` | Ivar Karm (owner recording) | Original; owner grants embed in this public app | Yes |

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
