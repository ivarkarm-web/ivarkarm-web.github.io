# PIONIER 10/10 scorecard

Baseline reviewed 2026-11-01 at local commit `28770f86cdec25c10dc4e31d5434c775e43b7104`.  
Scores measure demonstrated product confidence, not code volume. **COMPLETE** requires implementation plus representative evidence; **PARTIAL** means working foundations with gaps; **MISSING** means required capability is absent; **UNVERIFIED** means this audit could not establish actual behavior. Do not raise a score from code inspection alone where runtime/device evidence is required.

## Current score and target

| Area | Current | Target | Status |
|---|---:|---:|---|
| 1. Sound engine | 7.0 | 10 | PARTIAL |
| 2. Instrument collection | 6.5 | 10 | PARTIAL |
| 3. Playing experience | 7.0 | 10 | PARTIAL |
| 4. Effects | 6.5 | 10 | PARTIAL |
| 5. Looper | 7.0 | 10 | PARTIAL |
| 6. TonePad | 4.5 | 10 | PARTIAL |
| 7. Session management | 5.0 | 10 | PARTIAL |
| 8. Performance | 5.5 | 10 | PARTIAL |
| 9. Reliability | 6.0 | 10 | PARTIAL |
| 10. UX and accessibility | 6.5 | 10 | PARTIAL |
| 11. Offline and PWA | 6.0 | 10 | PARTIAL |
| 12. Testing and maintainability | 6.0 | 10 | PARTIAL |
| **Overall (mean)** | **6.13** | **10** | **PARTIAL** |

Displayed overall readiness rounds to **6.0/10** to avoid implying precision beyond the evidence. The scored mean is 6.13. No area currently qualifies as COMPLETE because the audit found either functional gaps, failed gates, or material unverified behavior.

## Evidence and promotion gates

