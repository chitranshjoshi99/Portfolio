// Shared blog metadata, imported by the app (listing, routing, on-page meta).
// The Vercel functions can't reliably bundle a shared TS import, so api/page.ts
// keeps its own inlined copy: KEEP THE TWO IN SYNC.
// `accent` is a hex (not a CSS var) because the OG image renders outside the browser.
// Order here is the order shown on /blogs (first = top).

export interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  tag: string; // e.g. "CH01 · SNAKE"
  accent: string; // hex
  gameKey: string; // matches LabExperiment.game
}

export const BLOGS: BlogMeta[] = [
  {
    slug: "spa-seo-without-ssr",
    title: "SPAs can have great link previews without SSR",
    description:
      "Single-page apps hand crawlers an empty shell, so every shared link looks the same. Here is how to get correct, per-page social previews on Vercel with a thin meta-injection layer at the edge, no SSR required.",
    date: "2026-06-15",
    tag: "SEO · PREVIEWS",
    accent: "#b87a72",
    gameKey: "linkpreview",
  },
  {
    slug: "game-loop-without-rerender",
    title: "A game loop in React without re-rendering",
    description:
      "React re-renders on every state change, but a game loop fires 60 times a second. Keep mutable state in refs, run one requestAnimationFrame loop, and let React own only the canvas element.",
    date: "2026-06-14",
    tag: "CH01 · SNAKE",
    accent: "#8b7ba8",
    gameKey: "snake",
  },
  {
    slug: "fixed-timestep-game-loop",
    title: "Fixed timesteps: physics that ignores the frame rate",
    description:
      "Move the ball per frame and it runs at different speeds on every monitor. A fixed timestep accumulates real time and steps physics in equal slices, which also stops the ball tunnelling through paddles.",
    date: "2026-06-15",
    tag: "CH02 · PONG",
    accent: "#b87a72",
    gameKey: "pong",
  },
  {
    slug: "input-latency-debounce-throttle",
    title: "Raw, debounce, or throttle: handling event streams",
    description:
      "Raw, debounce, and throttle are three answers to a stream of events. Game input wants raw immediacy, a search box wants debounce, a scroll handler wants throttle. Pick wrong and users feel it.",
    date: "2026-06-15",
    tag: "CH03 · DINO",
    accent: "#9e8562",
    gameKey: "dino",
  },
  {
    slug: "ui-as-state-machine",
    title: "Model your UI as a state machine",
    description:
      "Most UI bugs are impossible states made possible by a pile of booleans. Model the flow as one state variable with explicit transitions and the illegal combinations stop being representable.",
    date: "2026-06-15",
    tag: "TOY · ORACLE",
    accent: "#8b7ba8",
    gameKey: "magic8ball",
  },
  {
    slug: "tiny-swr-cache",
    title: "Build a tiny stale-while-revalidate cache",
    description:
      "Stale-while-revalidate shows cached data instantly, refetches in the background, and swaps in the fresh copy. The core is about forty lines: a cache map plus an in-flight map for request dedupe.",
    date: "2026-06-15",
    tag: "TOY · GACHA",
    accent: "#9e8562",
    gameKey: "gacha",
  },
];

// Build the @vercel/og image URL for a post. Passed as query params so the
// edge function (api/og.tsx) stays self-contained, with no shared imports to bundle.
export function ogImageUrl(
  origin: string,
  blog: Pick<BlogMeta, "title" | "tag" | "accent">,
): string {
  const p = new URLSearchParams({
    title: blog.title,
    tag: blog.tag,
    accent: blog.accent,
  });
  return `${origin}/api/og?${p.toString()}`;
}
