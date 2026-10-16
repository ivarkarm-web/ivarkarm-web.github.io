# Pionier architecture

## Runtime graph

```
Pointer / Touch / Keyboard
        ↓
  Gesture tracker (gesture.js)
        ↓
  Active instrument (InstrumentRegistry)
        ↓
  instrumentBus → FxChain → Master → AudioContext
```

## Entry

| File | Role |
|------|------|
| `index.html` | Shell, chrome, Soundscapes panel |
| `pionier-app.js` | Boot, optional modules, scale selector |
| `pionier-core.js` | Audio, surface, instruments, input |
| `js/layout-boot.js` | Viewport chrome, pan centering, bottom bar stack |
| `js/overlay-controller.js` | One open overlay at a time (menus, FX, settings, soundscapes) |
| `js/soundscapes.js` | Bedroom Sessions player only |
| `sw.js` | Network-first HTML; cache-first assets (`CACHE_VERSION`) |

## Bottom control stack

1. **Looper** — record / clear / layers  
2. **Scale row** — scale picker (left) + base note stepper (right)  
3. **Instrument row** — instrument picker (left) + note count (right)

Menus portal to `document.body` and use bottom sheets on narrow/touch viewports.

## Instruments

- **Handpan** — default; scales + pad layout owner; recorded samples when present  
- **Library voices** — Koto, Harp, Kalimba, etc. (inherit current scale/layout)  
- **Synth / ambient family** — additional registered voices  

## Design system

Tokens live in `pionier.css` (`--pionier-z-*`, `--gold`, etc.). Prefer tokens over new `!important` rules. `atelier.css` adds glass finish on shared surfaces.

## Soft failure

Boot states: `loading` → `ready` | `degraded` | `failed` via `#appStatus`. Optional modules fail soft without blocking the instrument.
