import { BLOGS, ogImageUrl } from "../blogs.config";

const esc = (s = "") =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Rewritten from /blogs/:slug (see vercel.json). Returns the static SPA shell
// with the <!--SEO--> block swapped for blog-specific tags, so non-JS crawlers
// (LinkedIn, Slack, X) read the right preview. Humans still get the SPA.
export default async function handler(req, res) {
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
}
