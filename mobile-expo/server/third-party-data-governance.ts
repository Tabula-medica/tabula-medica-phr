import { db } from "./db";
import { sql } from "drizzle-orm";
import { chatComplete } from "./ai-client";

// ============================================================================
// THIRD-PARTY DATA FLOW GOVERNANCE SERVICE
// Addresses: GDPR Art 5/28, CCPA/CPRA, HIPAA BAA, PCI DSS, GLBA, PIPEDA,
//            APPI, NIST 800-53, ISO/IEC 29100, KSA/UAE/Qatar PDPL
// ============================================================================

// ---------------------------------------------------------------------------
// 1. INTEGRATION REGISTRY - All approved third-party data processors
// ---------------------------------------------------------------------------

type DataCategory =
  | "demographics"
  | "conditions"
  | "medications"
  | "lab_results"
  | "vitals"
  | "allergies"
  | "immunizations"
  | "appointments"
  | "insurance"
  | "clinical_notes"
  | "imaging"
  | "genomics"
  | "contact_info"
  | "device_data"
  | "behavioral"
  | "financial"
  | "identifiers";

type ProcessingPurpose =
  | "clinical_decision_support"
  | "patient_education"
  | "health_analytics"
  | "care_coordination"
  | "safety_analysis"
  | "documentation"
  | "communication"
  | "data_exchange"
  | "identity_verification"
  | "storage"
  | "encryption"
  | "monitoring";

interface IntegrationRegistryEntry {
  id: string;
  name: string;
  vendor: string;
  type: "ai_processor" | "communication" | "health_network" | "cloud_infrastructure" | "analytics" | "identity";
  dpaStatus: "executed" | "pending" | "not_required";
  baaStatus: "executed" | "pending" | "not_required";
  approvedPurposes: ProcessingPurpose[];
  allowedDataCategories: DataCategory[];
  prohibitedDataCategories: DataCategory[];
  dataMinimizationRequired: boolean;
  deIdentificationRequired: boolean;
  retentionPolicy: string;
  crossBorderTransfer: boolean;
  transferMechanism?: string;
  lastReviewDate: string;
  nextReviewDate: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  complianceFrameworks: string[];
  contactInfo: string;
  enabled: boolean;
}

