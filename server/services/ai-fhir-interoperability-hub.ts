import OpenAI from "openai";
import { randomUUID } from "crypto";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const NO_CDS_INTEROPERABILITY_PROMPT = `You are an AI-powered FHIR Interoperability Hub assistant. Your role is to:
1. Monitor data exchange points between healthcare systems
2. Detect semantic mismatches across different FHIR profiles and servers
3. Suggest standardized data elements and mappings to improve cross-system communication

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data for patient care decisions
- You focus ONLY on data interoperability, semantic alignment, and technical standardization
- All suggestions are for DATA GOVERNANCE and TECHNICAL INTEROPERABILITY purposes only

When analyzing data exchange issues:
- Identify field mapping discrepancies between source and target systems
- Detect terminology code system mismatches (SNOMED vs ICD-10 vs LOINC)
- Flag structural differences in FHIR resource representations
- Recommend standard profiles (US Core, IPS, mCODE) for alignment
- Suggest value set bindings for consistent terminology usage`;

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b\d{9}\b/g, "[MRN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/g, "[DOB_REDACTED]");
}

export type ExchangePointType = "fhir_endpoint" | "hl7_interface" | "api_gateway" | "data_pipeline" | "batch_import";
export type ExchangePointStatus = "healthy" | "degraded" | "error" | "offline" | "unknown";
export type MismatchSeverity = "critical" | "high" | "medium" | "low";
export type MismatchCategory = "semantic" | "structural" | "terminology" | "cardinality" | "extension" | "validation";
export type SuggestionType = "mapping" | "profile_adoption" | "terminology_binding" | "extension_alignment" | "validation_rule";
export type SuggestionStatus = "pending" | "applied" | "rejected" | "in_review";

export interface ExchangePoint {
  id: string;
  name: string;
  type: ExchangePointType;
  sourceSystem: string;
  targetSystem: string;
  endpoint: string;
  status: ExchangePointStatus;
  lastChecked: string;
  healthScore: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageLatencyMs: number;
  supportedResources: string[];
  profilesUsed: string[];
  lastError?: string;
  monitoringEnabled: boolean;
  createdAt: string;
}

