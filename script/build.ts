import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import { resolve } from "path";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "@google-cloud/storage",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "openid-client",
  "otplib",
  "p-limit",
  "p-retry",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "wouter",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    // PHI-AI BOUNDARY. ~280 server files do `import OpenAI from "openai"` and
    // construct a client directly. This alias redirects that bare specifier to
    // the Vertex shim, which routes PHI to Vertex AI (Google BAA) instead of
    // OpenAI (no BAA).
    //
    // The shim's docstring has claimed this alias existed since it was added in
    // #8, but it never did — `script/build.ts` had one commit and the word
    // "alias" never appeared in it. The shim was unreachable dead code, so
    // AI_PROVIDER=vertex in deploy-world.sh did nothing and every one of those
    // clients talked to api.openai.com with the live OPENAI_API_KEY secret.
    //
    // `assertPhiAiBoundary()` in server/index.ts fails startup closed if this
    // alias is ever dropped again, and tests/phi-ai-boundary.spec.ts fails CI.
    // Do not remove any of the three without removing PHI from the app.
    alias: {
      openai: resolve("server/lib/vertex-openai.ts"),
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
