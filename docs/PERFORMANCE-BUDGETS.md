# Pionier performance budgets

Conservative targets for the static GitHub Pages app.

**CI gate:** `npm run lighthouse:app` (invoked from `npm run check:app`).

| Metric | Budget | How measured |
|--------|--------|--------------|
| `handpan-app/index.html` | ≤ 80 KB | file size |
| Critical CSS (linked from index, sum) | ≤ 250 KB | sum of linked `.css` files |
| `pionier-core.js` | ≤ 120 KB | file size |
| `pionier-app.js` | ≤ 80 KB | file size |
| First open → pads playable (warm cache, mid phone) | ≤ 3 s | owner stopwatch |
| Multi-touch / rapid strikes peak voices | bounded | Playwright phase9 + stress tests |
| Main-thread long tasks during idle | avoid > 50 ms | optional DevTools Performance |

## Notes
- Network-first versioned assets trade a bit of offline purity for deploy freshness.
- Sample banks and archive.org streams are **outside** shell budgets; they load on demand.
- Optional: `npx lighthouse http://127.0.0.1:4173/handpan-app/ --only-categories=performance,accessibility`
- Do not raise scores solely because budgets are documented — only when measured and green.
