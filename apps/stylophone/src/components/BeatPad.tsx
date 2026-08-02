import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { Mode, PadId, PadMode } from "../lib/constants";
import "./BeatPad.css";

// ponytail: straightforward polar-to-cartesian wedge builder. Angles measured
// clockwise from 12 o'clock; SVG y grows downward so we sin/cos off (deg-90).
//
// Physical Beat geometry: 7 natural keys split the circle into equal sectors
// running the full radial depth (so the inner lane is a gapless natural-only
// ring, exactly like sliding along the bottom of the real keys). The 5
// half-steps straddle the boundaries between naturals — like black piano keys —
// and occupy only the outer half of the depth. No 3.5, no 7.5; the 7|1 boundary
// therefore sits at 12 o'clock with nothing on it.
const SIZE = 320;
const C = SIZE / 2; // center
const R_OUT = 150; // outer radius
const R_IN = 56; // center hole -> donut look
const R_MID = (R_IN + R_OUT) / 2; // 103: where the half-step band starts

const NATURALS = ["1", "2", "3", "4", "5", "6", "7"] as const satisfies readonly PadId[];
const NAT_STEP = 360 / NATURALS.length; // ≈51.43° per natural sector

// Each half-step is centred on the boundary after NATURALS[i], i.e. at
// (i + 1) * NAT_STEP. Skipping i = 2 (3|4) and i = 6 (7|1) is what makes this a
// keyboard rather than a chromatic dial.
const HALF_WIDTH = 34; // ≥44 CSS px both ways once the pad renders ≥300px wide
const HALVES: { id: PadId; center: number }[] = [
  { id: "1.5", center: 1 * NAT_STEP },
  { id: "2.5", center: 2 * NAT_STEP },
  { id: "4.5", center: 4 * NAT_STEP },
  { id: "5.5", center: 5 * NAT_STEP },
  { id: "6.5", center: 6 * NAT_STEP },
];

function pt(radius: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)];
}

