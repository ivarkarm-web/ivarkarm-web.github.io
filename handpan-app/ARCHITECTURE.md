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
| `js/layout-boot.js` | Viewport chrome, pan centering, bottom bar |
| `js/soundscapes.js` | Bedroom Sessions player only |
| `sw.js` | Network-first HTML; cache-first assets (`CACHE_VERSION`) |
| `chrome-fix.css` | Late chrome / a11y / player styles |

## Instruments

- **Handpan** — default; scales + pad layout owner; E Amara samples when present
- **Library voices** — Koto, Harp, Kalimba, etc. (inherit current scale/layout)
- **Synth ambient family** — additional registered voices

Bird / kitten instruments are removed.

## Design system notes

Tokens in `chrome-fix.css` (`--pionier-z-*`, `--pionier-tap`). Older sheets (`pionier.css`, `atelier.css`, `ui-layout-extras.css`, …) still load; consolidation is ongoing. Prefer tokens over new `!important` rules.

## Soft failure

Boot states: `loading` → `ready` | `degraded` | `failed` via `#appStatus`. Optional modules fail soft without blocking the instrument.
