export type RenderType = "tv" | "standalone";
export type GameKey =
  | "snake"
  | "pong"
  | "dino"
  | "linkpreview"
  | "magic8ball"
  | "gacha";

// Where the interactive piece renders on MOBILE (desktop is unaffected — it
// always uses `render`/the sticky CRT). See §Mobile in CLAUDE.md.
//   TV   → keep it in an inline CRT (e.g. paste-a-URL LinkPreview)
//   HH   → behind a "See in Action" button → Handheld console with touch pad
//   NONE → render the component inline, as-is (already touch-friendly toys)
export type MobileDevice = "TV" | "HH" | "NONE";

// Touch-control layout the Handheld shows for an HH game.
export type ControlScheme = "dpad" | "updown" | "single";

export interface LabExperiment {
  id: string;
  channel: number; // 1-based; CH number in rail + TV overlay
  title: string;
  teaser: string;
  status: "RUNNING" | "WRITING" | "OFFLINE";
  accent: string; // CSS custom property reference
  render: RenderType;
  game: GameKey;
  device: MobileDevice; // mobile interactive surface (TV / HH / NONE)
  controls?: ControlScheme; // required when device === 'HH'
  code: string; // core-logic snippet shown in expand panel
  postSlug?: string; // reserved for future full article route
}

