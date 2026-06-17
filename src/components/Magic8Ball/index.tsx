import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { haptics } from "../../utils/haptics";
import "./style.css";

// ── Ball canvas: 28×28 logical, displayed at 168×168 (6× integer scale)
// Center (14,14)  ball-radius 13  white-window-radius 6
// Content (8 / countdown / answer) is an HTML overlay, NOT drawn on canvas.
const CANVAS_SIZE = 28;

function drawBallShape(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Black ball body
  ctx.fillStyle = "#080612";
  ctx.beginPath();
  ctx.arc(14, 14, 13, 0, Math.PI * 2);
  ctx.fill();

  // Gloss — subtle top-left sphere illusion
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.arc(9, 8, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // White inner window — content overlay sits on top of this via CSS
  ctx.fillStyle = "#dcd8cc";
  ctx.beginPath();
  ctx.arc(14, 14, 6, 0, Math.PI * 2);
  ctx.fill();
}

// ── Game types / constants ────────────────────────────────────
type Phase = "idle" | "tapping" | "counting" | "revealed";
const MAX_TAPS = 5;
const TAP_MSGS: Record<number, string> = {
  1: "TAP MORE",
  2: "KEEP GOING",
  3: "ALMOST THERE",
  4: "SO CLOSE...",
};

// ── Component ─────────────────────────────────────────────────
export function Magic8Ball() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [tapCount, setTapCount] = useState(0);
  const [countNum, setCountNum] = useState<3 | 2 | 1>(3);
  const [countKey, setCountKey] = useState(0);
  const [showButtons, setShowButtons] = useState(false);
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Draw static ball shape once on mount
  useEffect(() => {
    if (canvasRef.current) drawBallShape(canvasRef.current);
  }, []);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => clear(), []);

  const after = (ms: number, fn: () => void) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };

  // Re-trigger the per-tap shake CSS animation (intensity 1-5)
  const triggerShake = (intensity: number) => {
    const el = ballRef.current;
    if (!el) return;
    el.setAttribute("data-intensity", String(intensity));
    el.classList.remove("m8b__ball--shake");
    void el.offsetHeight; // reflow to restart animation
    el.classList.add("m8b__ball--shake");
  };

  const handleTap = () => {
    if (phase === "counting" || phase === "revealed") return;

    const next = tapCount + 1;
    setTapCount(next);
    haptics.tap();
    triggerShake(next);

    if (next < MAX_TAPS) {
      setPhase("tapping");
      return;
    }

    // ── 5th tap: countdown inside the window ─────────────────
    setPhase("counting");
    setCountNum(3);
    setCountKey((k) => k + 1);
    navigator.vibrate?.([160, 55, 160]);

    after(1000, () => {
      setCountNum(2);
      setCountKey((k) => k + 1);
      navigator.vibrate?.([200, 55, 200]);

      after(1000, () => {
        setCountNum(1);
        setCountKey((k) => k + 1);
        navigator.vibrate?.([250, 55, 250, 55, 300]);

        after(900, () => {
          setPhase("revealed");
          haptics.reveal();
          // Let the user read the answer in the window for 1.5 s,
          // then fade out the ball and show action buttons in its place.
          after(1500, () => setShowButtons(true));
        });
      });
    });
  };

  const handleReset = () => {
    clear();
    haptics.tap();
    // 1. Hide buttons → ball fades back in via CSS transition
    setShowButtons(false);
    // 2. Reset game state
    setPhase("idle");
    setTapCount(0);
    setCountNum(3);
    ballRef.current?.classList.remove("m8b__ball--shake");
  };

  return (
    <div className="m8b">
      {/* ── Stage: ball and button-overlay share the exact same space ── */}
      <div className="m8b__stage">
        {/* The ball — fades out when showButtons is true */}
        <button
          ref={ballRef}
          className={[
            "m8b__ball",
            phase === "counting" && "m8b__ball--counting",
            showButtons && "m8b__ball--hidden",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={handleTap}
          disabled={phase === "counting" || phase === "revealed"}
          aria-label={
            phase === "idle"
              ? "Tap the Magic 8-Ball"
              : phase === "tapping"
                ? `${MAX_TAPS - tapCount} more tap${MAX_TAPS - tapCount !== 1 ? "s" : ""}`
                : "The oracle is deciding…"
          }
        >
          {/* Canvas: ball body + white window shape (no text content) */}
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="m8b__canvas"
            aria-hidden="true"
          />

          {/* HTML overlay — sits exactly over the white window circle */}
          <div className="m8b__window" aria-hidden="true">
            {/* Idle / tapping — show "8" */}
            {(phase === "idle" || phase === "tapping") && (
              <span className="m8b__w-eight pixel-text">8</span>
            )}

            {/* Counting — 3 → 2 → 1 inside the window */}
            {phase === "counting" && (
              <span key={countKey} className="m8b__w-count vt-text">
                {countNum}
              </span>
            )}

            {/* Revealed — answer text inside the window */}
            {phase === "revealed" && (
              <div className="m8b__w-answer vt-text">
                <span>DON'T</span>
                <span>COUNT</span>
                <span>ON IT</span>
              </div>
            )}
          </div>
        </button>

        {/* Button overlay — appears in the same space as the ball after reveal */}
        {showButtons && (
          <div
            className="m8b__btns-overlay"
            role="status"
            aria-live="assertive"
          >
            <button
              className="btn btn--outline pixel-text"
              onClick={() => {
                haptics.press();
                navigate("/contact");
              }}
            >
              PROVE IT WRONG →
            </button>
            <button className="btn btn--ghost pixel-text" onClick={handleReset}>
              ↺ ASK AGAIN
            </button>
          </div>
        )}
      </div>
      {/* ── Status row — reserved height, no layout shift ── */}
      <div className="m8b__status" aria-live="polite">
        {phase === "idle" && (
          <span className="m8b__hint pixel-text">[ TAP TO SHAKE ]</span>
        )}
        {phase === "tapping" && (
          <span className="m8b__progress pixel-text">
            {TAP_MSGS[tapCount]}&nbsp;{"▼".repeat(tapCount)}
          </span>
        )}
        {phase === "counting" && (
          <span className="m8b__consulting vt-text">
            consulting the oracle…
          </span>
        )}
      </div>
    </div>
  );
}
