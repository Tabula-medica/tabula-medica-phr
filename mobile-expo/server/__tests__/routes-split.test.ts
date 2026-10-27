/**
 * Route-split drift guardrail.
 *
 * The 1374-endpoint Express surface lives across 12 domain routers under
 * `server/routes/*.ts`, wired up by `registerRoutes()` in `server/routes.ts`.
 * The split is a one-time codegen result (see `scripts/split-routes.mjs`),
 * so a hand-edit that drops an `app.use` mount or breaks a router export
 * would silently lose dozens of endpoints with no test failure.
 *
 * This test boots the Express app in-process and asserts:
 *
 *   1. The total number of registered routes (walked off the router
 *      stack) is at or above the captured baseline. If a domain router
 *      silently drops out, the count falls sharply and the test fails
 *      loudly.
 *
 *   2. One representative endpoint from each of the 12 domain routers
 *      returns a status consistent with its handler being registered
 *      (200 for public, 401 for `requireAuth`-protected, etc.). A 404
 *      coming from the post-`registerRoutes()` sentinel below means
 *      Express never found a matching route — i.e. the router's
 *      registrations are missing.
 *
 * Wire-up: framework-agnostic, mirroring `ai-policy.test.ts`. Exposed as
 * `npm run test:server` and invoked by the `test` job in
 * `.github/workflows/ci-cd.yml` (gates every push to main; runs before
 * `deploy-backend`). Can also be run directly via
 * `node --import tsx server/__tests__/routes-split.test.ts`.
 */
import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { registerRoutes } from "../routes";

// Baseline route count captured against the current split (actual count
// at task time was ~1525 across 12 routers + mounted sub-routers). Set
// at 1500 as a floor — bump upward when intentionally adding endpoints.
// If this number ever needs to be LOWERED, that almost certainly means
// a router was dropped; investigate before "fixing" the test.
//
// How to recalibrate: run this file, read the printed "X routes
// registered" number, and set baseline to ~X minus a small slack
// (e.g. 20) so transient internal refactors don't false-fail.
const ROUTE_COUNT_BASELINE = 1500;

// Magic body the post-registerRoutes() sentinel returns. Any HTTP probe
// that receives this body knows Express fell through to the sentinel —
// i.e. no route handler matched — and the corresponding router is
// considered missing.
const UNMOUNTED_SENTINEL = "__route_split_test_unmounted__";

// One representative HTTP probe per domain router. Picks one of the
// router's first concrete `app.<method>(...)` registrations. Acceptable
// statuses are the set of responses that prove the handler ran:
//   - 401 for `requireAuth`-protected routes (auth middleware rejected
//     our unauthenticated probe — handler stack IS wired up)
//   - 200/400/404/500 for public routes (handler ran and returned its
//     own status — anything but the sentinel proves registration)
//
// We deliberately stay conservative on the accepted set per probe so a
// behavior regression (e.g. a route silently dropping its auth
// middleware and now returning 200 instead of 401) is still surfaced.
type DomainProbe = {
  router: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  acceptableStatuses: number[];
};
const DOMAIN_PROBES: DomainProbe[] = [
  // Public landing-page error sink. No auth, accepts any JSON body.
  { router: "clinical-1",     method: "post",   path: "/api/client-error",                                             acceptableStatuses: [200, 204, 400] },
  // requireAuth — unauthenticated probe must 401.
  { router: "patient",        method: "post",   path: "/api/sessions/revoke-all",                                      acceptableStatuses: [401] },
  { router: "clinical-2",     method: "post",   path: "/api/workflow-automation/consultation-summaries/generate",      acceptableStatuses: [401] },
  { router: "collab-1",       method: "post",   path: "/api/safety-analysis/drug-interactions",                        acceptableStatuses: [401] },
  { router: "collab-2",       method: "delete", path: "/api/episodes-of-care/test-id-does-not-exist",                  acceptableStatuses: [401] },
  // requireAuth-protected packets list.
  { router: "integrations-1", method: "get",    path: "/api/packets",                                                  acceptableStatuses: [401] },
  { router: "clinical-3",     method: "get",    path: "/api/fhir/transformations",                                     acceptableStatuses: [401] },
  // Public ASCVD guidelines — handler returns the rule set without auth.
  { router: "clinical-4",     method: "get",    path: "/api/ascvd/guidelines",                                         acceptableStatuses: [200] },
  { router: "clinical-5",     method: "get",    path: "/api/clinical-trials",                                          acceptableStatuses: [401] },
  // requireAuth-protected share-package email. (Note: cannot probe
  // `/api/share/packages` here — integrations-1 registers a greedy
  // `/api/share/:token` earlier in the stack that swallows that path.)
  { router: "integrations-2", method: "post",   path: "/api/share/quick",                                              acceptableStatuses: [401] },
  { router: "analytics",      method: "post",   path: "/api/ehr-connectors/test-connector/connect",                    acceptableStatuses: [401] },
  // Public ID.me status endpoint — handler returns service mode without auth.
  { router: "clinical-6",     method: "get",    path: "/api/data-aggregation/idme/status",                             acceptableStatuses: [200] },
];

