import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import { randomBytes } from "crypto";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";
import { createUpdrsAssessmentService, UpdrsInputError } from "../server/services/updrs-assessment-service";
import { createSpeechScreeningService, SpeechScreeningInputError } from "../server/services/speech-screening-service";
import type { SustainedVowelFeatures } from "../shared/speech-acoustics";

/**
 * Runs against a real Postgres (the `pg-rate-limit-integration` CI job's
 * service container). Each run gets its own schema and applies the real
 * migration file, so it also proves migrations/0004 is valid SQL. Skipped
 * anywhere without TEST_DATABASE_URL.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

// History is ordered by a millisecond timestamp; keep sequential saves in
// distinct milliseconds so ordering assertions are deterministic.
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

const vowel = (overrides: Partial<SustainedVowelFeatures> = {}): SustainedVowelFeatures => ({
  taskType: "sustained_vowel",
  f0MeanHz: 150,
  f0SdSemitones: 0.2,
  jitterPercent: 0.5,
  shimmerPercent: 2,
  hnrDb: 25,
  voicedRatio: 0.95,
  durationSec: 5,
  ...overrides,
});

describe.skipIf(!TEST_DATABASE_URL)("Parkinson's tool results persistence (real Postgres)", () => {
  const schemaName = `vista_test_${randomBytes(6).toString("hex")}`;
  let adminPool: Pool;
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    process.env.PHI_ENCRYPTION_KEY ??= "test-key-do-not-use-in-prod-0123456789ab";
    process.env.PHI_ENCRYPTION_SALT ??= "test-salt-do-not-use-in-prod-0123456789ab";

    adminPool = new Pool({ connectionString: TEST_DATABASE_URL });
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    pool = new Pool({ connectionString: TEST_DATABASE_URL, options: `-c search_path=${schemaName}` });
    await pool.query(readFileSync("migrations/0004_parkinsons_results.sql", "utf8"));
    db = drizzle(pool, { schema });
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminPool?.end();
  });

  describe("UPDRS assessments", () => {
    it("persists encrypted at rest and reads back decrypted", async () => {
      const service = createUpdrsAssessmentService(db);
      const saved = await service.calculateAssessment("user-a", { p1: 2, p5: 3 }, 2, "Assessed 1h after levodopa dose");

      const raw = await pool.query("SELECT updrs_result::text AS payload FROM updrs_assessments WHERE id = $1", [saved.id]);
      expect(raw.rows).toHaveLength(1);
      expect(JSON.parse(raw.rows[0].payload)).toHaveProperty("__enc");
      expect(raw.rows[0].payload).not.toContain("levodopa");
      expect(raw.rows[0].payload).not.toContain("grandTotal");

      const [latest] = await service.getHistory("user-a");
      expect(latest).toEqual(saved);
      expect(latest.grandTotal).toBe(5);
    });

    it("survives a restart: a fresh service instance sees the same history and computes the trend from it", async () => {
      await tick();
      const second = await createUpdrsAssessmentService(db).calculateAssessment("user-a", { p1: 4, p5: 3 }, 2);
      expect(second.previousGrandTotal).toBe(5);
      expect(second.changeFromPrevious).toBe(2);
      expect(second.trend).toBe("worsened");

      const history = await createUpdrsAssessmentService(db).getHistory("user-a");
      expect(history.map(h => h.grandTotal)).toEqual([7, 5]);
    });

    it("isolates users", async () => {
      const service = createUpdrsAssessmentService(db);
      expect(await service.getHistory("user-b")).toEqual([]);
      expect(await service.getLatest("user-b")).toBeUndefined();
    });

    it("drops unknown score keys and rejects oversized notes without writing", async () => {
      const service = createUpdrsAssessmentService(db);
      const saved = await service.calculateAssessment("user-c", { p1: 1, injected: 999 }, 1);
      expect(saved.scores).toEqual({ p1: 1 });

      await expect(service.calculateAssessment("user-d", {}, 1, "x".repeat(2001))).rejects.toBeInstanceOf(UpdrsInputError);
      await expect(service.calculateAssessment("user-d", { p1: 9 }, 1)).rejects.toBeInstanceOf(UpdrsInputError);
      expect(await service.getHistory("user-d")).toEqual([]);
    });
  });

  describe("Speech screening results", () => {
    it("persists encrypted, filters by task type, and trends against the stored previous result", async () => {
      const service = createSpeechScreeningService(db);
      const first = await service.analyze("user-a", vowel());
      expect(first.trend).toBeUndefined();

      const raw = await pool.query("SELECT task_type, speech_result::text AS payload FROM speech_screening_results WHERE id = $1", [first.id]);
      expect(raw.rows[0].task_type).toBe("sustained_vowel");
      expect(JSON.parse(raw.rows[0].payload)).toHaveProperty("__enc");
      expect(raw.rows[0].payload).not.toContain("jitterPercent");

      await tick();
      const second = await createSpeechScreeningService(db).analyze("user-a", vowel({ jitterPercent: 1.0 }));
      const jitterTrend = second.trend?.find(t => t.metric === "jitterPercent");
      expect(jitterTrend).toMatchObject({ direction: "increased", changePercent: 100 });

      expect(await service.getHistory("user-a", "reading_passage")).toEqual([]);
      expect((await service.getHistory("user-a", "sustained_vowel")).map(r => r.id)).toEqual([second.id, first.id]);
      expect(await service.getHistory("user-b")).toEqual([]);
    });

    it("rejects unusable recordings without writing", async () => {
      const service = createSpeechScreeningService(db);
      await expect(service.analyze("user-e", vowel({ durationSec: 0.5 }))).rejects.toBeInstanceOf(SpeechScreeningInputError);
      await expect(service.analyze("user-e", vowel({ voicedRatio: 0.01 }))).rejects.toBeInstanceOf(SpeechScreeningInputError);
      expect(await service.getHistory("user-e")).toEqual([]);
    });
  });
});
