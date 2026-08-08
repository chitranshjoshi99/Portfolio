import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect, useState } from "react";
import { BPM_DEFAULT, PAD_IDS, type PadId } from "../lib/constants";
import { derivePasses, passGainDb, passState } from "../lib/guidance";
import { activeBassCell, type Pattern } from "../lib/pattern";
import {
  isPlaying,
  onBeat,
  onStep,
  onStepAudio,
  scheduleDraw,
  setClickEnabled,
  setTransportBpm,
  startTransport,
  stopTransport,
  triggerStep,
} from "../lib/transport";
import { playBassAt, startAudio, stopSequencedAudio } from "../lib/audio";
import type { GuideState } from "./usePattern";

// Owns the transport clock (bpm/play state/playhead) and the audio-thread
// scheduling effect that sounds the stored pattern each step, mixed by the
// guide's current pass state.
export function useTransportEngine(
  patternRef: MutableRefObject<Pattern>,
  transposeOffsetRef: MutableRefObject<number>,
  stepRef: MutableRefObject<number>,
  commitQueuedSlot: () => void,
  guideRef: MutableRefObject<GuideState>,
  extendRecordedBass: (step: number) => void,
  handleBassRelease: () => void,
  setRecording: Dispatch<SetStateAction<boolean>>,
  pauseGuidance: () => void,
  resumeGuidance: () => void,
  resetTranspose: () => void,
) {
  const [bpm, setBpm] = useState(BPM_DEFAULT);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1); // -1 = idle (no dot lit)
  const [step, setStep] = useState(-1); // -1 = idle (no playhead column)
  const [clickEnabled, setClickEnabledState] = useState(true);
  // Scheduled score events are projected to their physical pad wedges, kept
  // per voice so the visualizer can show only the map its mode names (drum
  // map in drums mode, bass map in bass mode). Derived at each transport
  // step, never persisted alongside Pattern.
  const [sequencedPads, setSequencedPads] = useState<{
    drums: readonly PadId[];
    bass: readonly PadId[];
  }>({ drums: [], bass: [] });

  // Beat indicator + grid playhead are driven by the Transport tick (Tone.Draw),
  // never a React timer.
  useEffect(() => onBeat(setBeat), []);
  // Empty deps: subscribes once at mount, same as the rest of this hook's
  // effects. Safe because extendRecordedBass only ever touches refs and
  // stable setState setters internally, so any render's closure behaves
  // identically — capturing the mount-time one avoids a resubscribe storm
  // from its function identity changing every render.
  useEffect(
    () =>
      onStep((s) => {
        stepRef.current = s;
        setStep(s);
        extendRecordedBass(s);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Sound the stored pattern on the audio thread: each 16th-note step triggers
  // its placed drum hits + bass note at the exact Transport time. Reads the live
  // pattern via ref, so an edit is heard on the next loop pass. Story 3 adds the
  // guide's pass-state mix selector at this single scheduling seam.
  useEffect(
    () =>
      onStepAudio((s, time) => {
        if (s === 0) commitQueuedSlot();
        const p = patternRef.current;
        const currentGuide = guideRef.current;
        const passes = derivePasses(p);
        const guided = currentGuide.status !== "compose";
        const drumPads: PadId[] = [];
        const bassPads: PadId[] = [];
        for (const pad of PAD_IDS) {
          if (p.drums[pad][s]) {
            const state = guided
              ? passState(passes, currentGuide.passIndex, { kind: "drum", pad })
              : "active";
            const gain = passGainDb(state);
            if (gain === null) continue;
            // Route through the spine so a live tap on this same (pad, step)
            // collapses with this tick into one sound (EPIC-2 story 1).
            triggerStep("sequencer", pad, s, p.drumBank, time, gain);
            if (state === "active") drumPads.push(pad);
          }
        }
        const transposeOffset = transposeOffsetRef.current;
        const bass = activeBassCell(p.bass, s);
        const bassPass = passes.find((candidate) => candidate.kind === "bass");
        const bassState = bassPass
          ? guided
            ? passState(passes, currentGuide.passIndex, bassPass)
            : "active"
          : "unreached";
        const bassGain = passGainDb(bassState);
        if (bassGain !== null) playBassAt(bass, time, p.bassBank, bassGain, transposeOffset);
        else playBassAt(null, time, p.bassBank, 0, transposeOffset);
        if (bass && bassState === "active") bassPads.push(bass.pad);
        scheduleDraw(() => setSequencedPads({ drums: drumPads, bass: bassPads }), time);
      }),
    // Empty deps: subscribes once at mount. patternRef/guideRef are refs
    // (stable identity, read via .current), so no re-subscription is needed.
    [],
  );

  // Tempo follows the knob live, even before PLAY.
  useEffect(() => setTransportBpm(bpm), [bpm]);

  async function onTogglePlay() {
    await startAudio(); // iOS unlock — this click is the gesture
    if (isPlaying()) {
      stopTransport();
      resetTranspose();
      handleBassRelease();
      stopSequencedAudio();
      setSequencedPads({ drums: [], bass: [] });
      setPlaying(false);
      setBeat(-1);
      setStep(-1);
      if (guideRef.current.status === "guided") {
        setRecording(false);
        pauseGuidance();
      }
    } else {
      startTransport();
      setPlaying(true);
      if (guideRef.current.status === "paused") {
        resumeGuidance();
      }
    }
  }

  function onToggleClick() {
    setClickEnabledState((on) => {
      const next = !on;
      setClickEnabled(next);
      return next;
    });
  }

  return {
    bpm,
    setBpm,
    playing,
    beat,
    step,
    clickEnabled,
    sequencedPads,
    onTogglePlay,
    onToggleClick,
  };
}
