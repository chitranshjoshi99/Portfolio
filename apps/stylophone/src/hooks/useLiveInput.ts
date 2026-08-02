import { type MutableRefObject, useRef, useState } from "react";
import { clampOctave, type Mode, type PadId } from "../lib/constants";
import {
  attackBass,
  moveBass,
  releaseBass,
  startAudio,
} from "../lib/audio";
import {
  bassLengthBeforeStep,
  bassLengthThroughStep,
  setBass,
  STEPS,
  toggleDrum,
  type Pattern,
} from "../lib/pattern";
import { currentStep16, isPlaying, triggerStep } from "../lib/transport";
import { isHit } from "../lib/hit";
import type { GuideState } from "./usePattern";

// Green-hit window (E4.1): a practice tap counts as on-target within this many
// steps of a lit note in the pad's own lane. ponytail: forgiving for on-screen
// taps; tune to feel. Wider than the nearest-snap ±0.5 so touch stays winnable.
const HIT_TOL_STEPS = 1.5;

// Nearest-snap self-check (E2.2): confirm round-direction at the .5 boundary —
// 7.4 snaps back to 7, 7.6 forward to 8; a full-loop 63.6 wraps to 0.
const snap = (pos: number) => Math.round(pos) % STEPS;
console.assert(snap(7.4) === 7 && snap(7.6) === 8, "nearest-snap .5 boundary");
console.assert(snap(63.6) === 0, "nearest-snap wraps at loop end");

