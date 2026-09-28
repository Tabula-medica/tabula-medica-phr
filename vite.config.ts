import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const VISTA_TITLE = "Vista PD — Parkinson's tracking by Tabula Medica";
const VISTA_DESCRIPTION =
  "Vista PD helps people with Parkinson's disease and their clinicians track changes over time with short voice checks and UPDRS scoring. A tracking tool, not a diagnostic test.";

// Rewrites the Tabula Medica <head> for the Vista PD build (VITE_BRAND=vista).
// Throws when a target is missing so index.html edits can't silently leave
// Tabula branding on vista-pd.com.
function vistaBrandHtml(): Plugin {
  const replacements: [RegExp, string][] = [
    [/Tabula Medica — Your unified personal health record/g, VISTA_TITLE],
    [/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${VISTA_DESCRIPTION}$2`],
    [/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${VISTA_DESCRIPTION}$2`],
    [/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${VISTA_DESCRIPTION}$2`],
    [/(<meta\s+name="keywords"\s+content=")[^"]*(")/, "$1Parkinson's disease, UPDRS, Hoehn and Yahr, speech screening, voice tracking, hypokinetic dysarthria$2"],
    [/content="Tabula Medica"/g, 'content="Vista PD"'],
    [/https:\/\/tabulamedica\.health\//g, "https://vista-pd.com/"],
    [/\s*<!-- iOS Safari Smart App Banner[\s\S]*?-->\s*<meta\s+name="apple-itunes-app"[^>]*\/>/, ""],
  ];
  return {
    name: "vista-brand-html",
    transformIndexHtml(html) {
      let out = html;
      for (const [pattern, replacement] of replacements) {
        if (!pattern.test(out)) throw new Error(`[vista-brand-html] index.html no longer matches ${pattern}`);
        pattern.lastIndex = 0;
        out = out.replace(pattern, replacement);
      }
      return out;
    },
  };
}

export default defineConfig({
  plugins: [react(), ...(process.env.VITE_BRAND === "vista" ? [vistaBrandHtml()] : [])],
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
