import type { ComponentType } from "react";

type MdxModule = { default: ComponentType };

// Lazy-loaded MDX bodies, keyed by slug → src/blogs/posts/<slug>.mdx
const modules = import.meta.glob("./posts/*.mdx");

export function loadBlogBody(slug: string): Promise<MdxModule> | undefined {
  const importer = modules[`./posts/${slug}.mdx`];
  return importer ? (importer() as Promise<MdxModule>) : undefined;
}