| Area | Evidence supporting current score | Main blocker to a higher score | Tests/evidence required before increasing score |
|---|---|---|---|
| **1. Sound engine** | Shared lazy AudioContext/master compressor and lifecycle APIs in `js/audio-core.js`; 34 Node tests include shared-context routing and suspend/resume/recreate behavior. Procedural voices and Worklet capture in source. | No real-device latency, clipping, polyphony, CPU or context-recovery evidence; test doubles cannot establish sound quality. | Run browser audio tests; measure first-note latency and peak level; sustain rapid strikes/chords with five FX and seven loop layers; test iOS interruption, route change and background recovery. |
| **2. Instrument collection** | Handpan and library/arp procedural instrument families are present; smoke assertion forbids shipped handpan note sample bank; scale-frequency test passes. | Presence is not proof every listed voice sounds, switches reliably, or is level-matched and musically approved. | Test note output and activation for every visible instrument; stress switching with held notes; compare levels and perform owner listening approval on phone/headphones. |
| **3. Playing experience** | Input/gesture and keyboard note mapping exist; radial surface and feedback code present; multi-touch, dock and smoke browser specs exist. | Browser suite did not run; touch/focus/rotation/hit targets are not verified on phones. | Execute mobile/desktop Playwright projects; test simultaneous fingers, early finger-up, keyboard play, every scale/root control, rotation and 44px targets on iOS and Android. |
| **4. Effects** | FX chain has filter, warmth/saturation, compressor, delay, reverb and chorus; 40 named presets checked by smoke; live parameter wiring assertion passes. | No render/listening verification of effect response, feedback, gain staging or preset restore. A distinct stereo widener is not evidenced. | Render representative preset combinations; test all knobs/bypass and preset persistence; inspect output peaks/feedback tails; confirm stereo behavior or explicitly mark widener absent. |
| **5. Looper** | Seven-layer cap, Worklet recorder, count-in/metronome/BPM/export code; loop-core tests cover quantization and wrap scheduling. Browser spec exists for Worklet fallback. | Recording, overdub alignment, count-in timing, WAV content and mobile controls did not run in a browser/device. Audio retention after reload not evidenced. | Run looper browser specs; record first and subsequent layers at multiple BPMs; compare layer phase and export duration/content; test stop/clear/fallback and phone download. |
| **6. TonePad** | The active implementation is readable local ES-module source, uses shared `audio-core.js`, and has focused Playwright coverage. Cache check passes at v198 with 49 shell entries. | The restricted runner denies Python `socket.bind` before the browser starts; TonePad assertions and browser/mobile behavior remain unverified. | Run `phase13-tonepad.spec.mjs` in an environment permitting local server binding; review desktop and narrow-phone interaction and BPM alignment before promoting the score. |
| **7. Session management** | My Library snapshots supported app/looper settings and audio layers into IndexedDB. Node tests cover CRUD, retrieved samples, WAV headers, unavailable database and quota failures; browser reload coverage was added. | The added browser spec could not start because the runner denies socket binding. No project import API exists, so reopening for layer editing is not promised; browser persistence remains best-effort. | Run the Library Playwright test in an environment allowing loopback; manually verify supported mobile browsers and WAV downloads. Keep IndexedDB schema versioned as fields evolve. |
| **8. Performance** | Smoke checks enforce entry-file size; CSS optimizer and performance command exist. On 2026-11-01, comment and trailing-whitespace removal brought the strict source CSS total to 241,810 / 250,000 bytes; `npm run lighthouse:app` passes. | No runtime Lighthouse or mobile latency/CPU/memory measurement; mobile/desktop visual regression was not run. | Run mobile/desktop browser checks; capture cold startup, first sound, sustained play/FX/sequencer CPU and memory on representative devices. |
| **9. Reliability** | Boot status/fail-soft paths, storage catches, audio recovery methods and Worklet setup errors exist; syntax/smoke/unit checks pass. | Failure-injection browser tests and actual retry/recovery behavior were not executed; optional worker shell resource failures may allow partial activation. | Run startup/network/module/context failure injection; verify retry and degraded states; make required SW shell install atomic; exercise repeated enter/switch/reload and context recreation. |
| **10. UX and accessibility** | Semantic buttons/labels/live regions, settings/FX controls, mobile sheets and focus/high-contrast files exist; axe/keyboard specs are present. | A11y specs could not run; canvas note interaction, full keyboard path, VoiceOver announcements, contrast variants and actual phone layouts unverified. | Run existing axe/a11y specs across overlays and themes; keyboard-only complete workflow/focus return; VoiceOver smoke; phone/tablet/desktop layout and hit-target review. |
| **11. Offline and PWA** | Manifest, worker registration, versioned shell; current `npm run check:handpan-cache` passes at v198 with 49 entries; offline Playwright spec exists. | Offline spec did not run because the runner denies local socket binding. Worker install catches individual failed resources then skips waiting; update/browser support risk. | Pass service-worker install/offline/update/failure-injection tests; verify required shell completeness and prior-version preservation; real Safari install/airplane-mode/reopen test on `/handpan-app/`. |
| **12. Testing and maintainability** | Latest reruns: 119 smoke checks and 34 Node tests pass; focused TonePad coverage exists alongside core UX/offline/axe/multitouch/looper specs. | Both Playwright commands fail before browser tests because the restricted runner denies socket binding; TonePad assertions have not run. Device gates are unsigned. | Green smoke/unit/cache/performance/browser suite without weakened assertions; TonePad tests passing; device gates signed against exact commit and APP_VERSION. |

## Exact checks already run

