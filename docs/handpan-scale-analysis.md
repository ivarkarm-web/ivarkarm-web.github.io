# Handpan library scale analysis

**Source:** Owner multi-handpan practice recording (~6m16s, 44.1 kHz stereo 24-bit, ~99.6 MB). Not committed to the repo.
**Date:** 2026-10-13

## Method

1. Converted to mono 16-bit for analysis.
2. Onset detection (smoothed amplitude envelope, peak picking, min spacing 0.5 s).
3. Pitch estimate via autocorrelation; rejected hits with >0.3 semitone residual or out-of-range F0.
4. Matched 9-note windows to known handpan interval patterns (Celtic/Kurd, Hijaz, Amara, Dorian, etc.).
5. Per-MIDI "best hit" selected by amplitude × pitch confidence (near-clip penalized).
6. One-shots cut with 20 ms pre-roll, up to 1.15 s body (or next onset), 60 ms linear fade-out, peak-normalized to −3 dBFS.

## Findings

- ~319 clean pitched hits after filtering (re-analysis ~477 with looser filter).
- Content is mixed: many roots and scales, ascending/descending runs, soft/double hits.
- Pattern matching found several partial matches (score 7–8 / 9) but **no single textbook 9-note D Kurd run with full confidence** in this library.
- Therefore **library-v1 ships as a pitch bank** (extra MIDI coverage), not as named multi-scale sample packs yet.
- **owner-notes-9** remains the authoritative D Kurd nine-note set from the dedicated sequential take.

## Shipped

| Bank | Role | Notes |
|------|------|-------|
| owner-notes-9 | D Kurd (D3–A4) | Prior dedicated recording; unchanged |
| library-v1 | Extra pitches (C3–C5 range, non-overlapping MIDI) | 16 one-shots |

## Skipped / low confidence

- Named multi-scale packs (Amara F3, Hijaz C3, Equinox A2, etc.) need manual listening and possible re-cut with longer isolated ring-outs. Marked low-confidence until Ivar confirms by ear.
- Raw 99.6 MB source file is not in the repository.

## Total audio added this stage

About **1.4 MB** under `library-v1/` (16 files). Combined with owner-notes-9 ≈ **2 MB**.
