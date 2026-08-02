import { useEffect, useRef } from "react";
import "./style.css";

// Rocket is drawn nose-up (pointing north) in its own coordinate space.
// atan2(dy, dx) measures angle from the +x axis (east = 0deg), so we add
// 90deg to rotate the north-drawn nose to align with the travel direction.
const ANGLE_OFFSET = 90;
const IDLE_MS = 150; // no mousemove for this long => snap back to nose-up
const LERP_FACTOR = 0.35;
const MOVE_THRESHOLD = 1.5; // px — ignore sub-pixel jitter

function shortestAngleDelta(from: number, to: number) {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

export function CursorRocket() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: -100, y: -100 });
  const lastMove = useRef({ x: 0, y: 0, t: 0 });
  const targetAngle = useRef(0);
  const displayAngle = useRef(0);
  const idle = useRef(true);
  const reducedMotion = useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    function onMouseMove(e: MouseEvent) {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;

      const dx = e.clientX - lastMove.current.x;
      const dy = e.clientY - lastMove.current.y;
      const dist = Math.hypot(dx, dy);

      if (lastMove.current.t > 0 && dist > MOVE_THRESHOLD) {
        targetAngle.current = Math.atan2(dy, dx) * (180 / Math.PI) + ANGLE_OFFSET;
        idle.current = false;
      }

      lastMove.current = { x: e.clientX, y: e.clientY, t: performance.now() };

      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idle.current = true;
      }, IDLE_MS);
    }

    document.addEventListener("mousemove", onMouseMove, { passive: true });

    let rafId = requestAnimationFrame(function tick() {
      rafId = requestAnimationFrame(tick);
      const el = rootRef.current;
      if (!el) return;

      const angle = idle.current ? 0 : targetAngle.current;

      if (reducedMotion.current) {
        displayAngle.current = angle;
      } else {
        displayAngle.current += shortestAngleDelta(displayAngle.current, angle) * LERP_FACTOR;
      }

      el.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) rotate(${displayAngle.current}deg)`;
    });

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
      clearTimeout(idleTimer);
    };
  }, []);

  // ponytail: touch devices still mount this (harmless, no mousemove ever
  // fires so it just sits off-screen at -100,-100) — no separate touch branch.
  return (
    <div ref={rootRef} className="cursor-rocket" aria-hidden="true">
      <svg
        viewBox="0 0 20 20"
        width="24"
        height="24"
        shapeRendering="crispEdges"
        className="cursor-rocket__svg"
      >
        {/* nose */}
        <rect x="9" y="1" width="2" height="2" fill="var(--accent-primary)" />
        {/* upper body */}
        <rect x="8" y="3" width="4" height="3" fill="var(--accent-primary)" />
        {/* mid body */}
        <rect x="7" y="6" width="6" height="5" fill="var(--accent-primary)" />
        {/* fins */}
        <rect x="5" y="9" width="2" height="3" fill="var(--accent-primary)" />
        <rect x="13" y="9" width="2" height="3" fill="var(--accent-primary)" />
        {/* window */}
        <rect x="9" y="6" width="2" height="2" fill="var(--bg-primary)" />
        {/* flame */}
        <rect x="8" y="11" width="4" height="2" fill="var(--accent-secondary)" />
        <rect x="9" y="13" width="2" height="2" fill="var(--accent-secondary)" />
      </svg>
    </div>
  );
}
