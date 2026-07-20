/**
 * Build a port-binding-free bundle of this Express app for the combined Cloud
 * Run entrypoint (repo-root deploy/server.mjs).
 *
 * The stock build.mjs bundles src/index.ts, whose top-level code calls
 * app.listen(). For the single-container Cloud Run layout we need the app
 * WITHOUT the listen side-effect, so this bundles src/app.ts (which only
 * `export default app`). It reuses the exact esbuild options (externals, pino
 * plugin, ESM banner) as build.mjs so behaviour is identical.
 *
 * Output: dist/app.mjs (sibling to the stock dist/index.mjs).
 *
 * Lives INSIDE the api-server package (not repo-root deploy/) so its bare
 * `esbuild` / `esbuild-plugin-pino` imports resolve from this package's
 * node_modules under pnpm's isolated (non-hoisted) layout. Invoke with:
 *   pnpm --filter @workspace/api-server exec node build-app.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies.
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");

// Same external list as build.mjs — keep in sync if that file changes.
const external = [
  "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt", "argon2",
  "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil", "utf-8-validate",
  "ssh2", "cpu-features", "dtrace-provider", "isolated-vm", "lightningcss",
  "pg-native", "oracledb", "mongodb-client-encryption", "nodemailer",
  "handlebars", "knex", "typeorm", "protobufjs", "onnxruntime-node",
  "@tensorflow/*", "@prisma/client", "@mikro-orm/*", "@grpc/*", "@swc/*",
  "@aws-sdk/*", "@azure/*", "@opentelemetry/*", "@google-cloud/*", "@google/*",
  "googleapis", "firebase-admin", "@parcel/watcher", "@sentry/profiling-node",
  "@tree-sitter/*", "aws-sdk", "classic-level", "dd-trace", "ffi-napi", "grpc",
  "hiredis", "kerberos", "leveldown", "miniflare", "mysql2", "newrelic", "odbc",
  "piscina", "realm", "ref-napi", "rocksdb", "sass-embedded", "sequelize",
  "serialport", "snappy", "tinypool", "usb", "workerd", "wrangler", "zeromq",
  "zeromq-prebuilt", "playwright", "puppeteer", "puppeteer-core", "electron",
];

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/app.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: distDir,
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external,
  sourcemap: "linked",
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
});

// eslint-disable-next-line no-console
console.log("Built artifacts/api-server/dist/app.mjs (no port-binding side-effect).");

// ---------------------------------------------------------------------------
// Also bundle the repo-root combined Cloud Run entrypoint (deploy/server.mjs)
// so its only static import — `express` — is inlined. Under pnpm's isolated
// (non-hoisted) layout, express is NOT symlinked into the repo-root node_modules,
// so a bare `import express` from /app/deploy would fail at runtime. express is a
// dependency of THIS package, so bundling from here resolves it. The two runtime
// dynamic imports (api app + Astro handler) use computed specifiers, so esbuild
// leaves them external — they resolve at runtime from their own dirs.
//
// Output stays in repo-root deploy/ so the wrapper's import.meta.url-relative
// paths to ../artifacts/** still resolve.
const repoRoot = path.resolve(artifactDir, "../..");
await esbuild({
  entryPoints: [path.resolve(repoRoot, "deploy/server.mjs")],
  outfile: path.resolve(repoRoot, "deploy/server.prod.mjs"),
  platform: "node",
  bundle: true,
  format: "esm",
  logLevel: "info",
  sourcemap: "linked",
  // The entry lives at repo-root deploy/, so esbuild would resolve bare imports
  // from /app/node_modules — where pnpm's isolated layout does NOT hoist express.
  // Point node resolution at THIS package's node_modules (express is a dep here).
  nodePaths: [path.resolve(artifactDir, "node_modules")],
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
globalThis.require = __bannerCrReq(import.meta.url);
`,
  },
});

// eslint-disable-next-line no-console
console.log("Built deploy/server.prod.mjs (express inlined; dynamic imports external).");
