import { generatePhiSafeText } from "./ai-gateway";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

const aiEnabled = true;

const NO_CDS_COHORT_PROMPT = `You are an AI-powered Patient Cohort Builder assistant. Your role is to:
1. Parse natural language queries to define patient cohorts
2. Identify demographic, diagnostic, and procedural criteria
3. Extract temporal and pattern-based filters
4. Generate structured cohort definitions

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT recommend specific medications, therapies, or clinical interventions
- You focus ONLY on COHORT DEFINITION, SELECTION, and DATA AGGREGATION

ALLOWED OPERATIONS (Non-Clinical):
- Patient demographic filtering (age, gender, location)
- Diagnosis/condition-based cohort selection (for research purposes only)
- Procedure-based filtering
- Medication-based filtering (presence only, no recommendations)
- Temporal filtering (date ranges, encounter timing)
- Pattern-based cohort building (journey patterns)
- Aggregate statistics and visualizations

PROHIBITED OPERATIONS (Clinical - NEVER PROVIDE):
- Treatment effectiveness assessments
- Clinical outcome predictions for individual patients
- Medication-related recommendations
- Diagnostic interpretations or suggestions`;

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({
    type: "HIPAA_AUDIT",
    timestamp: new Date().toISOString(),
    component: "AIPatientCohortBuilder",
    action,
    details: {
      ...details,
      patientId: details.patientId ? hashIdentifier(String(details.patientId)) : undefined,
      cohortId: details.cohortId ? hashIdentifier(String(details.cohortId)) : undefined,
    },
  }));
}

const CDS_PROHIBITED_PATTERNS = [
  /\b(prescribe|should take|must take|need to take)\b/i,
  /\b(recommend|suggest|advise) (taking|starting|stopping|changing|adjusting|prescribing)\b/i,
  /\b(clinical trial|clinical study|clinical indication)\b/i,
  /\b(increase|decrease|adjust|modify) (medication|treatment|therapy|dosage)\b/i,
  /\b(consult|refer to) (specialist|physician|doctor|oncologist|cardiologist)\b/i,
  /\b(start|stop|discontinue) (medication|treatment|therapy)\b/i,
  /\byou should\b.*\b(take|see|visit|consult)\b/i,
  /\btreatment (plan|recommendation|suggestion)\b/i,
];

function enforceCdsCompliance(text: string): { compliant: boolean; sanitized: string; violations: string[] } {
  const violations: string[] = [];
  let sanitized = text;

  CDS_PROHIBITED_PATTERNS.forEach((pattern) => {
    if (pattern.test(text)) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push(`CDS violation detected: "${matches[0]}"`);
        sanitized = sanitized.replace(new RegExp(pattern.source, "gi"), "[cohort criteria]");
      }
    }
  });

  const compliant = violations.length === 0;
  if (!compliant) {
    console.log(JSON.stringify({
      type: "CDS_GUARDRAIL_VIOLATION",
      timestamp: new Date().toISOString(),
      component: "AIPatientCohortBuilder",
      violations,
      action: "CONTENT_SANITIZED",
    }));
  }

  return { compliant, sanitized, violations };
}

function sanitizeStringArray(arr: string[]): string[] {
  return arr.map(item => {
    const result = enforceCdsCompliance(item);
    return result.compliant ? item : result.sanitized;
  }).filter(item => item.trim().length > 0);
}

export type CriteriaType = "demographic" | "diagnosis" | "procedure" | "medication" | "lab_result" | "encounter" | "journey_pattern" | "temporal";
export type CriteriaOperator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "between" | "in" | "not_in" | "exists" | "not_exists";
export type LogicalOperator = "AND" | "OR" | "NOT";

export interface CohortCriterion {
  id: string;
  type: CriteriaType;
  field: string;
  operator: CriteriaOperator;
  value: unknown;
  secondaryValue?: unknown;
  label: string;
  codeSystem?: string;
  code?: string;
}

