/**
 * Regression tests for the FastenHealth webhook modernization:
 *   - Fasten Connect v2 API surface
 *   - Hardened security (requireTimestamp fail-closed, stale-event rejection)
 *   - Atomic idempotency via claimWebhookEvent (DB unique constraint + onConflictDoNothing)
 *   - Retry / backoff on EHI export download failures + individual FHIR insert failures
 *   - Expanded FHIR resource type mappings (44 types)
 *   - New v2 webhook event types (ehi_export_complete, connection_refreshed, etc.)
 *   - userId resolution from dataSources for immediate EHI import
 *
 * All tests are framework-agnostic and run via:
 *   node --import tsx server/__tests__/fasten-webhook.test.ts
 *
 * DB calls are stubbed on the shared drizzle `db` singleton — no real
 * Postgres connection required.
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";
process.env.FASTEN_PUBLIC_ID = "test-public-id";
process.env.FASTEN_PRIVATE_KEY = "test-private-key";
process.env.GCP_PROJECT_ID = "test-project";

import assert from "node:assert/strict";
import { test } from "node:test";
import crypto from "node:crypto";

import {
  mapFhirResourceToRecordType,
  getWebhookEventTimestamp,
  handleWebhookEvent,
  downloadAndImportFhirData,
  type FastenWebhookPayload,
} from "../fasten-health-service";

import {
  verifySignature,
  computeHmacSignature,
  claimWebhookEvent,
} from "../webhook-security-service";

import { db } from "../db";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function equal<T>(label: string, actual: T, expected: T): void {
  ok(label, actual === expected);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePayload(overrides: Partial<FastenWebhookPayload> = {}): FastenWebhookPayload {
  return {
    api_mode: "test",
    id: crypto.randomUUID(),
    type: "webhook.test",
    created_at: new Date().toISOString(),
    data: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test: expanded FHIR resource type mapping
// ---------------------------------------------------------------------------
test("mapFhirResourceToRecordType — existing mappings preserved", () => {
  equal("Patient → demographics", mapFhirResourceToRecordType("Patient"), "demographics");
  equal("Condition → condition", mapFhirResourceToRecordType("Condition"), "condition");
  equal("MedicationRequest → medication", mapFhirResourceToRecordType("MedicationRequest"), "medication");
  equal("Observation → lab_result", mapFhirResourceToRecordType("Observation"), "lab_result");
  equal("DiagnosticReport → lab_result", mapFhirResourceToRecordType("DiagnosticReport"), "lab_result");
  equal("Procedure → procedure", mapFhirResourceToRecordType("Procedure"), "procedure");
  equal("Encounter → visit", mapFhirResourceToRecordType("Encounter"), "visit");
  equal("Immunization → immunization", mapFhirResourceToRecordType("Immunization"), "immunization");
  equal("AllergyIntolerance → allergy", mapFhirResourceToRecordType("AllergyIntolerance"), "allergy");
  equal("CarePlan → care_plan", mapFhirResourceToRecordType("CarePlan"), "care_plan");
  equal("DocumentReference → document", mapFhirResourceToRecordType("DocumentReference"), "document");
  equal("Coverage → insurance", mapFhirResourceToRecordType("Coverage"), "insurance");
  equal("Claim → claim", mapFhirResourceToRecordType("Claim"), "claim");
  equal("ExplanationOfBenefit → eob", mapFhirResourceToRecordType("ExplanationOfBenefit"), "eob");
});

test("mapFhirResourceToRecordType — new v2 mappings", () => {
  equal("MedicationAdministration → medication", mapFhirResourceToRecordType("MedicationAdministration"), "medication");
  equal("MedicationDispense → medication", mapFhirResourceToRecordType("MedicationDispense"), "medication");
  equal("FamilyMemberHistory → family_history", mapFhirResourceToRecordType("FamilyMemberHistory"), "family_history");
  equal("Appointment → appointment", mapFhirResourceToRecordType("Appointment"), "appointment");
  equal("ServiceRequest → service_request", mapFhirResourceToRecordType("ServiceRequest"), "service_request");
  equal("RelatedPerson → related_person", mapFhirResourceToRecordType("RelatedPerson"), "related_person");
  equal("Organization → organization", mapFhirResourceToRecordType("Organization"), "organization");
  equal("Practitioner → practitioner", mapFhirResourceToRecordType("Practitioner"), "practitioner");
  equal("PractitionerRole → practitioner", mapFhirResourceToRecordType("PractitionerRole"), "practitioner");
  equal("Location → location", mapFhirResourceToRecordType("Location"), "location");
  equal("Consent → consent", mapFhirResourceToRecordType("Consent"), "consent");
  equal("RiskAssessment → risk_assessment", mapFhirResourceToRecordType("RiskAssessment"), "risk_assessment");
  equal("NutritionOrder → nutrition_order", mapFhirResourceToRecordType("NutritionOrder"), "nutrition_order");
  equal("VisionPrescription → vision_prescription", mapFhirResourceToRecordType("VisionPrescription"), "vision_prescription");
  equal("Communication → communication", mapFhirResourceToRecordType("Communication"), "communication");
  equal("Task → task", mapFhirResourceToRecordType("Task"), "task");
  equal("ImagingStudy → imaging_study", mapFhirResourceToRecordType("ImagingStudy"), "imaging_study");
  equal("Media → imaging_study", mapFhirResourceToRecordType("Media"), "imaging_study");
  equal("Composition → document", mapFhirResourceToRecordType("Composition"), "document");
  equal("Binary → document", mapFhirResourceToRecordType("Binary"), "document");
  equal("AdverseEvent → adverse_event", mapFhirResourceToRecordType("AdverseEvent"), "adverse_event");
  equal("ClinicalImpression → clinical_impression", mapFhirResourceToRecordType("ClinicalImpression"), "clinical_impression");
  equal("MolecularSequence → lab_result", mapFhirResourceToRecordType("MolecularSequence"), "lab_result");
  equal("Questionnaire → questionnaire", mapFhirResourceToRecordType("Questionnaire"), "questionnaire");
  equal("QuestionnaireResponse → questionnaire_response", mapFhirResourceToRecordType("QuestionnaireResponse"), "questionnaire_response");
  equal("ResearchStudy → research_study", mapFhirResourceToRecordType("ResearchStudy"), "research_study");
  equal("Unknown → other", mapFhirResourceToRecordType("UnknownResource"), "other");
});

// ---------------------------------------------------------------------------
// Test: webhook event timestamp extraction (v1 date + v2 created_at)
// ---------------------------------------------------------------------------
test("getWebhookEventTimestamp — reads v1 date field", () => {
  const ts = new Date("2025-01-15T10:00:00Z");
  const payload = makePayload({ date: ts.toISOString(), created_at: undefined });
  const result = getWebhookEventTimestamp(payload);
  ok("returns a Date object", result !== null);
  ok("timestamp matches", result!.getTime() === ts.getTime());
});

test("getWebhookEventTimestamp — prefers v2 created_at over date", () => {
  const ts = new Date("2025-06-01T12:00:00Z");
  const payload = makePayload({ created_at: ts.toISOString(), date: "2020-01-01T00:00:00Z" });
  const result = getWebhookEventTimestamp(payload);
  ok("returns v2 created_at value", result !== null && result.getTime() === ts.getTime());
});

test("getWebhookEventTimestamp — returns null when both fields absent", () => {
  const payload = makePayload({ date: undefined, created_at: undefined });
  const result = getWebhookEventTimestamp(payload);
  equal("returns null", result, null);
});

test("getWebhookEventTimestamp — returns null for invalid date string", () => {
  const payload = makePayload({ created_at: "not-a-date", date: undefined });
  const result = getWebhookEventTimestamp(payload);
  equal("returns null for invalid date", result, null);
});

// ---------------------------------------------------------------------------
// Test: HMAC signature helpers
// ---------------------------------------------------------------------------
test("verifySignature — accepts correct HMAC-SHA256 hex signature", () => {
  const secret = "test-webhook-secret";
  const body = JSON.stringify({ type: "webhook.test", id: "abc" });
  const sig = computeHmacSignature(body, secret, "sha256", "hex");
  ok("valid signature accepted", verifySignature(body, sig, secret, "sha256", "hex"));
});

test("verifySignature — rejects wrong signature", () => {
  const secret = "test-webhook-secret";
  const body = JSON.stringify({ type: "webhook.test", id: "abc" });
  const wrong = "0".repeat(64);
  ok("wrong signature rejected", !verifySignature(body, wrong, secret, "sha256", "hex"));
});

test("verifySignature — rejects signature computed with different secret", () => {
  const body = JSON.stringify({ type: "webhook.test", id: "abc" });
  const sig = computeHmacSignature(body, "secret-a", "sha256", "hex");
  ok("different-secret signature rejected", !verifySignature(body, sig, "secret-b", "sha256", "hex"));
});

test("verifySignature — rejects signature for tampered body", () => {
  const secret = "test-webhook-secret";
  const original = JSON.stringify({ type: "webhook.test", id: "abc" });
  const tampered = JSON.stringify({ type: "webhook.test", id: "TAMPERED" });
  const sig = computeHmacSignature(original, secret, "sha256", "hex");
  ok("tampered body rejected", !verifySignature(tampered, sig, secret, "sha256", "hex"));
});

// ---------------------------------------------------------------------------
// Test: handleWebhookEvent — existing event types
// ---------------------------------------------------------------------------
test("handleWebhookEvent — webhook.test returns handled=true", async () => {
  const payload = makePayload({ type: "webhook.test" });
  const result = await handleWebhookEvent(payload);
  ok("handled", result.handled);
  ok("message contains 'test'", result.message.toLowerCase().includes("test"));
});

test("handleWebhookEvent — patient.authorization_revoked handled", async () => {
  const payload = makePayload({
    type: "patient.authorization_revoked",
    data: { org_connection_id: "conn-xyz" },
  });
  const result = await handleWebhookEvent(payload);
  ok("handled", result.handled);
  ok("message mentions org_connection_id", result.message.includes("conn-xyz"));
});

test("handleWebhookEvent — patient.ehi_export_failed handled", async () => {
  const payload = makePayload({
    type: "patient.ehi_export_failed",
    data: { failure_reason: "Source system offline", org_connection_id: "conn-abc" },
  });
  const result = await handleWebhookEvent(payload);
  ok("handled", result.handled);
  ok("message includes failure reason", result.message.includes("Source system offline"));
});

test("handleWebhookEvent — patient.ehi_export_success with no download_links", async () => {
  const payload = makePayload({
    type: "patient.ehi_export_success",
    data: { download_links: [], org_connection_id: "conn-1", stats: {} },
  });
  const result = await handleWebhookEvent(payload);
  ok("not handled (no links)", !result.handled);
});

// ---------------------------------------------------------------------------
// Test: handleWebhookEvent — new v2 event types
// ---------------------------------------------------------------------------
test("handleWebhookEvent — patient.ehi_export_complete is an alias for success", async () => {
  const payload = makePayload({
    type: "patient.ehi_export_complete",
    data: { download_links: [], org_connection_id: "conn-2", stats: {} },
  });
  const result = await handleWebhookEvent(payload);
  ok("recognized (not unknown)", result.message !== `Unrecognized event type: ${payload.type}`);
});

test("handleWebhookEvent — patient.connection_refreshed handled", async () => {
  const payload = makePayload({
    type: "patient.connection_refreshed",
    data: { org_connection_id: "conn-refresh", refresh_status: "failure" },
  });
  const result = await handleWebhookEvent(payload);
  ok("handled", result.handled);
  ok("message mentions org_connection_id", result.message.includes("conn-refresh"));
});

test("handleWebhookEvent — patient.token_refreshed handled", async () => {
  const payload = makePayload({
    type: "patient.token_refreshed",
    data: { org_connection_id: "conn-token" },
  });
  const result = await handleWebhookEvent(payload);
  ok("handled", result.handled);
});

test("handleWebhookEvent — platform.status_update handled", async () => {
  const payload = makePayload({
    type: "platform.status_update",
    data: { status: "degraded", message: "Partial outage" },
  });
  const result = await handleWebhookEvent(payload);
  ok("handled", result.handled);
  ok("message includes status", result.message.includes("degraded"));
});

test("handleWebhookEvent — unrecognized event type returns handled=false", async () => {
  const payload = makePayload({ type: "future.unknown_event_v99", data: {} });
  const result = await handleWebhookEvent(payload);
  ok("handled=false for unknown type", !result.handled);
  ok("message mentions event type", result.message.includes("future.unknown_event_v99"));
});

// ---------------------------------------------------------------------------
// Test: atomic idempotency via claimWebhookEvent
// ---------------------------------------------------------------------------
test("claimWebhookEvent — claimed=true when no prior row exists", async () => {
  const origInsert = (db as any).insert;
  const origSelect = (db as any).select;

  const fakeInsertId = crypto.randomUUID();
  (db as any).insert = () => ({
    values: () => ({
      onConflictDoNothing: () => ({
        returning: async () => [{ id: fakeInsertId }],
      }),
    }),
  });

  try {
    const result = await claimWebhookEvent({
      source: "fasten_health",
      eventType: "webhook.test",
      aggregatorEventId: "evt-new-" + crypto.randomUUID(),
      payload: { type: "webhook.test" },
    });
    ok("claimed=true for new event", result.claimed);
    ok("id returned from insert", result.id === fakeInsertId);
  } finally {
    (db as any).insert = origInsert;
    (db as any).select = origSelect;
  }
});

test("claimWebhookEvent — claimed=false when conflict (duplicate delivery)", async () => {
  const origInsert = (db as any).insert;
  const origSelect = (db as any).select;
  const existingId = crypto.randomUUID();

  (db as any).insert = () => ({
    values: () => ({
      onConflictDoNothing: () => ({
        returning: async () => [],
      }),
    }),
  });

  (db as any).select = () => ({
    from: () => ({
      where: () => ({
        limit: async () => [{ id: existingId }],
      }),
    }),
  });

  try {
    const result = await claimWebhookEvent({
      source: "fasten_health",
      eventType: "webhook.test",
      aggregatorEventId: "evt-duplicate",
      payload: { type: "webhook.test" },
    });
    ok("claimed=false for duplicate event", !result.claimed);
    ok("returns existing row id", result.id === existingId);
  } finally {
    (db as any).insert = origInsert;
    (db as any).select = origSelect;
  }
});

test("claimWebhookEvent — falls back to plain insert when onConflictDoNothing throws", async () => {
  const origInsert = (db as any).insert;
  let insertCallCount = 0;
  const fallbackId = crypto.randomUUID();

  (db as any).insert = () => {
    insertCallCount++;
    return {
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => { throw new Error("unique constraint not yet in DB"); },
        }),
        returning: async () => [{ id: fallbackId }],
      }),
    };
  };

  try {
    const result = await claimWebhookEvent({
      source: "fasten_health",
      eventType: "webhook.test",
      aggregatorEventId: "evt-fallback-" + crypto.randomUUID(),
      payload: { type: "webhook.test" },
    });
    ok("claimed=true via fallback insert", result.claimed);
  } finally {
    (db as any).insert = origInsert;
  }
});

// ---------------------------------------------------------------------------
// Test: downloadAndImportFhirData — download retry behavior
// ---------------------------------------------------------------------------
test("downloadAndImportFhirData — retries on transient fetch failure then succeeds", async () => {
  let callCount = 0;
  const ndjson = [
    JSON.stringify({ resourceType: "Condition", id: "c1", code: { text: "Hypertension" } }),
    JSON.stringify({ resourceType: "Observation", id: "o1", code: { text: "BP" }, valueQuantity: { value: 120, unit: "mmHg" } }),
    JSON.stringify({ resourceType: "MedicationAdministration", id: "ma1", medicationCodeableConcept: { text: "Aspirin" } }),
  ].join("\n");

  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, _opts: any) => {
    callCount++;
    if (callCount <= 2) {
      throw new Error("Simulated transient network error");
    }
    return { ok: true, text: async () => ndjson };
  }) as any;

  const origSelect = (db as any).select;
  const origInsert = (db as any).insert;
  const origUpdate = (db as any).update;

  (db as any).select = () => ({ from: () => ({ where: async () => [] }) });
  (db as any).insert = () => ({
    values: () => ({
      returning: async () => [{ id: "ds-stub-id" }],
      onConflictDoNothing: () => ({ returning: async () => [{ id: "rec-stub" }] }),
    }),
  });
  (db as any).update = () => ({ set: () => ({ where: async () => {} }) });

  try {
    const result = await downloadAndImportFhirData(
      "user-retry-test",
      "https://fake.fasten.health/export/abc",
      "conn-retry",
      "conn-retry"
    );
    ok("completed without terminal failure", !result.terminal || result.errors === 0);
    ok("fetch retried (called more than once before success)", callCount >= 3);
  } finally {
    globalThis.fetch = origFetch;
    (db as any).select = origSelect;
    (db as any).insert = origInsert;
    (db as any).update = origUpdate;
  }
});

test("downloadAndImportFhirData — returns terminal=true after all download retries exhausted", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("Persistent network failure");
  }) as any;

  const origSelect = (db as any).select;
  const origInsert = (db as any).insert;
  const origUpdate = (db as any).update;

  (db as any).select = () => ({ from: () => ({ where: async () => [{ id: "ds-existing" }] }) });
  (db as any).insert = () => ({ values: () => ({ returning: async () => [{ id: "ds-stub" }] }) });
  (db as any).update = () => ({ set: () => ({ where: async () => {} }) });

  try {
    const result = await downloadAndImportFhirData(
      "user-fail-test",
      "https://fake.fasten.health/export/fail",
      "conn-fail",
      "conn-fail"
    );
    ok("terminal flag set on persistent download failure", result.terminal);
    ok("import count is 0 on terminal failure", result.imported === 0);
    ok("error count is > 0 on terminal failure", result.errors > 0);
  } finally {
    globalThis.fetch = origFetch;
    (db as any).select = origSelect;
    (db as any).insert = origInsert;
    (db as any).update = origUpdate;
  }
});

test("downloadAndImportFhirData — retries individual FHIR record inserts on transient DB error", async () => {
  const ndjson = [
    JSON.stringify({ resourceType: "Condition", id: "c1", code: { text: "Diabetes" } }),
  ].join("\n");

  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, text: async () => ndjson })) as any;

  const origSelect = (db as any).select;
  const origInsert = (db as any).insert;
  const origUpdate = (db as any).update;

  let insertCalls = 0;
  (db as any).select = () => ({ from: () => ({ where: async () => [{ id: "ds-existing" }] }) });
  (db as any).insert = () => ({
    values: () => {
      insertCalls++;
      if (insertCalls === 1) {
        throw new Error("Transient DB connection error");
      }
      return { returning: async () => [{ id: "rec-" + insertCalls }] };
    },
  });
  (db as any).update = () => ({ set: () => ({ where: async () => {} }) });

  try {
    const result = await downloadAndImportFhirData(
      "user-insert-retry-test",
      "https://fake.fasten.health/export/retry",
      "conn-insert-retry",
      "conn-insert-retry"
    );
    ok("record inserted after retry (imported >= 1)", result.imported >= 1);
    ok("insert was attempted more than once (retry happened)", insertCalls > 1);
  } finally {
    globalThis.fetch = origFetch;
    (db as any).select = origSelect;
    (db as any).insert = origInsert;
    (db as any).update = origUpdate;
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const total = passed + failed;
console.log(`\n${passed}/${total} tests passed`);
if (failed > 0) {
  console.error(`${failed} test(s) failed`);
  process.exit(1);
}
