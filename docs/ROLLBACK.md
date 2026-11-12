# Pionier — Rollback runbook (proposed)

**Status: PROPOSED PROCEDURE — NOT TESTED.** This runbook documents a practical rollback approach for Pionier/GitHub Pages. It has **not** been executed or validated as part of a completed rollback. Follow normal review/change control and adapt to the actual incident.

**Do not force-push. Do not rewrite shared history.** Use normal Git history (reverts/new commits) and the normal deployment workflow.

## 1. Identify the last known-good commit and deployment

1. Determine the current production state (live `APP_VERSION`, service-worker `CACHE_VERSION`, and observed behavior) at `https://ivarkarm-web.github.io/handpan-app/`.
2. Identify the **last known-good commit SHA** on `main` whose deployment succeeded and whose live behavior was acceptable (check GitHub Actions runs, Pages deployments, and deployment statuses for `github-pages`).
3. Record: bad SHA(s), last known-good SHA, deployment/run IDs, timestamps, and the reason for rollback.

## 2. Prepare a controlled revert (normal Git history)

1. Create an isolated branch/worktree from up-to-date `origin/main` for the rollback change.
2. Revert the offending change(s) with `git revert` to produce **new commit(s)** that restore known-good behavior:
   - Revert in reverse chronological order when multiple commits are involved.
   - **Handle merge commits carefully:** identify the correct parent (`-m 1` or the appropriate parent) so the revert restores the intended mainline state; review the resulting diff before proceeding.
3. Keep the revert focused and reviewable; avoid unrelated edits.

## 3. Keep app version, service-worker cache version, and shell references consistent

Pionier’s cache coherence depends on `handpan-app/APP_VERSION`, `handpan-app/sw.js` (`CACHE_VERSION` and `SHELL` stamps), and referenced asset/version stamps (generated/synchronized by `scripts/sync-handpan-cache.mjs`).

1. **Do not reuse a previously shipped cache version for different content.** Reusing a cache name can leave clients on stale or incorrect cached assets.
2. If restoring prior file content, prefer a **forward** `APP_VERSION`/cache bump (new `pionier-v<version>`) for the rollback release so clients fetch the restored shell and updated service worker.
3. Run `npm run sync:handpan` and verify with `npm run check:handpan-cache` (and ensure `SHELL`/stamps are consistent) before committing the rollback.
4. Confirm the service-worker registration/update behavior will allow clients to receive the updated worker after deployment.

## 4. Run required checks before deployment

1. Run the project’s required checks for the rollback commit (at minimum the checks enforced by CI for the app/deploy path, e.g. cache/version checks, smoke/unit/browser tests, and production CSS/budget gates as applicable).
2. Do not deploy a rollback commit that fails required checks unless there is an explicit, documented emergency decision (and record it).

## 5. Deploy through the normal workflow

1. Merge/push the rollback commit to `main` through the normal process (or use the repository’s standard authorized dispatch) so the normal GitHub Pages workflow runs. **Do not bypass history with force-push.**
2. Wait for the **checks** and **deploy** jobs to complete successfully and for a successful `github-pages` deployment/status for the rollback SHA.

## 6. Verify the live app and service-worker state

1. Verify the canonical production URL serves the rollback build: https://ivarkarm-web.github.io/handpan-app/
2. Confirm live `handpan-app/APP_VERSION` and `handpan-app/sw.js` `CACHE_VERSION` match the rollback release.
3. Perform a hard refresh and confirm the new service worker installs/activates (and that clients update as expected). Check that the app shell loads without stale-cache errors.
4. Smoke-test core behavior appropriate to the incident (e.g. app load/enter, audio on first gesture, instrument/scale, looper basics, My Library/WAV if affected, offline shell if in scope).
5. If issues persist, stop further ad-hoc changes and reassess the last known-good target.

## 7. Record the incident and outcome

Document: incident summary, affected/bad SHA(s), rollback SHA, deployment/run IDs, verification evidence (versions, SW state, smoke results), user impact, client/cache notes, and any follow-up actions. Store the record in the appropriate project/release tracking location.

## Notes

- This procedure assumes the standard deploy workflow (checks → optimize/upload → `deploy-pages`). Confirm current workflow behavior before use.
- “Last known-good” must be based on evidence (successful deployment + acceptable behavior), not assumption.
- This runbook is **proposed and untested**; update it after a real rollback exercise with observed results.
