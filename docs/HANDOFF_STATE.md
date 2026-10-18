# Pionier Handoff State

**Updated:** 2026-10-18  
**Branch:** `fix/pionier-mobile-reliability`  
**PR:** [#88 — Stabilize Pionier controls, Soundscapes, and Loop Studio](https://github.com/ivarkarm-web/ivarkarm-web.github.io/pull/88)  
**Latest verified CI:** [Handpan App Checks run #224](https://github.com/ivarkarm-web/ivarkarm-web.github.io/actions/runs/39147663588), commit `6729a6a085b402df01bb1d7cc42717207c8846aa`.

## CI results

- **Smoke checks:** 73 passed.
- **App unit tests:** 27 passed, 0 failed, 0 skipped.
- **Playwright:** 72 tests scheduled across all three projects; **65 passed, 0 failed, 7 skipped, 0 flaky**.
- **Projects executed:** `mobile-360x640`, `mobile-390x844`, and `desktop-1280x800`. All three projects ran and passed; the skips are layout-specific, not projects skipped wholesale.

| Playwright project | Passed | Failed | Skipped | Flaky |
|---|---:|---:|---:|---:|
| `mobile-360x640` | 22 | 0 | 2 | 0 |
| `mobile-390x844` | 22 | 0 | 2 | 0 |
| `desktop-1280x800` | 21 | 0 | 3 | 0 |
| **Total** | **65** | **0** | **7** | **0** |
- **Pages deployment:** not run for this PR. Nothing in this handoff claims the changes are live.
- **Physical iOS Safari / Android Chrome:** not tested; Chromium emulation is not device verification.

## Six phone blockers addressed on this branch

Each item has its own code commit; these are code changes, not claims of physical-device verification.

1. Pan position lowered on phone-sized viewports — `56acfda` (`fix: lower Pionier pan on mobile`).
2. Loop Studio record button kept inside its control cluster — `16c19db` (`fix: prevent Loop Studio record button clipping`).
3. Scale picker preserves its flex-sheet layout on mobile — `800ab53` (`fix: preserve scale picker sheet layout on mobile`).
4. Root and note-count steppers use a single delegated action path — `aa5c856` (`fix: apply tuning steppers exactly once`).
5. Soundscapes back navigation synchronizes its page/module state — `f68191c` (`fix: synchronize Soundscapes back navigation state`).
6. Placeholder recording-share action remains inert until a real audio Blob exists — `ae08e51` (`fix: keep unavailable recording share action inert`).

## CI issues resolved during this pass

- The original run `39143542023` was cancelled before browser tests could finish, so it produced no valid Playwright result.
- A later run exposed two stale source-pattern assertions in `owner-controls.test.mjs`; they were updated to match the current delegated tuning-action model.
- The next browser run exposed three outdated test assumptions across the three projects: expected a synthetic fallback for a missing owner sample, used the removed `tongue-drum` ID, and evaluated `window` outside `page.evaluate` while running a desktop-only test on mobile projects. Those tests were corrected in commit `5dfd26d`.
- Run #223 was green overall but reported one flaky retry: `optional soundscapes module failure leaves core playable and reports degraded state` in `[mobile-360x640]`. Its failure-injection route was made query-string agnostic and the test now waits until the simulated request is actually intercepted.
- Latest run #224 passed with **0 flaky tests** after that change. Do not merge PR #88 until the remaining release gates are checked.

## Remaining release gates

- Review the six fixes on a real phone, especially picker opening, pan placement, Loop Studio clipping, root/note-count pitch changes, and Soundscapes return navigation.
- Confirm the Pages deployment workflow and its result after any eventual merge; do not report live deployment before that workflow passes.
- Keep PR #88 open until release conditions are met. No merge to `main` has been performed.
