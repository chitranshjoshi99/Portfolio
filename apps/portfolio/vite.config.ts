import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import blogsPlugin from "./vite-plugin-blogs.mjs";
import path from "path";

const siteUrl = (process.env.VITE_SITE_URL ?? "https://chitransh.dev").replace(
  /\/+$/,
  "",
);

export default defineConfig({
  root: __dirname,
  publicDir: "public",
  plugins: [
    {
      name: "site-url-fallback",
      transformIndexHtml(html) {
        return html.replaceAll("%VITE_SITE_URL%", siteUrl);
      },
    },
    // MDX must run before the React (SWC) plugin
    {
      enforce: "pre",
      ...mdx({
        // remark-frontmatter strips the YAML `---` block out of the rendered
        // post body; remark-mdx-frontmatter additionally exposes it as a
        // `frontmatter` named export (the eager-glob fallback to virtual:blogs).
        remarkPlugins: [
          remarkGfm,
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: "frontmatter" }],
        ],
        providerImportSource: "@mdx-js/react",
      }),
    },
    blogsPlugin(),
    react(),
  ],
  base: "/",
  build: {
    outDir: "../../dist/apps/portfolio",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
