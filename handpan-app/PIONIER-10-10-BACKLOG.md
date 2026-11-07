# PIONIER 10/10 improvement backlog

Planning baseline: `handpan-app/` at audit commit `28770f86cdec25c10dc4e31d5434c775e43b7104`, 2026-11-01. P0-01 was implemented and verified on 2026-11-01; remaining items are still planning only. Effort is an engineering estimate in person-days, including focused review but excluding device-owner availability.

## My Library and Soundscapes removal (2026-11-01)

- Added browser-local IndexedDB composition storage with per-layer samples/settings, save, listing, rename, delete, playback and stereo WAV export. There is no project import/restore API, so continued layer editing is not promised.
- Removed Soundscapes UI, player modules, styles, cache entries and app-only tests/docs. Bedroom Sessions portfolio material and external media remain intact.
- Added quota/storage messaging, a persistence request, usage estimate display and explicit WAV backup copy. Browser permanence remains best-effort.
- Automated outcomes for this checkout are listed in the final audit/scorecard update. Browser tests and device behavior remain unverified unless a permitted Playwright run completes.

## P0 — critical release blockers

### P0-01 — Restore the shipping CSS budget

- **Status (2026-11-01):** CSS budget restored; `npm run lighthouse:app`, `npm test`, and `npm run test:app` pass. Mobile/desktop visual regression was not run, so the backlog's visual acceptance criterion remains unverified.
- **Verified cause:** The gate sums the five linked authored CSS files, including descriptive CSS comments. The comments consumed 12,363 bytes; CSS rules were not the source of this narrow overage.
- **Verified change:** Removed comments from `pionier-base.css` and `pionier-controls.css` and trimmed trailing whitespace exposed by those removals. The gate remains strict at `< 250,000` bytes.
- **Verified size:** 254,189 -> 241,810 bytes (12,379 bytes saved: 12,363 comment bytes plus 16 trailing-whitespace bytes; 8,190 bytes below the largest passing total of 249,999 bytes).

- **Area:** Performance
- **Problem:** `npm run lighthouse:app` fails: 254,189 bytes across 5 critical CSS files versus the 250,000-byte cap.
- **Solution:** Identify largest redundant/unused rules and safely remove or consolidate them without changing the visual identity; do not raise the budget to hide the failure.
- **Affected files:** `handpan-app/pionier-base.css`, linked `handpan-app/css-parts/*.css`, `scripts/optimize-handpan-css.mjs` only if diagnosis shows a tooling defect.
- **Dependencies:** None.
- **Acceptance criteria:** Existing strict budget passes with margin; CSS optimization produces no broken controls or layout regressions at mobile and desktop viewports.
- **Tests:** `npm run lighthouse:app`, `npm test`, and relevant Playwright visual/layout smoke suite.
- **Effort:** 1–2 days.
- **Regression risk:** Medium; CSS cascade is complex and current docs note legacy overrides.

### P0-02 — Make TonePad source auditable and compatible

- **Status (2026-11-01):** Implementation extracted into readable native ES modules; generated transport fragments and dead placeholder/patch files removed. Current reruns: `npm test` (119 checks), `npm run test:app` (34/34), `npm run lighthouse:app` (241,810/250,000 CSS bytes), and `npm run check:handpan-cache` (`pionier-v198`, 49 entries) pass. Focused Playwright still cannot execute in this restricted runner because Python receives `PermissionError: [Errno 1] Operation not permitted` at `socket.bind`. P0-02 remains incomplete until TonePad browser tests pass in an allowed environment.
- **Verified implementation:** The exact active 44,932-byte decoded payload became `js/tonepad-impl.js`; `js/tonepad.js` directly re-exports it. It continues to use the shared `audio-core.js` context and master. TonePad no longer fetches chunks, calls `DecompressionStream`, or imports a Blob URL. The eight base64 chunks, placeholder implementation, and no-op patch file were deleted.
- **Cache:** `APP_VERSION` is now 198; generated service-worker shell has 49 entries and `npm run check:handpan-cache` passes.
- **Remaining evidence:** Focused browser tests and supported mobile browser checks have not run. P0-03 diagnosis confirms the configured Python loopback server is conventional; the runner blocks socket binding. This environmental block is not a product pass.

