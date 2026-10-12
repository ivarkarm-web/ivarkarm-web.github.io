# Pionier — Sample Sources & Licensing

Every external audio asset used by Pionier must be listed in [`docs/AUDIO-LICENSES.md`](../docs/AUDIO-LICENSES.md).

## Current shipped audio

No third-party audio files are shipped after the sample-removal change. Handpan playback uses the procedural synthesis fallback. Ambient beds are generated through Web Audio.

## Removed sample set

The previous `sounds/notes/*.mp3` set was attributed to the Haganenote virtual-handpan project, but an explicit license permitting redistribution in this app was not established. The files have been removed; per-file provenance and the upstream references remain documented in `docs/AUDIO-LICENSES.md`.

## Policy

- Do **not** assume a free download is redistributable inside an app.
- Prefer CC0, public domain, or licenses that explicitly allow redistribution in applications.
- Record source, creator, exact license, commercial-use permission, attribution, and the license URL/text for every external sound.
- Keep test fixtures out of production assets.
