# Pionier Quality Scorecard

**Last updated:** 2026-10-20  
**Scope:** `handpan-app/` and its test/CI surface.

This scorecard is deliberately conservative. A passing unit or browser suite is evidence for the behavior it exercises, not proof of real-device behavior, sound quality, offline support, or commercial licensing.

## Current scores

| Dimension | Score | Target | Evidence and reason |
|---|---:|---:|---|
| Reliability confidence | **6/10** | 8/10 | Voice supersede bounds, AudioContext lifecycle listener + unit tests, 200-strike stress tests added locally. Full touch matrix and real-device offline still open. |
| Product coherence | **6/10** | 8/10 | Learn + community uploads removed. Bedroom Sessions only. `app-state.js`, dual buses (`instrumentBus` / `ambientBus`), `engineKind` catalogue. Full looper restore still landing. |
| Production readiness | **6/10** | 8/10 | SW `pionier-v99` shell aligned; release/device/performance-budget docs; smoke size budgets. Offline proof and device matrix still owner-gated. Sample rights still block commercial 8/10. |

## Phase A–D (2026-10-20)

- **A:** Purged Learn remnants and community uploads (`repository-loop-save`, community-api, lesson-source).
- **B:** AudioContext health, voice bookkeeping, library `engineKind` / ring-out noteOff.
- **C:** `app-state.js`, dual buses, loop-core helpers for looper BPM/quantize.
- **D:** SW shell v99, RELEASE/DEVICE/PERFORMANCE-BUDGETS docs, smoke scope + size checks.

## Owner inputs still needed

1. Fill `docs/DEVICE-CHECKLIST.md` (iOS Safari + Android Chrome).
2. Offline reload proof after SW install.
3. Owner-recorded multi-velocity handpan samples (or explicit license).
4. Restore full `looper.js` from local Phase C tree (replace emergency stub if still present).

## Change log

- **2026-10-20 (Phase A–D):** Scope lock (no Learn/community); reliability + coherence + production readiness each moved toward 6/10 with linked code/docs. Full looper body and complete pionier-core restore may still be in progress on `main`.
