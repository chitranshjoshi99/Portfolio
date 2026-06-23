// Vite plugin exposing `virtual:blogs` — a typed BlogMeta[] derived at build/dev
// time from the frontmatter of src/blogs/posts/*.mdx. Ships ONLY metadata to the
// client (no post bodies / game-component imports), and hot-reloads when a post
// is added, edited, or removed.
import { loadBlogs, POSTS_DIR } from "./scripts/lib/blogs.mjs";

const VIRTUAL_ID = "virtual:blogs";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

export default function blogsPlugin() {
  return {
    name: "virtual-blogs",
    enforce: "pre",

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },

    load(id) {
      if (id !== RESOLVED_ID) return null;
      const blogs = loadBlogs();
      return (
        `// AUTO-GENERATED from src/blogs/posts/*.mdx frontmatter.\n` +
        `export const BLOGS = ${JSON.stringify(blogs, null, 2)};\n` +
        `export default BLOGS;\n`
      );
    },

    configureServer(server) {
      server.watcher.add(POSTS_DIR);
      const onChange = (file) => {
        if (!file.endsWith(".mdx")) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", onChange);
      server.watcher.on("unlink", onChange);
      server.watcher.on("change", onChange);
    },
  };
}