export interface CriteriaGroup {
  id: string;
  operator: LogicalOperator;
  criteria: (CohortCriterion | CriteriaGroup)[];
}

export interface CohortDefinition {
  id: string;
  name: string;
  description: string;
  naturalLanguageQuery: string;
  criteria: CriteriaGroup;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: "draft" | "active" | "archived";
  patientCount?: number;
  lastExecutedAt?: string;
}

export interface PatientMatch {
  patientId: string;
  patientName: string;
  matchScore: number;
  matchedCriteria: string[];
  demographics: {
    age: number;
    gender: string;
    location?: string;
  };
  conditions: string[];
  medications: string[];
  procedures: string[];
  lastEncounter?: string;
}

export interface CohortCharacteristics {
  demographics: {
    ageDistribution: Array<{ range: string; count: number; percentage: number }>;
    genderDistribution: Array<{ gender: string; count: number; percentage: number }>;
    locationDistribution: Array<{ location: string; count: number; percentage: number }>;
  };
  conditions: Array<{ condition: string; count: number; percentage: number }>;
  medications: Array<{ medication: string; count: number; percentage: number }>;
  procedures: Array<{ procedure: string; count: number; percentage: number }>;
  encounters: {
    totalEncounters: number;
    averageEncountersPerPatient: number;
    encounterTypeDistribution: Array<{ type: string; count: number }>;
  };
  journeyPatterns: Array<{ pattern: string; count: number; description: string }>;
}

export interface CohortExport {
  format: "csv" | "json" | "fhir_bundle";
  includeFields: string[];
  deIdentified: boolean;
  exportedAt: string;
  patientCount: number;
  data: unknown;
}

export interface ParsedQuery {
  criteria: CriteriaGroup;
  suggestedName: string;
  description: string;
  confidence: number;
  interpretation: string;
}

const cohortStore = new Map<string, CohortDefinition>();
const cohortResultsCache = new Map<string, PatientMatch[]>();

const samplePatients: PatientMatch[] = [
  {
    patientId: "patient-001",
    patientName: "John Smith",
    matchScore: 0.95,
    matchedCriteria: ["age_65_plus", "diabetes", "hypertension"],
    demographics: { age: 72, gender: "male", location: "Boston, MA" },
    conditions: ["Type 2 Diabetes", "Essential Hypertension", "Hyperlipidemia"],
    medications: ["Metformin", "Lisinopril", "Atorvastatin"],
    procedures: ["HbA1c Test", "Lipid Panel", "Blood Pressure Monitoring"],
    lastEncounter: "2025-01-10",
  },
  {
    patientId: "patient-002",
    patientName: "Mary Johnson",
    matchScore: 0.88,
    matchedCriteria: ["age_65_plus", "diabetes"],
    demographics: { age: 68, gender: "female", location: "Cambridge, MA" },
    conditions: ["Type 2 Diabetes", "Osteoarthritis"],
    medications: ["Metformin", "Acetaminophen"],
    procedures: ["HbA1c Test", "Joint X-ray"],
    lastEncounter: "2025-01-08",
  },
  {
    patientId: "patient-003",
    patientName: "Robert Williams",
    matchScore: 0.82,
    matchedCriteria: ["age_65_plus", "hypertension"],
    demographics: { age: 75, gender: "male", location: "Newton, MA" },
    conditions: ["Essential Hypertension", "Chronic Kidney Disease Stage 3"],
    medications: ["Amlodipine", "Losartan"],
    procedures: ["eGFR Test", "Urinalysis", "Blood Pressure Monitoring"],
    lastEncounter: "2025-01-12",
  },
  {
    patientId: "patient-004",
    patientName: "Patricia Brown",
    matchScore: 0.78,
    matchedCriteria: ["female", "age_50_64"],
    demographics: { age: 58, gender: "female", location: "Somerville, MA" },
    conditions: ["Breast Cancer Survivor", "Anxiety"],
    medications: ["Tamoxifen", "Sertraline"],
    procedures: ["Mammogram", "Mental Health Screening"],
    lastEncounter: "2025-01-05",
  },
  {
    patientId: "patient-005",
    patientName: "James Davis",
    matchScore: 0.75,
    matchedCriteria: ["male", "cardiac_condition"],
    demographics: { age: 62, gender: "male", location: "Brookline, MA" },
    conditions: ["Coronary Artery Disease", "Atrial Fibrillation"],
    medications: ["Aspirin", "Warfarin", "Metoprolol"],
    procedures: ["ECG", "Echocardiogram", "Cardiac Catheterization"],
    lastEncounter: "2025-01-14",
  },
  {
    patientId: "patient-006",
    patientName: "Linda Miller",
    matchScore: 0.72,
    matchedCriteria: ["age_65_plus", "respiratory"],
    demographics: { age: 70, gender: "female", location: "Quincy, MA" },
    conditions: ["COPD", "Asthma"],
    medications: ["Albuterol", "Fluticasone", "Tiotropium"],
    procedures: ["Pulmonary Function Test", "Chest X-ray"],
    lastEncounter: "2025-01-11",
  },
  {
    patientId: "patient-007",
    patientName: "Michael Garcia",
    matchScore: 0.70,
    matchedCriteria: ["age_40_64", "metabolic"],
    demographics: { age: 45, gender: "male", location: "Medford, MA" },
    conditions: ["Obesity", "Prediabetes", "Sleep Apnea"],
    medications: ["CPAP Therapy"],
    procedures: ["Sleep Study", "Glucose Tolerance Test"],
    lastEncounter: "2025-01-03",
  },
  {
    patientId: "patient-008",
    patientName: "Elizabeth Martinez",
    matchScore: 0.68,
    matchedCriteria: ["female", "autoimmune"],
    demographics: { age: 42, gender: "female", location: "Arlington, MA" },
    conditions: ["Rheumatoid Arthritis", "Hashimoto's Thyroiditis"],
    medications: ["Methotrexate", "Levothyroxine"],
    procedures: ["Joint Ultrasound", "Thyroid Function Test"],
    lastEncounter: "2025-01-09",
  },
];

