import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // `.tsx` specs cover the client's accessibility behaviour; they opt into
    // jsdom per file with a `@vitest-environment jsdom` docblock.
    include: ["tests/**/*.spec.ts", "tests/**/*.test.ts", "tests/**/*.spec.tsx"],
    environment: "node",
    globals: false,
    setupFiles: ["tests/setup/jsdom.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
});
