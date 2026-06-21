import { getAuditLogger } from "./integrations/factory";

export interface FHIRResourceVersion {
  versionId: string;
  resourceId: string;
  resourceType: string;
  data: Record<string, unknown>;
  meta: {
    versionId: string;
    lastUpdated: string;
    source?: string;
    profile?: string[];
    tag?: Array<{ system: string; code: string; display?: string }>;
  };
  createdAt: string;
  createdBy: string;
  changeType: "create" | "update" | "delete";
  changeSummary: string;
}

export interface FHIRResourceAuditEntry {
  id: string;
  resourceId: string;
  resourceType: string;
  action: "read" | "create" | "update" | "delete" | "search" | "export";
  userId: string;
  userRole: string;
  timestamp: string;
  ipAddress: string;
  accessReason?: string;
  details: Record<string, unknown>;
}

export interface FHIRResourceDetail {
  id: string;
  resourceType: string;
  patientId?: string;
  currentVersion: FHIRResourceVersion;
  versionHistory: FHIRResourceVersion[];
  auditTrail: FHIRResourceAuditEntry[];
  codes: ResourceCode[];
  references: ResourceReference[];
  provenance: ResourceProvenance[];
}

export interface ResourceCode {
  system: string;
  code: string;
  display: string;
  userSelected?: boolean;
}

export interface ResourceReference {
  type: string;
  reference: string;
  display?: string;
}

export interface ResourceProvenance {
  id: string;
  target: string;
  recorded: string;
  activity: string;
  agent: Array<{ type: string; who: string }>;
  source?: string;
}