export async function parseNaturalLanguageQuery(query: string): Promise<ParsedQuery> {
  logHipaaAudit("QUERY_PARSED", { queryLength: query.length });

  if (aiEnabled) {
    try {
      const content = await generatePhiSafeText({
        system: NO_CDS_COHORT_PROMPT,
        responseMimeType: "application/json",
        user: `Parse the following natural language query into structured cohort criteria. Return a JSON object with:
- criteria: a structured criteria group
- suggestedName: a short name for the cohort
- description: a description of what the cohort represents
- interpretation: explain how you interpreted the query

Query: "${query}"

Return valid JSON only.`,
      });

      if (content) {
        const parsed = JSON.parse(content);
        const sanitizedName = enforceCdsCompliance(parsed.suggestedName || "Custom Cohort").sanitized;
        const sanitizedDescription = enforceCdsCompliance(parsed.description || "").sanitized;
        const sanitizedInterpretation = enforceCdsCompliance(parsed.interpretation || "").sanitized;
        
        return {
          criteria: sanitizeCriteriaGroup(parsed.criteria || buildDefaultCriteria(query)),
          suggestedName: sanitizedName,
          description: sanitizedDescription,
          confidence: 0.85,
          interpretation: sanitizedInterpretation,
        };
      }
    } catch (error) {
      console.error("[AIPatientCohortBuilder] OpenAI query parsing failed:", error);
    }
  }

  return buildFallbackParsedQuery(query);
}

