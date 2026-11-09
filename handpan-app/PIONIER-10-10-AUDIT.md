# PIONIER 10/10 readiness audit

Audit date: 2026-11-01  
Scope: `handpan-app/`, reviewed at local `HEAD` `28770f86cdec25c10dc4e31d5434c775e43b7104` (`fix(pionier): restore TonePad sequencer and remove grid`).  
Purpose: evidence-based product and engineering baseline, with P0-01/P0-02 follow-up and the P0-03 socket diagnosis recorded below.

## Repository baseline

- Working tree was clean at start (`git status --short --branch` showed only `## codex/pionier-audit`). Current branch is `codex/pionier-audit`.
- Local `main` is `bf9cd21464ae381b791cd9acc07c6c1269c4a1a3`, dated 2026-10-30 03:01:01 +0200. It is 3 commits behind the locally cached `origin/main` ref.
- The cached `origin/main` is `28770f86cdec25c10dc4e31d5434c775e43b7104`, dated 2026-11-01 10:45:55 +0200, and equals this audit branch's HEAD. The available local tracking ref points here.
- **Remote freshness is unverified.** `git fetch origin` failed because writing `.git/FETCH_HEAD` is forbidden; `git ls-remote origin refs/heads/main` also failed because `github.com` could not be resolved. Therefore the actual latest production commit cannot be confirmed in this environment. The hash above is the latest locally verifiable production ref, not a claim that GitHub has no newer commit.
- At the initial audit, no user changes were present and no implementation was performed. In this follow-up, P0-02 TonePad work was applied; pre-existing P0-01 CSS edits and audit documents were preserved. No commit or push was performed.

## Architecture and product boundaries

PIONIER is static HTML/CSS with browser ES modules on GitHub Pages. `index.html` is the shell; `pionier-app.js` starts the app; `pionier-core.js` and `pionier-core-base.js` compose instrument/input/runtime behavior. `js/audio-core.js` owns a lazy shared `AudioContext`, master gain and compressor. Instrument voices route through an instrument bus and optional FX chain; the looper records that bus via an AudioWorklet. `js/app-state.js` stores a subset of choices in local storage, while saved audio recordings use IndexedDB. `sw.js` precaches a versioned shell and provides network/cache fallbacks.

This matches the required no-framework, static hosting model and the product's synthesized-instrument constraint. Bedroom Sessions remains in the artist portfolio; it is no longer a Pionier app feature. At the initial audit, TonePad was the architecture exception: it downloaded eight base64 fragments, inflated generated code and imported a Blob URL while `tonepad-impl.js` was only a placeholder. The P0-02 follow-up below records the extraction into local ES modules and the remaining browser verification gap.

P0-02 extracted the active TonePad v51 payload (44,932 decoded source bytes) into `js/tonepad-impl.js`; `js/tonepad.js` now re-exports it as a local ES module. The source uses the existing shared `audio-core.js` context/master, and no longer fetches generated code, decompresses it, or imports a Blob URL. The eight base64 fragments and obsolete placeholder/patch files were removed after adding browser coverage. Cache generation is `pionier-v198` with 49 shell entries. The focused Playwright tests still have not run; editing, transport audio scheduling, reload persistence, mobile behavior, and storage-error handling therefore remain runtime-unverified. P0-02 is incomplete until those browser tests pass.

P0-03 diagnosis (2026-11-01): `package.json` uses `@playwright/test` 1.56.1; `playwright.config.mjs` starts `python3 -m http.server 4173 --bind 127.0.0.1 --directory .` and polls `http://127.0.0.1:4173/handpan-app/index.html`. This is a conventional and internally consistent static-server setup. Both focused and full Playwright runs reached Python's `socket.bind` and failed with `PermissionError: [Errno 1] Operation not permitted`; neither executed a browser test. This is direct evidence of the restricted execution environment denying local socket binds, not evidence of a Playwright configuration or application defect. The runner exposes no permitted way to execute outside that restriction in this session. The legitimate next step is to run the unchanged commands in a local terminal or CI runner that permits loopback binding; do not mark either P0 item complete until the focused tests and full suite actually pass.

At initial review, `ARCHITECTURE.md` and `QUALITY-BASELINE.md` still described recorded handpan samples, v166 and ScriptProcessor looper capture. Those app docs have since been updated: the current handpan is procedural, APP_VERSION is 200, looper recording uses AudioWorklet, and My Library uses IndexedDB.

## Classification and scoring method

**COMPLETE** means implementation and representative verification meet the stated product need. **PARTIAL** means a meaningful implementation exists but coverage or behavior is incomplete. **MISSING** means a needed capability is absent. **UNVERIFIED** means evidence is insufficient to judge runtime behavior (a source implementation alone is not proof). Scores reflect production confidence today, including evidence and release gaps, rather than feature count. A 10 requires repeatable automated coverage and supported-device verification where hardware/browser behavior matters.

## Twelve-area assessment