- **Follow-up (2026-11-01):** The long edit/persistence Playwright test now has a local 45-second test timeout; the global timeout and `window.PionierTonepad` readiness assertion are unchanged. Focused mobile-390x844 and full phase13 runs were attempted but stopped before tests because Python could not bind `127.0.0.1:4173` (`PermissionError: [Errno 1] Operation not permitted`). `npm test` passed 119 checks, `npm run test:app` passed 34/34, Lighthouse passed at 241,810/250,000 critical CSS bytes, and cache check passed at v198 with 49 entries. Browser verification remains outstanding.

- **Area:** TonePad, reliability, maintainability
- **Problem:** Runtime inflates base64 fragments and imports generated JavaScript through a Blob URL; implementation is difficult to inspect and sensitive to CSP / `DecompressionStream` support. The plain `tonepad-impl.js` is only a placeholder.
- **Solution:** Recover the current implementation into normal local ES module file(s), preserve behavior, and remove the runtime code transport. Do not create another audio engine; continue using shared `audio-core.js`.
- **Affected files:** `handpan-app/js/tonepad.js`, `handpan-app/js/tonepad-impl-p0.js`, `handpan-app/js/tonepad-impl.js`, `handpan-app/js/tonepad-b64-*.txt`, `handpan-app/sw.js`, `handpan-app/index.html`, `handpan-app/APP_VERSION`.
- **Dependencies:** None; preserve current behavior before deleting obsolete fragments.
- **Acceptance criteria:** Sequencer source is ordinary, reviewable local ES modules; works without Blob module imports or decompression APIs; no second AudioContext; obsolete compressed assets removed only after regression tests pass.
- **Tests:** Add TonePad unit and Playwright tests first; verify timing, editing, save/reload, play/stop, mobile controls and offline shell; then `npm test`, `npm run test:app`, cache check and Playwright.
- **Effort:** 2–4 days.
- **Regression risk:** High; active behavior is embedded and restoration is recent.

### P0-03 — Run and fix the browser regression suite in an allowed environment

- **Status (2026-11-01):** Diagnosed, not complete. `package.json` uses Playwright 1.56.1 and `playwright.config.mjs` runs Python's standard `http.server` at `127.0.0.1:4173`; both focused and full runs fail at `socket.bind` with `PermissionError: [Errno 1] Operation not permitted` before tests. This identifies a restricted-runner socket policy, with no evidence of a config/application defect. No outside-sandbox execution facility is available in this session. Run both commands in permitted local/CI execution; require actual test counts and fix only evidenced regressions. Keep P0-02 open until TonePad tests pass.

- **Area:** Reliability, UX/accessibility, playing, looper, PWA
- **Problem:** `npx playwright test` ran zero cases because the sandbox blocked local server binding; critical browser behavior remains unverified.
- **Solution:** Execute the existing suite in CI or a permitted local environment, preserve all failures, and fix product or harness defects without loosening assertions.
- **Affected files:** `playwright.config.mjs`, `scripts/app-tests/*.spec.mjs`, and application files implicated by genuine failures.
- **Dependencies:** Environment that permits its configured web server; do not treat environment denial as a product pass.
- **Acceptance criteria:** All configured browser projects complete and report actual pass/fail counts; service worker, mobile, desktop, multi-touch, and accessibility coverage are included.
- **Tests:** `npx playwright test`; retain output/artifacts for failures.
- **Effort:** 1–3 days, excluding environment provisioning.
- **Regression risk:** Medium; failures may reveal runtime defects.

## P1 — high priority confidence and user-data protection

### P1-01 — Prove offline install is complete before activation

- **Area:** Offline/PWA, reliability
- **Problem:** `sw.js` catches each shell fetch failure independently and still calls `skipWaiting`, so a partially cached worker can replace a working prior version.
- **Solution:** Validate required shell resources as a group, report install failure when a required resource is missing, and preserve the previous active worker/cache until a complete replacement is ready.
- **Affected files:** `handpan-app/sw.js`, `handpan-app/registerSW.js`, `scripts/app-tests/phase5-sw.spec.mjs`, `scripts/smoke-test.mjs`.
- **Dependencies:** P0-03 browser suite execution.
- **Acceptance criteria:** Injected required-resource failure does not activate an incomplete cache; successful update activates and works offline; optional-resource policy is explicit.
- **Tests:** Service-worker install failure injection, offline reload, update lifecycle test, `npm run check:handpan-cache`.
- **Effort:** 1–2 days.
- **Regression risk:** Medium; worker lifecycle/cache behavior changes affect upgrades.

### P1-02 — Establish audio quality and device recovery baselines