function buildDefaultCriteria(query: string): CriteriaGroup {
  const criteria: CohortCriterion[] = [];
  const queryLower = query.toLowerCase();

  if (queryLower.includes("65") || queryLower.includes("elderly") || queryLower.includes("senior")) {
    criteria.push({
      id: randomUUID(),
      type: "demographic",
      field: "age",
      operator: "greater_than",
      value: 65,
      label: "Age > 65",
    });
  }

  if (queryLower.includes("diabetes") || queryLower.includes("diabetic")) {
    criteria.push({
      id: randomUUID(),
      type: "diagnosis",
      field: "condition",
      operator: "contains",
      value: "diabetes",
      label: "Diabetes diagnosis",
      codeSystem: "ICD-10",
      code: "E11",
    });
  }

  if (queryLower.includes("hypertension") || queryLower.includes("high blood pressure")) {
    criteria.push({
      id: randomUUID(),
      type: "diagnosis",
      field: "condition",
      operator: "contains",
      value: "hypertension",
      label: "Hypertension diagnosis",
      codeSystem: "ICD-10",
      code: "I10",
    });
  }

  if (queryLower.includes("male")) {
    criteria.push({
      id: randomUUID(),
      type: "demographic",
      field: "gender",
      operator: "equals",
      value: "male",
      label: "Gender: Male",
    });
  }

  if (queryLower.includes("female")) {
    criteria.push({
      id: randomUUID(),
      type: "demographic",
      field: "gender",
      operator: "equals",
      value: "female",
      label: "Gender: Female",
    });
  }

  if (queryLower.includes("cardiac") || queryLower.includes("heart")) {
    criteria.push({
      id: randomUUID(),
      type: "diagnosis",
      field: "condition",
      operator: "contains",
      value: "cardiac",
      label: "Cardiac condition",
      codeSystem: "ICD-10",
      code: "I25",
    });
  }

  if (queryLower.includes("last year") || queryLower.includes("past 12 months")) {
    criteria.push({
      id: randomUUID(),
      type: "temporal",
      field: "lastEncounter",
      operator: "greater_than",
      value: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      label: "Encounter in last 12 months",
    });
  }

  if (criteria.length === 0) {
    criteria.push({
      id: randomUUID(),
      type: "demographic",
      field: "age",
      operator: "greater_than",
      value: 18,
      label: "Adult patients (18+)",
    });
  }

  return {
    id: randomUUID(),
    operator: "AND",
    criteria,
  };
}

function buildFallbackParsedQuery(query: string): ParsedQuery {
  const criteria = sanitizeCriteriaGroup(buildDefaultCriteria(query));
  
  let suggestedName = "Custom Patient Cohort";
  if (query.toLowerCase().includes("diabetes")) suggestedName = "Diabetes Cohort";
  if (query.toLowerCase().includes("cardiac")) suggestedName = "Cardiac Cohort";
  if (query.toLowerCase().includes("elderly") || query.toLowerCase().includes("65")) suggestedName = "Senior Patients Cohort";

  const sanitizedName = enforceCdsCompliance(suggestedName).sanitized;
  const sanitizedDesc = enforceCdsCompliance(`Cohort based on: ${query}`).sanitized;
  const sanitizedInterp = enforceCdsCompliance(`Extracted ${criteria.criteria.length} criteria from the query. Keywords detected: ${extractKeywords(query).join(", ")}`).sanitized;

  return {
    criteria,
    suggestedName: sanitizedName,
    description: sanitizedDesc,
    confidence: 0.65,
    interpretation: sanitizedInterp,
  };
}

function sanitizeCriteriaGroup(group: CriteriaGroup): CriteriaGroup {
  return {
    ...group,
    criteria: group.criteria.map(item => {
      if ("operator" in item && "criteria" in item) {
        return sanitizeCriteriaGroup(item as CriteriaGroup);
      }
      const criterion = item as CohortCriterion;
      return {
        ...criterion,
        label: enforceCdsCompliance(criterion.label).sanitized,
      };
    }),
  };
}

function extractKeywords(query: string): string[] {
  const keywords: string[] = [];
  const queryLower = query.toLowerCase();
  
  if (queryLower.includes("diabetes")) keywords.push("diabetes");
  if (queryLower.includes("hypertension")) keywords.push("hypertension");
  if (queryLower.includes("cardiac") || queryLower.includes("heart")) keywords.push("cardiac");
  if (queryLower.includes("elderly") || queryLower.includes("senior") || queryLower.includes("65")) keywords.push("elderly");
  if (queryLower.includes("male")) keywords.push("male");
  if (queryLower.includes("female")) keywords.push("female");
  if (queryLower.includes("respiratory") || queryLower.includes("copd")) keywords.push("respiratory");
  
  return keywords.length > 0 ? keywords : ["general"];
}

