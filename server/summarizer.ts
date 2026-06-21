import { createHash } from "crypto";
import { medplumService } from "./services/medplum-client-service";
import { generateText } from "./services/ai-provider";

interface FHIRBundle {
  resourceType: string;
  type: string;
  total?: number;
  entry?: Array<{ resource: any; fullUrl?: string }>;
}

export interface PatientSummary {
  patientId: string;
  generatedAt: string;
  demographics: {
    name: string;
    birthDate?: string;
    gender?: string;
  };
  summary: string;
  resourceCounts: Record<string, number>;
  deduplicationStats: {
    totalResources: number;
    uniqueResources: number;
    duplicatesRemoved: number;
  };
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const sanitized = { ...details };
  if (sanitized.patientId && typeof sanitized.patientId === "string") {
    sanitized.patientId = hashIdentifier(sanitized.patientId);
  }
  console.log(
    `[HIPAA-AUDIT][Summarizer] ${timestamp} - ${action}`,
    JSON.stringify(sanitized)
  );
}

function deduplicateResources(entries: Array<{ resource: any }>): Array<{ resource: any }> {
  const seen = new Map<string, { resource: any; lastUpdated: string }>();

  for (const entry of entries) {
    const r = entry.resource;
    if (!r) continue;

    const fingerprint = buildResourceFingerprint(r);

    const existing = seen.get(fingerprint);
    const thisUpdated = r.meta?.lastUpdated || "";
    if (!existing || thisUpdated > existing.lastUpdated) {
      seen.set(fingerprint, { resource: r, lastUpdated: thisUpdated });
    }
  }

  return Array.from(seen.values()).map((v) => ({ resource: v.resource }));
}

function buildResourceFingerprint(resource: any): string {
  const type = resource.resourceType || "Unknown";
  const id = resource.id || "";

  if (id) return `${type}/${id}`;

  const codeText =
    resource.code?.coding?.[0]?.code ||
    resource.code?.text ||
    resource.vaccineCode?.coding?.[0]?.code ||
    resource.medicationCodeableConcept?.coding?.[0]?.code ||
    "";

  const dateVal =
    resource.effectiveDateTime ||
    resource.issued ||
    resource.recordedDate ||
    resource.authoredOn ||
    resource.occurrenceDateTime ||
    resource.date ||
    "";

  const raw = `${type}|${codeText}|${dateVal}`;
  return createHash("sha256").update(raw).digest("hex");
}

function getPatientName(patient: any): string {
  const name = patient.name?.[0];
  if (!name) return "Unknown";
  const given = name.given?.join(" ") || "";
  const family = name.family || "";
  return `${given} ${family}`.trim() || "Unknown";
}

function buildVertexPrompt(patient: any, resources: any[]): string {
  const grouped: Record<string, any[]> = {};
  for (const r of resources) {
    const type = r.resourceType || "Unknown";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(r);
  }

  let resourceSummaries = "";
  for (const [type, items] of Object.entries(grouped)) {
    if (type === "Patient") continue;
    resourceSummaries += `\n## ${type} (${items.length})\n`;
    for (const item of items.slice(0, 20)) {
      const code = item.code?.text || item.code?.coding?.[0]?.display || "";
      const status = item.status || "";
      const date =
        item.effectiveDateTime || item.issued || item.recordedDate ||
        item.authoredOn || item.occurrenceDateTime || item.date || "";
      const value = item.valueQuantity
        ? `${item.valueQuantity.value} ${item.valueQuantity.unit || ""}`
        : item.valueString || "";
      resourceSummaries += `- ${code}${status ? ` [${status}]` : ""}${date ? ` (${date})` : ""}${value ? `: ${value}` : ""}\n`;
    }
    if (items.length > 20) {
      resourceSummaries += `  ... and ${items.length - 20} more\n`;
    }
  }

  return `You are a clinical health record summarizer. Create a comprehensive, deduplicated patient health summary from the following FHIR R4 resources.

IMPORTANT COMPLIANCE:
- This is an INFORMATIONAL summary only — NOT clinical decision support
- Do NOT provide diagnoses, treatment recommendations, or clinical advice
- Use lay-friendly language where possible
- Flag any conflicting or duplicate data you detect

PATIENT: ${getPatientName(patient)}
DOB: ${patient.birthDate || "Unknown"}
Gender: ${patient.gender || "Unknown"}

RESOURCES:
${resourceSummaries}

Produce a structured summary with these sections:
1. **Patient Overview** — Demographics and key identifiers
2. **Active Conditions** — Current diagnoses and chronic conditions
3. **Medications** — Current prescriptions and dosages
4. **Recent Lab Results** — Notable values and trends
5. **Immunizations** — Vaccination history
6. **Allergies** — Known allergies and intolerances
7. **Recent Encounters** — Hospital visits, appointments
8. **Data Quality Notes** — Any duplicates detected, conflicting data, or missing information

Format the output as structured text with headers.`;
}

export async function summarizePatient(patientId: string): Promise<PatientSummary> {
  logHipaaAudit("SUMMARY_REQUESTED", { patientId });

  const bundle: FHIRBundle = await medplumService.getPatientEverything(patientId);
  const allEntries = bundle.entry || [];

  if (allEntries.length === 0) {
    throw new Error("No FHIR resources found for this patient");
  }

  const deduplicated = deduplicateResources(allEntries);
  const deduplicationStats = {
    totalResources: allEntries.length,
    uniqueResources: deduplicated.length,
    duplicatesRemoved: allEntries.length - deduplicated.length,
  };

  const resourceCounts: Record<string, number> = {};
  for (const entry of deduplicated) {
    const type = entry.resource?.resourceType || "Unknown";
    resourceCounts[type] = (resourceCounts[type] || 0) + 1;
  }

  const patient =
    deduplicated.find((e) => e.resource?.resourceType === "Patient")?.resource ||
    (await medplumService.getPatient(patientId));

  const prompt = buildVertexPrompt(
    patient,
    deduplicated.map((e) => e.resource)
  );

  logHipaaAudit("SUMMARY_AI_CALL", {
    patientId,
    resourceCount: deduplicated.length,
    provider: "vertex",
  });

  const summary = await generateText(
    {
      systemPrompt:
        "You are a clinical health record summarizer. Your output is INFORMATIONAL ONLY and must NOT constitute clinical decision support. Follow NO-CDS policy strictly.",
      userPrompt: prompt,
      temperature: 0.3,
      maxTokens: 4096,
      responseFormat: "text",
    },
    "patient_summary"
  );

  const result: PatientSummary = {
    patientId,
    generatedAt: new Date().toISOString(),
    demographics: {
      name: getPatientName(patient),
      birthDate: patient.birthDate,
      gender: patient.gender,
    },
    summary,
    resourceCounts,
    deduplicationStats,
  };

  logHipaaAudit("SUMMARY_GENERATED", {
    patientId,
    resourceCounts,
    deduplicationStats,
    summaryLength: summary.length,
  });

  return result;
}
