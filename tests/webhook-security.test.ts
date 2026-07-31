import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("webhook security route guards", () => {
  it("keeps webhook admin surfaces authenticated and redacts config secrets", () => {
    const routeSource = source("server/webhook-aggregator-routes.ts");

    for (const route of [
      'app.get("/api/aggregator-sync/stats", ...requireWebhookAdmin',
      'app.get("/api/aggregator-sync/:patientId", ...requireWebhookAdmin',
      'app.post("/api/aggregator-sync/:patientId/trigger", ...requireWebhookAdmin',
      'app.get("/api/aggregator-sync", ...requireWebhookAdmin',
      'app.get("/api/webhooks/events", ...requireWebhookAdmin',
      'app.get("/api/webhooks/config", ...requireWebhookAdmin',
      'app.post("/api/webhooks/config", ...requireWebhookAdmin',
    ]) {
      expect(routeSource).toContain(route);
    }

    expect(routeSource).toContain("webhookConfigs.map(redactWebhookConfig)");
    expect(routeSource).not.toContain("data: webhookConfigs,");
  });

  it("blocks Fasten webhook surfaces when TEFCA is disabled", () => {
    const routeSource = source("server/routes.ts");

    expect(routeSource).toContain('"/webhooks/fasten"');
    expect(routeSource).toContain('"/api/webhooks"');
    expect(routeSource).toContain('"/api/aggregator-sync"');
  });

  it("does not log full Fasten webhook payloads", () => {
    const routeSource = source("server/routes.ts");

    expect(routeSource).toContain("FASTEN_WEBHOOK_ENFORCE !== \"false\"");
    expect(routeSource).not.toContain("${JSON.stringify(event)}");
  });
});
