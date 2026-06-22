import { useCallback, useEffect, useRef } from "react";
import type { GameAction, GameProps } from "../types";
import "./style.css";

const CW = 280;
const CH = 180;
const PAD_W = 8;
const PAD_H = 40;
const BALL = 8;
const STEP = 1 / 240;
const PAD_SPEED = 180; // px/s
const INIT_SPEED = 140;
const MAX_SPEED = 320;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PongState {
  ball: { x: number; y: number; vx: number; vy: number };
  padL: number; // y of top
  padR: number;
  scoreL: number;
  scoreR: number;
  keys: { w: boolean; s: boolean; up: boolean; down: boolean };
}

function intersects(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function initBall(): PongState["ball"] {
  const ang = ((Math.random() * 60 - 30) * Math.PI) / 180;
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    x: CW / 2 - BALL / 2,
    y: CH / 2 - BALL / 2,
    vx: dir * INIT_SPEED * Math.cos(ang),
    vy: INIT_SPEED * Math.sin(ang),
  };
}

function initState(): PongState {
  return {
    ball: initBall(),
    padL: CH / 2 - PAD_H / 2,
    padR: CH / 2 - PAD_H / 2,
    scoreL: 0,
    scoreR: 0,
    keys: { w: false, s: false, up: false, down: false },
  };
}

function clampPad(y: number) {
  return Math.max(0, Math.min(CH - PAD_H, y));
}

function physics(s: PongState, dt: number) {
  // Player paddle (W/S or ↑↓)
  if (s.keys.w || s.keys.up) s.padL = clampPad(s.padL - PAD_SPEED * dt);
  if (s.keys.s || s.keys.down) s.padL = clampPad(s.padL + PAD_SPEED * dt);

  // AI paddle — tracks ball center with lag
  const ballCenterY = s.ball.y + BALL / 2;
  const aiCenterY = s.padR + PAD_H / 2;
  const aiDelta = (ballCenterY - aiCenterY) * 3 * dt;
  s.padR = clampPad(
    s.padR + Math.min(Math.abs(aiDelta), PAD_SPEED * dt) * Math.sign(aiDelta),
  );

  // Ball movement
  s.ball.x += s.ball.vx * dt;
  s.ball.y += s.ball.vy * dt;

  // Wall bounce (top/bottom)
  if (s.ball.y < 0) {
    s.ball.y = 0;
    s.ball.vy = Math.abs(s.ball.vy);
  }
  if (s.ball.y + BALL > CH) {
    s.ball.y = CH - BALL;
    s.ball.vy = -Math.abs(s.ball.vy);
  }

  const ballRect: Rect = { x: s.ball.x, y: s.ball.y, w: BALL, h: BALL };
  const padLRect: Rect = { x: 8, y: s.padL, w: PAD_W, h: PAD_H };
  const padRRect: Rect = { x: CW - 8 - PAD_W, y: s.padR, w: PAD_W, h: PAD_H };

  // Paddle collisions
  if (s.ball.vx < 0 && intersects(ballRect, padLRect)) {
    s.ball.x = padLRect.x + PAD_W;
    const rel = (s.ball.y + BALL / 2 - (s.padL + PAD_H / 2)) / (PAD_H / 2);
    const ang = rel * (Math.PI / 3);
    const spd = Math.min(
      Math.sqrt(s.ball.vx * s.ball.vx + s.ball.vy * s.ball.vy) * 1.05,
      MAX_SPEED,
    );
    s.ball.vx = spd * Math.cos(ang);
    s.ball.vy = spd * Math.sin(ang);
  }
  if (s.ball.vx > 0 && intersects(ballRect, padRRect)) {
    s.ball.x = padRRect.x - BALL;
    const rel = (s.ball.y + BALL / 2 - (s.padR + PAD_H / 2)) / (PAD_H / 2);
    const ang = rel * (Math.PI / 3);
    const spd = Math.min(
      Math.sqrt(s.ball.vx * s.ball.vx + s.ball.vy * s.ball.vy) * 1.05,
      MAX_SPEED,
    );
    s.ball.vx = -(spd * Math.cos(ang));
    s.ball.vy = spd * Math.sin(ang);
  }

  // Score
  if (s.ball.x + BALL < 0) {
    s.scoreR++;
    s.ball = initBall();
  }
  if (s.ball.x > CW) {
    s.scoreL++;
    s.ball = initBall();
  }
}

function draw(ctx: CanvasRenderingContext2D, s: PongState) {
  ctx.fillStyle = "#0c0a0e";
  ctx.fillRect(0, 0, CW, CH);

  // Center dashed line
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "#2a2535";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CW / 2, 0);
  ctx.lineTo(CW / 2, CH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Score
  ctx.fillStyle = "#3a3545";
  ctx.font = '14px "Press Start 2P"';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(String(s.scoreL), CW / 2 - 28, 6);
  ctx.fillText(String(s.scoreR), CW / 2 + 28, 6);

  // Paddles
  ctx.fillStyle = "#e8e4dc";
  ctx.fillRect(8, s.padL, PAD_W, PAD_H);
  ctx.fillStyle = "#8b7ba8";
  ctx.fillRect(CW - 8 - PAD_W, s.padR, PAD_W, PAD_H);

  // Ball
  ctx.fillStyle = "#9b8ea0";
  ctx.fillRect(s.ball.x, s.ball.y, BALL, BALL);
}

export function Pong({ active, controlRef }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<PongState>(initState());

  // Held-input setter shared by keyboard + the Handheld touch pad.
  const setKey = useCallback((action: GameAction, down: boolean) => {
    const k = stateRef.current.keys;
    if (action === "up") k.up = down;
    if (action === "down") k.down = down;
  }, []);

  // Publish the imperative handle for the Handheld console (mobile)
  useEffect(() => {
    const ref = controlRef;
    if (!ref) return;
    ref.current = {
      input: (action, phase) => setKey(action, phase === "down"),
    };
    return () => {
      ref.current = null;
    };
  }, [controlRef, setKey]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = stateRef.current.keys;
      if (e.key === "w") k.w = down;
      if (e.key === "s") k.s = down;
      if (e.key === "ArrowUp") {
        k.up = down;
        e.preventDefault();
      }
      if (e.key === "ArrowDown") {
        k.down = down;
        e.preventDefault();
      }
    };
    const onDown = (e: KeyboardEvent) => onKey(e, true);
    const onUp = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let acc = 0;
    let prev = performance.now();

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      acc += (now - prev) / 1000;
      prev = now;
      // Cap accumulated time to prevent spiral of death
      if (acc > 0.1) acc = 0.1;
      while (acc >= STEP) {
        physics(stateRef.current, STEP);
        acc -= STEP;
      }
      draw(ctx!, stateRef.current);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="pong-game">
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="pong-game__canvas"
        role="img"
        aria-label="Pong game. Use W/S or arrow keys to move your paddle (left side)."
      />
      <p className="pixel-text pong-game__hint">W/S or ↑↓ — you are left</p>
    </div>
  );
}
