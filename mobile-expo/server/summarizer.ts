import { medplum } from "./medplum-client";
import { checkFeatureAccess } from "./subscription-service";
import { callVertexAI } from "./gcp-vertex-ai-service";
import { logger } from "./utils/logger";
import type { DataCategory } from "./third-party-data-governance";

const FHIR_RESOURCE_TYPES = [
  "Condition",
  "MedicationRequest",
  "Observation",
  "AllergyIntolerance",
  "Procedure",
  "Immunization",
  "DiagnosticReport",
  "Encounter",
  "CarePlan",
] as const;

interface PatientFhirBundle {
  conditions: any[];
  medications: any[];
  observations: any[];
  allergies: any[];
  procedures: any[];
  immunizations: any[];
  diagnosticReports: any[];
  encounters: any[];
  carePlans: any[];
}

export interface DeduplicatedSummary {
  summary: string;
  sections: {
    activeConditions: string;
    medications: string;
    recentLabs: string;
    allergies: string;
    procedures: string;
    immunizations: string;
    upcomingCarePlans: string;
  };
  resourceCounts: Record<string, number>;
  duplicatesRemoved: number;
  provider: "vertex_ai" | "openai_fallback";
  disclaimer: string;
  generatedAt: string;
}

const PHI_STRIP_FIELDS = [
  "name",
  "birthDate",
  "address",
  "telecom",
  "identifier",
  "photo",
  "contact",
  "maritalStatus",
  "communication",
];

function deidentifyResource(resource: any): any {
  if (!resource || typeof resource !== "object") return resource;
  const deid = JSON.parse(JSON.stringify(resource));
  delete deid.text;
  delete deid.contained;
  if (deid.subject) deid.subject = { reference: "Patient/REDACTED" };
  if (deid.patient) deid.patient = { reference: "Patient/REDACTED" };
  if (deid.resourceType === "Patient") {
    for (const field of PHI_STRIP_FIELDS) delete deid[field];
  }
  for (const ref of ["performer", "requester", "recorder", "asserter", "author", "informant"]) {
    if (deid[ref]) {
      if (Array.isArray(deid[ref])) {
        deid[ref] = deid[ref].map(() => ({ reference: "Practitioner/REDACTED" }));
      } else if (typeof deid[ref] === "object") {
        deid[ref] = { reference: "Practitioner/REDACTED" };
      }
    }
  }
  if (deid.encounter) deid.encounter = { reference: "Encounter/REDACTED" };
  delete deid.id;
  delete deid.meta?.versionId;
  delete deid.meta?.source;
  return deid;
}

async function fetchPatientResources(patientId: string): Promise<PatientFhirBundle> {
  const bundle: PatientFhirBundle = {
    conditions: [],
    medications: [],
    observations: [],
    allergies: [],
    procedures: [],
    immunizations: [],
    diagnosticReports: [],
    encounters: [],
    carePlans: [],
  };

  const resourceMap: Record<string, keyof PatientFhirBundle> = {
    Condition: "conditions",
    MedicationRequest: "medications",
    Observation: "observations",
    AllergyIntolerance: "allergies",
    Procedure: "procedures",
    Immunization: "immunizations",
    DiagnosticReport: "diagnosticReports",
    Encounter: "encounters",
    CarePlan: "carePlans",
  };

  const fetches = FHIR_RESOURCE_TYPES.map(async (resourceType) => {
    try {
      const results = await medplum.searchResources(resourceType, {
        patient: `Patient/${patientId}`,
        _count: "200",
        _sort: "-date",
      });
      const key = resourceMap[resourceType];
      if (key) bundle[key] = results;
    } catch (err: any) {
      logger.warn(`[Summarizer] Failed to fetch ${resourceType} for patient ${patientId}: ${err.message}`);
    }
  });

  await Promise.all(fetches);
  return bundle;
}

function buildResourceSummaryPrompt(bundle: PatientFhirBundle): string {
  const deidBundle: Record<string, any[]> = {};
  let totalResources = 0;
  for (const [key, resources] of Object.entries(bundle)) {
    deidBundle[key] = resources.map(deidentifyResource);
    totalResources += resources.length;
  }

  return `The following is a collection of ${totalResources} FHIR resources for a single patient, fetched from multiple sources. There may be duplicates.

CONDITIONS (${deidBundle.conditions.length}):
${JSON.stringify(deidBundle.conditions, null, 1)}

MEDICATIONS (${deidBundle.medications.length}):
${JSON.stringify(deidBundle.medications, null, 1)}

OBSERVATIONS / LABS (${deidBundle.observations.length}):
${JSON.stringify(deidBundle.observations, null, 1)}

ALLERGIES (${deidBundle.allergies.length}):
${JSON.stringify(deidBundle.allergies, null, 1)}

PROCEDURES (${deidBundle.procedures.length}):
${JSON.stringify(deidBundle.procedures, null, 1)}

IMMUNIZATIONS (${deidBundle.immunizations.length}):
${JSON.stringify(deidBundle.immunizations, null, 1)}

DIAGNOSTIC REPORTS (${deidBundle.diagnosticReports.length}):
${JSON.stringify(deidBundle.diagnosticReports, null, 1)}

ENCOUNTERS (${deidBundle.encounters.length}):
${JSON.stringify(deidBundle.encounters, null, 1)}

CARE PLANS (${deidBundle.carePlans.length}):
${JSON.stringify(deidBundle.carePlans, null, 1)}`;
}

