# Pionier Quality Scorecard

**Last updated:** 2026-10-13  
**Scope:** `handpan-app/` and its test/CI surface.  
**Deployment baseline:** `a8ba8f1dee61e0681df905334ff321290f80c175` (procedural ambient transport merged; [Pages deployment workflow passed](https://github.com/ivarkarm-web/ivarkarm-web.github.io/actions/runs/38311090779); independent live URL smoke check remains unavailable in this environment).

This scorecard is deliberately conservative. A passing unit or browser suite is evidence for the behavior it exercises, not proof of real-device behavior, sound quality, offline support, or commercial licensing.

## Current scores

| Dimension | Score | Target | Evidence and reason |
|---|---:|---:|---|
| Reliability confidence | **5/10** | 8/10 | CI covers smoke, unit and Playwright browser tests. Activation failure recovery, ring-out, stale saved selection, required-core retry, unavailable audio, blocked storage, optional-module degradation, and ambient playback fallback have regression coverage. The 200-strike oscillator cleanup test is pending a green CI run on PR #70 before this score may move. The full lifecycle/interruption matrix, offline load, and broad touch matrix remain unverified. |
| Product coherence | **5/10** | 8/10 | The app has a usable instrument registry, FX chain, Learn, Soundscapes and looper foundations. Controls/modes still have parallel wiring, the ambient bus and looper capture are not yet shown to be isolated, and `loop-core.js` is not proven to drive the live looper. No single state store or unified navigation has been verified. |
| Production readiness | **4/10** | 8/10 | GitHub Actions runs smoke, app unit and Playwright checks on PRs. The service-worker/cache-clearing behavior prevents claiming offline readiness; docs are stale; mobile WebKit and real-device verification are not evidenced; performance budgets and audio-graph tests are missing. **Commercial release is blocked until sample redistribution rights are explicitly cleared or the samples are replaced.** |

Scores do not increase merely because a PR merges. They move only when the rubric's exit criteria are evidenced by links to tests or measurements. The previously bundled third-party handpan sample set is removed in PR #67 because redistribution rights were not established. The procedural fallback avoids shipping uncleared recordings but is not a substitute for owner-recorded or explicitly licensed samples; sound quality and remaining production gates still constrain the score.

## Verified evidence as of 2026-10-13

- [PR #58 — Soundscapes loading/controls hardening](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/58) — merged earlier; see PR and its checks for the exact coverage.
- [PR #59 — instrument activation ordering and mobile stuck-note release](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/59) — merged earlier.
- [PR #60 — activation queue recovery regression test](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/60) — merged; reported test run passed.
- [PR #61 — preserve the active instrument when a switch fails](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/61) — merged; reported CI passed.
- [PR #62 — natural handpan note ring-out](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/62) — merged. [Its Handpan App Checks run passed](https://github.com/ivarkarm-web/ivarkarm-web.github.io/actions/runs/38303784059).
- [PR #65 — Restore mobile zoom and protect rapid scale taps](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/65) — merged; [CI passed](https://github.com/ivarkarm-web/ivarkarm-web.github.io/actions/runs/38309280959). Browser emulation covers 360×640, 390×844 and desktop Chromium; no physical-device verification.
- [PR #66 — Remove retired placeholder instruments](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/66) — merged; [CI passed](https://github.com/ivarkarm-web/ivarkarm-web.github.io/actions/runs/38309824592).
- [PR #67 — Remove uncleared audio assets and audit provenance](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/67) — merged; [CI passed](https://github.com/ivarkarm-web/ivarkarm-web.github.io/actions/runs/38310280889). The sample set was removed and the procedural fallback has a browser regression test.
- [PR #68 — Add procedural ambient beds and reliable transport controls](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/68) — merged; [CI passed](https://github.com/ivarkarm-web/ivarkarm-web.github.io/actions/runs/38310863739) and [Pages deployment passed](https://github.com/ivarkarm-web/ivarkarm-web.github.io/actions/runs/38311090779). Its ambient transport regression tests passed; one activation-queue test was flaky on its first attempt and passed on retry.
- The repository's current PR workflow runs `node scripts/smoke-test.mjs`, `npm run test:app`, and `npx playwright test`. It installs Chromium and runs these on GitHub Actions. The current workflow does not prove iOS Safari, mobile WebKit, actual hardware audio, or real-device offline behavior.
- Deployment workflow for commit `91952fb5cfe2611662d7e69a9ef2ed5e391a497b`: [Deploy to GitHub Pages run](https://github.com/ivarkarm-web/ivarkarm-web.github.io/actions/runs/38305779641). Check the run result before claiming deployment is complete.

## Phase gates

### P1 — Reliability

- [x] Instrument activation failure preserves the previously active instrument (PR #61).
- [x] Regression test for activation queue recovery (PR #60).
- [x] Handpan finger-up no longer immediately fades the struck voice (PR #62).
- [ ] Boot state machine and isolated optional subsystem initialization.
- [ ] AudioContext lifecycle/interruption behavior covered by tests.
- [ ] Full pointer/touch matrix at 360×640 and 390×844, including ten-finger input, glide, cancellation, capture loss and rotation.
- [ ] Voice polyphony cap, rapid-strike node-leak test and hard-release coverage.
- [ ] Failure-path tests for manifest/sample errors, unavailable AudioContext, optional import failure, storage failure and offline startup.
- [ ] Real device checklist completed by owner; emulation and hardware results recorded separately.

**P1 exit status: OPEN.** The current evidence does not meet the rubric for 6 or 8.

### P2 — Product coherence

- [ ] One navigation shell and one home per control.
- [ ] One state model for mode, instrument, scale, root, octave, FX, ambient and loop.
- [ ] Explicitly separated instrument, ambient and looper buses.
- [ ] Live looper uses `loop-core.js`, with isolated layer capture, quantization and undo.
- [ ] Ambient audio has measured phone-speaker audibility and documented, redistributable sources.
- [ ] Instrument catalogue distinguishes real/sample-backed instruments from placeholders.

**P2 exit status: NOT STARTED.** Reliability remains the priority.

### P3 — Production readiness

- [ ] Audio graph and node lifecycle tests.
- [ ] Desktop Chromium, mobile Chromium and mobile WebKit Playwright projects.
- [ ] Offline-capable service worker and safe cache/update flow.
- [ ] Enforced payload, first-interactive and main-thread performance budgets.
- [ ] Accessible keyboard controls, focus states and labelled modes.
- [ ] Accurate docs, dead-code inventory and release checklist.
- [ ] Asset provenance and redistribution rights documented for every shipped sound.
- [ ] Manual device checklist with untested hardware steps explicitly pending.

**P3 exit status: NOT STARTED.**

## Owner inputs needed

1. Owner-recorded handpan samples (each note, multiple velocities, full natural tails) to replace uncleared samples.
2. Owner-recorded field loops, or approval of specific CC0 sources, for rain, storm, forest, birds and sea.
3. Real-device results for the checklist (iPhone Safari/PWA, Android Chrome, tablet, desktop Safari/Firefox).
4. Owner-provided or explicitly licensed handpan samples; current sample redistribution status remains uncleared.

## Change log

- **2026-10-13 (PR #69):** Added the visible boot state/retry surface and regression tests for required-core failure, audio-context absence, storage denial and optional-module failure. Reliability moved 4→5/10 with passing CI.
- **2026-10-13 (PR #70, pending):** Stop superseded synth oscillators early and guard voice-map cleanup by identity. The new test `200 rapid strikes stop superseded oscillators and preserve the newest voice` checks voice identity and verifies every tracked oscillator ends. **Score stays 5/10 until CI is green;** a follow-up commit may move Reliability to 6/10 only with the green run link. Full lifecycle/interruption, offline and broad touch matrix remain open.

- **2026-10-13 (PR #68, pending):** Add procedural storm, forest-wind and ocean beds; make looping noise boundaries click-safe; add explicit mute and failure fallback. Evidence to be recorded after CI: `procedural ambience includes rain, storm, forest wind, and ocean beds`, `looping noise has eased boundaries and finite samples`, `every ambient bed builds a graph and returns a cleanup handler`, `noise-based beds use looping buffer sources`, plus Playwright transport/mute/fallback tests. Scores remain unchanged.

- **2026-10-13 (PR #67, pending):** Inventory all previously bundled handpan samples, remove them because redistribution permission was not established, and test the procedural fallback. Scores remain unchanged: the fallback is safer from a licensing perspective but is not equivalent to real recorded handpan sound.

- **2026-10-13 (proposed in PR):** Remove two procedural placeholder instruments from the registry and add a regression test for stale saved instrument IDs falling back to Handpan. Scores remain unchanged until CI and broader phase gates justify a score change.

- **2026-10-12:** Established conservative baseline after activation-failure recovery and natural ring-out changes. No score increased because the phase exit criteria remain unproven.