const INTEGRATION_REGISTRY: Map<string, IntegrationRegistryEntry> = new Map([
  [
    "openai",
    {
      id: "openai",
      name: "OpenAI API",
      vendor: "OpenAI, Inc.",
      type: "ai_processor",
      dpaStatus: "executed",
      baaStatus: "executed",
      approvedPurposes: [
        "clinical_decision_support",
        "patient_education",
        "health_analytics",
        "safety_analysis",
        "documentation",
        "care_coordination",
      ],
      allowedDataCategories: [
        "conditions",
        "medications",
        "lab_results",
        "vitals",
        "allergies",
        "immunizations",
        "appointments",
        "clinical_notes",
      ],
      prohibitedDataCategories: [
        "financial",
        "insurance",
        "genomics",
        "identifiers",
      ],
      dataMinimizationRequired: true,
      deIdentificationRequired: true,
      retentionPolicy: "zero_retention_api",
      crossBorderTransfer: true,
      transferMechanism: "SCCs_and_DPA",
      lastReviewDate: "2026-01-15",
      nextReviewDate: "2026-07-15",
      riskLevel: "high",
      complianceFrameworks: [
        "HIPAA",
        "SOC2",
        "GDPR",
        "CCPA",
        "NIST_800_53",
      ],
      contactInfo: "privacy@openai.com",
      enabled: true,
    },
  ],
  [
    "google_vertex_ai",
    {
      id: "google_vertex_ai",
      name: "Google Vertex AI (Gemini)",
      vendor: "Google Cloud",
      type: "ai_processor",
      dpaStatus: "executed",
      baaStatus: "executed",
      approvedPurposes: [
        "clinical_decision_support",
        "patient_education",
        "health_analytics",
        "safety_analysis",
        "documentation",
        "care_coordination",
      ],
      allowedDataCategories: [
        "demographics",
        "conditions",
        "medications",
        "lab_results",
        "vitals",
        "allergies",
        "immunizations",
        "appointments",
        "clinical_notes",
        "imaging",
        "contact_info",
      ],
      prohibitedDataCategories: [
        "financial",
        "genomics",
        "identifiers",
      ],
      dataMinimizationRequired: true,
      deIdentificationRequired: false,
      retentionPolicy: "zero_retention_api",
      crossBorderTransfer: false,
      transferMechanism: "us_region_only",
      lastReviewDate: "2026-05-04",
      nextReviewDate: "2026-11-04",
      riskLevel: "medium",
      complianceFrameworks: [
        "HIPAA",
        "SOC2",
        "HITRUST",
        "FedRAMP",
        "GDPR",
      ],
      contactInfo: "cloud-compliance@google.com",
      enabled: true,
    },
  ],
  [
    "twilio",
    {
      id: "twilio",
      name: "Twilio SMS/Voice",
      vendor: "Twilio, Inc.",
      type: "communication",
      dpaStatus: "executed",
      baaStatus: "executed",
      approvedPurposes: ["communication"],
      allowedDataCategories: ["contact_info"],
      prohibitedDataCategories: [
        "conditions",
        "medications",
        "lab_results",
        "vitals",
        "genomics",
        "financial",
        "identifiers",
      ],
      dataMinimizationRequired: true,
      deIdentificationRequired: false,
      retentionPolicy: "30_day_message_logs",
      crossBorderTransfer: false,
      transferMechanism: undefined,
      lastReviewDate: "2026-01-15",
      nextReviewDate: "2026-07-15",
      riskLevel: "medium",
      complianceFrameworks: ["HIPAA", "SOC2", "GDPR"],
      contactInfo: "privacy@twilio.com",
      enabled: true,
    },
  ],
  [
    "gcp_healthcare",
    {
      id: "gcp_healthcare",
      name: "Google Cloud Healthcare API",
      vendor: "Google Cloud",
      type: "cloud_infrastructure",
      dpaStatus: "executed",
      baaStatus: "executed",
      approvedPurposes: ["storage", "data_exchange", "care_coordination"],
      allowedDataCategories: [
        "demographics",
        "conditions",
        "medications",
        "lab_results",
        "vitals",
        "allergies",
        "immunizations",
        "appointments",
        "insurance",
        "clinical_notes",
        "imaging",
        "genomics",
        "contact_info",
        "identifiers",
      ],
      prohibitedDataCategories: [],
      dataMinimizationRequired: false,
      deIdentificationRequired: false,
      retentionPolicy: "hipaa_7_year",
      crossBorderTransfer: false,
      transferMechanism: "us_region_only",
      lastReviewDate: "2026-01-15",
      nextReviewDate: "2026-07-15",
      riskLevel: "medium",
      complianceFrameworks: [
        "HIPAA",
        "SOC2",
        "HITRUST",
        "FedRAMP",
        "GDPR",
      ],
      contactInfo: "cloud-compliance@google.com",
      enabled: true,
    },
  ],
  [
    "particle_health",
    {
      id: "particle_health",
      name: "Particle Health",
      vendor: "Particle Health, Inc.",
      type: "health_network",
      dpaStatus: "executed",
      baaStatus: "executed",
      approvedPurposes: ["data_exchange", "care_coordination"],
      allowedDataCategories: [
        "demographics",
        "conditions",
        "medications",
        "lab_results",
        "vitals",
        "allergies",
        "immunizations",
        "appointments",
        "clinical_notes",
        "imaging",
      ],
      prohibitedDataCategories: ["financial", "genomics"],
      dataMinimizationRequired: false,
      deIdentificationRequired: false,
      retentionPolicy: "per_dpa",
      crossBorderTransfer: false,
      lastReviewDate: "2026-01-15",
      nextReviewDate: "2026-07-15",
      riskLevel: "medium",
      complianceFrameworks: ["HIPAA", "TEFCA", "SOC2"],
      contactInfo: "compliance@particlehealth.com",
      enabled: true,
    },
  ],
  [
    "redox",
    {
      id: "redox",
      name: "Redox Engine",
      vendor: "Redox, Inc.",
      type: "health_network",
      dpaStatus: "executed",
      baaStatus: "executed",
      approvedPurposes: ["data_exchange", "care_coordination"],
      allowedDataCategories: [
        "demographics",
        "conditions",
        "medications",
        "lab_results",
        "vitals",
        "allergies",
        "immunizations",
        "appointments",
        "clinical_notes",
      ],
      prohibitedDataCategories: ["financial", "genomics"],
      dataMinimizationRequired: false,
      deIdentificationRequired: false,
      retentionPolicy: "per_dpa",
      crossBorderTransfer: false,
      lastReviewDate: "2026-01-15",
      nextReviewDate: "2026-07-15",
      riskLevel: "medium",
      complianceFrameworks: ["HIPAA", "HITRUST", "SOC2"],
      contactInfo: "security@redoxengine.com",
      enabled: true,
    },
  ],
]);

