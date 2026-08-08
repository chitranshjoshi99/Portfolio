// Guidance is derived from the authored score: each used physical drum pad is
// a pass in native order, followed by bass when present. It is intentionally
// view-only here; later stories own progression and reset behaviour.
import { DRUM_BY_PAD } from "../lib/constants";
import { passState, type Pass } from "../lib/guidance";
import "./LayerStack.css";

const STATE_WORD = {
  passed: "passed",
  active: "active",
  unreached: "unreached",
} as const;

function label(pass: Pass): string {
  return pass.kind === "bass"
    ? "Bass"
    : `Pad ${pass.pad} - ${DRUM_BY_PAD[pass.pad].label}`;
}

function UtilityIcon({ kind }: { kind: "save" | "reset" }) {
  return (
    <svg className="layer-stack__utility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {kind === "save" ? (
        <>
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M8 4v6h8V4M8 20v-6h8v6" />
        </>
      ) : (
        <>
          <path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13" />
          <path d="M10 11v6m4-6v6" />
        </>
      )}
    </svg>
  );
}

export default function LayerStack({
  passes,
  status,
  currentIndex,
  onStartGuidance,
  onNextGuidance,
  onRestartGuidance,
  onStopLesson,
  onRedoPass,
  onResetPattern,
  onOpenDraft,
  // onExportBackup,
  // cueStyle,
  // onToggleCueStyle,
}: {
  passes: readonly Pass[];
  status: "compose" | "guided" | "paused" | "complete";
  currentIndex: number;
  onStartGuidance: () => void;
  onNextGuidance: () => void;
  onRestartGuidance: () => void;
  onStopLesson: () => void;
  onRedoPass: (pass: Pass) => void;
  onResetPattern: () => void;
  onOpenDraft: () => void;
  // onExportBackup: () => void;
  // cueStyle: "echo" | "pulse";
  // onToggleCueStyle: () => void;
}) {
  const isEmpty = passes.length === 0;
  const primaryLabel =
    status === "compose"
      ? "Start guidance"
      : status === "complete"
        ? "Restart"
        : "Next row";
  const primaryAction =
    status === "compose"
      ? onStartGuidance
      : status === "complete"
        ? onRestartGuidance
        : onNextGuidance;
  return (
    <div className="layer-stack">
      <div className="layer-stack__step-display">
        <p className="layer-stack__heading">Guidance</p>
        <div className="layer-stack__rows">
          {isEmpty ? (
            <p className="layer-stack__empty" id="guidance-empty-reason">
              Add a drum or bass note to create a guidance pass.
            </p>
          ) : (
            passes.map((pass) => {
              const state = passState(passes, currentIndex, pass);
              return (
                <button
                  type="button"
                  className={`layer layer--${state}`}
                  key={pass.kind === "bass" ? "bass" : pass.pad}
                  disabled={state !== "passed"}
                  onClick={() => onRedoPass(pass)}
                  aria-label={`Redo ${label(pass)}`}
                >
                  <span className="layer__dot" aria-hidden="true" />
                  <span className="layer__name">{label(pass)}</span>
                  <span className="layer__state">{STATE_WORD[state]}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="layer-stack__utility" aria-label="Beat utilities">
        <button
          type="button"
          className="tbtn tbtn--icon layer-stack__utility-button"
          onClick={onOpenDraft}
          aria-label="Save and load beat"
          title="Save and load beat"
          data-tip="Save / load beat"
        >
          <UtilityIcon kind="save" />
        </button>
        <button
          type="button"
          className="tbtn tbtn--icon layer-stack__utility-button layer-stack__utility-button--reset"
          onClick={onResetPattern}
          aria-label="Reset pattern"
          title="Reset pattern"
          data-tip="Reset pattern"
        >
          <UtilityIcon kind="reset" />
        </button>
      </div>

      <div className="layer-stack__actions">
        <button
          type="button"
          className="tbtn"
          disabled={status !== "paused" && status !== "complete"}
          aria-describedby={
            status !== "paused" && status !== "complete"
              ? "guidance-edit-reason"
              : undefined
          }
          onClick={onStopLesson}
        >
          Continue editing
        </button>
      </div>

      <div className="layer-stack__primary">
        <button
          type="button"
          className="tbtn layer-stack__primary-button"
          disabled={isEmpty}
          aria-describedby={isEmpty ? "guidance-empty-reason" : undefined}
          onClick={primaryAction}
        >
          {primaryLabel}
        </button>
      </div>
      <p className="sr-only" id="guidance-edit-reason">
        Continue editing is available after guidance is paused or complete.
      </p>
    </div>
  );
}
