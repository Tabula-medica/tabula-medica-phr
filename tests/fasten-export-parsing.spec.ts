import { describe, expect, it } from "vitest";
import {
  bucketResources,
  extractExportPayload,
  extractFailurePayload,
  isAllowedFastenDownloadUrl,
  isFastenConnectionLostEvent,
  isFastenExportFailureEvent,
  isFastenExportSuccessEvent,
  parseFhirResources,
} from "../server/auth/fasten-export-parsing";

const CONN_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("isFastenExportSuccessEvent", () => {
  it("matches the documented export success event", () => {
    expect(isFastenExportSuccessEvent({ event_type: "patient.ehi_export_success" })).toBe(true);
  });

  it("matches completed-style variants", () => {
    expect(isFastenExportSuccessEvent({ type: "ehi_export.completed" })).toBe(true);
  });

  it("ignores other webhook events", () => {
    expect(isFastenExportSuccessEvent({ event_type: "connection.complete" })).toBe(false);
    expect(isFastenExportSuccessEvent({ event_type: "patient.ehi_export_failed" })).toBe(false);
    expect(isFastenExportSuccessEvent(null)).toBe(false);
  });

  it("does not treat an incomplete/failed export as successful via substring collision", () => {
    // Regression test: "incomplete" contains "complete" as a substring, and
    // a plain .includes("complete") check would wrongly match it.
    expect(isFastenExportSuccessEvent({ event_type: "patient.ehi_export_incomplete" })).toBe(false);
    expect(isFastenExportSuccessEvent({ event_type: "ehi_export_cancelled" })).toBe(false);
    expect(isFastenExportSuccessEvent({ event_type: "ehi_export_error" })).toBe(false);
  });
});

describe("extractExportPayload", () => {
  it("reads the payload from the data envelope", () => {
    const payload = extractExportPayload({
      event_type: "patient.ehi_export_success",
      data: { org_connection_id: CONN_ID, task_id: "task-1", download_link: "https://api.connect.fastenhealth.com/v1/export/1" },
    });
    expect(payload).toEqual({
      orgConnectionId: CONN_ID,
      taskId: "task-1",
      downloadUrl: "https://api.connect.fastenhealth.com/v1/export/1",
    });
  });

  it("reads top-level fields when there is no data envelope", () => {
    const payload = extractExportPayload({
      org_connection_id: CONN_ID,
      download_url: "https://cdn.fastenhealth.com/exports/2",
    });
    expect(payload?.orgConnectionId).toBe(CONN_ID);
    expect(payload?.downloadUrl).toBe("https://cdn.fastenhealth.com/exports/2");
    expect(payload?.taskId).toBeNull();
  });

  it("rejects events without a UUID connection id", () => {
    expect(extractExportPayload({ data: { org_connection_id: "not-a-uuid" } })).toBeNull();
    expect(extractExportPayload({})).toBeNull();
    expect(extractExportPayload(null)).toBeNull();
  });
});

describe("isAllowedFastenDownloadUrl", () => {
  it("allows https fastenhealth.com hosts", () => {
    expect(isAllowedFastenDownloadUrl("https://fastenhealth.com/x")).toBe(true);
    expect(isAllowedFastenDownloadUrl("https://api.connect.fastenhealth.com/v1/x")).toBe(true);
  });

  it("rejects other hosts, lookalikes, and non-https", () => {
    expect(isAllowedFastenDownloadUrl("https://evil.com/x")).toBe(false);
    expect(isAllowedFastenDownloadUrl("https://notfastenhealth.com/x")).toBe(false);
    expect(isAllowedFastenDownloadUrl("http://fastenhealth.com/x")).toBe(false);
    expect(isAllowedFastenDownloadUrl("not a url")).toBe(false);
  });
});

describe("parseFhirResources", () => {
  const patient = { resourceType: "Patient", id: "p1" };
  const condition = { resourceType: "Condition", id: "c1" };

  it("parses a FHIR Bundle", () => {
    const bundle = JSON.stringify({
      resourceType: "Bundle",
      entry: [{ resource: patient }, { resource: condition }, { fullUrl: "no-resource" }],
    });
    expect(parseFhirResources(bundle)).toEqual([patient, condition]);
  });

  it("parses a bare array and a single resource", () => {
    expect(parseFhirResources(JSON.stringify([patient, condition]))).toEqual([patient, condition]);
    expect(parseFhirResources(JSON.stringify(patient))).toEqual([patient]);
  });

  it("parses NDJSON and skips malformed lines", () => {
    const ndjson = `${JSON.stringify(patient)}\nnot-json\n${JSON.stringify(condition)}`;
    expect(parseFhirResources(ndjson)).toEqual([patient, condition]);
  });

  it("returns empty for empty or unusable input", () => {
    expect(parseFhirResources("")).toEqual([]);
    expect(parseFhirResources("{}")).toEqual([]);
  });
});

