# Pionier — playable handpan

Mobile-first virtual handpan on GitHub Pages. Static files only (ES modules, no build step).

Live: https://ivarkarm-web.github.io/handpan-app/

## What it is

- Radial pan surface (9–14 notes) with note labels
- Multiple scales and roots (searchable scale browser)
- Sampled notes where available, synthesis fallback
- Instrument voices (handpan + library / ambient synths)
- Looper + transport bar (record, BPM, metronome, volume)
- Visual Filter editor (cutoff / resonance / type) wired to Web Audio
- **Bedroom Sessions** soundscapes — the owner’s eight archive.org recordings only
- Touch ripple feedback (skins, ambients, tonefield shapes, and mandala aura removed for mobile performance)

## What it is not

- No Learn mode / lessons (panel still present experimentally)
- No user uploads
- No third-party platform embeds
- No generated ambient particle beds

## Play

| Input | Action |
|-------|--------|
| Touch / mouse | Strike pads; multi-touch chords |
| Keys `1`–`9` or `Q`–`O` | Pads 0–8 (hold to sustain) |
| Bottom bar / sidebars | Scale, base note, octave / note count |
| Transport | Record, BPM, metronome, volume |
| Filter panel | Drag handle or knobs for cutoff / resonance |

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
