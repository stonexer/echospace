/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    hmr: {
      // When accessed via the backend proxy (port 3240), HMR websocket
      // needs to connect directly to the Vite dev server.
      clientPort: 5173,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3240",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist/client",
  },
});
