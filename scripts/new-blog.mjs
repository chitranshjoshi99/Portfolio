// Scaffolds a new blog post: writes src/blogs/posts/<slug>.mdx with frontmatter
// boilerplate so the listing/routing/edge-sync all pick it up automatically.
//
//   pnpm new:blog --title "My code gen blog"
//   pnpm new:blog --title "Build a thing" --tag "CH04 · THING" --accent "#9e8562" --gameKey thing
import fs from "node:fs";
import path from "node:path";
import { POSTS_DIR, slugify, nextOrder } from "./lib/blogs.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) {
      args[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const USAGE =
  'Usage: pnpm new:blog --title "My Post Title" ' +
  '[--description "..."] [--tag "CH0X · NAME"] [--accent "#rrggbb"] [--gameKey key] [--date YYYY-MM-DD]';

const args = parseArgs(process.argv.slice(2));
const title = typeof args.title === "string" ? args.title.trim() : "";
if (!title) {
  console.error(USAGE);
  process.exit(1);
}

const slug = slugify(title);
if (!slug) {
  console.error(`Could not derive a slug from title: "${title}"`);
  process.exit(1);
}

const file = path.join(POSTS_DIR, `${slug}.mdx`);
if (fs.existsSync(file)) {
  console.error(
    `Refusing to overwrite existing post: src/blogs/posts/${slug}.mdx`,
  );
  process.exit(1);
}

const q = (s) => JSON.stringify(s);
const fm = {
  title,
  description:
    typeof args.description === "string"
      ? args.description
      : "TODO: one or two sentence summary — shown on the listing card and the social preview.",
  date: typeof args.date === "string" ? args.date : new Date().toISOString().slice(0, 10),
  tag: typeof args.tag === "string" ? args.tag : "TODO · TAG",
  accent: typeof args.accent === "string" ? args.accent : "#8b7ba8",
  gameKey: typeof args.gameKey === "string" ? args.gameKey : "TODO",
  order: nextOrder(),
};

const content =
  `---\n` +
  `title: ${q(fm.title)}\n` +
  `description: ${q(fm.description)}\n` +
  `date: ${q(fm.date)}\n` +
  `tag: ${q(fm.tag)}\n` +
  `accent: ${q(fm.accent)}\n` +
  `gameKey: ${q(fm.gameKey)}\n` +
  `order: ${fm.order}\n` +
  `---\n\n` +
  `{/* To embed a live Lab game, import it right here, e.g.:\n` +
  `   import { Snake } from "../../components/games/Snake"; */}\n\n` +
  `Opening paragraph — set up the problem this post solves.\n\n` +
  `## A section\n\n` +
  `Body copy. Use fenced code blocks for the core logic snippet.\n`;

fs.writeFileSync(file, content);
console.log(
  `Created src/blogs/posts/${slug}.mdx (order ${fm.order}).\n` +
    `Next: fill in the frontmatter + body. The listing picks it up automatically; ` +
    `run \`pnpm gen:blogs\` (or any build) to sync the edge crawler.`,
);
