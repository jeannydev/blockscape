import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths — required for CrazyGames iframe hosting (not site root).
  base: "./",
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2022",
  },
});