function wedgePath(startDeg: number, endDeg: number, rIn: number, rOut: number): string {
  const [x1, y1] = pt(rOut, startDeg);
  const [x2, y2] = pt(rOut, endDeg);
  const [x3, y3] = pt(rIn, endDeg);
  const [x4, y4] = pt(rIn, startDeg);
  // large-arc-flag 0: the widest span here (NAT_STEP ≈51°) is well under 180°.
  return [
    `M ${x1} ${y1}`,
    `A ${rOut} ${rOut} 0 0 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rIn} ${rIn} 0 0 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

// Map a point in the SVG's 320 × 320 viewBox to a physical key. Pointer capture
// keeps delivering events to the original target, so slide detection must use
// coordinates instead of the event target/currentTarget hierarchy.
//
// Layered like the hardware: the outer half is tested against the half-step keys
// first (they sit on top of the naturals there); everything else falls through
// to the natural whose sector owns the angle. An inner-lane slide therefore
// never touches a half-step.
export function padAtPoint(x: number, y: number): PadId | null {
  const dx = x - C;
  const dy = y - C;
  const radius = Math.hypot(dx, dy);
  if (radius < R_IN || radius > R_OUT) return null;

  const degrees = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  if (radius >= R_MID) {
    const half = HALVES.find((h) => Math.abs(degrees - h.center) <= HALF_WIDTH / 2);
    if (half) return half.id;
  }
  return NATURALS[Math.floor(degrees / NAT_STEP) % NATURALS.length];
}

// Pure coordinate contract checks; no DOM or AudioContext required.
export function _selfcheck(): void {
  const at = (radius: number, deg: number) => padAtPoint(...pt(radius, deg));
  const isHalf = (pad: PadId | null) => pad !== null && pad.includes(".");
  const rInner = (R_IN + R_MID) / 2; // 79.5: middle of the inner lane
  const rOuter = (R_MID + R_OUT) / 2; // 126.5: middle of the half-step band

  console.assert(at(rInner, 1) === "1", "sector 1 starts at 12 o'clock");
  console.assert(at(rOuter, NAT_STEP / 2) === "1", "half-steps do not swallow the outer ring");
  console.assert(at(rOuter, NAT_STEP) === "1.5", "outer 1|2 boundary is the 1.5 key");
  console.assert(at(rOuter, 2 * NAT_STEP) === "2.5", "outer 2|3 boundary is the 2.5 key");
  console.assert(!isHalf(at(rOuter, 3 * NAT_STEP)), "no half-step at the 3|4 boundary");
  console.assert(!isHalf(at(rOuter, 0)), "no half-step at the 7|1 boundary (12 o'clock)");

  // The inner lane is naturals only, all the way around: a bass slide from 1 to
  // 2 along the inside never sounds a half-step.
  for (let deg = 0; deg < 360; deg += 0.5) {
    console.assert(!isHalf(at(rInner, deg)), `inner lane must be natural at ${deg}°`);
  }

  console.assert(padAtPoint(C, C) === null, "center hole has no pad");
  console.assert(padAtPoint(C, C - R_OUT - 1) === null, "outside pad is ignored");

  // Octave wrap: crossing 12 o'clock clockwise (7→1) is up, counter-clockwise
  // (1→7) is down, and ordinary intra-ring movement never wraps.
  console.assert(wrapDirection(355, 5) === 1, "7→1 crossing raises the octave");
  console.assert(wrapDirection(5, 355) === -1, "1→7 crossing lowers the octave");
  console.assert(wrapDirection(90, 120) === 0, "ordinary slide does not wrap");
  console.assert(wrapDirection(179, 359) === 0, "a 180° jump is not a wrap");
}

function localPoint(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] | null {
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return [
    ((clientX - rect.left) / rect.width) * SIZE,
    ((clientY - rect.top) / rect.height) * SIZE,
  ];
}

// Angle of a local point, degrees clockwise from 12 o'clock — same convention
// padAtPoint uses. Only meaningful for points that resolved to a pad.
function degreesAtPoint(x: number, y: number): number {
  return (Math.atan2(y - C, x - C) * 180 / Math.PI + 90 + 360) % 360;
}

// A drag that crosses 12 o'clock (the 7|1 boundary — the one gap with no
// half-step key) wraps the bass register like a multi-turn dial: clockwise
// (7 → 1) raises the octave, counter-clockwise (1 → 7) lowers it. Consecutive
// pointer samples are far closer together than 180°, so a raw angular jump
// > 180° can only mean the sweep passed through zero.
function wrapDirection(prevDeg: number, nextDeg: number): -1 | 0 | 1 {
  const delta = nextDeg - prevDeg;
  if (delta < -180) return 1;
  if (delta > 180) return -1;
  return 0;
}

export default function BeatPad({
  mode,
  padMode,
  onDrumPad,
  onControlPad,
  onBassAttack,
  onBassMove,
  onBassRelease,
  onTransposeStart,
  onTransposeEnd,
  cuedPad,
  cueStyle = "echo",
  hitPad,
  missPad,
  activePads = [],
  externalLivePad,
}: {
  mode: Mode;
  padMode: PadMode;
  onDrumPad: (padId: PadId) => void;
  onControlPad: (padId: PadId) => void;
  onBassAttack: (padId: PadId) => void;
  onBassMove: (padId: PadId, octaveShift?: number) => void;
  onBassRelease: () => void;
  onTransposeStart: (padId: PadId) => void;
  onTransposeEnd: () => void;
  cuedPad?: PadId | null;
  cueStyle?: "echo" | "pulse";
  hitPad?: PadId | null;
  missPad?: PadId | null;
  activePads?: readonly PadId[];
  externalLivePad?: PadId | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const activePointerId = useRef<number | null>(null);
  const activePad = useRef<PadId | null>(null);
  const gestureOwner = useRef<"bass" | "transpose" | null>(null);
  // Octave wrap state for the held drag: last in-ring angle and the
  // accumulated shift from 12-o'clock crossings. ±4 covers reaching either
  // clamp limit from any base octave; past that, extra turns are inert.
  const lastAngle = useRef<number | null>(null);
  const dragOctaveShift = useRef(0);
  const emittedShift = useRef(0);
  // The key the held pointer is currently sounding. CSS :active cannot express
  // this: pointer capture keeps delivering events to the element that received
  // the pointerdown, so the browser leaves :active on the key the slide STARTED
  // from. The lit key has to follow the coordinates, like the audio does.
  const [livePad, setLivePad] = useState<PadId | null>(null);
  const onBassReleaseRef = useRef(onBassRelease);
  onBassReleaseRef.current = onBassRelease;
  const onTransposeEndRef = useRef(onTransposeEnd);
  onTransposeEndRef.current = onTransposeEnd;

  const releaseActivePointer = useCallback(() => {
    const pointerId = activePointerId.current;
    const owner = gestureOwner.current;
    activePointerId.current = null;
    activePad.current = null;
    gestureOwner.current = null;
    setLivePad(null);
    if (pointerId === null) {
      if (owner === "transpose") onTransposeEndRef.current();
      else if (owner === "bass") onBassReleaseRef.current();
      return;
    }
    try {
      if (svgRef.current?.hasPointerCapture(pointerId)) {
        svgRef.current.releasePointerCapture(pointerId);
      }
    } catch {
      // Capture may already have been released by the browser.
    } finally {
      // Release audio even if the browser already dropped capture (for example
      // after a pen cancellation while the page loses focus).
      if (owner === "transpose") onTransposeEndRef.current();
      else if (owner === "bass") onBassReleaseRef.current();
    }
  }, []);

  // Covers a mode switch and component teardown. The App also releases on
  // window blur/transport stop, which makes every ownership boundary safe.
  useEffect(() => {
    if (mode !== "bass" || padMode !== "normal") releaseActivePointer();
    return releaseActivePointer;
  }, [mode, padMode, releaseActivePointer]);

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (activePointerId.current !== null) return;
    const point = localPoint(event.currentTarget, event.clientX, event.clientY);
    const pad = point ? padAtPoint(...point) : null;
    if (!point || !pad) return;
    if (padMode === "transpose") {
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        return;
      }
      activePointerId.current = event.pointerId;
      activePad.current = pad;
      gestureOwner.current = "transpose";
      setLivePad(pad);
      onTransposeStart(pad);
      return;
    }
    if (padMode !== "normal" || mode !== "bass") return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Without capture an implicit-touch slide cannot be made reliable, and
      // no audio should start for a pointer we cannot safely own.
      return;
    }
    activePointerId.current = event.pointerId;
    activePad.current = pad;
    gestureOwner.current = "bass";
    lastAngle.current = degreesAtPoint(...point);
    dragOctaveShift.current = 0;
    emittedShift.current = 0;
    setLivePad(pad);
    onBassAttack(pad);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (gestureOwner.current === "transpose") return;
    if (gestureOwner.current !== "bass") return;
    if (event.pointerId !== activePointerId.current) return;
    const point = localPoint(event.currentTarget, event.clientX, event.clientY);
    const pad = point ? padAtPoint(...point) : null;
    // Only in-ring samples advance the wrap tracker: a pointer that leaves
    // near 12 o'clock and re-enters on the other side still reads as one
    // boundary crossing against the last angle that actually sounded.
    if (!point || !pad) return;
    const degrees = degreesAtPoint(...point);
    if (lastAngle.current !== null) {
      const direction = wrapDirection(lastAngle.current, degrees);
      if (direction !== 0) {
        dragOctaveShift.current = Math.max(-4, Math.min(4, dragOctaveShift.current + direction));
      }
    }
    lastAngle.current = degrees;
    if (pad === activePad.current && dragOctaveShift.current === emittedShift.current) return;
    activePad.current = pad;
    emittedShift.current = dragOctaveShift.current;
    setLivePad(pad);
    onBassMove(pad, dragOctaveShift.current);
  }

  function onPointerEnd(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerId === activePointerId.current) releaseActivePointer();
  }

  // One key = one focusable <g>. Naturals are emitted first so the half-steps
  // paint on top of them: that layering is both the visual notch and the reason
  // an outer-band click in drums mode lands on the half-step — the same order
  // padAtPoint applies for a bass slide.
  function key(padId: PadId, d: string, [lx, ly]: [number, number], half: boolean) {
    const isSequenced = activePads.includes(padId);
    return (
      <g
        key={padId}
        className={
          (padId === cuedPad
            ? `beatpad__wedge is-cued is-cued--${cueStyle}`
            : "beatpad__wedge") +
          (padId === (externalLivePad ?? livePad) ? " is-live" : "") +
          (isSequenced ? " is-sequenced" : "") +
          (padId === hitPad ? " is-hit" : "") +
          (padId === missPad ? " is-miss" : "")
          + (padMode !== "normal" ? " is-control" : "")
          + ((padMode === "pattern" && !["1", "2", "3", "4"].includes(padId)) ? " is-inert" : "")
        }
        role="button"
        tabIndex={0}
        aria-label={`Pad ${padId}${isSequenced ? ", playing" : ""}`}
        onClick={() => {
          if (padMode === "pattern" || padMode === "delete") {
            onControlPad(padId);
          } else if (padMode === "normal" && mode === "drums") {
            onDrumPad(padId);
          }
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          if (padMode === "pattern" || padMode === "delete") {
            e.preventDefault();
            onControlPad(padId);
          } else if (padMode === "normal" && mode === "drums") {
            e.preventDefault();
            onDrumPad(padId);
          }
        }}
      >
        <path className={half ? "beatpad__slice beatpad__slice--half" : "beatpad__slice"} d={d} />
        <text
          className="beatpad__label"
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {padId}
        </text>
      </g>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={`beatpad${mode === "bass" ? " beatpad--bass" : ""}${padMode !== "normal" ? " beatpad--control" : ""}`}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="group"
      aria-label="Beat pad"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      {NATURALS.map((padId, i) =>
        key(
          padId,
          wedgePath(i * NAT_STEP, (i + 1) * NAT_STEP, R_IN, R_OUT),
          // Natural labels live in the inner-to-middle band, clear of any overlay.
          pt((R_IN + R_MID) / 2, (i + 0.5) * NAT_STEP),
          false,
        ),
      )}
      {HALVES.map(({ id, center }) =>
        key(
          id,
          wedgePath(center - HALF_WIDTH / 2, center + HALF_WIDTH / 2, R_MID, R_OUT),
          pt((R_MID + R_OUT) / 2, center),
          true,
        ),
      )}
    </svg>
  );
}
