import OpenAI from "openai";
import crypto from "crypto";

let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data integration assistant. You provide ONLY:
- Data quality summaries and metrics
- Security and access information
- Data completeness assessments
- Record provenance and source tracking

CRITICAL: You must NEVER provide:
- Clinical diagnoses or recommendations
- Treatment suggestions
- Medical advice of any kind
- Risk assessments that could influence clinical decisions

All outputs must include explicit NO-CDS disclaimers.`;

export interface PatientDataSource {
  id: string;
  sourceSystem: string;
  sourceType: "ehr" | "lab" | "pharmacy" | "claims" | "patient_reported" | "wearable";
  lastSyncTime: Date;
  recordCount: number;
  dataQualityScore: number;
  syncStatus: "active" | "stale" | "error" | "pending";
}

export interface PatientResource {
  resourceType: string;
  id: string;
  source: string;
  lastUpdated: Date;
  qualityScore: number;
  hasConflicts: boolean;
  conflictDetails?: string[];
}

export interface DataQualityMetrics {
  overallScore: number;
  completenessScore: number;
  consistencyScore: number;
  timelinessScore: number;
  accuracyScore: number;
  duplicateCount: number;
  conflictCount: number;
  missingFieldsCount: number;
  qualityTrend: "improving" | "stable" | "declining";
  lastAssessment: Date;
}

export interface SecurityPosture {
  accessLogCount: number;
  lastAccessTime: Date;
  authorizedUsers: number;
  pendingConsentRequests: number;
  dataBreachRisk: "low" | "medium" | "high";
  encryptionStatus: "encrypted" | "partial" | "unencrypted";
  auditCompliance: number;
  lastSecurityReview: Date;
  accessPatternAnomaly: boolean;
}

export interface ClinicalSummary {
  resourceCounts: Record<string, number>;
  dateRange: { earliest: Date; latest: Date };
  primaryConditions: string[];
  activeMedications: number;
  recentEncounters: number;
  labResultsCount: number;
  imagingStudiesCount: number;
  allergyCount: number;
  immunizationCount: number;
}

export interface Patient360View {
  patientId: string;
  patientIdentifiers: { system: string; value: string }[];
  demographics: {
    name: string;
    birthDate: string;
    gender: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  dataSources: PatientDataSource[];
  resources: PatientResource[];
  dataQuality: DataQualityMetrics;
  security: SecurityPosture;
  clinicalSummary: ClinicalSummary;
  aiInsights: AIInsight[];
  lastUpdated: Date;
  noCdsCompliance: string;
}

export interface AIInsight {
  id: string;
  category: "data_quality" | "security" | "completeness" | "timeliness" | "integration";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommendation: string;
  affectedResources: string[];
  generatedAt: Date;
}

export interface Patient360Request {
  patientId: string;
  includeResources?: boolean;
  includeAIInsights?: boolean;
  resourceTypes?: string[];
}

const samplePatientData: Map<string, Patient360View> = new Map();

function initializeSampleData(): void {
  const patient1: Patient360View = {
    patientId: "patient-001",
    patientIdentifiers: [
      { system: "urn:oid:2.16.840.1.113883.4.1", value: "***-**-1234" },
      { system: "http://hospital.example.org/mrn", value: "MRN-12345" }
    ],
    demographics: {
      name: "John Smith",
      birthDate: "1975-06-15",
      gender: "male",
      address: "123 Main St, Springfield, IL 62701",
      phone: "(555) 123-4567",
      email: "j.smith@email.com"
    },
    dataSources: [
      {
        id: "src-epic-001",
        sourceSystem: "Primary Care Provider",
        sourceType: "ehr",
        lastSyncTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        recordCount: 245,
        dataQualityScore: 94.5,
        syncStatus: "active"
      },
      {
        id: "src-lab-001",
        sourceSystem: "Quest Diagnostics",
        sourceType: "lab",
        lastSyncTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        recordCount: 87,
        dataQualityScore: 98.2,
        syncStatus: "active"
      },
      {
        id: "src-pharmacy-001",
        sourceSystem: "CVS Pharmacy",
        sourceType: "pharmacy",
        lastSyncTime: new Date(Date.now() - 48 * 60 * 60 * 1000),
        recordCount: 34,
        dataQualityScore: 91.0,
        syncStatus: "stale"
      },
      {
        id: "src-wearable-001",
        sourceSystem: "Apple HealthKit",
        sourceType: "wearable",
        lastSyncTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        recordCount: 1250,
        dataQualityScore: 85.5,
        syncStatus: "active"
      }
    ],
    resources: [
      { resourceType: "Patient", id: "pat-001", source: "Primary Care Provider", lastUpdated: new Date(), qualityScore: 95, hasConflicts: false },
      { resourceType: "Condition", id: "cond-001", source: "Primary Care Provider", lastUpdated: new Date(), qualityScore: 92, hasConflicts: true, conflictDetails: ["Onset date differs between sources"] },
      { resourceType: "MedicationRequest", id: "med-001", source: "CVS Pharmacy", lastUpdated: new Date(), qualityScore: 88, hasConflicts: false },
      { resourceType: "Observation", id: "obs-001", source: "Quest Diagnostics", lastUpdated: new Date(), qualityScore: 99, hasConflicts: false },
      { resourceType: "Observation", id: "obs-002", source: "Apple HealthKit", lastUpdated: new Date(), qualityScore: 82, hasConflicts: true, conflictDetails: ["Heart rate values differ from clinical measurement"] },
      { resourceType: "Encounter", id: "enc-001", source: "Primary Care Provider", lastUpdated: new Date(), qualityScore: 96, hasConflicts: false },
      { resourceType: "AllergyIntolerance", id: "allergy-001", source: "Primary Care Provider", lastUpdated: new Date(), qualityScore: 100, hasConflicts: false },
      { resourceType: "Immunization", id: "imm-001", source: "Primary Care Provider", lastUpdated: new Date(), qualityScore: 97, hasConflicts: false }
    ],
    dataQuality: {
      overallScore: 91.5,
      completenessScore: 88.2,
      consistencyScore: 85.7,
      timelinessScore: 94.3,
      accuracyScore: 97.8,
      duplicateCount: 3,
      conflictCount: 2,
      missingFieldsCount: 12,
      qualityTrend: "improving",
      lastAssessment: new Date()
    },
    security: {
      accessLogCount: 47,
      lastAccessTime: new Date(Date.now() - 30 * 60 * 1000),
      authorizedUsers: 5,
      pendingConsentRequests: 1,
      dataBreachRisk: "low",
      encryptionStatus: "encrypted",
      auditCompliance: 98.5,
      lastSecurityReview: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      accessPatternAnomaly: false
    },
    clinicalSummary: {
      resourceCounts: {
        Patient: 1,
        Condition: 5,
        MedicationRequest: 8,
        Observation: 156,
        Encounter: 12,
        AllergyIntolerance: 2,
        Immunization: 15,
        Procedure: 3,
        DiagnosticReport: 24,
        DocumentReference: 8
      },
      dateRange: {
        earliest: new Date("2010-03-15"),
        latest: new Date()
      },
      primaryConditions: ["Essential Hypertension", "Type 2 Diabetes", "Hyperlipidemia"],
      activeMedications: 6,
      recentEncounters: 3,
      labResultsCount: 87,
      imagingStudiesCount: 4,
      allergyCount: 2,
      immunizationCount: 15
    },
    aiInsights: [],
    lastUpdated: new Date(),
    noCdsCompliance: "This view provides data integration and quality metrics only. No clinical decision support or medical recommendations."
  };

  samplePatientData.set("patient-001", patient1);

  const patient2: Patient360View = {
    patientId: "patient-002",
    patientIdentifiers: [
      { system: "http://hospital.example.org/mrn", value: "MRN-67890" }
    ],
    demographics: {
      name: "Sarah Johnson",
      birthDate: "1988-11-22",
      gender: "female",
      address: "456 Oak Avenue, Chicago, IL 60601"
    },
    dataSources: [
      {
        id: "src-cerner-001",
        sourceSystem: "Hospital Network",
        sourceType: "ehr",
        lastSyncTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
        recordCount: 178,
        dataQualityScore: 89.3,
        syncStatus: "active"
      },
      {
        id: "src-claims-001",
        sourceSystem: "Blue Cross Blue Shield",
        sourceType: "claims",
        lastSyncTime: new Date(Date.now() - 72 * 60 * 60 * 1000),
        recordCount: 56,
        dataQualityScore: 92.1,
        syncStatus: "stale"
      }
    ],
    resources: [
      { resourceType: "Patient", id: "pat-002", source: "Hospital Network", lastUpdated: new Date(), qualityScore: 91, hasConflicts: false },
      { resourceType: "Condition", id: "cond-002", source: "Hospital Network", lastUpdated: new Date(), qualityScore: 87, hasConflicts: false },
      { resourceType: "MedicationRequest", id: "med-002", source: "Hospital Network", lastUpdated: new Date(), qualityScore: 93, hasConflicts: false },
      { resourceType: "Observation", id: "obs-003", source: "Hospital Network", lastUpdated: new Date(), qualityScore: 95, hasConflicts: false }
    ],
    dataQuality: {
      overallScore: 88.7,
      completenessScore: 82.5,
      consistencyScore: 91.2,
      timelinessScore: 85.8,
      accuracyScore: 95.3,
      duplicateCount: 1,
      conflictCount: 0,
      missingFieldsCount: 18,
      qualityTrend: "stable",
      lastAssessment: new Date()
    },
    security: {
      accessLogCount: 23,
      lastAccessTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      authorizedUsers: 3,
      pendingConsentRequests: 0,
      dataBreachRisk: "low",
      encryptionStatus: "encrypted",
      auditCompliance: 100,
      lastSecurityReview: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      accessPatternAnomaly: false
    },
    clinicalSummary: {
      resourceCounts: {
        Patient: 1,
        Condition: 2,
        MedicationRequest: 3,
        Observation: 45,
        Encounter: 8,
        AllergyIntolerance: 1,
        Immunization: 12
      },
      dateRange: {
        earliest: new Date("2015-08-20"),
        latest: new Date()
      },
      primaryConditions: ["Asthma"],
      activeMedications: 2,
      recentEncounters: 2,
      labResultsCount: 32,
      imagingStudiesCount: 1,
      allergyCount: 1,
      immunizationCount: 12
    },
    aiInsights: [],
    lastUpdated: new Date(),
    noCdsCompliance: "This view provides data integration and quality metrics only. No clinical decision support or medical recommendations."
  };

  samplePatientData.set("patient-002", patient2);
}

initializeSampleData();

export async function getPatient360View(request: Patient360Request): Promise<Patient360View | null> {
  const patient = samplePatientData.get(request.patientId);
  if (!patient) {
    return null;
  }

  const view = { ...patient };

  if (request.includeAIInsights) {
    view.aiInsights = await generateAIInsights(patient);
  }

  if (request.resourceTypes && request.resourceTypes.length > 0) {
    view.resources = view.resources.filter(r => request.resourceTypes!.includes(r.resourceType));
  }

  if (!request.includeResources) {
    view.resources = [];
  }

  return view;
}

export async function generateAIInsights(patient: Patient360View): Promise<AIInsight[]> {
  const insights: AIInsight[] = [];

  if (patient.dataQuality.conflictCount > 0) {
    insights.push({
      id: `insight-${crypto.randomBytes(4).toString("hex")}`,
      category: "data_quality",
      severity: "warning",
      title: "Data Conflicts Detected",
      description: `${patient.dataQuality.conflictCount} data conflicts found across different sources that may affect data accuracy.`,
      recommendation: "Review conflicting records in the harmonization dashboard and apply resolution rules.",
      affectedResources: patient.resources.filter(r => r.hasConflicts).map(r => r.id),
      generatedAt: new Date()
    });
  }

  if (patient.dataQuality.completenessScore < 85) {
    insights.push({
      id: `insight-${crypto.randomBytes(4).toString("hex")}`,
      category: "completeness",
      severity: "warning",
      title: "Data Completeness Below Threshold",
      description: `Completeness score of ${patient.dataQuality.completenessScore.toFixed(1)}% is below the 85% threshold.`,
      recommendation: "Identify and request missing data elements from source systems.",
      affectedResources: [],
      generatedAt: new Date()
    });
  }

  const staleSources = patient.dataSources.filter(s => s.syncStatus === "stale");
  if (staleSources.length > 0) {
    insights.push({
      id: `insight-${crypto.randomBytes(4).toString("hex")}`,
      category: "timeliness",
      severity: "warning",
      title: "Stale Data Sources Detected",
      description: `${staleSources.length} data source(s) have not synced recently: ${staleSources.map(s => s.sourceSystem).join(", ")}.`,
      recommendation: "Check connectivity and sync schedules for stale sources.",
      affectedResources: staleSources.map(s => s.id),
      generatedAt: new Date()
    });
  }

  if (patient.security.pendingConsentRequests > 0) {
    insights.push({
      id: `insight-${crypto.randomBytes(4).toString("hex")}`,
      category: "security",
      severity: "info",
      title: "Pending Consent Requests",
      description: `${patient.security.pendingConsentRequests} consent request(s) awaiting patient response.`,
      recommendation: "Follow up with patient regarding pending consent requests.",
      affectedResources: [],
      generatedAt: new Date()
    });
  }

  if (patient.security.accessPatternAnomaly) {
    insights.push({
      id: `insight-${crypto.randomBytes(4).toString("hex")}`,
      category: "security",
      severity: "critical",
      title: "Unusual Access Pattern Detected",
      description: "Access patterns for this patient's records deviate from normal behavior.",
      recommendation: "Review access logs and verify all access was authorized.",
      affectedResources: [],
      generatedAt: new Date()
    });
  }

  if (patient.dataQuality.duplicateCount > 0) {
    insights.push({
      id: `insight-${crypto.randomBytes(4).toString("hex")}`,
      category: "data_quality",
      severity: "info",
      title: "Duplicate Records Detected",
      description: `${patient.dataQuality.duplicateCount} potential duplicate record(s) identified across sources.`,
      recommendation: "Review duplicates in the deduplication dashboard and merge as appropriate.",
      affectedResources: [],
      generatedAt: new Date()
    });
  }

  if (patient.dataSources.length > 3) {
    insights.push({
      id: `insight-${crypto.randomBytes(4).toString("hex")}`,
      category: "integration",
      severity: "info",
      title: "Multiple Data Sources Integrated",
      description: `Patient data is aggregated from ${patient.dataSources.length} different sources, providing comprehensive coverage.`,
      recommendation: "Continue monitoring data consistency across all sources.",
      affectedResources: [],
      generatedAt: new Date()
    });
  }

  try {
    const aiGeneratedInsights = await generateOpenAIInsights(patient);
    insights.push(...aiGeneratedInsights);
  } catch (error) {
    console.log("[Patient360] OpenAI insights unavailable, using rule-based only");
  }

  return insights;
}

async function generateOpenAIInsights(patient: Patient360View): Promise<AIInsight[]> {
  if (!openai) {
    return [];
  }

  const prompt = `Analyze this patient data integration summary and provide data quality and security insights (NO clinical recommendations):

