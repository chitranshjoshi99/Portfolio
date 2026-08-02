#!/usr/bin/env python3
"""reduce.py — Stylophone Beat Coach song-to-lesson reduction engine (EPIC-2 · 2.1).

Turns a <=15s audio clip into a *draft* Stylophone Beat lesson JSON:
a simplified 8-beat groove (kick/snare/hat) + a monophonic bassline mapped onto
the Beat's pad numbering, quantized to a 32-step (16th-note) / 2-bar grid.

The output is always a rough draft the user hand-corrects (EPIC-3), never a
faithful transcription. `reduce(...)` is the ONE interface (README locked
decision): Demucs stem-sep + librosa DSP now, swappable later.

Pipeline (locked in EPIC-2-reduction.md):
    clip (<=15s)
      -> Demucs htdemucs (drums + bass stems)
      -> drums: librosa.onset.onset_detect + spectral-band classify -> {kick,snare,hat}
      -> bass:  librosa.pyin -> dominant pitch/step -> nearest pad + octave (-2..+2)
      -> assemble draft JSON (README schema v1)

CLI:
    python reduce.py <audio> --start S --end E [--bpm N] [--out draft.json]
    python reduce.py --selfcheck          # pure-python checks, no heavy deps
    python reduce.py --validate draft.json # validate a JSON file against the schema

Heavy deps (librosa, demucs, torch, soundfile, numpy) are imported lazily inside
the functions that need them, so --selfcheck / --validate run on a bare Python.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile

# --- Locked schema constants (README §The Lesson schema v1) -------------------

SCHEMA_VERSION = 1
BANK = "ROK"
BARS = 2
STEPS = 32                      # 16th-note resolution over the 8-beat / 2-bar loop
BEATS_PER_LOOP = 8
STEPS_PER_BEAT = STEPS // BEATS_PER_LOOP   # 4 (16th notes)

DRUM_SOUNDS = ("kick", "snare", "hat")

# Native Beat pad numbering — 12 chromatic positions = one octave.
# Index i == semitone class i (like C, C#, D, ... B).
PAD_POSITIONS = ["1", "1.5", "2", "2.5", "3", "4", "4.5", "5", "5.5", "6", "6.5", "7"]
OCTAVE_MIN, OCTAVE_MAX = -2, 2


# --- Pure-python core (no heavy deps; exercised by --selfcheck) ---------------

def time_to_step(t_sec: float, step_dur: float):
    """Quantize a time offset (s, relative to clip/loop start) to a 0..31 step.

    Returns None if the onset falls outside the single 2-bar loop window.
    """
    if step_dur <= 0:
        return None
    step = int(round(t_sec / step_dur))
    if step < 0 or step >= STEPS:
        return None
    return step


def hz_to_pad_octave(hz: float, center_midi: int):
    """Map a frequency to (pad_string, octave) on the Beat.

    pad encodes the semitone class; octave is the octave offset (clamped -2..+2)
    relative to the chosen center note. Returns None for non-positive Hz.
    """
    if hz is None or hz <= 0:
        return None
    midi = int(round(69 + 12 * math.log2(hz / 440.0)))
    pad = PAD_POSITIONS[midi % 12]
    octave = midi // 12 - center_midi // 12
    # ponytail: hard clamp out-of-range octaves to the Beat's -2..+2 span.
    # Hand-correction (EPIC-3) is the safety net for the rare clamped note.
    octave = max(OCTAVE_MIN, min(OCTAVE_MAX, octave))
    return pad, octave


def assemble_lesson(bpm, drum_hits, bass_notes, source):
    """Assemble the README schema v1 dict (minus id/title, which the app fills)."""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "source": source,
        "bpm": round(float(bpm), 2),
        "bank": BANK,
        "bars": BARS,
        "steps": STEPS,
        "layers": [
            {"id": "drums", "type": "drums",
             "hits": sorted(drum_hits, key=lambda h: (h["step"], h["sound"]))},
            {"id": "bass", "type": "bass",
             "notes": sorted(bass_notes, key=lambda n: n["step"])},
        ],
        "teachOrder": ["drums", "bass"],
    }


def validate_lesson(d) -> list:
    """Return a list of schema violations (empty == valid). Pure python."""
    errs = []
    if not isinstance(d, dict):
        return ["root is not an object"]
    if d.get("schemaVersion") != SCHEMA_VERSION:
        errs.append(f"schemaVersion != {SCHEMA_VERSION}")
    if d.get("bank") != BANK:
        errs.append(f"bank != {BANK}")
    if d.get("steps") != STEPS:
        errs.append(f"steps != {STEPS}")
    if d.get("bars") != BARS:
        errs.append(f"bars != {BARS}")
    if not isinstance(d.get("bpm"), (int, float)) or d.get("bpm", 0) <= 0:
        errs.append("bpm missing or non-positive")
    layers = {l.get("id"): l for l in d.get("layers", []) if isinstance(l, dict)}
    if "drums" not in layers:
        errs.append("missing drums layer")
    else:
        for h in layers["drums"].get("hits", []):
            if not (isinstance(h.get("step"), int) and 0 <= h["step"] < STEPS):
                errs.append(f"drum hit step out of range: {h.get('step')}")
            if h.get("sound") not in DRUM_SOUNDS:
                errs.append(f"drum sound invalid: {h.get('sound')}")
    if "bass" not in layers:
        errs.append("missing bass layer")
    else:
        for n in layers["bass"].get("notes", []):
            if not (isinstance(n.get("step"), int) and 0 <= n["step"] < STEPS):
                errs.append(f"bass note step out of range: {n.get('step')}")
            if n.get("pad") not in PAD_POSITIONS:
                errs.append(f"bass pad invalid: {n.get('pad')}")
            if not (isinstance(n.get("octave"), int) and OCTAVE_MIN <= n["octave"] <= OCTAVE_MAX):
                errs.append(f"bass octave out of range: {n.get('octave')}")
            if not (isinstance(n.get("length"), int) and n["length"] >= 1):
                errs.append(f"bass length invalid: {n.get('length')}")
    if d.get("teachOrder") != ["drums", "bass"]:
        errs.append("teachOrder != ['drums','bass']")
    return errs


# --- DSP path (heavy deps; only runs with the real env from T2) ---------------

def _bandpass(y, sr, lo=None, hi=None, order=4):
    """Butterworth filter the stem. lo only -> highpass, hi only -> lowpass."""
    from scipy.signal import butter, sosfiltfilt
    nyq = sr / 2.0
    if lo and hi:
        sos = butter(order, [lo / nyq, hi / nyq], btype="band", output="sos")
    elif lo:
        sos = butter(order, lo / nyq, btype="high", output="sos")
    elif hi:
        sos = butter(order, hi / nyq, btype="low", output="sos")
    else:
        return y
    return sosfiltfilt(sos, y)


def _onset_steps(sig, sr, step_dur, phase, rel=0.5) -> set:
    """Onset steps for a (pre-filtered) band, keeping only STRONG onsets.

    A real groove is sparse; keeping every onset gives constant filler. So we
    peak-pick on the onset-strength envelope and keep only peaks at or above
    `rel` * the loudest peak in this band. Times are relative to `phase` (the
    downbeat); only the one 2-bar loop window survives (steps 0..31).
    """
    import librosa
    import numpy as np
    env = librosa.onset.onset_strength(y=sig, sr=sr)
    if env.size == 0 or env.max() <= 0:
        return set()
    peaks = librosa.onset.onset_detect(y=sig, sr=sr, backtrack=False)  # frame idx
    thr = rel * float(env.max())
    steps = set()
    for fr in peaks:
        if fr < len(env) and env[fr] >= thr:
            t = float(librosa.frames_to_time(fr, sr=sr))
            s = time_to_step(t - phase, step_dur)
            if s is not None:
                steps.add(s)
    return steps


def _drum_hits(drum_y, sr, step_dur, phase) -> list:
    """Per-band onset detection on the SAME demucs drums stem (transcription,
    not better stem-sep). hat is independent; kick vs snare is decided per onset
    by comparing low-band vs mid-band energy so a bare kick isn't mislabeled snare
    and a backbeat snare isn't dropped just because a kick shares the step.
    """
    # ponytail: fixed bands + energy vote. Upgrade to a drum-transcription model
    # (madmom/omnizart-drums) only if this still collapses on real songs.
    import numpy as np
    low = _bandpass(drum_y, sr, hi=120)             # kick thud
    mid = _bandpass(drum_y, sr, lo=200, hi=2500)    # snare body/crack
    high = _bandpass(drum_y, sr, lo=7000)           # hat sizzle

    win = max(1, int(round(step_dur * sr)))

    def _rms(sig, s):
        a = int(round((phase + s * step_dur) * sr))
        seg = sig[a:a + win]
        return float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0

    # relative-strength gate: keep only onsets >= 25% of the band's loudest, so a
    # real (sparse) groove survives and filler drops out. 0.25 tuned on real songs
    # (clean kit like Janice reduces well; a melodic-808 low end like I-Wonder still
    # over-counts kick — that song needs a drum-transcription model per EPIC-2).
    # ponytail: single global gate; per-song adaptivity is the madmom upgrade path.
    hat = _onset_steps(high, sr, step_dur, phase, rel=0.25)
    lowmid = _onset_steps(low, sr, step_dur, phase, rel=0.25) | \
        _onset_steps(mid, sr, step_dur, phase, rel=0.25)

    hits = [{"step": s, "sound": "hat"} for s in hat]
    for s in lowmid:
        hits.append({"step": s, "sound": "kick" if _rms(low, s) >= _rms(mid, s) else "snare"})
    return hits


def _fft_peak(seg, sr):
    """Dominant frequency in the 40-400 Hz bass band, or None."""
    import numpy as np
    if len(seg) < 16:
        return None
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    freqs = np.fft.rfftfreq(len(seg), 1.0 / sr)
    idx = np.where((freqs >= 40) & (freqs <= 400))[0]
    if len(idx) == 0:
        return None
    peak = idx[int(np.argmax(spec[idx]))]
    return float(freqs[peak]) if spec[peak] > 0 else None


def _bass_notes(bass_y, sr, step_dur, phase) -> list:
    """One note per detected bass ONSET, held until the next onset.

    A monophonic bassline is note-onsets with sustain, so detecting onsets and
    taking ONE stable pitch per note (median pyin over the note's whole span)
    matches the music far better than sampling a pitch every 16th-step — that
    removed the off-beat spam and octave jitter of the per-step approach.
    """
    import librosa
    import numpy as np

    f0, voiced, _ = librosa.pyin(
        bass_y, sr=sr,
        fmin=float(librosa.note_to_hz("C1")),
        fmax=float(librosa.note_to_hz("C4")),  # bass ceiling; higher catches harmonics
    )
    times = librosa.times_like(f0, sr=sr)
    loop_end = phase + STEPS * step_dur

    # bass note onsets, quantized to steps within the one loop window
    onset_t = librosa.onset.onset_detect(y=bass_y, sr=sr, units="time", backtrack=True)
    by_step = {}
    for t in onset_t:
        s = time_to_step(float(t) - phase, step_dur)
        if s is not None:
            by_step.setdefault(s, float(t))  # earliest onset wins the step
    if not by_step:
        return []
    steps_sorted = sorted(by_step)

    def _rms(t0, t1):
        a, b = int(round(t0 * sr)), int(round(t1 * sr))
        seg = bass_y[a:b]
        return float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0

    def _dom_hz(t0, t1):
        m = (times >= t0) & (times < t1) & voiced & np.isfinite(f0)
        vals = f0[m]
        if vals.size:
            return float(np.median(vals))  # stable pitch over the whole note
        a, b = int(round(t0 * sr)), int(round(t1 * sr))
        return _fft_peak(bass_y[a:b], sr)

    # one candidate note per onset: span = onset -> next onset
    cand = []
    for i, s in enumerate(steps_sorted):
        t0 = by_step[s]
        nxt_step = steps_sorted[i + 1] if i + 1 < len(steps_sorted) else STEPS
        t1 = by_step[steps_sorted[i + 1]] if i + 1 < len(steps_sorted) else loop_end
        cand.append({"step": s, "len": max(1, nxt_step - s),
                     "rms": _rms(t0, t1), "hz": _dom_hz(t0, t1)})
    peak = max(c["rms"] for c in cand) or 1.0
    cand = [c for c in cand if c["rms"] >= 0.20 * peak and c["hz"]]  # drop quiet/unpitched
    if not cand:
        return []

    midis = [int(round(69 + 12 * math.log2(c["hz"] / 440.0))) for c in cand]
    center_midi = int(round(sorted(midis)[len(midis) // 2]))
    notes = []
    for c in cand:
        po = hz_to_pad_octave(c["hz"], center_midi)
        if po:
            pad, octv = po
            notes.append({"step": c["step"], "pad": pad, "octave": octv, "length": c["len"]})
    return notes


def _demucs_stems(clip_wav: str, out_dir: str):
    """Run Demucs htdemucs on a clip wav; return (drums_path, bass_path)."""
    # ponytail: shell out to the demucs CLI (robust, no torch API churn) rather
    # than re-implementing model loading. Reads the two stems we need.
    subprocess.run(
        [sys.executable, "-m", "demucs", "-n", "htdemucs",
         "-o", out_dir, clip_wav],
        check=True,
    )
    stem = os.path.splitext(os.path.basename(clip_wav))[0]
    base = os.path.join(out_dir, "htdemucs", stem)
    return os.path.join(base, "drums.wav"), os.path.join(base, "bass.wav")


def reduce(path: str, clip_start: float, clip_end: float, bpm=None) -> dict:
    """Reduce a <=15s clip of `path` to a draft lesson dict (schema minus id/title).

    THE locked interface. Demucs+DSP impl; keep the signature stable if swapped.
    """
    import librosa
    import numpy as np
    import soundfile as sf

    dur = clip_end - clip_start
    if dur <= 0:
        raise ValueError("clip_end must be greater than clip_start")
    if dur > 15.0 + 1e-6:
        raise ValueError("clip region must be <= 15s")

    # 1. Load + clip the region (mono, 44.1k).
    y, sr = librosa.load(path, sr=44100, mono=True,
                         offset=float(clip_start), duration=float(dur))
    if len(y) == 0:
        raise ValueError("clip region is empty — check start/end vs file length")

    with tempfile.TemporaryDirectory() as tmp:
        clip_wav = os.path.join(tmp, "clip.wav")
        sf.write(clip_wav, y, sr)

        # 2. Demucs stems.
        drums_path, bass_path = _demucs_stems(clip_wav, tmp)
        drum_y, _ = librosa.load(drums_path, sr=sr, mono=True)
        bass_y, _ = librosa.load(bass_path, sr=sr, mono=True)

        # 3. Tempo + downbeat phase. A clip rarely starts on a beat and is usually
        #    several bars long, so we quantize RELATIVE to the first detected beat
        #    and reduce only the ONE 2-bar loop window that starts there.
        det_tempo, beat_times = librosa.beat.beat_track(y=y, sr=sr, units="time")
        det_tempo = float(np.atleast_1d(det_tempo)[0])
        phase = float(beat_times[0]) if len(beat_times) else 0.0
        if bpm is None:
            bpm = det_tempo if det_tempo > 0 else 120.0  # UI can pass a known BPM

        # step_dur = one 16th note = beat / 4
        step_dur = (60.0 / bpm) / STEPS_PER_BEAT

        # 4. Drums + bass, aligned to the downbeat phase.
        drum_hits = _drum_hits(drum_y, sr, step_dur, phase)
        bass_notes = _bass_notes(bass_y, sr, step_dur, phase)

    source = {"type": "upload", "ref": os.path.basename(path),
              "clipStart": float(clip_start), "clipEnd": float(clip_end),
              "phaseSec": round(phase, 4), "loopLenSec": round(STEPS * step_dur, 4)}
    lesson = assemble_lesson(bpm, drum_hits, bass_notes, source)
    errs = validate_lesson(lesson)
    if errs:
        raise RuntimeError("assembled lesson failed schema validation: " + "; ".join(errs))
    return lesson


# --- CLI + self-check ---------------------------------------------------------

def _selfcheck() -> int:
    """Pure-python checks for the schema/quantize/pad math (no heavy deps)."""
    fails = []

    # time_to_step: 120bpm -> step_dur = 0.125s. onset at 0.25s -> step 2.
    sd = (60.0 / 120.0) / STEPS_PER_BEAT
    assert abs(sd - 0.125) < 1e-9, "step_dur math wrong"
    if time_to_step(0.0, sd) != 0: fails.append("step@0")
    if time_to_step(0.25, sd) != 2: fails.append("step@0.25")
    if time_to_step(0.124, sd) != 1: fails.append("step@0.124 round")
    if time_to_step(3.9, sd) != 31: fails.append("step@3.9 -> 31")
    if time_to_step(4.1, sd) is not None: fails.append("step past loop should be None")
    if time_to_step(-0.1, sd) is not None: fails.append("negative step should be None")

    # hz_to_pad_octave: A4=440 is midi 69; with center midi 69 -> octave 0, pad = 69%12=9 -> "6".
    po = hz_to_pad_octave(440.0, 69)
    if po != ("6", 0): fails.append(f"A4 map wrong: {po}")
    # A2 = 110Hz midi 45; center 69 -> octave 45//12 - 69//12 = 3-5 = -2, pad 45%12=9 -> "6".
    po = hz_to_pad_octave(110.0, 69)
    if po != ("6", -2): fails.append(f"A2 map wrong: {po}")
    # Far below center clamps to -2, not beyond.
    po = hz_to_pad_octave(55.0, 69)  # A1 midi 33, raw octave 2-5=-3 -> clamp -2
    if po is None or po[1] != -2: fails.append(f"clamp low failed: {po}")
    if hz_to_pad_octave(0, 69) is not None: fails.append("0Hz should be None")

    # assemble + validate round-trip.
    lesson = assemble_lesson(
        120,
        [{"step": 0, "sound": "kick"}, {"step": 8, "sound": "snare"},
         {"step": 4, "sound": "hat"}],
        [{"step": 0, "pad": "1", "octave": 0, "length": 1},
         {"step": 8, "pad": "5", "octave": -1, "length": 2}],
        {"type": "manual", "ref": "test", "clipStart": 0, "clipEnd": 8},
    )
    errs = validate_lesson(lesson)
    if errs: fails.append("valid lesson rejected: " + "; ".join(errs))

    # validate catches bad data.
    bad = json.loads(json.dumps(lesson))
    bad["layers"][0]["hits"][0]["step"] = 99
    bad["layers"][1]["notes"][0]["pad"] = "9"          # not a real pad
    bad["layers"][1]["notes"][0]["octave"] = 5         # out of range
    caught = validate_lesson(bad)
    if len(caught) < 3: fails.append(f"validator missed bad fields: {caught}")

    if fails:
        print("SELFCHECK FAILED:")
        for f in fails:
            print("  -", f)
        return 1
    print("SELFCHECK OK — schema/quantize/pad math verified (pure python).")
    print(json.dumps(lesson, indent=2))
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Reduce a <=15s clip to a draft Beat lesson JSON.")
    p.add_argument("audio", nargs="?", help="path to an audio file")
    p.add_argument("--start", type=float, help="clip start (seconds)")
    p.add_argument("--end", type=float, help="clip end (seconds)")
    p.add_argument("--bpm", type=float, default=None, help="known BPM (else auto-detect)")
    p.add_argument("--out", help="write draft JSON here (else stdout)")
    p.add_argument("--selfcheck", action="store_true", help="run pure-python checks and exit")
    p.add_argument("--validate", metavar="JSON", help="validate a lesson JSON file and exit")
    args = p.parse_args(argv)

    if args.selfcheck:
        return _selfcheck()

    if args.validate:
        with open(args.validate) as f:
            data = json.load(f)
        errs = validate_lesson(data)
        if errs:
            print("INVALID:")
            for e in errs:
                print("  -", e)
            return 1
        print("VALID — matches lesson schema v1.")
        return 0

    if not args.audio or args.start is None or args.end is None:
        p.error("audio, --start and --end are required (or use --selfcheck / --validate)")

    lesson = reduce(args.audio, args.start, args.end, args.bpm)
    out = json.dumps(lesson, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(out)
        print(f"wrote {args.out} ({len(lesson['layers'][0]['hits'])} drum hits, "
              f"{len(lesson['layers'][1]['notes'])} bass notes, bpm {lesson['bpm']})")
    else:
        print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
