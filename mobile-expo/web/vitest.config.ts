import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const webDir = path.dirname(fileURLToPath(import.meta.url));

// Standalone Vitest config (separate from vite.config.ts so the production
// build never pulls in test-only settings). Mirrors the `@`/`@shared` aliases
// from vite.config.ts so unit tests resolve source imports identically.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(webDir, "client", "src"),
      "@shared": path.resolve(webDir, "shared"),
    },
  },
  test: {
    root: webDir,
    environment: "node",
    include: ["client/src/**/*.test.ts"],
  },
});
