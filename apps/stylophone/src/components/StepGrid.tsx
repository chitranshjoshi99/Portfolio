// 64-step pattern grid — projected by instrument mode (R8).
// Stateless/timerless: the playhead comes from the `currentStep` prop, which App
// feeds from transport.onStep (Tone.Draw). No interval/timeout/rAF here.
//
// ALWAYS 12 rows x 64 steps. The 12 row positions are the 12 physical pads; what
// a row MEANS is the projection: in "drums" a row is that pad's drum voice, in
// "bass" it is that pad's chromatic PITCH CLASS. Both Pattern layers are stored
// and played at all times — a mode switch only changes what is drawn/editable.
import { DRUM_BY_PAD, PAD_IDS, type Mode, type PadId } from "../lib/constants";
import type { PassState } from "../lib/guidance";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { activeBassCell, clearRow, fillRow, STEPS, type Pattern } from "../lib/pattern";
import "./StepGrid.css";

// Per-drum-row quick-fills. Layout is 8 steps/beat, 32 steps/bar (transport.ts):
// every8 = four-on-the-floor, every16 offset 8 = backbeat (2 & 4), every8 offset 4
// = offbeats. Each entry is a pure Pattern → Pattern applied via commitPatternEdit.
const DRUM_FILLS: {
  label: string;
  title: string;
  apply: (p: Pattern, pad: PadId) => Pattern;
}[] = [
  { label: "×8", title: "Four on the floor — one hit per beat", apply: (p, pad) => fillRow(p, pad, 8) },
  { label: "×4", title: "Eighths — two hits per beat", apply: (p, pad) => fillRow(p, pad, 4) },
  { label: "×2", title: "Sixteenths — four hits per beat", apply: (p, pad) => fillRow(p, pad, 2) },
  { label: "off", title: "Offbeats — the “and” of each beat", apply: (p, pad) => fillRow(p, pad, 8, 4) },
  { label: "back", title: "Backbeat — beats 2 & 4", apply: (p, pad) => fillRow(p, pad, 16, 8) },
  { label: "clr", title: "Clear this row", apply: (p, pad) => clearRow(p, pad) },
];

// Native hardware pad numbering is one chromatic octave (see constants.ts).
// Consistent sharp notation — the row label's note half.
const NOTE_BY_PAD: Record<PadId, string> = {
  "1": "C", "1.5": "C♯", "2": "D", "2.5": "D♯", "3": "E", "4": "F",
  "4.5": "F♯", "5": "G", "5.5": "G♯", "6": "A", "6.5": "A♯", "7": "B",
};

// Signed octave, "0" for the default, so repeated pitch classes stay distinct.
function octaveLabel(octave: number): string {
  return octave > 0 ? `+${octave}` : octave < 0 ? `−${-octave}` : "0";
}

// The shared template is 16 groups of [beat spacer, 4 step tracks] = 80 tracks
// carrying 64 cells, so a step's column has to be stated rather than left to
// auto-flow, which would drop every 4th cell into a spacer. Header and rows call
// the same function, which is what keeps their centrelines identical.
function stepColumn(step: number): number {
  return Math.floor(step / 4) * 5 + (step % 4) + 2; // 1-based; +1 skips the spacer
}

