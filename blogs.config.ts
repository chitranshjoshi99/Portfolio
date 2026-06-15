// Shared blog metadata — imported by the app (listing, routing, on-page meta)
// AND by the Vercel functions (api/page.js meta injection, api/og.tsx image).
// Kept as a plain .ts so both runtimes can import it without JSON assertions.
// `accent` is a hex (not a CSS var) because the OG image renders outside the browser.

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
    slug: "game-loop-without-rerender",
    title: "A game loop in React without re-rendering",
    description:
      "React re-renders on every state change, but a game loop fires 60 times a second. Keep mutable state in refs, run one requestAnimationFrame loop, and let React own only the canvas element.",
    date: "2026-06-14",
    tag: "CH01 · SNAKE",
    accent: "#8b7ba8",
    gameKey: "snake",
  },
];

// Build the @vercel/og image URL for a post. Passed as query params so the
// edge function (api/og.tsx) stays self-contained — no shared imports to bundle.
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
