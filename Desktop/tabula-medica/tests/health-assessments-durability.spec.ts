/**
 * Durability tests for the initial-health-assessment store.
 *
 * healthAssessments moved out of an in-memory Map into the
 * `app_health_assessments` table (DatabaseStorage, C1). This is the onboarding
 * questionnaire a patient answers (questions + responses + optional AI
 * analysis) — patient-entered health data. Held only in memory it is lost on
 * restart.
 *
 * This suite proves:
 *   - createHealthAssessment persists an assessment a fresh instance reads back,
 *     with the questions/responses jsonb arrays round-tripping.
 *   - getHealthAssessmentBySession resolves by onboarding session.
 *   - updateHealthAssessment merges a partial update (e.g. adding aiAnalysis +
 *     completedAt) durably.
 *
 * server/db is mocked with in-process Postgres (PGlite) built from the canonical
 * Drizzle table; assertions read back through a fresh DatabaseStorage.
 *
 * Run:
 *   npx vitest run tests/health-assessments-durability.spec.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appHealthAssessmentsTable } from "@shared/schema";
import { createSchemaTables } from "./helpers/pglite-schema";

const ref = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../server/db", () => ({
  get db() {
    return ref.db;
  },
}));

let client: PGlite;

beforeAll(async () => {
  client = new PGlite();
  ref.db = drizzle(client);
  await createSchemaTables(client, { appHealthAssessmentsTable });
});

beforeEach(async () => {
  await client.exec("TRUNCATE app_health_assessments;");
});

async function getStorage() {
  const { DatabaseStorage } = await import("../server/storage");
  return new DatabaseStorage();
}

const SESSION = "ha-session-1";

function baseAssessment(overrides: Record<string, unknown> = {}) {
  return {
    onboardingSessionId: SESSION,
    patientId: "ha-patient",
    questions: [{ id: "q1", text: "Do you smoke?" }],
    responses: [{ questionId: "q1", answer: "no" }],
    ...overrides,
  } as Parameters<Awaited<ReturnType<typeof getStorage>>["createHealthAssessment"]>[0];
}

describe("createHealthAssessment — durable, arrays round-trip", () => {
  it("persists an assessment a fresh instance reads back", async () => {
    const writer = await getStorage();
    const created = await writer.createHealthAssessment(baseAssessment());
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTruthy();

    const reader = await getStorage();
    const got = await reader.getHealthAssessment(created.id);
    expect(got).toBeDefined();
    expect(got!.questions).toEqual([{ id: "q1", text: "Do you smoke?" }]);
    expect(got!.responses).toEqual([{ questionId: "q1", answer: "no" }]);
  });

  it("resolves by onboarding session", async () => {
    const storage = await getStorage();
    await storage.createHealthAssessment(baseAssessment());

    const bySession = await storage.getHealthAssessmentBySession(SESSION);
    expect(bySession).toBeDefined();
    expect(bySession!.onboardingSessionId).toBe(SESSION);
    expect(await storage.getHealthAssessmentBySession("missing-session")).toBeUndefined();
  });
});

describe("updateHealthAssessment — merge + persist", () => {
  it("adds aiAnalysis + completedAt and a fresh instance sees it", async () => {
    const storage = await getStorage();
    const created = await storage.createHealthAssessment(baseAssessment());

    const updated = await storage.updateHealthAssessment(created.id, {
      completedAt: "2026-06-28T00:00:00.000Z",
      aiAnalysis: { riskLevel: "low", summary: "Healthy" } as never,
    });
    expect(updated!.completedAt).toBe("2026-06-28T00:00:00.000Z");
    // unchanged fields preserved
    expect(updated!.questions).toHaveLength(1);

    const reader = await getStorage();
    const got = await reader.getHealthAssessment(created.id);
    expect(got!.completedAt).toBe("2026-06-28T00:00:00.000Z");
    expect((got!.aiAnalysis as { summary?: string })?.summary).toBe("Healthy");
  });

  it("returns undefined when updating a missing assessment", async () => {
    const storage = await getStorage();
    expect(
      await storage.updateHealthAssessment("00000000-0000-0000-0000-000000000000", {
        completedAt: "x",
      }),
    ).toBeUndefined();
  });
});
