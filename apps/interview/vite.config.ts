import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  root: __dirname,
  publicDir: "public",
  plugins: [react()],
  base: "/apps/interview/",
  build: {
    outDir: "../../dist/apps/interview",
    emptyOutDir: true,
  },
});
