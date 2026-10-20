# Pionier performance budgets

Conservative targets for the static GitHub Pages app. Enforce via smoke size checks + owner timing.

| Metric | Budget | How measured |
|--------|--------|--------------|
| `handpan-app/index.html` | ≤ 80 KB | file size |
| Critical CSS (linked from index, sum) | ≤ 250 KB | sum of linked `.css` files |
| `pionier-core.js` | ≤ 120 KB | file size |
| `pionier-app.js` | ≤ 80 KB | file size |
| First open → pads playable (warm cache, mid phone) | ≤ 3 s | owner stopwatch |
| 200 rapid strikes peak `activeVoices` | ≤ note count | Playwright stress test |
| Main-thread long tasks during idle | avoid > 50 ms | optional DevTools Performance |

## Notes
- Network-first versioned assets trade a bit of offline purity for deploy freshness.
- Sample banks and archive.org streams are **outside** shell budgets; they load on demand.
- Do not raise scores solely because budgets are documented — only when measured and green.
