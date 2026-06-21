import type {
  FHIRSearchQuery,
  FHIRSearchResult,
  FHIRSearchResponse,
  FHIRSearchAuditEntry,
  SearchableResourceType,
  CodeSystemType,
} from "@shared/schema";
import { CodeSystemURIs } from "@shared/fhir-r4";
import { getAuditLogger } from "./integrations/factory";

const searchAuditLog: Map<string, FHIRSearchAuditEntry> = new Map();

function generateId(): string {
  return `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const codeSystemMap: Record<CodeSystemType, string> = {
  SNOMED_CT: CodeSystemURIs.SNOMED_CT,
  LOINC: CodeSystemURIs.LOINC,
  ICD10_CM: CodeSystemURIs.ICD10_CM,
  RXNORM: CodeSystemURIs.RXNORM,
  CPT: CodeSystemURIs.CPT,
  NDC: CodeSystemURIs.NDC,
  CVX: CodeSystemURIs.CVX,
};

const sampleResources: FHIRSearchResult[] = [
  {
    id: "condition-1",
    resourceType: "Condition",
    patientId: "patient-001",
    displayName: "Type 2 Diabetes Mellitus",
    code: { value: "44054006", system: "SNOMED_CT", display: "Type 2 diabetes mellitus" },
    date: "2024-01-15",
    status: "active",
    source: "Primary Care Provider",
    rawResource: { resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] } },
  },
  {
    id: "condition-2",
    resourceType: "Condition",
    patientId: "patient-001",
    displayName: "Essential Hypertension",
    code: { value: "I10", system: "ICD10_CM", display: "Essential (primary) hypertension" },
    date: "2023-06-10",
    status: "active",
    source: "Hospital Network",
    rawResource: { resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] } },
  },
  {
    id: "medication-1",
    resourceType: "Medication",
    patientId: "patient-001",
    displayName: "Metformin 500mg",
    code: { value: "860975", system: "RXNORM", display: "Metformin hydrochloride 500 MG Oral Tablet" },
    date: "2024-02-01",
    status: "active",
    source: "Primary Care Provider",
    rawResource: { resourceType: "Medication", code: { coding: [{ code: "860975" }] } },
  },
  {
    id: "medication-2",
    resourceType: "MedicationRequest",
    patientId: "patient-001",
    displayName: "Lisinopril 10mg",
    code: { value: "314076", system: "RXNORM", display: "Lisinopril 10 MG Oral Tablet" },
    date: "2024-01-20",
    status: "active",
    source: "Hospital Network",
    rawResource: { resourceType: "MedicationRequest", status: "active" },
  },
  {
    id: "observation-1",
    resourceType: "Observation",
    patientId: "patient-001",
    displayName: "Hemoglobin A1c",
    code: { value: "4548-4", system: "LOINC", display: "Hemoglobin A1c/Hemoglobin.total in Blood" },
    date: "2024-03-01",
    status: "final",
    source: "LabCorp",
    rawResource: { resourceType: "Observation", valueQuantity: { value: 7.2, unit: "%" } },
  },
  {
    id: "observation-2",
    resourceType: "Observation",
    patientId: "patient-001",
    displayName: "Blood Pressure",
    code: { value: "85354-9", system: "LOINC", display: "Blood pressure panel with all children optional" },
    date: "2024-03-15",
    status: "final",
    source: "Primary Care Provider",
    rawResource: { resourceType: "Observation", component: [{ valueQuantity: { value: 138, unit: "mmHg" } }] },
  },
  {
    id: "observation-3",
    resourceType: "Observation",
    patientId: "patient-002",
    displayName: "Glucose Fasting",
    code: { value: "1558-6", system: "LOINC", display: "Fasting glucose [Mass/volume] in Serum or Plasma" },
    date: "2024-02-28",
    status: "final",
    source: "Quest Diagnostics",
    rawResource: { resourceType: "Observation", valueQuantity: { value: 105, unit: "mg/dL" } },
  },
  {
    id: "allergy-1",
    resourceType: "AllergyIntolerance",
    patientId: "patient-001",
    displayName: "Penicillin Allergy",
    code: { value: "91936005", system: "SNOMED_CT", display: "Allergy to penicillin" },
    date: "2020-05-10",
    status: "active",
    source: "fastenhealth",
    rawResource: { resourceType: "AllergyIntolerance", reaction: [{ manifestation: [{ text: "Hives" }] }] },
  },
  {
    id: "procedure-1",
    resourceType: "Procedure",
    patientId: "patient-001",
    displayName: "Colonoscopy",
    code: { value: "73761001", system: "SNOMED_CT", display: "Colonoscopy" },
    date: "2023-08-15",
    status: "completed",
    source: "Primary Care Provider",
    rawResource: { resourceType: "Procedure", status: "completed" },
  },
  {
    id: "immunization-1",
    resourceType: "Immunization",
    patientId: "patient-001",
    displayName: "COVID-19 Vaccine",
    code: { value: "207", system: "CVX", display: "COVID-19, mRNA, LNP-S, PF, 100 mcg/0.5mL dose" },
    date: "2024-01-05",
    status: "completed",
    source: "CVS Pharmacy",
    rawResource: { resourceType: "Immunization", status: "completed" },
  },
  {
    id: "document-1",
    resourceType: "DocumentReference",
    patientId: "patient-001",
    displayName: "Annual Physical Exam Report",
    date: "2024-02-15",
    status: "current",
    source: "Primary Care Clinic",
    rawResource: { resourceType: "DocumentReference", status: "current" },
  },
  {
    id: "encounter-1",
    resourceType: "Encounter",
    patientId: "patient-001",
    displayName: "Office Visit - Follow-up",
    date: "2024-03-10",
    status: "finished",
    source: "Primary Care Provider",
    rawResource: { resourceType: "Encounter", status: "finished", class: { code: "AMB" } },
  },
];

function redactPHI(data: unknown): unknown {
  if (!data) return data;
  if (typeof data === "string") {
    return data.replace(/patient-\d+/gi, "patient-[REDACTED]");
  }
  if (Array.isArray(data)) {
    return data.map(redactPHI);
  }
  if (typeof data === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (["patientId", "patientName", "ssn", "mrn", "dateOfBirth"].includes(key)) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactPHI(value);
      }
    }
    return redacted;
  }
  return data;
}

function matchesTextSearch(resource: FHIRSearchResult, text: string): boolean {
  const searchLower = text.toLowerCase();
  return (
    resource.displayName.toLowerCase().includes(searchLower) ||
    (resource.code?.display?.toLowerCase().includes(searchLower) ?? false) ||
    (resource.code?.value?.toLowerCase().includes(searchLower) ?? false) ||
    (resource.status?.toLowerCase().includes(searchLower) ?? false) ||
    (resource.source?.toLowerCase().includes(searchLower) ?? false)
  );
}

function matchesCodeSearch(
  resource: FHIRSearchResult,
  code: string,
  system: CodeSystemType
): boolean {
  if (!resource.code) return false;
  return resource.code.system === system && resource.code.value === code;
}

function matchesDateRange(
  resource: FHIRSearchResult,
  start?: string,
  end?: string
): boolean {
  if (!resource.date) return true;
  const resourceDate = new Date(resource.date);
  if (start && resourceDate < new Date(start)) return false;
  if (end && resourceDate > new Date(end)) return false;
  return true;
}

export async function searchFHIRResources(
  query: FHIRSearchQuery,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<FHIRSearchResponse> {
  const startTime = Date.now();
  const searchId = generateId();

  let results = sampleResources.filter((resource) => {
    if (!query.resourceTypes.includes(resource.resourceType as SearchableResourceType)) {
      return false;
    }

    if (query.patientId && resource.patientId !== query.patientId) {
      return false;
    }

    if (query.textSearch && !matchesTextSearch(resource, query.textSearch)) {
      return false;
    }

    if (query.codeSearch) {
      if (!matchesCodeSearch(resource, query.codeSearch.code, query.codeSearch.system)) {
        return false;
      }
    }

    if (query.dateRange) {
      if (!matchesDateRange(resource, query.dateRange.start, query.dateRange.end)) {
        return false;
      }
    }

    return true;
  });

  if (query.sortBy) {
    results.sort((a, b) => {
      let aVal: string | undefined;
      let bVal: string | undefined;
      switch (query.sortBy) {
        case "date":
          aVal = a.date;
          bVal = b.date;
          break;
        case "displayName":
          aVal = a.displayName;
          bVal = b.displayName;
          break;
        case "resourceType":
          aVal = a.resourceType;
          bVal = b.resourceType;
          break;
        default:
          aVal = a.date;
          bVal = b.date;
      }
      const comparison = (aVal || "").localeCompare(bVal || "");
      return query.sortOrder === "asc" ? comparison : -comparison;
    });
  }

  const totalCount = results.length;
  const totalPages = Math.ceil(totalCount / query.pageSize);
  const startIndex = (query.page - 1) * query.pageSize;
  const paginatedResults = results.slice(startIndex, startIndex + query.pageSize);

  const executionTimeMs = Date.now() - startTime;
  const patientIdsAccessed = Array.from(new Set(paginatedResults.map((r) => r.patientId)));

  const redactedQuery = redactPHI(query) as FHIRSearchQuery;
  const redactedPatientIds = patientIdsAccessed.map(() => "[REDACTED]");
  const auditEntry: FHIRSearchAuditEntry = {
    id: searchId,
    userId,
    searchQuery: redactedQuery,
    resultCount: paginatedResults.length,
    executionTimeMs,
    patientIdsAccessed: redactedPatientIds,
    timestamp: new Date().toISOString(),
    ipAddress: ipAddress.includes(".") ? "[REDACTED-IP]" : ipAddress,
    userAgent,
  };
  searchAuditLog.set(searchId, auditEntry);

  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId,
      userRole: "user",
      action: "search",
      resourceType: "FHIRSearch",
      resourceId: searchId,
      ipAddress,
      userAgent,
      requestPath: "/api/fhir/search",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: executionTimeMs,
      phiAccessed: patientIdsAccessed.length > 0,
      details: {
        resourceTypes: query.resourceTypes.join(","),
        resultCount: paginatedResults.length,
        codeSystem: query.codeSearch?.system || "none",
        hasTextSearch: !!query.textSearch,
      },
    });
  } catch (e) {
    console.error("[FHIRSearch] Audit logging failed:", e);
  }

  return {
    results: paginatedResults,
    totalCount,
    page: query.page,
    pageSize: query.pageSize,
    totalPages,
    searchId,
    executionTimeMs,
  };
}

export function getSearchAuditLog(userId: string, limit: number = 50): FHIRSearchAuditEntry[] {
  return Array.from(searchAuditLog.values())
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function getSearchById(searchId: string, userId: string): FHIRSearchAuditEntry | undefined {
  const entry = searchAuditLog.get(searchId);
  if (!entry || entry.userId !== userId) return undefined;
  return entry;
}

export function getCodeSystemInfo(): Record<CodeSystemType, { uri: string; description: string }> {
  return {
    SNOMED_CT: { uri: codeSystemMap.SNOMED_CT, description: "SNOMED Clinical Terms - Clinical terminology" },
    LOINC: { uri: codeSystemMap.LOINC, description: "Logical Observation Identifiers Names and Codes - Lab tests" },
    ICD10_CM: { uri: codeSystemMap.ICD10_CM, description: "ICD-10-CM - Diagnosis codes" },
    RXNORM: { uri: codeSystemMap.RXNORM, description: "RxNorm - Medication terminology" },
    CPT: { uri: codeSystemMap.CPT, description: "Current Procedural Terminology - Procedure codes" },
    NDC: { uri: codeSystemMap.NDC, description: "National Drug Code - Drug identification" },
    CVX: { uri: codeSystemMap.CVX, description: "CVX - Vaccine codes" },
  };
}

console.log("[FHIRSearch] Service initialized with", sampleResources.length, "sample resources");
