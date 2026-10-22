# iOS Safari manual checklist (Pionier)

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
