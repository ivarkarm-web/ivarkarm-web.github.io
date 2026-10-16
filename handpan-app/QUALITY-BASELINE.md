# Pionier quality baseline

Measured against the working tree after local commits `0c67f8d` + owner-bug fixes.
**origin/main is still at `c2a8ae6` until these commits are pushed.**

## origin/main as of fetch (c2a8ae6) — true state

| Fact | Value |
|------|-------|
| Tests | 3 of 19 fail (`pickNearest`, missing `#soundscapePlay`) |
| Smoke | Fails (Soundscapes renderer check) |
| Patch files present | `exclusivity-fix.js`, `chrome-fix.css`, `chrome-fix-addon.css`, `app-shell.js` |
| SW stamps vs index | Mismatch (e.g. pionier-app 170 vs 165) |
| !important total | ~1,000+ |

The QUALITY-BASELINE scores on that commit are **not** supported by the tree.

## This working tree (after fixes)

### Tests
- `npm run test:app` → **19/19 pass**
- `npm run smoke` → **PASSED · 71 checks**

### Four owner bugs (local browser, hard-refresh, no SW)

| Bug | Measured |
|-----|----------|
| Base Note / ± Notes | `rootNext`: D→D♯; `noteCountNext`: 9→10; labels sync; ids `rootPrev/Next`, `noteCountPrev/Next` |
| Pan too high | `centerPan` uses visible `#pionierTopDock`; pan bottom gap to bar = **12px** |
| Drop-downs | Pre-fix: menus `hidden:false` but **opacity:0** (ui-layout-extras required `.is-open`). Post-fix: body-portaled, opacity 1, scale + instrument menus visible with backdrop |
| Loop button cut off | Pre-fix: rail height 34–42, button forced 32px. Post-fix: btn **52×52**, `clipped: false`, full ring visible |

### Stylesheets linked from index
pionier, topbar-narrow, looper, scale-menu, settings-panel, atelier, ui-layout-extras  
Deleted: chrome-fix, chrome-fix-addon, exclusivity-fix, app.css, handpan.css, app-shell, ambient, transport  

### Service worker
`CACHE_VERSION = pionier-v8`; SHELL stamps match index (`pionier.css?v=122`, `layout-boot.js?v=52`, `pionier-app.js?v=172`, `pionier-core.js?v=27`, …).  
Source: `handpan-app/VERSION.txt`.

### Bedroom Sessions
8 archive.org MP3s HTTP 200 (verified earlier). Player markup present.

### Not run
- Full offline proof
- Real-device iOS Safari
- axe-core / 5-pointer stress
- Opus/WebM re-encode of remaining scales
- Push to origin (no credentials in this environment)
- Fresh clone of origin/main verification (origin still lagging)
