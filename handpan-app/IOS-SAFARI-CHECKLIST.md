# iOS Safari manual checklist (Pionier)

> **HARD RELEASE GATE:** A production readiness score of 8/10 requires this checklist signed off on a real device for the shipping `APP_VERSION`. CI cannot replace it.

Run on a real iPhone (or iPad) after each release that touches audio, SW, or the welcome gate. GitHub Pages + Playwright cannot replace this pass.

**Build under test:** note `handpan-app/APP_VERSION` / `CACHE_VERSION` in DevTools → Application → Service Workers.

## Setup

1. Open https://ivarkarm-web.github.io/handpan-app/ in Safari (not an in-app browser).
2. Hard-refresh once online so SW can install (`registerSW.js`).
3. Optional: Add to Home Screen and re-open as standalone.

## Audio unlock

- [ ] Tap **Enter Pionier** once — first pad strike produces sound without a second gesture.
- [ ] Lock screen briefly, return — audio still works after a pad hit (or recovers after one more Enter if context was suspended).
- [ ] Headphones / Bluetooth: no stuck silent state after route change.
- [ ] Phone call / app switch during recording: start a recording, take a call or switch apps, then return — recording stops cleanly on interruption and does not capture silence; partial take is preserved.

## Touch & layout

- [ ] Multi-finger chords on the pan do not mute early when one finger lifts.
- [ ] Multi-touch chords with Safari toolbar expanded and collapsed — pan responds and no note cuts out when the toolbar shows/hides.
- [ ] Scale / instrument sheets open, scroll, and close (item, backdrop, or equivalent) with Safari toolbar expanded and collapsed — picker positioning stays correct in both toolbar states.
- [ ] FX panel opens on-screen (not off-screen) with Safari toolbar expanded and collapsed; FX preset picker opens and dismisses correctly in both toolbar states.
- [ ] Looper record button is ≥44px and not clipped by the home indicator.
- [ ] Record one layer: tap record, play a phrase, tap stop — layer appears and plays back.
- [ ] Record an overlapping second layer: record layer 1, then record layer 2 over it — both layers play simultaneously and stay in sync.
- [ ] Undo and clear: remove the last layer, then clear all — layers are removed and the looper returns to empty state.
- [ ] Export and play back: export a WAV, re-open the file, and confirm it plays correctly.
- [ ] Rotate landscape and back — pan stays usable; chrome does not cover pads.

## Offline / PWA

- [ ] After one online visit, enable Airplane Mode → reload — shell + instrument still load.
- [ ] My Library reports available storage and clearly explains that browser data may be cleared.
- [ ] Save a loop, reload, play it, and export a WAV backup.
- [ ] Clear website data and re-open — app recovers to a playable state online.

## Accessibility smoke

- [ ] VoiceOver: Enter, scale pill, instrument name, My Library and looper announce sensible labels.
- [ ] External keyboard: Tab to scale control, open with Enter/Space, Escape closes and returns focus.

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

| Item | Value |
|------|--------|
| Device / OS + browser | |
| APP_VERSION | |
| Tester | |
| Date | |
| Pass / fail notes | |