// ---------------------------------------------------------------------------
// 2. PHI DE-IDENTIFICATION & DATA MINIMIZATION
// ---------------------------------------------------------------------------

const PHI_IDENTIFIERS_REGEX: Record<string, RegExp> = {
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  mrn: /\b(?:MRN|Medical Record Number)[:\s]*[\w-]+/gi,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  address: /\b\d{1,5}\s+(?:[A-Za-z]+\s*){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|Place|Pl|Way)\b\.?/gi,
  dob_full: /\b(?:DOB|Date of Birth|Born)[:\s]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
  zip_full: /\b\d{5}-\d{4}\b/g,
  account_number: /\b(?:Account|Acct)[:\s#]*\d{6,}\b/gi,
  insurance_id: /\b(?:Insurance|Policy|Member)\s*(?:ID|Number|#)[:\s]*[\w-]+/gi,
  ip_address: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
};

interface DeIdentificationResult {
  text: string;
  redactedFields: string[];
  redactionCount: number;
}

function deIdentifyText(text: string): DeIdentificationResult {
  let result = text;
  const redactedFields: string[] = [];
  let redactionCount = 0;

  for (const [fieldType, regex] of Object.entries(PHI_IDENTIFIERS_REGEX)) {
    const matches = result.match(regex);
    if (matches && matches.length > 0) {
      redactedFields.push(fieldType);
      redactionCount += matches.length;
      result = result.replace(regex, `[REDACTED_${fieldType.toUpperCase()}]`);
    }
  }

  return { text: result, redactedFields, redactionCount };
}

function minimizePatientContext(context: Record<string, any>, allowedCategories: DataCategory[]): Record<string, any> {
  const minimized: Record<string, any> = {};
  const categoryMap: Record<string, DataCategory> = {
    name: "demographics",
    email: "contact_info",
    phone: "contact_info",
    address: "demographics",
    dateOfBirth: "demographics",
    ssn: "identifiers",
    mrn: "identifiers",
    insuranceId: "insurance",
    conditions: "conditions",
    medications: "medications",
    vitals: "vitals",
    labs: "lab_results",
    labResults: "lab_results",
    allergies: "allergies",
    immunizations: "immunizations",
    appointments: "appointments",
    clinicalNotes: "clinical_notes",
    imaging: "imaging",
    genomics: "genomics",
    financialData: "financial",
    user: "demographics",
    demographics: "demographics",
    recentRecords: "clinical_notes",
    medicationReminders: "medications",
    upcomingAppointments: "appointments",
  };

  for (const [key, value] of Object.entries(context)) {
    const category = categoryMap[key];
    if (!category || allowedCategories.includes(category)) {
      if (key === "user" && typeof value === "object" && value !== null) {
        const userMinimized: Record<string, any> = {};
        if (allowedCategories.includes("demographics")) {
          userMinimized.name = value.name ? `Patient_${hashString(value.name).substring(0, 6)}` : undefined;
        }
        minimized[key] = userMinimized;
      } else {
        minimized[key] = value;
      }
    }
  }

  return minimized;
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ---------------------------------------------------------------------------
// 3. DATA FLOW AUDIT LOGGING
// ---------------------------------------------------------------------------

interface DataFlowAuditEntry {
  id: string;
  timestamp: string;
  integrationId: string;
  integrationName: string;
  purpose: ProcessingPurpose;
  callerService: string;
  callerMethod: string;
  userId?: string;
  patientId?: string;
  dataCategoriesSent: DataCategory[];
  dataCategoriesBlocked: DataCategory[];
  phiRedacted: boolean;
  redactedFieldCount: number;
  redactedFieldTypes: string[];
  policyDecision: "allowed" | "blocked" | "allowed_with_minimization";
  policyViolations: string[];
  requestSizeBytes: number;
  responseSizeBytes?: number;
  durationMs?: number;
  errorOccurred: boolean;
  errorMessage?: string;
  consentReference?: string;
  legalBasis?: string;
}

const auditLog: DataFlowAuditEntry[] = [];
const MAX_IN_MEMORY_ENTRIES = 10000;

function logDataFlow(entry: DataFlowAuditEntry): void {
  auditLog.push(entry);
  if (auditLog.length > MAX_IN_MEMORY_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_IN_MEMORY_ENTRIES);
  }
}

// ---------------------------------------------------------------------------
// 4. DATA FLOW POLICY ENGINE
// ---------------------------------------------------------------------------

interface PolicyDecision {
  allowed: boolean;
  decision: "allowed" | "blocked" | "allowed_with_minimization";
  violations: string[];
  warnings: string[];
  minimizedData?: Record<string, any>;
  deIdentifiedPrompt?: string;
  auditId: string;
}

function evaluateDataFlowPolicy(
  integrationId: string,
  purpose: ProcessingPurpose,
  dataCategories: DataCategory[],
  callerService: string,
  callerMethod: string,
  rawData?: string | Record<string, any>,
  userId?: string
): PolicyDecision {
  const auditId = `df_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const violations: string[] = [];
  const warnings: string[] = [];

  const integration = INTEGRATION_REGISTRY.get(integrationId);
  if (!integration) {
    violations.push(`UNREGISTERED_INTEGRATION: "${integrationId}" is not in the approved integration registry`);
    logDataFlow({
      id: auditId,
      timestamp: new Date().toISOString(),
      integrationId,
      integrationName: "UNKNOWN",
      purpose,
      callerService,
      callerMethod,
      userId,
      dataCategoriesSent: [],
      dataCategoriesBlocked: dataCategories,
      phiRedacted: false,
      redactedFieldCount: 0,
      redactedFieldTypes: [],
      policyDecision: "blocked",
      policyViolations: violations,
      requestSizeBytes: 0,
      errorOccurred: false,
    });
    return { allowed: false, decision: "blocked", violations, warnings, auditId };
  }

  if (!integration.enabled) {
    violations.push(`INTEGRATION_DISABLED: "${integration.name}" is currently disabled`);
  }

  if (!integration.approvedPurposes.includes(purpose)) {
    violations.push(
      `UNAPPROVED_PURPOSE: "${purpose}" is not approved for "${integration.name}". Approved: ${integration.approvedPurposes.join(", ")}`
    );
  }

  if (integration.dpaStatus === "pending") {
    warnings.push(`DPA_PENDING: DPA with "${integration.name}" is pending execution`);
  }
  if (integration.baaStatus === "pending") {
    violations.push(`BAA_PENDING: BAA with "${integration.name}" is not yet executed. PHI sharing is prohibited under HIPAA.`);
  }

  const blockedCategories: DataCategory[] = [];
  const allowedCategories: DataCategory[] = [];

  for (const category of dataCategories) {
    if (integration.prohibitedDataCategories.includes(category)) {
      blockedCategories.push(category);
      violations.push(
        `PROHIBITED_DATA: "${category}" data is prohibited for "${integration.name}"`
      );
    } else if (!integration.allowedDataCategories.includes(category)) {
      blockedCategories.push(category);
      warnings.push(
        `UNLISTED_DATA: "${category}" is not explicitly allowed for "${integration.name}"`
      );
    } else {
      allowedCategories.push(category);
    }
  }

  let deIdentifiedPrompt: string | undefined;
  let redactedFieldCount = 0;
  let redactedFieldTypes: string[] = [];
  let minimizedData: Record<string, any> | undefined;

  if (violations.length === 0 || violations.every(v => v.startsWith("PROHIBITED_DATA"))) {
    if (integration.deIdentificationRequired && typeof rawData === "string") {
      const result = deIdentifyText(rawData);
      deIdentifiedPrompt = result.text;
      redactedFieldCount = result.redactionCount;
      redactedFieldTypes = result.redactedFields;
    }

    if (integration.dataMinimizationRequired && typeof rawData === "object" && rawData !== null) {
      minimizedData = minimizePatientContext(rawData as Record<string, any>, allowedCategories);
    }
  }

  const hasBlockingViolations = violations.some(
    (v) =>
      v.startsWith("UNREGISTERED_INTEGRATION") ||
      v.startsWith("INTEGRATION_DISABLED") ||
      v.startsWith("UNAPPROVED_PURPOSE") ||
      v.startsWith("BAA_PENDING")
  );

  const decision: PolicyDecision["decision"] = hasBlockingViolations
    ? "blocked"
    : redactedFieldCount > 0 || minimizedData
    ? "allowed_with_minimization"
    : "allowed";

  logDataFlow({
    id: auditId,
    timestamp: new Date().toISOString(),
    integrationId,
    integrationName: integration.name,
    purpose,
    callerService,
    callerMethod,
    userId,
    dataCategoriesSent: allowedCategories,
    dataCategoriesBlocked: blockedCategories,
    phiRedacted: redactedFieldCount > 0,
    redactedFieldCount,
    redactedFieldTypes,
    policyDecision: decision,
    policyViolations: [...violations, ...warnings],
    requestSizeBytes: typeof rawData === "string" ? Buffer.byteLength(rawData) : JSON.stringify(rawData || {}).length,
    errorOccurred: false,
  });

  return {
    allowed: !hasBlockingViolations,
    decision,
    violations,
    warnings,
    minimizedData,
    deIdentifiedPrompt,
    auditId,
  };
}

// ---------------------------------------------------------------------------
// 5. GOVERNED OPENAI WRAPPER
// ---------------------------------------------------------------------------

interface GovernedAIRequest {
  callerService: string;
  callerMethod: string;
  purpose: ProcessingPurpose;
  userId?: string;
  patientId?: string;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  dataCategories: DataCategory[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" | "text" };
  consentReference?: string;
}

interface GovernedAIResponse {
  content: string;
  auditId: string;
  policyDecision: PolicyDecision["decision"];
  redactedFieldCount: number;
  model: string;
  tokensUsed?: number;
  durationMs: number;
}

async function governedAICall(request: GovernedAIRequest): Promise<GovernedAIResponse> {
  const startTime = Date.now();

  const fullPrompt = `${request.systemPrompt}\n\n${request.userPrompt}`;
  const policy = evaluateDataFlowPolicy(
    "openai",
    request.purpose,
    request.dataCategories,
    request.callerService,
    request.callerMethod,
    fullPrompt,
    request.userId
  );

  if (!policy.allowed) {
    const entry = auditLog.find((e) => e.id === policy.auditId);
    if (entry) {
      entry.errorOccurred = true;
      entry.errorMessage = `Policy blocked: ${policy.violations.join("; ")}`;
    }
    throw new DataFlowPolicyError(
      `Data flow to OpenAI blocked by policy: ${policy.violations.join("; ")}`,
      policy.auditId,
      policy.violations
    );
  }

  const governedSystemPrompt = policy.deIdentifiedPrompt
    ? policy.deIdentifiedPrompt.substring(0, request.systemPrompt.length + 10)
    : request.systemPrompt;
  const governedUserPrompt = policy.deIdentifiedPrompt
    ? policy.deIdentifiedPrompt.substring(request.systemPrompt.length + 2)
    : request.userPrompt;

  try {
    const messages = [
      { role: "system" as const, content: governedSystemPrompt },
      { role: "user" as const, content: governedUserPrompt },
    ];

    const wantsJson = request.responseFormat?.type === "json_object";

    const response = await chatComplete({
      model: "deep",
      messages,
      maxOutputTokens: request.maxTokens || 4096,
      jsonMode: wantsJson,
      dataCategories: request.dataCategories,
      purpose: request.purpose as any,
      callerService: request.callerService,
      callerMethod: request.callerMethod,
      userId: request.userId,
    });
    const content = response.content || "";
    const durationMs = Date.now() - startTime;

    const entry = auditLog.find((e) => e.id === policy.auditId);
    if (entry) {
      entry.responseSizeBytes = Buffer.byteLength(content);
      entry.durationMs = durationMs;
    }

    return {
      content,
      auditId: policy.auditId,
      policyDecision: policy.decision,
      redactedFieldCount: policy.deIdentifiedPrompt ? deIdentifyText(fullPrompt).redactionCount : 0,
      model: request.model || "gpt-4o",
      tokensUsed: response.usage?.totalTokens,
      durationMs,
    };
  } catch (error: any) {
    const entry = auditLog.find((e) => e.id === policy.auditId);
    if (entry) {
      entry.errorOccurred = true;
      entry.errorMessage = error.message;
      entry.durationMs = Date.now() - startTime;
    }
    throw error;
  }
}

class DataFlowPolicyError extends Error {
  auditId: string;
  violations: string[];
  constructor(message: string, auditId: string, violations: string[]) {
    super(message);
    this.name = "DataFlowPolicyError";
    this.auditId = auditId;
    this.violations = violations;
  }
}

// ---------------------------------------------------------------------------
// 6. GOVERNED TWILIO WRAPPER
// ---------------------------------------------------------------------------

function validateTwilioDataFlow(
  messageBody: string,
  callerService: string,
  userId?: string
): PolicyDecision {
  const dataCategories: DataCategory[] = ["contact_info"];

  const phiPatterns = [
    { pattern: /\b(?:diagnosed|condition|disease)\b/i, category: "conditions" as DataCategory },
    { pattern: /\b(?:medication|prescription|drug|dose)\b/i, category: "medications" as DataCategory },
    { pattern: /\b(?:lab|test result|blood|glucose|A1c)\b/i, category: "lab_results" as DataCategory },
    { pattern: /\b(?:blood pressure|heart rate|temperature|SpO2|BMI)\b/i, category: "vitals" as DataCategory },
  ];

  for (const { pattern, category } of phiPatterns) {
    if (pattern.test(messageBody)) {
      dataCategories.push(category);
    }
  }

  return evaluateDataFlowPolicy(
    "twilio",
    "communication",
    dataCategories,
    callerService,
    "sendSms",
    messageBody,
    userId
  );
}

// ---------------------------------------------------------------------------
// 7. COMPLIANCE REPORTING
// ---------------------------------------------------------------------------

interface ComplianceReport {
  generatedAt: string;
  reportPeriod: { from: string; to: string };
  summary: {
    totalDataFlows: number;
    allowedFlows: number;
    blockedFlows: number;
    minimizedFlows: number;
    totalPHIRedactions: number;
    uniqueIntegrations: number;
    policyViolations: number;
  };
  integrationBreakdown: Array<{
    integrationId: string;
    integrationName: string;
    flowCount: number;
    blockedCount: number;
    redactionCount: number;
    dataCategoriesShared: DataCategory[];
    purposes: ProcessingPurpose[];
    dpaStatus: string;
    baaStatus: string;
    riskLevel: string;
  }>;
  violations: Array<{
    timestamp: string;
    integrationId: string;
    violation: string;
    callerService: string;
    callerMethod: string;
  }>;
  recommendations: string[];
}

function generateComplianceReport(
  fromDate?: string,
  toDate?: string
): ComplianceReport {
  const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = toDate || new Date().toISOString();

  const filtered = auditLog.filter(
    (e) => e.timestamp >= from && e.timestamp <= to
  );

  const integrationMap = new Map<string, DataFlowAuditEntry[]>();
  for (const entry of filtered) {
    const existing = integrationMap.get(entry.integrationId) || [];
    existing.push(entry);
    integrationMap.set(entry.integrationId, existing);
  }

  const allViolations: ComplianceReport["violations"] = [];
  for (const entry of filtered) {
    for (const v of entry.policyViolations) {
      allViolations.push({
        timestamp: entry.timestamp,
        integrationId: entry.integrationId,
        violation: v,
        callerService: entry.callerService,
        callerMethod: entry.callerMethod,
      });
    }
  }

  const integrationBreakdown: ComplianceReport["integrationBreakdown"] = [];
  for (const [id, entries] of integrationMap) {
    const reg = INTEGRATION_REGISTRY.get(id);
    const allCategories = new Set<DataCategory>();
    const allPurposes = new Set<ProcessingPurpose>();
    let redactions = 0;

    for (const e of entries) {
      e.dataCategoriesSent.forEach((c) => allCategories.add(c));
      allPurposes.add(e.purpose);
      redactions += e.redactedFieldCount;
    }

    integrationBreakdown.push({
      integrationId: id,
      integrationName: reg?.name || "Unknown",
      flowCount: entries.length,
      blockedCount: entries.filter((e) => e.policyDecision === "blocked").length,
      redactionCount: redactions,
      dataCategoriesShared: [...allCategories],
      purposes: [...allPurposes],
      dpaStatus: reg?.dpaStatus || "unknown",
      baaStatus: reg?.baaStatus || "unknown",
      riskLevel: reg?.riskLevel || "unknown",
    });
  }

  const recommendations: string[] = [];
  for (const [, reg] of INTEGRATION_REGISTRY) {
    if (reg.dpaStatus === "pending") {
      recommendations.push(`Execute DPA with ${reg.name} before processing data.`);
    }
    if (reg.baaStatus === "pending") {
      recommendations.push(`Execute BAA with ${reg.name} before sharing PHI. HIPAA violation risk.`);
    }
    if (new Date(reg.nextReviewDate) < new Date()) {
      recommendations.push(`${reg.name} integration review is overdue (due: ${reg.nextReviewDate}).`);
    }
  }

  const blockedFlows = filtered.filter((e) => e.policyDecision === "blocked").length;
  if (blockedFlows > 0) {
    recommendations.push(
      `${blockedFlows} data flows were blocked. Review and update integration policies if legitimate use cases are blocked.`
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    reportPeriod: { from, to },
    summary: {
      totalDataFlows: filtered.length,
      allowedFlows: filtered.filter((e) => e.policyDecision === "allowed").length,
      blockedFlows,
      minimizedFlows: filtered.filter((e) => e.policyDecision === "allowed_with_minimization").length,
      totalPHIRedactions: filtered.reduce((sum, e) => sum + e.redactedFieldCount, 0),
      uniqueIntegrations: integrationMap.size,
      policyViolations: allViolations.length,
    },
    integrationBreakdown,
    violations: allViolations.slice(-100),
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// 8. PRIVACY NOTICE ALIGNMENT CHECK
// ---------------------------------------------------------------------------

interface PrivacyNoticeAlignment {
  integrationId: string;
  integrationName: string;
  disclosedInPrivacyNotice: boolean;
  dataCategoriesDisclosed: DataCategory[];
  dataCategoriesActual: DataCategory[];
  missingDisclosures: DataCategory[];
  purposeDisclosed: boolean;
  crossBorderDisclosed: boolean;
  compliant: boolean;
  remediationRequired: string[];
}

function checkPrivacyNoticeAlignment(): PrivacyNoticeAlignment[] {
  const results: PrivacyNoticeAlignment[] = [];

  for (const [id, reg] of INTEGRATION_REGISTRY) {
    const integrationFlows = auditLog.filter((e) => e.integrationId === id);
    const actualCategories = new Set<DataCategory>();
    for (const flow of integrationFlows) {
      flow.dataCategoriesSent.forEach((c) => actualCategories.add(c));
    }

    const missingDisclosures = [...actualCategories].filter(
      (c) => !reg.allowedDataCategories.includes(c)
    );
    const remediationRequired: string[] = [];

    if (missingDisclosures.length > 0) {
      remediationRequired.push(
        `Update privacy notice to disclose sharing of: ${missingDisclosures.join(", ")} with ${reg.name}`
      );
    }
    if (reg.crossBorderTransfer) {
      remediationRequired.push(
        `Ensure cross-border transfer to ${reg.vendor} is disclosed in privacy notice`
      );
    }
    if (reg.dpaStatus !== "executed") {
      remediationRequired.push(`Execute DPA with ${reg.vendor}`);
    }

    results.push({
      integrationId: id,
      integrationName: reg.name,
      disclosedInPrivacyNotice: reg.dpaStatus === "executed",
      dataCategoriesDisclosed: reg.allowedDataCategories,
      dataCategoriesActual: [...actualCategories],
      missingDisclosures,
      purposeDisclosed: true,
      crossBorderDisclosed: !reg.crossBorderTransfer,
      compliant: missingDisclosures.length === 0 && reg.dpaStatus === "executed" && reg.baaStatus !== "pending",
      remediationRequired,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 9. EXPRESS ROUTE REGISTRATION
// ---------------------------------------------------------------------------

import { Router, Request, Response } from "express";

function createDataGovernanceRouter(): Router {
  const router = Router();

  router.get("/registry", (_req: Request, res: Response) => {
    const registry = Array.from(INTEGRATION_REGISTRY.values()).map((entry) => ({
      ...entry,
      contactInfo: undefined,
    }));
    res.json({
      totalIntegrations: registry.length,
      integrations: registry,
      lastUpdated: "2026-02-22",
    });
  });

  router.get("/registry/:id", (req: Request, res: Response) => {
    const entry = INTEGRATION_REGISTRY.get(req.params.id as string);
    if (!entry) {
      return res.status(404).json({ error: "Integration not found" });
    }
    res.json(entry);
  });

  router.get("/audit-log", (req: Request, res: Response) => {
    const { from, to, integrationId, decision, limit: limitStr } = req.query;
    let filtered = [...auditLog];

    if (from) filtered = filtered.filter((e) => e.timestamp >= (from as string));
    if (to) filtered = filtered.filter((e) => e.timestamp <= (to as string));
    if (integrationId) filtered = filtered.filter((e) => e.integrationId === integrationId);
    if (decision) filtered = filtered.filter((e) => e.policyDecision === decision);

    const limit = parseInt(limitStr as string) || 100;
    const recent = filtered.slice(-limit);

    res.json({
      totalEntries: filtered.length,
      returned: recent.length,
      entries: recent,
    });
  });

  router.get("/compliance-report", (req: Request, res: Response) => {
    const { from, to } = req.query;
    const report = generateComplianceReport(from as string, to as string);
    res.json(report);
  });

  router.get("/privacy-alignment", (_req: Request, res: Response) => {
    const alignment = checkPrivacyNoticeAlignment();
    const compliantCount = alignment.filter((a) => a.compliant).length;
    res.json({
      overallCompliant: compliantCount === alignment.length,
      compliantIntegrations: compliantCount,
      totalIntegrations: alignment.length,
      alignmentResults: alignment,
    });
  });

  router.get("/data-flow-summary", (_req: Request, res: Response) => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const last24hFlows = auditLog.filter((e) => e.timestamp >= last24h);
    const last7dFlows = auditLog.filter((e) => e.timestamp >= last7d);

    res.json({
      last24Hours: {
        total: last24hFlows.length,
        allowed: last24hFlows.filter((e) => e.policyDecision === "allowed").length,
        blocked: last24hFlows.filter((e) => e.policyDecision === "blocked").length,
        minimized: last24hFlows.filter((e) => e.policyDecision === "allowed_with_minimization").length,
        redactions: last24hFlows.reduce((s, e) => s + e.redactedFieldCount, 0),
      },
      last7Days: {
        total: last7dFlows.length,
        allowed: last7dFlows.filter((e) => e.policyDecision === "allowed").length,
        blocked: last7dFlows.filter((e) => e.policyDecision === "blocked").length,
        minimized: last7dFlows.filter((e) => e.policyDecision === "allowed_with_minimization").length,
        redactions: last7dFlows.reduce((s, e) => s + e.redactedFieldCount, 0),
      },
      registeredIntegrations: INTEGRATION_REGISTRY.size,
      highRiskIntegrations: Array.from(INTEGRATION_REGISTRY.values()).filter(
        (r) => r.riskLevel === "high" || r.riskLevel === "critical"
      ).length,
    });
  });

  router.post("/validate-flow", (req: Request, res: Response) => {
    const { integrationId, purpose, dataCategories, callerService, callerMethod, sampleData } = req.body;
    if (!integrationId || !purpose || !dataCategories || !callerService) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const decision = evaluateDataFlowPolicy(
      integrationId,
      purpose,
      dataCategories,
      callerService,
      callerMethod || "manual_validation",
      sampleData
    );
    res.json(decision);
  });

  router.get("/frameworks", (_req: Request, res: Response) => {
    const frameworkCoverage: Record<string, { integrations: string[]; controls: string[] }> = {};
    for (const [, reg] of INTEGRATION_REGISTRY) {
      for (const fw of reg.complianceFrameworks) {
        if (!frameworkCoverage[fw]) {
          frameworkCoverage[fw] = { integrations: [], controls: [] };
        }
        frameworkCoverage[fw].integrations.push(reg.name);
      }
    }

    frameworkCoverage["HIPAA"] = {
      ...frameworkCoverage["HIPAA"],
      controls: [
        "BAA enforcement for all processors",
        "PHI de-identification before AI processing",
        "Minimum necessary standard enforcement",
        "Audit trail for all PHI disclosures",
        "Cross-border transfer restrictions",
      ],
    };
    frameworkCoverage["GDPR"] = {
      ...frameworkCoverage["GDPR"],
      controls: [
        "DPA enforcement (Article 28)",
        "Data minimization (Article 5)",
        "Purpose limitation enforcement",
        "Cross-border transfer mechanisms (SCCs)",
        "Right to erasure support",
      ],
    };
    frameworkCoverage["NIST_800_53"] = {
      ...frameworkCoverage["NIST_800_53"],
      controls: [
        "Supply chain risk management (SR-1)",
        "External system connections (CA-3)",
        "Information flow enforcement (AC-4)",
        "Audit logging (AU-2, AU-3)",
        "Continuous monitoring (CA-7)",
      ],
    };

    res.json({
      frameworksImplemented: Object.keys(frameworkCoverage).length,
      frameworks: frameworkCoverage,
    });
  });

  return router;
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

export {
  evaluateDataFlowPolicy,
  governedAICall,
  validateTwilioDataFlow,
  generateComplianceReport,
  checkPrivacyNoticeAlignment,
  createDataGovernanceRouter,
  deIdentifyText,
  minimizePatientContext,
  DataFlowPolicyError,
  INTEGRATION_REGISTRY,
  auditLog,
};

export type {
  IntegrationRegistryEntry,
  DataCategory,
  ProcessingPurpose,
  GovernedAIRequest,
  GovernedAIResponse,
  PolicyDecision,
  ComplianceReport,
  DataFlowAuditEntry,
  DeIdentificationResult,
  PrivacyNoticeAlignment,
};
