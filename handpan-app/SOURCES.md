# Pionier — Sample Sources & Licensing

Every external audio asset used by Pionier must be listed here.

## Handpan (shipped)

| File pattern | Source | Creator | License | Status | Notes |
|--------------|--------|---------|---------|--------|-------|
| `sounds/notes/*.mp3` | haganenote/virtual-handpan (www.haganenote.com/vst) | Haganenote | See upstream project — used for virtual instrument playback | modified (one-shots, runtime pitch-shift) | Dry hits mapped by MIDI. Manifest: `sounds/notes/manifest.json` |

Upstream: https://github.com/haganenote/virtual-handpan

These are **not** claimed as original Ivar Karm recordings. Attribution to Haganenote is required when redistributing.

## Kitchen (current)

All Kitchen objects currently use **internal synthesis** (status: `placeholder`).

| Object | Status | Replacement target |
|--------|--------|--------------------|
| Glass | placeholder synth | Licensed / own recording of struck glass |
| Ceramic Bowl | placeholder synth | Licensed / own recording of ceramic bowl |
| Pot | placeholder synth | Licensed / own recording of metal pot |
| Pan | placeholder synth | Licensed / own recording of frying pan |
| Spoon | placeholder synth | Licensed / own recording of metal cutlery |

When real samples are added:

1. Place files under `sounds/kitchen/<object>/`
2. Update `sounds/kitchen/manifest.json`
3. Update this table with license, creator, URL
4. Prefer CC0 / public domain / explicitly redistributable licenses
5. Mark personal Zoom / phone recordings as **Original — Ivar Karm**

## Bird (current)

All Bird calls currently use **internal hybrid synthesis** (status: `placeholder`).

| Call | Status | Replacement target |
|------|--------|--------------------|
| Chirp | placeholder synth | Field recording or granular layer |
| Trill | placeholder synth | Field recording |
| Whistle | placeholder synth | Field recording |
| Click | placeholder synth | Field recording |
| Call | placeholder synth | Field recording |

Same process as Kitchen for adding real assets.

## Original recordings (Ivar Karm)

None shipped yet. When added, mark clearly:

```
status: original
creator: Ivar Karm
license: All rights reserved (or chosen open license)
```

## Policy

- Do **not** assume a free download is redistributable inside an app.
- Prefer CC0, public domain, or licenses that explicitly allow redistribution in applications.
- Temporary development placeholders must remain clearly marked.
- Never ship test fixtures (`scripts/generate-audio-fixtures.mjs` output) as production sounds.