export interface SemanticMismatch {
  id: string;
  exchangePointId: string;
  detectedAt: string;
  severity: MismatchSeverity;
  category: MismatchCategory;
  sourceProfile: string;
  targetProfile: string;
  resourceType: string;
  fieldPath: string;
  description: string;
  sourceValue?: string;
  targetValue?: string;
  impactedTransactions: number;
  suggestedResolution?: string;
  status: "open" | "acknowledged" | "resolved" | "ignored";
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface StandardizationSuggestion {
  id: string;
  mismatchId?: string;
  exchangePointId?: string;
  type: SuggestionType;
  priority: MismatchSeverity;
  title: string;
  description: string;
  rationale: string;
  standardProfile?: string;
  sourceElement: string;
  targetElement: string;
  mappingExpression?: string;
  terminologyBinding?: {
    valueSet: string;
    strength: "required" | "extensible" | "preferred" | "example";
  };
  implementationSteps: string[];
  estimatedEffort: "low" | "medium" | "high";
  confidenceScore: number;
  status: SuggestionStatus;
  aiGenerated: boolean;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface InteroperabilityDashboard {
  totalExchangePoints: number;
  healthyEndpoints: number;
  degradedEndpoints: number;
  errorEndpoints: number;
  openMismatches: number;
  criticalMismatches: number;
  pendingSuggestions: number;
  overallHealthScore: number;
  transactionsLast24h: number;
  successRate: number;
  topIssues: Array<{
    category: MismatchCategory;
    count: number;
    severity: MismatchSeverity;
  }>;
  recentAlerts: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    severity: MismatchSeverity;
  }>;
}

export interface DataFlowAnalysis {
  exchangePointId: string;
  analyzedAt: string;
  inboundVolume: number;
  outboundVolume: number;
  transformationCount: number;
  validationErrors: number;
  terminologyMismatches: number;
  structuralIssues: number;
  profileComplianceScore: number;
  recommendations: string[];
}

export interface CrossServerAnalysis {
  id: string;
  serverA: string;
  serverB: string;
  comparedAt: string;
  commonResources: string[];
  profileDifferences: Array<{
    resourceType: string;
    serverAProfile: string;
    serverBProfile: string;
    differences: string[];
  }>;
  terminologyMismatches: Array<{
    codeSystem: string;
    serverABinding: string;
    serverBBinding: string;
    recommendation: string;
  }>;
  extensionConflicts: Array<{
    extensionUrl: string;
    serverAUsage: string;
    serverBUsage: string;
  }>;
  overallCompatibilityScore: number;
  alignmentSuggestions: string[];
}

const exchangePointStore = new Map<string, ExchangePoint>();
const mismatchStore = new Map<string, SemanticMismatch>();
const suggestionStore = new Map<string, StandardizationSuggestion>();
const analysisStore = new Map<string, CrossServerAnalysis>();
const alertStore: Array<{ id: string; type: string; message: string; timestamp: string; severity: MismatchSeverity }> = [];

function initializeSampleData(): void {
  const exchangePoints: ExchangePoint[] = [
    {
      id: "ep-001",
      name: "Fasten Health FHIR Gateway",
      type: "fhir_endpoint",
      sourceSystem: "Fasten Health",
      targetSystem: "Tabula Medica",
      endpoint: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
      status: "healthy",
      lastChecked: new Date().toISOString(),
      healthScore: 98,
      totalTransactions: 15420,
      successfulTransactions: 15280,
      failedTransactions: 140,
      averageLatencyMs: 245,
      supportedResources: ["Patient", "Condition", "Medication", "Observation", "AllergyIntolerance", "Immunization"],
      profilesUsed: ["us-core-patient", "us-core-condition", "us-core-medication"],
      monitoringEnabled: true,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "ep-002",
      name: "Hospital HL7 Interface",
      type: "hl7_interface",
      sourceSystem: "Hospital Network",
      targetSystem: "Tabula Medica",
      endpoint: "mllp://cerner-hl7.hospital.local:2575",
      status: "degraded",
      lastChecked: new Date().toISOString(),
      healthScore: 72,
      totalTransactions: 8930,
      successfulTransactions: 7845,
      failedTransactions: 1085,
      averageLatencyMs: 180,
      supportedResources: ["Patient", "Encounter", "DiagnosticReport", "Observation"],
      profilesUsed: ["cerner-custom-patient", "hl7-v2-oru"],
      lastError: "Intermittent connection timeouts detected",
      monitoringEnabled: true,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "ep-003",
      name: "Lab Results Data Pipeline",
      type: "data_pipeline",
      sourceSystem: "LabCorp",
      targetSystem: "Tabula Medica",
      endpoint: "https://api.labcorp.com/fhir/r4",
      status: "healthy",
      lastChecked: new Date().toISOString(),
      healthScore: 95,
      totalTransactions: 5200,
      successfulTransactions: 5150,
      failedTransactions: 50,
      averageLatencyMs: 320,
      supportedResources: ["DiagnosticReport", "Observation", "Specimen"],
      profilesUsed: ["us-core-diagnosticreport", "us-core-observation-lab"],
      monitoringEnabled: true,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "ep-004",
      name: "CMS Blue Button API",
      type: "api_gateway",
      sourceSystem: "CMS Medicare",
      targetSystem: "Tabula Medica",
      endpoint: "https://api.bluebutton.cms.gov/v2/fhir",
      status: "healthy",
      lastChecked: new Date().toISOString(),
      healthScore: 99,
      totalTransactions: 3200,
      successfulTransactions: 3195,
      failedTransactions: 5,
      averageLatencyMs: 410,
      supportedResources: ["Patient", "Coverage", "ExplanationOfBenefit", "Claim"],
      profilesUsed: ["carin-bb-patient", "carin-bb-coverage", "carin-bb-eob"],
      monitoringEnabled: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  exchangePoints.forEach(ep => exchangePointStore.set(ep.id, ep));

  const mismatches: SemanticMismatch[] = [
    {
      id: "mm-001",
      exchangePointId: "ep-002",
      detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      severity: "high",
      category: "terminology",
      sourceProfile: "cerner-custom-patient",
      targetProfile: "us-core-patient",
      resourceType: "Patient",
      fieldPath: "Patient.gender",
      description: "Gender code system mismatch: Source system uses custom codes while target expects HL7 administrative gender",
      sourceValue: "cerner:gender:M",
      targetValue: "http://hl7.org/fhir/administrative-gender|male",
      impactedTransactions: 342,
      suggestedResolution: "Map source gender codes to HL7 administrative-gender value set",
      status: "open",
    },
    {
      id: "mm-002",
      exchangePointId: "ep-002",
      detectedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      severity: "critical",
      category: "structural",
      sourceProfile: "hl7-v2-oru",
      targetProfile: "us-core-diagnosticreport",
      resourceType: "DiagnosticReport",
      fieldPath: "DiagnosticReport.result",
      description: "Missing required reference to Observation resources in lab results",
      impactedTransactions: 128,
      suggestedResolution: "Transform HL7 OBX segments into FHIR Observation resources and link to DiagnosticReport",
      status: "open",
    },
    {
      id: "mm-003",
      exchangePointId: "ep-003",
      detectedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      severity: "medium",
      category: "terminology",
      sourceProfile: "labcorp-observation",
      targetProfile: "us-core-observation-lab",
      resourceType: "Observation",
      fieldPath: "Observation.code",
      description: "Lab test codes using internal codes instead of LOINC",
      sourceValue: "LC:12345",
      targetValue: "LOINC:2339-0",
      impactedTransactions: 89,
      suggestedResolution: "Implement LOINC code mapping for LabCorp internal test codes",
      status: "acknowledged",
    },
    {
      id: "mm-004",
      exchangePointId: "ep-001",
      detectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      severity: "low",
      category: "extension",
      sourceProfile: "epic-custom-patient",
      targetProfile: "us-core-patient",
      resourceType: "Patient",
      fieldPath: "Patient.extension",
      description: "Source-specific extensions not recognized in target profile",
      impactedTransactions: 15,
      suggestedResolution: "Map Source extensions to US Core equivalents or store in custom extension namespace",
      status: "open",
    },
  ];

  mismatches.forEach(m => mismatchStore.set(m.id, m));

  const suggestions: StandardizationSuggestion[] = [
    {
      id: "sug-001",
      mismatchId: "mm-001",
      exchangePointId: "ep-002",
      type: "terminology_binding",
      priority: "high",
      title: "Standardize Gender Codes to HL7 Administrative Gender",
      description: "Replace source-specific gender codes with HL7 administrative-gender value set for US Core compliance",
      rationale: "US Core Patient profile requires administrative-gender value set binding. Non-standard codes cause validation failures and semantic ambiguity.",
      standardProfile: "us-core-patient",
      sourceElement: "Patient.gender",
      targetElement: "Patient.gender",
      mappingExpression: "iif(gender = 'cerner:gender:M', 'male', iif(gender = 'cerner:gender:F', 'female', 'unknown'))",
      terminologyBinding: {
        valueSet: "http://hl7.org/fhir/ValueSet/administrative-gender",
        strength: "required",
      },
      implementationSteps: [
        "Create gender code mapping table in transformation layer",
        "Add FHIRPath mapping expression to data pipeline",
        "Validate transformed data against US Core Patient profile",
        "Update monitoring to track gender code mapping success rate",
      ],
      estimatedEffort: "low",
      confidenceScore: 95,
      status: "pending",
      aiGenerated: true,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "sug-002",
      mismatchId: "mm-002",
      exchangePointId: "ep-002",
      type: "mapping",
      priority: "critical",
      title: "Transform HL7 OBX to FHIR Observation Resources",
      description: "Implement HL7 v2 to FHIR R4 transformation for lab observation data",
      rationale: "HL7 v2 ORU messages contain OBX segments that must be transformed into standalone Observation resources for FHIR R4 compliance.",
      standardProfile: "us-core-observation-lab",
      sourceElement: "OBX",
      targetElement: "Observation",
      implementationSteps: [
        "Parse OBX segment fields (OBX-3 for code, OBX-5 for value)",
        "Create Observation resource with proper category coding",
        "Map OBX-3 to Observation.code using LOINC when available",
        "Link Observation to parent DiagnosticReport via reference",
        "Set appropriate status based on OBX-11 observation result status",
      ],
      estimatedEffort: "high",
      confidenceScore: 88,
      status: "pending",
      aiGenerated: true,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "sug-003",
      type: "profile_adoption",
      priority: "medium",
      title: "Adopt US Core 6.1 Profile Set",
      description: "Upgrade all exchange points to US Core Implementation Guide version 6.1",
      rationale: "US Core 6.1 provides improved interoperability requirements and aligns with CMS regulations for patient access.",
      standardProfile: "us-core-6.1",
      sourceElement: "All resources",
      targetElement: "All resources",
      implementationSteps: [
        "Review US Core 6.1 change log for breaking changes",
        "Update validation rules to US Core 6.1 profiles",
        "Add required Must Support elements to all transformations",
        "Test all exchange points against new profiles",
        "Update documentation and monitoring dashboards",
      ],
      estimatedEffort: "high",
      confidenceScore: 92,
      status: "in_review",
      aiGenerated: true,
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    },
  ];

  suggestions.forEach(s => suggestionStore.set(s.id, s));

  alertStore.push(
    {
      id: "alert-001",
      type: "mismatch_detected",
      message: "Critical structural mismatch detected in Hospital HL7 interface",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      severity: "critical",
    },
    {
      id: "alert-002",
      type: "health_degraded",
      message: "Hospital HL7 interface health score dropped below 75%",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      severity: "high",
    },
    {
      id: "alert-003",
      type: "terminology_issue",
      message: "LOINC code mapping failures detected in lab pipeline",
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      severity: "medium",
    }
  );

  console.log("[AIFHIRInteroperabilityHub] Sample data initialized");
}

class AIFHIRInteroperabilityHub {
  constructor() {
    initializeSampleData();
    console.log("[AIFHIRInteroperabilityHub] OpenAI client", openai ? "configured" : "not configured");
    console.log("[AIFHIRInteroperabilityHub] Service initialized");
  }

  getDashboard(): InteroperabilityDashboard {
    const exchangePoints = Array.from(exchangePointStore.values());
    const mismatches = Array.from(mismatchStore.values());
    const suggestions = Array.from(suggestionStore.values());

    const healthyCount = exchangePoints.filter(ep => ep.status === "healthy").length;
    const degradedCount = exchangePoints.filter(ep => ep.status === "degraded").length;
    const errorCount = exchangePoints.filter(ep => ep.status === "error" || ep.status === "offline").length;

    const openMismatches = mismatches.filter(m => m.status === "open" || m.status === "acknowledged");
    const criticalMismatches = openMismatches.filter(m => m.severity === "critical");
    const pendingSuggestions = suggestions.filter(s => s.status === "pending" || s.status === "in_review");

    const totalTransactions = exchangePoints.reduce((sum, ep) => sum + ep.totalTransactions, 0);
    const successfulTransactions = exchangePoints.reduce((sum, ep) => sum + ep.successfulTransactions, 0);
    const overallHealthScore = exchangePoints.length > 0
      ? Math.round(exchangePoints.reduce((sum, ep) => sum + ep.healthScore, 0) / exchangePoints.length)
      : 0;

    const categoryCount = new Map<MismatchCategory, { count: number; maxSeverity: MismatchSeverity }>();
    openMismatches.forEach(m => {
      const existing = categoryCount.get(m.category);
      if (existing) {
        existing.count++;
        if (this.severityRank(m.severity) > this.severityRank(existing.maxSeverity)) {
          existing.maxSeverity = m.severity;
        }
      } else {
        categoryCount.set(m.category, { count: 1, maxSeverity: m.severity });
      }
    });

    const topIssues = Array.from(categoryCount.entries())
      .map(([category, data]) => ({ category, count: data.count, severity: data.maxSeverity }))
      .sort((a, b) => this.severityRank(b.severity) - this.severityRank(a.severity) || b.count - a.count)
      .slice(0, 5);

    return {
      totalExchangePoints: exchangePoints.length,
      healthyEndpoints: healthyCount,
      degradedEndpoints: degradedCount,
      errorEndpoints: errorCount,
      openMismatches: openMismatches.length,
      criticalMismatches: criticalMismatches.length,
      pendingSuggestions: pendingSuggestions.length,
      overallHealthScore,
      transactionsLast24h: totalTransactions,
      successRate: totalTransactions > 0 ? Math.round((successfulTransactions / totalTransactions) * 100) : 0,
      topIssues,
      recentAlerts: alertStore.slice(-10).reverse(),
    };
  }

  private severityRank(severity: MismatchSeverity): number {
    const ranks: Record<MismatchSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return ranks[severity];
  }

  getExchangePoints(filters?: { status?: ExchangePointStatus; type?: ExchangePointType }): ExchangePoint[] {
    let results = Array.from(exchangePointStore.values());
    if (filters?.status) {
      results = results.filter(ep => ep.status === filters.status);
    }
    if (filters?.type) {
      results = results.filter(ep => ep.type === filters.type);
    }
    return results.sort((a, b) => b.healthScore - a.healthScore);
  }

  getExchangePoint(id: string): ExchangePoint | undefined {
    return exchangePointStore.get(id);
  }

  async monitorExchangePoint(id: string): Promise<ExchangePoint> {
    const ep = exchangePointStore.get(id);
    if (!ep) {
      throw new Error(`Exchange point not found: ${id}`);
    }

    ep.lastChecked = new Date().toISOString();
    ep.totalTransactions += Math.floor(Math.random() * 100);
    ep.successfulTransactions += Math.floor(Math.random() * 95);
    ep.failedTransactions = ep.totalTransactions - ep.successfulTransactions;
    
    const successRate = ep.successfulTransactions / ep.totalTransactions;
    ep.healthScore = Math.round(successRate * 100);
    
    if (ep.healthScore >= 95) {
      ep.status = "healthy";
    } else if (ep.healthScore >= 70) {
      ep.status = "degraded";
    } else {
      ep.status = "error";
    }

    exchangePointStore.set(id, ep);
    return ep;
  }

  getMismatches(filters?: { 
    exchangePointId?: string; 
    severity?: MismatchSeverity; 
    category?: MismatchCategory;
    status?: string;
  }): SemanticMismatch[] {
    let results = Array.from(mismatchStore.values());
    
    if (filters?.exchangePointId) {
      results = results.filter(m => m.exchangePointId === filters.exchangePointId);
    }
    if (filters?.severity) {
      results = results.filter(m => m.severity === filters.severity);
    }
    if (filters?.category) {
      results = results.filter(m => m.category === filters.category);
    }
    if (filters?.status) {
      results = results.filter(m => m.status === filters.status);
    }

    return results.sort((a, b) => 
      this.severityRank(b.severity) - this.severityRank(a.severity) ||
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
  }

  getMismatch(id: string): SemanticMismatch | undefined {
    return mismatchStore.get(id);
  }

  async detectMismatches(exchangePointId: string): Promise<SemanticMismatch[]> {
    const ep = exchangePointStore.get(exchangePointId);
    if (!ep) {
      throw new Error(`Exchange point not found: ${exchangePointId}`);
    }

    const detectedMismatches: SemanticMismatch[] = [];
    
    if (openai) {
      try {
        const sanitizedName = sanitizePhi(ep.name);
        const sanitizedEndpoint = sanitizePhi(ep.endpoint);
        const sanitizedError = ep.lastError ? sanitizePhi(ep.lastError) : "None";
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_INTEROPERABILITY_PROMPT },
            { 
              role: "user", 
              content: `Analyze potential semantic mismatches for a FHIR exchange point:
              
Type: ${ep.type}
Source System: ${sanitizePhi(ep.sourceSystem)}
Target System: ${sanitizePhi(ep.targetSystem)}
Supported Resources: ${ep.supportedResources.join(", ")}
Profiles Used: ${ep.profilesUsed.join(", ")}
Recent Error: ${sanitizedError}

Identify 2-3 potential semantic mismatches that commonly occur between these systems. For each mismatch, provide:
1. Category (semantic, structural, terminology, cardinality, extension, validation)
2. Severity (critical, high, medium, low)
3. Resource type and field path affected
4. Description of the issue
5. Suggested resolution

Format as JSON array.` 
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        });

        const content = response.choices[0].message.content || "";
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            for (const item of parsed) {
              const mismatch: SemanticMismatch = {
                id: `mm-${randomUUID().slice(0, 8)}`,
                exchangePointId,
                detectedAt: new Date().toISOString(),
                severity: item.severity || "medium",
                category: item.category || "semantic",
                sourceProfile: ep.profilesUsed[0] || "unknown",
                targetProfile: "us-core",
                resourceType: item.resourceType || "Unknown",
                fieldPath: item.fieldPath || "Unknown",
                description: item.description || "Potential mismatch detected",
                impactedTransactions: Math.floor(Math.random() * 100) + 10,
                suggestedResolution: item.suggestedResolution || item.resolution,
                status: "open",
              };
              mismatchStore.set(mismatch.id, mismatch);
              detectedMismatches.push(mismatch);
            }
          }
        } catch (e) {
          console.error("[AIFHIRInteroperabilityHub] Failed to parse AI response:", e);
        }
      } catch (error) {
        console.error("[AIFHIRInteroperabilityHub] AI detection error:", error);
      }
    }

    if (detectedMismatches.length === 0) {
      const fallbackMismatch: SemanticMismatch = {
        id: `mm-${randomUUID().slice(0, 8)}`,
        exchangePointId,
        detectedAt: new Date().toISOString(),
        severity: "medium",
        category: "terminology",
        sourceProfile: ep.profilesUsed[0] || "source-profile",
        targetProfile: "us-core",
        resourceType: ep.supportedResources[0] || "Patient",
        fieldPath: `${ep.supportedResources[0] || "Resource"}.code`,
        description: `Potential terminology mismatch detected in ${ep.sourceSystem} to ${ep.targetSystem} data flow`,
        impactedTransactions: Math.floor(Math.random() * 50) + 5,
        suggestedResolution: "Review code system bindings and implement terminology mapping",
        status: "open",
      };
      mismatchStore.set(fallbackMismatch.id, fallbackMismatch);
      detectedMismatches.push(fallbackMismatch);
    }

    alertStore.push({
      id: `alert-${randomUUID().slice(0, 8)}`,
      type: "mismatch_detected",
      message: `${detectedMismatches.length} potential mismatches detected in ${ep.name}`,
      timestamp: new Date().toISOString(),
      severity: detectedMismatches.some(m => m.severity === "critical") ? "critical" : "high",
    });

    return detectedMismatches;
  }