describe("bucketResources", () => {
  it("groups resources by type and keeps the first Patient", () => {
    const buckets = bucketResources([
      { resourceType: "Patient", id: "p1" },
      { resourceType: "Patient", id: "p2" },
      { resourceType: "Condition", id: "c1" },
      { resourceType: "Observation", id: "o1" },
      { resourceType: "MedicationRequest", id: "m1" },
      { resourceType: "AllergyIntolerance", id: "a1" },
      { resourceType: "Procedure", id: "pr1" },
      { resourceType: "Encounter", id: "e1" },
      { resourceType: "Immunization", id: "i1" },
      { resourceType: "Coverage", id: "x1" },
    ]);
    expect(buckets.patient?.id).toBe("p1");
    expect(buckets.conditions).toHaveLength(1);
    expect(buckets.observations).toHaveLength(1);
    expect(buckets.medications).toHaveLength(1);
    expect(buckets.allergies).toHaveLength(1);
    expect(buckets.procedures).toHaveLength(1);
    expect(buckets.encounters).toHaveLength(1);
    expect(buckets.immunizations).toHaveLength(1);
    expect(buckets.other).toBe(1);
  });
});

describe("isFastenExportFailureEvent", () => {
  it("matches the documented failure event and variants", () => {
    expect(isFastenExportFailureEvent({ event_type: "patient.ehi_export_failed" })).toBe(true);
    expect(isFastenExportFailureEvent({ type: "ehi_export.cancelled" })).toBe(true);
    expect(isFastenExportFailureEvent({ event_type: "patient.ehi_export_incomplete" })).toBe(true);
  });

  it("ignores success and unrelated events", () => {
    expect(isFastenExportFailureEvent({ event_type: "patient.ehi_export_success" })).toBe(false);
    expect(isFastenExportFailureEvent({ event_type: "connection.expired" })).toBe(false);
    expect(isFastenExportFailureEvent(null)).toBe(false);
  });
});

describe("isFastenConnectionLostEvent", () => {
  it("matches expired / revoked connection events only", () => {
    expect(isFastenConnectionLostEvent({ event_type: "connection.expired" })).toBe(true);
    expect(isFastenConnectionLostEvent({ event_type: "connection.revoked" })).toBe(true);
    expect(isFastenConnectionLostEvent({ event_type: "connection.created" })).toBe(false);
    expect(isFastenConnectionLostEvent({ event_type: "connection.updated" })).toBe(false);
    expect(isFastenConnectionLostEvent({ event_type: "patient.ehi_export_failed" })).toBe(false);
  });
});

describe("extractFailurePayload", () => {
  it("returns null without a valid connection id", () => {
    expect(extractFailurePayload({ event_type: "patient.ehi_export_failed", data: { failure_reason: "x" } })).toBeNull();
    expect(extractFailurePayload({ event_type: "patient.ehi_export_failed", data: { org_connection_id: "not-a-uuid" } })).toBeNull();
  });

  it("carries a sanitized, capped reason and flags re-auth from the wording", () => {
    const p = extractFailurePayload({
      event_type: "patient.ehi_export_failed",
      data: { org_connection_id: CONN_ID, task_id: "t1", failure_reason: "Portal\u0000 token  expired,\n please reauthenticate" },
    });
    expect(p).not.toBeNull();
    expect(p!.orgConnectionId).toBe(CONN_ID);
    expect(p!.taskId).toBe("t1");
    expect(p!.reason).toBe("Portal token expired, please reauthenticate");
    expect(p!.needsReauth).toBe(true);
    const long = extractFailurePayload({
      event_type: "patient.ehi_export_failed",
      data: { org_connection_id: CONN_ID, failure_reason: "x".repeat(500) },
    });
    expect(long!.reason).toHaveLength(200);
    expect(long!.needsReauth).toBe(false);
  });

  it("treats a lost connection as needing re-auth even without a reason", () => {
    const p = extractFailurePayload({ event_type: "connection.revoked", data: { org_connection_id: CONN_ID } });
    expect(p!.reason).toBeNull();
    expect(p!.needsReauth).toBe(true);
  });

  it("does not flag transient failures as re-auth", () => {
    const p = extractFailurePayload({
      event_type: "patient.ehi_export_failed",
      data: { org_connection_id: CONN_ID, failure_reason: "Provider endpoint timed out" },
    });
    expect(p!.needsReauth).toBe(false);
    expect(p!.reason).toBe("Provider endpoint timed out");
  });
});
