# iOS Safari manual checklist (Pionier)

> **HARD RELEASE GATE:** A production readiness score of 8/10 requires this checklist signed off on a real device for the shipping `APP_VERSION`. CI cannot replace it.

Run on a real iPhone (or iPad) after each release that touches audio, SW, or the welcome gate. GitHub Pages + Playwright cannot replace this pass.

**Build under test:** `APP_VERSION` 167 / `CACHE_VERSION` `pionier-v167` (verify the live service worker before testing).

## Setup

1. Open https://ivarkarm-web.github.io/handpan-app/ in Safari (not an in-app browser).
2. Hard-refresh once online so SW can install (`registerSW.js`).
3. Optional: Add to Home Screen and re-open as standalone.

## Audio unlock

- [ ] Tap **Enter Pionier** once — first pad strike produces sound without a second gesture.
- [ ] Lock screen briefly, return — audio still works after a pad hit (or recovers after one more Enter if context was suspended).
- [ ] Headphones / Bluetooth: no stuck silent state after route change.

## Touch & layout

- [ ] Multi-finger chords on the pan do not mute early when one finger lifts.
- [ ] Scale / instrument sheets open, scroll, and close (item, backdrop, or equivalent).
- [ ] Looper record button is ≥44px and not clipped by the home indicator.
- [ ] Rotate landscape and back — pan stays usable; chrome does not cover pads.

## Offline / PWA

- [ ] After one online visit, enable Airplane Mode → reload — shell + instrument still load.
- [ ] Soundscapes show a clear network error offline (expected; archive.org tracks need network).
- [ ] Clear website data and re-open — app recovers to a playable state online.

## Accessibility smoke

- [ ] VoiceOver: Enter, scale pill, instrument name, soundscapes, looper announce sensible labels.
- [ ] External keyboard: Tab to scale control, open with Enter/Space, Escape closes and returns focus.

## Sign-off

| Item | Value |
|------|--------|
| Device / iOS | |
| APP_VERSION | |
| Tester | |
| Date | |
| Pass / fail notes | |

## Android Chrome quick pass (separate device)

Do not sign this section from desktop emulation. On a real Android phone, use current Chrome and repeat: first-tap audio unlock, multi-finger pad strikes, scale/instrument picker open-close, record/stop/playback, portrait safe-area layout, reload after service-worker update, and TalkBack labels.