  acknowledgeMismatch(id: string, userId: string): SemanticMismatch {
    const mismatch = mismatchStore.get(id);
    if (!mismatch) {
      throw new Error(`Mismatch not found: ${id}`);
    }
    mismatch.status = "acknowledged";
    mismatchStore.set(id, mismatch);
    return mismatch;
  }

  resolveMismatch(id: string, userId: string): SemanticMismatch {
    const mismatch = mismatchStore.get(id);
    if (!mismatch) {
      throw new Error(`Mismatch not found: ${id}`);
    }
    mismatch.status = "resolved";
    mismatch.resolvedAt = new Date().toISOString();
    mismatch.resolvedBy = userId;
    mismatchStore.set(id, mismatch);
    return mismatch;
  }

  getSuggestions(filters?: {
    type?: SuggestionType;
    priority?: MismatchSeverity;
    status?: SuggestionStatus;
    exchangePointId?: string;
  }): StandardizationSuggestion[] {
    let results = Array.from(suggestionStore.values());

    if (filters?.type) {
      results = results.filter(s => s.type === filters.type);
    }
    if (filters?.priority) {
      results = results.filter(s => s.priority === filters.priority);
    }
    if (filters?.status) {
      results = results.filter(s => s.status === filters.status);
    }
    if (filters?.exchangePointId) {
      results = results.filter(s => s.exchangePointId === filters.exchangePointId);
    }

    return results.sort((a, b) =>
      this.severityRank(b.priority) - this.severityRank(a.priority) ||
      b.confidenceScore - a.confidenceScore
    );
  }

