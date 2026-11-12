# iOS Safari manual checklist (Pionier)

> **HARD RELEASE GATE:** A production readiness score of 8/10 requires this checklist signed off on a real device for the shipping `APP_VERSION`. CI cannot replace it.

Run on a real iPhone (or iPad) after each release that touches audio, SW, or the welcome gate. GitHub Pages + Playwright cannot replace this pass.

**Build under test:** note `handpan-app/APP_VERSION` / `CACHE_VERSION` in DevTools → Application → Service Workers.

## Setup

1. Open https://ivarkarm-web.github.io/handpan-app/ in Safari (not an in-app browser).
2. Hard-refresh once online so SW can install (`registerSW.js`).
3. Optional: Add to Home Screen and re-open as standalone.

## Audio unlock

- [ ] Tap **Enter Pionier** once — first pad strike produces sound without a second gesture. *(Owner reported app loaded and audio on tap as PASS, but this broader result does not establish this specific assertion — e.g. that the first pad strike produced sound without any second gesture after Enter.)*
- [x] Lock screen briefly, return — audio still works after a pad hit (or recovers after one more Enter if context was suspended). *(Supported: screen lock and return — PASS.)*
- [ ] Headphones / Bluetooth: no stuck silent state after route change.
- [ ] Phone call / app switch during recording: start a recording, take a call or switch apps, then return — recording stops cleanly on interruption and does not capture silence; partial take is preserved.

## Touch & layout

- [ ] Multi-finger chords on the pan do not mute early when one finger lifts. *(Owner reported multitouch as PASS, but this broader result does not establish this specific assertion — e.g. that chords do not mute early when one finger lifts.)*
- [ ] Multi-touch chords with Safari toolbar expanded and collapsed — pan responds and no note cuts out when the toolbar shows/hides.
- [ ] Scale / instrument sheets open, scroll, and close (item, backdrop, or equivalent) with Safari toolbar expanded and collapsed — picker positioning stays correct in both toolbar states.
- [ ] FX panel opens on-screen (not off-screen) with Safari toolbar expanded and collapsed; FX preset picker opens and dismisses correctly in both toolbar states.
- [ ] Looper record button is ≥44px and not clipped by the home indicator.
- [x] Record one layer: tap record, play a phrase, tap stop — layer appears and plays back. *(Supported: master looper — PASS.)*
- [x] Record an overlapping second layer: record layer 1, then record layer 2 over it — both layers play simultaneously and stay in sync. *(Supported: second layer — PASS.)*
- [ ] Undo and clear: remove the last layer, then clear all — layers are removed and the looper returns to empty state.
- [ ] Export and play back: export a WAV, re-open the file, and confirm it plays correctly.
- [ ] Rotate landscape and back — pan stays usable; chrome does not cover pads. *(Owner reported portrait/landscape rotation as PASS, but this does not establish the more specific pan-usability and Safari browser-chrome-clearance assertions. Leave unchecked pending explicit verification.)*

## Offline / PWA

- [ ] After one online visit, enable Airplane Mode → reload — shell + instrument still load.
- [ ] My Library reports available storage and clearly explains that browser data may be cleared.
- [ ] Save a loop, reload, play it, and export a WAV backup.
- [ ] Clear website data and re-open — app recovers to a playable state online.

## Accessibility smoke

- [ ] VoiceOver: Enter, scale pill, instrument name, My Library and looper announce sensible labels.
- [ ] External keyboard: Tab to scale control, open with Enter/Space, Escape closes and returns focus.

## Evidence note (partial, 2026-11-10 v217)

**PARTIAL evidence only — this is NOT complete iOS Safari sign-off.** Only the checklist items above that are directly supported by owner-reported real iPhone testing on 2026-11-10 (APP_VERSION 217 testing period) are marked `[x]`. Owner reported app loading, audio on tap, multitouch, and portrait/landscape rotation as passing; however, these broader results do not by themselves establish the more specific unchecked assertions above (e.g. “Tap **Enter Pionier** once — first pad strike produces sound without a second gesture”, “Multi-finger chords on the pan do not mute early when one finger lifts”, and “Rotate landscape and back — pan stays usable; chrome does not cover pads”), which remain unchecked. Additional owner-reported passes (not mapped to a specific unchecked checklist line above): initial layout fit; individual notes, hold/release, sliding; instrument/scale checks, golden dice/randomizer, delay/reverb/FX; mute/unmute, stop/restart; rain/storm/thunder/birds ambience; all seven looper layers and two-minute combined audio session; app switching and return; page refresh and audio recovery; five-minute idle recovery; navigation and drawer resilience.

**Not verified/reported (leave unchecked):** Bluetooth/headphone route changes; phone-call interruption during recording; Safari toolbar expanded/collapsed behavior; looper record button clipping/size; undo/clear layer behavior; WAV export/reopen; airplane-mode offline reload; My Library storage/persistence/save-reload-WAV; VoiceOver; external keyboard. Android checks remain untouched and unverified. Exact iPhone model, iOS version, and Safari version were **not recorded**.

## Quick Android Chrome pass

Run on a real Android phone using Chrome against the same deployed `APP_VERSION`.

- [ ] Enter Pionier and verify the first pad strike sounds after the first gesture.
- [ ] Play several pads rapidly and play a multi-finger chord; no stuck or prematurely muted notes.
- [ ] Open and close instrument and scale selectors repeatedly; they remain visible and usable.
- [ ] Record, stop, play and clear a loop; toolbar remains aligned and controls stay tappable.
- [ ] Open and close FX and My Library; overlays do not cover or disable the main controls unexpectedly.
- [ ] Rotate the device and return to portrait; controls and pan remain usable.
- [ ] Reload once and confirm the handpan loads without a blank or stuck welcome screen.

Record failures as failures; do not check an item based on desktop emulation.

## Sign-off

> **Partial evidence only — full iOS Safari release sign-off NOT completed.** Do not treat as a complete hard-gate sign-off until all required checklist items are verified and recorded.

| Item | Value |
|------|--------|
| Device / OS + browser | iPhone (exact model not recorded), iOS version not recorded, Safari (version not recorded) |
| APP_VERSION | 217 (testing period) |
| Tester | owner |
| Date | 2026-11-10 |
| Pass / fail notes | **Partial (owner-reported):** 3 checklist items marked supported — lock-screen return, one-layer record/playback, second overlapping layer. Broader passes reported (app load, audio on tap, multitouch, portrait/landscape rotation) do not establish the specific unchecked “Enter/first pad without a second gesture”, “chords do not mute early when one finger lifts”, or rotation pan-usability/Safari browser-chrome-clearance assertions. Additional passes reported (see evidence note): layout, notes/hold/release/sliding, instrument/scale/randomizer/FX, looper mute/unmute/stop-restart, ambience + 7 layers + 2-min combined session, app switch/return, refresh/audio recovery, 5-min idle recovery, navigation/drawer resilience. **Not a full sign-off:** remaining iOS checklist items (including the unchecked specific assertions above, route/call interruption, toolbar states, size/clipping, undo/clear, WAV export, offline/PWA/My Library, a11y smoke) and Android not verified; device/OS/browser versions not recorded. |
