import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm } from "fs/promises";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server (fully bundled for production)...");
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: [],
    logLevel: "info",
    banner: {
      js: `
// Stub missing optional native modules
const origRequire = require;
const Module = origRequire('module');
const origResolve = Module._resolveFilename;
const optionalNative = new Set(['pg-native','better-sqlite3','canvas','sharp','@swc/core','lightningcss','fsevents','bufferutil','utf-8-validate','cpu-features','ssh2']);
Module._resolveFilename = function(request, parent, isMain, options) {
  if (optionalNative.has(request)) { throw new Error('Optional module ' + request + ' not available'); }
  return origResolve.call(this, request, parent, isMain, options);
};
`,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
