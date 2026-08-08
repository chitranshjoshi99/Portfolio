import StepGrid from "./StepGrid";
import type { Mode, PadId } from "../lib/constants";
import type { PassState } from "../lib/guidance";
import type { Pattern } from "../lib/pattern";
import PatternSlots from "./PatternSlots";
import type { PatternSlot } from "../hooks/usePatternBank";

export default function ScoreSection({
  pattern,
  mode,
  currentStep,
  onToggleCell,
  onPaintDrum,
  onRowFill,
  selectedBassStep,
  onSelectBass,
  onExtendBass,
  dimmed,
  disabled,
  drumPassStates,
  bassPassState,
  activeSlot,
  queuedSlot,
  playing,
  duplicateDisabled,
  onDuplicateBar,
  slotSelectionDisabled,
  onSelectSlot,
}: {
  pattern: Pattern;
  mode: Mode;
  currentStep: number;
  onToggleCell: (pad: PadId, at: number) => void;
  onPaintDrum: (pad: PadId, at: number, on: boolean) => void;
  onRowFill: (mutator: (p: Pattern) => Pattern) => void;
  selectedBassStep: number | null;
  onSelectBass: (step: number, pad: PadId) => void;
  onExtendBass: (start: number, end: number) => void;
  dimmed: boolean;
  disabled: boolean;
  drumPassStates: Partial<Record<PadId, PassState>>;
  bassPassState: PassState | null;
  activeSlot: PatternSlot;
  queuedSlot: PatternSlot | null;
  playing: boolean;
  duplicateDisabled: boolean;
  onDuplicateBar: () => void;
  slotSelectionDisabled: boolean;
  onSelectSlot: (slot: PatternSlot) => void;
}) {
  return (
    <section className="workspace__score" aria-label="Pattern score">
      <div className="score__heading">
        <div>
          <p className="pane__label">Pattern score</p>
          <p className="score__instruction">
            Author the loop here, then follow each populated row on the
            hardware.
          </p>
        </div>
        <div className="score__heading-controls">
          <PatternSlots
            activeSlot={activeSlot}
            queuedSlot={queuedSlot}
            playing={playing}
            disabled={slotSelectionDisabled}
            onSelectSlot={onSelectSlot}
          />
          <span className="score__meta">
            BAR 1 · 1–32 &nbsp; / &nbsp; BAR 2 · 33–64
          </span>
          <button
            type="button"
            className="score__duplicate tbtn tbtn--icon"
            onClick={onDuplicateBar}
            disabled={duplicateDisabled}
            aria-label="Duplicate bar 1 to bar 2"
            title={duplicateDisabled ? "Duplicate unavailable during guidance" : "Duplicate bar 1 to bar 2"}
            data-tip={duplicateDisabled ? "Unavailable during guidance" : "Duplicate bar 1 → 2"}
          >
            <span className="score__duplicate-mark" aria-hidden="true">1 → 2</span>
          </button>
        </div>
      </div>
      <StepGrid
        pattern={pattern}
        mode={mode}
        currentStep={currentStep}
        onToggleCell={onToggleCell}
        onPaintDrum={onPaintDrum}
        onRowFill={onRowFill}
        selectedBassStep={selectedBassStep}
        onSelectBass={onSelectBass}
        onExtendBass={onExtendBass}
        dimmed={dimmed}
        disabled={disabled}
        drumPassStates={drumPassStates}
        bassPassState={bassPassState}
      />
    </section>
  );
}
