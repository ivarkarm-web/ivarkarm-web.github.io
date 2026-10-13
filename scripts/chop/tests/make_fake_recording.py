"""Synthetic stand-in for a long multi-handpan recording, used only to test chop_handpan.py.

Three scales, each played up the notes twice (a quick take and a slow, ringing take),
with a pause between scales, a little detune, stereo, 48 kHz, 16-bit.
"""
from __future__ import annotations

import numpy as np
from scipy.io import wavfile

SR = 48000
SCALES = {
    "d3-kurd": (50, [0, 7, 8, 10, 12, 14, 15, 17, 19]),
    "c3-hijaz": (48, [0, 7, 8, 11, 12, 14, 15, 17, 19]),
    "f3-amara": (53, [0, 7, 10, 12, 14, 15, 17, 19, 22]),
}


def strike(midi: float, dur: float, cents: float = 8.0) -> np.ndarray:
    f = 440.0 * 2 ** ((midi - 69 + cents / 100.0) / 12.0)
    t = np.arange(int(dur * SR)) / SR
    sig = (
        1.00 * np.sin(2 * np.pi * f * t) * np.exp(-t / 1.4)
        + 0.55 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 1.0)
        + 0.18 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.6)
    )
    attack = np.minimum(1.0, t / 0.002)
    noise = np.random.default_rng(int(midi * 10)).standard_normal(len(t)) * np.exp(-t / 0.004) * 0.25
    fade = np.minimum(1.0, (dur - t) / 0.08)  # no click when the synthetic note ends
    return (sig * attack + noise) * fade * 0.35


def build(path: str) -> dict:
    rng = np.random.default_rng(1)
    total = int(120 * SR)
    mix = rng.standard_normal(total) * 10 ** (-66 / 20)  # noise floor
    truth: dict[str, dict] = {}
    cursor = 2.0
    for sid, (root, ivs) in SCALES.items():
        start = cursor
        for spacing in (0.9, 1.6):
            for iv in ivs:
                s = strike(root + iv, 3.0)
                a = int(cursor * SR)
                mix[a : a + len(s)] += s[: max(0, total - a)]
                cursor += spacing
            cursor += 0.5
        truth[sid] = {"start": start, "end": cursor + 3.0, "root": root, "ivs": ivs}
        cursor += 6.0
    mix = mix[: int((cursor + 2) * SR)]
    stereo = np.stack([mix, mix * 0.9], axis=1)
    wavfile.write(path, SR, np.round(np.clip(stereo, -1, 1) * 32767).astype(np.int16))
    return truth


if __name__ == "__main__":
    import sys

    print(build(sys.argv[1] if len(sys.argv) > 1 else "fake_recording.wav"))