export async function createCohort(
  name: string,
  description: string,
  naturalLanguageQuery: string,
  criteria: CriteriaGroup,
  userId: string
): Promise<CohortDefinition> {
  const sanitizedDescription = enforceCdsCompliance(description).sanitized;
  const sanitizedName = enforceCdsCompliance(name).sanitized;
  
  const cohort: CohortDefinition = {
    id: `cohort-${randomUUID()}`,
    name: sanitizedName,
    description: sanitizedDescription,
    naturalLanguageQuery,
    criteria,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
    status: "active",
  };

  cohortStore.set(cohort.id, cohort);

  logHipaaAudit("COHORT_CREATED", {
    cohortId: cohort.id,
    cohortName: name,
    criteriaCount: countCriteria(criteria),
    userId,
  });

  return cohort;
}

function countCriteria(group: CriteriaGroup): number {
  let count = 0;
  for (const item of group.criteria) {
    if ("operator" in item && "criteria" in item) {
      count += countCriteria(item as CriteriaGroup);
    } else {
      count++;
    }
  }
  return count;
}

export async function executeCohort(cohortId: string): Promise<PatientMatch[]> {
  const cohort = cohortStore.get(cohortId);
  if (!cohort) {
    throw new Error(`Cohort not found: ${cohortId}`);
  }

  const matches = filterPatients(cohort.criteria);
  
  cohort.patientCount = matches.length;
  cohort.lastExecutedAt = new Date().toISOString();
  cohort.updatedAt = new Date().toISOString();
  cohortStore.set(cohortId, cohort);

  cohortResultsCache.set(cohortId, matches);

  logHipaaAudit("COHORT_EXECUTED", {
    cohortId,
    matchCount: matches.length,
  });

  return matches;
}

function filterPatients(criteria: CriteriaGroup): PatientMatch[] {
  return samplePatients.filter(patient => evaluateCriteriaGroup(patient, criteria))
    .sort((a, b) => b.matchScore - a.matchScore);
}

function evaluateCriteriaGroup(patient: PatientMatch, group: CriteriaGroup): boolean {
  if (group.criteria.length === 0) return true;

  const results = group.criteria.map(item => {
    if ("operator" in item && "criteria" in item) {
      return evaluateCriteriaGroup(patient, item as CriteriaGroup);
    } else {
      return evaluateCriterion(patient, item as CohortCriterion);
    }
  });

  if (group.operator === "AND") {
    return results.every(r => r);
  } else if (group.operator === "OR") {
    return results.some(r => r);
  } else if (group.operator === "NOT") {
    return !results[0];
  }

  return false;
}

function evaluateCriterion(patient: PatientMatch, criterion: CohortCriterion): boolean {
  switch (criterion.type) {
    case "demographic":
      if (criterion.field === "age") {
        const age = patient.demographics.age;
        if (criterion.operator === "greater_than") return age > Number(criterion.value);
        if (criterion.operator === "less_than") return age < Number(criterion.value);
        if (criterion.operator === "equals") return age === Number(criterion.value);
        if (criterion.operator === "between") return age >= Number(criterion.value) && age <= Number(criterion.secondaryValue);
      }
      if (criterion.field === "gender") {
        return patient.demographics.gender.toLowerCase() === String(criterion.value).toLowerCase();
      }
      if (criterion.field === "location") {
        return patient.demographics.location?.toLowerCase().includes(String(criterion.value).toLowerCase()) ?? false;
      }
      break;

    case "diagnosis":
      const conditionValue = String(criterion.value).toLowerCase();
      return patient.conditions.some(c => c.toLowerCase().includes(conditionValue));

    case "procedure":
      const procedureValue = String(criterion.value).toLowerCase();
      return patient.procedures.some(p => p.toLowerCase().includes(procedureValue));

    case "medication":
      const medValue = String(criterion.value).toLowerCase();
      return patient.medications.some(m => m.toLowerCase().includes(medValue));

    case "temporal":
      if (criterion.field === "lastEncounter" && patient.lastEncounter) {
        const encounterDate = new Date(patient.lastEncounter);
        const criterionDate = new Date(String(criterion.value));
        if (criterion.operator === "greater_than") return encounterDate > criterionDate;
        if (criterion.operator === "less_than") return encounterDate < criterionDate;
      }
      break;

    case "journey_pattern":
      return patient.matchedCriteria.some(c => c.toLowerCase().includes(String(criterion.value).toLowerCase()));
  }

  return true;
}

