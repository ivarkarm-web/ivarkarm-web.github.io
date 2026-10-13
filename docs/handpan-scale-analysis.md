# Handpan library scale analysis

**Source:** Owner multi-handpan practice recording (~6m16s). Not committed.
**Date:** 2026-10-13

## Method

1. Mono conversion, onset detection, autocorrelation pitch.
2. Sliding 9-note windows matched to known handpan interval patterns.
3. Best (pattern × root) picks with score ≥ 7/9.
4. One-shots cut per note; peak-normalized to −3 dBFS.

## Shipped instruments (scale menu)

| ID | Label | Root | Notes | Source |
|----|-------|------|------:|--------|
| d3-kurd | D3 Kurd | D3 | 9 | Owner sequential take (`owner-notes-9`) |
| d3-aeolian | D3 Aeolian | D3 | 8 | Library extract |
| d3-mixolydian | D3 Mixolydian | D3 | 8 | Library extract |
| b2-lasirena | B2 LaSirena | B2 | 8 | Library extract |
| f3-amara | F3 Amara | F3 | 7 | Library extract |
| f3-mixolydian | F3 Mixolydian | F3 | 7 | Library extract |
| c3-hijaz | C3 Hijaz | C3 | 7 | Library extract |
| d3-dorian | D3 Dorian | D3 | 7 | Library extract |
| d3-amara | D3 Amara | D3 | 7 | Library extract |
| d3-lasirena | D3 LaSirena | D3 | 7 | Library extract |
| g3-lasirena | G3 LaSirena | G3 | 7 | Library extract |
| c4-dorian | C4 Dorian | C4 | 7 | Library extract |

The old theoretical scale list (50+ entries) was removed. The menu only shows these sampled instruments.

## Confidence

Some packs have 7–8 notes (missing one pattern tone). Missing notes use synth or pitch-shifted nearest sample. Ivar should listen and drop any that sound wrong.

## Size

~5–6 MB of WAVs under `handpan-app/sounds/notes/<scale-id>/`.
