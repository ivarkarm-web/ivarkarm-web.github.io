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

- [x] Multi-finger chords on the pan do not mute early when one finger lifts. *(**OWNER-REPORTED PASS, not independently verified** — live production v217, this conversation, date not recorded: owner stated multi-finger chords work and releasing one finger does not mute remaining notes. Toolbar expanded/collapsed states and other chord conditions not separately verified; see “Multi-touch chords with Safari toolbar expanded and collapsed” below.)*
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

## Evidence addendum (owner-reported, date not recorded, live v217)

**Source:** owner's direct statements in this conversation following tests on the live production app at `https://ivarkarm-web.github.io/handpan-app/` (v217). **Not independently verified.** Device model, iOS version, Safari version, and test date: **not recorded/invented**.

- **OWNER-REPORTED PASS (specific confirmations):** Production app opens and works; handpan notes produce sound; multi-finger chords work; releasing one finger does not mute the remaining notes; portrait and landscape rotation work; looper recording and playback work.
- **OWNER-REPORTED GENERAL CONFIRMATION (broad, non-itemized):** Owner stated that all app functions work. This is not decomposed into individual checklist items and does not establish passes for untested/unreported assertions.
- **Mapping notes:** “Handpan notes produce sound” does not establish “Tap **Enter Pionier** once — first pad strike produces sound without a second gesture.” “Portrait and landscape rotation work” is broad confirmation and does not prove every Safari toolbar/chrome-clearance assertion (the specific rotation checklist item remains unchecked). “Looper recording and playback work” does not prove undo, clear, WAV export/reopen, or persistence. The chord-mute assertion is recorded above as **owner-reported evidence only (not independently verified)**; toolbar expanded/collapsed chord states remain unchecked.

**Full iOS Safari sign-off remains NOT completed. Android real-device testing remains outstanding.**

## Sign-off

> **Partial evidence only — full iOS Safari release sign-off NOT completed.** Do not treat as a complete hard-gate sign-off until all required checklist items are verified and recorded.

| Item | Value |
|------|--------|
| Device / OS + browser | iPhone (exact model not recorded), iOS version not recorded, Safari (version not recorded) |
| APP_VERSION | 217 (testing period; latest owner-reported feedback on live v217, date not recorded) |
| Tester | owner |
| Date | 2026-11-10 (prior documented session); additional owner-reported feedback: date not recorded |
| Pass / fail notes | **Partial (owner-reported):** 4 checklist items marked supported — lock-screen return, **multi-finger chords do not mute early when one finger lifts (OWNER-REPORTED, not independently verified; toolbar states not separately verified)**, one-layer record/playback, second overlapping layer. The existing three formally checked items from 2026-11-10 are preserved. Latest owner-reported confirmations (date not recorded, live v217): app opens/works, notes produce sound, multi-finger chords work, releasing one finger does not mute remaining notes, portrait/landscape rotation works, looper recording/playback works; plus **OWNER-REPORTED GENERAL CONFIRMATION** that all app functions work (non-itemized). Broader confirmations do not establish unchecked specific assertions (Enter/first pad without a second gesture, toolbar expanded/collapsed behaviors, rotation pan-usability/chrome-clearance specifics, route/call interruption, looper size/clipping, undo/clear, WAV export/reopen, offline/PWA/My Library, VoiceOver/external keyboard). **Not a full sign-off.** Android not verified; device/OS/browser versions not recorded. |
