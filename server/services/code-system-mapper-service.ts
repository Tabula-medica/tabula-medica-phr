import { getAuditLogger } from "./integrations/factory";

export type CodeSystemType = "SNOMED_CT" | "LOINC" | "ICD10_CM" | "RXNORM";

export interface CodeMapping {
  id: string;
  sourceSystem: CodeSystemType;
  sourceCode: string;
  sourceDisplay: string;
  targetSystem: CodeSystemType;
  targetCode: string;
  targetDisplay: string;
  equivalence: "equivalent" | "equal" | "wider" | "narrower" | "inexact" | "unmatched";
  comments?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CodeLookupResult {
  system: CodeSystemType;
  code: string;
  display: string;
  definition?: string;
  synonyms?: string[];
  parentCodes?: string[];
  childCodes?: string[];
  properties?: Record<string, string>;
}

export interface TranslationRequest {
  sourceSystem: CodeSystemType;
  sourceCode: string;
  targetSystem: CodeSystemType;
}

export interface TranslationResult {
  sourceSystem: CodeSystemType;
  sourceCode: string;
  sourceDisplay: string;
  targetSystem: CodeSystemType;
  mappings: Array<{
    code: string;
    display: string;
    equivalence: string;
    verified: boolean;
  }>;
  translatedAt: string;
}

export interface CodeSystemInfo {
  id: CodeSystemType;
  name: string;
  version: string;
  description: string;
  url: string;
  totalCodes: number;
}

const codeMappings = new Map<string, CodeMapping>();
const codeSystemCache = new Map<string, CodeLookupResult>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const CODE_SYSTEM_INFO: Record<CodeSystemType, CodeSystemInfo> = {
  SNOMED_CT: {
    id: "SNOMED_CT",
    name: "SNOMED Clinical Terms",
    version: "2024-03-01",
    description: "Systematized Nomenclature of Medicine - Clinical Terms",
    url: "http://snomed.info/sct",
    totalCodes: 350000,
  },
  LOINC: {
    id: "LOINC",
    name: "Logical Observation Identifiers Names and Codes",
    version: "2.77",
    description: "Universal standard for identifying medical laboratory observations",
    url: "http://loinc.org",
    totalCodes: 99000,
  },
  ICD10_CM: {
    id: "ICD10_CM",
    name: "ICD-10-CM",
    version: "2024",
    description: "International Classification of Diseases, 10th Revision, Clinical Modification",
    url: "http://hl7.org/fhir/sid/icd-10-cm",
    totalCodes: 72000,
  },
  RXNORM: {
    id: "RXNORM",
    name: "RxNorm",
    version: "2024-03",
    description: "Normalized names for clinical drugs and dose form",
    url: "http://www.nlm.nih.gov/research/umls/rxnorm",
    totalCodes: 115000,
  },
};

const sampleMappings: CodeMapping[] = [
  {
    id: "map-001",
    sourceSystem: "SNOMED_CT",
    sourceCode: "44054006",
    sourceDisplay: "Type 2 Diabetes Mellitus",
    targetSystem: "ICD10_CM",
    targetCode: "E11.9",
    targetDisplay: "Type 2 diabetes mellitus without complications",
    equivalence: "equivalent",
    verified: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "map-002",
    sourceSystem: "SNOMED_CT",
    sourceCode: "73211009",
    sourceDisplay: "Diabetes mellitus",
    targetSystem: "ICD10_CM",
    targetCode: "E11",
    targetDisplay: "Type 2 diabetes mellitus",
    equivalence: "wider",
    verified: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "map-003",
    sourceSystem: "LOINC",
    sourceCode: "4548-4",
    sourceDisplay: "Hemoglobin A1c/Hemoglobin.total in Blood",
    targetSystem: "SNOMED_CT",
    targetCode: "43396009",
    targetDisplay: "Hemoglobin A1c measurement",
    equivalence: "equivalent",
    verified: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "map-004",
    sourceSystem: "RXNORM",
    sourceCode: "860975",
    sourceDisplay: "Metformin 500 MG Oral Tablet",
    targetSystem: "SNOMED_CT",
    targetCode: "109081006",
    targetDisplay: "Metformin",
    equivalence: "wider",
    verified: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "map-005",
    sourceSystem: "SNOMED_CT",
    sourceCode: "38341003",
    sourceDisplay: "Hypertensive disorder",
    targetSystem: "ICD10_CM",
    targetCode: "I10",
    targetDisplay: "Essential (primary) hypertension",
    equivalence: "equivalent",
    verified: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "map-006",
    sourceSystem: "ICD10_CM",
    sourceCode: "I10",
    sourceDisplay: "Essential (primary) hypertension",
    targetSystem: "SNOMED_CT",
    targetCode: "59621000",
    targetDisplay: "Essential hypertension",
    equivalence: "equivalent",
    verified: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "map-007",
    sourceSystem: "LOINC",
    sourceCode: "2345-7",
    sourceDisplay: "Glucose [Mass/volume] in Serum or Plasma",
    targetSystem: "SNOMED_CT",
    targetCode: "33747003",
    targetDisplay: "Glucose measurement",
    equivalence: "equivalent",
    verified: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "map-008",
    sourceSystem: "RXNORM",
    sourceCode: "197361",
    sourceDisplay: "Lisinopril 10 MG Oral Tablet",
    targetSystem: "SNOMED_CT",
    targetCode: "386873009",
    targetDisplay: "Lisinopril",
    equivalence: "wider",
    verified: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const sampleCodeLookups: CodeLookupResult[] = [
  {
    system: "SNOMED_CT",
    code: "44054006",
    display: "Type 2 Diabetes Mellitus",
    definition: "A type of diabetes mellitus that is characterized by insulin resistance or reduced insulin sensitivity.",
    synonyms: ["Type 2 DM", "Non-insulin-dependent diabetes mellitus", "NIDDM", "Adult-onset diabetes"],
    parentCodes: ["73211009"],
    childCodes: ["314902007", "314903002"],
    properties: { status: "active", effectiveTime: "2002-01-31" },
  },
  {
    system: "SNOMED_CT",
    code: "38341003",
    display: "Hypertensive disorder",
    definition: "A disorder characterized by elevated blood pressure.",
    synonyms: ["Hypertension", "High blood pressure", "HTN"],
    parentCodes: ["49601007"],
    childCodes: ["59621000", "70272006"],
    properties: { status: "active", effectiveTime: "2002-01-31" },
  },
  {
    system: "LOINC",
    code: "4548-4",
    display: "Hemoglobin A1c/Hemoglobin.total in Blood",
    definition: "Hemoglobin A1c as a percentage of total hemoglobin in blood.",
    synonyms: ["HbA1c", "Glycated hemoglobin", "A1c"],
    properties: { component: "Hemoglobin A1c/Hemoglobin.total", property: "MFr", timing: "Pt", system: "Bld", scale: "Qn" },
  },
  {
    system: "LOINC",
    code: "2345-7",
    display: "Glucose [Mass/volume] in Serum or Plasma",
    definition: "Glucose concentration in serum or plasma measured as mass per volume.",
    synonyms: ["Blood glucose", "Serum glucose", "Plasma glucose"],
    properties: { component: "Glucose", property: "MCnc", timing: "Pt", system: "Ser/Plas", scale: "Qn" },
  },
  {
    system: "ICD10_CM",
    code: "E11.9",
    display: "Type 2 diabetes mellitus without complications",
    definition: "Type 2 diabetes mellitus without documented complications.",
    synonyms: ["Uncomplicated type 2 diabetes", "Type 2 DM NOS"],
    parentCodes: ["E11"],
    properties: { category: "E11", chapter: "IV" },
  },
  {
    system: "ICD10_CM",
    code: "I10",
    display: "Essential (primary) hypertension",
    definition: "Hypertension without known cause.",
    synonyms: ["Primary hypertension", "Essential hypertension", "High blood pressure NOS"],
    properties: { category: "I10-I16", chapter: "IX" },
  },
  {
    system: "RXNORM",
    code: "860975",
    display: "Metformin 500 MG Oral Tablet",
    definition: "An oral antidiabetic medication used to treat type 2 diabetes.",
    synonyms: ["Metformin hydrochloride 500mg tablet", "Glucophage 500mg"],
    properties: { tty: "SCD", rxcui: "860975", drugClass: "Biguanides" },
  },
  {
    system: "RXNORM",
    code: "197361",
    display: "Lisinopril 10 MG Oral Tablet",
    definition: "An ACE inhibitor used to treat hypertension and heart failure.",
    synonyms: ["Lisinopril 10mg tablet", "Prinivil 10mg", "Zestril 10mg"],
    properties: { tty: "SCD", rxcui: "197361", drugClass: "ACE Inhibitors" },
  },
];

function initializeSampleData(): void {
  sampleMappings.forEach((m) => codeMappings.set(m.id, m));
  sampleCodeLookups.forEach((c) => codeSystemCache.set(`${c.system}:${c.code}`, c));
}

initializeSampleData();

async function logCodeMappingAudit(
  action: string,
  sourceSystem: CodeSystemType,
  sourceCode: string,
  targetSystem: CodeSystemType | undefined,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: userId || "[SYSTEM]",
      userRole: "user",
      action: "search",
      resourceType: "CodeSystemMapping",
      resourceId: "[CODE-LOOKUP]",
      patientId: "[N/A]",
      ipAddress: ipAddress.includes(".") ? "[REDACTED-IP]" : ipAddress,
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/code-mapping",
      requestMethod: "GET",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: false,
      details: {
        action,
        sourceSystem,
        targetSystem: targetSystem || "any",
      },
    });
  } catch (e) {
    console.error("[CodeSystemMapper] Audit logging failed:", e);
  }
}

