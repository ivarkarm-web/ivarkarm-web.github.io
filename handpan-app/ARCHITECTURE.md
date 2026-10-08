# Pionier Architecture (instrument engine)

## Integrated status

The main application (`pionier-app.js`) is wired to the shared systems:

```
Pointer / Touch
    ↓
Gesture (gesture.js)
    ↓
Active Instrument (InstrumentRegistry)
    ↓
instrumentBus
    ↓
FxChain (fx.js)
    ↓
Master → AudioContext destination
```

### Registered instruments
- **Handpan** (default) — sample-bank-first + synth fallback, full scales/root/octave/voices
- **Kitchen** — 5 objects, synthesis placeholders
- **Bird** — 5 calls, hybrid FM/noise placeholders

### Modules
| Path | Role |
|------|------|
| `js/instrument.js` | Instrument base + registry |
| `js/gesture.js` | Gesture model + tracker |
| `js/instruments/handpan.js` | HandpanInstrument |
| `js/instruments/kitchen.js` | KitchenInstrument |
| `js/instruments/bird.js` | BirdInstrument |
| `js/fx.js` | FxChain + modules |
| `js/catch-mode.js` | Catch phase machine + waves |
| `js/debug.js` | `?debug=1` panel |
| `js/sample-metadata.js` | Sample metadata helpers |
| `SOURCES.md` | License ledger |

### Entry points
- App: `handpan-app/pionier-app.js`
- Catch: `?catch=1` starts onboarding ritual
- Debug: `?debug=1` mounts developer panel
- Easter Egg: portfolio `js/easter-egg.js` → `./handpan-app/?from=summit`

### Design rules
- Handpan is flagship, not a special-case blocker
- Gestures are instrument-agnostic
- FX modules are real Web Audio graphs
- Kitchen/Bird placeholders marked in SOURCES.md
- Catch is waves/rings, not Guitar Hero
- Pionier stays independent of portfolio runtime