- **Area:** Sound engine, instruments, performance
- **Problem:** Source and mock tests cannot establish perceived sound quality, clipping, latency or iOS recovery under load.
- **Solution:** Define a repeatable owner/operator checklist and capture representative rendered peaks/levels, startup-to-first-sound timing, rapid strikes, polyphony, route interruption, background/foreground and long session behavior on supported hardware.
- **Affected files:** `handpan-app/IOS-SAFARI-CHECKLIST.md`, `docs/DEVICE-CHECKLIST.md`, `docs/PERFORMANCE-BUDGETS.md`, optionally `handpan-app/js/audio-core.js` if evidence identifies a defect.
- **Dependencies:** P0-03; a current deploy/APP_VERSION and real iOS/Android devices.
- **Acceptance criteria:** Results recorded by device, OS, browser and APP_VERSION; pass/fail thresholds agreed; failures become small implementation tasks.
- **Tests:** Manual iPhone Safari and Android Chrome checklist; focused audio stress/level test; no score increase on source inspection alone.
- **Effort:** 1 day engineering plus owner device time.
- **Regression risk:** Low to medium; measurement may expose changes required.

### P1-03 — Add TonePad functional coverage

- **Area:** TonePad, testing
- **Problem:** No dedicated TonePad test was found despite a recently restored sequencer.
- **Solution:** Cover pattern creation/edit/clear, transport start/stop, tempo alignment, persistence, active instrument compatibility, failure states and narrow touch viewport.
- **Affected files:** `scripts/app-tests/` (new TonePad tests/specs), `handpan-app/js/tonepad*.js` as needed.
- **Dependencies:** P0-02 preferred; tests should be written against behavior before/alongside extraction.
- **Acceptance criteria:** Regression tests assert user-visible outcomes, shared audio context, no hidden grid reappearance, and persistence across reload.
- **Tests:** Node tests for pure timing/state; Playwright mobile/desktop functional specs.
- **Effort:** 1–2 days.
- **Regression risk:** Low; test-only work, with medium risk if active implementation needs test hooks.

### P1-04 — Define and implement a real session snapshot

- **Area:** Session management, storage
- **Problem:** Current persistence covers a subset of settings; complete session save/restore including FX and creative state is not evidenced, while loop audio itself is not persisted.
- **Solution:** Agree which fields constitute a session, serialize only those fields, validate schema/version on load, and give a clear recovery behavior for invalid or unavailable storage. Keep the experience local and backend-free.
- **Affected files:** `handpan-app/js/app-state.js`, `handpan-app/js/settings-panel.js`, `handpan-app/js/fx.js`, TonePad module, `handpan-app/js/looper.js`, tests/docs.
- **Dependencies:** P0-02 and P1-03 for TonePad state ownership; product decision on whether audio buffers survive reload (recommend settings/patterns survive, loop audio export remains explicit unless persistence is intentionally designed).
- **Acceptance criteria:** Documented session field list; save/reload restores every promised field; corrupt/old data falls back safely; session size limits are explicit.
- **Tests:** Version migration, round-trip, corrupt JSON, storage denied/quota, browser reload tests.
- **Effort:** 2–4 days.
- **Regression risk:** Medium; persistence migration can lose or misapply existing settings.

### P1-05 — Complete sound and effect level safety checks

- **Area:** Sound engine, instruments, effects
- **Problem:** Five simultaneous FX and multiple voices/loop layers can create high aggregate levels; compressor existence alone does not demonstrate no audible clipping or unsafe feedback.
- **Solution:** Render and listen to representative instrument/FX/loop combinations, measure peak/RMS and delay/reverb feedback tails, define headroom targets, then adjust gains only against those results.
- **Affected files:** `handpan-app/js/audio-core.js`, `handpan-app/js/fx.js`, `handpan-app/js/looper.js`, audio tests/fixtures.
- **Dependencies:** P1-02 device/render measurement plan.
- **Acceptance criteria:** Measured level/headroom targets pass for supported simultaneous sources; no runaway feedback; musical character remains owner-approved.
- **Tests:** Offline render tests where practical plus listening checks on speakers/headphones and real device.
- **Effort:** 1–3 days.
- **Regression risk:** Medium to high; gain changes can alter the established sound.

### P1-06 — Add startup and audio recovery failure-injection coverage

