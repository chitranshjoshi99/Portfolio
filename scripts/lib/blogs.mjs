// Single source of truth for reading blog metadata from MDX frontmatter.
// Shared by the Vite plugin (virtual:blogs), the api/page.ts codegen, and the
// new:blog generator. Plain JS (.mjs) on purpose so gray-matter never enters the
// app's TypeScript graph — the app only ever sees the typed `virtual:blogs`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dir = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to src/blogs/posts (repo-root/scripts/lib → repo-root). */
export const POSTS_DIR = path.resolve(__dir, "../../src/blogs/posts");

// Frontmatter fields every post must declare. `order` is optional (sort hint),
// and so is `gameKey` — posts not tied to a Lab game simply omit it (it then
// defaults to "", so getBlogByGame just never matches them).
export const REQUIRED_FIELDS = [
  "title",
  "description",
  "date",
  "tag",
  "accent",
];

/** Next `order` value for a brand-new post (max existing order + 1). */
export function nextOrder(dir = POSTS_DIR) {
  const orders = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => Number(matter(fs.readFileSync(path.join(dir, f), "utf8")).data.order) || 0);
  return (orders.length ? Math.max(...orders) : 0) + 1;
}

/** Turn a human title into a url/file slug. */
export function slugify(title) {
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Read every *.mdx in `dir`, validate frontmatter, and return BlogMeta objects
 * sorted by `order` (then newest date, then slug). Throws on missing fields so a
 * malformed post fails the build loudly instead of silently vanishing.
 */
export function loadBlogs(dir = POSTS_DIR) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .sort();

  const blogs = files.map((file) => {
    const slug = file.replace(/\.mdx$/, "");
    const { data } = matter(fs.readFileSync(path.join(dir, file), "utf8"));

    const missing = REQUIRED_FIELDS.filter(
      (k) => data[k] == null || String(data[k]).trim() === "",
    );
    if (missing.length) {
      throw new Error(
        `Blog "${slug}.mdx" is missing required frontmatter: ${missing.join(", ")}`,
      );
    }

    return {
      slug,
      title: String(data.title),
      description: String(data.description),
      date: String(data.date),
      tag: String(data.tag),
      accent: String(data.accent),
      gameKey: data.gameKey != null ? String(data.gameKey) : "",
      _order: data.order != null ? Number(data.order) : Number.MAX_SAFE_INTEGER,
    };
  });

  blogs.sort(
    (a, b) =>
      a._order - b._order ||
      b.date.localeCompare(a.date) ||
      a.slug.localeCompare(b.slug),
  );

  // `_order` is an internal sort hint only — strip it from the public shape so
  // it matches the BlogMeta type exactly.
  return blogs.map(({ _order, ...meta }) => meta);
}
