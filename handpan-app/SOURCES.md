# Pionier — Sample Sources & Licensing

Every external audio asset used by Pionier must be listed here.

## Handpan (shipped)

| File pattern | Source | Creator | License | Status | Notes |
|--------------|--------|---------|---------|--------|-------|
| `sounds/notes/*.mp3` | haganenote/virtual-handpan (www.haganenote.com/vst) | Haganenote | See upstream project — used for virtual instrument playback | modified (one-shots, runtime pitch-shift) | Dry hits mapped by MIDI. Manifest: `sounds/notes/manifest.json` |

Upstream: https://github.com/haganenote/virtual-handpan

These are **not** claimed as original Ivar Karm recordings. Attribution to Haganenote is required when redistributing.

## Policy

- Do **not** assume a free download is redistributable inside an app.
- Prefer CC0, public domain, or licenses that explicitly allow redistribution in applications.
- Temporary development placeholders must remain clearly marked.
- Never ship test fixtures as production sounds.