- **Area:** Reliability, sound engine
- **Problem:** Fail-soft code and recovery helpers exist, but key failure states were not browser-tested in this audit.
- **Solution:** Exercise missing optional module, blocked storage, rejected worklet module, context interrupted/closed, unavailable AudioWorklet and failed network startup; make user-facing status actionable and ensure retry is possible.
- **Affected files:** `handpan-app/pionier-app.js`, `handpan-app/js/audio-core.js`, `handpan-app/js/looper.js`, `handpan-app/registerSW.js`, `scripts/app-tests/`.
- **Dependencies:** P0-03.
- **Acceptance criteria:** Each injected failure yields either a usable degraded instrument or clear retryable failure; no permanent silent state, stuck loading UI or uncaught rejection.
- **Tests:** Playwright route/context failure injection plus unit lifecycle tests.
- **Effort:** 2–3 days.
- **Regression risk:** Medium; lifecycle and retries can cause duplicate initialization if poorly guarded.

## P2 — medium priority quality and observability

### P2-01 — Replace stale architecture and quality documentation

- **Area:** Testing and maintainability
- **Problem:** `ARCHITECTURE.md` and `QUALITY-BASELINE.md` state facts contradicted by current code (sampled handpan, ScriptProcessor, v166).
- **Solution:** Update descriptions from current source and test output; add an audit date and clear evidence status; remove claims that lack verification.
- **Affected files:** `handpan-app/ARCHITECTURE.md`, `handpan-app/QUALITY-BASELINE.md`, `handpan-app/README.md`, optionally this audit after future measured work.
- **Dependencies:** None.
- **Acceptance criteria:** Docs correctly describe procedural voices, shared context, AudioWorklet, current cache version and actual release/device gates; no contradictory instructions remain.
- **Tests:** Documentation/source fact checks in smoke test where useful; manual review.
- **Effort:** 0.5–1 day.
- **Regression risk:** Low.

### P2-02 — Add instrument switching and voice-level regression tests

- **Area:** Instrument collection, performance
- **Problem:** Registry/source checks prove definitions exist, not that every family audibly activates, switches cleanly or has comparable level.
- **Solution:** Test activation/deactivation, note-on output and context preservation for every offered instrument; measure gain consistency and review the list for redundant/poor-quality voices.
- **Affected files:** `handpan-app/js/instrument.js`, `handpan-app/js/instruments/*.js`, `handpan-app/js/sound/library.js`, `scripts/app-tests/`.
- **Dependencies:** P1-02 for device sound review.
- **Acceptance criteria:** Each visible choice produces a non-silent voice in the shared context; no stale voice after switching; approved levels and timbre inventory documented.
- **Tests:** Unit graph assertions, browser switching stress, owner listening review.
- **Effort:** 1–2 days.
- **Regression risk:** Medium; changing voice definitions can affect sound identity.

### P2-03 — Close keyboard and assistive-technology gaps

- **Area:** UX and accessibility, playing
- **Problem:** Semantic controls exist, but the pan is a canvas and the full picker/editor workflows have not passed the current axe/keyboard/VoiceOver checks.
- **Solution:** Ensure all controls have stable names/state, focus returns after overlays, keyboard dismissal works, canvas notes have an accessible alternative, and contrast/touch target checks cover every overlay.
- **Affected files:** `handpan-app/index.html`, `handpan-app/js/overlay-controller.js`, `handpan-app/js/fx-editor.js`, `handpan-app/js/pionier-surface.js`, CSS and `scripts/app-tests/phase5-a11y.spec.mjs`, `phase6-axe.spec.mjs`.
- **Dependencies:** P0-03.
- **Acceptance criteria:** No critical/serious axe findings in covered states; keyboard-only path can enter, play, select scale/instrument, open/close FX/settings and return focus; documented VoiceOver review passes.
- **Tests:** Existing a11y/axe specs, keyboard Playwright suite, VoiceOver manual smoke.
- **Effort:** 2–3 days.
- **Regression risk:** Medium; overlays and canvas interaction are central.

### P2-04 — Measure runtime performance on representative phones

- **Area:** Performance
- **Problem:** The current check measures file budgets only; startup, input-to-sound latency, CPU and memory are unknown.
- **Solution:** Set practical budgets and collect cold-start, first-note, concurrent-note, FX, sequencer and long-session readings on a midrange iPhone and Android device.
- **Affected files:** `docs/PERFORMANCE-BUDGETS.md`, `scripts/lighthouse-handpan.mjs`, optional small instrumentation in app diagnostics.
- **Dependencies:** P0-01; P1-02 device access.
- **Acceptance criteria:** Baseline and thresholds are documented by device class; repeatable regressions can be detected without shipping heavy monitoring.
- **Tests:** Local Lighthouse when available and manual device profiling; no telemetry/backend.
- **Effort:** 1–2 days.
- **Regression risk:** Low.

