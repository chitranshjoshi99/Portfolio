import { useCallback, useEffect, useRef } from "react";
import type { GameProps } from "../types";
import "./style.css";

const CW = 320;
const CH = 110;
const GROUND_Y = 82;
const DINO_W = 18;
const DINO_H = 22;
const DINO_X = 40;
const GRAVITY = 900; // px/s²
const JUMP_VY = -340; // px/s
const OBS_W = 12;
const OBS_MIN_H = 18;
const OBS_MAX_H = 32;
const OBS_GAP_MIN = 220;
const OBS_GAP_MAX = 480;
const BASE_SPEED = 160;

interface Obstacle {
  x: number;
  h: number;
}

interface DinoState {
  dinoY: number; // y of dino top (ground = GROUND_Y - DINO_H)
  dinoVY: number;
  onGround: boolean;
  obstacles: Obstacle[];
  nextObs: number; // x at which to spawn next obstacle
  speed: number;
  score: number;
  dead: boolean;
  waiting: boolean; // true until first keypress
  frameTime: number;
  legFrame: number;
}

function initState(): DinoState {
  return {
    dinoY: GROUND_Y - DINO_H,
    dinoVY: 0,
    onGround: true,
    obstacles: [],
    nextObs: CW + 80,
    speed: BASE_SPEED,
    score: 0,
    dead: false,
    waiting: true,
    frameTime: 0,
    legFrame: 0,
  };
}

function step(s: DinoState, dt: number) {
  if (s.dead || s.waiting) return;

  s.score += dt * 10;
  s.speed = BASE_SPEED + s.score * 0.3;
  s.frameTime += dt;
  if (s.onGround && s.frameTime > 0.15) {
    s.legFrame = (s.legFrame + 1) % 2;
    s.frameTime = 0;
  }

  // Gravity
  if (!s.onGround) {
    s.dinoVY += GRAVITY * dt;
    s.dinoY += s.dinoVY * dt;
  }
  if (s.dinoY >= GROUND_Y - DINO_H) {
    s.dinoY = GROUND_Y - DINO_H;
    s.dinoVY = 0;
    s.onGround = true;
  }

  // Obstacles
  for (const obs of s.obstacles) {
    obs.x -= s.speed * dt;
  }
  s.obstacles = s.obstacles.filter((o) => o.x > -OBS_W - 10);

  if (CW - s.nextObs < 0) {
    const h = OBS_MIN_H + Math.floor(Math.random() * (OBS_MAX_H - OBS_MIN_H));
    s.obstacles.push({ x: CW + 4, h });
    s.nextObs = OBS_GAP_MIN + Math.random() * (OBS_GAP_MAX - OBS_GAP_MIN);
  }
  s.nextObs -= s.speed * dt;

  // Collision (AABB, shrunk inset)
  const dx = DINO_X + 3;
  const dy = s.dinoY + 3;
  const dw = DINO_W - 6;
  const dh = DINO_H - 3;
  for (const obs of s.obstacles) {
    const oy = GROUND_Y - obs.h;
    if (
      dx < obs.x + OBS_W &&
      dx + dw > obs.x &&
      dy < GROUND_Y &&
      dy + dh > oy
    ) {
      s.dead = true;
      return;
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, s: DinoState) {
  ctx.fillStyle = "#0c0a0e";
  ctx.fillRect(0, 0, CW, CH);

  // Ground
  ctx.fillStyle = "#2e2b38";
  ctx.fillRect(0, GROUND_Y, CW, 2);

  // Score
  ctx.fillStyle = "#3a3545";
  ctx.font = '7px "Press Start 2P"';
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`${Math.floor(s.score).toString().padStart(5, "0")}`, CW - 8, 6);

  // Obstacles (cactus-like)
  ctx.fillStyle = "#9e8562";
  for (const obs of s.obstacles) {
    const oy = GROUND_Y - obs.h;
    ctx.fillRect(obs.x, oy, OBS_W, obs.h);
    // Side arms
    ctx.fillRect(obs.x - 5, oy + Math.floor(obs.h * 0.3), 5, 6);
    ctx.fillRect(obs.x + OBS_W, oy + Math.floor(obs.h * 0.45), 5, 6);
  }

  // Dino body
  const dx = DINO_X;
  const dy = s.dinoY;
  ctx.fillStyle = s.dead ? "#b87a72" : "#e8e4dc";

  // Body
  ctx.fillRect(dx + 2, dy, DINO_W - 4, DINO_H - 6);
  // Head
  ctx.fillRect(dx + 6, dy - 8, 12, 10);
  // Eye
  ctx.fillStyle = "#0c0a0e";
  ctx.fillRect(dx + 14, dy - 6, 2, 2);
  // Jaw
  ctx.fillStyle = s.dead ? "#b87a72" : "#e8e4dc";
  ctx.fillRect(dx + 12, dy - 2, 6, 2);

  // Legs
  if (!s.dead) {
    if (s.onGround) {
      if (s.legFrame === 0) {
        ctx.fillRect(dx + 4, dy + DINO_H - 8, 5, 8);
        ctx.fillRect(dx + 10, dy + DINO_H - 12, 5, 4);
      } else {
        ctx.fillRect(dx + 4, dy + DINO_H - 12, 5, 4);
        ctx.fillRect(dx + 10, dy + DINO_H - 8, 5, 8);
      }
    } else {
      // In air: both legs back
      ctx.fillRect(dx + 3, dy + DINO_H - 10, 5, 6);
      ctx.fillRect(dx + 10, dy + DINO_H - 8, 5, 5);
    }
  }

  // Waiting overlay
  if (s.waiting) {
    ctx.fillStyle = "#6a6570";
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPACE / TAP TO START", CW / 2, CH / 2 + 20);
    ctx.textAlign = "left";
  }

  // Death overlay
  if (s.dead) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = "#b87a72";
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GAME OVER", CW / 2, CH / 2 - 10);
    ctx.fillStyle = "#6a6570";
    ctx.font = '6px "Press Start 2P"';
    ctx.fillText(`SCORE ${Math.floor(s.score)}`, CW / 2, CH / 2 + 6);
    ctx.fillText("SPACE / TAP TO RETRY", CW / 2, CH / 2 + 20);
    ctx.textAlign = "left";
  }
}

export function DinoRun({ active, controlRef }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<DinoState>(initState());

  // Stable (refs-only) — shared by keyboard, canvas tap, and Handheld pad.
  const doJump = useCallback(() => {
    const s = stateRef.current;
    if (s.dead) {
      stateRef.current = initState();
      stateRef.current.waiting = false;
      return;
    }
    if (s.waiting) {
      s.waiting = false;
      return;
    }
    if (s.onGround) {
      s.dinoVY = JUMP_VY;
      s.onGround = false;
    }
  }, []);

  // Publish the imperative handle for the Handheld console (mobile)
  useEffect(() => {
    const ref = controlRef;
    if (!ref) return;
    ref.current = {
      input: (action, phase) => {
        if (phase === "down" && action === "action") doJump();
      },
    };
    return () => {
      ref.current = null;
    };
  }, [controlRef, doJump]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        doJump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, doJump]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let prev = performance.now();

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      step(stateRef.current, dt);
      draw(ctx!, stateRef.current);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="dino-game">
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="dino-game__canvas"
        onClick={doJump}
        role="img"
        aria-label="Dino runner game. Press Space or tap to jump."
      />
      <p className="pixel-text dino-game__hint">SPACE or TAP to jump</p>
    </div>
  );
}