export async function generateDeduplicatedSummary(
  patientId: string,
  userId: string
): Promise<DeduplicatedSummary> {
  const access = checkFeatureAccess(userId, "ai_summaries");
  if (!access.allowed) {
    throw new Error(access.upgradeMessage || "AI summaries require a Professional subscription.");
  }

  logger.info(`[Summarizer] Generating deduplicated summary for patient ${patientId}, user ${userId}`);
  const bundle = await fetchPatientResources(patientId);

  const totalResources = Object.values(bundle).reduce((sum, arr) => sum + arr.length, 0);
  if (totalResources === 0) {
    return {
      summary: "No FHIR resources found for this patient.",
      sections: {
        activeConditions: "None found",
        medications: "None found",
        recentLabs: "None found",
        allergies: "None found",
        procedures: "None found",
        immunizations: "None found",
        upcomingCarePlans: "None found",
      },
      resourceCounts: Object.fromEntries(
        Object.entries(bundle).map(([k, v]) => [k, v.length])
      ),
      duplicatesRemoved: 0,
      provider: "vertex_ai",
      disclaimer: "AI-generated content. Must be reviewed by a licensed healthcare provider. This is not medical advice.",
      generatedAt: new Date().toISOString(),
    };
  }

  const systemPrompt = `You are a clinical data analyst AI operating under HIPAA compliance. Your task is to analyze a collection of FHIR resources for one patient, deduplicate overlapping entries from multiple data sources, and produce a concise, structured clinical summary.

GOVERNANCE RULES:
- Omit ALL PII (names, SSNs, addresses, phone numbers, email addresses)
- Use only medical identifiers, codes, and clinical terminology
- Flag any contradictions between sources
- Clearly mark active vs resolved conditions
- Sort medications by current vs discontinued
- Highlight critical allergies and drug interactions

Respond in JSON format:
{
  "summary": "A 2-3 paragraph clinical narrative summarizing the patient's health status",
  "sections": {
    "activeConditions": "Deduplicated list of active conditions with ICD codes and onset dates",
    "medications": "Current medications with dosage, frequency, and prescriber when available",
    "recentLabs": "Most recent lab values with reference ranges and trends",
    "allergies": "All known allergies with severity and reaction type",
    "procedures": "Significant procedures with dates",
    "immunizations": "Immunization history with dates and status",
    "upcomingCarePlans": "Active care plans and pending follow-ups"
  },
  "duplicatesRemoved": <number of duplicate entries identified and merged>
}`;

  const userPrompt = buildResourceSummaryPrompt(bundle);

  const dataCategories: DataCategory[] = [
    "conditions",
    "medications",
    "lab_results",
    "allergies",
    "vitals",
  ];

  const result = await callVertexAI(
    {
      projectId: process.env.GCP_PROJECT_ID || "united-planet-485003-n7",
      location: process.env.GCP_LOCATION || "us-central1",
      model: "gemini-2.5-pro",
      maxOutputTokens: 8192,
    },
    systemPrompt,
    userPrompt,
    dataCategories,
    userId,
    "generateDeduplicatedSummary"
  );

  let parsed: any;
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] || result.content);
  } catch {
    parsed = {
      summary: result.content,
      sections: {
        activeConditions: "See summary above",
        medications: "See summary above",
        recentLabs: "See summary above",
        allergies: "See summary above",
        procedures: "See summary above",
        immunizations: "See summary above",
        upcomingCarePlans: "See summary above",
      },
      duplicatesRemoved: 0,
    };
  }

  logger.info(
    `[Summarizer] Summary generated via ${result.provider}: ${totalResources} resources, ${parsed.duplicatesRemoved || 0} duplicates removed`
  );

  return {
    summary: parsed.summary,
    sections: parsed.sections,
    resourceCounts: Object.fromEntries(
      Object.entries(bundle).map(([k, v]) => [k, v.length])
    ),
    duplicatesRemoved: parsed.duplicatesRemoved || 0,
    provider: result.provider,
    disclaimer: "AI-generated content. Must be reviewed by a licensed healthcare provider. This is not medical advice.",
    generatedAt: new Date().toISOString(),
  };
}
