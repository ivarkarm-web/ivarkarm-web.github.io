# Pionier Quality Scorecard

**Last updated:** 2026-10-26  
**Scope:** `handpan-app/` and its test/CI surface.  
**APP_VERSION / CACHE:** `170` / `pionier-v170`

This scorecard is conservative. CI evidence is not a substitute for real-device iOS sign-off or sample licensing.

## Current scores (target overall **8/10**)

| Dimension | Score | Target | Evidence |
|---|---:|---:|---|
| Reliability confidence | **8/10** | 8/10 | AudioWorklet looper only (no ScriptProcessorNode); AudioContext lifecycle tests; dock/root regression smoke; phase9 multi-touch. |
| Product coherence | **8/10** | 8/10 | Scope lock (no Learn / no uploads); Bedroom Sessions only; dual buses; README matches shell. |
| Production readiness | **7.5/10** | 8/10 | `check:app` includes cache + smoke + unit + file performance budgets + Playwright; full `package-lock.json` on main; **iOS checklist remains the hard gate**. Owner must sign `IOS-SAFARI-CHECKLIST.md` for a locked 8. |
| Accessibility | **8/10** | 8.5/10 | focus-visible expansion; high-contrast path; axe HC enables color-contrast. |
| Testing | **8/10** | 8.5/10 | phase3–9 specs including dock smoke + multi-touch; SW offline project; unit test reads `css-parts` for looper toolbar. |
| Performance | **7.5/10** | 8.5/10 | Parallel `css-parts` links (no sequential `@import`); PurgeCSS + esbuild in CI under 250 KB; optional Lighthouse CLI locally. |
| UX polish | **7.5/10** | 8.5/10 | Coach marks module (first-run); settings prefs persist; more prefs can migrate into app-state. |
| **Overall (weighted)** | **~7.8/10** | **8/10** | **Locked 8.0** when: CI deploy green for current commit **and** iOS Safari checklist signed for APP_VERSION 170. |

## Owner inputs still needed for a locked 8

1. Sign `handpan-app/IOS-SAFARI-CHECKLIST.md` on a real iPhone for APP_VERSION **170**.
2. Fill one Android Chrome row in `docs/DEVICE-CHECKLIST.md`.
3. Offline reload proof after SW install on phone.
4. Sample rights for commercial claims beyond procedural fallback (see `docs/AUDIO-LICENSES.md`).

## What moved scores up (2026-10-26)

- Looper is AudioWorklet-only → reliability no longer discounted for ScriptProcessor.
- CSS layout/ambient delivered as parallel `css-parts` links; unit test aggregates parts.
- Reproducible installs via full `package-lock.json` (registry.npmjs.org).
- Docs (`ARCHITECTURE`, `AUDIT`, `HANDOFF_STATE`) aligned to v170.

## Change log

- **2026-10-26:** v170; AudioWorklet; css-parts; package-lock; scorecard refresh. Overall ~7.8 pending device sign-off + green deploy.
- **2026-10-25 (Phases 10–14):** v157 metadata sync; phase8 dock/root smoke; phase9 multi-touch; performance budget script in `check:app`; iOS hard gate in release checklist; coach marks.
- **2026-10-24:** Phase 8–9 focus + high-contrast.
- **2026-10-21:** deploy.yml runs full browser suite; note-count 8–13.
