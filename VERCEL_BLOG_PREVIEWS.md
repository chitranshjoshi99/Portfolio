# Vercel migration + `/blogs` + rich LinkedIn previews — Implementation Spec

> Handoff spec. Goal: move the portfolio from GitHub Pages to Vercel, add
> long-form `/blogs/:slug` articles (MDX, can embed the live mini-game), and make
> each blog URL produce a clean, blog-specific preview card when shared on
> LinkedIn / Slack / X. Doubles as the outline for the "SEO/preview engineering"
> blog + POC.
>
> Follow existing conventions in `CLAUDE.md`. Update `CLAUDE.md` in the same
> commit as `src/` changes (pre-commit hook enforces it).

---

## 0. The one idea that drives everything

**Social crawlers do not run JavaScript.** LinkedIn/Slack/X/Facebook fetch the
raw HTML and read only the `<head>` Open Graph meta. A Vite SPA serves the same
`index.html` for every route, so every URL currently shares one set of OG tags.

So we don't need full SSR — we need **per-route `<head>` meta injection** at
request time. Google _does_ run JS, so normal SEO already works; this is
specifically for the social preview cards.

GitHub Pages is static (and uses a 404.html hack for sub-routes), so it can't do
this. Vercel can, via a function + rewrite.

## 1. Locked decisions

| Decision          | Choice                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Host              | Vercel (framework preset: **Vite**)                                                           |
| Domain            | **Deferred** — centralize in `VITE_SITE_URL`; placeholder until chosen                        |
| Preview mechanism | **Serverless function** rewrites `/blogs/:slug`, injects blog-specific meta into `index.html` |
| Preview image     | **`@vercel/og`** — auto-generated 1200×630 pixel-art card per blog                            |
| Blog content      | **MDX** — markdown posts that can import & embed the live POC game                            |

## 2. Request flow (after deploy)

```
Human → /blogs/use-transition
  Vercel: no static file matches → rewrite → /api/page?slug=use-transition
  Function: fetch own /index.html, swap <head> meta for this slug, return HTML
  Browser: React Router renders the MDX article client-side. ✓

Crawler (LinkedIn) → /blogs/use-transition
  Same function runs; crawler reads injected OG tags (incl. og:image =
  /api/og?slug=use-transition) and renders the card. Never runs the SPA. ✓

Crawler → /api/og?slug=use-transition
  Edge function renders a 1200×630 pixel-art PNG for that post. ✓
```

---

## 3. Part A — Vercel migration (do first)

### A1. Base paths → root

Vercel serves at `/`, not `/Portfolio`.

- `vite.config.ts`: `base: '/Portfolio/'` → `base: '/'`
- `src/App.tsx`: `<BrowserRouter basename="/Portfolio">` → `basename="/"`
- `public/404.html`: the GH Pages SPA-redirect hack is no longer needed (Vercel
  rewrites handle SPA fallback). Leave it; it's harmless, or delete.

### A2. Centralize the site URL

Create `src/config/site.ts`:

```ts
// Single source of truth for absolute URLs (canonical, OG, sitemap).
// No trailing slash. Set VITE_SITE_URL in .env + Vercel project env.
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ?? "https://YOUR-APP.vercel.app"
).replace(/\/$/, "");
```

`.env` (and Vercel → Settings → Environment Variables):

```
VITE_SITE_URL=https://YOUR-APP.vercel.app
```

In `index.html`, replace every hard-coded `https://chitranshjoshi99.github.io/Portfolio`
with the Vite build-time token `%VITE_SITE_URL%` (Vite substitutes it). This
covers `<link rel="canonical">`, all `og:*` / `twitter:*`, and the JSON-LD
`@id`/`url`/image fields.

> When you pick a real domain later: update `VITE_SITE_URL` in Vercel + `.env`,
> redeploy. One change, everywhere.

### A3. SPA fallback + blog rewrite — `vercel.json` (project root)

