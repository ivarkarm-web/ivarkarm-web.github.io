# Pionier quality baseline

## Scores (evidence-based, 2026-10-16)

| Axis | Score | Evidence |
|------|------:|----------|
| Reliability | 8/10 | 19/19 unit tests pass; smoke 71 checks; 8/8 archive.org MP3 HEAD 200 + Accept-Ranges: bytes; SW v7 stamps aligned with index |
| Product coherence | 8/10 | Patch layers removed (chrome-fix*, exclusivity-fix); exclusivity in settings-panel + layout-boot; Soundscapes player full controls; looper 52px ring/core |
| Production readiness | 7/10 | No CDN core; local modules; VERSION.txt stamp source; offline proof and real-device iOS not verified this cycle; ui-layout-extras still ~800 !important |

## Steps

1. **Tests** — DONE. `pickNearest` tests rewritten to `resolve` API (app dropped pickNearest; tests were stale). Entry surface checks static player markup (soundscapes.js does not inject player DOM). Smoke updated for mandala module split. `npm run test:app` → 19 pass; `npm run smoke` → PASSED.
2. **Stylesheet system** — Partial. chrome-fix.css + chrome-fix-addon.css merged into pionier.css and deleted. exclusivity-fix.js deleted; exclusivity lives in settings-panel openSheet + layout-boot setOpen. ui-layout-extras linked from index (no longer injected by layout-boot). app.css + handpan.css deleted (unreferenced). Stylesheet count: 7 CSS files. !important total still ~1030 (ui-layout-extras 800 + pionier merged chrome ~143 + atelier 83). Target &lt;40 not met — requires redesign of ui-layout-extras, not another patch layer.
3. **Service worker** — CACHE_VERSION pionier-v7; SHELL stamps match index ?v=; VERSION.txt documents the single source of truth for humans. Automated generator not yet scripted.
4. **Bedroom Sessions** — 8/8 MP3 URLs HTTP 200, Accept-Ranges: bytes. Bases match js/music-data.js. Player UI verified in browser (queue 8 tracks, transport, seek, volume). Autoplay blocked in headless (expected); readyState 4 after load.
5. **Cleanup** — app-shell.js, ambient.js, transport.js deleted (unreferenced). loop-core.js kept (unit tests). Opus/WebM re-encode of remaining scales not done this cycle.

## Browser checks (local http.server, hard refresh / SW unregistered)

- Mobile viewport: pan centered, FX panel 8 knobs, settings sheet exclusive with FX, looper record 52×52 with ring/core, Soundscapes full player.
- Not tested: landscape, desktop screenshot set, real offline reload, real-device iOS audio unlock.

## Not done / not tested

- Full offline proof (load → offline → reload → play)
- Real-device iOS Safari audio unlock / interruption
- Opus/WebM re-encode of remaining 14 scales
- Reducing ui-layout-extras below ~40 !important total
- Automated SW precache generator script
