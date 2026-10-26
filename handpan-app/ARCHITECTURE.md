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
| `pionier-core.js` / `pionier-core-base.js` | Audio, surface, instruments, input |
| `js/layout-boot.js` | Viewport chrome, pan centering, bottom bar stack |
| `js/overlay-controller.js` | One open overlay at a time (menus, FX, settings, soundscapes) |
| `js/soundscapes.js` | Bedroom Sessions player only |
| `sw.js` | Network-first HTML; cache-first assets (`CACHE_VERSION`) |

## Stylesheets (linked from `index.html`)

| File | Role |
|------|------|
| `pionier-base.css` | Tokens, base chrome, stage, welcome (~173 KB raw) |
| `pionier-controls.css` | Controls, steppers, FX panel |
| `css-parts/layout-*.css` | Dock, looper toolbar, pickers, themes (linked in parallel) |
| `css-parts/ambient-*.css` | Soundscapes / ambient UI (linked in parallel) |

**No sequential `@import` chain.** Layout and ambient rules ship as individual `<link>` tags under `css-parts/` so the browser can fetch them in parallel, PurgeCSS/esbuild sees every rule, and a truncated single part cannot silently drop the whole toolbar. The former `pionier-layout.css` / `pionier-ambient.css` shells are deprecated stubs.

CI runs `npm run optimize:handpan-css` (PurgeCSS + esbuild minify) before tests and Pages deploy. Budget: **strictly under 250,000 bytes** total for linked stylesheets after optimization. Raw source is larger; do not treat raw size as the shipping budget.

The cascade still relies on many `!important` declarations (legacy mobile overrides). Prefer tokens and lower-specificity rules for new work; do not add new `!important` without a documented override reason.

## Bottom control stack

1. **Looper** — record / clear / layers  
2. **Scale row** — scale picker (left) + base note stepper (right)  
3. **Instrument row** — instrument picker (left) + note count (right)

Menus portal to `document.body` and use bottom sheets on narrow/touch viewports.

## Instruments

- **Handpan** — default; scales + pad layout owner; recorded samples when present  
- **Library voices** — Koto, Harp, Kalimba, etc. (inherit current scale/layout)  
- **Synth / ambient family** — additional registered voices  

## State and buses

- `js/app-state.js` — instrument / scale / root / noteCount / ambient / loop (persist + subscribe)
- `instrumentBus` → FxChain → master (looper records pre-FX via `getInstrumentBus`)
- `ambientBus` → master only (`getAmbientBus`); Bedroom Sessions stay off the instrument FX path
- Instrument `engineKind`: `sample` (handpan) vs `procedural` (library family)

## Looper capture

Looper recording uses **AudioWorklet** (`js/looper-recorder-worklet.js` + `AudioWorkletNode` in `js/looper.js`). There is **no** remaining `ScriptProcessorNode` usage in source. Browsers without AudioWorklet surface a clear error rather than a silent fallback.

## Soft failure

Boot states: `loading` → `ready` | `degraded` | `failed` via `#appStatus`. Optional modules fail soft without blocking the instrument.

## Non-product surface

- **Learn mode** — removed.
- **Catch mode** (`js/catch-mode.js`) — still imported by `pionier-core-base.js` for historical strike wiring; **not** a product UI. Do not re-surface without a deliberate product decision.
- **Mandala / multi-skin** — decorative mandala path is retired; `skin-palette.js` remains for the neutral dark/light handpan finish used by the canvas.

## Prefs

Instrument/scale/root live in `js/app-state.js`; theme / high-contrast / coach dismissal live in settings + localStorage keys (`pionier.settings.v2`, `pionier.coach.v1`). Prefer migrating new prefs into app-state subscribers.

## Device verification

Automated CI covers Chromium emulation (mobile + desktop Playwright projects). **Physical iOS Safari and Android Chrome remain owner-gated** and are the largest remaining release gap. See `IOS-SAFARI-CHECKLIST.md` and `docs/DEVICE-CHECKLIST.md`.
