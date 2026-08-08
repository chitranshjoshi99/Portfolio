// Tone.js audio engine: drum one-shots plus distinct live and sequenced bass
// voices. Transport scheduling remains in the transport module.
import * as Tone from "tone";
import { assetPath, DRUM_BY_PAD, PAD_IDS, type Bank, type PadId } from "./constants";
import type { BassCell } from "./pattern";

// --- pure maps/helpers (tests + later stories use these) ---

const SEMITONES: Record<PadId, number> = {
  "1": 0, "1.5": 1, "2": 2, "2.5": 3, "3": 4, "4": 5,
  "4.5": 6, "5": 7, "5.5": 8, "6": 9, "6.5": 10, "7": 11,
};

export function padSemitone(padId: PadId): number {
  return SEMITONES[padId];
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function bassNote(padId: PadId, octave = 0, semitoneOffset = 0): string {
  // ponytail: root sample is C2; pad "1" @ octave 0 plays C3 (root + 1 octave)
  // for a comfortable bass register. MIDI: C3 = 48 (Tone/std, C4 = 60).
  const midi = 48 + padSemitone(padId) + octave * 12 + semitoneOffset;
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

type DrumTimbre = {
  playbackRate: number;
  volume: number;
  filterType: BiquadFilterType;
  filterFrequency: number;
  filterQ: number;
};

// Non-ROK banks transform the retained ROK assets at runtime. This keeps the
// original 12-pad sample layout intact while giving the preview/playback a
// deliberately different character without an editor or downloaded assets.
const DRUM_TIMBRES: Record<Bank, DrumTimbre> = {
  // ROK is transparent. The other three must be audibly distinct, not subtle:
  // HIP slows and darkens (lowpass well inside the kit's energy at 3.2 kHz),
  // TEC speeds up and thins the lows with a resonant highpass bump, BOX is a
  // wide bandpass (small-speaker lofi) — low Q so it colors without the
  // telephone-muffle a narrow band caused.
  ROK: { playbackRate: 1, volume: 0, filterType: "lowpass", filterFrequency: 20000, filterQ: 0 },
  HIP: { playbackRate: 0.9, volume: -1, filterType: "lowpass", filterFrequency: 3200, filterQ: 0.7 },
  TEC: { playbackRate: 1.12, volume: 0, filterType: "highpass", filterFrequency: 250, filterQ: 1.2 },
  BOX: { playbackRate: 0.95, volume: -1, filterType: "bandpass", filterFrequency: 1500, filterQ: 0.8 },
};

type BassTimbre = {
  oscillator: "sawtooth" | "triangle" | "square";
  volume: number;
  filterType: BiquadFilterType;
  filterFrequency: number;
  filterQ: number;
  envelope: { attack: number; decay: number; sustain: number; release: number };
  filterEnvelope: { baseFrequency: number; octaves: number; attack: number; decay: number; sustain: number; release: number };
};

// const BASS_TIMBRES: Record<Bank, BassTimbre> = {
//   // Bass is a plucked instrument, not brass: every filterEnvelope attack is
//   // near-instant. (The old ROK numbers were MonoSynth's defaults — a 0.6 s
//   // filter swell over 3 octaves on a sawtooth, which is the textbook brass
//   // patch and read as a trumpet.) Character lives in the pluck decay, the
//   // sweep depth, and the oscillator.
//   ROK: {
//     // Punchy rock synth bass: saw pluck with a bit of resonant bite.
//     oscillator: "sawtooth", volume: 0, filterType: "lowpass", filterFrequency: 350, filterQ: 2,
//     envelope: { attack: 0.004, decay: 0.15, sustain: 0.7, release: 0.15 },
//     filterEnvelope: { baseFrequency: 120, octaves: 2.6, attack: 0.005, decay: 0.25, sustain: 0.35, release: 0.4 },
//   },
//   HIP: {
//     // Deep round sub: triangle, slow-ish pluck, small sweep. Triangle carries
//     // far less energy than saw, so it sits above the others in gain.
//     oscillator: "triangle", volume: 1, filterType: "lowpass", filterFrequency: 400, filterQ: 1,
//     envelope: { attack: 0.01, decay: 0.3, sustain: 0.75, release: 0.25 },
//     filterEnvelope: { baseFrequency: 70, octaves: 1.8, attack: 0.01, decay: 0.35, sustain: 0.25, release: 0.5 },
//   },
//   TEC: {
//     // Acid-adjacent stab: saw, snappy amp, deep fast sweep, high resonance.
//     oscillator: "sawtooth", volume: -1, filterType: "lowpass", filterFrequency: 300, filterQ: 3.5,
//     envelope: { attack: 0.002, decay: 0.1, sustain: 0.5, release: 0.08 },
//     filterEnvelope: { baseFrequency: 200, octaves: 3, attack: 0.003, decay: 0.12, sustain: 0.15, release: 0.1 },
//   },
//   BOX: {
//     // Chunky chip-style square: tight and dry, modest sweep. The old bandpass
//     // at Q4 made it honky-thin; a lowpass keeps the square's body.
//     oscillator: "square", volume: -3, filterType: "lowpass", filterFrequency: 350, filterQ: 1.5,
//     envelope: { attack: 0.002, decay: 0.08, sustain: 0.4, release: 0.06 },
//     filterEnvelope: { baseFrequency: 100, octaves: 2, attack: 0.004, decay: 0.12, sustain: 0.2, release: 0.1 },
//   },
// };
const BASS_TIMBRES: Record<Bank, BassTimbre> = {
  // Bass is a plucked instrument, not brass: every filterEnvelope attack is
  // near-instant. (The old ROK numbers were MonoSynth's defaults — a 0.6 s
  // filter swell over 3 octaves on a sawtooth, which is the textbook brass
  // patch and read as a trumpet.) Character lives in the pluck decay, the
  // sweep depth, and the oscillator.
  ROK: {
    // Punchy rock synth bass: saw pluck with a bit of resonant bite.
    oscillator: "sawtooth", volume: 0, filterType: "lowpass", filterFrequency: 350, filterQ: 2,
    envelope: { attack: 0.004, decay: 0.15, sustain: 0.7, release: 0.15 },
    filterEnvelope: { baseFrequency: 120, octaves: 2.6, attack: 0.005, decay: 0.25, sustain: 0.35, release: 0.4 },
  },
  HIP: {
    // Deep round sub: triangle, slow-ish pluck, small sweep. Triangle carries
    // far less energy than saw, so it sits above the others in gain.
    oscillator: "triangle", volume: 1, filterType: "lowpass", filterFrequency: 400, filterQ: 1,
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.75, release: 0.25 },
    filterEnvelope: { baseFrequency: 70, octaves: 1.8, attack: 0.01, decay: 0.35, sustain: 0.25, release: 0.5 },
  },
  TEC: {
    // Acid-adjacent stab: saw, snappy amp, deep fast sweep, high resonance.
    oscillator: "sawtooth", volume: -1, filterType: "lowpass", filterFrequency: 300, filterQ: 3.5,
    envelope: { attack: 0.002, decay: 0.1, sustain: 0.5, release: 0.08 },
    filterEnvelope: { baseFrequency: 200, octaves: 3, attack: 0.003, decay: 0.12, sustain: 0.15, release: 0.1 },
  },
  BOX: {
    // Chunky chip-style square: tight and dry, modest sweep. The old bandpass
    // at Q4 made it honky-thin; a lowpass keeps the square's body.
    oscillator: "square", volume: -3, filterType: "lowpass", filterFrequency: 350, filterQ: 1.5,
    envelope: { attack: 0.002, decay: 0.08, sustain: 0.4, release: 0.06 },
    filterEnvelope: { baseFrequency: 100, octaves: 2, attack: 0.004, decay: 0.12, sustain: 0.2, release: 0.1 },
  },
  // STY: {
  //   // Stylophone Beat Bass: Lo-fi, raw square wave with a highly resonant,
  //   // snappy lowpass sweep. Emulates the classic, aggressive analog bite.
  //   oscillator: "square", volume: -2, filterType: "lowpass", filterFrequency: 200, filterQ: 4,
  //   envelope: { attack: 0.005, decay: 0.18, sustain: 0.5, release: 0.1 },
  //   filterEnvelope: { baseFrequency: 150, octaves: 3.2, attack: 0.006, decay: 0.22, sustain: 0.15, release: 0.15 },
  // },
};

export function drumTimbreForBank(bank: Bank): Readonly<DrumTimbre> {
  return DRUM_TIMBRES[bank];
}

export function bassTimbreForBank(bank: Bank): Readonly<BassTimbre> {
  return BASS_TIMBRES[bank];
}

// --- Tone instances (fetch+decode at module load, route to output) ---

// The ROK profile is effectively transparent; other banks reshape this one
// shared drum path. All pads therefore retimbre together when their bank does.
const drumFilter = new Tone.Filter({ frequency: 20000, type: "lowpass", Q: 0 }).toDestination();
const players = {} as Record<PadId, Tone.Player>;
for (const pad of PAD_IDS) {
  players[pad] = new Tone.Player(DRUM_BY_PAD[pad].sample).connect(drumFilter);
}
let activeDrumBank: Bank = "ROK";

// The metronome is deliberately isolated from the instrument mix so its level
// stays fixed without exposing mixer controls. `volume` is scheduled per hit:
// downbeats get the allowed +3 dB maximum, while the bus remains at -18 dB.
const clickBus = new Tone.Volume(-18).toDestination();
const clickPlayer = new Tone.Player(assetPath("rok/stick.wav")).connect(clickBus);

// Live input and the sequencer deliberately use different monophonic voices.
// A held stylus/key must never cut the currently looping bass line (and vice
// versa).  The short portamento keeps a slide continuous rather than creating
// an envelope-shaped gap at each wedge boundary.
//
// Both voices are constructed from the ROK timbre: applyBassBank() no-ops on
// its initial "ROK" state, so anything not set here would silently play
// MonoSynth defaults until the first bank switch.
function createBassVoice(): Tone.MonoSynth {
  const t = BASS_TIMBRES.ROK;
  return new Tone.MonoSynth({
    portamento: 0.025,
    oscillator: { type: t.oscillator },
    filter: { type: t.filterType, frequency: t.filterFrequency, Q: t.filterQ },
    envelope: t.envelope,
    filterEnvelope: t.filterEnvelope,
    volume: t.volume,
  }).toDestination();
}
const liveBass = createBassVoice();
const sequencedBass = createBassVoice();
let liveBassActive = false;
let sequencedBassActive = false;
let sequencedBassNote: string | null = null;
let activeBassBank: Bank = "ROK";

let started = false;
let starting: Promise<void> | null = null;

export async function startAudio(): Promise<void> {
  if (started) return;
  if (!starting) {
    // A first slide can emit several pointer events while samples are still
    // decoding. Share that single unlock/load rather than racing Tone.loaded.
    starting = (async () => {
      await Tone.start(); // unlock AudioContext — must run inside a user gesture
      await Tone.loaded(); // ensure all samples decoded before first trigger
      started = true;
    })().catch((error) => {
      starting = null;
      throw error;
    });
  }
  await starting;
}

export function isStarted(): boolean {
  return started;
}

function applyDrumBank(bank: Bank): void {
  if (activeDrumBank === bank) return;
  const timbre = drumTimbreForBank(bank);
  drumFilter.type = timbre.filterType;
  drumFilter.frequency.value = timbre.filterFrequency;
  drumFilter.Q.value = timbre.filterQ;
  for (const pad of PAD_IDS) {
    players[pad].playbackRate = timbre.playbackRate;
    players[pad].volume.value = timbre.volume;
  }
  activeDrumBank = bank;
}

function applyBassBank(bank: Bank): void {
  if (activeBassBank === bank) return;
  const timbre = bassTimbreForBank(bank);
  for (const voice of [liveBass, sequencedBass]) {
    voice.set({
      oscillator: { type: timbre.oscillator },
      filter: { type: timbre.filterType, frequency: timbre.filterFrequency, Q: timbre.filterQ },
      envelope: timbre.envelope,
      filterEnvelope: timbre.filterEnvelope,
      volume: timbre.volume,
    });
  }
  activeBassBank = bank;
}

// These selectors let a mode change retimbre currently sounding voices before
// the next pad event. Entry points below also apply them defensively so callers
// only need to carry the active pattern-level bank.
export function selectDrumBank(bank: Bank): void {
  applyDrumBank(bank);
}

export function selectBassBank(bank: Bank): void {
  applyBassBank(bank);
}

export function playDrum(padId: PadId, bank: Bank = "ROK"): void {
  if (!started) return; // safe no-op before first gesture
  try {
    applyDrumBank(bank);
    const p = players[padId];
    p.volume.value = drumTimbreForBank(bank).volume;
    p.stop().start(); // retrigger from the top each tap
  } catch (err) {
    console.error("playDrum failed", padId, err);
  }
}

// Brief audition for grid/inspector edits. Live playing must use the explicit
// attack/move/release API below, never a fixed-duration trigger.
export function previewBass(padId: PadId, octave = 0, bank: Bank = "ROK"): void {
  if (!started) return;
  try {
    applyBassBank(bank);
    sequencedBass.volume.value = bassTimbreForBank(bank).volume;
    sequencedBass.triggerAttackRelease(bassNote(padId, octave), "8n");
  } catch (err) {
    console.error("previewBass failed", padId, octave, err);
  }
}

export function attackBass(padId: PadId, octave = 0, bank: Bank = "ROK"): void {
  if (!started) return;
  try {
    applyBassBank(bank);
    liveBass.volume.value = bassTimbreForBank(bank).volume;
    liveBass.triggerAttack(bassNote(padId, octave));
    liveBassActive = true;
  } catch (err) {
    console.error("attackBass failed", padId, octave, err);
  }
}

export function moveBass(padId: PadId, octave = 0, bank: Bank = "ROK"): void {
  if (!started || !liveBassActive) return;
  try {
    applyBassBank(bank);
    liveBass.setNote(bassNote(padId, octave));
  } catch (err) {
    console.error("moveBass failed", padId, octave, err);
  }
}

export function releaseBass(): void {
  if (!started || !liveBassActive) return;
  try {
    liveBass.triggerRelease();
  } catch (err) {
    console.error("releaseBass failed", err);
  } finally {
    liveBassActive = false;
  }
}

// Time-accurate triggers for Transport-scheduled pattern playback. The sequenced
// voice is intentionally independent from the live input voice above.
export function playDrumAt(
  pad: PadId,
  time: number,
  bank: Bank = "ROK",
  gainDb = 0,
): void {
  if (!started) return;
  try {
    applyDrumBank(bank);
    players[pad].volume.setValueAtTime(drumTimbreForBank(bank).volume + gainDb, time);
    players[pad].stop(time).start(time);
  } catch (err) {
    console.error("playDrumAt failed", pad, err);
  }
}

// One Player makes the sampled click monophonic: stopping at the exact next
// Transport time prevents a long sample tail from overlapping the next beat.
export function playClickAt(time: number, accent: boolean): void {
  if (!started) return;
  try {
    clickPlayer.volume.setValueAtTime(accent ? 3 : 0, time);
    clickPlayer.stop(time).start(time);
  } catch (err) {
    console.error("playClickAt failed", accent, err);
  }
}

// Keep one sequenced envelope open across sustained and adjacent cells. A new
// pitch during that envelope uses portamento via setNote, while a real gap
// releases it. `cell` has already been resolved for this exact transport step.
export function playBassAt(
  cell: BassCell | null,
  time: number,
  bank: Bank = "ROK",
  gainDb = 0,
  semitoneOffset = 0,
): void {
  if (!started) return;
  try {
    applyBassBank(bank);
    if (!cell) {
      releaseSequencedBass(time);
      return;
    }

    const note = bassNote(cell.pad, cell.octave, semitoneOffset);
    sequencedBass.volume.setValueAtTime(bassTimbreForBank(bank).volume + gainDb, time);
    if (!sequencedBassActive) {
      sequencedBass.triggerAttack(note, time);
      sequencedBassActive = true;
      sequencedBassNote = note;
    } else if (sequencedBassNote !== note) {
      sequencedBass.setNote(note, time);
      sequencedBassNote = note;
    }
  } catch (err) {
    console.error("playBassAt failed", cell, err);
  }
}

export function releaseSequencedBass(time?: number): void {
  if (!started) return;
  const releaseTime = time ?? Tone.now();
  try {
    // A transport callback may have already queued an attack just ahead of a
    // pause. Cancel that future automation before releasing, or the queued
    // attack can reopen the envelope after the transport has stopped.
    sequencedBass.envelope.cancel(releaseTime);
    sequencedBass.filterEnvelope.cancel(releaseTime);
    sequencedBass.frequency.cancelScheduledValues(releaseTime);
    if (sequencedBassActive) sequencedBass.triggerRelease(releaseTime);
    // A queued attack can have created an oscillator that has not started yet;
    // stop the source itself at the pause boundary, not just its envelope.
    sequencedBass.oscillator.stop(releaseTime);
  } catch (err) {
    console.error("releaseSequencedBass failed", err);
  } finally {
    sequencedBassActive = false;
    sequencedBassNote = null;
  }
}

// PLAY schedules players and synth events ahead of the transport. Stop every
// sequenced source immediately when the transport is paused so queued events do
// not leak past the UI's stopped state.
export function stopSequencedAudio(): void {
  if (!started) return;
  const time = Tone.now();
  try {
    for (const pad of PAD_IDS) players[pad].stop(time);
    clickPlayer.stop(time);
  } catch (err) {
    console.error("stopSequencedAudio failed", err);
  }
  releaseSequencedBass(time);
}

// --- pure self-check (no browser/audio). Guarded off the render path. ---
export function _selfcheck(): void {
  console.assert(padSemitone("1") === 0, "semitone 1");
  console.assert(padSemitone("1.5") === 1, "semitone 1.5");
  console.assert(padSemitone("7") === 11, "semitone 7");
  console.assert(DRUM_BY_PAD["1"].label === "Kick drum", "drum 1");
  console.assert(DRUM_BY_PAD["1.5"].label === "Clap", "drum 1.5");
  console.assert(DRUM_BY_PAD["7"].label === "Ride cymbal", "drum 7");
  console.assert(bassNote("1", 0) === "C3", "bass 1@0");
  console.assert(bassNote("1.5", 0) === "C#3", "bass 1.5@0");
  console.assert(bassNote("1", 1) === "C4", "bass 1@+1");
  console.assert(bassNote("7", 0) === "B3", "bass 7@0");
  console.assert(bassNote("1", 0, 1) === "C#3", "bass +1 semitone");
  console.assert(bassNote("7", 0, 1) === "C4", "bass semitone crosses octave");
  console.assert(drumTimbreForBank("ROK").playbackRate === 1, "ROK drums keep native rate");
  console.assert(drumTimbreForBank("HIP").filterFrequency < drumTimbreForBank("ROK").filterFrequency, "HIP drums are warmer");
  console.assert(drumTimbreForBank("TEC").playbackRate > 1, "TEC drums are tighter");
  console.assert(drumTimbreForBank("BOX").filterType === "bandpass", "BOX drums are filtered");
  console.assert(bassTimbreForBank("HIP").oscillator === "triangle", "HIP bass is warmer");
  console.assert(bassTimbreForBank("TEC").filterQ > bassTimbreForBank("ROK").filterQ, "TEC bass is more resonant");
  console.assert(bassTimbreForBank("BOX").oscillator === "square", "BOX bass is chip-flavored");
  // Bass must pluck, never swell — a slow filter attack is the brass patch.
  for (const bank of ["ROK", "HIP", "TEC", "BOX"] as const) {
    console.assert(bassTimbreForBank(bank).filterEnvelope.attack <= 0.02, `${bank} bass filter attack is a pluck`);
  }
}