export default function StepGrid({
  pattern,
  mode,
  currentStep,
  onToggleCell,
  onPaintDrum,
  onRowFill,
  selectedBassStep,
  onSelectBass,
  onExtendBass,
  dimmed = false,
  disabled = false,
  drumPassStates,
  bassPassState = null,
}: {
  pattern: Pattern;
  mode: Mode;
  currentStep: number;
  onToggleCell: (pad: PadId, step: number) => void;
  /** Drag-paint: explicitly set a drum cell on/off (not a toggle). */
  onPaintDrum?: (pad: PadId, step: number, on: boolean) => void;
  /** Quick-fill: commit a pure Pattern → Pattern row mutation. */
  onRowFill?: (mutator: (p: Pattern) => Pattern) => void;
  selectedBassStep: number | null;
  onSelectBass: (step: number, pad: PadId) => void;
  /** Receives the bass start and current drag endpoint, both as 0-based steps. */
  onExtendBass?: (start: number, end: number) => void;
  dimmed?: boolean;
  disabled?: boolean;
  drumPassStates?: Partial<Record<PadId, PassState>>;
  bassPassState?: PassState | null;
}) {
  const bass = mode === "bass";
  const bassDragStart = useRef<number | null>(null);
  const bassDragStep = useRef<number | null>(null);
  // Drum drag-paint: the row is pinned to the cell first touched (per-voice, no
  // cross-row paint), paintTarget is the state to write to every swept cell, and
  // paintStep tracks the last cell painted so re-entering it commits nothing.
  const paintPad = useRef<PadId | null>(null);
  const paintTarget = useRef(false);
  const paintStep = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const [openFillPad, setOpenFillPad] = useState<PadId | null>(null);
  const fillsRef = useRef<HTMLDivElement>(null);
  const rowLabel = (pad: PadId) =>
    `${pad} · ${bass ? NOTE_BY_PAD[pad] : DRUM_BY_PAD[pad].label}`;

  useEffect(() => {
    if (openFillPad == null) return;

    function dismissFill(event: globalThis.PointerEvent): void {
      if (!fillsRef.current?.contains(event.target as Node)) setOpenFillPad(null);
    }

    function dismissOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpenFillPad(null);
    }

    document.addEventListener("pointerdown", dismissFill);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissFill);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [openFillPad]);

  function cellStepAtPoint(x: number, y: number): number | null {
    const target = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>(
      ".step-cell[data-step]",
    );
    const step = target?.dataset.step;
    return step == null ? null : Number(step);
  }

  function padAtEvent(event: PointerEvent<HTMLDivElement>): PadId | undefined {
    const pad = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>(".step-cell")?.dataset.pad
      : undefined;
    return pad && PAD_IDS.includes(pad as PadId) ? (pad as PadId) : undefined;
  }

  // Same pointer-drag machinery for both modes: bass extends a note length, drums
  // paint a run. First cell touched decides everything (bass start / paint target).
  function startDrag(event: PointerEvent<HTMLDivElement>): void {
    if (disabled || event.button !== 0) return;
    const start = cellStepAtPoint(event.clientX, event.clientY);
    if (start == null) return;
    const pad = padAtEvent(event);

    if (bass) {
      bassDragStart.current = start;
      bassDragStep.current = start;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (pad) onSelectBass(start, pad);
      return;
    }

    if (!pad) return;
    // start empty → paint ON; start lit → erase.
    const target = !pattern.drums[pad][start];
    paintPad.current = pad;
    paintTarget.current = target;
    paintStep.current = start;
    suppressClick.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onPaintDrum?.(pad, start, target);
  }

  function extendDrag(event: PointerEvent<HTMLDivElement>): void {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const at = cellStepAtPoint(event.clientX, event.clientY);
    if (at == null) return;

    if (bass) {
      if (bassDragStart.current == null || at === bassDragStep.current) return;
      bassDragStep.current = at;
      onExtendBass?.(bassDragStart.current, at);
      return;
    }

    if (paintPad.current == null || at === paintStep.current) return;
    paintStep.current = at;
    onPaintDrum?.(paintPad.current, at, paintTarget.current);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    bassDragStart.current = null;
    bassDragStep.current = null;
    paintPad.current = null;
    paintStep.current = null;
  }

  return (
    <div
      className={`step-grid${dimmed ? " is-locked" : ""}`}
      role="group"
      aria-label={`64-step ${bass ? "bass" : "drums"} grid`}
      onPointerDown={startDrag}
      onPointerMove={extendDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Label RAIL: fixed, outside the 64-column template, never scrolls away. */}
      <div className="step-grid__rail">
        <span className="step-grid__rail-head" aria-hidden="true" />
        {PAD_IDS.map((pad, rowIndex) => {
          const rowState = bass ? bassPassState : drumPassStates?.[pad];
          const rowHasContent = bass
            ? pattern.bass.some((cell) => cell?.pad === pad)
            : pattern.drums[pad].some(Boolean);
          // const stateLabel = rowHasContent && rowState ? ` · ${rowState}` : "";
          return (
            <div className={`step-grid__label${rowHasContent && rowState ? ` is-guide-${rowState}` : ""}`} key={pad}>
              <span className="step-grid__label-text">{rowLabel(pad)}</span>
              {!bass && !disabled && onRowFill && (
                <div
                  ref={openFillPad === pad ? fillsRef : null}
                  className={
                    "step-grid__fills" +
                    (openFillPad === pad ? " is-open" : "") +
                    (rowIndex === PAD_IDS.length - 1 ? " step-grid__fills--upward" : "")
                  }
                >
                  <button
                    type="button"
                    className="step-grid__fills-toggle"
                    aria-label={`Quick fills for ${rowLabel(pad)}`}
                    aria-expanded={openFillPad === pad}
                    aria-controls={`fills-${pad}`}
                    onClick={() => setOpenFillPad((open) => (open === pad ? null : pad))}
                  >
                    fill
                  </button>
                  {openFillPad === pad && (
                    <div
                      id={`fills-${pad}`}
                      className="step-grid__fills-menu"
                      role="group"
                      aria-label={`${rowLabel(pad)} fills`}
                    >
                    {DRUM_FILLS.map((f) => (
                      <button
                        type="button"
                        key={f.label}
                        className="step-grid__fill-chip"
                        title={f.title}
                        onClick={() => {
                          onRowFill((p) => f.apply(p, pad));
                          setOpenFillPad(null);
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step PLANE: header + 12 rows, all sharing --sg-cols so the column
          centrelines match from the header down to the last row. */}
      <div className="step-grid__plane">
        <div className="step-grid__cycle-labels" aria-hidden="true">
          <span>BAR 1 · 1–32</span>
          <span>BAR 2 · 33–64</span>
        </div>
        <div className="step-grid__head" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, step) => (
            <span
              key={step}
              style={{ gridColumn: stepColumn(step) }}
              className={
                "step-head" +
                (step === 32 ? " is-bar-start" : "") +
                (step === currentStep ? " is-playhead" : "")
              }
            >
              {step + 1}
            </span>
          ))}
        </div>

        {PAD_IDS.map((pad) => {
          const rowState = bass ? bassPassState : drumPassStates?.[pad];
          const rowHasContent = bass
            ? pattern.bass.some((cell) => cell?.pad === pad)
            : pattern.drums[pad].some(Boolean);
          return (
          <div className={`step-grid__row${rowHasContent && rowState ? ` is-guide-${rowState}` : ""}`} key={pad}>
            {Array.from({ length: STEPS }, (_, step) => {
              const start = bass ? pattern.bass[step] : null;
              const active = bass ? activeBassCell(pattern.bass, step) : null;
              // A bass note lives in the row of its pitch class (cell.pad).
              const bassStart = bass && start != null && start.pad === pad;
              const bassSustain = bass && !bassStart && active?.pad === pad;
              const filled = bass
                ? bassStart || bassSustain
                : pattern.drums[pad][step];
              const cls =
                "step-cell" +
                (filled ? " is-filled" : "") +
                (bassStart ? " is-bass-start" : "") +
                (bassSustain ? " is-bass-sustain" : "") +
                (filled && rowState ? ` is-guide-${rowState}` : "") +
                (bassStart && step === selectedBassStep ? " is-selected" : "") +
                (step === currentStep ? " is-playhead" : "") +
                (step === 32 ? " is-bar-start" : "");
              const bassState = bassStart
                ? `note start, octave ${octaveLabel(start.octave)}, length ${start.length} steps`
                : bassSustain
                  ? `sustain, octave ${octaveLabel(active!.octave)}`
                  : "empty";
              return (
                <button
                  type="button"
                  key={step}
                  data-step={step}
                  data-pad={pad}
                  style={{ gridColumn: stepColumn(step) }}
                  className={cls}
                  aria-pressed={bass ? bassStart : filled}
                  aria-label={`${rowLabel(pad)} step ${step + 1}${bass ? `, ${bassState}` : ""}`}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    // A pointer gesture already applied its edit on pointerdown/move;
                    // swallow the trailing click. Keyboard activation (no pointerdown)
                    // leaves this false, so Enter/Space still toggles/selects.
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    if (bass) onSelectBass(step, pad);
                    else onToggleCell(pad, step);
                  }}
                >
                  {bassStart ? octaveLabel(start.octave) : ""}
                </button>
              );
            })}
          </div>
          );
        })}
      </div>
    </div>
  );
}
