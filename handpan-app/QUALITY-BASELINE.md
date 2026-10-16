# Pionier quality baseline

## Scores (evidence-based)

| Axis | Score | Evidence |
|------|------:|----------|
| Reliability | 7/10 | Local core boot, tests rewritten for `resolve` API; offline SW not fully proven this cycle |
| Product coherence | 7/10 | Patch layers removed; exclusivity in settings/layout; Soundscapes player restored in HTML |
| Production readiness | 6/10 | SW v6 aligned with index stamps; sample WAV encode for remaining scales still pending |

## Steps

1. **Vendored core** — DONE (no CDN bootstrap).
2. **Automated tests** — rewritten for current `NoteSampleBank.resolve` API and entry surface. Run `npm run test:app`.
3. **Stylesheet system** — chrome-fix / chrome-fix-addon / exclusivity-fix removed; chrome tokens merged into `pionier.css`. `ui-layout-extras.css` is linked from HTML (not injected). Remaining `!important` debt lives mostly in `ui-layout-extras.css` (~800) — further reduction is follow-up work.
4. **Service worker** — `CACHE_VERSION = pionier-v6`; SHELL list matches index `?v=` stamps including looper and instruments.
5. **Bedroom Sessions** — 8 archive.org MP3 URLs return HTTP 200 with `Accept-Ranges: bytes` (verified 2026-10-16).
6. **Cleanup** — `app-shell.js` (Learn mode) deleted; exclusivity-fix.js and chrome-fix-addon.css deleted.

## Not done / not tested

- Full offline proof (load → offline → reload → play)
- Real-device iOS Safari audio unlock / interruption
- Opus/WebM re-encode of remaining 14 scales
- Reducing ui-layout-extras below ~40 `!important` total
