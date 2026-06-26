import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Inject the PUBLIC GCIP/Firebase web client config at build time. These ship in
  // the browser bundle (not secrets) and are required or gcip.ts throws at load and
  // the SPA renders blank. Done via `define` (not .env) so it's deterministic and
  // doesn't depend on .gcloudignore/.dockerignore exceptions reaching the build.
  // Prefers process.env (e.g. CI) and falls back to the known public values.
  define: {
    "import.meta.env.VITE_GCIP_API_KEY": JSON.stringify(
      process.env.VITE_GCIP_API_KEY || "AIzaSyBCCtuVajEza6yHonlkz8XkVQJjIgAMS9o",
    ),
    "import.meta.env.VITE_GCIP_AUTH_DOMAIN": JSON.stringify(
      process.env.VITE_GCIP_AUTH_DOMAIN || "united-planet-485003-n7-9f345.firebaseapp.com",
    ),
    "import.meta.env.VITE_GCIP_PROJECT_ID": JSON.stringify(
      process.env.VITE_GCIP_PROJECT_ID || "united-planet-485003-n7-9f345",
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      // Native-only Capacitor plugins are dynamically imported behind isNative guards
      // in capacitor.ts and are NOT installed for the web build. Mark them external so
      // the web build doesn't fail resolving them (the dynamic imports are dead code on web).
      external: [
        "@capacitor/app",
        "@capacitor/status-bar",
        "@capacitor/splash-screen",
        "@capacitor/keyboard",
        "@capacitor/haptics",
        "@capacitor/browser",
        "@capacitor/share",
        "@capacitor/preferences",
      ],
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "wouter"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs", "@radix-ui/react-tooltip"],
          query: ["@tanstack/react-query"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
