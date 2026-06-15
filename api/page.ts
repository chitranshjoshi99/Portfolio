// Rewritten from /blogs/:slug (see vercel.json). Returns the static SPA shell
// with the <!--SEO--> block swapped for blog-specific tags, so non-JS crawlers
// (LinkedIn, Slack, X) read the right preview. Humans still get the SPA.
//
// SELF-CONTAINED ON PURPOSE: Vercel's function bundler doesn't reliably compile
// a shared relative .ts import (it crashes at module load), so the per-post meta
// the crawler needs is inlined here. KEEP IN SYNC with blogs.config.ts when you
// add or edit a post.

type Meta = {
  slug: string;
  title: string;
  description: string;
  tag: string;
  accent: string;
};

const BLOGS: Meta[] = [
  {
    slug: "game-loop-without-rerender",
    title: "A game loop in React without re-rendering",
    description:
      "React re-renders on every state change, but a game loop fires 60 times a second. Keep mutable state in refs, run one requestAnimationFrame loop, and let React own only the canvas element.",
    tag: "CH01 · SNAKE",
    accent: "#8b7ba8",
  },
];

const ogImageUrl = (origin: string, b: Meta) => {
  const p = new URLSearchParams({ title: b.title, tag: b.tag, accent: b.accent });
  return `${origin}/api/og?${p.toString()}`;
};

const esc = (s = "") =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default async function handler(req: any, res: any) {
  try {
    const slug = (req.query && req.query.slug) || "";
    const blog = BLOGS.find((b) => b.slug === slug);
    const proto = req.headers["x-forwarded-proto"] || "https";
    const origin = `${proto}://${req.headers.host}`;

    // /index.html is static and not rewritten → safe to fetch (no loop).
    let html = await fetch(`${origin}/index.html`).then((r) => r.text());

    if (blog) {
      const url = `${origin}/blogs/${blog.slug}`;
      const image = ogImageUrl(origin, blog);
      const block = `
    <title>${esc(blog.title)} — Chitransh Joshi</title>
    <meta name="description" content="${esc(blog.description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(blog.title)}" />
    <meta property="og:description" content="${esc(blog.description)}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(blog.title)}" />
    <meta name="twitter:description" content="${esc(blog.description)}" />
    <meta name="twitter:image" content="${image}" />`;
      html = html.replace(
        /<!--SEO-->[\s\S]*?<!--\/SEO-->/,
        `<!--SEO-->${block}\n    <!--/SEO-->`,
      );
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    res.status(200).send(html);
  } catch (err) {
    // Surface the real reason instead of a blank FUNCTION_INVOCATION_FAILED.
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res
      .status(500)
      .send(`<!doctype html><meta charset="utf-8"><pre>page fn error: ${String(err)}</pre>`);
  }
}
