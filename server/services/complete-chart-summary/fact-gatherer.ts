/**
 * Deterministic fact gathering across every source for one real person.
 *
 * "Complete" means across `unifiedPatientId`, not across one connection's
 * `patientId`. `ai-chart-insights-service.ts`'s `gatherPatientData` queries a
 * single `patients` row, which is one EHR connection's data — an eCW
 * connection and a Fasten-aggregated import for the same person are two
 * different rows. This module is what "complete" actually requires: every
 * `Patient` row sharing a `unifiedPatientId` (eCW, Fasten Health, manual PHR
 * entry, any other connected source), unioned.
 *
 * Pure data assembly, no AI, no judgement calls about what matters — that is
 * `narrative-builder.ts`'s job, and it only gets to work with what this file
 * built. A fact this file does not produce cannot appear in the summary.
 */

import { storage } from "../../storage";
import type { ChartFact, ChartFactCategory, ChartFactSet, FactProvenance, SummaryRefused } from "@shared/complete-chart-summary";
import type { EhrConnection, Patient, VitalSign } from "@shared/schema";

export interface FactGatherResult {
  factSet: ChartFactSet | null;
  refused: SummaryRefused | null;
}

async function provenanceFor(
  patient: Patient,
  connectionCache: Map<string, EhrConnection | undefined>,
): Promise<FactProvenance> {
  let connection = connectionCache.get(patient.ehrConnectionId);
  if (connection === undefined && !connectionCache.has(patient.ehrConnectionId)) {
    connection = await storage.getEhrConnection(patient.ehrConnectionId);
    connectionCache.set(patient.ehrConnectionId, connection);
  }
  return {
    patientRowId: patient.id,
    ehrConnectionId: patient.ehrConnectionId,
    platform: connection?.platform,
    facilityName: connection?.facilityName,
    lastSync: connection?.lastSync,
  };
}

function fact(
  category: ChartFactCategory,
  sourceRecordId: string,
  text: string,
  provenance: FactProvenance,
  date?: string,
): ChartFact {
  return { id: `${category}:${sourceRecordId}`, category, date, text, provenance };
}

/**
 * Gather every fact for a unified patient, across every connected source.
 *
 * Refuses rather than returning an empty summary when there are no patient
 * rows at all — a summary titled "complete" over zero source rows is not an
 * empty-but-honest summary, it is a wrong one, and the caller needs to know
 * the unifiedPatientId itself is the problem rather than the patient simply
 * having a thin chart.
 */
