#!/usr/bin/env python3
"""
chop_handpan.py - turn one long handpan recording into per-scale one-shot samples.

Two steps:

  1. analyze  Find every strike in the recording, estimate its pitch, and group
              the strikes into playing sections ("segments") separated by pauses.
              Prints a timeline and writes scripts/chop/out/analysis.{json,csv}.

  2. chop     Cut the best take of every note of every scale in the config into
              its own wav, and (with --write-app) wire the result into the app:
              sounds/notes/<scale-id>/*.wav, sounds/notes/manifest.json,
              js/instruments/handpan-scales.js, docs/AUDIO-LICENSES.md.

Usage:
  python3 scripts/chop/chop_handpan.py analyze raw/handpan.wav
  python3 scripts/chop/chop_handpan.py chop raw/handpan.wav --dry-run
  python3 scripts/chop/chop_handpan.py chop raw/handpan.wav --write-app

Needs: python3, numpy, scipy.  Input: WAV (16/24/32-bit int or float, any rate).
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from dataclasses import asdict, dataclass
from math import gcd, log2
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import find_peaks, resample_poly

TARGET_SR = 44100
PC_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
DEFAULT_CONFIG = HERE / "scales.config.json"
DEFAULT_OUT = HERE / "out"
DEFAULT_APP = REPO / "handpan-app"


def note_name(midi: int) -> str:
    return f"{PC_NAMES[midi % 12]}{midi // 12 - 1}"


# --------------------------------------------------------------------------- #
# Audio I/O
# --------------------------------------------------------------------------- #

def read_audio(path: Path):
    """Return (mono float32 at 44.1 kHz, TARGET_SR, original sample rate)."""
    try:
        sr, data = wavfile.read(str(path))
    except Exception as exc:  # noqa: BLE001
        sys.exit(
            f"Could not read {path}: {exc}\n"
            "Export it as a plain PCM WAV (16 or 24 bit) from Audacity/GarageBand and try again."
        )
    if data.dtype == np.int16:
        x = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        x = data.astype(np.float32) / 2147483648.0
    elif data.dtype == np.uint8:
        x = (data.astype(np.float32) - 128.0) / 128.0
    elif data.dtype in (np.float32, np.float64):
        x = data.astype(np.float32)
    else:
        sys.exit(f"Unsupported WAV sample type: {data.dtype}")
    if x.ndim == 2:
        x = x.mean(axis=1)
    x = x - float(np.mean(x))
    if sr != TARGET_SR:
        g = gcd(TARGET_SR, sr)
        x = resample_poly(x, TARGET_SR // g, sr // g).astype(np.float32)
    return x, TARGET_SR, sr


def write_wav16(path: Path, x: np.ndarray, sr: int) -> None:
    rng = np.random.default_rng(0)
    dither = (rng.random(len(x)) - rng.random(len(x))) / 32768.0  # TPDF, +-1 LSB
    y = np.clip(x + dither, -1.0, 1.0)
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(path), sr, np.round(y * 32767.0).astype(np.int16))


# --------------------------------------------------------------------------- #
# Strike detection + pitch
# --------------------------------------------------------------------------- #

def envelope_db(x: np.ndarray, sr: int, win: float, hop: float):
    n, h = int(win * sr), int(hop * sr)
    sq = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)])
    starts = np.arange(0, max(1, len(x) - n), h)
    rms = np.sqrt((sq[starts + n] - sq[starts]) / n)
    return 20.0 * np.log10(rms + 1e-9), starts


def spectral_flux(x: np.ndarray, sr: int, n_fft: int = 1024, hop: int = 220, lag: int = 3):
    """SuperFlux-style onset strength: new energy vs. a max-filtered earlier frame.

    Comparing against the local maximum of an earlier frame ignores ringing partials,
    small pitch wobble and the noise floor, so only genuinely new strikes stand out.
    """
    from scipy.ndimage import maximum_filter1d

    win = np.hanning(n_fft).astype(np.float32)
    freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
    band = (freqs >= 120.0) & (freqs <= 7000.0)
    total_frames = max(0, (len(x) - n_fft) // hop + 1)
    out = np.zeros(total_frames, dtype=np.float32)
    tail = None  # last `lag` log-spectra of the previous chunk
    done = 0
    while done < total_frames:
        nf = min(4096, total_frames - done)
        seg = x[done * hop : done * hop + (nf - 1) * hop + n_fft]
        frames = np.lib.stride_tricks.sliding_window_view(seg, n_fft)[::hop][:nf]
        mag = np.abs(np.fft.rfft(frames * win, axis=1))[:, band]
        S = np.log1p(20.0 * mag).astype(np.float32)
        full = S if tail is None else np.vstack([tail, S])
        ref = maximum_filter1d(full, size=3, axis=1)
        off = 0 if tail is None else len(tail)
        for i in range(S.shape[0]):
            j = off + i
            if j - lag < 0:
                continue
            out[done + i] = np.maximum(full[j] - ref[j - lag], 0.0).sum()
        tail = full[-lag:]
        done += nf
    return out, hop


def detect_onsets(x: np.ndarray, sr: int, sens: float = 0.18, min_gap: float = 0.15):
    from scipy.signal import butter, sosfilt

    n_fft = 1024
    flux, hop = spectral_flux(x, sr, n_fft=n_fft)
    e, _starts = envelope_db(x, sr, 0.02, 0.005)
    hop_s = 0.005
    if len(flux) == 0:
        return [], e, hop_s
    ref = float(np.percentile(flux, 99.5))
    floor = float(np.percentile(e, 5))
    gate = max(floor + 12.0, -62.0)
    peaks, _ = find_peaks(flux, height=sens * ref, prominence=0.5 * sens * ref,
                          distance=max(1, int(min_gap * sr / hop)))
    xh = sosfilt(butter(4, 800.0, "highpass", fs=sr, output="sos"), x).astype(np.float32)
    onsets: list[int] = []
    last = -10**12
    for f in peaks:
        a = int(f * hop)
        b = min(len(x), a + n_fft + hop)
        k = min(len(e) - 1, int((a + n_fft) / (hop_s * sr)))
        if e[k] < gate:
            continue
        seg = xh[a:b].astype(np.float64)
        fw, fh = int(0.001 * sr), int(0.0005 * sr)
        if len(seg) <= fw * 2:
            continue
        sq = np.concatenate([[0.0], np.cumsum(seg**2)])
        fs = np.arange(0, len(seg) - fw, fh)
        fdb = 10.0 * np.log10((sq[fs + fw] - sq[fs]) / fw + 1e-18)
        hit = int(fs[int(np.argmax(fdb >= fdb.max() - 12.0))])
        on = a + hit
        if on - last >= min_gap * sr:
            onsets.append(on)
            last = on
    return onsets, e, hop_s


def estimate_pitch(x: np.ndarray, sr: int, on: int, next_on: int | None):
    """Fundamental of the ring after the attack. Returns (freq_hz, midi_exact) or (None, None)."""
    a = on + int(0.08 * sr)
    b = on + int(0.50 * sr)
    if next_on is not None:
        b = min(b, next_on - int(0.01 * sr))
    b = min(b, len(x))
    if b - a < int(0.08 * sr):
        a = on + int(0.03 * sr)
    if b - a < int(0.05 * sr):
        return None, None
    seg = x[a:b].astype(np.float64)
    seg = seg * np.hanning(len(seg))
    nfft = 1 << 17
    spec = np.abs(np.fft.rfft(seg, n=nfft))
    freqs = np.fft.rfftfreq(nfft, 1.0 / sr)
    band = (freqs >= 50.0) & (freqs <= 2500.0)
    if not band.any() or spec[band].max() <= 0:
        return None, None
    s = np.where(band, spec, 0.0)
    peaks, _ = find_peaks(s, height=0.12 * s.max(), distance=int(8.0 / (freqs[1] - freqs[0])))
    if len(peaks) == 0:
        return None, None

    def mag_near(f: float) -> float:
        lo, hi = int(f * 0.975 / freqs[1]), int(f * 1.025 / freqs[1]) + 1
        return float(spec[lo:hi].max()) if hi > lo and hi <= len(spec) else 0.0

    cands = [(float(freqs[p]), int(p)) for p in peaks if s[p] >= 0.2 * s.max()]
    scored = []
    for f, p in cands:
        scored.append((spec[p] + 0.7 * mag_near(2 * f) + 0.5 * mag_near(3 * f), f, p))
    best = max(sc for sc, _, _ in scored)
    # prefer the lowest candidate whose score is close to the best (avoids octave-up errors)
    sc, f, p = min((t for t in scored if t[0] >= 0.85 * best), key=lambda t: t[1])
    # parabolic interpolation on log magnitude
    if 1 <= p < len(spec) - 1:
        l, c, r = np.log(spec[p - 1] + 1e-12), np.log(spec[p] + 1e-12), np.log(spec[p + 1] + 1e-12)
        denom = l - 2 * c + r
        off = 0.5 * (l - r) / denom if denom != 0 else 0.0
        f = float(freqs[p] + off * (freqs[1] - freqs[0]))
    return f, 69.0 + 12.0 * log2(f / 440.0)


@dataclass
class Onset:
    idx: int
    t: float
    peak_db: float
    clean_ms: float
    next_gap_ms: float | None
    freq: float | None
    midi_exact: float | None
    midi: int | None
    cents: float | None


def analyze_audio(x: np.ndarray, sr: int, sens: float, min_gap: float) -> list[Onset]:
    idxs, e, hop_s = detect_onsets(x, sr, sens, min_gap)
    out: list[Onset] = []
    for n, on in enumerate(idxs):
        nxt = idxs[n + 1] if n + 1 < len(idxs) else None
        peak = float(np.max(np.abs(x[on : on + int(0.1 * sr)])) + 1e-9)
        k = min(len(e) - 1, int(on / (hop_s * sr)))
        pe = float(np.max(e[k : k + 16]))
        end_k = min(len(e), k + 1600)
        if nxt is not None:
            end_k = min(end_k, int(nxt / (hop_s * sr)))
        sub = e[k:end_k]
        below = np.where(sub < pe - 45.0)[0]
        clean_ms = float((below[0] if len(below) else len(sub)) * hop_s * 1000.0)
        f, m = estimate_pitch(x, sr, on, nxt)
        mi = int(round(m)) if m is not None else None
        out.append(
            Onset(
                idx=on,
                t=on / sr,
                peak_db=20.0 * log2(peak) * 0.30103,
                clean_ms=clean_ms,
                next_gap_ms=((nxt - on) / sr * 1000.0) if nxt is not None else None,
                freq=f,
                midi_exact=m,
                midi=mi,
                cents=((m - mi) * 100.0) if m is not None else None,
            )
        )
    return out


# --------------------------------------------------------------------------- #
# Segments + scale matching
# --------------------------------------------------------------------------- #

def segment_onsets(onsets: list[Onset], gap_s: float):
    segs: list[list[Onset]] = []
    for o in onsets:
        if segs and o.t - segs[-1][-1].t <= gap_s:
            segs[-1].append(o)
        else:
            segs.append([o])
    return segs


def scale_midis(scale: dict) -> set[int]:
    return {scale["rootMidi"] + iv for iv in scale["intervals"]}


def match_segment(seg: list[Onset], scales: list[dict]):
    seen = {o.midi for o in seg if o.midi is not None and o.cents is not None and abs(o.cents) < 45}
    if not seen:
        return None, 0.0, False
    scored = []
    for sc in scales:
        t = scale_midis(sc)
        scored.append((len(seen & t) / len(seen | t), sc))
    scored.sort(key=lambda p: -p[0])
    top = scored[0]
    tied = len(scored) > 1 and abs(scored[1][0] - top[0]) < 1e-9
    return top[1], top[0], tied


def cmd_analyze(args) -> int:
    x, sr, orig = read_audio(Path(args.audio))
    print(f"Loaded {args.audio}: {len(x) / sr:.1f}s (source {orig} Hz -> {sr} Hz mono)")
    onsets = analyze_audio(x, sr, args.sens, args.min_gap)
    print(f"Found {len(onsets)} strikes.\n")
    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)
    with open(outdir / "analysis.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["n", "time_s", "note", "midi", "cents", "peak_db", "clean_ms", "next_gap_ms"])
        for n, o in enumerate(onsets):
            w.writerow([n, f"{o.t:.3f}", note_name(o.midi) if o.midi is not None else "?", o.midi,
                        f"{o.cents:.1f}" if o.cents is not None else "", f"{o.peak_db:.1f}",
                        f"{o.clean_ms:.0f}", f"{o.next_gap_ms:.0f}" if o.next_gap_ms else ""])
    segs = segment_onsets(onsets, args.gap)
    config = load_config(Path(args.config)) if Path(args.config).exists() else {"scales": []}
    print(f"{'seg':>3} {'start':>8} {'end':>8} {'hits':>5}  notes (by pitch)                 best config match")
    summary = []
    for n, seg in enumerate(segs):
        midis = sorted({o.midi for o in seg if o.midi is not None})
        names = " ".join(note_name(m) for m in midis)
        sc, score, tied = match_segment(seg, config["scales"]) if config["scales"] else (None, 0.0, False)
        label = f"{sc['id']} ({score:.2f}{', AMBIGUOUS' if tied else ''})" if sc else "-"
        print(f"{n:>3} {seg[0].t:>8.1f} {seg[-1].t + 3:>8.1f} {len(seg):>5}  {names:<32} {label}")
        summary.append({"segment": n, "start": round(seg[0].t - 0.2, 3), "end": round(seg[-1].t + 3.0, 3),
                        "hits": len(seg), "notes": [note_name(m) for m in midis],
                        "match": sc["id"] if sc else None, "score": round(score, 3), "ambiguous": tied})
    with open(outdir / "analysis.json", "w") as fh:
        json.dump({"audio": str(args.audio), "duration_s": round(len(x) / sr, 2),
                   "strikes": [asdict(o) for o in onsets], "segments": summary}, fh, indent=1)
    print(f"\nWrote {outdir / 'analysis.csv'} and {outdir / 'analysis.json'}")
    return 0


# --------------------------------------------------------------------------- #
# Chop
# --------------------------------------------------------------------------- #

def load_config(path: Path) -> dict:
    cfg = json.loads(path.read_text())
    for sc in cfg["scales"]:
        for key in ("id", "label", "rootMidi", "intervals"):
            if key not in sc:
                sys.exit(f"Scale in {path} is missing '{key}': {sc}")
    ids = [sc["id"] for sc in cfg["scales"]]
    if len(ids) != len(set(ids)):
        sys.exit("Duplicate scale ids in config")
    return cfg


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def assign_ranges(cfg: dict, onsets: list[Onset], gap_s: float):
    """Return {scale_id: [(start, end), ...]} from explicit ranges, else by pitch-set match."""
    ranges: dict[str, list[tuple[float, float]]] = {}
    auto_needed = []
    for sc in cfg["scales"]:
        if sc.get("ranges"):
            ranges[sc["id"]] = [tuple(r) for r in sc["ranges"]]
        elif sc.get("start") is not None and sc.get("end") is not None:
            ranges[sc["id"]] = [(sc["start"], sc["end"])]
        else:
            auto_needed.append(sc)
    if auto_needed:
        segs = segment_onsets(onsets, gap_s)
        for seg in segs:
            sc, score, tied = match_segment(seg, auto_needed)
            if sc is None or score < 0.75 or tied:
                continue
            ranges.setdefault(sc["id"], []).append((seg[0].t - 0.2, seg[-1].t + 3.0))
    return ranges


def pick_best(cands: list[Onset], scale_peak_db: float, max_ms: float):
    return max(cands, key=lambda o: min(o.clean_ms, max_ms) + 15.0 * (o.peak_db - scale_peak_db))


def extract(x: np.ndarray, sr: int, o: Onset, onsets: list[Onset], max_s: float):
    """Cut one note: 3 ms pre-roll, ends at the next strike or when the ring has died, with a fade-out."""
    start = max(0, o.idx - int(0.003 * sr))
    end = min(len(x), o.idx + int(max_s * sr))
    truncated = False
    pos = next((i for i, q in enumerate(onsets) if q.idx == o.idx), None)
    if pos is not None and pos + 1 < len(onsets):
        nxt = onsets[pos + 1].idx - int(0.004 * sr)
        if nxt < end:
            end, truncated = nxt, True
    ring_end = o.idx + int((o.clean_ms / 1000.0 + 0.25) * sr)
    if ring_end < end:
        end, truncated = ring_end, False
    seg = x[start:end].copy()
    fade = int((0.03 if truncated else 0.25) * sr)
    fade = min(fade, len(seg) // 2)
    if fade > 0:
        seg[-fade:] *= 0.5 * (1.0 + np.cos(np.linspace(0.0, np.pi, fade)))
    return seg, truncated


def chop_one_scale(sc, x, sr, onsets, in_range, args, notes_dir, results, report):
    """Pick the best strike for each note of one scale from `in_range`, cut it, record manifest entries."""
    scale_peak = max((o.peak_db for o in in_range), default=-20.0)
    chosen: list[tuple[int, Onset]] = []
    missing: list[str] = []
    for iv in sorted(set(sc["intervals"])):
        m = sc["rootMidi"] + iv
        cands = [o for o in in_range if o.midi_exact is not None and abs(o.midi_exact - m) <= args.tol
                 and o.clean_ms >= args.min_ring_ms]
        if not cands:
            missing.append(note_name(m))
            continue
        chosen.append((m, pick_best(cands, scale_peak, args.max_seconds * 1000.0 * 0.6)))
    if not chosen:
        report.append(f"  - {sc['id']}: no matching notes ({', '.join(missing)} missing)")
        return
    cuts = [(m, o, *extract(x, sr, o, onsets, args.max_seconds)) for m, o in chosen]
    peak = max(float(np.max(np.abs(c[2]))) for c in cuts)
    gain = min(0.891 / max(peak, 1e-6), 15.0)
    entries = []
    for m, o, seg, trunc in cuts:
        rel = f"{sc['id']}/{note_name(m)}_v1.wav"
        if not args.dry_run and args.write_app:
            write_wav16(notes_dir / rel, seg * gain, sr)
        entries.append({"scaleId": sc["id"], "file": rel, "midi": m, "note": note_name(m),
                        "cents": round(o.cents or 0.0, 1), "type": "one-shot",
                        "durationMs": int(len(seg) / sr * 1000), "truncated": bool(trunc)})
    results[sc["id"]] = entries
    short = [e["note"] for e in entries if e["truncated"]]
    line = f"  - {sc['id']}: {len(entries)}/{len(set(sc['intervals']))} notes"
    if missing:
        line += f", MISSING {', '.join(missing)}"
    if short:
        line += f", cut short by next strike: {', '.join(short)}"
    report.append(line)


def cmd_chop(args) -> int:
    cfg = load_config(Path(args.config))
    x, sr, orig = read_audio(Path(args.audio))
    print(f"Loaded {args.audio}: {len(x) / sr:.1f}s (source {orig} Hz -> {sr} Hz mono)")
    onsets = analyze_audio(x, sr, args.sens, args.min_gap)
    print(f"Found {len(onsets)} strikes.")
    ranges = assign_ranges(cfg, onsets, args.gap)
    app = Path(args.app_dir)
    notes_dir = app / "sounds" / "notes"
    results: dict[str, list[dict]] = {}
    report: list[str] = []
    for sc in cfg["scales"]:
        rs = ranges.get(sc["id"])
        if not rs:
            report.append(f"  - {sc['id']}: no section found (add start/end or ranges to the config)")
            continue
        in_range = [o for o in onsets if any(a <= o.t < b for a, b in rs)]
        chop_one_scale(sc, x, sr, onsets, in_range, args, notes_dir, results, report)
    print("\nResult per scale:")
    print("\n".join(report))
    if args.dry_run or not args.write_app:
        print("\nNothing written (use --write-app to write samples + app files; --dry-run to only preview).")
        return 0
    write_app_files(cfg, results, app, notes_dir)
    print(f"\nWrote {sum(len(v) for v in results.values())} wavs under {notes_dir}")
    return 0


def cmd_chop_dir(args) -> int:
    """One recording per scale. Each scale in the config names its own `file` inside the audio folder;
    every strike in that file belongs to that scale (up/down runs give several takes per note, the
    cleanest one wins)."""
    cfg = load_config(Path(args.config))
    folder = Path(args.audio)
    app = Path(args.app_dir)
    notes_dir = app / "sounds" / "notes"
    results: dict[str, list[dict]] = {}
    report: list[str] = []
    for sc in cfg["scales"]:
        if not sc.get("file"):
            continue
        path = folder / sc["file"]
        if not path.exists():
            report.append(f"  - {sc['id']}: file {sc['file']} not found in {folder}")
            continue
        x, sr, orig = read_audio(path)
        onsets = analyze_audio(x, sr, args.sens, args.min_gap)
        print(f"{sc['file']}: {len(x) / sr:.1f}s, {len(onsets)} strikes")
        chop_one_scale(sc, x, sr, onsets, onsets, args, notes_dir, results, report)
    print("\nResult per scale:")
    print("\n".join(report) or "  (no scale in the config has a \"file\" entry)")
    if args.dry_run or not args.write_app or not results:
        print("\nNothing written (use --write-app to write samples + app files; --dry-run to only preview).")
        return 0
    write_app_files(cfg, results, app, notes_dir)
    print(f"\nWrote {sum(len(v) for v in results.values())} wavs under {notes_dir}")
    return 0


# --------------------------------------------------------------------------- #
# App wiring
# --------------------------------------------------------------------------- #

SCALES_JS = """/** handpan-scales.js - one entry per scale that has its own recorded samples.
 *  Generated by scripts/chop/chop_handpan.py (safe to edit by hand). */
