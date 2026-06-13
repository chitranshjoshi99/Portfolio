import { useEffect, useRef } from 'react';
import type { GameProps } from '../types';
import './style.css';

const GRID = 20;
const CELL = 10;
const W = GRID * CELL;
const H = GRID * CELL;
const TICK = 150;

type Dir = [number, number];
interface SnakeState {
  snake: [number, number][];
  dir: Dir;
  nextDir: Dir;
  food: [number, number];
  score: number;
  dead: boolean;
}

function rnd() {
  return Math.floor(Math.random() * GRID);
}
function randomFood(snake: [number, number][]): [number, number] {
  let f: [number, number];
  do {
    f = [rnd(), rnd()];
  } while (snake.some(([x, y]) => x === f[0] && y === f[1]));
  return f;
}
function init(): SnakeState {
  const snake: [number, number][] = [
    [10, 10],
    [9, 10],
    [8, 10],
  ];
  return {
    snake,
    dir: [1, 0],
    nextDir: [1, 0],
    food: randomFood(snake),
    score: 0,
    dead: false,
  };
}

function step(s: SnakeState) {
  if (s.dead) return;
  const [nx, ny] = s.nextDir;
  // Reject 180° reversal
  if (nx !== -s.dir[0] || ny !== -s.dir[1]) s.dir = s.nextDir;
  const [hx, hy] = s.snake[0];
  const next: [number, number] = [
    (hx + s.dir[0] + GRID) % GRID,
    (hy + s.dir[1] + GRID) % GRID,
  ];
  if (s.snake.some(([x, y]) => x === next[0] && y === next[1])) {
    s.dead = true;
    return;
  }
  s.snake.unshift(next);
  if (next[0] === s.food[0] && next[1] === s.food[1]) {
    s.score++;
    s.food = randomFood(s.snake);
  } else {
    s.snake.pop();
  }
}

function draw(ctx: CanvasRenderingContext2D, s: SnakeState) {
  ctx.fillStyle = '#0c0a0e';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid dots
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      ctx.fillRect(gx * CELL + CELL / 2 - 1, gy * CELL + CELL / 2 - 1, 2, 2);
    }
  }

  // Food
  ctx.fillStyle = '#9b8ea0';
  ctx.fillRect(s.food[0] * CELL + 1, s.food[1] * CELL + 1, CELL - 2, CELL - 2);

  // Snake
  s.snake.forEach(([x, y], i) => {
    ctx.fillStyle = i === 0 ? '#e8e4dc' : i % 2 === 0 ? '#4a4555' : '#3a3545';
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  });

  // Score strip
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = '#9b8ea0';
  ctx.font = '8px "Press Start 2P"';
  ctx.textBaseline = 'top';
  ctx.fillText(`${s.score}`, 4, 3);

  if (s.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#b87a72';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 8);
    ctx.fillStyle = '#6a6570';
    ctx.font = '6px "Press Start 2P"';
    ctx.fillText('CLICK TO RETRY', W / 2, H / 2 + 10);
    ctx.textAlign = 'left';
  }
}

export function Snake({ active }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SnakeState>(init());

  // Keyboard input — only when active
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.dead) {
        stateRef.current = init();
        return;
      }
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          s.nextDir = [0, -1];
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
          s.nextDir = [0, 1];
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
          s.nextDir = [-1, 0];
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
          s.nextDir = [1, 0];
          e.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // rAF game loop — pauses when inactive
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let last = 0;

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      if (now - last >= TICK) {
        step(stateRef.current);
        last = now;
      }
      draw(ctx!, stateRef.current);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const handleClick = () => {
    if (stateRef.current.dead) stateRef.current = init();
  };

  return (
    <div className="snake-game">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="snake-game__canvas"
        onClick={handleClick}
        role="img"
        aria-label="Snake game. Use arrow keys or WASD to move."
      />
      <p className="pixel-text snake-game__hint">↑↓←→ / WASD to move</p>
    </div>
  );
}
