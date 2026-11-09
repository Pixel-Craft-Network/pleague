import { defineConfig } from "vite";

const base = process.env.BASE_PATH || (process.env.GITHUB_ACTIONS === "true" ? "/polytas/" : "/");
const allowedHosts = [".e2b.app", "localhost", "127.0.0.1"];

export default defineConfig({
  base,
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts,
  },
  build: {
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 700,
  },
});
