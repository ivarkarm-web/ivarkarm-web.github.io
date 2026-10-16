# Pionier quality baseline

Measured facts only. Nothing is marked DONE without a real run.

## Phase 5 — Release leftovers (2026-10-16)

### Implemented
- SW `pionier-v5`: soft precache of shell URLs with exact `?v=` stamps; install tolerates individual failures; HTML remains network-first; old caches deleted on activate
- Design tokens expanded in `chrome-fix.css` (colour, type, space, radius, motion, z-index)
- Looper / Soundscapes stacking: looper below Soundscapes layer; chrome hidden while `body.soundscapes-active`

### Verified in Chromium tooling this session
- See prior phases for boot, scale menu, pan center, Bedroom Sessions UI, keyboard/a11y

### Still not verified
- True offline reload + play after SW install (network throttle offline)
- iOS Safari audio
- Physical multi-touch
- Sample re-encode of non–E Amara scales
- Full stylesheet consolidation (older CSS files still load)
