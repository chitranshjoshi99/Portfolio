import { BLOGS, ogImageUrl, type BlogMeta } from "../../blogs.config";

export { BLOGS, ogImageUrl };
export type { BlogMeta };

export const getBlog = (slug: string): BlogMeta | undefined =>
  BLOGS.find((b) => b.slug === slug);

export const getBlogByGame = (gameKey: string): BlogMeta | undefined =>
  BLOGS.find((b) => b.gameKey === gameKey);
