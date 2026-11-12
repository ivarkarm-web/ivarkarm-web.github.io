# Pionier real-device checklist

Emulation (Playwright Chromium) is not a substitute for these rows. Record date, device, OS/browser, pass/fail, notes.

| Date | Device | OS | Browser | Strike / multi-touch | Scale / instrument switch | Looper | My Library save/reload/WAV | Offline reload | PWA install | Notes |
|------|--------|----|---------|----------------------|---------------------------|--------|---------------------------|----------------|-------------|-------|
| 2026-11-10 | iPhone (model not recorded) | Not recorded | Safari (version not recorded) | PASS | PASS | PASS | NOT TESTED / NOT RECORDED | NOT TESTED / NOT RECORDED | NOT TESTED / NOT RECORDED | Owner-reported v217 (partial). Confirmed: app load, first audio on tap, layout fit; individual notes, hold/release, sliding, multitouch; instrument/scale switching, golden dice/randomizer, delay/reverb/FX; looper master/2nd layer, mute/unmute, stop/restart; rain/storm/thunder/birds ambience, all seven looper layers, two-minute combined audio session; portrait/landscape rotation, screen lock and return, app switch and return, page refresh and audio recovery, five-minute idle recovery, navigation/drawer resilience. Not tested/recorded: WAV export/playback, My Library save/reload/persistence, offline airplane-mode reload, PWA install/standalone, Bluetooth/route changes, call interruption, toolbar states, VoiceOver, external keyboard. Not full iOS sign-off. |
|      | Android phone | | Chrome |                |                           |        |                           |                |             |       |
|      | iPad / tablet | |        |                |                           |        |                           |                |             |       |
|      | Desktop |    | Safari / Firefox / Chrome | |                     |        |                           |                | n/a         |       |

## Minimum pass criteria
- Audio unlocks on first gesture
- No stuck notes after multitouch
- Instrument switch recovers on failure (stays on previous)
- Looper can record and clear at least one layer
- Saved composition remains after reload and its WAV export opens in an audio player
