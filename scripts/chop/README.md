# Chop one long recording into per-scale handpan samples

`chop_handpan.py` turns one long multi-handpan take into one-shot samples for every scale,
and wires them into the app. Needs `python3`, `numpy`, `scipy`.

## 1. Add the raw recording

Put the WAV at `raw/handpan.wav` on this branch (`feat/chop-20-scales`). Do not merge the raw file
into `main`: GitHub Pages deploys from `main`, and the 99 MB file only needs to live here.
GitHub rejects single files over 100 MB, so push from a normal `git push`, not the web uploader.

## 2. Describe the scales

Edit `scales.config.json`: one entry per handpan in the recording (`id`, `label`, `rootMidi`,
`intervals` in semitones above the root; MIDI 50 = D3). It ships with 12 scales; add the rest.

## 3. Analyze

```bash
python3 scripts/chop/chop_handpan.py analyze raw/handpan.wav
```

Prints a timeline of playing sections (separated by pauses) with the notes heard in each and the
best-matching scale. If two scales share the same notes, or a match looks wrong, give that scale
`"start"`/`"end"` seconds (or `"ranges": [[s, e], ...]`) in the config.

## 4. Preview, then write

```bash
python3 scripts/chop/chop_handpan.py chop raw/handpan.wav --dry-run
python3 scripts/chop/chop_handpan.py chop raw/handpan.wav --write-app
```

`--write-app` writes `handpan-app/sounds/notes/<scale-id>/<Note>_v1.wav`, a per-scale
`sounds/notes/manifest.json`, `js/instruments/handpan-scales.js` (only scales that got samples are
listed) and the license table in `docs/AUDIO-LICENSES.md`.

The report lists notes that are missing and notes that were cut short because the next strike came
before the ring died. For long natural ring-outs, leave a gap between strikes when you record.

## Playback

When the manifest carries a `scaleId` per sample, the app switches to per-scale mode
(`js/note-sample-bank.js`): a scale plays only its own recordings, loads its files the first time it is
picked, stretches a note at most 4 semitones before falling back to synth, and plays the sample dry.
Add `?layers=1` to the page URL to compare against the old three-layer filtered blend.

## Test it without real audio

```bash
python3 scripts/chop/tests/make_fake_recording.py /tmp/fake.wav
python3 scripts/chop/chop_handpan.py analyze /tmp/fake.wav
```
