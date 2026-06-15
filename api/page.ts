// Rewritten from the page routes (see vercel.json). Returns the static SPA
// shell with the <!--SEO--> block swapped for route-specific tags, so non-JS
// crawlers (LinkedIn, Slack, X) — and Google — get the right preview per page.
// Humans still get the SPA.
//
// SELF-CONTAINED ON PURPOSE: Vercel's function bundler doesn't reliably compile
// a shared relative .ts import (it crashes at module load), so everything the
// crawler needs is inlined here. KEEP IN SYNC with blogs.config.ts (posts) and
// the app's page copy.

type Blog = {
  slug: string;
  title: string;
  description: string;
  tag: string;
  accent: string;
};

const BLOGS: Blog[] = [
  {
    slug: "game-loop-without-rerender",
    title: "A game loop in React without re-rendering",
    description:
      "React re-renders on every state change, but a game loop fires 60 times a second. Keep mutable state in refs, run one requestAnimationFrame loop, and let React own only the canvas element.",
    tag: "CH01 · SNAKE",
    accent: "#8b7ba8",
  },
];

type Page = {
  path: string;
  title: string; // <title> + og:title
  description: string;
  imageTitle: string; // big text on the OG card
  tag: string; // small label on the OG card
  accent: string;
};

const PAGES: Record<string, Page> = {
  about: {
    path: "/about",
    title: "About — Chitransh Joshi",
    description:
      "Five years across logistics (Delhivery), B2B diamond trading (Nivoda), and edtech (Classplus) — the experience journey, skill tree, and the engineer behind the pixels.",
    imageTitle: "Experience & Skill Tree",
    tag: "ABOUT",
    accent: "#8b7ba8",
  },
  labs: {
    path: "/labs",
    title: "Labs — Chitransh Joshi",
    description:
      "An experimental playground of pixel-art mini-games and interactive toys. Each one a tiny, playable proof-of-concept.",
    imageTitle: "Interactive Experiments",
    tag: "LABS",
    accent: "#9e8562",
  },
  blogs: {
    path: "/blogs",
    title: "Blog — Chitransh Joshi",
    description:
      "Engineering notes and live proof-of-concepts — frontend deep-dives you can actually play with.",
    imageTitle: "Engineering Notes & POCs",
    tag: "BLOG",
    accent: "#b87a72",
  },
  contact: {
    path: "/contact",
    title: "Contact — Chitransh Joshi",
    description:
      "Open to senior frontend / full-stack roles. Reach out via WhatsApp or email.",
    imageTitle: "Let's build something",
    tag: "CONTACT",
    accent: "#9b8ea0",
  },
};

const ogImageUrl = (
  origin: string,
  b: { title: string; tag: string; accent: string },
) => {
  const p = new URLSearchParams({
    title: b.title,
    tag: b.tag,
    accent: b.accent,
  });
  return `${origin}/api/og?${p.toString()}`;
};

const esc = (s = "") =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Injected = {
  title: string;
  ogTitle: string;
  description: string;
  url: string;
  image: string;
  type: string;
};

const seoBlock = (m: Injected) => `
    <title>${esc(m.title)}</title>
    <meta name="description" content="${esc(m.description)}" />
    <link rel="canonical" href="${m.url}" />
    <meta property="og:type" content="${m.type}" />
    <meta property="og:url" content="${m.url}" />
    <meta property="og:title" content="${esc(m.ogTitle)}" />
    <meta property="og:description" content="${esc(m.description)}" />
    <meta property="og:image" content="${m.image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(m.ogTitle)}" />
    <meta name="twitter:description" content="${esc(m.description)}" />
    <meta name="twitter:image" content="${m.image}" />`;

export default async function handler(req: any, res: any) {
  try {
    const q = req.query || {};
    const slug: string = q.slug || "";
    const route: string = q.route || "";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const origin = `${proto}://${req.headers.host}`;

    let meta: Injected | null = null;

    if (slug) {
      const blog = BLOGS.find((b) => b.slug === slug);
      if (blog) {
        meta = {
          title: `${blog.title} — Chitransh Joshi`,
          ogTitle: blog.title,
          description: blog.description,
          url: `${origin}/blogs/${blog.slug}`,
          image: ogImageUrl(origin, blog),
          type: "article",
        };
      }
    } else if (route && PAGES[route]) {
      const p = PAGES[route];
      meta = {
        title: p.title,
        ogTitle: p.title,
        description: p.description,
        url: `${origin}${p.path}`,
        image: ogImageUrl(origin, {
          title: p.imageTitle,
          tag: p.tag,
          accent: p.accent,
        }),
        type: "website",
      };
    }

    // /index.html is static and not rewritten → safe to fetch (no loop).
    let html = await fetch(`${origin}/index.html`).then((r) => r.text());
    if (meta) {
      html = html.replace(
        /<!--SEO-->[\s\S]*?<!--\/SEO-->/,
        `<!--SEO-->${seoBlock(meta)}\n    <!--/SEO-->`,
      );
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    res.status(200).send(html);
  } catch (err) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res
      .status(500)
      .send(`<!doctype html><meta charset="utf-8"><pre>page fn error: ${String(err)}</pre>`);
  }
}
