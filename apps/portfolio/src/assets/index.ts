// Resolve a public asset against the Vite base URL (`/` on Vercel,
// `/Portfolio/` on the old GitHub Pages build). Driven by vite `base`.
export const asset = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
