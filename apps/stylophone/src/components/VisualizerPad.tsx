import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import BeatPad from "./BeatPad";
import type { Mode, PadId, PadMode } from "../lib/constants";
import type { UndoSnapshot } from "../hooks/usePatternBank";

export type VisualizerPadHandle = {
  playDrum: (padId: PadId) => void;
  attackBass: (padId: PadId) => void;
  moveBass: (padId: PadId) => void;
  releaseBass: () => void;
};

const DRUM_FLASH_MS = 120;

const VisualizerPad = forwardRef<VisualizerPadHandle, {
  mode: Mode;
  padMode: PadMode;
  onDrumPad: (padId: PadId) => void;
  onControlPad: (padId: PadId) => void;
  onBassAttack: (padId: PadId) => void;
  onBassMove: (padId: PadId, octaveShift?: number) => void;
  onBassRelease: () => void;
  activePads: readonly PadId[];
  hitPad?: PadId | null;
  missPad?: PadId | null;
  // guidanceActive: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onArmDelete: () => void;
  onCancelPadMode: () => void;
  undo: UndoSnapshot | null;
  onUndo: () => void;
  onTransposeStart: (padId: PadId) => void;
  onTransposeEnd: () => void;
  transposeOffset: number;
}>(function VisualizerPad({
  mode,
  padMode,
  onDrumPad,
  onControlPad,
  onBassAttack,
  onBassMove,
  onBassRelease,
  activePads,
  hitPad,
  missPad,
  // guidanceActive,
  expanded,
  onToggleExpanded,
  onArmDelete,
  onCancelPadMode,
  undo,
  onUndo,
  onTransposeStart,
  onTransposeEnd,
  transposeOffset,
}, ref) {
  const [keyboardLivePad, setKeyboardLivePad] = useState<PadId | null>(null);
  const drumFlashTimerRef = useRef<number | null>(null);
  const onDrumPadRef = useRef(onDrumPad);
  const onBassAttackRef = useRef(onBassAttack);
  const onBassMoveRef = useRef(onBassMove);
  const onBassReleaseRef = useRef(onBassRelease);
  onDrumPadRef.current = onDrumPad;
  onBassAttackRef.current = onBassAttack;
  onBassMoveRef.current = onBassMove;
  onBassReleaseRef.current = onBassRelease;

  useEffect(() => {
    if (mode !== "bass" || padMode !== "normal") setKeyboardLivePad(null);
  }, [mode, padMode]);

  useEffect(() => () => {
    if (drumFlashTimerRef.current !== null) {
      window.clearTimeout(drumFlashTimerRef.current);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    playDrum(padId) {
      setKeyboardLivePad(padId);
      if (drumFlashTimerRef.current !== null) {
        window.clearTimeout(drumFlashTimerRef.current);
      }
      drumFlashTimerRef.current = window.setTimeout(() => {
        setKeyboardLivePad(null);
        drumFlashTimerRef.current = null;
      }, DRUM_FLASH_MS);
      onDrumPadRef.current(padId);
    },
    attackBass(padId) {
      setKeyboardLivePad(padId);
      onBassAttackRef.current(padId);
    },
    moveBass(padId) {
      setKeyboardLivePad(padId);
      onBassMoveRef.current(padId);
    },
    releaseBass() {
      setKeyboardLivePad(null);
      onBassReleaseRef.current();
    },
  }), []);

  return (
    <aside className="deck__pad" aria-label="Visualizer pad">
      <div className="deck__heading">
        <span>
          Visualizer pad
          {padMode !== "normal" && (
            <strong className={`pad-owner-badge pad-owner-badge--${padMode}`}>
              {padMode === "pattern"
                ? "P"
                : padMode === "delete"
                  ? "Delete"
                  : `T +${transposeOffset}`}
            </strong>
          )}
        </span>
        <div className="deck__heading-actions">
          <button
            type="button"
            className="visualizer-expand"
            aria-label={expanded ? "Restore visualizer size" : "Expand visualizer"}
            aria-pressed={expanded}
            title={
              // guidanceActive ?
              expanded
                  ? "Restore visualizer size"
                  : "Expand visualizer"
                // : "Available during active guidance"
            }
            // disabled={!guidanceActive}
            onClick={onToggleExpanded}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
            </svg>
          </button>
          <small>{mode === "drums" ? "drum map" : "bass map"}</small>
        </div>
      </div>
      <div
        className="deck__pad-body"
        title="Keys: Q–] play pads · Space = play/stop"
      >
        <BeatPad
          mode={mode}
          padMode={padMode}
          onDrumPad={onDrumPad}
          onControlPad={onControlPad}
          onBassAttack={onBassAttack}
          onBassMove={onBassMove}
          onBassRelease={onBassRelease}
          onTransposeStart={onTransposeStart}
          onTransposeEnd={onTransposeEnd}
          cuedPad={activePads[0] ?? null}
          cueStyle={"echo"}
          activePads={activePads}
          hitPad={hitPad}
          missPad={missPad}
          externalLivePad={keyboardLivePad}
        />
        <button
          type="button"
          className={`visualizer-delete${padMode === "delete" ? " is-armed" : ""}`}
          aria-pressed={padMode === "delete"}
          aria-label={padMode === "delete" ? "Cancel delete mode" : "Arm delete mode"}
          title={padMode === "delete" ? "Cancel delete mode (Escape)" : "Arm one-shot delete"}
          data-tip={padMode === "delete" ? "Cancel delete" : padMode === "pattern" ? "Delete pattern" : "Delete row"}
          onClick={padMode === "delete" ? onCancelPadMode : onArmDelete}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6" />
          </svg>
        </button>
      </div>
      {undo && (
        <div className="visualizer-undo" role="status">
          <span>Cleared pattern {undo.slot}</span>
          <button type="button" onClick={onUndo} aria-label={`Undo clearing pattern ${undo.slot}`}>
            Undo
          </button>
        </div>
      )}
      {/* <p className="deck__pad-hint">
        A synchronized translator and optional Compose practice window — not
        hardware sync.
      </p> */}
    </aside>
  );
});

export default VisualizerPad;
