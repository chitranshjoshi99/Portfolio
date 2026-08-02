import { useMemo, useRef, useState } from "react";
import {
  currentPass,
  derivePasses,
  passState,
  redoPass,
  type Pass,
  type PassState,
} from "../lib/guidance";
import { OCTAVE_DEFAULT, clampOctave, type Bank, type Mode, type PadId } from "../lib/constants";
import {
  clearBass,
  setBass,
  setBassLength,
  bassLengthThroughStep,
  duplicateBar1To2,
  setDrum,
  toggleDrum,
  type Pattern,
} from "../lib/pattern";
import { playDrum, previewBass, selectBassBank, selectDrumBank, startAudio } from "../lib/audio";
import type { PatternBankController, PatternSlot } from "./usePatternBank";

export type GuideStatus = "compose" | "guided" | "paused" | "complete";
export type GuideState = { status: GuideStatus; passIndex: number };

// usePattern owns the guide and editor interaction state. The four authored
// patterns live in usePatternBank; every edit below is routed to its active
// slot so grid, live input, guidance and transport share one source of truth.
export function usePattern(
  mode: Mode,
  setMode: (mode: Mode) => void,
  bankController: PatternBankController,
  resetTranspose: () => void = () => {},
) {
  const pattern = bankController.activePattern;
  const patternRef = bankController.activePatternRef; // live pattern for audio-thread scheduling
  const [octave, setOctave] = useState(OCTAVE_DEFAULT);
  const [selectedBassStep, setSelectedBassStep] = useState<number | null>(null);

  // Guidance is an ephemeral view over the authored pattern. It is deliberately
  // not part of PatternDocument or local draft storage.
  const [guide, setGuide] = useState<GuideState>({
    status: "compose",
    passIndex: -1,
  });
  const guideRef = useRef(guide);
  guideRef.current = guide;
  const [guideNotice, setGuideNotice] = useState<string | null>(null);

  const guidancePasses = useMemo(() => derivePasses(pattern), [pattern]);
  const drumPassStates = useMemo(() => {
    const states: Partial<Record<PadId, PassState>> = {};
    for (const pass of guidancePasses) {
      if (pass.kind === "drum") {
        states[pass.pad] =
          guide.status === "compose"
            ? "active"
            : passState(guidancePasses, guide.passIndex, pass);
      }
    }
    return states;
  }, [guidancePasses, guide]);
  const bassPassState = useMemo(() => {
    const pass = guidancePasses.find((candidate) => candidate.kind === "bass");
    if (!pass) return null;
    return guide.status === "compose"
      ? "active"
      : passState(guidancePasses, guide.passIndex, pass);
  }, [guidancePasses, guide]);

  const guideLabel = guide.status === "compose" ? "Compose" : guide.status;
  const passSummary =
    guidancePasses.length === 0
      ? "No guide passes"
      : `${guide.status === "compose" ? 0 : Math.min(guide.passIndex + 1, guidancePasses.length)}/${guidancePasses.length} passes`;

  function setGuideCompose(notice?: string) {
    setGuide({ status: "compose", passIndex: -1 });
    if (notice) setGuideNotice(notice);
  }

  function selectSlot(slot: PatternSlot, playing: boolean): boolean {
    if (guideRef.current.status !== "compose") return false;
    const accepted = bankController.selectSlot(slot, playing);
    if (accepted) setGuideCompose();
    return accepted;
  }

  function pauseGuidance() {
    setGuide((state) => ({ ...state, status: "paused" }));
  }

  function resumeGuidance() {
    setGuide((state) => ({ ...state, status: "guided" }));
  }

  function selectPresentation(pass: Pass | null) {
    if (pass) setMode(pass.kind === "bass" ? "bass" : "drums");
  }

  // Teaching lifecycle is explicit and user-confirmed. Transport never
  // advances the pass; only these controls do.
  function startGuidance() {
    if (guidancePasses.length === 0) return;
    const first = currentPass(guidancePasses, 0);
    selectPresentation(first);
    setGuide({ status: "guided", passIndex: 0 });
    setGuideNotice(null);
  }

  function advanceGuidance() {
    const { status, passIndex } = guideRef.current;
    if (status !== "guided" && status !== "paused") return;
    const next = passIndex + 1;
    if (next >= guidancePasses.length) {
      setGuide({ status: "complete", passIndex: guidancePasses.length });
      return;
    }
    selectPresentation(currentPass(guidancePasses, next));
    setGuide({ status: "guided", passIndex: next });
    setGuideNotice(null);
  }

  function restartGuidance() {
    startGuidance();
  }

  function redoGuidance(pass: Pass) {
    const index = redoPass(guidancePasses, pass);
    if (index < 0) return;
    selectPresentation(pass);
    setGuide({ status: "guided", passIndex: index });
    setGuideNotice(null);
  }

  // All user-authored Pattern mutations pass through commitPatternEdit. Guided
  // mode is read-only; paused and complete edits are accepted but restart the
  // ephemeral guide so its derived pass list remains honest.
  function commitPatternEdit(mutator: (pattern: Pattern) => Pattern): boolean {
    const status = guideRef.current.status;
    if (status === "guided") return false;
    if (status === "paused" || status === "complete") {
      setGuideCompose("Pattern edited — guidance restarted.");
    }
    return bankController.commitActiveSlot(mutator);
  }

  // Commit a grid edit before awaiting audio loading. The score is the source
  // of truth, so a slow first sample decode must never swallow a user edit.
  function handleToggleCell(pad: PadId, at: number) {
    const wasOn = patternRef.current.drums[pad][at];
    if (commitPatternEdit((p) => toggleDrum(p, pad, at)) && !wasOn) {
      void auditionGridDrum(pad);
    }
  }

  async function auditionGridDrum(pad: PadId) {
    await startAudio(); // iOS unlock — invoked synchronously from the grid gesture
    playDrum(pad, patternRef.current.drumBank);
  }

  // Drag-paint writes an explicit on/off (setDrum), never a flip. Audition only
  // when a cell turns ON, matching handleToggleCell's newly-lit feedback.
  function handlePaintDrum(pad: PadId, at: number, on: boolean) {
    const wasOn = patternRef.current.drums[pad][at];
    if (commitPatternEdit((p) => setDrum(p, pad, at, on)) && on && !wasOn) {
      void auditionGridDrum(pad);
    }
  }

  function handleDuplicateBar() {
    commitPatternEdit(duplicateBar1To2);
  }

  // A bass grid press writes the exact pitch row that was pressed. Active notes
  // toggle off like drum cells; new notes remain selected so the bottom octave
  // control can adjust their octave before the next grid action.
  function handleSelectBass(step: number, pad: PadId) {
    const existing = patternRef.current.bass[step];
    if (existing?.pad === pad) {
      if (commitPatternEdit((p) => clearBass(p, step))) {
        resetTranspose();
        setSelectedBassStep(null);
      }
      return;
    }
    const cell = { pad, octave, length: 1 };
    if (!commitPatternEdit((p) => setBass(p, step, cell))) return;
    setSelectedBassStep(step);
    void auditionGridBass(cell);
  }

  // Dragging operates only on the start selected at pointer-down. setBassLength
  // retains its pad/octave and delegates clamping and overlap cleanup to Pattern.
  function handleExtendBass(start: number, end: number) {
    if (
      !commitPatternEdit((p) =>
        setBassLength(p, start, bassLengthThroughStep(start, end)),
      )
    )
      return;
    setSelectedBassStep(start);
  }

  async function auditionGridBass(cell: { pad: PadId; octave: number }) {
    await startAudio(); // iOS unlock — invoked synchronously from the grid gesture
    previewBass(cell.pad, cell.octave, patternRef.current.bassBank);
  }

  function handleBankChange(bank: Bank) {
    if (mode === "drums") {
      bankController.setGlobalBank("drumBank", bank);
      selectDrumBank(bank);
    } else {
      bankController.setGlobalBank("bassBank", bank);
      selectBassBank(bank);
    }
  }

  function handleOctaveChange(next: number) {
    const nextOctave = clampOctave(next);
    setOctave(nextOctave);

    // In Bass mode the bottom octave control is also the selected grid note's
    // octave editor. Empty-cell placement continues to read the same value.
    if (mode !== "bass" || selectedBassStep === null) return;
    const step = selectedBassStep;
    const current = patternRef.current.bass[step];
    if (!current || current.octave === nextOctave) return;
    if (
      commitPatternEdit((p) => {
        const cell = p.bass[step];
        return cell ? setBass(p, step, { ...cell, octave: nextOctave }) : p;
      })
    ) {
      void auditionGridBass({ pad: current.pad, octave: nextOctave });
    }
  }

  return {
    pattern,
    patternRef,
    activeSlot: bankController.activeSlot,
    queuedSlot: bankController.queuedSlot,
    selectSlot,
    octave,
    selectedBassStep,
    setSelectedBassStep,
    commitPatternEdit,
    handleToggleCell,
    handlePaintDrum,
    handleDuplicateBar,
    handleSelectBass,
    handleExtendBass,
    handleBankChange,
    handleOctaveChange,
    guide,
    guideRef,
    guideNotice,
    guidancePasses,
    drumPassStates,
    bassPassState,
    guideLabel,
    passSummary,
    setGuideCompose,
    pauseGuidance,
    resumeGuidance,
    startGuidance,
    advanceGuidance,
    restartGuidance,
    redoGuidance,
  };
}
