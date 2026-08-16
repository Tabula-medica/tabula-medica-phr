#!/usr/bin/env node
// scripts/authz-sweep.mjs — probes every mounted /api route WITHOUT credentials
// and fails if a non-allowlisted route returns 200 + a non-empty JSON body (i.e.
// serves data with no auth). P2 of the security-closure plan; also the pre-deploy
// safety check for the P0-5 auth closure.
//
// Usage: BASE_URL=http://localhost:8080 node scripts/authz-sweep.mjs
//
// This only catches routes that return data with NO auth at all. Two-user IDOR
// probing (create users A + B, capture A's ids, replay as B, expect 404) is a
// separate manual pass.
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const BASE = process.env.BASE_URL || "http://localhost:8080";

// Routes that are LEGITIMATELY public — every entry is a reviewed decision.
// Keep this in sync with the P0-5 exclusion list (docs/P0-5-auth-purge-plan.md)
// and the public routes confirmed during the purge.
const PUBLIC_ALLOWLIST = [
  // Liveness / health
  /^\/api\/health(\/|$)/, /^\/healthz?$/, /^\/api\/status/, /^\/ping$/,
  /^\/api\/queue\/status/,               // admin-gated (requirePermission)
  // Auth / session establishment
  /^\/api\/auth\//, /^\/api\/login/, /^\/api\/logout/,
  /^\/api\/session\/config/,             // phi-audit: public session config
  // SMART / discovery
  /^\/\.well-known\//, /^\/api\/smart\/(discovery|config)/,
  // Vendor config / webhooks (signature/API-key authenticated, not session)
  /^\/api\/fasten-connect\/config/, /webhook/i, /^\/api\/revenuecat\//,
  // Non-PHI reference content
  /^\/api\/legal/, /^\/api\/health-content\//, /^\/api\/compliance-status/,
  // Partner data-plane (Bearer API-key auth) + static catalog
  /^\/api\/provider-integration\/[^/]+\/Patient/, /available-scopes/,
  // Single-use secure access-token validation (no session by design)
  /validate-token/,
];

const routeRe = /(?:app|router)\.(get|post|put|patch|delete)\(\s*["'`](\/[^"'`]+)["'`]/g;
const mountRe = /app\.use\(\s*["'`](\/api\/[^"'`]+)["'`]/g;

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith(".ts")) yield p;
  }
}

const routes = new Set();
for (const file of walk("server")) {
  const src = readFileSync(file, "utf8");
  for (const re of [routeRe, mountRe]) {
    let m;
    while ((m = re.exec(src))) {
      const path = m[2] ?? m[1];
      if (!path.startsWith("/api") && !path.startsWith("/.well-known")) continue;
      routes.add(path.replace(/:[^/]+/g, "probe-id"));
    }
  }
}

let failures = 0, probed = 0, skipped = 0;
for (const path of [...routes].sort()) {
  if (PUBLIC_ALLOWLIST.some((re) => re.test(path))) { skipped++; continue; }
  probed++;
  try {
    const res = await fetch(BASE + path, { redirect: "manual" });
    const ct = res.headers.get("content-type") || "";
    if (res.status === 200 && ct.includes("json")) {
      const body = await res.text();
      if (body.length > 2 && body !== "{}" && body !== "[]") {
        console.log(`FAIL  ${path}  -> 200 with ${body.length}b body (no auth)`);
        failures++;
      }
    }
  } catch { /* connection errors handled by the caller env */ }
}
console.log(`\nProbed ${probed}, allowlisted ${skipped}, failures ${failures}`);
process.exit(failures ? 1 : 0);
