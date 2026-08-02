#!/usr/bin/env python3
"""render_preview.py — audition a draft lesson as audio (gate-listening aid).

There's no in-app player yet (EPIC-1), so this synthesizes a draft lesson JSON
into a WAV: simple kick/snare/hat drum synth + sine bass at each pad's pitch,
sequenced over the 2-bar loop and repeated to fill the clip length. Optionally
mixes the synth OVER the original clip so you can A/B the reduction against the song.

    python render_preview.py draft.json --out draft.wav
    python render_preview.py draft.json --clip ../samples/Song.mp3 --start 35 --end 50 \
        --out-draft draft.wav --out-mix mix.wav

ponytail: crude synths (sine/noise + exp decay), not the ROK samples — this is a
listening aid for the gate, not the real instrument. Real playback is EPIC-1 (Tone.js).
"""
import argparse
import json
import math
import numpy as np
import soundfile as sf

SR = 44100
PAD_POSITIONS = ["1", "1.5", "2", "2.5", "3", "4", "4.5", "5", "5.5", "6", "6.5", "7"]
BASE_MIDI = 36  # pad "1", octave 0 -> C2 (~65 Hz)


def _env(n, decay):
    return np.exp(-np.arange(n) / (decay * SR))


def _kick(dur=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 30) + 45          # pitch drop 110->45 Hz
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.06)


def _snare(dur=0.14):
    n = int(dur * SR)
    noise = np.random.uniform(-1, 1, n) * _env(n, 0.05)
    tone = np.sin(2 * np.pi * 180 * np.arange(n) / SR) * _env(n, 0.05) * 0.5
    return (noise + tone) * 0.8


def _hat(dur=0.05):
    n = int(dur * SR)
    return np.random.uniform(-1, 1, n) * _env(n, 0.012) * 0.5


def _bass(midi, dur):
    n = max(1, int(dur * SR))
    freq = 440 * 2 ** ((midi - 69) / 12)
    t = np.arange(n) / SR
    a = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * 2 * freq * t)
    env = np.minimum(1.0, _env(n, 0.4) + 0.2)      # slight sustain
    return a * env * 0.6


def _pad_to_midi(pad, octave):
    return BASE_MIDI + PAD_POSITIONS.index(pad) + 12 * octave


def render(lesson, loops=None, fill_sec=None):
    bpm = lesson["bpm"]
    steps = lesson["steps"]
    step_dur = (60.0 / bpm) / (steps / lesson["bars"] / 4)  # = beat/4
    loop_len = steps * step_dur
    if loops is None:
        loops = max(1, math.ceil((fill_sec or loop_len) / loop_len))
    total = int(loop_len * loops * SR) + SR
    buf = np.zeros(total)

    def place(sig, at_sec):
        a = int(at_sec * SR)
        b = min(len(buf), a + len(sig))
        buf[a:b] += sig[: b - a]

    layers = {l["id"]: l for l in lesson["layers"]}
    for lp in range(loops):
        base = lp * loop_len
        for h in layers.get("drums", {}).get("hits", []):
            at = base + h["step"] * step_dur
            place({"kick": _kick(), "snare": _snare(), "hat": _hat()}[h["sound"]], at)
        for nte in layers.get("bass", {}).get("notes", []):
            at = base + nte["step"] * step_dur
            place(_bass(_pad_to_midi(nte["pad"], nte["octave"]), nte["length"] * step_dur), at)

    peak = np.max(np.abs(buf)) or 1.0
    return buf / peak * 0.9


def main():
    p = argparse.ArgumentParser()
    p.add_argument("draft")
    p.add_argument("--out")
    p.add_argument("--out-draft")
    p.add_argument("--out-mix")
    p.add_argument("--out-stereo", help="2ch wav: L=original song, R=synth draft (sync A/B)")
    p.add_argument("--clip"); p.add_argument("--start", type=float); p.add_argument("--end", type=float)
    a = p.parse_args()
    lesson = json.load(open(a.draft))

    if a.clip is not None:
        import librosa
        y, _ = librosa.load(a.clip, sr=SR, mono=True, offset=a.start, duration=a.end - a.start)
        # align the looped draft to the downbeat phase the reducer stored
        phase = float(lesson.get("source", {}).get("phaseSec", 0.0))
        off = int(phase * SR)
        draft = render(lesson, fill_sec=max(0.1, (len(y) - off) / SR))
        aligned = np.zeros(len(y))
        b = min(len(y), off + len(draft))
        aligned[off:b] = draft[: b - off]
        out_draft = a.out_draft or "draft.wav"
        sf.write(out_draft, draft, SR); print("wrote", out_draft)
        mix = 0.7 * y + 0.9 * aligned
        mix = mix / (np.max(np.abs(mix)) or 1.0) * 0.9
        out_mix = a.out_mix or "mix.wav"
        sf.write(out_mix, mix, SR); print("wrote", out_mix)
        if a.out_stereo:
            g = 0.9 / (max(np.max(np.abs(y)), np.max(np.abs(aligned))) or 1.0)
            st = np.stack([y * g, aligned * g], axis=1)  # L=song, R=synth draft
            sf.write(a.out_stereo, st, SR); print("wrote", a.out_stereo)
    else:
        draft = render(lesson, fill_sec=15)
        out = a.out or "draft.wav"
        sf.write(out, draft, SR); print("wrote", out)


if __name__ == "__main__":
    main()