Patient: ${patient.demographics.name}
Data Sources: ${patient.dataSources.length} (${patient.dataSources.map(s => s.sourceSystem).join(", ")})
Overall Quality Score: ${patient.dataQuality.overallScore}%
Completeness: ${patient.dataQuality.completenessScore}%
Consistency: ${patient.dataQuality.consistencyScore}%
Conflicts: ${patient.dataQuality.conflictCount}
Duplicates: ${patient.dataQuality.duplicateCount}
Security Compliance: ${patient.security.auditCompliance}%
Authorized Users: ${patient.security.authorizedUsers}

Provide 1-2 additional insights about data integration, quality trends, or security considerations. Format as JSON array with objects containing: category, severity, title, description, recommendation.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: NO_CDS_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    max_tokens: 500
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    const aiInsights = parsed.insights || parsed;
    if (!Array.isArray(aiInsights)) return [];

    return aiInsights.map((insight: any) => ({
      id: `insight-ai-${crypto.randomBytes(4).toString("hex")}`,
      category: insight.category || "data_quality",
      severity: insight.severity || "info",
      title: insight.title || "AI Insight",
      description: insight.description || "",
      recommendation: insight.recommendation || "",
      affectedResources: [],
      generatedAt: new Date()
    }));
  } catch {
    return [];
  }
}

