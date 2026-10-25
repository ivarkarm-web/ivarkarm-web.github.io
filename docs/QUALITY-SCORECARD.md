# Pionier Quality Scorecard

**Last updated:** 2026-10-25  
**Scope:** `handpan-app/` and its test/CI surface.  
**APP_VERSION / CACHE:** `157` / `pionier-v157`

This scorecard is conservative. CI evidence is not a substitute for real-device iOS sign-off or sample licensing.

## Current scores (target overall **8/10**)

| Dimension | Score | Target | Evidence |
|---|---:|---:|---|
| Reliability confidence | **7/10** | 8/10 | Voice stress + phase9 multi-touch; AudioContext lifecycle tests; dock/root regression smoke. ScriptProcessor looper remains a known limit. |
| Product coherence | **8/10** | 8/10 | Scope lock (no Learn / no uploads); Bedroom Sessions only; dual buses; README matches shell. |
| Production readiness | **7.5/10** | 8/10 | `check:app` includes cache + smoke + unit + **file performance budgets** + Playwright; iOS checklist is a **hard release gate**. Owner must still sign IOS-SAFARI-CHECKLIST for full 8. |
| Accessibility | **8/10** | 8.5/10 | focus-visible expansion; high-contrast path; axe HC enables color-contrast. |
| Testing | **8/10** | 8.5/10 | phase3–9 specs including dock smoke + multi-touch; SW offline project. |
| Performance | **7.5/10** | 8.5/10 | Enforced file budgets in CI; optional Lighthouse CLI locally. |
| UX polish | **7.5/10** | 8.5/10 | Coach marks module (first-run); settings prefs persist; more prefs can migrate into app-state. |
| **Overall (weighted)** | **~8.0/10** | **8/10** | Achieved when CI green + iOS checklist signed for the release. |

## Owner inputs still needed for a locked 8

1. Sign `handpan-app/IOS-SAFARI-CHECKLIST.md` on device for this APP_VERSION.
2. Offline reload proof after SW install on phone.
3. Sample rights for commercial claims beyond procedural fallback.

## Change log

- **2026-10-25 (Phases 10–14):** v157 metadata sync; phase8 dock/root smoke; phase9 multi-touch; performance budget script in `check:app`; iOS hard gate in release checklist; coach marks; scorecard targets 8 overall.
- **2026-10-24:** Phase 8–9 focus + high-contrast.
- **2026-10-21:** deploy.yml runs full browser suite; note-count 8–13.