const resourceVersions = new Map<string, FHIRResourceVersion[]>();
const resourceAuditTrail = new Map<string, FHIRResourceAuditEntry[]>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const sampleResources: FHIRResourceDetail[] = [
  {
    id: "condition-dm2-001",
    resourceType: "Condition",
    patientId: "patient-001",
    currentVersion: {
      versionId: "3",
      resourceId: "condition-dm2-001",
      resourceType: "Condition",
      data: {
        resourceType: "Condition",
        id: "condition-dm2-001",
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active", display: "Active" }] },
        verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed", display: "Confirmed" }] },
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "problem-list-item", display: "Problem List Item" }] }],
        code: {
          coding: [
            { system: "http://snomed.info/sct", code: "44054006", display: "Type 2 Diabetes Mellitus" },
            { system: "http://hl7.org/fhir/sid/icd-10-cm", code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
          ],
          text: "Type 2 Diabetes Mellitus",
        },
        subject: { reference: "Patient/patient-001" },
        onsetDateTime: "2020-06-15",
        recordedDate: "2020-06-15",
      },
      meta: {
        versionId: "3",
        lastUpdated: "2024-03-15T10:30:00Z",
        source: "Primary Care Provider",
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition"],
      },
      createdAt: "2024-03-15T10:30:00Z",
      createdBy: "dr-smith",
      changeType: "update",
      changeSummary: "Updated clinical status based on recent lab results",
    },
    versionHistory: [
      {
        versionId: "1",
        resourceId: "condition-dm2-001",
        resourceType: "Condition",
        data: { code: { text: "Type 2 Diabetes" } },
        meta: { versionId: "1", lastUpdated: "2020-06-15T08:00:00Z", source: "Primary Care Clinic" },
        createdAt: "2020-06-15T08:00:00Z",
        createdBy: "dr-jones",
        changeType: "create",
        changeSummary: "Initial diagnosis recorded",
      },
      {
        versionId: "2",
        resourceId: "condition-dm2-001",
        resourceType: "Condition",
        data: { code: { text: "Type 2 Diabetes Mellitus" } },
        meta: { versionId: "2", lastUpdated: "2022-01-10T14:00:00Z", source: "Primary Care Provider" },
        createdAt: "2022-01-10T14:00:00Z",
        createdBy: "dr-smith",
        changeType: "update",
        changeSummary: "Added ICD-10 coding",
      },
    ],
    auditTrail: [],
    codes: [
      { system: "SNOMED CT", code: "44054006", display: "Type 2 Diabetes Mellitus" },
      { system: "ICD-10-CM", code: "E11.9", display: "Type 2 diabetes mellitus without complications" },
    ],
    references: [{ type: "Patient", reference: "Patient/patient-001", display: "John Smith" }],
    provenance: [
      {
        id: "prov-001",
        target: "Condition/condition-dm2-001",
        recorded: "2024-03-15T10:30:00Z",
        activity: "UPDATE",
        agent: [{ type: "author", who: "Practitioner/dr-smith" }],
        source: "Primary Care Provider",
      },
    ],
  },
  {
    id: "medication-metformin-001",
    resourceType: "MedicationRequest",
    patientId: "patient-001",
    currentVersion: {
      versionId: "2",
      resourceId: "medication-metformin-001",
      resourceType: "MedicationRequest",
      data: {
        resourceType: "MedicationRequest",
        id: "medication-metformin-001",
        status: "active",
        intent: "order",
        medicationCodeableConcept: {
          coding: [
            { system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500 MG Oral Tablet" },
          ],
          text: "Metformin 500mg",
        },
        subject: { reference: "Patient/patient-001" },
        authoredOn: "2024-01-15",
        dosageInstruction: [{ text: "Take 1 tablet twice daily with meals", timing: { repeat: { frequency: 2, period: 1, periodUnit: "d" } } }],
      },
      meta: {
        versionId: "2",
        lastUpdated: "2024-03-01T09:00:00Z",
        source: "CVS Pharmacy",
      },
      createdAt: "2024-03-01T09:00:00Z",
      createdBy: "pharmacist-jones",
      changeType: "update",
      changeSummary: "Refill processed",
    },
    versionHistory: [
      {
        versionId: "1",
        resourceId: "medication-metformin-001",
        resourceType: "MedicationRequest",
        data: { medicationCodeableConcept: { text: "Metformin 500mg" } },
        meta: { versionId: "1", lastUpdated: "2024-01-15T10:00:00Z", source: "Primary Care Clinic" },
        createdAt: "2024-01-15T10:00:00Z",
        createdBy: "dr-smith",
        changeType: "create",
        changeSummary: "Initial prescription",
      },
    ],
    auditTrail: [],
    codes: [{ system: "RxNorm", code: "860975", display: "Metformin 500 MG Oral Tablet" }],
    references: [{ type: "Patient", reference: "Patient/patient-001", display: "John Smith" }],
    provenance: [],
  },
  {
    id: "observation-a1c-001",
    resourceType: "Observation",
    patientId: "patient-001",
    currentVersion: {
      versionId: "1",
      resourceId: "observation-a1c-001",
      resourceType: "Observation",
      data: {
        resourceType: "Observation",
        id: "observation-a1c-001",
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }] }],
        code: {
          coding: [
            { system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c/Hemoglobin.total in Blood" },
          ],
          text: "HbA1c",
        },
        subject: { reference: "Patient/patient-001" },
        effectiveDateTime: "2024-03-10",
        valueQuantity: { value: 7.2, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
        interpretation: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: "H", display: "High" }] }],
      },
      meta: {
        versionId: "1",
        lastUpdated: "2024-03-10T14:00:00Z",
        source: "Quest Diagnostics",
      },
      createdAt: "2024-03-10T14:00:00Z",
      createdBy: "lab-system",
      changeType: "create",
      changeSummary: "Lab result received",
    },
    versionHistory: [],
    auditTrail: [],
    codes: [{ system: "LOINC", code: "4548-4", display: "Hemoglobin A1c/Hemoglobin.total in Blood" }],
    references: [{ type: "Patient", reference: "Patient/patient-001", display: "John Smith" }],
    provenance: [],
  },
];

const resourceDetailMap = new Map<string, FHIRResourceDetail>();

function initializeSampleData(): void {
  sampleResources.forEach((r) => {
    resourceDetailMap.set(r.id, r);
    resourceVersions.set(r.id, [r.currentVersion, ...r.versionHistory]);
  });
}

initializeSampleData();

