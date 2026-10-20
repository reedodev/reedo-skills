#!/usr/bin/env python3
"""tts_tail.py - detect and fix TTS clips whose last syllable is chopped off.

Many TTS models (observed on Qwen3-TTS voice clone) stop the waveform while the voice
is still loud: the level drops from speech level to silence in 20-50 ms, so listeners
hear "they stopped mid-word". Natural speech decays over 100 ms or more.

Commands
  check  <wav...> [--min-ms 70]        report OK / CHOPPED per file (exit 1 if any CHOPPED)
  cut    <in.wav> <out.wav>            cut a synthesized sentinel word (see SKILL.md) at the
                                       last pause, then finish the tail. exit 3 = no pause found
  finish <in.wav> <out.wav>            trim trailing silence, cosine fade where the sound
                                       really ends, add a silent pad (no sentinel needed)

Defaults (override with flags): --silence-db -50 --min-pause 0.2 --fade 0.14 --pad 0.35
Requires: numpy, soundfile   (pip install numpy soundfile)

A PASS from `check` only measures how fast the level drops. It is not a substitute
for listening, and it cannot tell whether the last syllable was pronounced fully.
"""
import sys

import numpy as np
import soundfile as sf

WIN = 0.010  # 10 ms analysis window


def arg(name, default):
    if name in sys.argv:
        return float(sys.argv[sys.argv.index(name) + 1])
    return default


def level_db(x, sr):
    n = int(WIN * sr)
    frames = len(x) // n
    if frames == 0:
        return np.array([-120.0])
    y = x[: frames * n].reshape(frames, n)
    return 20 * np.log10(np.sqrt((y ** 2).mean(axis=1)) + 1e-12)


def mono(x):
    return x.mean(axis=1) if x.ndim == 2 else x


def decay_ms(x, sr):
    db = level_db(mono(x), sr)
    voiced = db[db > -45]
    if len(voiced) == 0:
        return None, None
    speech = float(np.median(voiced))
    above = np.where(db > -60)[0]
    end = int(above[-1])
    loud = np.where(db[: end + 1] > speech - 6)[0]
    k = int(loud[-1]) if len(loud) else end
    return (end - k + 1) * WIN * 1000, speech


def cmd_check(files):
    min_ms = arg("--min-ms", 70)
    bad = 0
    for p in files:
        x, sr = sf.read(p, always_2d=True)
        ms, speech = decay_ms(x, sr)
        if ms is None:
            print(f"SILENT  {p}")
            bad += 1
            continue
        ok = ms >= min_ms
        bad += not ok
        print(f"{'OK     ' if ok else 'CHOPPED'} {p}  speech {speech:.1f} dB  decay {ms:.0f} ms")
    return 1 if bad else 0


def finish(x, sr):
    """Trim trailing silence (-60 dB), keep 20 ms, cosine fade, add pad."""
    fade, pad = arg("--fade", 0.14), arg("--pad", 0.35)
    amp = np.abs(x).max(axis=1)
    idx = np.where(amp > 10 ** (-60 / 20))[0]
    end = (idx[-1] + 1) if len(idx) else len(x)
    y = x[: min(len(x), end + int(0.02 * sr))].copy()
    n = min(int(fade * sr), len(y))
    y[-n:] *= np.cos(np.linspace(0, np.pi / 2, n))[:, None]
    return np.vstack([y, np.zeros((int(pad * sr), y.shape[1]))])


def find_sentinel_cut(x, sr):
    """Return the sample index where the sentinel pause starts (+60 ms), or None.

    A valid pause is >= --min-pause seconds below --silence-db, and only 0.08-0.45 s
    of sound may follow it (that remainder is the sentinel word we throw away).
    """
    silence_db, min_pause = arg("--silence-db", -50), arg("--min-pause", 0.2)
    db = level_db(mono(x), sr)
    quiet = db < silence_db
    above = np.where(~quiet)[0]
    if len(above) == 0:
        return None
    last_sound = int(above[-1])
    best = None
    i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            length = (j - i) * WIN
            tail = (last_sound - j + 1) * WIN
            if length >= min_pause and j <= last_sound and 0.08 <= tail <= 0.45:
                best = i
            i = j
        else:
            i += 1
    if best is None:
        return None
    return int((best * WIN + 0.06) * sr)


def cmd_cut(src, dst):
    x, sr = sf.read(src, always_2d=True)
    cut = find_sentinel_cut(x, sr)
    if cut is None:
        print(f"NO_PAUSE {src}  (re-synthesize with another seed, or use `finish`)")
        return 3
    y = finish(x[:cut], sr)
    sf.write(dst, y, sr, subtype="PCM_16")
    print(f"CUT {src} at {cut / sr:.2f}s -> {dst} ({len(y) / sr:.2f}s)")
    return 0


def cmd_finish(src, dst):
    x, sr = sf.read(src, always_2d=True)
    y = finish(x, sr)
    sf.write(dst, y, sr, subtype="PCM_16")
    print(f"FINISHED {src} -> {dst} ({len(y) / sr:.2f}s)")
    return 0


def main():
    a = [s for s in sys.argv[1:]]
    if not a:
        print(__doc__)
        return 2
    cmd, rest = a[0], a[1:]
    pos = []
    skip = False
    for s in rest:
        if skip:
            skip = False
            continue
        if s.startswith("--"):
            skip = True
            continue
        pos.append(s)
    if cmd == "check" and pos:
        return cmd_check(pos)
    if cmd == "cut" and len(pos) == 2:
        return cmd_cut(*pos)
    if cmd == "finish" and len(pos) == 2:
        return cmd_finish(*pos)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