| # | Area | Status | Score / 10 | Evidence and remaining risks |
|---|---|---|---:|---|
| 1 | Sound engine | PARTIAL | 7.0 | One shared lazy context, master compressor/headroom, lifecycle helpers and audio-health reporting are in `js/audio-core.js`; audio-core tests pass. Handpan/library voices are procedural and use a shared sound library; loop capture uses AudioWorklet. No real-device latency, clipping/loudness, sustained polyphony, CPU or memory measurements were run. Context recovery still needs device proof and error-state UX review. |
| 2 | Instrument collection | PARTIAL | 6.5 | Handpan and procedural library/arp families are registered; smoke checks prohibit shipped handpan note recordings; handpan scale-frequency tests pass. Source contains multiple timbral definitions, but no listening panel, level matching, switching stress or supported-device sound-quality verification was performed. Quality is partly subjective. |
| 3 | Playing experience | PARTIAL | 7.0 | Pointer/touch and keyboard strike paths, scale/root controls, multi-touch regression specs and visual strike feedback exist. Unit/smoke checks pass. Browser suite did not run; physical iOS/Android touch, focus flow, rotation, hit-target sizing and chord behavior remain unverified. |
| 4 | Effects | PARTIAL | 6.5 | FX source includes compressor, delay, algorithmic reverb, filter, saturation/warmth and chorus, with a five-module cap and editor/preset UI. Smoke checks find presets and live wiring. No audio render/listening verification or level/feedback/clipping sweep was run; stereo widener is not evidenced as a distinct effect. |
| 5 | Looper | PARTIAL | 7.0 | Seven-layer limit, AudioWorklet capture, count-in/metronome, quantization/BPM and WAV export are implemented; loop timing unit tests pass and the worklet-unavailable case has a browser spec. Browser tests could not execute, so real record/overdub/sync/export integrity and mobile interaction are unverified. Loop audio persistence across reload is not evidenced. |
| 6 | TonePad | PARTIAL | 4.5 | P0-02 replaces the compressed payload loader with readable local ES modules and adds focused Playwright coverage for initialization, editing/persistence, layer/sound selection, transport audio scheduling, and storage failure. `npm run check:handpan-cache` passes at `pionier-v198` with 49 entries. The Playwright server could not bind in this environment, so these behaviors, including mobile behavior, remain unverified in a browser. |
| 7 | Session management | PARTIAL | 5.0 | `app-state.js` persists instrument, scale, root, note count and limited ambient/loop metadata; settings and favorites have separate local-storage keys. Tests verify app-state round-trip. A complete named session snapshot/restore including FX, TonePad patterns and loop audio is not evidenced; browser storage denial/quota behavior is only soft-failed. |
| 8 | Performance | PARTIAL | 5.5 | Entry source size checks pass, but `npm run lighthouse:app` fails its shipping critical-CSS budget: 254,189 / 250,000 bytes (5 linked files). No runtime Lighthouse, mobile CPU, startup, latency, memory or long-play measurement was completed. This is a concrete release-quality failure. |
| 9 | Reliability | PARTIAL | 6.0 | Optional modules have fail-soft boot status, audio lifecycle recovery helpers, storage catches and versioned service-worker shell. Smoke checks pass. Fetch/startup failure injection, AudioWorklet setup failures, browser interruption recovery and cache-update races are not validated here because Playwright could not start. |
| 10 | UX and accessibility | PARTIAL | 6.5 | Semantic buttons, labels/live regions, focus-visible/high-contrast support and mobile control sheets are present; dedicated a11y specs are in the repository. They were not run. Canvas instrument accessibility, keyboard-only complete flows, contrast under all states, real touch targets and phone layouts remain unverified. |
| 11 | Offline and PWA | PARTIAL | 6.0 | Manifest, service-worker registration, 56-entry versioned shell and offline specs exist; cache consistency check passes (`pionier-v197`). Install code tolerates individual fetch failures and then skips waiting, which can activate a partial offline shell. Real offline startup/update and browser compatibility are not confirmed. |
| 12 | Testing and maintainability | PARTIAL | 6.0 | 121 smoke assertions and 34 Node tests pass. Playwright coverage exists for desktop/mobile, service worker, a11y and looper concerns but could not run. Docs contradict current implementation; TonePad is packed code; performance budget fails. No full release verification or hardware sign-off. |

**Overall readiness: 6.0 / 10 (rounded from the twelve-area mean of 6.13).** This is a confidence score, not a claim that the product is unusable. The core instrument has substantial implementation and static/unit coverage, but the failing CSS budget, unverified browser/hardware paths, TonePad opacity, and documentation mismatch prevent a defensible 10/10 claim.

## Test and verification results

Executed on this checkout on 2026-11-01:

| Command | Result | Exact evidence |
|---|---|---|
| `npm test` | PASS | `PASSED · 119 checks`; includes source integrity, scope assertions, file budgets and JS syntax checks. |
| `npm run test:app` | PASS | Node TAP: 34 tests, 34 pass, 0 fail, 0 skipped. |
| `npm run check:handpan-cache` | PASS | `OK · pionier-v198 · 49 shell entries`. |
| `npm run lighthouse:app` | PASS | Entry budgets passed; critical CSS sum is 241,810 bytes against a strict 250,000-byte budget across 5 files. |
| `npx playwright test phase13-tonepad.spec.mjs` | BLOCKED | Attempted in the restricted runner; Python server's `socket.bind` raised `PermissionError: [Errno 1] Operation not permitted`; zero TonePad browser tests ran. |
| `npx playwright test` | BLOCKED | Same sandbox bind denial before browser tests; zero browser tests ran. Must be rerun in an allowed local/CI environment. |
| `git fetch origin` | BLOCKED | `error: cannot open '.git/FETCH_HEAD': Operation not permitted`. |
| `git ls-remote origin refs/heads/main` | BLOCKED | `Could not resolve host: github.com`. |

No physical iOS Safari or Android Chrome test was executed. Do not mark browser, offline, accessibility, audio-quality or device behavior complete based on source inspection or Node tests. P0-02 and P0-03 remain incomplete: P0-02 awaits passing TonePad browser tests; P0-03 awaits a passing full browser suite in an environment that permits loopback sockets.

## Five biggest problems

1. **Shipping CSS budget fails:** current linked CSS exceeds the configured cap by 4,189 bytes, so the existing performance gate is red.
2. **TonePad is not maintainable or verifiable:** its active source is compressed/base64 data imported as a generated Blob module, with no dedicated functional test discovered.
3. **Browser/device evidence is missing:** this restricted runner denies loopback socket binds, so Playwright did not execute; iOS/Android manual checks also remain unsigned.
4. **Offline correctness is uncertain:** the shell is versioned and consistent, but service-worker installation can proceed after individual shell fetch failures; offline tests did not run.
5. **The source-of-truth docs are wrong:** architecture and quality notes conflict with the actual procedural instrument, v197 cache and Worklet-based looper, creating risk for future changes and release decisions.

## Release readiness decision

Do not represent this checkout as 10/10 or fully verified. The CSS budget and TonePad source auditability are addressed, but TonePad behavior remains unverified. Run the focused and full browser suites in an environment that permits local server binding. Complete the real-device checklist for iOS Safari and Android Chrome before raising claims about audio recovery, touch, offline behavior or mobile reliability. Confirm the remote branch head when network and Git metadata writes are available.

## Follow-up verification (2026-11-01)

The TonePad edit test now has a per-test 45-second overall timeout; the shared 20-second Playwright timeout is unchanged, and the public `window.PionierTonepad` readiness poll remains at 15 seconds. The requested focused run (`--project=mobile-390x844 --grep "opens, edits and persists"`) and full `phase13-tonepad.spec.mjs` run were both blocked before test execution because the configured Python server could not bind `127.0.0.1:4173` (`PermissionError: [Errno 1] Operation not permitted`). No browser cases ran, so this timeout adjustment is not yet browser-verified.

The requested non-browser checks passed in this follow-up: `npm test` — 119 checks; `npm run test:app` — 34 passed, 0 failed; `npm run lighthouse:app` — critical CSS 241,810 / 250,000 bytes and entry-file budgets passed; `npm run check:handpan-cache` — `pionier-v198`, 49 shell entries. No application source was changed for this test-budget issue.

## My Library and Soundscapes removal (2026-11-01)

The current change replaces that player with My Library. Looper layers are captured as stereo `Float32Array` channel data with sample rate, offset, level, pan, mute/solo and layer processing values. The IndexedDB `pionier-library` database stores those samples with the instrument/scale/root/note-count/FX snapshot and looper BPM/metronome/count-in/time-signature values. The existing looper has no project import API, so saved compositions support browser-local playback and stereo WAV export, not continued editing.

The app UI, modules, cache entries and app-only styles/tests/docs for Soundscapes were removed. Bedroom Sessions portfolio content and archive links remain outside `handpan-app`. My Library requests persistent browser storage when available, reports estimated browser storage use, reports storage/quota errors, and warns that clearing site data may erase recordings. Per-recording WAV download is the explicit permanent-copy route. Browser persistence is not represented as guaranteed.

IndexedDB CRUD/export unit tests and Playwright coverage were added. The Playwright test covers reload persistence, multiple records, rename/delete isolation, playback/export and the fixed Library button; until it is actually executed, these are test assertions, not runtime evidence. No browser/device score increase is justified by source or Node tests alone.

**Validation on this uncommitted checkout (APP_VERSION 200):** `npm test` PASS (117 checks); `npm run test:app` PASS (37/37); `npm run lighthouse:app` PASS (205,609 / 250,000 CSS bytes across 6 files); `npm run check:handpan-cache` PASS (`pionier-v200`, 51 entries); `git diff --check` PASS; CSS parsing PASS for 10 files. `npx playwright test scripts/app-tests/library-regression.spec.mjs` BLOCKED before tests because the configured Python server received `PermissionError: [Errno 1] Operation not permitted` at loopback `socket.bind` on `127.0.0.1:4173`. The suite asserted 360×640, 390×844 and 1280×800 project coverage, but no geometry, playback, reload or download assertion ran in a browser. Real device checks remain open.
