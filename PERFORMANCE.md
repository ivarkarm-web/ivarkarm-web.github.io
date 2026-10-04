# Performance Guide

## Modes

| Mode | When chosen | DPR cap | Notes |
|------|-------------|---------|-------|
| high | Desktop, good hardware | 2.0 | Full foliage & particles |
| balanced | Most mobiles / mid hardware | 1.75 | Reduced veg density |
| low | Low-end, Save-Data, reduced-motion | 1.25 | Minimal particles, simpler foliage |

Mode is set automatically by `js/core.js`. Override for testing:

```js
AppCore.setMode('low'); // or 'balanced' / 'high'
```

## RAF behaviour

- Pauses expensive work when `document.visibilityState !== 'visible'`.
- Resumes cleanly via `appresume` event.
- `dt` is clamped to 50 ms to avoid spiral-of-death after long background tabs.

## Recommendations for authors

- Prefer adding new visual density behind the `enableComplexFoliage` / `particleMax` flags.
- Avoid per-frame `querySelector` or layout reads inside the draw path.
- Large media should be hosted externally (archive.org is already used for session WAVs).
