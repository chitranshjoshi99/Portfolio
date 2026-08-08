import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  publicDir: "public",
  base: "/apps/learn-python/",
  build: {
    outDir: "../../dist/apps/learn-python",
    emptyOutDir: true,
  },
});
