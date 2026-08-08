import { useRef } from "react";
import { BPM_MIN, BPM_MAX } from "../lib/constants";
import "./TempoKnob.css";

// ponytail: bpm→angle is one linear map over a 270° arc.
// bpm∈[40,240] → rotation∈[-135deg,+135deg]. Invert with dragScale in the drag handler.
const SWEEP = 270;
function bpmToAngle(bpm: number): number {
  return ((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * SWEEP - SWEEP / 2;
}

const clamp = (bpm: number) =>
  Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, bpm)));

type Props = { bpm: number; onBpmChange: (bpm: number) => void };

export default function TempoKnob({ bpm, onBpmChange }: Props) {
  // Drag origin: bpm + pointer-Y captured on pointer-down.
  const drag = useRef<{ startY: number; startBpm: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, startBpm: bpm };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    // Up = faster: 2px of drag ≈ 1 bpm.
    const deltaBpm = (drag.current.startY - e.clientY) / 2;
    onBpmChange(clamp(drag.current.startBpm + deltaBpm));
  }
  function endDrag(e: React.PointerEvent) {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    let next: number | null = null;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        next = bpm + 1;
        break;
      case "ArrowDown":
      case "ArrowLeft":
        next = bpm - 1;
        break;
      case "PageUp":
        next = bpm + 10;
        break;
      case "PageDown":
        next = bpm - 10;
        break;
    }
    if (next !== null) {
      e.preventDefault();
      onBpmChange(clamp(next));
    }
  }

  return (
    <div className="tempo-knob">
      <div
        className="tempo-knob__dial"
        role="slider"
        tabIndex={0}
        aria-label="Tempo"
        aria-valuenow={bpm}
        aria-valuemin={BPM_MIN}
        aria-valuemax={BPM_MAX}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <div
          className="tempo-knob__indicator"
          style={{ transform: `rotate(${bpmToAngle(bpm)}deg)` }}
        >
          <span className="tempo-knob__pointer" />
        </div>
      </div>

      {/* <div className="tempo-knob__grille" aria-hidden="true">
        <span className="tempo-knob__bpm">{bpm}</span>
        <span className="tempo-knob__unit">BPM</span>
      </div> */}
    </div>
  );
}
