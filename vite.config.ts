import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tauri expects a fixed dev port (configured in tauri.conf.json devUrl).
const devHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Keep the terminal clean when Rust prints to stdout in dev mode.
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: devHost || false,
    hmr: devHost
      ? { protocol: "ws", host: devHost, port: 1421 }
      : undefined,
    watch: {
      // Rust sources are rebuilt by cargo, not the Vite watcher.
      ignored: ["**/src-tauri/**"],
    },
  },

  // Expose TAURI_ENV_* variables to the frontend build.
  envPrefix: ["VITE_", "TAURI_ENV_"],
});
