# Pionier — playable handpan

Mobile-first virtual handpan on GitHub Pages. The app remains native HTML/CSS/ES modules; CI purges unused CSS and minifies the linked stylesheets before deployment. JavaScript bundling is not yet enabled for Pionier.

Live: https://ivarkarm-web.github.io/handpan-app/

## What it is

- Radial pan surface (8–13 notes)
- Multiple scales and roots
- Sampled notes where available, synthesis fallback
- Instrument voices (handpan + library / ambient synths)
- Four-track looper
- **Bedroom Sessions** soundscapes — the owner’s eight archive.org recordings only
- Skins and mandalas

## Quality / release checks

- Automated: `npm run check:app` (smoke + Playwright, including SW offline + axe).
- iOS Safari manual pass: [IOS-SAFARI-CHECKLIST.md](./IOS-SAFARI-CHECKLIST.md).
- Cache version: `handpan-app/APP_VERSION` → `npm run sync:handpan`.

## What it is not

- No Learn mode / lessons
- No user uploads
- No third-party platform embeds
- No generated ambient beds (rain/storm/etc.)

## Play

| Input | Action |
|-------|--------|
| Touch / mouse | Strike pads; multi-touch chords |
| Keys `Q W E R T Y U I O P A S D` | Pads 0–12 (hold to sustain) |
| Bottom dock | Instrument, scale, base note; dice randomizes the note count (8–13) |
| ♫ | Bedroom Sessions player |

Audio unlocks on the first gesture (required by browsers, including iOS Safari).

## Stack

Plain HTML/CSS/JS on GitHub Pages. CI runs PurgeCSS + esbuild to remove unused CSS and minify the production stylesheets; JavaScript is still served as native ES modules. Service worker (`sw.js`) uses network-first HTML and cache-first assets. See `ARCHITECTURE.md`.

## Develop

```bash
# from repo root
npx serve handpan-app   # or any static server
npm test                # smoke
npm run test:app        # unit tests
```

## Quality

Measured facts live in `QUALITY-BASELINE.md`. Do not mark items DONE without a real run.

## Release

- `docs/RELEASE-CHECKLIST.md` — deploy gate
- `docs/DEVICE-CHECKLIST.md` — owner hardware matrix
- `docs/PERFORMANCE-BUDGETS.md` — size and timing budgets
- Service worker: bump `handpan-app/APP_VERSION`, then run `npm run sync:handpan` so `sw.js` SHELL matches `index.html` / `pionier-app.js` stamps. Verify with `npm run check:handpan-cache`.
