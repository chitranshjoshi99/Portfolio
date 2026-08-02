// Single source of truth for absolute URLs (canonical, OG, sitemap, share links).
// No trailing slash. Set VITE_SITE_URL in .env and in Vercel project settings.
// Changing the domain later = update that one env var and redeploy.
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ?? "https://chitransh.dev"
).replace(/\/+$/, "");