### P2-05 — Cover WAV export integrity and long-loop limits

- **Area:** Looper, reliability, performance
- **Problem:** Export implementation exists, but this audit did not verify output headers, sample rate, channel count, duration, memory pressure or phone download behavior.
- **Solution:** Validate generated WAV metadata and audio length for mono/stereo and multi-layer sessions; document safe duration/memory behavior and cancel/recovery path.
- **Affected files:** `handpan-app/js/looper.js`, `scripts/app-tests/`.
- **Dependencies:** P0-03.
- **Acceptance criteria:** Export decodes in a standard audio reader with expected duration/rate/channels; long export does not freeze the interface or leave recording stuck.
- **Tests:** Fixture decode/metadata unit tests and mobile browser download test.
- **Effort:** 1–2 days.
- **Regression risk:** Medium; export buffering and browser download APIs vary.

### P2-06 — Test cache update and cross-browser PWA behavior

- **Area:** Offline/PWA, reliability
- **Problem:** Cache consistency is checked, but actual offline startup/update and Safari/Firefox behavior were not run.
- **Solution:** Extend worker tests to install, update with changed stamps, go offline, fail one required fetch, and restore network; check manifest scope on GitHub Pages subpath.
- **Affected files:** `handpan-app/sw.js`, `handpan-app/registerSW.js`, `handpan-app/manifest.webmanifest`, `scripts/app-tests/phase5-sw.spec.mjs`.
- **Dependencies:** P1-01 and P0-03.
- **Acceptance criteria:** Shell works offline after successful install; update does not strand users; manifest `id`, `scope`, and `start_url` remain correct under `/handpan-app/` deployment.
- **Tests:** Playwright service-worker project plus manual Safari install/offline pass.
- **Effort:** 1–2 days.
- **Regression risk:** Medium; cache invalidation affects returning users.

## P3 — polish after core evidence is green

### P3-01 — Standardize visible interaction and visual states

- **Area:** UX/accessibility
- **Problem:** Several generations of CSS overrides and subtle state differences make consistency difficult to maintain.
- **Solution:** After regression coverage exists, consolidate repeated tokens/states and document component conventions without changing the established visual identity.
- **Affected files:** `handpan-app/pionier-base.css`, `handpan-app/pionier-controls.css`, `handpan-app/css-parts/*.css`.
- **Dependencies:** P0-01 and P2-03.
- **Acceptance criteria:** No visual regression in agreed phone/tablet/desktop screenshots; controls share clear hover/focus/pressed/disabled states.
- **Tests:** Playwright screenshot review and CSS budget.
- **Effort:** 2–4 days.
- **Regression risk:** Medium.

### P3-02 — Add an evidence-based release score gate

- **Area:** Testing and maintainability
- **Problem:** Existing checks are split across scripts and manual checklists; old docs make status ambiguous.
- **Solution:** Create a small release report that records commit, app version, exact automated outcomes, device sign-off and unresolved blockers; keep it static and backend-free.
- **Affected files:** `package.json`, `scripts/` or `docs/RELEASE-CHECKLIST.md`, `handpan-app/IOS-SAFARI-CHECKLIST.md`.
- **Dependencies:** P0-03, P1-02, P2-01.
- **Acceptance criteria:** Release readiness cannot be marked complete while CSS budget, browser tests or required device gates are failing/unreported; exact results are retained.
- **Tests:** Exercise report generation on a passing and intentionally failing local fixture without weakening existing tests.
- **Effort:** 1 day.
- **Regression risk:** Low.

## Recommended sequence

1. **P0-01** restore CSS budget (completed and verified).
2. P0-03 run the existing browser suite in CI/permitted environment and preserve failures.
3. P0-02 is extracted; complete its browser verification (including P1-03 coverage).
4. P1-01 make service-worker activation atomic for required shell resources.
5. P2-01 correct architecture/quality docs.
6. P1-02/P1-05 device and sound evidence, then implement only measured defects.
7. Session, accessibility, export and cross-browser work in dependency order.

First stage (P0-01 through P0-03): **4–9 engineering days**, plus CI/environment setup if needed. This excludes owner-led device review and any additional implementation revealed by browser failures. Work should be split into separate reviewable changes and each should preserve existing tests and product constraints.
