// Tone.Transport click/loop engine — story 1.3.
// 8-beat loop (2 bars of 4/4). ALL timing via Transport + Tone.Draw; no wall-clock timers.
// ponytail: REC tap-capture is deferred to the grid/editor task — not built here.
import * as Tone from "tone";
import { playClickAt, playDrumAt } from "./audio";
import { STEPS } from "./pattern";
import type { Bank, PadId } from "./constants";

// Seconds a visual cue lights ahead of the beat; must stay below Tone's default lookAhead (~0.1s).
export const CUE_LEAD = 0.06;

// === THE SPINE (EPIC-2 story 1) =============================================
// triggerStep is the ONE function that makes a drum sound: the live pad/keyboard
// and the sequencer both route through it, so a well-timed tap landing on an
// existing grid note collapses with the sequencer's tick into a SINGLE sound
// instead of a doubled flam.
//
// Dedup coordinate is (row:step, loop-pass) within a tolerance window equal to
// the nearest-snap window — NOT a per-16th reset. A matched tap arrives a few ms
// before/after the exact step tick; keyed by last-sounded audio-time per
// (row,step) and compared within ±½ step, the tap and the tick fall under the
// same window and collapse. A per-tick reset would key them separately and both
// would sound — the exact bug this kills, surviving where good timing lands.
//
// Collision policy is mode-aware, but factored so the ledger stays uniform:
//   - jam / record  → earliest-wins: whoever registers the (row,step) first this
//     pass sounds; the later one is skipped. This falls out of "within window →
//     skip" directly (live tap early → live sounds, tick skipped; tap late →
//     tick already sounded, tap skipped).
//   - practice      → sequencer-authoritative: the live caller pre-suppresses a
//     tap that matches a sounded grid note BEFORE calling triggerStep, so only
//     the sequencer registers and the reference pulse is what's heard. A missed
//     tap (no note at that step) still sounds. See useLiveInput.handleDrumPad.
export type TriggerSource = "live" | "sequencer";

// ½ a step = the nearest-snap window (EPIC-2 story 2 rounds to nearest step).
export const SNAP_WINDOW_STEPS = 0.5;

// "row:step" -> audio-context time it last sounded. Compared within a tolerance
// window; entries self-expire by time (next loop pass is a full 2 bars later)
// and are cleared on stop. Bounded at 12x64 keys, no leak.
const lastSoundedAt = new Map<string, number>();

function stepWindowSeconds(): number {
  // One step = a 32nd note = (60/bpm)/8 seconds; the window is half of that.
  const bpm = Tone.getTransport().bpm.value;
  return ((60 / bpm) / 8) * SNAP_WINDOW_STEPS;
}

// Pure dedup decision — extracted so the guard is testable without audio.
// True = sound it. Undefined prev (never sounded) or a gap wider than the
// window → sound; within the window → the same (step, pass) already sounded, skip.
export function shouldSound(
  prevTime: number | undefined,
  time: number,
  windowSec: number,
): boolean {
  if (prevTime === undefined) return true;
  return Math.abs(time - prevTime) > windowSec;
}

// The sole drum-sampler caller. `step < 0` means the transport is stopped (the
// pad is a free instrument): sound immediately, no dedup, so rapid taps all fire.
// Returns whether it actually sounded.
export function triggerStep(
  _source: TriggerSource,
  row: PadId,
  step: number,
  bank: Bank,
  time?: number,
  gainDb = 0,
): boolean {
  const at = time ?? Tone.now();
  if (step < 0) {
    playDrumAt(row, at, bank, gainDb);
    return true;
  }
  const key = `${row}:${step}`;
  if (!shouldSound(lastSoundedAt.get(key), at, stepWindowSeconds())) return false;
  lastSoundedAt.set(key, at);
  playDrumAt(row, at, bank, gainDb);
  return true;
}
// ============================================================================

// --- pure helpers (unit-checkable) ---
export function isAccent(beat: number): boolean {
  return beat === 0 || beat === 4; // bar downbeats (the "1" of each bar)
}

function nextBeat(beat: number): number {
  return (beat + 1) % 8;
}

function nextStep(step: number): number {
  return (step + 1) % STEPS;
}

// --- engine state (lean: module-level transport + subscribers) ---
const subscribers = new Set<(beat: number) => void>();
const stepSubscribers = new Set<(step: number) => void>();
// Audio-time step subscribers (sample-accurate); separate from visual stepSubscribers
// which fire inside Tone.Draw. Pattern audio must trigger at the exact Transport time.
const stepAudioSubscribers = new Set<(step: number, time: number) => void>();

