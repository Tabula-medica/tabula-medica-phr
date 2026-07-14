import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const routesSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "routes.ts"),
  "utf8",
);

describe("patient AI route authorization", () => {
  it.each([
    'app.post("/api/patients/:id/ai-summary"',
    'app.get("/api/patients/:patientId/chart-summary"',
    'app.get("/api/patients/:patientId/predictive-risk"',
    'app.get("/api/patients/:patientId/history-summary"',
    'app.get("/api/patients/:patientId/care-gaps-ai"',
  ])("%s requires records:read", (routePrefix) => {
    const routeStart = routesSource.indexOf(routePrefix);
    expect(routeStart, `${routePrefix} should exist`).toBeGreaterThanOrEqual(0);

    const handlerStart = routesSource.indexOf("async (req, res)", routeStart);
    expect(handlerStart, `${routePrefix} should register an async handler`).toBeGreaterThan(routeStart);

    const routeDeclaration = routesSource.slice(routeStart, handlerStart);
    expect(routeDeclaration).toContain('requirePermission("records:read")');
  });
});