export function getCohortCharacteristics(cohortId: string): CohortCharacteristics | null {
  const matches = cohortResultsCache.get(cohortId);
  if (!matches || matches.length === 0) return null;

  const total = matches.length;

  const ageRanges = [
    { range: "18-39", min: 18, max: 39, count: 0 },
    { range: "40-54", min: 40, max: 54, count: 0 },
    { range: "55-64", min: 55, max: 64, count: 0 },
    { range: "65-74", min: 65, max: 74, count: 0 },
    { range: "75+", min: 75, max: 200, count: 0 },
  ];

  matches.forEach(p => {
    const age = p.demographics.age;
    const range = ageRanges.find(r => age >= r.min && age <= r.max);
    if (range) range.count++;
  });

  const genderCounts: Record<string, number> = {};
  matches.forEach(p => {
    genderCounts[p.demographics.gender] = (genderCounts[p.demographics.gender] || 0) + 1;
  });

  const locationCounts: Record<string, number> = {};
  matches.forEach(p => {
    if (p.demographics.location) {
      locationCounts[p.demographics.location] = (locationCounts[p.demographics.location] || 0) + 1;
    }
  });

  const conditionCounts: Record<string, number> = {};
  matches.forEach(p => {
    p.conditions.forEach(c => {
      conditionCounts[c] = (conditionCounts[c] || 0) + 1;
    });
  });

  const medicationCounts: Record<string, number> = {};
  matches.forEach(p => {
    p.medications.forEach(m => {
      medicationCounts[m] = (medicationCounts[m] || 0) + 1;
    });
  });

  const procedureCounts: Record<string, number> = {};
  matches.forEach(p => {
    p.procedures.forEach(pr => {
      procedureCounts[pr] = (procedureCounts[pr] || 0) + 1;
    });
  });

  logHipaaAudit("COHORT_CHARACTERISTICS_ACCESSED", { cohortId, patientCount: total });

  return {
    demographics: {
      ageDistribution: ageRanges.map(r => ({
        range: r.range,
        count: r.count,
        percentage: Math.round((r.count / total) * 100),
      })),
      genderDistribution: Object.entries(genderCounts).map(([gender, count]) => ({
        gender,
        count,
        percentage: Math.round((count / total) * 100),
      })),
      locationDistribution: Object.entries(locationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([location, count]) => ({
          location,
          count,
          percentage: Math.round((count / total) * 100),
        })),
    },
    conditions: Object.entries(conditionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([condition, count]) => ({
        condition,
        count,
        percentage: Math.round((count / total) * 100),
      })),
    medications: Object.entries(medicationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([medication, count]) => ({
        medication,
        count,
        percentage: Math.round((count / total) * 100),
      })),
    procedures: Object.entries(procedureCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([procedure, count]) => ({
        procedure,
        count,
        percentage: Math.round((count / total) * 100),
      })),
    encounters: {
      totalEncounters: matches.length * 3,
      averageEncountersPerPatient: 3,
      encounterTypeDistribution: [
        { type: "Office Visit", count: Math.round(total * 1.5) },
        { type: "Lab Test", count: Math.round(total * 0.8) },
        { type: "Procedure", count: Math.round(total * 0.4) },
        { type: "Follow-up", count: Math.round(total * 0.3) },
      ],
    },
    journeyPatterns: [
      { pattern: "chronic_management", count: Math.round(total * 0.6), description: "Chronic disease management pathway" },
      { pattern: "preventive_care", count: Math.round(total * 0.3), description: "Preventive screening pathway" },
      { pattern: "acute_episode", count: Math.round(total * 0.1), description: "Acute care episode" },
    ],
  };
}

