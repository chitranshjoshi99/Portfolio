// Types for the `virtual:blogs` module produced by vite-plugin-blogs.
// The array is derived from src/blogs/posts/*.mdx frontmatter at build time and
// is the single source of truth for blog metadata across the app.
declare module "virtual:blogs" {
  export interface BlogMeta {
    slug: string;
    title: string;
    description: string;
    /** ISO yyyy-mm-dd */
    date: string;
    /** e.g. "CH01 · SNAKE" */
    tag: string;
    /** hex colour (not a CSS var — also used by the OG image renderer) */
    accent: string;
    /** matches a LabExperiment.game key */
    gameKey: string;
  }

  export const BLOGS: BlogMeta[];
  const _default: BlogMeta[];
  export default _default;
}
