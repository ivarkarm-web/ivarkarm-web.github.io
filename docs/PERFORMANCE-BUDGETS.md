# Pionier / handpan-app performance & CSS budgets

This project separates **raw source** size reporting from the **strict optimized production CSS payload** gate. They measure different things and must not be confused.

## 1) Raw source CSS report (readable source)

- **What:** sums the critical CSS files linked by `handpan-app/index.html` (and reports entry-file sizes) **as they exist** in the target directory (default `handpan-app/`, the readable source).
- **250,000-byte figure:** used as a **production reference** only. If raw source exceeds it, the report emits a **WARNING** — **not** a production payload failure. Source is kept readable in git; it is not shipped as-is.
- **Commands:**
  - `npm run report:handpan-source` (or `npm run lighthouse:app`, source report alias)
  - `node scripts/report-handpan-source.mjs [--app-dir <directory>]`
- **CI:** not a blocking production gate. (`app-check.yml` / `deploy.yml` enforce the production payload gate after optimization; see below.)

## 2) Optimized production CSS gate (STRICT)

- **What:** sums the same critical CSS files linked by the app entry, but from the **actual optimized artifact** (PurgeCSS + Lightning CSS minify). This is the payload intended for users.
- **Strict limit:** optimized critical CSS must be **< 250,000 bytes** (250,000-byte ceiling).
- **Safety:** refuses to measure the git-tracked `handpan-app/` source tree unless `--in-place-optimized` is passed (prevents accidentally gating unoptimized source). Use `--app-dir dist/handpan-app` for a local build artifact, or `--app-dir handpan-app --in-place-optimized` only in an ephemeral CI checkout **after** `optimize-handpan-css.mjs --allow-source`.
- **Commands:**
  - local build artifact: `npm run build` (optimizer enforces the budget on `dist/handpan-app`) and/or `npm run check:handpan-production -- --app-dir dist/handpan-app`
  - CI in-place: `node scripts/check-handpan-production-css.mjs --app-dir handpan-app --in-place-optimized`
- **Preserved:** PurgeCSS, Lightning CSS minification, existing safelists (`/^is-|^has-|^theme-|^state-/`, `keyframes/fontFace/variables:false`) and optimizer behavior remain unchanged.

## 3) Why source can exceed 250 KB while shipped CSS is compliant

Source CSS is readable/maintainable and includes rules that PurgeCSS removes as unused (given the safelist) and that minification compresses. The optimizer (`scripts/optimize-handpan-css.mjs`) produces the shipped payload; the strict gate applies to that optimized output.

## 4) Why GitHub Pages deployment uses optimized-in-place files (not `dist/`)

`deploy.yml` runs checks (including production CSS gate) on an **ephemeral** checkout, then a separate deploy job checks out fresh, runs `optimize-handpan-css.mjs --allow-source` to optimize `handpan-app/` **in place**, and uploads the **repository root (`path: '.'`)** as the Pages artifact (`deploy-pages`). It does **not** upload `dist/`. Therefore the production gate in CI validates the **optimized-in-place `handpan-app/`** artifact (the exact shape uploaded). `npm run build` produces `dist/handpan-app` for local/other build flows and enforces the same 250k limit there.

## 5) Workflows

- **`app-check.yml` (PR/push to `main`)**: `check:handpan-cache` → optimize in place (`--allow-source`) → **Production CSS gate** (`handpan-app --in-place-optimized`) → Playwright install → smoke → `test:app` → browser tests.
- **`deploy.yml` (checks, needs before deploy)**: same through browser tests → **Production CSS gate** after browser tests (so a size regression cannot suppress interaction/a11y diagnostics). Measures the optimized in-place shipping payload.
- **`deploy.yml` (deploy, `needs: checks`)**: optimize in place → upload repo root (`.`) → deploy Pages. Validation completes before deployment.

## 6) Entry-file budgets

`index.html`, `pionier-core.js`, and `pionier-app.js` size budgets are still enforced by the source report (`report-handpan-source.mjs` / `lighthouse:app`). They apply to the files as present in the measured directory.