export async function gatherChartFacts(unifiedPatientId: string): Promise<FactGatherResult> {
  const patients = await storage.getPatientsByUnifiedId(unifiedPatientId);
  if (patients.length === 0) {
    return {
      factSet: null,
      refused: {
        reason: "no-patient-rows",
        detail:
          `No Patient rows are linked to unifiedPatientId ${unifiedPatientId}. This connector ` +
          "summarizes across every connected source for one person; with no source rows at " +
          "all there is nothing to gather, and returning an empty summary would look like a " +
          "thin-but-real chart rather than a missing identity link.",
      },
    };
  }

  const connectionCache = new Map<string, EhrConnection | undefined>();
  const patientIds = patients.map((p) => p.id);
  const provenanceByPatientId = new Map<string, FactProvenance>();
  for (const p of patients) {
    provenanceByPatientId.set(p.id, await provenanceFor(p, connectionCache));
  }
  const provOf = (patientId: string): FactProvenance =>
    provenanceByPatientId.get(patientId) ?? { patientRowId: patientId };

  const [records, medications, vitals, labResults, allergies, problems] = await Promise.all([
    storage.getMedicalRecordsByUnifiedPatient(unifiedPatientId),
    storage.getMedicationsByUnifiedPatient(unifiedPatientId),
    storage.getVitalsByUnifiedPatient(unifiedPatientId),
    storage.getLabResultsByUnifiedPatient(unifiedPatientId),
    storage.getAllergiesByUnifiedPatient(unifiedPatientId),
    storage.getProblemsByUnifiedPatient(unifiedPatientId),
  ]);

  // No per-connection getter exists for these three yet — composed the same
  // way the *ByUnifiedPatient getters above compose internally: resolve the
  // patient rows first, then union each row's own records.
  const [immunizationsByPatient, familyHistoryByPatient, uploadedDocsByPatient] = await Promise.all([
    Promise.all(patientIds.map((id) => storage.getImmunizations(id))),
    Promise.all(patientIds.map((id) => storage.getFamilyHistoryByPatient(id))),
    Promise.all(patientIds.map((id) => storage.getUploadedDocuments(id))),
  ]);
  const immunizations = immunizationsByPatient.flat();
  const familyHistory = familyHistoryByPatient.flat();
  const uploadedDocuments = uploadedDocsByPatient.flat();

  const facts: ChartFact[] = [];

  for (const r of records) {
    const category: ChartFactCategory =
      r.type === "note"
        ? "note"
        : r.type === "diagnosis"
          ? "diagnosis"
          : r.type === "procedure"
            ? "procedure"
            : r.type === "imaging"
              ? "imaging"
              : "lab_result_record";
    facts.push(
      fact(
        category,
        r.id,
        `[${r.type}] ${r.title}: ${r.description} (provider: ${r.provider || "unknown"}, facility: ${r.facility || "unknown"}, status: ${r.status})`,
        provOf(r.patientId),
        r.date,
      ),
    );
  }

  for (const p of problems) {
    facts.push(
      fact(
        "problem",
        p.id,
        `${p.name}${p.icdCode ? ` (${p.icdCode})` : ""} — ${p.category}, status: ${p.status}` +
          (p.onsetDate ? `, onset ${p.onsetDate}` : "") +
          (p.resolvedDate ? `, resolved ${p.resolvedDate}` : "") +
          (p.severity ? `, severity: ${p.severity}` : "") +
          (p.notes ? `. Notes: ${p.notes}` : ""),
        provOf(p.patientId),
        p.onsetDate,
      ),
    );
  }

  for (const m of medications) {
    facts.push(
      fact(
        "medication",
        m.id,
        `${m.name} ${m.dosage} ${m.frequency} — status: ${m.status}, prescribed by ${m.prescribedBy || "unknown"}` +
          (m.startDate ? `, started ${m.startDate}` : "") +
          (m.endDate ? `, ended ${m.endDate}` : "") +
          (m.patientReported ? ` (patient-reported: ${m.patientReported})` : ""),
        provOf(m.patientId),
        m.startDate,
      ),
    );
  }

  for (const l of labResults) {
    facts.push(
      fact(
        "lab_result",
        l.id,
        `${l.testName}: ${l.value} ${l.unit || ""} [${l.status}]` +
          (l.referenceRange ? ` (reference: ${l.referenceRange})` : "") +
          (l.notes ? `. ${l.notes}` : ""),
        provOf(l.patientId),
        l.date,
      ),
    );
  }

  for (const v of vitals as readonly VitalSign[]) {
    facts.push(
      fact(
        "vital",
        v.id,
        `${v.type.replace(/_/g, " ")}: ${v.value} ${v.unit}`.trim(),
        provOf(v.patientId),
        v.recordedAt,
      ),
    );
  }

  for (const a of allergies) {
    facts.push(
      fact(
        "allergy",
        a.id,
        `${a.name} (${a.type}) — severity: ${a.severity}, reaction: ${a.reaction}, status: ${a.status}`,
        provOf(a.patientId),
        a.onsetDate,
      ),
    );
  }

  for (const i of immunizations) {
    facts.push(
      fact(
        "immunization",
        i.id,
        `${i.vaccineName}${i.vaccineCode ? ` (CVX ${i.vaccineCode})` : ""} — administered ${i.administeredDate}, status: ${i.status}` +
          (i.doseNumber ? `, dose ${i.doseNumber}` : "") +
          (i.reaction ? `. Reaction: ${i.reaction}` : ""),
        provOf(i.patientId),
        i.administeredDate,
      ),
    );
  }

  for (const fh of familyHistory) {
    facts.push(
      fact(
        "family_history",
        fh.id,
        `${fh.relationship}: ${fh.conditionName}` +
          (fh.ageOfOnset ? `, onset age ${fh.ageOfOnset}` : "") +
          (fh.isDeceased ? `, deceased${fh.causeOfDeath ? ` (${fh.causeOfDeath})` : ""}` : ""),
        provOf(fh.patientId),
      ),
    );
  }

  for (const d of uploadedDocuments) {
    const extracted = d.aiExtractedData?.extractedFields;
    const extractedText = extracted
      ? Object.entries(extracted)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")
      : "no extracted text available";
    facts.push(
      fact(
        "uploaded_document",
        d.id,
        `${d.documentType}${d.subcategory ? ` (${d.subcategory})` : ""}: ${d.title} — ${extractedText}`,
        provOf(d.patientId),
        d.documentDate,
      ),
    );
  }

  const sourceCounts: Record<string, number> = {};
  for (const f of facts) {
    const key = f.provenance.platform ?? "unknown";
    sourceCounts[key] = (sourceCounts[key] ?? 0) + 1;
  }

  if (facts.length === 0) {
    return {
      factSet: null,
      refused: {
        reason: "no-facts",
        detail:
          `${patients.length} patient row(s) are linked to unifiedPatientId ${unifiedPatientId}, ` +
          "but none carry any records, problems, medications, labs, vitals, allergies, " +
          "immunizations, family history, or uploaded documents. There is nothing to summarize.",
      },
    };
  }

  return {
    factSet: {
      unifiedPatientId,
      facts,
      sourceCounts,
      generatedAt: new Date().toISOString(),
    },
    refused: null,
  };
}