// ponytail: mod-8 beat counter wraps the quarter-note position across the loop.
let beat = 0;
// ponytail: mod-STEPS step counter is the 32nd-note grid playhead source across the loop.
let step = 0;
let repeatId: number | null = null;
let stepRepeatId: number | null = null;
let clickEnabled = true; // audible metronome blip; beat/subscribers still fire when muted
// Tone schedules callbacks ahead of the audible playhead. Incrementing this
// token makes already-queued visual callbacks stale as soon as PLAY is paused.
let transportRun = 0;

function scheduleVisual(fn: () => void, time: number): void {
  const run = transportRun;
  Tone.Draw.schedule(() => {
    if (run !== transportRun || !isPlaying()) return;
    fn();
  }, time);
}

export function setClickEnabled(enabled: boolean): void {
  clickEnabled = enabled;
}

export function startTransport(): void {
  const t = Tone.getTransport();
  transportRun += 1;
  t.loop = true;
  t.loopStart = 0;
  t.loopEnd = "2m"; // 2 measures = 8 quarter-note beats
  if (repeatId === null) {
    beat = 0;
    repeatId = t.scheduleRepeat((time) => {
      const b = beat;
      if (!isPlaying()) return;
      const accent = isAccent(b);
      if (clickEnabled) {
        playClickAt(time, accent);
      }
      scheduleVisual(() => {
        for (const cb of subscribers) cb(b);
      }, time);
      beat = nextBeat(beat);
    }, "4n");
  }
  if (stepRepeatId === null) {
    step = 0;
    stepRepeatId = t.scheduleRepeat((time) => {
      const s = step;
      if (!isPlaying()) return;
      for (const cb of stepAudioSubscribers) cb(s, time);
      scheduleVisual(() => {
        for (const cb of stepSubscribers) cb(s);
      }, time);
      step = nextStep(step);
    }, "32n");
  }
  t.start();
}

export function stopTransport(): void {
  const t = Tone.getTransport();
  transportRun += 1;
  t.stop();
  t.position = 0;
  beat = 0;
  step = 0;
  lastSoundedAt.clear(); // fresh dedup ledger next play; stopped pad is free
}

export function setTransportBpm(bpm: number): void {
  Tone.getTransport().bpm.value = bpm;
}

export function isPlaying(): boolean {
  return Tone.getTransport().state === "started";
}

export function onBeat(cb: (beat: number) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function onStep(cb: (step: number) => void): () => void {
  stepSubscribers.add(cb);
  return () => stepSubscribers.delete(cb);
}

export function onStepAudio(cb: (step: number, time: number) => void): () => void {
  stepAudioSubscribers.add(cb);
  return () => stepAudioSubscribers.delete(cb);
}

// Schedule a visual callback at a precise Transport/AudioContext time without importing Tone.
export function scheduleDraw(fn: () => void, time: number): void {
  scheduleVisual(fn, time);
}

// Current position in fractional grid steps (0..STEPS) over the 2-bar loop, read
// from the Transport clock — BPM-honest, wall-clock independent. For hit windows.
export function currentStep16(): number {
  const t = Tone.getTransport();
  return ((t.ticks / t.PPQ) * 8) % STEPS;
}

// --- pure self-check (no audio). Guarded off the render path. ---
export function _selfcheck(): void {
  console.assert(isAccent(0) === true, "accent 0");
  console.assert(isAccent(4) === true, "accent 4");
  console.assert(isAccent(1) === false, "accent 1");
  console.assert(isAccent(7) === false, "accent 7");
  let b = 0;
  const seen: number[] = [];
  for (let i = 0; i < 8; i++) {
    seen.push(b);
    b = nextBeat(b);
  }
  console.assert(b === 0, "wrap back to 0 after 8");
  console.assert(seen.join(",") === "0,1,2,3,4,5,6,7", "passed 0..7");
  let s = 0;
  const stepsSeen: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    stepsSeen.push(s);
    s = nextStep(s);
  }
  console.assert(s === 0, `wrap back to 0 after ${STEPS}`);
  console.assert(
    stepsSeen.join(",") === Array.from({ length: STEPS }, (_, i) => i).join(","),
    `passed 0..${STEPS - 1}`,
  );
  // Dedup guard: first hit sounds; the same (step, pass) within the window is
  // skipped (one sound, not a flam); the same step a full pass later sounds again.
  const w = 0.05;
  console.assert(shouldSound(undefined, 1.0, w) === true, "first trigger sounds");
  console.assert(shouldSound(1.0, 1.02, w) === false, "same step within window collapses");
  console.assert(shouldSound(1.0, 1.2, w) === true, "same step outside window sounds again");
}
