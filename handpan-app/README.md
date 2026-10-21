# Pionier — playable handpan

Mobile-first virtual handpan on GitHub Pages. Static files only (ES modules, no build step).

Live: https://ivarkarm-web.github.io/handpan-app/

## What it is

- Radial pan surface (8–13 notes)
- Multiple scales and roots
- Sampled notes where available, synthesis fallback
- Instrument voices (handpan + library / ambient synths)
- Looper
- **Bedroom Sessions** soundscapes — the owner’s eight archive.org recordings only
- Skins and mandalas

## What it is not

- No Learn mode / lessons
- No user uploads
- No third-party platform embeds
- No generated ambient beds (rain/storm/etc.)

## Play

| Input | Action |
|-------|--------|
| Touch / mouse | Strike pads; multi-touch chords |
| Keys `1`–`9` or `Q`–`O` | Pads 0–8 (hold to sustain) |
| Bottom bar | Instrument, scale, base note, note count |
| ♫ | Bedroom Sessions player |

Audio unlocks on the first gesture (required by browsers, including iOS Safari).

## Stack

Plain HTML/CSS/JS on GitHub Pages. Service worker (`sw.js`) uses network-first HTML and cache-first assets. See `ARCHITECTURE.md`.

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
- Service worker: bump `CACHE_VERSION` in `sw.js` when shell assets change; keep SHELL in sync with `index.html` query stamps.