export function getCodeSystemInfo(): CodeSystemInfo[] {
  return Object.values(CODE_SYSTEM_INFO);
}

export function getCodeSystemById(id: CodeSystemType): CodeSystemInfo | undefined {
  return CODE_SYSTEM_INFO[id];
}

export async function lookupCode(
  system: CodeSystemType,
  code: string,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<CodeLookupResult | undefined> {
  const cacheKey = `${system}:${code}`;
  const result = codeSystemCache.get(cacheKey);

  await logCodeMappingAudit("lookup", system, code, undefined, userId, ipAddress, userAgent);

  return result;
}

export async function translateCode(
  request: TranslationRequest,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<TranslationResult> {
  const { sourceSystem, sourceCode, targetSystem } = request;

  await logCodeMappingAudit("translate", sourceSystem, sourceCode, targetSystem, userId, ipAddress, userAgent);

  const sourceLookup = codeSystemCache.get(`${sourceSystem}:${sourceCode}`);
  const sourceDisplay = sourceLookup?.display || sourceCode;

  const mappings = Array.from(codeMappings.values())
    .filter(
      (m) =>
        m.sourceSystem === sourceSystem &&
        m.sourceCode === sourceCode &&
        m.targetSystem === targetSystem
    )
    .map((m) => ({
      code: m.targetCode,
      display: m.targetDisplay,
      equivalence: m.equivalence,
      verified: m.verified,
    }));

  const reverseMappings = Array.from(codeMappings.values())
    .filter(
      (m) =>
        m.targetSystem === sourceSystem &&
        m.targetCode === sourceCode &&
        m.sourceSystem === targetSystem
    )
    .map((m) => ({
      code: m.sourceCode,
      display: m.sourceDisplay,
      equivalence: m.equivalence === "wider" ? "narrower" : m.equivalence === "narrower" ? "wider" : m.equivalence,
      verified: m.verified,
    }));

  return {
    sourceSystem,
    sourceCode,
    sourceDisplay,
    targetSystem,
    mappings: [...mappings, ...reverseMappings],
    translatedAt: new Date().toISOString(),
  };
}

export function getMappings(
  sourceSystem?: CodeSystemType,
  targetSystem?: CodeSystemType,
  limit = 50
): CodeMapping[] {
  let mappings = Array.from(codeMappings.values());

  if (sourceSystem) {
    mappings = mappings.filter((m) => m.sourceSystem === sourceSystem);
  }
  if (targetSystem) {
    mappings = mappings.filter((m) => m.targetSystem === targetSystem);
  }

  return mappings.slice(0, limit);
}

export async function addMapping(
  mapping: Omit<CodeMapping, "id" | "createdAt" | "updatedAt">,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<CodeMapping> {
  const id = generateId();
  const now = new Date().toISOString();

  const newMapping: CodeMapping = {
    ...mapping,
    id,
    createdAt: now,
    updatedAt: now,
  };

  codeMappings.set(id, newMapping);

  await logCodeMappingAudit(
    "add_mapping",
    mapping.sourceSystem,
    mapping.sourceCode,
    mapping.targetSystem,
    userId,
    ipAddress,
    userAgent
  );

  return newMapping;
}

export function searchCodes(
  system: CodeSystemType,
  query: string,
  limit = 20
): CodeLookupResult[] {
  const queryLower = query.toLowerCase();

  return Array.from(codeSystemCache.values())
    .filter(
      (c) =>
        c.system === system &&
        (c.code.toLowerCase().includes(queryLower) ||
          c.display.toLowerCase().includes(queryLower) ||
          c.synonyms?.some((s) => s.toLowerCase().includes(queryLower)))
    )
    .slice(0, limit);
}

export function getAllMappingsForCode(
  system: CodeSystemType,
  code: string
): { toOtherSystems: CodeMapping[]; fromOtherSystems: CodeMapping[] } {
  const toOtherSystems = Array.from(codeMappings.values()).filter(
    (m) => m.sourceSystem === system && m.sourceCode === code
  );

  const fromOtherSystems = Array.from(codeMappings.values()).filter(
    (m) => m.targetSystem === system && m.targetCode === code
  );

  return { toOtherSystems, fromOtherSystems };
}

console.log("[CodeSystemMapper] Service initialized with", codeMappings.size, "mappings and", codeSystemCache.size, "cached codes");