export function exportCohort(
  cohortId: string,
  format: "csv" | "json" | "fhir_bundle",
  includeFields: string[],
  deIdentified: boolean
): CohortExport | null {
  const matches = cohortResultsCache.get(cohortId);
  if (!matches) return null;

  logHipaaAudit("COHORT_EXPORTED", {
    cohortId,
    format,
    patientCount: matches.length,
    deIdentified,
    fieldsIncluded: includeFields,
  });

  let data: unknown;

  if (format === "csv") {
    const headers = includeFields.length > 0 ? includeFields : ["patientId", "age", "gender", "conditions", "medications"];
    const rows = matches.map(p => {
      const row: Record<string, string> = {};
      if (headers.includes("patientId")) row.patientId = deIdentified ? hashIdentifier(p.patientId) : p.patientId;
      if (headers.includes("patientName")) row.patientName = deIdentified ? "REDACTED" : p.patientName;
      if (headers.includes("age")) row.age = String(p.demographics.age);
      if (headers.includes("gender")) row.gender = p.demographics.gender;
      if (headers.includes("location")) row.location = deIdentified ? "REDACTED" : (p.demographics.location || "");
      if (headers.includes("conditions")) row.conditions = p.conditions.join("; ");
      if (headers.includes("medications")) row.medications = p.medications.join("; ");
      if (headers.includes("procedures")) row.procedures = p.procedures.join("; ");
      if (headers.includes("matchScore")) row.matchScore = String(p.matchScore);
      return row;
    });

    const csvHeader = Object.keys(rows[0] || {}).join(",");
    const csvRows = rows.map(r => Object.values(r).map(v => `"${v}"`).join(","));
    data = [csvHeader, ...csvRows].join("\n");
  } else if (format === "json") {
    data = matches.map(p => {
      const entry: Record<string, unknown> = {};
      if (includeFields.length === 0 || includeFields.includes("patientId")) {
        entry.patientId = deIdentified ? hashIdentifier(p.patientId) : p.patientId;
      }
      if (includeFields.length === 0 || includeFields.includes("patientName")) {
        entry.patientName = deIdentified ? "REDACTED" : p.patientName;
      }
      if (includeFields.length === 0 || includeFields.includes("demographics")) {
        entry.demographics = deIdentified
          ? { age: p.demographics.age, gender: p.demographics.gender }
          : p.demographics;
      }
      if (includeFields.length === 0 || includeFields.includes("conditions")) entry.conditions = p.conditions;
      if (includeFields.length === 0 || includeFields.includes("medications")) entry.medications = p.medications;
      if (includeFields.length === 0 || includeFields.includes("procedures")) entry.procedures = p.procedures;
      if (includeFields.length === 0 || includeFields.includes("matchScore")) entry.matchScore = p.matchScore;
      return entry;
    });
  } else if (format === "fhir_bundle") {
    data = {
      resourceType: "Bundle",
      type: "searchset",
      total: matches.length,
      entry: matches.map(p => ({
        resource: {
          resourceType: "Patient",
          id: deIdentified ? hashIdentifier(p.patientId) : p.patientId,
          name: deIdentified ? [{ text: "REDACTED" }] : [{ text: p.patientName }],
          gender: p.demographics.gender.toLowerCase(),
          birthDate: calculateBirthDate(p.demographics.age),
          address: deIdentified ? [] : [{ city: p.demographics.location?.split(",")[0], state: p.demographics.location?.split(",")[1]?.trim() }],
        },
      })),
    };
  }

  return {
    format,
    includeFields,
    deIdentified,
    exportedAt: new Date().toISOString(),
    patientCount: matches.length,
    data,
  };
}

