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
- **Handpan** (default) — scale / layout owner, played by the `handpan` voice of the sound library. Ivar's recorded E Amara scale still plays his real recordings.
- **Library voices** — Koto, Harp, Kalimba, Singing Bowl, Breath Flute, Tine Piano, Music Box, Choir, Open-Fifth Drone, Grain Cloud. Each inherits the handpan's current scale and pad layout.

### Modules
| Path | Role |
|------|------|
| `js/instrument.js` | Instrument base + registry |
| `js/gesture.js` | Gesture model + tracker |
| `js/instruments/handpan.js` | HandpanInstrument (scales, layout, expression) |
| `js/instruments/library-family.js` | One Instrument per sound-library voice + shared `SoundLibrary` |
| `js/sound/` | Sound library: `dsp.js`, `voices.js`, `library.js`, `space.js`; see `js/sound/INTEGRATION.md` |
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
