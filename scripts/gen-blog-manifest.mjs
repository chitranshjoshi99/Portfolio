// Regenerates the inlined BLOGS array in api/page.ts from MDX frontmatter.
// The Vercel crawler function can't import shared TS, so its copy of the blog
// metadata is kept in sync here instead of by hand. Runs in `prebuild`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBlogs } from "./lib/blogs.mjs";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.resolve(__dir, "../api/page.ts");
const START = "// <blogs:start>";
const END = "// <blogs:end>";

const j = (s) => JSON.stringify(s);

function build(blogs) {
  const entries = blogs
    .map((b) =>
      [
        "  {",
        `    slug: ${j(b.slug)},`,
        `    title: ${j(b.title)},`,
        `    description: ${j(b.description)},`,
        `    tag: ${j(b.tag)},`,
        `    accent: ${j(b.accent)},`,
        "  },",
      ].join("\n"),
    )
    .join("\n");

  // Keep the marker tokens (START/END) on their own, as the FIRST thing on the
  // line, with no trailing prose — so indexOf can never collide with a mention
  // of them in a comment elsewhere in the file.
  return (
    `${START}\n` +
    `// AUTO-GENERATED from src/blogs/posts/*.mdx by \`pnpm gen:blogs\` — do not edit by hand.\n` +
    `const BLOGS: Blog[] = [\n${entries}\n];\n` +
    `${END}`
  );
}

const blogs = loadBlogs();
const src = fs.readFileSync(PAGE, "utf8");
const s = src.indexOf(START);
// Find END strictly after START so a stray mention earlier in the file (e.g. a
// header comment) can't be mistaken for the closing marker.
const e = s === -1 ? -1 : src.indexOf(END, s + START.length);
if (s === -1 || e === -1) {
  throw new Error(
    `gen:blogs — markers ${START} / ${END} not found (in order) in api/page.ts`,
  );
}

const next = src.slice(0, s) + build(blogs) + src.slice(e + END.length);

if (next !== src) {
  fs.writeFileSync(PAGE, next);
  console.log(`gen:blogs — synced ${blogs.length} posts into api/page.ts`);
} else {
  console.log(`gen:blogs — api/page.ts already up to date (${blogs.length} posts)`);
}
