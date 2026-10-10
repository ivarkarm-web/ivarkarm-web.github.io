# Restore Pionier to backup 005475f

The pre-refactor backup commit is:

```
005475f15c6ec68302fd5f4cb3e5040c67e7e424
```

Message: **Load reveal-hide controls drawer fix**

## Full restore (recommended)

From a local clone of `ivarkarm-web.github.io`:

```bash
git fetch origin
git checkout main
git reset --hard 005475f15c6ec68302fd5f4cb3e5040c67e7e424
git push --force origin main
```

Or restore only `handpan-app/` without rewriting all history:

```bash
git fetch origin
git checkout 005475f15c6ec68302fd5f4cb3e5040c67e7e424 -- handpan-app/
git commit -m "Restore handpan-app from backup 005475f"
git push origin main
```

## What was removed from the refactor

- `handpan-app/controls.css`
- `handpan-app/js/controls-ui.js`
- `handpan-app/js/fx-engine.js`
- `handpan-app/js/mandala-canvas.js`

Partial file restores have been applied; a hard reset to `005475f` is the clean complete restore.
