# Pionier quality baseline

Measured facts only. Nothing is marked DONE without a real run.

## Phase 0–3 (prior)

- Core boots; instrument ready
- Scale menu opens with 15 items
- Pan viewport-centered
- CONTROLS empty toggle hidden
- Root / note count in bottom bar
- Bedroom Sessions panel: 8-track queue, MP3 from archive.org loads (`readyState` 4)
- SW: network-first HTML, `CACHE_VERSION` pionier-v4+

## Phase 4 — Hardening (2026-10-16)

### Implemented in code
- Keyboard pads: `1`–`9` / `Q`–`O`, hold/release, ignores typing in inputs
- Audio: resume on `visibilitychange` (visible), `pageshow`, `focus`; suspend when hidden
- Canvas: `tabindex="0"`, richer `aria-label`, `:focus-visible`
- `prefers-reduced-motion` hard cut in chrome-fix
- Docs: README / ARCHITECTURE / SOURCES rewritten to match product (no Learn, no uploads, no generative ambience)

### Browser-verified this session
- Boot + scale menu + bottom bar + Soundscapes open/close (Chromium tooling)
- Archive.org MP3 CORS `*` + Accept-Ranges

### Not verified here
- Real-device iOS Safari unlock / interruption / lock screen
- 5-pointer multi-touch on physical hardware
- 10-minute memory profile
- Full WCAG audit with a screen reader
- Start-to-finish playback of all 8 tracks with audible output (headless autoplay policy)