// Owns the pad-tap / keyboard-bass live-input surface: drum one-shots, the
// monophonic bass attack/slide/release voice, and — while REC is armed —
// writing what's played into the Pattern at the live playhead step.
// Also owns the live playhead ref: useTransportEngine writes into it on every
// tick, but this hook is the one that needs to read it reactively-free inside
// event handlers, and it's called first — so it creates the ref and hands it
// back for the transport hook to write into, instead of App owning it.
export function useLiveInput(
  patternRef: MutableRefObject<Pattern>,
  octave: number,
  commitPatternEdit: (mutator: (pattern: Pattern) => Pattern) => boolean,
  guideRef: MutableRefObject<GuideState>,
) {
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(recording);
  recordingRef.current = recording;
  const [lastPad, setLastPad] = useState<PadId | null>(null);
  // Green flash on a correct practice tap (E4.1). Cleared by a short cosmetic
  // timer unless a newer hit replaces it.
  const [hitPad, setHitPad] = useState<PadId | null>(null);
  const [missPad, setMissPad] = useState<PadId | null>(null);
  const verdictTimerRef = useRef<number | null>(null);
  const stepRef = useRef(-1); // live playhead, written by useTransportEngine
  // While REC is armed, this tracks the single cell owned by the held live
  // bass note. It is intentionally independent of the live synth state: the
  // former changes Pattern data at quantized boundaries, the latter is audible
  // immediately under the pointer/key.
  const recordedBassRef = useRef<{ step: number } | null>(null);
  // Invalidates a pending first attack if its pointer/key is released before
  // the initial sample decode finishes.
  const bassInputTokenRef = useRef(0);

  // Nearest-step snap (E2.2): a recorded tap lands on the NEAREST step boundary,
  // not the current playhead (floor). currentStep16() is the live fractional
  // position, always available, so we round it directly instead of reading the
  // floored visual ref — a tap a few ms early/late snaps to where it was meant.
  // Math.round(63.6)=64 → % STEPS wraps to 0. Single place both drum and bass
  // capture route through, so nearest-snap is applied exactly once.
  function captureStep(): number {
    return snap(currentStep16());
  }

  function captureAndGradePad(padId: PadId, inputMode: Mode) {
    // Pad + grid are one surface: while PLAYING and REC-armed, a tap lands in
    // the Pattern at the live playhead step, so it shows on the grid at once.
    // R4 extends this to duration/legato capture; R3 retains the existing
    // single-step write for the initial attack only.
    if (isPlaying() && recording) {
      const s = captureStep();
      if (inputMode === "drums") {
        // toggleDrum flips; guard so a tap only turns the cell ON, never off.
        commitPatternEdit((p) =>
          p.drums[padId][s] ? p : toggleDrum(p, padId, s),
        );
      }
    }
  }

  function captureBassAttack(padId: PadId) {
    if (
      guideRef.current.status === "guided" ||
      !isPlaying() ||
      !recordingRef.current
    )
      return;
    const s = captureStep();
    recordedBassRef.current = { step: s };
    commitPatternEdit((p) => setBass(p, s, { pad: padId, octave, length: 1 }));
  }

  function captureBassSlide(padId: PadId, cellOctave: number) {
    const held = recordedBassRef.current;
    if (
      guideRef.current.status === "guided" ||
      !held ||
      !isPlaying() ||
      !recordingRef.current
    )
      return;

    const s = captureStep();
    if (s === held.step) {
      // Two pitches cannot occupy one quantized cell. Preserve the original
      // attack and replace its pitch instead of emitting a duplicate record.
      commitPatternEdit((p) => {
        const cell = p.bass[s];
        return cell ? setBass(p, s, { ...cell, pad: padId, octave: cellOctave }) : p;
      });
      return;
    }

    const previousStep = held.step;
    const previousLength = bassLengthBeforeStep(previousStep, s);
    commitPatternEdit((p) => {
      const previous = p.bass[previousStep];
      const closed = previous
        ? setBass(p, previousStep, { ...previous, length: previousLength })
        : p;
      return setBass(closed, s, { pad: padId, octave: cellOctave, length: 1 });
    });
    recordedBassRef.current = { step: s };
  }

  function extendRecordedBass(s: number) {
    const held = recordedBassRef.current;
    if (
      guideRef.current.status === "guided" ||
      !held ||
      !isPlaying() ||
      !recordingRef.current
    )
      return;
    commitPatternEdit((p) => {
      const cell = p.bass[held.step];
      if (!cell) return p;
      // A repeating transport reaches the note's start step again after a
      // full loop. The stored loop representation tops out at 64 cells, so
      // retain that full-loop sustain instead of resetting it to one cell.
      const length = Math.max(cell.length, bassLengthThroughStep(held.step, s));
      if (cell.length === length) return p;
      return setBass(p, held.step, { ...cell, length });
    });
  }

  // First tap unlocks AudioContext (iOS), then routes the drum sound through the
  // single engine (triggerStep) so a well-timed tap on an existing grid note
  // collapses with the sequencer's tick into one sound instead of a flam.
  // Bass has its own sustained pointer/key path below (a continuous monophonic
  // instrument, not a step one-shot — deliberately out of this dedup and using
  // its own voice, so it never doubled the way drum one-shots did).
  async function handleDrumPad(padId: PadId) {
    setLastPad(padId);
    const playing = isPlaying();
    const practice = guideRef.current.status !== "compose";
    const lane = patternRef.current.drums[padId];
    const targets: number[] = [];
    for (let s = 0; s < lane.length; s++) if (lane[s]) targets.push(s);
    // Take one transport-time snapshot for both the green verdict and the
    // audio decision. Reading again after startAudio() can cross a step
    // boundary on the first iOS unlock, making a green hit choose a different
    // dedup coordinate.
    const position = playing ? currentStep16() : -1;
    const practiceHit = practice && playing && isHit(targets, position, HIT_TOL_STEPS);
    // Keep the haptic inside the initiating gesture; awaiting audio setup first
    // can make browsers reject it even when the tap itself was eligible.
    if (practiceHit) navigator.vibrate?.(12);
    await startAudio(); // idempotent; starts inside this user gesture
    // Dedup step = the nearest grid step (same coordinate the sequencer fires on);
    // -1 when stopped so the pad stays a free, always-sounding instrument.
    const step = playing ? Math.round(position) % STEPS : -1;
    // Practice is sequencer-authoritative. The visual green hit window is
    // intentionally wider than nearest-step snapping for touch play, so this
    // must use practiceHit (not just the rounded cell) or a green tap near an
    // adjacent empty step will sound live and then sound again on the target.
    // A true miss still sounds; jam/record retain triggerStep's earliest-wins
    // collision policy.
    const suppressed = practiceHit;
    if (!suppressed) {
      triggerStep("live", padId, step, patternRef.current.drumBank);
    }
    // Green-on-correct-hit (E4.1): during a lesson while playing, a tap that
    // lands within HIT_TOL_STEPS of a lit note in this pad's own lane flashes
    // the wedge green. Miss = nothing. Uses currentStep16() (transport time) so
    // it stays fair at any BPM.
    if (practice && playing) {
      if (practiceHit) {
        flashVerdict(padId, "hit");
      } else {
        flashVerdict(padId, "miss");
      }
    }
    captureAndGradePad(padId, "drums");
  }

  function flashVerdict(padId: PadId, verdict: "hit" | "miss") {
    setHitPad(verdict === "hit" ? padId : null);
    setMissPad(verdict === "miss" ? padId : null);
    if (verdictTimerRef.current !== null) window.clearTimeout(verdictTimerRef.current);
    verdictTimerRef.current = window.setTimeout(() => {
      setHitPad(null);
      setMissPad(null);
      verdictTimerRef.current = null;
    }, 350);
  }

  async function handleBassAttack(padId: PadId) {
    const inputToken = ++bassInputTokenRef.current;
    setLastPad(padId);
    await startAudio(); // starts inside the pointer/key gesture
    if (inputToken !== bassInputTokenRef.current) return;
    attackBass(padId, octave, patternRef.current.bassBank);
    captureBassAttack(padId);
    captureAndGradePad(padId, "bass");
  }

  // octaveShift comes from the visualizer's 12-o'clock wrap (7→1 up, 1→7
  // down); keyboard slides pass none. The effective octave stays inside the
  // supported ±2 range no matter how far the drag wound.
  async function handleBassMove(padId: PadId, octaveShift = 0) {
    const inputToken = bassInputTokenRef.current;
    setLastPad(padId);
    await startAudio();
    if (inputToken !== bassInputTokenRef.current) return;
    const effectiveOctave = clampOctave(octave + octaveShift);
    moveBass(padId, effectiveOctave, patternRef.current.bassBank);
    captureBassSlide(padId, effectiveOctave);
  }

  function handleBassRelease() {
    bassInputTokenRef.current += 1;
    recordedBassRef.current = null;
    releaseBass();
  }

  function onToggleRecording() {
    if (guideRef.current.status !== "compose") return;
    setRecording((armed) => {
      // Re-arming while a key/pointer is already down must not resume a stale
      // capture. A fresh attack establishes the next recorded bass cell.
      if (armed) recordedBassRef.current = null;
      return !armed;
    });
  }

  // Full stop: used when guidance starts, since it owns the transport instead.
  function stopRecording() {
    setRecording(false);
    recordedBassRef.current = null;
  }

  return {
    stepRef,
    recording,
    setRecording,
    lastPad,
    hitPad,
    missPad,
    handleDrumPad,
    handleBassAttack,
    handleBassMove,
    handleBassRelease,
    onToggleRecording,
    stopRecording,
    extendRecordedBass,
  };
}