export async function generatePatient360Summary(patientId: string): Promise<string> {
  const patient = samplePatientData.get(patientId);
  if (!patient) {
    return "Patient not found.";
  }

  if (!openai) {
    return generateRuleBasedSummary(patient);
  }

  try {
    const prompt = `Generate a concise data integration summary for this patient (NO clinical information, only data quality and integration status):

Patient: ${patient.demographics.name}
Data Sources: ${patient.dataSources.map(s => `${s.sourceSystem} (${s.recordCount} records, ${s.dataQualityScore}% quality)`).join("; ")}
Overall Quality: ${patient.dataQuality.overallScore}%
Conflicts: ${patient.dataQuality.conflictCount}
Last Updated: ${patient.lastUpdated.toISOString()}

Provide a 2-3 sentence summary focusing on data completeness, integration status, and any data quality concerns.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: NO_CDS_SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      max_tokens: 200
    });

    return response.choices[0]?.message?.content || generateRuleBasedSummary(patient);
  } catch {
    return generateRuleBasedSummary(patient);
  }
}

function generateRuleBasedSummary(patient: Patient360View): string {
  const sourceCount = patient.dataSources.length;
  const totalRecords = patient.dataSources.reduce((sum, s) => sum + s.recordCount, 0);
  const staleSources = patient.dataSources.filter(s => s.syncStatus === "stale").length;

  let summary = `Patient data is aggregated from ${sourceCount} source(s) with ${totalRecords} total records. `;
  summary += `Overall data quality score is ${patient.dataQuality.overallScore.toFixed(1)}%. `;

  if (staleSources > 0) {
    summary += `${staleSources} source(s) require sync attention. `;
  }

  if (patient.dataQuality.conflictCount > 0) {
    summary += `${patient.dataQuality.conflictCount} data conflict(s) need resolution.`;
  }

  return summary;
}

export function listPatients(): { patientId: string; name: string; sourceCount: number; qualityScore: number }[] {
  const patients: { patientId: string; name: string; sourceCount: number; qualityScore: number }[] = [];

  samplePatientData.forEach((patient, id) => {
    patients.push({
      patientId: id,
      name: patient.demographics.name,
      sourceCount: patient.dataSources.length,
      qualityScore: patient.dataQuality.overallScore
    });
  });

  return patients;
}

export function getPatient360Stats(): {
  totalPatients: number;
  averageQualityScore: number;
  totalDataSources: number;
  totalConflicts: number;
  patientsWithIssues: number;
} {
  let totalQuality = 0;
  let totalSources = 0;
  let totalConflicts = 0;
  let patientsWithIssues = 0;

  samplePatientData.forEach(patient => {
    totalQuality += patient.dataQuality.overallScore;
    totalSources += patient.dataSources.length;
    totalConflicts += patient.dataQuality.conflictCount;
    if (patient.dataQuality.conflictCount > 0 || patient.dataQuality.completenessScore < 85) {
      patientsWithIssues++;
    }
  });

  return {
    totalPatients: samplePatientData.size,
    averageQualityScore: samplePatientData.size > 0 ? totalQuality / samplePatientData.size : 0,
    totalDataSources: totalSources,
    totalConflicts,
    patientsWithIssues
  };
}