// --- Static route-stack walk (count check) ---------------------------------

type RegisteredRoute = { method: string; path: string };

function collectRoutes(app: Express): RegisteredRoute[] {
  const out: RegisteredRoute[] = [];
  // express 5 exposes the internal router as `app.router`; express 4
  // used `app._router`. Support both so this test survives upgrades.
  const stack: any[] =
    (app as any).router?.stack ?? (app as any)._router?.stack ?? [];
  walk(stack, "", out);
  return out;
}

function walk(stack: any[], mountPath: string, out: RegisteredRoute[]): void {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods || {});
      const fullPath = mountPath + (layer.route.path || "");
      for (const m of methods) out.push({ method: m.toLowerCase(), path: fullPath });
    } else if (layer.name === "router" && layer.handle?.stack) {
      walk(layer.handle.stack, mountPath, out);
    }
  }
}

// --- HTTP probe runner -----------------------------------------------------

async function probe(
  baseUrl: string,
  p: DomainProbe,
): Promise<{ status: number; body: string }> {
  const url = baseUrl + p.path;
  const init: RequestInit = { method: p.method.toUpperCase() };
  if (p.method === "post" || p.method === "put" || p.method === "patch") {
    init.headers = { "content-type": "application/json" };
    init.body = "{}";
  }
  const res = await fetch(url, init);
  const body = await res.text();
  return { status: res.status, body };
}

// --- Orchestration ---------------------------------------------------------

export async function checkRouteSplit(): Promise<{
  ok: boolean;
  total: number;
  baseline: number;
  probeFailures: Array<{ probe: DomainProbe; status: number; reason: string }>;
  reason?: string;
}> {
  const app = express();
  await registerRoutes(app);

  // Sentinel: any request that falls past every registered route lands
  // here. Probes that receive this body know the route is unmounted.
  app.use((_req: Request, res: Response) => {
    res.status(404).type("text/plain").send(UNMOUNTED_SENTINEL);
  });

  const routes = collectRoutes(app);

  // 1. Total count check.
  if (routes.length < ROUTE_COUNT_BASELINE) {
    return {
      ok: false,
      total: routes.length,
      baseline: ROUTE_COUNT_BASELINE,
      probeFailures: [],
      reason: `Route count ${routes.length} is below baseline ${ROUTE_COUNT_BASELINE} — a domain router likely failed to mount.`,
    };
  }

  // 2. HTTP probes against a real listening server.
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const probeFailures: Array<{ probe: DomainProbe; status: number; reason: string }> = [];
  try {
    for (const p of DOMAIN_PROBES) {
      const { status, body } = await probe(baseUrl, p);
      if (body.includes(UNMOUNTED_SENTINEL)) {
        probeFailures.push({
          probe: p,
          status,
          reason: `Route not registered — request fell through to the unmounted-route sentinel. Router '${p.router}' likely failed to load.`,
        });
        continue;
      }
      if (!p.acceptableStatuses.includes(status)) {
        probeFailures.push({
          probe: p,
          status,
          reason: `Got status ${status}; expected one of [${p.acceptableStatuses.join(", ")}]. Either the handler regressed or its auth/middleware wiring changed.`,
        });
      }
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  if (probeFailures.length > 0) {
    return {
      ok: false,
      total: routes.length,
      baseline: ROUTE_COUNT_BASELINE,
      probeFailures,
      reason:
        `Representative-endpoint probes failed for ${probeFailures.length}/${DOMAIN_PROBES.length} domain router(s).`,
    };
  }
  return { ok: true, total: routes.length, baseline: ROUTE_COUNT_BASELINE, probeFailures: [] };
}

// Direct execution path: `node --import tsx server/__tests__/routes-split.test.ts`
if (require.main === module) {
  (async () => {
    const r = await checkRouteSplit();
    if (!r.ok) {
      console.error(`FAIL — route-split drift detected: ${r.reason}`);
      console.error(`       total=${r.total} baseline=${r.baseline}`);
      for (const f of r.probeFailures) {
        console.error(`       [${f.probe.router}] ${f.probe.method.toUpperCase()} ${f.probe.path} → ${f.reason}`);
      }
      process.exit(1);
    }
    console.log(
      `OK — route split intact: ${r.total} routes registered (baseline ${r.baseline}), all ${DOMAIN_PROBES.length} domain routers responded as expected.`,
    );
    process.exit(0);
  })().catch((e) => {
    console.error("FAIL — route-split test errored:", e);
    process.exit(1);
  });
}