function semiToCents(s) { return s * 100; }

export const HANDPAN_SCALES = [
%s];

export function scaleToCents(scale) {
  if (Array.isArray(scale.cents) && scale.cents.length) {
    return scale.cents.slice(0, 9);
  }
  const iv = scale.intervals || [0, 7, 8, 10, 12, 14, 15, 17, 19];
  return iv.slice(0, 9).map(semiToCents);
}
"""


def write_app_files(cfg: dict, results: dict[str, list[dict]], app: Path, notes_dir: Path) -> None:
    mpath = notes_dir / "manifest.json"
    manifest = json.loads(mpath.read_text()) if mpath.exists() else {}
    # Entries without a scaleId are the old "universal bank" (owner-notes-9 / library-v1).
    # The per-scale manifest replaces them, so drop them; the wav files themselves stay on disk.
    legacy = [s for s in manifest.get("samples", []) if not s.get("scaleId")]
    if legacy:
        print(f"Dropping {len(legacy)} legacy manifest entries without a scaleId (files are left on disk).")
    samples = [s for s in manifest.get("samples", []) if s.get("scaleId") and s["scaleId"] not in results]
    for entries in results.values():
        samples.extend(entries)
    sampled_ids = {s["scaleId"] for s in samples if s.get("scaleId")}
    by_id = {sc["id"]: sc for sc in cfg["scales"]}
    # keep scales already in the manifest even if they are not in this config
    old = {s["id"]: s for s in manifest.get("scales", [])}
    scales = []
    for sid in [sc["id"] for sc in cfg["scales"]] + [i for i in old if i not in by_id]:
        if sid in sampled_ids:
            src = by_id.get(sid) or old[sid]
            scales.append({"id": sid, "label": src["label"], "rootMidi": src["rootMidi"]})
    order = {s["id"]: n for n, s in enumerate(scales)}
    samples.sort(key=lambda s: (order.get(s["scaleId"], 99), s["midi"]))
    manifest.update({
        "version": 3,
        "status": manifest.get("status", "owner-prototype"),
        "license_note": manifest.get("license_note", "Owner: Ivar Karm. Original recordings. See docs/AUDIO-LICENSES.md."),
        "description": "Per-scale owner handpan samples chopped from one multi-scale recording "
                       "(scripts/chop/chop_handpan.py). Each scale plays only its own notes.",
        "fallbackScale": manifest.get("fallbackScale") if manifest.get("fallbackScale") in sampled_ids
        else (scales[0]["id"] if scales else None),
        "sampleRate": TARGET_SR,
        "channels": 1,
        "scales": scales,
        "samples": samples,
    })
    mpath.write_text(json.dumps(manifest, indent=1) + "\n")

    sj = []
    for sc in scales:
        c = by_id.get(sc["id"])
        if not c:
            continue
        sj.append("  {\n    id: %s,\n    label: %s,\n    tuning: '12-TET',\n    intervals: %s,\n"
                  "    rootMidi: %d,\n    rootPc: %d,\n  },\n"
                  % (json.dumps(c["id"]).replace('"', "'"), json.dumps(c["label"]).replace('"', "'"),
                     json.dumps(c["intervals"]), c["rootMidi"], c["rootMidi"] % 12))
    if sj:
        (app / "js" / "instruments" / "handpan-scales.js").write_text(SCALES_JS % "".join(sj))

    doc = app.parent / "docs" / "AUDIO-LICENSES.md"
    if doc.exists():
        rows = ["| File | Note | MIDI | SHA-256 | Source |", "|---|---|---|---|---|"]
        for s in samples:
            if s.get("scaleId") in results:
                p = notes_dir / s["file"]
                rows.append(f"| `handpan-app/sounds/notes/{s['file']}` | {s['note']} | {s['midi']} | "
                            f"`{sha256_file(p) if p.exists() else 'pending'}` | Ivar Karm (owner recording) |")
        block = ("<!-- chop:begin -->\n### Chopped per-scale samples (auto-generated)\n\n"
                 "Cut from one owner-recorded multi-handpan session by `scripts/chop/chop_handpan.py`. "
                 "Ivar Karm holds all rights and permits embedding and distribution in this app.\n\n"
                 + "\n".join(rows) + "\n<!-- chop:end -->")
        text = doc.read_text()
        if "<!-- chop:begin -->" in text:
            text = re.sub(r"<!-- chop:begin -->.*?<!-- chop:end -->", lambda _: block, text, flags=re.S)
        else:
            text = text.rstrip() + "\n\n" + block + "\n"
        doc.write_text(text)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("analyze", "chop", "chop-dir"):
        p = sub.add_parser(name)
        p.add_argument("audio")
        p.add_argument("--config", default=str(DEFAULT_CONFIG))
        p.add_argument("--sens", type=float, default=0.18, help="strike threshold as a fraction of a hard strike (lower = detects softer strikes, risks false hits)")
        p.add_argument("--min-gap", type=float, default=0.15, help="min seconds between strikes")
        p.add_argument("--gap", type=float, default=3.0, help="pause (s) that separates playing sections")
        if name == "analyze":
            p.add_argument("--out", default=str(DEFAULT_OUT))
        else:
            p.add_argument("--app-dir", default=str(DEFAULT_APP))
            p.add_argument("--tol", type=float, default=0.6, help="pitch tolerance in semitones")
            p.add_argument("--max-seconds", type=float, default=6.0)
            p.add_argument("--min-ring-ms", type=float, default=250.0, help="ignore strikes that ring shorter")
            p.add_argument("--write-app", action="store_true")
            p.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    return {"analyze": cmd_analyze, "chop": cmd_chop, "chop-dir": cmd_chop_dir}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