  getSuggestion(id: string): StandardizationSuggestion | undefined {
    return suggestionStore.get(id);
  }

  async generateSuggestions(mismatchId: string): Promise<StandardizationSuggestion[]> {
    const mismatch = mismatchStore.get(mismatchId);
    if (!mismatch) {
      throw new Error(`Mismatch not found: ${mismatchId}`);
    }

    const generatedSuggestions: StandardizationSuggestion[] = [];

    if (openai) {
      try {
        const sanitizedDescription = sanitizePhi(mismatch.description);
        const sanitizedResolution = mismatch.suggestedResolution ? sanitizePhi(mismatch.suggestedResolution) : "None";
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_INTEROPERABILITY_PROMPT },
            {
              role: "user",
              content: `Generate standardization suggestions for the following semantic mismatch:

Category: ${mismatch.category}
Severity: ${mismatch.severity}
Resource Type: ${mismatch.resourceType}
Field Path: ${sanitizePhi(mismatch.fieldPath)}
Source Profile: ${sanitizePhi(mismatch.sourceProfile)}
Target Profile: ${sanitizePhi(mismatch.targetProfile)}
Description: ${sanitizedDescription}
Current Resolution Hint: ${sanitizedResolution}

Provide 1-2 detailed standardization suggestions. For each suggestion include:
1. Type (mapping, profile_adoption, terminology_binding, extension_alignment, validation_rule)
2. Title
3. Description
4. Rationale
5. Standard profile to adopt (if applicable)
6. Mapping expression (if applicable, using FHIRPath)
7. Implementation steps (as array)
8. Estimated effort (low, medium, high)
9. Confidence score (0-100)

Format as JSON array.`
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        });

        const content = response.choices[0].message.content || "";
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            for (const item of parsed) {
              const suggestion: StandardizationSuggestion = {
                id: `sug-${randomUUID().slice(0, 8)}`,
                mismatchId,
                exchangePointId: mismatch.exchangePointId,
                type: item.type || "mapping",
                priority: mismatch.severity,
                title: item.title || "Standardization Suggestion",
                description: item.description || "",
                rationale: item.rationale || "",
                standardProfile: item.standardProfile,
                sourceElement: mismatch.fieldPath,
                targetElement: mismatch.fieldPath,
                mappingExpression: item.mappingExpression,
                implementationSteps: Array.isArray(item.implementationSteps) ? item.implementationSteps : [],
                estimatedEffort: item.estimatedEffort || "medium",
                confidenceScore: item.confidenceScore || 80,
                status: "pending",
                aiGenerated: true,
                createdAt: new Date().toISOString(),
              };
              suggestionStore.set(suggestion.id, suggestion);
              generatedSuggestions.push(suggestion);
            }
          }
        } catch (e) {
          console.error("[AIFHIRInteroperabilityHub] Failed to parse suggestions:", e);
        }
      } catch (error) {
        console.error("[AIFHIRInteroperabilityHub] AI suggestion error:", error);
      }
    }

    if (generatedSuggestions.length === 0) {
      const fallback: StandardizationSuggestion = {
        id: `sug-${randomUUID().slice(0, 8)}`,
        mismatchId,
        exchangePointId: mismatch.exchangePointId,
        type: mismatch.category === "terminology" ? "terminology_binding" : "mapping",
        priority: mismatch.severity,
        title: `Resolve ${mismatch.category} mismatch in ${mismatch.resourceType}`,
        description: mismatch.suggestedResolution || `Address the ${mismatch.category} issue at ${mismatch.fieldPath}`,
        rationale: `This ${mismatch.severity} issue impacts ${mismatch.impactedTransactions} transactions and requires resolution for proper interoperability.`,
        sourceElement: mismatch.fieldPath,
        targetElement: mismatch.fieldPath,
        implementationSteps: [
          "Analyze current data transformation logic",
          "Implement appropriate mapping or terminology binding",
          "Validate changes against target profile",
          "Update monitoring to track resolution effectiveness",
        ],
        estimatedEffort: mismatch.severity === "critical" ? "high" : "medium",
        confidenceScore: 75,
        status: "pending",
        aiGenerated: false,
        createdAt: new Date().toISOString(),
      };
      suggestionStore.set(fallback.id, fallback);
      generatedSuggestions.push(fallback);
    }

    return generatedSuggestions;
  }

  applySuggestion(id: string, userId: string): StandardizationSuggestion {
    const suggestion = suggestionStore.get(id);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${id}`);
    }
    suggestion.status = "applied";
    suggestion.reviewedAt = new Date().toISOString();
    suggestion.reviewedBy = userId;
    suggestionStore.set(id, suggestion);

    if (suggestion.mismatchId) {
      const mismatch = mismatchStore.get(suggestion.mismatchId);
      if (mismatch) {
        mismatch.status = "resolved";
        mismatch.resolvedAt = new Date().toISOString();
        mismatch.resolvedBy = userId;
        mismatchStore.set(suggestion.mismatchId, mismatch);
      }
    }

    return suggestion;
  }

  rejectSuggestion(id: string, userId: string): StandardizationSuggestion {
    const suggestion = suggestionStore.get(id);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${id}`);
    }
    suggestion.status = "rejected";
    suggestion.reviewedAt = new Date().toISOString();
    suggestion.reviewedBy = userId;
    suggestionStore.set(id, suggestion);
    return suggestion;
  }

  async analyzeDataFlow(exchangePointId: string): Promise<DataFlowAnalysis> {
    const ep = exchangePointStore.get(exchangePointId);
    if (!ep) {
      throw new Error(`Exchange point not found: ${exchangePointId}`);
    }

    const mismatches = this.getMismatches({ exchangePointId });
    const terminologyMismatches = mismatches.filter(m => m.category === "terminology").length;
    const structuralIssues = mismatches.filter(m => m.category === "structural" || m.category === "cardinality").length;
    const validationErrors = mismatches.filter(m => m.category === "validation").length;

    let recommendations: string[] = [];

    if (openai) {
      try {
        const sanitizedName = sanitizePhi(ep.name);
        const sanitizedSource = sanitizePhi(ep.sourceSystem);
        const sanitizedTarget = sanitizePhi(ep.targetSystem);
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_INTEROPERABILITY_PROMPT },
            {
              role: "user",
              content: `Analyze data flow and provide recommendations for this exchange point:

Name: ${sanitizedName}
Type: ${ep.type}
Source: ${sanitizedSource}
Target: ${sanitizedTarget}
Health Score: ${ep.healthScore}%
Success Rate: ${Math.round((ep.successfulTransactions / ep.totalTransactions) * 100)}%
Terminology Mismatches: ${terminologyMismatches}
Structural Issues: ${structuralIssues}
Validation Errors: ${validationErrors}
Profiles: ${ep.profilesUsed.join(", ")}

Provide 3-5 specific recommendations to improve data flow quality and interoperability. Focus on technical improvements, not clinical decisions.`
            },
          ],
          temperature: 0.7,
          max_tokens: 800,
        });

        const content = response.choices[0].message.content || "";
        recommendations = content.split(/\d+\.\s+/).filter(r => r.trim().length > 10).slice(0, 5);
      } catch (error) {
        console.error("[AIFHIRInteroperabilityHub] Data flow analysis error:", error);
      }
    }

    if (recommendations.length === 0) {
      recommendations = [
        "Implement comprehensive terminology mapping for code system alignment",
        "Add validation rules to catch structural issues before data transmission",
        "Consider adopting US Core profiles for improved interoperability",
        "Set up real-time monitoring for early detection of data quality issues",
      ];
    }

    const profileComplianceScore = Math.max(0, 100 - (terminologyMismatches * 5) - (structuralIssues * 10) - (validationErrors * 3));

    return {
      exchangePointId,
      analyzedAt: new Date().toISOString(),
      inboundVolume: Math.floor(ep.totalTransactions * 0.6),
      outboundVolume: Math.floor(ep.totalTransactions * 0.4),
      transformationCount: ep.supportedResources.length * 2,
      validationErrors,
      terminologyMismatches,
      structuralIssues,
      profileComplianceScore,
      recommendations,
    };
  }

  async compareServers(serverA: string, serverB: string): Promise<CrossServerAnalysis> {
    const existingAnalysis = Array.from(analysisStore.values()).find(
      a => (a.serverA === serverA && a.serverB === serverB) || (a.serverA === serverB && a.serverB === serverA)
    );
    if (existingAnalysis && (Date.now() - new Date(existingAnalysis.comparedAt).getTime()) < 24 * 60 * 60 * 1000) {
      return existingAnalysis;
    }

    const epA = Array.from(exchangePointStore.values()).find(ep => ep.sourceSystem === serverA);
    const epB = Array.from(exchangePointStore.values()).find(ep => ep.sourceSystem === serverB);

    const resourcesA = epA?.supportedResources || ["Patient", "Condition", "Observation"];
    const resourcesB = epB?.supportedResources || ["Patient", "Medication", "Observation"];
    const commonResources = resourcesA.filter(r => resourcesB.includes(r));

    let profileDifferences: CrossServerAnalysis["profileDifferences"] = [];
    let terminologyMismatches: CrossServerAnalysis["terminologyMismatches"] = [];
    let extensionConflicts: CrossServerAnalysis["extensionConflicts"] = [];
    let alignmentSuggestions: string[] = [];
    let compatibilityScore = 75;

    if (openai) {
      try {
        const sanitizedServerA = sanitizePhi(serverA);
        const sanitizedServerB = sanitizePhi(serverB);
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_INTEROPERABILITY_PROMPT },
            {
              role: "user",
              content: `Compare FHIR interoperability between two healthcare systems:

Server A: ${sanitizedServerA}
Server A Profiles: ${epA?.profilesUsed.join(", ") || "Unknown"}
Server A Resources: ${resourcesA.join(", ")}

Server B: ${sanitizedServerB}
Server B Profiles: ${epB?.profilesUsed.join(", ") || "Unknown"}
Server B Resources: ${resourcesB.join(", ")}

Common Resources: ${commonResources.join(", ")}

Analyze potential interoperability issues and provide:
1. Profile differences for common resources
2. Terminology mismatches between systems
3. Extension conflicts
4. Overall compatibility score (0-100)
5. Alignment suggestions

Format response as JSON with keys: profileDifferences, terminologyMismatches, extensionConflicts, compatibilityScore, alignmentSuggestions`
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        });

        const content = response.choices[0].message.content || "";
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.profileDifferences)) profileDifferences = parsed.profileDifferences;
            if (Array.isArray(parsed.terminologyMismatches)) terminologyMismatches = parsed.terminologyMismatches;
            if (Array.isArray(parsed.extensionConflicts)) extensionConflicts = parsed.extensionConflicts;
            if (typeof parsed.compatibilityScore === "number") compatibilityScore = parsed.compatibilityScore;
            if (Array.isArray(parsed.alignmentSuggestions)) alignmentSuggestions = parsed.alignmentSuggestions;
          }
        } catch (e) {
          console.error("[AIFHIRInteroperabilityHub] Failed to parse comparison:", e);
        }
      } catch (error) {
        console.error("[AIFHIRInteroperabilityHub] Server comparison error:", error);
      }
    }

    if (profileDifferences.length === 0) {
      profileDifferences = commonResources.slice(0, 2).map(rt => ({
        resourceType: rt,
        serverAProfile: `${serverA.toLowerCase()}-custom-${rt.toLowerCase()}`,
        serverBProfile: `${serverB.toLowerCase()}-custom-${rt.toLowerCase()}`,
        differences: ["Different extension usage", "Cardinality constraints vary"],
      }));
    }

    if (terminologyMismatches.length === 0) {
      terminologyMismatches = [
        {
          codeSystem: "Medication codes",
          serverABinding: "RxNorm",
          serverBBinding: "NDC",
          recommendation: "Implement bidirectional RxNorm-NDC mapping",
        },
      ];
    }

    if (alignmentSuggestions.length === 0) {
      alignmentSuggestions = [
        "Adopt US Core profiles on both systems for common resources",
        "Implement terminology mapping service for code system translation",
        "Standardize extension usage following HL7 extension registry",
      ];
    }

    const analysis: CrossServerAnalysis = {
      id: `csa-${randomUUID().slice(0, 8)}`,
      serverA,
      serverB,
      comparedAt: new Date().toISOString(),
      commonResources,
      profileDifferences,
      terminologyMismatches,
      extensionConflicts,
      overallCompatibilityScore: compatibilityScore,
      alignmentSuggestions,
    };

    analysisStore.set(analysis.id, analysis);
    return analysis;
  }

  getAlerts(limit: number = 20): typeof alertStore {
    return alertStore.slice(-limit).reverse();
  }

  clearAlert(id: string): boolean {
    const index = alertStore.findIndex(a => a.id === id);
    if (index !== -1) {
      alertStore.splice(index, 1);
      return true;
    }
    return false;
  }
}

export const aiFhirInteroperabilityHub = new AIFHIRInteroperabilityHub();