async function logResourceAccess(
  resourceId: string,
  resourceType: string,
  action: FHIRResourceAuditEntry["action"],
  userId: string,
  userRole: string,
  ipAddress: string,
  userAgent: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const redactedEntryDetails = Object.fromEntries(
    Object.entries(details).map(([k, v]) => [
      k,
      typeof v === "string" && (k.toLowerCase().includes("patient") || k.toLowerCase().includes("id"))
        ? "[REDACTED]"
        : v,
    ])
  );

  const entry: FHIRResourceAuditEntry = {
    id: generateId(),
    resourceId: "[REDACTED]",
    resourceType,
    action,
    userId: "[REDACTED]",
    userRole,
    timestamp: new Date().toISOString(),
    ipAddress: ipAddress.includes(".") ? "[REDACTED-IP]" : ipAddress,
    details: redactedEntryDetails,
  };

  const existing = resourceAuditTrail.get(resourceId) || [];
  existing.push(entry);
  resourceAuditTrail.set(resourceId, existing);

  try {
    const auditLogger = getAuditLogger();
    const redactedDetails = Object.fromEntries(
      Object.entries(details).map(([k, v]) => [
        k,
        typeof v === "string" && (k.toLowerCase().includes("patient") || k.toLowerCase().includes("id"))
          ? "[REDACTED]"
          : v,
      ])
    );
    await auditLogger.log({
      userId: userId || "[REDACTED]",
      userRole,
      action: action === "read" ? "read" : action === "create" ? "create" : action === "update" ? "update" : action === "delete" ? "delete" : "search",
      resourceType: `FHIR/${resourceType}`,
      resourceId: "[REDACTED-RESOURCE]",
      patientId: "[REDACTED]",
      ipAddress: ipAddress.includes(".") ? "[REDACTED-IP]" : ipAddress,
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/fhir-resources/[REDACTED]",
      requestMethod: action === "read" ? "GET" : action === "create" ? "POST" : action === "update" ? "PUT" : action === "delete" ? "DELETE" : "GET",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: redactedDetails,
    });
  } catch (e) {
    console.error("[FHIRResourceViewer] Audit logging failed:", e);
  }
}

export async function getResourceDetail(
  resourceId: string,
  userId: string,
  userRole: string,
  ipAddress: string,
  userAgent: string
): Promise<FHIRResourceDetail | undefined> {
  const resource = resourceDetailMap.get(resourceId);
  if (resource) {
    await logResourceAccess(resourceId, resource.resourceType, "read", userId, userRole, ipAddress, userAgent);
    return {
      ...resource,
      auditTrail: (resourceAuditTrail.get(resourceId) || []).slice(-20),
    };
  }
  return undefined;
}

export function getAllResources(): Array<{ id: string; resourceType: string; displayName: string; lastUpdated: string; source?: string }> {
  return Array.from(resourceDetailMap.values()).map((r) => ({
    id: r.id,
    resourceType: r.resourceType,
    displayName: extractDisplayName(r),
    lastUpdated: r.currentVersion.meta.lastUpdated,
    source: r.currentVersion.meta.source,
  }));
}

function extractDisplayName(resource: FHIRResourceDetail): string {
  const data = resource.currentVersion.data as Record<string, unknown>;
  if (data.code && typeof data.code === "object") {
    const code = data.code as { text?: string; coding?: Array<{ display?: string }> };
    if (code.text) return code.text;
    if (code.coding?.[0]?.display) return code.coding[0].display;
  }
  if (data.medicationCodeableConcept && typeof data.medicationCodeableConcept === "object") {
    const med = data.medicationCodeableConcept as { text?: string };
    if (med.text) return med.text;
  }
  return resource.id;
}

export async function getResourceVersionHistory(
  resourceId: string,
  userId: string,
  userRole: string,
  ipAddress: string,
  userAgent: string
): Promise<FHIRResourceVersion[]> {
  const versions = resourceVersions.get(resourceId) || [];
  if (versions.length > 0) {
    await logResourceAccess(resourceId, versions[0].resourceType, "read", userId, userRole, ipAddress, userAgent, { accessType: "version_history" });
  }
  return versions;
}

export function getResourceAuditTrail(resourceId: string, limit = 50): FHIRResourceAuditEntry[] {
  return (resourceAuditTrail.get(resourceId) || [])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function getResourcesByType(resourceType: string): FHIRResourceDetail[] {
  return Array.from(resourceDetailMap.values()).filter((r) => r.resourceType === resourceType);
}

console.log("[FHIRResourceViewer] Service initialized with", resourceDetailMap.size, "sample resources");
