# Pionier app audit — updated 2026-10-26

## Scope and baseline

Repository: `ivarkarm-web/ivarkarm-web.github.io`, default branch `main`.  
Live route: `/handpan-app/`. Static HTML/CSS/ES modules; CI optimizes CSS before tests and Pages deploy.  
**Physical iOS Safari / Android Chrome remain unverified (owner-gated).**

## App version

`handpan-app/APP_VERSION` = **170** (see also `VERSION.txt`).

## Measured CSS (source, pre-optimizer)

| Stylesheet | Role | Notes |
|---|---|---|
| `pionier-base.css` | Base / tokens | ~173 KB raw; largest single file |
| `pionier-controls.css` | Controls / FX | |
| `css-parts/layout-*.css` | Dock / looper / themes | Linked in parallel from `index.html` |
| `css-parts/ambient-*.css` | Soundscapes UI | Linked in parallel from `index.html` |

**Shipping size is the PurgeCSS + esbuild output in CI**, gated strictly under **250,000 bytes**. Sequential `@import` previously hid layout/ambient rules from PurgeCSS and inflated first-paint waterfalls; that chain is removed.

Cascade still contains a very large number of `!important` declarations (thousands). Treat that as technical debt: fragile overrides, hard to reason about. New rules should avoid adding more.

## Architecture facts (source-checked 2026-10-26)

- Looper capture: **AudioWorklet only** — no `ScriptProcessorNode` remaining in source.
- Stylesheet names in use: `pionier-base.css`, `pionier-controls.css`, and `css-parts/*` for layout/ambient. There is no runtime `pionier.css` or `atelier.css`.
- Catch mode / mandala: not product surface; catch-mode still imported by core; mandala stubs retired.
- Learn mode: removed.

## Validation status

- [x] Unit tests guard control wiring and layout CSS toolbar rules (via `css-parts`).
- [x] CI runs smoke + unit + Playwright + Lighthouse on deploy path.
- [ ] Real iOS Safari and Android Chrome checks (owner-gated).
- [ ] Broad `!important` reduction (debt; not a single-PR fix).

## Release posture

Do not claim production-readiness 8/10 until device checklists are filled and Pages deploy for the current commit is green.