export const LAB_EXPERIMENTS: LabExperiment[] = [
  // ── TV channels (contiguous) ─────────────────────────────────
  {
    id: "snake",
    channel: 1,
    title: "A game loop in React without re-rendering",
    teaser:
      "React re-renders on every state change, but game loops fire 60 times a second. Keep all mutable state in refs, run one rAF loop, and let React own only the canvas element.",
    status: "RUNNING",
    accent: "var(--classplus-purple)",
    render: "tv",
    game: "snake",
    device: "HH",
    controls: "dpad",
    code: `// All game state lives in refs, zero re-renders per frame
const stateRef = useRef({ snake: [[10,10]], dir: [1,0], food: [5,5] });

useEffect(() => {
  if (!active) return;   // pause when channel is inactive
  let last = 0;
  const TICK = 150;      // ms per step

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    if (now - last < TICK) return;
    last = now;
    step(stateRef.current);      // mutate ref in-place
    draw(ctx, stateRef.current); // write pixels to canvas
  }

  let raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}, [active]);             // restart only when active flips`,
  },
  {
    id: "pong",
    channel: 2,
    title: "Fixed-timestep loops & collision",
    teaser:
      "A fixed timestep accumulates elapsed time and steps physics in discrete chunks. This decouples rendering from physics, preventing the ball from tunnelling through a paddle at high frame rates.",
    status: "RUNNING",
    accent: "var(--delhivery-red)",
    render: "tv",
    game: "pong",
    device: "HH",
    controls: "updown",
    code: `const STEP = 1 / 60;   // 60 Hz physics tick
let acc = 0, prev = performance.now();

function loop(now: number) {
  raf = requestAnimationFrame(loop);
  acc += (now - prev) / 1000;
  prev = now;
  while (acc >= STEP) {   // consume accumulated time
    physics(state, STEP); // deterministic, fixed-size step
    acc -= STEP;
  }
  draw(ctx, state);       // render at display frame rate
}

// AABB collision, axis-aligned bounding boxes
function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x
      && a.y < b.y + b.h && a.y + a.h > b.y;
}`,
  },
  {
    id: "dino",
    channel: 3,
    title: "Input latency: debounce vs throttle vs raw",
    teaser:
      "The dino's jump feels instant because it uses raw keydown, with no delay. Debounce waits for silence; throttle limits frequency. Picking the wrong one is the difference between snappy and laggy.",
    status: "RUNNING",
    accent: "var(--nivoda-gold)",
    render: "tv",
    game: "dino",
    device: "HH",
    controls: "single",
    code: `// Raw: fires immediately on keydown (used in the game)
window.addEventListener('keydown', e => {
  if (e.code === 'Space') jump();
});

// Debounce: fires only after N ms of silence
//   Best for: search inputs, resize handlers
function debounce<T extends unknown[]>(fn: (...a: T) => void, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...a: T) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// Throttle: fires at most once per N ms
//   Best for: scroll handlers, rate-limited APIs
function throttle<T extends unknown[]>(fn: (...a: T) => void, ms: number) {
  let last = 0;
  return (...a: T) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...a); }
  };
}`,
  },
  {
    id: "linkpreview",
    channel: 4,
    title: "Live OG previews from a pasted URL",
    teaser:
      "Paste any page URL and the TV tunes into its social card. An edge function fetches the page, scrapes its og: tags, and beams back the title, image, and description that LinkedIn would show.",
    status: "RUNNING",
    accent: "var(--delhivery-red)",
    render: "tv",
    game: "linkpreview",
    device: "TV",
    code: `// Edge function: fetch the page, scrape its OG tags, return JSON
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url).searchParams.get('url');
  const html = await fetch(url, {
    headers: { 'user-agent': 'LinkedInBot/1.0 (preview)' },
  }).then(r => r.text());

  // grab <meta property="og:title" content="..."> regardless of order
  const og = (prop) => scrapeMetaContent(html, prop);

  return Response.json({
    title: og('og:title'),
    image: og('og:image'),
    description: og('og:description'),
  });
}`,
  },

  // ── Standalone toys ──────────────────────────────────────────
  {
    id: "magic8ball",
    channel: 5,
    title: "Modeling UI as a finite state machine",
    teaser:
      "Five taps, a countdown, a reveal, all driven by an explicit FSM with four states. No boolean spaghetti, no impossible UI states. The machine makes illegal states unrepresentable.",
    status: "RUNNING",
    accent: "var(--classplus-purple)",
    render: "standalone",
    game: "magic8ball",
    device: "NONE",
    code: `type Phase = 'idle' | 'tapping' | 'counting' | 'revealed';

// Transitions are pure functions: (phase, event) → next phase
function transition(phase: Phase, event: 'tap' | 'reset'): Phase {
  if (event === 'reset') return 'idle';
  switch (phase) {
    case 'idle':    return 'tapping';
    case 'tapping': return taps >= MAX_TAPS ? 'counting' : 'tapping';
    case 'counting': return countdown <= 0 ? 'revealed' : 'counting';
    default:        return phase; // 'revealed' absorbs until reset
  }
}

// Each render reads phase, so impossible states can't render:
// can't show the countdown AND the idle hint simultaneously.
// TypeScript enforces it at the type level.`,
  },
  {
    id: "gacha",
    channel: 6,
    title: "Build a tiny SWR cache",
    teaser:
      "Stale-while-revalidate: return cached data immediately, fetch fresh data in background, update when done. This ~40-line hook is the entire idea, no library needed for simple use cases.",
    status: "WRITING",
    accent: "var(--nivoda-gold)",
    render: "standalone",
    game: "gacha",
    device: "NONE",
    code: `type Entry<T> = { data: T; ts: number };
const cache = new Map<string, Entry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

function useSWR<T>(key: string, fetcher: () => Promise<T>, staleMs = 5000) {
  const [data, setData] = useState<T | null>(
    (cache.get(key)?.data as T) ?? null  // serve stale immediately
  );

  useEffect(() => {
    const entry = cache.get(key);
    const fresh = entry && Date.now() - entry.ts < staleMs;
    if (fresh) return;           // still fresh, skip fetch

    // Deduplicate: attach to in-flight request if one exists
    const inflight = pending.get(key) as Promise<T> | undefined;
    const req = inflight ?? fetcher();
    if (!inflight) pending.set(key, req);

    req.then(result => {
      cache.set(key, { data: result, ts: Date.now() });
      pending.delete(key);
      setData(result);
    });
  }, [key, staleMs]);

  return data;
}`,
  },
];

export const TV_EXPERIMENTS = LAB_EXPERIMENTS.filter((e) => e.render === "tv");
export const TOY_EXPERIMENTS = LAB_EXPERIMENTS.filter(
  (e) => e.render === "standalone",
);

// Assert TV entries are contiguous (dev-only guard)
if (import.meta.env.DEV) {
  let seenStandalone = false;
  for (const e of LAB_EXPERIMENTS) {
    if (e.render === "standalone") seenStandalone = true;
    if (e.render === "tv" && seenStandalone) {
      throw new Error(
        "labs.ts: all tv entries must appear before standalone entries",
      );
    }
  }
}