- `npm test` — **PASS**, `PASSED · 121 checks`.
- `npm run test:app` — **PASS**, 34 passed, 0 failed, 0 skipped.
- `npm run check:handpan-cache` — **PASS**, `OK · pionier-v197 · 56 shell entries`.
- `npm run lighthouse:app` — **PASS after P0-01**, critical CSS 241,810 / 250,000 bytes; entry-file size checks passed.
- `npm test` — **PASS after P0-01**, 121 checks.
- `npm run test:app` — **PASS after P0-01**, 34 passed, 0 failed, 0 skipped.
- `npm test` — **PASS after P0-02 extraction**, 119 checks.
- `npm run test:app` — **PASS after P0-02 extraction**, 34 passed, 0 failed, 0 skipped.
- `npm run lighthouse:app` — **PASS after P0-02 extraction**, critical CSS 241,810 / 250,000 bytes; entry-file budgets passed.
- `npm run check:handpan-cache` — **PASS after P0-02 extraction**, `pionier-v198`, 49 shell entries.
- `npx playwright test phase13-tonepad.spec.mjs` — **BLOCKED before tests**, configured Python server could not bind (`PermissionError: [Errno 1] Operation not permitted`); zero TonePad browser cases executed.
- `npx playwright test` — **BLOCKED before tests**, configured Python server could not bind a local socket (`PermissionError: [Errno 1] Operation not permitted`); zero browser cases executed.
- **P0-03 cause confirmed:** `package.json` uses `@playwright/test` 1.56.1 and the config's standard Python server targets `127.0.0.1:4173`; both focused and complete Playwright invocations reach the bind call and receive the OS-level permission denial. This is a restricted-runner sandbox limitation, with no evidence of a project configuration or application bug. No outside-sandbox runner is available in this session.
- Latest requested reruns on 2026-11-01: `npm test` — **PASS**, 119 checks; `npm run test:app` — **PASS**, 34/34; `npm run lighthouse:app` — **PASS**, critical CSS 241,810/250,000 bytes; `npm run check:handpan-cache` — **PASS**, `pionier-v198`, 49 entries; focused TonePad and full Playwright — **BLOCKED before tests**, zero cases executed.
- iOS Safari / Android Chrome manual review — **NOT RUN**.
- Remote freshness — **UNVERIFIED**: fetch blocked writing `.git/FETCH_HEAD`, and DNS could not resolve GitHub for `ls-remote`.

## Score increase rules

Raise scores only when the evidence listed in the area row is recorded for the same commit and `APP_VERSION` as the release candidate. A good source implementation can earn partial credit; only a passing representative test can establish verified behavior. A 10/10 requires all P0/P1 defects closed, green automated browser and performance gates, signed supported-device checks, no high-severity unresolved defect, and current documentation. Keep failures visible and fix the product or test setup; never delete or dilute a failing check to make the score rise. The P0-01 budget gate is now green, but the performance score remains unchanged because runtime/device performance evidence is still missing.

P0-02 is **incomplete** until the TonePad browser tests actually pass. P0-03 is **incomplete** until the complete Playwright suite actually runs and passes in an environment that permits local sockets. A sandbox block is not a pass for either item.

Follow-up on 2026-11-01: the TonePad edit/persistence test received a 45-second per-test timeout while preserving the 15-second `window.PionierTonepad` readiness check and global timeout. Focused mobile-390x844 and full phase13 Playwright attempts were blocked before tests by Python `socket.bind` permission denial on `127.0.0.1:4173`; zero browser cases ran. Latest non-browser results: smoke 119 checks passed, Node app tests 34/34 passed, critical CSS 241,810/250,000 bytes passed, and cache check `pionier-v198` with 49 entries passed. Thus the timeout change is in place but not browser-verified.

Soundscapes removal and My Library implementation (2026-11-01): app-only player controls, modules, cache assets and tests were removed; portfolio Bedroom Sessions tracks remain. My Library stores looper audio layers/settings in IndexedDB, supports playback and WAV export, and has Node CRUD/export/quota tests plus a Playwright reload/action spec. No score increased; session management remains 5.0/10 PARTIAL until browser and device evidence exists.

**Validation on APP_VERSION 200:** `npm test` PASS (117 checks); `npm run test:app` PASS (37/37); `npm run lighthouse:app` PASS (205,609 / 250,000 CSS bytes across 6 files); `npm run check:handpan-cache` PASS (`pionier-v200`, 51 entries); `git diff --check` PASS. CSS parser passed all 10 checked stylesheets. `npx playwright test scripts/app-tests/library-regression.spec.mjs` BLOCKED before test execution because the configured Python server could not bind `127.0.0.1:4173` (`PermissionError: [Errno 1] Operation not permitted`); zero browser assertions ran. Keep mobile geometry, library reload/play/export and audio subsystem coexistence unverified until rerun outside this restricted environment.
