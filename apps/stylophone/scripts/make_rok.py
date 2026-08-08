#!/usr/bin/env python3
"""Generate a ROK-STYLE drum/bass sample kit as static WAV one-shots.

ponytail: this is a TEMPORARY asset generator. The locked spec is the user's
own Stylophone Beat ROK bank sampled from hardware; that asset doesn't exist
yet, so we synthesize a plausible stand-in with numpy. Swapping in the real
samples later = replace public/rok/*.wav with the same filenames (kick, snare,
hat, bass_C2), no code change — the Tone.js engine loads by name.

Outputs (44.1kHz, mono, 16-bit PCM) into public/rok/:
  kick.wav      - sine pitch-drop + click transient (low-heavy)
  snare.wav     - tonal body + noise burst (mid + broadband)
  hat.wav       - short high-passed noise (high-heavy)
  bass_C2.wav   - sustained tonal note at C2 (65.41 Hz); the Sampler ROOT.

Run:  python scripts/make_rok.py [--selfcheck]
"""
from __future__ import annotations

import os
import sys

import numpy as np
from scipy.io import wavfile

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "rok")

# The natural pitch of bass_C2.wav — Tone.Sampler transposes every pad from here.
BASS_ROOT_NOTE = "C2"
BASS_ROOT_HZ = 65.41


def _env(n: int, attack: float, decay: float) -> np.ndarray:
    """Simple attack + exponential decay envelope, length n samples."""
    a = max(1, int(attack * SR))
    env = np.ones(n)
    env[:a] = np.linspace(0.0, 1.0, a)
    t = np.arange(n) / SR
    env *= np.exp(-t / decay)
    return env


def _norm(x: np.ndarray, peak: float = 0.9) -> np.ndarray:
    m = np.max(np.abs(x)) or 1.0
    return (x / m) * peak


def make_kick() -> np.ndarray:
    dur = 0.5
    t = np.arange(int(dur * SR)) / SR
    # pitch drops 120 -> 45 Hz exponentially
    f = 45 + (120 - 45) * np.exp(-t / 0.06)
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * _env(len(t), 0.001, 0.12)
    click = (np.random.default_rng(1).standard_normal(len(t)) * np.exp(-t / 0.003)) * 0.12
    return _norm(body + click).astype(np.float32)


def make_snare() -> np.ndarray:
    dur = 0.22
    t = np.arange(int(dur * SR)) / SR
    rng = np.random.default_rng(2)
    tone = (np.sin(2 * np.pi * 180 * t) + 0.6 * np.sin(2 * np.pi * 330 * t))
    tone *= _env(len(t), 0.001, 0.05)
    noise = rng.standard_normal(len(t)) * _env(len(t), 0.001, 0.09)
    return _norm(0.5 * tone + 0.9 * noise).astype(np.float32)


def make_hat() -> np.ndarray:
    dur = 0.06
    t = np.arange(int(dur * SR)) / SR
    rng = np.random.default_rng(3)
    noise = rng.standard_normal(len(t))
    # crude high-pass: subtract a smoothed (low-passed) copy
    k = 8
    smooth = np.convolve(noise, np.ones(k) / k, mode="same")
    hp = noise - smooth
    return _norm(hp * _env(len(t), 0.0005, 0.02)).astype(np.float32)


def make_bass() -> np.ndarray:
    dur = 0.6
    t = np.arange(int(dur * SR)) / SR
    f = BASS_ROOT_HZ
    # tone + a couple of harmonics for a rounded synth-bass character
    wave = (np.sin(2 * np.pi * f * t)
            + 0.35 * np.sin(2 * np.pi * 2 * f * t)
            + 0.15 * np.sin(2 * np.pi * 3 * f * t))
    wave *= _env(len(t), 0.004, 0.5)
    return _norm(wave).astype(np.float32)


SAMPLES = {
    "kick": make_kick,
    "snare": make_snare,
    "hat": make_hat,
    "bass_C2": make_bass,
}


def write_all() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, fn in SAMPLES.items():
        data = fn()
        pcm = np.int16(np.clip(data, -1.0, 1.0) * 32767)
        wavfile.write(os.path.join(OUT_DIR, f"{name}.wav"), SR, pcm)
        print(f"wrote {name}.wav  ({len(data) / SR:.3f}s)")


def _centroid(x: np.ndarray) -> float:
    """Spectral centroid in Hz — a rough 'brightness' measure."""
    mag = np.abs(np.fft.rfft(x))
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    return float((freqs * mag).sum() / (mag.sum() or 1.0))


def selfcheck() -> None:
    stats = {}
    for name in SAMPLES:
        sr, data = wavfile.read(os.path.join(OUT_DIR, f"{name}.wav"))
        x = data.astype(np.float64) / 32768.0
        assert sr == SR, f"{name}: wrong sample rate {sr}"
        assert x.ndim == 1, f"{name}: not mono"
        assert len(x) > 0, f"{name}: empty"
        assert np.isfinite(x).all(), f"{name}: non-finite samples"
        assert np.max(np.abs(x)) > 0.1, f"{name}: silent"
        stats[name] = (len(x) / SR, _centroid(x))
        print(f"{name:8s} dur={stats[name][0]:.3f}s  centroid={stats[name][1]:7.1f}Hz")

    # Distinctness: brightness must increase kick < snare < hat; bass tonal & low.
    kc, sc, hc = stats["kick"][1], stats["snare"][1], stats["hat"][1]
    assert kc < sc < hc, f"drum brightness not ordered kick<snare<hat: {kc:.0f},{sc:.0f},{hc:.0f}"
    # bass is the most tonal/lowest — its centroid sits below the kick's.
    assert stats["bass_C2"][1] < kc, f"bass centroid {stats['bass_C2'][1]:.0f} should be below kick {kc:.0f}"
    print("selfcheck OK — 4 samples valid, mono, distinct, ordered kick<snare<hat.")


if __name__ == "__main__":
    if "--selfcheck" in sys.argv:
        selfcheck()
    else:
        write_all()