function calculateBirthDate(age: number): string {
  const now = new Date();
  const birthYear = now.getFullYear() - age;
  return `${birthYear}-01-01`;
}

export function getCohort(cohortId: string): CohortDefinition | undefined {
  return cohortStore.get(cohortId);
}

export function getAllCohorts(): CohortDefinition[] {
  return Array.from(cohortStore.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function updateCohort(
  cohortId: string,
  updates: Partial<Pick<CohortDefinition, "name" | "description" | "criteria" | "status">>
): CohortDefinition | null {
  const cohort = cohortStore.get(cohortId);
  if (!cohort) return null;

  if (updates.description) {
    updates.description = enforceCdsCompliance(updates.description).sanitized;
  }
  if (updates.name) {
    updates.name = enforceCdsCompliance(updates.name).sanitized;
  }

  const updated: CohortDefinition = {
    ...cohort,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  cohortStore.set(cohortId, updated);

  logHipaaAudit("COHORT_UPDATED", { cohortId, updatedFields: Object.keys(updates) });

  return updated;
}

export function deleteCohort(cohortId: string): boolean {
  const exists = cohortStore.has(cohortId);
  if (exists) {
    cohortStore.delete(cohortId);
    cohortResultsCache.delete(cohortId);
    logHipaaAudit("COHORT_DELETED", { cohortId });
  }
  return exists;
}

export function getCohortResults(cohortId: string): PatientMatch[] | null {
  return cohortResultsCache.get(cohortId) || null;
}

export async function suggestCohortRefinements(cohortId: string): Promise<string[]> {
  const cohort = cohortStore.get(cohortId);
  const matches = cohortResultsCache.get(cohortId);
  
  if (!cohort || !matches) return [];

  const suggestions: string[] = [];

  if (matches.length < 5) {
    suggestions.push("Consider broadening criteria to include more patients");
  }

  if (matches.length > 100) {
    suggestions.push("Consider adding more specific criteria to narrow the cohort");
  }

  const avgScore = matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length;
  if (avgScore < 0.7) {
    suggestions.push("Some patients have low match scores. Review criteria for alignment with research goals");
  }

  if (countCriteria(cohort.criteria) < 3) {
    suggestions.push("Add demographic or temporal criteria for more precise cohort definition");
  }

  logHipaaAudit("REFINEMENTS_SUGGESTED", { cohortId, suggestionCount: suggestions.length });

  return sanitizeStringArray(suggestions);
}

function initializeSampleCohorts(): void {
  const sampleCohort: CohortDefinition = {
    id: "cohort-sample-diabetes-seniors",
    name: "Senior Diabetic Patients",
    description: "Patients aged 65 and older with Type 2 Diabetes for chronic care management research",
    naturalLanguageQuery: "Patients over 65 with diabetes",
    criteria: {
      id: "group-1",
      operator: "AND",
      criteria: [
        {
          id: "crit-age",
          type: "demographic",
          field: "age",
          operator: "greater_than",
          value: 65,
          label: "Age > 65",
        },
        {
          id: "crit-diabetes",
          type: "diagnosis",
          field: "condition",
          operator: "contains",
          value: "diabetes",
          label: "Diabetes diagnosis",
          codeSystem: "ICD-10",
          code: "E11",
        },
      ],
    },
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "system",
    status: "active",
    patientCount: 3,
    lastExecutedAt: new Date().toISOString(),
  };

  cohortStore.set(sampleCohort.id, sampleCohort);
  cohortResultsCache.set(sampleCohort.id, samplePatients.filter(p => 
    p.demographics.age > 65 && p.conditions.some(c => c.toLowerCase().includes("diabetes"))
  ));

  console.log("[AIPatientCohortBuilder] Sample cohort initialized");
}

initializeSampleCohorts();
console.log("[AIPatientCohortBuilder] Service initialized");
