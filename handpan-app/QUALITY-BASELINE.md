# Pionier quality baseline

Reliability, product coherence, and production-readiness work for the handpan app.

## Completed
1. **DONE** — Local core: real `pionier-core.js` ES module (no blob/CDN loader).
2. **DONE** — Automated tests match the current shell and core.
3. **DONE** — Sample caching: cache-first SW, versioned sample URLs, E Amara Opus/WebM + AAC.
4. **DONE** — Generative ambient beds in soundscapes (rain/storm/forest/wind/water).
5. **DONE** — Removed racey patch-layer scripts; logic lives in instrument/core/settings.
6. **DONE** — Removed unreferenced legacy bundles and build leftovers.

## Remaining
- Browser regression suite (Playwright) still thin; expand for multi-touch and offline.
- Re-encode remaining non-E-Amara scales to Opus for further weight savings.
- iOS Safari audio unlock must be verified on a real device.
