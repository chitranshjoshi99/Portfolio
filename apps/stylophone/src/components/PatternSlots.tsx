import { PATTERN_SLOTS, type PatternSlot } from "../hooks/usePatternBank";
import "./PatternSlots.css";

export default function PatternSlots({
  activeSlot,
  queuedSlot,
  playing,
  disabled,
  onSelectSlot,
}: {
  activeSlot: PatternSlot;
  queuedSlot: PatternSlot | null;
  playing: boolean;
  disabled: boolean;
  onSelectSlot: (slot: PatternSlot) => void;
}) {
  return (
    <div className="pattern-slots" role="group" aria-label="Pattern slots">
      <div className="pattern-slots__buttons">
        {PATTERN_SLOTS.map((slot) => {
          const active = slot === activeSlot;
          const queued = playing && slot === queuedSlot;
          return (
            <button
              type="button"
              key={slot}
              className={`pattern-slot${active ? " is-active" : ""}${queued ? " is-queued" : ""}`}
              aria-pressed={active}
              aria-label={`Pattern slot ${slot}${active ? ", active" : queued ? ", queued" : ""}`}
              title={queued ? `Pattern slot ${slot} queued` : `Select pattern slot ${slot}`}
              disabled={disabled}
              onClick={() => onSelectSlot(slot)}
            >
              {slot}
            </button>
          );
        })}
      </div>
      <span className="pattern-slots__status sr-only" role="status" aria-live="polite">
        {playing && queuedSlot !== null
          ? `Queued ${queuedSlot} · active ${activeSlot}`
          : `Active ${activeSlot}`}
      </span>
    </div>
  );
}
