import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("critical PHI auth regressions", () => {
  it("keeps voice PHI commands authenticated and scoped to caller patients", () => {
    const source = read("server/voice.ts");

    expect(source).toContain('app.post("/api/voice/command", isAuthenticated');
    expect(source).toContain("storage.getUserPatientIds(userId)");
    expect(source).toContain("storage.getAllergiesByPatient(patientId)");
    expect(source).toContain("storage.getMedicationsByPatient(patientId)");
    expect(source).not.toContain("storage.getAllergies()");
    expect(source).not.toContain("storage.getPatients()");
  });

  it("requires auth before comprehensive onboarding can process FHIR or AI prefill data", () => {
    const source = read("server/comprehensive-onboarding-routes.ts");

    expect(source).toContain('app.use("/api/comprehensive-onboarding", isAuthenticated)');
    expect(source).toContain('app.post("/api/comprehensive-onboarding/ai-prefill"');
  });

  it("blocks every Fasten-derived surface when TEFCA is disabled for regional deployments", () => {
    const source = read("server/routes.ts");

    for (const prefix of [
      "/api/fasten-connect",
      "/api/phr-pipeline",
      "/api/comprehensive-onboarding",
      "/api/ehr-integration",
    ]) {
      expect(source).toContain(`"${prefix}"`);
    }
  });

  it("keeps dashboard stats authenticated and scoped away from global PHI aggregates", () => {
    const source = read("server/routes.ts");

    expect(source).toContain('app.get("/api/dashboard/stats", isAuthenticated');
    expect(source).toContain("storage.getEhrConnections(userId)");
    expect(source).toContain("storage.getUserPatientIds(userId)");
    expect(source).not.toContain("const connections = await storage.getEhrConnections();");
    expect(source).not.toContain("const unifiedPatients = await storage.getUnifiedPatients();");
    expect(source).not.toContain("const patients = await storage.getPatients();");
  });
});