```json
{
  "rewrites": [
    { "source": "/blogs/:slug", "destination": "/api/page?slug=:slug" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Vercel applies rewrites only when no static file or function matches, so
`/assets/*` and `/api/*` are untouched. `/blogs/:slug` → the meta function;
`/blogs` (index) and all other client routes → `index.html` (SPA).

---

## 4. Part B — MDX blog pipeline

### B1. Dependencies

```
npm i @mdx-js/rollup @mdx-js/react remark-gfm
npm i -D @types/mdx
```

### B2. `vite.config.ts`

```ts
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";

export default defineConfig({
  base: "/",
  plugins: [
    {
      enforce: "pre",
      ...mdx({
        remarkPlugins: [remarkGfm],
        providerImportSource: "@mdx-js/react",
      }),
    },
    react(), // existing SWC react plugin — must come AFTER mdx
  ],
});
```

Add to `src/vite-env.d.ts`:

```ts
declare module "*.mdx" {
  import type { ComponentType } from "react";
  const MDXComponent: ComponentType<Record<string, unknown>>;
  export default MDXComponent;
}
```

### B3. Shared blog metadata (one source of truth, runtime-agnostic)

The SPA _and_ the Vercel functions need blog meta, but functions can't import
`.mdx`. Keep meta in plain JSON that both sides import.

`blogs.config.json` (project root):

```json
[
  {
    "slug": "game-loop-without-rerender",
    "title": "A game loop in React without re-rendering",
    "description": "Keep mutable state in refs, run one rAF loop, and let React own only the canvas. Why useState would wreck a 60fps loop.",
    "date": "2026-06-14",
    "tag": "CH01 · SNAKE",
    "accent": "#8b7ba8",
    "gameKey": "snake"
  }
]
```

(One entry per post. `accent` is a hex, not a CSS var, because the OG function
runs outside the browser. Mirror the Labs accents.)

### B4. Content files

`src/blogs/<slug>.mdx` — body only; import the game to embed it:

```mdx
import { Snake } from "../components/games/Snake";

React re-renders on every state change. A game loop fires 60×/second. If loop
state lived in `useState`, you'd queue 60 re-renders a second...

<div className="blog-demo">
  <Snake active />
</div>

## Why refs win

...
```

### B5. Post loader — `src/blogs/index.ts`

```ts
import meta from "../../blogs.config.json";
export interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  tag: string;
  accent: string;
  gameKey?: string;
}
export const BLOGS = meta as BlogMeta[];
export const getBlog = (slug: string) => BLOGS.find((b) => b.slug === slug);

const mdx = import.meta.glob("./*.mdx"); // lazy
export const loadBlogBody = (slug: string) => mdx[`./${slug}.mdx`]?.();
```

### B6. Routes — `src/App.tsx`

```tsx
<Route path="/blogs" element={<BlogIndex />} />
<Route path="/blogs/:slug" element={<BlogPost />} />
```

Add `{ to: "/blogs", label: "> BLOGS", key: "blogs" }` to `NAV_LINKS` in
`Navbar`. Add `/blogs` + each post to `NAV_LINKS`-driven nav and the sitemap (§6).

### B7. Pages

`src/pages/BlogPost/` (`index.tsx` + `style.css`):

- Read `:slug`; `getBlog(slug)`; if missing → 404 content.
- Lazy-load the MDX body (`React.lazy(() => loadBlogBody(slug))`, `<Suspense>`).
- Set client-side `<head>` for users + Google via a small hook (below).
- Render title, date, tag chip, the MDX body, and a "← back to Labs" link.

`useDocumentMeta` hook (client-side mirror of what the function does for bots):

```ts
export function useDocumentMeta(m: {
  title: string;
  description: string;
  url: string;
  image: string;
}) {
  useEffect(() => {
    document.title = `${m.title} — Prakamya`;
    const set = (sel: string, attr: string, val: string) =>
      document.querySelector(sel)?.setAttribute(attr, val);
    set('meta[name="description"]', "content", m.description);
    set('link[rel="canonical"]', "href", m.url);
    set('meta[property="og:title"]', "content", m.title);
    set('meta[property="og:description"]', "content", m.description);
    set('meta[property="og:url"]', "content", m.url);
    set('meta[property="og:image"]', "content", m.image);
    set('meta[name="twitter:image"]', "content", m.image);
  }, [m.title, m.description, m.url, m.image]);
}
```

`src/pages/BlogIndex/` — a list of `BLOGS` (title, tag, date, teaser) linking to
each post. Pixel-art card styling consistent with Labs.

### B8. Labs → blog link

In `SceneText`, when the experiment has a matching blog (`postSlug` / shared
`slug`), render a `READ FULL POST →` button linking to `/blogs/<slug>`. (You
removed the SHOW/HIDE toggle and the code now always shows — keep the inline
code as the teaser; the full post is the deep dive, so they don't conflict.)

---

## 5. Part C — Meta injection function

`api/page.js` (Node serverless):

```js
import BLOGS from "../blogs.config.json" assert { type: "json" };

const esc = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export default async function handler(req, res) {
  const slug = req.query.slug;
  const blog = BLOGS.find((b) => b.slug === slug);
  const origin = `https://${req.headers.host}`;

  // Fetch our own static shell (not rewritten → no loop) and swap the meta block.
  let html = await fetch(`${origin}/index.html`).then((r) => r.text());

  if (blog) {
    const url = `${origin}/blogs/${slug}`;
    const image = `${origin}/api/og?slug=${encodeURIComponent(slug)}`;
    const block = `
      <title>${esc(blog.title)} — Prakamya</title>
      <meta name="description" content="${esc(blog.description)}" />
      <link rel="canonical" href="${url}" />
      <meta property="og:type" content="article" />
      <meta property="og:title" content="${esc(blog.title)}" />
      <meta property="og:description" content="${esc(blog.description)}" />
      <meta property="og:url" content="${url}" />
      <meta property="og:image" content="${image}" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${esc(blog.title)}" />
      <meta name="twitter:description" content="${esc(blog.description)}" />
      <meta name="twitter:image" content="${image}" />`;
    html = html.replace(
      /<!--SEO-->[\s\S]*?<!--\/SEO-->/,
      `<!--SEO-->${block}<!--/SEO-->`,
    );
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(html);
}
```

In `index.html`, wrap the _replaceable_ default meta in markers so the swap is
surgical:

```html
<!--SEO-->
<title>Prakamya — UI Developer</title>
<meta name="description" content="..." />
<link rel="canonical" href="%VITE_SITE_URL%/" />
<meta property="og:title" content="..." />
... (existing default og/twitter tags) ...
<!--/SEO-->
```

Everything outside the markers (fonts, JSON-LD, favicon, viewport) is untouched.

---

## 6. Part D — Dynamic OG image (`@vercel/og`)

```
npm i @vercel/og
```

`api/og.tsx` (Edge runtime):

```tsx
import { ImageResponse } from "@vercel/og";
import BLOGS from "../blogs.config.json";

export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const blog = BLOGS.find((b) => b.slug === slug) ?? {
    title: "Prakamya — Labs",
    tag: "LABS",
    accent: "#8b7ba8",
  };

  // Pixel font for the card (host the .ttf at /fonts/, fetch as ArrayBuffer)
  const font = await fetch(new URL("/fonts/PressStart2P.ttf", req.url)).then(
    (r) => r.arrayBuffer(),
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#16141a",
        color: "#e8e4dc",
        fontFamily: "PressStart2P",
        backgroundImage: "radial-gradient(#26222e 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div style={{ display: "flex", fontSize: 22, color: blog.accent }}>
        {blog.tag}
      </div>
      <div style={{ display: "flex", fontSize: 52, lineHeight: 1.4 }}>
        {blog.title}
      </div>
      <div style={{ display: "flex", fontSize: 20, color: "#9b8ea0" }}>
        prakamya · labs
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "PressStart2P", data: font, style: "normal" }],
    },
  );
}
```

Put `PressStart2P.ttf` in `public/fonts/`. (Press Start 2P at 52px wraps; keep
titles ≤ ~60 chars or drop to 44px.)

Verify locally by opening `/api/og?slug=<slug>` — it returns a PNG.

---

## 7. Part E — Sitemap, robots, canonical

- Add `/blogs` and every `/blogs/<slug>` to `public/sitemap.xml`. Best:
  `scripts/gen-sitemap.mjs` reads `blogs.config.json` + the static routes and
  writes `public/sitemap.xml`; wire it to a `prebuild` npm script so it can't go
  stale.
- `public/robots.txt`: keep `Sitemap: %SITE%/sitemap.xml` (now at the real
  domain root — on Vercel, root-level robots.txt **is** honored, unlike the GH
  Pages project path).
- Set canonical on every page to the Vercel domain. If you keep the GH Pages
  site live, point its canonical at Vercel to avoid duplicate content.

---

## 8. Deploy + verify

1. Push to GitHub → Vercel → New Project → import repo. Framework preset: Vite.
2. Set `VITE_SITE_URL` env (placeholder ok). Deploy.
3. Smoke test:
   - `/blogs/<slug>` renders the article (human).
   - `curl -A "LinkedInBot" https://<app>/blogs/<slug>` → HTML shows the
     blog-specific `<title>` + `og:*`.
   - Open `/api/og?slug=<slug>` → pixel-art PNG.
4. Paste the blog URL into **LinkedIn Post Inspector**
   (`linkedin.com/post-inspector`) to confirm the card and bust LinkedIn's cache.
   (Slack/X cache too — re-share after deploys.)
5. Pick a domain → update `VITE_SITE_URL` → redeploy → re-inspect.

## 9. Acceptance checklist

- [ ] `base` and `basename` are `/`; no `/Portfolio` paths remain.
- [ ] All absolute URLs derive from `VITE_SITE_URL` / `%VITE_SITE_URL%` — no hard-coded host.
- [ ] `/blogs/:slug` returns blog-specific OG tags to a bot UA.
- [ ] `/api/og?slug=` returns a unique 1200×630 PNG per post.
- [ ] MDX article renders and the embedded live game works.
- [ ] Labs scene links to its full post; SPA nav has `> BLOGS`.
- [ ] sitemap + robots updated; canonical = Vercel domain.
- [ ] `tsc -b` and `vite build` pass; `CLAUDE.md` updated (new routes, MDX, api/, vercel.json).

## 10. The blog you get for free

Topic: **"Rich link previews for a client-rendered SPA on Vercel."** Beats:
crawlers don't run JS → only `<head>` matters → meta-injection function (not
SSR) → on-the-fly OG images with `@vercel/og`. The POC is literally `api/page.js`

- `api/og.tsx` in this repo, and you can embed the live OG-card preview in the
  MDX post.

## 11. Alternative considered (and why not)

Build-time prerender (`vite-react-ssg` / a prerender script) bakes static HTML
per blog with correct meta — no functions, no cold starts, dead simple. It's a
great fit for a small fixed set of posts. We chose the function path because it's
dynamic (no rebuild per post), it's needed for `@vercel/og` anyway, and it's the
better story to write about. If posts stay few and rarely change, prerender is
the lower-maintenance option — easy to switch.

```

## Out of scope (v1)

RSS feed, comments, reading-time/analytics, MDX syntax-highlight theme,
multi-author. Add later.
```
