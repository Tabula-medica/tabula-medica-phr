/**
 * Complete chart/notes summarization connector tests.
 *
 * Weighted toward two things: gathering actually spans every `Patient` row
 * sharing a `unifiedPatientId` (the whole point of "complete"), and the AI
 * narrative can never smuggle in a fact id that was not in the closed set —
 * mirroring the assertions `hcc-reviewer` tests make about discarding
 * hallucinated candidate ids.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/storage", () => {
  let patients: any[] = [];
  let connections: Record<string, any> = {};
  let medicalRecords: any[] = [];
  let medications: any[] = [];
  let vitals: any[] = [];
  let labResults: any[] = [];
  let allergies: any[] = [];
  let problems: any[] = [];
  let immunizations: any[] = [];
  let familyHistory: any[] = [];
  let uploadedDocuments: any[] = [];

  const byPatientIds = (rows: any[], patientIds: string[]) =>
    rows.filter((r) => patientIds.includes(r.patientId));

  const storage = {
    __reset() {
      patients = [];
      connections = {};
      medicalRecords = [];
      medications = [];
      vitals = [];
      labResults = [];
      allergies = [];
      problems = [];
      immunizations = [];
      familyHistory = [];
      uploadedDocuments = [];
    },
    __seed(fixtures: {
      patients?: any[];
      connections?: Record<string, any>;
      medicalRecords?: any[];
      medications?: any[];
      vitals?: any[];
      labResults?: any[];
      allergies?: any[];
      problems?: any[];
      immunizations?: any[];
      familyHistory?: any[];
      uploadedDocuments?: any[];
    }) {
      patients = fixtures.patients ?? [];
      connections = fixtures.connections ?? {};
      medicalRecords = fixtures.medicalRecords ?? [];
      medications = fixtures.medications ?? [];
      vitals = fixtures.vitals ?? [];
      labResults = fixtures.labResults ?? [];
      allergies = fixtures.allergies ?? [];
      problems = fixtures.problems ?? [];
      immunizations = fixtures.immunizations ?? [];
      familyHistory = fixtures.familyHistory ?? [];
      uploadedDocuments = fixtures.uploadedDocuments ?? [];
    },
    async getPatientsByUnifiedId(unifiedPatientId: string) {
      return patients.filter((p) => p.unifiedPatientId === unifiedPatientId);
    },
    async getEhrConnection(id: string) {
      return connections[id];
    },
    async getMedicalRecordsByUnifiedPatient(unifiedPatientId: string) {
      const ids = patients.filter((p) => p.unifiedPatientId === unifiedPatientId).map((p) => p.id);
      return byPatientIds(medicalRecords, ids);
    },
    async getMedicationsByUnifiedPatient(unifiedPatientId: string) {
      const ids = patients.filter((p) => p.unifiedPatientId === unifiedPatientId).map((p) => p.id);
      return byPatientIds(medications, ids);
    },
    async getVitalsByUnifiedPatient(unifiedPatientId: string) {
      const ids = patients.filter((p) => p.unifiedPatientId === unifiedPatientId).map((p) => p.id);
      return byPatientIds(vitals, ids);
    },
    async getLabResultsByUnifiedPatient(unifiedPatientId: string) {
      const ids = patients.filter((p) => p.unifiedPatientId === unifiedPatientId).map((p) => p.id);
      return byPatientIds(labResults, ids);
    },
    async getAllergiesByUnifiedPatient(unifiedPatientId: string) {
      const ids = patients.filter((p) => p.unifiedPatientId === unifiedPatientId).map((p) => p.id);
      return byPatientIds(allergies, ids);
    },
    async getProblemsByUnifiedPatient(unifiedPatientId: string) {
      const ids = patients.filter((p) => p.unifiedPatientId === unifiedPatientId).map((p) => p.id);
      return byPatientIds(problems, ids);
    },
    async getImmunizations(patientId: string) {
      return immunizations.filter((i) => i.patientId === patientId);
    },
    async getFamilyHistoryByPatient(patientId: string) {
      return familyHistory.filter((f) => f.patientId === patientId);
    },
    async getUploadedDocuments(patientId: string) {
      return uploadedDocuments.filter((d) => d.patientId === patientId);
    },
    async createSecurityAuditLog(entry: any) {
      return { id: "audit-1", ...entry };
    },
  };
  return { storage };
});

import { storage } from "../server/storage";
import { gatherChartFacts } from "../server/services/complete-chart-summary/fact-gatherer";
import { buildNarrative } from "../server/services/complete-chart-summary/narrative-builder";
import { buildCompleteChartSummary } from "../server/services/complete-chart-summary";
import type { ChartFactSet } from "@shared/complete-chart-summary";

const fakeStorage = storage as any;

beforeEach(() => {
  fakeStorage.__reset();
});

const ECW_CONNECTION_ID = "conn-ecw";
const FASTEN_CONNECTION_ID = "conn-fasten";
const UNIFIED_ID = "unified-1";
const ECW_PATIENT_ID = "patient-ecw";
const FASTEN_PATIENT_ID = "patient-fasten";

function seedTwoSourcePatient() {
  fakeStorage.__seed({
    patients: [
      { id: ECW_PATIENT_ID, unifiedPatientId: UNIFIED_ID, ehrConnectionId: ECW_CONNECTION_ID },
      { id: FASTEN_PATIENT_ID, unifiedPatientId: UNIFIED_ID, ehrConnectionId: FASTEN_CONNECTION_ID },
    ],
    connections: {
      [ECW_CONNECTION_ID]: { id: ECW_CONNECTION_ID, platform: "ecw", facilityName: "Riverside Clinic", lastSync: "2026-01-01T00:00:00.000Z" },
      [FASTEN_CONNECTION_ID]: { id: FASTEN_CONNECTION_ID, platform: "fastenhealth", facilityName: "Fasten Health Aggregate", lastSync: "2026-02-01T00:00:00.000Z" },
    },
    medicalRecords: [
      {
        id: "rec-1", patientId: ECW_PATIENT_ID, ehrConnectionId: ECW_CONNECTION_ID,
        type: "note", title: "Annual physical", description: "Patient reports feeling well overall.",
        date: "2026-01-15", provider: "Dr. Lee", facility: "Riverside Clinic", status: "active",
      },
    ],
    problems: [
      { id: "prob-1", patientId: FASTEN_PATIENT_ID, name: "Type 2 diabetes", category: "chronic", status: "active", onsetDate: "2022-05-01" },
    ],
    medications: [
      { id: "med-1", patientId: ECW_PATIENT_ID, name: "Metformin", dosage: "500mg", frequency: "BID", status: "active", prescribedBy: "Dr. Lee", startDate: "2022-05-10" },
    ],
  });
}

describe("gatherChartFacts", () => {
  it("refuses no-patient-rows when the unifiedPatientId has no linked patients", async () => {
    const { factSet, refused } = await gatherChartFacts("nobody");
    expect(factSet).toBeNull();
    expect(refused?.reason).toBe("no-patient-rows");
  });

  it("refuses no-facts when patient rows exist but carry nothing", async () => {
    fakeStorage.__seed({
      patients: [{ id: ECW_PATIENT_ID, unifiedPatientId: UNIFIED_ID, ehrConnectionId: ECW_CONNECTION_ID }],
      connections: { [ECW_CONNECTION_ID]: { id: ECW_CONNECTION_ID, platform: "ecw", facilityName: "Riverside Clinic" } },
    });
    const { factSet, refused } = await gatherChartFacts(UNIFIED_ID);
    expect(factSet).toBeNull();
    expect(refused?.reason).toBe("no-facts");
  });

  it("gathers facts across every patient row sharing the unifiedPatientId, tagged by source platform", async () => {
    seedTwoSourcePatient();
    const { factSet } = await gatherChartFacts(UNIFIED_ID);
    expect(factSet).not.toBeNull();
    expect(factSet!.sourceCounts).toEqual({ ecw: 2, fastenhealth: 1 });

    const note = factSet!.facts.find((f) => f.category === "note");
    expect(note?.text).toContain("Annual physical");
    expect(note?.text).toContain("Patient reports feeling well overall");
    expect(note?.provenance.platform).toBe("ecw");
    expect(note?.provenance.facilityName).toBe("Riverside Clinic");

    const problem = factSet!.facts.find((f) => f.category === "problem");
    expect(problem?.provenance.platform).toBe("fastenhealth");
  });
});

describe("buildNarrative — closed candidate set discipline", () => {
  const factSet: ChartFactSet = {
    unifiedPatientId: UNIFIED_ID,
    facts: [
      { id: "problem:prob-1", category: "problem", text: "Type 2 diabetes", provenance: { patientRowId: "p1", platform: "ecw" } },
      { id: "medication:med-1", category: "medication", text: "Metformin 500mg BID", provenance: { patientRowId: "p1", platform: "ecw" } },
    ],
    sourceCounts: { ecw: 2 },
    generatedAt: new Date().toISOString(),
  };

  it("keeps citations that reference real fact ids", async () => {
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify({
        sections: [
          { title: "Active Problems & Diagnoses", narrative: "Diabetes on file.", citedFactIds: ["problem:prob-1"] },
        ],
      }),
    );
    const result = await buildNarrative(factSet, { generate });
    expect(result.unverifiedNarrative).toBe(false);
    expect(result.discardedReferences).toEqual([]);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].citedFactIds).toEqual(["problem:prob-1"]);
  });

  it("discards a citation for a fact id that was never given to the model", async () => {
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify({
        sections: [
          {
            title: "Active Problems & Diagnoses",
            narrative: "Diabetes and a hallucinated hypertension diagnosis.",
            citedFactIds: ["problem:prob-1", "problem:invented-hypertension"],
          },
        ],
      }),
    );
    const result = await buildNarrative(factSet, { generate });
    expect(result.discardedReferences).toEqual(["problem:invented-hypertension"]);
    // The real citation survives; the section is not thrown out wholesale.
    expect(result.sections[0].citedFactIds).toEqual(["problem:prob-1"]);
  });

  it("drops a section whose every citation is invented, falling back to the template", async () => {
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify({
        sections: [
          { title: "Fabricated section", narrative: "Nothing real here.", citedFactIds: ["not-a-real-id"] },
        ],
      }),
    );
    const result = await buildNarrative(factSet, { generate });
    expect(result.unverifiedNarrative).toBe(true);
    expect(result.discardedReferences).toEqual(["not-a-real-id"]);
    // Falls back to the deterministic template, which always cites real ids.
    for (const section of result.sections) {
      for (const id of section.citedFactIds) {
        expect(factSet.facts.some((f) => f.id === id)).toBe(true);
      }
    }
  });

  it("falls back to the template immediately when AI is not configured", async () => {
    const generate = vi.fn();
    const result = await buildNarrative(factSet, { generate, aiConfigured: false });
    expect(generate).not.toHaveBeenCalled();
    expect(result.unverifiedNarrative).toBe(true);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("falls back to the template when the model call throws", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("Vertex unavailable"));
    const result = await buildNarrative(factSet, { generate });
    expect(result.unverifiedNarrative).toBe(true);
    expect(result.discardedReferences).toEqual([]);
  });

  it("falls back to the template when the model returns malformed JSON", async () => {
    const generate = vi.fn().mockResolvedValue("not json at all");
    const result = await buildNarrative(factSet, { generate });
    expect(result.unverifiedNarrative).toBe(true);
  });
});

describe("buildCompleteChartSummary — orchestration", () => {
  it("surfaces the refusal when there is nothing to gather", async () => {
    const result = await buildCompleteChartSummary("nobody", { requestedBy: "user-1" });
    expect(result.summary).toBeNull();
    expect(result.refused?.reason).toBe("no-patient-rows");
  });

  it("builds a summary spanning both sources with a restated disclaimer", async () => {
    seedTwoSourcePatient();
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify({
        sections: [
          { title: "Medications", narrative: "On metformin for diabetes.", citedFactIds: ["medication:med-1"] },
        ],
      }),
    );
    const result = await buildCompleteChartSummary(UNIFIED_ID, { requestedBy: "user-1", generate });
    expect(result.refused).toBeNull();
    expect(result.summary?.disclaimer).toMatch(/AI-organized summary/i);
    expect(result.summary?.sourceCounts).toEqual({ ecw: 2, fastenhealth: 1 });
    expect(result.summary?.sections[0].citedFactIds).toEqual(["medication:med-1"]);
  });
});
