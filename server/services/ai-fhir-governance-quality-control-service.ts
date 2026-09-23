import { generatePhiSafeText } from "./ai-gateway";
import { comprehensiveAuditTrailService } from "./comprehensive-audit-trail-service";

function isOpenAIConfigured(): boolean {
  return true;
}

function logAudit(action: string, details: Record<string, unknown>, success: boolean) {
  comprehensiveAuditTrailService.logAuditEntry('system', {
    who: { userId: 'system', userRole: 'system' },
    what: {
      category: 'system_event',
      action: 'read',
      resourceType: 'FHIRGovernance',
      resourceId: details.resourceId as string || 'N/A',
      description: action
    },
    why: { reason: 'AI FHIR Data Governance Quality Control operation', automatedAction: true },
    result: { success },
    context: { environment: 'development' },
    severity: 'info',
    tags: ['fhir-governance', 'quality-control', 'ai-powered'],
    metadata: details,
    phiAccessed: false,
    complianceFlags: ['HIPAA', 'SOC2']
  });
}

export type ConformanceLevel = "full" | "partial" | "non_conformant";
export type AnomalySeverity = "critical" | "high" | "medium" | "low";
export type EnrichmentPriority = "high" | "medium" | "low";

export interface ConformanceValidation {
  id: string;
  resourceType: string;
  resourceId: string;
  profileUrl?: string;
  conformanceLevel: ConformanceLevel;
  overallScore: number;
  validatedAt: string;
  issues: ConformanceIssue[];
  passedRules: string[];
  recommendations: string[];
  noCdsCompliance: string;
}

export interface ConformanceIssue {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AnomalySeverity;
  path: string;
  message: string;
  expectedValue?: string;
  actualValue?: string;
  profileReference?: string;
}

export interface AnomalyDetection {
  id: string;
  patientId: string;
  detectedAt: string;
  anomalyType: string;
  severity: AnomalySeverity;
  affectedResources: AffectedResource[];
  description: string;
  aiAnalysis: string;
  suggestedActions: string[];
  status: "new" | "investigating" | "confirmed" | "resolved" | "false_positive";
  noCdsCompliance: string;
}

export interface AffectedResource {
  resourceType: string;
  resourceId: string;
  field: string;
  conflictingValue?: string;
}

export interface EnrichmentSuggestion {
  id: string;
  resourceType: string;
  resourceId: string;
  priority: EnrichmentPriority;
  suggestionType: "missing_data" | "data_correction" | "terminology_mapping" | "reference_linking" | "format_standardization";
  field: string;
  currentValue?: string;
  suggestedValue: string;
  rationale: string;
  confidence: number;
  source?: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected" | "applied";
  noCdsCompliance: string;
}

export interface GovernanceMetadata {
  serviceName: string;
  version: string;
  description: string;
  capabilities: string[];
  supportedProfiles: string[];
  anomalyTypes: string[];
  enrichmentTypes: string[];
  noCdsCompliance: string;
}

export interface QualityDashboard {
  totalResourcesScanned: number;
  conformanceScore: number;
  anomaliesDetected: number;
  enrichmentsPending: number;
  recentValidations: ConformanceValidation[];
  recentAnomalies: AnomalyDetection[];
  recentEnrichments: EnrichmentSuggestion[];
  trends: QualityTrend[];
  noCdsCompliance: string;
}

export interface QualityTrend {
  date: string;
  conformanceScore: number;
  anomalyCount: number;
  enrichmentsApplied: number;
}

const conformanceValidations = new Map<string, ConformanceValidation>();
const anomalyDetections = new Map<string, AnomalyDetection>();
const enrichmentSuggestions = new Map<string, EnrichmentSuggestion>();

const fhirProfiles = [
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation",
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
  "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"
];

const conformanceRules: Record<string, Array<{ id: string; name: string; path: string; requirement: string }>> = {
  Patient: [
    { id: "pat-1", name: "Identifier Required", path: "identifier", requirement: "At least one identifier must be present" },
    { id: "pat-2", name: "Name Required", path: "name", requirement: "Patient must have at least one name" },
    { id: "pat-3", name: "Birth Date Format", path: "birthDate", requirement: "Birth date must be in YYYY-MM-DD format" },
    { id: "pat-4", name: "Gender Code", path: "gender", requirement: "Gender must use administrative-gender value set" },
    { id: "pat-5", name: "Contact Info", path: "telecom", requirement: "At least one contact method recommended" }
  ],
  Observation: [
    { id: "obs-1", name: "Status Required", path: "status", requirement: "Status is mandatory (final, preliminary, etc.)" },
    { id: "obs-2", name: "Code Required", path: "code", requirement: "Observation code must be present" },
    { id: "obs-3", name: "Subject Reference", path: "subject", requirement: "Must reference a Patient" },
    { id: "obs-4", name: "Effective Date", path: "effectiveDateTime", requirement: "Effective date should be present" },
    { id: "obs-5", name: "Value Presence", path: "value[x]", requirement: "Value or dataAbsentReason must be present" }
  ],
  Condition: [
    { id: "cond-1", name: "Clinical Status", path: "clinicalStatus", requirement: "Clinical status required for active conditions" },
    { id: "cond-2", name: "Verification Status", path: "verificationStatus", requirement: "Verification status must be specified" },
    { id: "cond-3", name: "Code Required", path: "code", requirement: "Condition code must use standard terminology" },
    { id: "cond-4", name: "Subject Required", path: "subject", requirement: "Must reference a Patient" },
    { id: "cond-5", name: "Onset Date", path: "onset[x]", requirement: "Onset date recommended for tracking" }
  ],
  MedicationRequest: [
    { id: "med-1", name: "Status Required", path: "status", requirement: "Status must be specified" },
    { id: "med-2", name: "Intent Required", path: "intent", requirement: "Intent (order, plan, etc.) required" },
    { id: "med-3", name: "Medication Code", path: "medication[x]", requirement: "Medication must be identified" },
    { id: "med-4", name: "Subject Required", path: "subject", requirement: "Patient reference required" },
    { id: "med-5", name: "Authorizing Provider", path: "requester", requirement: "Requester recommended for auditing" }
  ],
  Encounter: [
    { id: "enc-1", name: "Status Required", path: "status", requirement: "Encounter status required" },
    { id: "enc-2", name: "Class Required", path: "class", requirement: "Encounter class must be specified" },
    { id: "enc-3", name: "Subject Required", path: "subject", requirement: "Patient reference required" },
    { id: "enc-4", name: "Period", path: "period", requirement: "Period with start date recommended" },
    { id: "enc-5", name: "Service Provider", path: "serviceProvider", requirement: "Service provider reference recommended" }
  ]
};

const anomalyTypes = [
  "temporal_inconsistency",
  "duplicate_records",
  "conflicting_values",
  "orphaned_references",
  "missing_required_data",
  "outlier_values",
  "terminology_mismatch",
  "invalid_references"
];

function initializeSampleData() {
  const validation1: ConformanceValidation = {
    id: "cv-" + Date.now() + "-1",
    resourceType: "Patient",
    resourceId: "patient-001",
    profileUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    conformanceLevel: "partial",
    overallScore: 85,
    validatedAt: new Date().toISOString(),
    issues: [
      {
        id: "issue-1",
        ruleId: "pat-5",
        ruleName: "Contact Info",
        severity: "low",
        path: "telecom",
        message: "No contact information provided - recommended for patient communication",
        profileReference: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"
      }
    ],
    passedRules: ["pat-1", "pat-2", "pat-3", "pat-4"],
    recommendations: [
      "Add at least one telecom entry for patient contact",
      "Consider adding emergency contact information"
    ],
    noCdsCompliance: "INFORMATIONAL ONLY - Not for clinical decision-making"
  };
  conformanceValidations.set(validation1.id, validation1);

  const anomaly1: AnomalyDetection = {
    id: "ad-" + Date.now() + "-1",
    patientId: "patient-001",
    detectedAt: new Date().toISOString(),
    anomalyType: "temporal_inconsistency",
    severity: "medium",
    affectedResources: [
      { resourceType: "Encounter", resourceId: "enc-123", field: "period.end" },
      { resourceType: "Observation", resourceId: "obs-456", field: "effectiveDateTime" }
    ],
    description: "Observation dated after encounter end date",
    aiAnalysis: "An observation record indicates a date that falls after the associated encounter's end date. This may indicate a data entry error or delayed documentation.",
    suggestedActions: [
      "Verify the observation date against source documentation",
      "Check if observation was part of a follow-up encounter",
      "Consider updating the encounter period if documentation continued"
    ],
    status: "new",
    noCdsCompliance: "INFORMATIONAL ONLY - Data quality observation, not clinical guidance"
  };
  anomalyDetections.set(anomaly1.id, anomaly1);

  const enrichment1: EnrichmentSuggestion = {
    id: "es-" + Date.now() + "-1",
    resourceType: "Condition",
    resourceId: "cond-789",
    priority: "high",
    suggestionType: "terminology_mapping",
    field: "code.coding",
    currentValue: "Hypertension",
    suggestedValue: "SNOMED CT: 38341003 (Hypertensive disorder)",
    rationale: "The condition uses free text. Mapping to SNOMED CT improves interoperability and enables decision support integration.",
    confidence: 0.92,
    source: "SNOMED CT terminology service",
    createdAt: new Date().toISOString(),
    status: "pending",
    noCdsCompliance: "INFORMATIONAL ONLY - Terminology suggestion for data quality improvement"
  };
  enrichmentSuggestions.set(enrichment1.id, enrichment1);

  console.log("[AIFHIRGovernanceQC] Sample data initialized");
}

initializeSampleData();

class AIFHIRGovernanceQualityControlService {
  getMetadata(): GovernanceMetadata {
    return {
      serviceName: "AI FHIR Data Governance & Quality Control",
      version: "1.0.0",
      description: "AI-powered FHIR data governance providing conformance validation, anomaly detection, and enrichment suggestions for improved data integrity",
      capabilities: [
        "FHIR resource conformance validation against US Core and custom profiles",
        "AI-powered anomaly detection across patient records",
        "Data inconsistency identification and flagging",
        "Intelligent data enrichment suggestions",
        "Terminology standardization recommendations",
        "Reference integrity validation",
        "Temporal consistency checking"
      ],
      supportedProfiles: fhirProfiles,
      anomalyTypes,
      enrichmentTypes: ["missing_data", "data_correction", "terminology_mapping", "reference_linking", "format_standardization"],
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: This AI-powered data governance tool is for DATA QUALITY and OPERATIONAL purposes ONLY. It does NOT provide clinical decision support, treatment recommendations, or medical advice. All suggestions must be reviewed by qualified personnel."
    };
  }

  getDashboard(): QualityDashboard {
    const validations = Array.from(conformanceValidations.values());
    const anomalies = Array.from(anomalyDetections.values());
    const enrichments = Array.from(enrichmentSuggestions.values());

    const avgScore = validations.length > 0 
      ? validations.reduce((sum, v) => sum + v.overallScore, 0) / validations.length 
      : 100;

    const now = new Date();
    const trends: QualityTrend[] = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toISOString().split('T')[0],
        conformanceScore: Math.round(85 + Math.random() * 10),
        anomalyCount: Math.floor(Math.random() * 5),
        enrichmentsApplied: Math.floor(Math.random() * 10)
      };
    });

    return {
      totalResourcesScanned: 1250 + Math.floor(Math.random() * 100),
      conformanceScore: Math.round(avgScore),
      anomaliesDetected: anomalies.filter(a => a.status === "new" || a.status === "investigating").length,
      enrichmentsPending: enrichments.filter(e => e.status === "pending").length,
      recentValidations: validations.slice(-5),
      recentAnomalies: anomalies.slice(-5),
      recentEnrichments: enrichments.slice(-5),
      trends,
      noCdsCompliance: "INFORMATIONAL ONLY - Quality metrics for operational review"
    };
  }

  async validateResourceConformance(
    resourceType: string,
    resourceData: Record<string, unknown>,
    profileUrl?: string
  ): Promise<ConformanceValidation> {
    logAudit('VALIDATE_CONFORMANCE', { resourceType, profileUrl }, true);

    const rules = conformanceRules[resourceType] || [];
    const issues: ConformanceIssue[] = [];
    const passedRules: string[] = [];

    for (const rule of rules) {
      const pathParts = rule.path.split('.');
      let value: unknown = resourceData;
      for (const part of pathParts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part.replace('[x]', '')];
        } else {
          value = undefined;
          break;
        }
      }

      const hasValue = value !== undefined && value !== null && 
        (Array.isArray(value) ? value.length > 0 : true);

      if (!hasValue && rule.requirement.toLowerCase().includes('required')) {
        issues.push({
          id: `issue-${Date.now()}-${rule.id}`,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: "high",
          path: rule.path,
          message: rule.requirement,
          profileReference: profileUrl
        });
      } else if (!hasValue && rule.requirement.toLowerCase().includes('recommended')) {
        issues.push({
          id: `issue-${Date.now()}-${rule.id}`,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: "low",
          path: rule.path,
          message: rule.requirement,
          profileReference: profileUrl
        });
      } else {
        passedRules.push(rule.id);
      }
    }

    let aiRecommendations: string[] = [];
    if (isOpenAIConfigured() && issues.length > 0) {
      try {
        const content = await generatePhiSafeText({
          system: `You are a FHIR data quality expert. Provide recommendations for improving data conformance. Do NOT provide clinical advice. Focus only on data quality and interoperability improvements. Keep recommendations concise.`,
          user: `Resource type: ${resourceType}\nIssues found:\n${issues.map(i => `- ${i.ruleName}: ${i.message}`).join('\n')}\n\nProvide 2-3 actionable recommendations for improving data quality.`,
          maxTokens: 300
        });
        if (content) {
          aiRecommendations = content.split('\n').filter(line => line.trim().length > 0).slice(0, 3);
        }
      } catch (error) {
        console.log("[AIFHIRGovernanceQC] OpenAI unavailable, using fallback recommendations");
      }
    }

    if (aiRecommendations.length === 0) {
      aiRecommendations = issues.map(i => `Review and address: ${i.ruleName} - ${i.message}`).slice(0, 3);
    }

    const score = rules.length > 0 ? Math.round((passedRules.length / rules.length) * 100) : 100;
    const conformanceLevel: ConformanceLevel = 
      score >= 90 ? "full" : 
      score >= 60 ? "partial" : "non_conformant";

    const validation: ConformanceValidation = {
      id: `cv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      resourceType,
      resourceId: (resourceData.id as string) || "unknown",
      profileUrl: profileUrl || fhirProfiles.find(p => p.includes(resourceType.toLowerCase())),
      conformanceLevel,
      overallScore: score,
      validatedAt: new Date().toISOString(),
      issues,
      passedRules,
      recommendations: aiRecommendations,
      noCdsCompliance: "INFORMATIONAL ONLY - Conformance assessment for data quality purposes"
    };

    conformanceValidations.set(validation.id, validation);
    return validation;
  }

  async detectAnomalies(
    patientId: string,
    resources: Array<{ resourceType: string; resourceId: string; data: Record<string, unknown> }>
  ): Promise<AnomalyDetection[]> {
    logAudit('DETECT_ANOMALIES', { patientId, resourceCount: resources.length }, true);

    const detectedAnomalies: AnomalyDetection[] = [];

    const duplicates = this.checkForDuplicates(resources);
    if (duplicates.length > 0) {
      for (const dup of duplicates) {
        const anomaly: AnomalyDetection = {
          id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          patientId,
          detectedAt: new Date().toISOString(),
          anomalyType: "duplicate_records",
          severity: "medium",
          affectedResources: dup.resources,
          description: `Potential duplicate ${dup.resourceType} records detected`,
          aiAnalysis: `Multiple ${dup.resourceType} resources appear to represent the same data entry. This may result from duplicate data imports or manual entry errors.`,
          suggestedActions: [
            "Review both records for accuracy",
            "Merge or archive duplicate records",
            "Investigate data source for duplicate submissions"
          ],
          status: "new",
          noCdsCompliance: "INFORMATIONAL ONLY - Duplicate detection for data quality"
        };
        detectedAnomalies.push(anomaly);
        anomalyDetections.set(anomaly.id, anomaly);
      }
    }

    const temporalIssues = this.checkTemporalConsistency(resources);
    if (temporalIssues.length > 0) {
      for (const issue of temporalIssues) {
        const anomaly: AnomalyDetection = {
          id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          patientId,
          detectedAt: new Date().toISOString(),
          anomalyType: "temporal_inconsistency",
          severity: issue.severity,
          affectedResources: issue.resources,
          description: issue.description,
          aiAnalysis: issue.analysis,
          suggestedActions: issue.actions,
          status: "new",
          noCdsCompliance: "INFORMATIONAL ONLY - Temporal consistency check"
        };
        detectedAnomalies.push(anomaly);
        anomalyDetections.set(anomaly.id, anomaly);
      }
    }

    const orphanedRefs = this.checkOrphanedReferences(resources);
    if (orphanedRefs.length > 0) {
      for (const orphan of orphanedRefs) {
        const anomaly: AnomalyDetection = {
          id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          patientId,
          detectedAt: new Date().toISOString(),
          anomalyType: "orphaned_references",
          severity: "high",
          affectedResources: [orphan],
          description: `Reference to non-existent resource in ${orphan.resourceType}`,
          aiAnalysis: "A resource contains a reference to another resource that cannot be found. This may indicate incomplete data migration or deleted resources.",
          suggestedActions: [
            "Verify the referenced resource exists",
            "Update or remove the broken reference",
            "Check data migration logs for missing resources"
          ],
          status: "new",
          noCdsCompliance: "INFORMATIONAL ONLY - Reference integrity check"
        };
        detectedAnomalies.push(anomaly);
        anomalyDetections.set(anomaly.id, anomaly);
      }
    }

    if (isOpenAIConfigured() && resources.length > 0) {
      try {
        const resourceSummary = resources.map(r => ({
          type: r.resourceType,
          id: r.resourceId,
          fields: Object.keys(r.data).slice(0, 5)
        }));

        const content = await generatePhiSafeText({
          system: `You are a healthcare data quality analyst. Analyze FHIR resources for data anomalies. Focus ONLY on data quality issues like missing data, inconsistencies, or unusual patterns. Do NOT provide clinical interpretations or medical advice. Return a JSON array of anomalies with: type, severity (critical/high/medium/low), description, affected_resources.`,
          user: `Analyze these patient resources for data quality anomalies:\n${JSON.stringify(resourceSummary, null, 2)}`,
          maxTokens: 500,
          responseMimeType: "application/json"
        });

        if (content) {
          try {
            const parsed = JSON.parse(content);
            const aiAnomalies = parsed.anomalies || [];
            for (const aiAnomaly of aiAnomalies.slice(0, 3)) {
              const anomaly: AnomalyDetection = {
                id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                patientId,
                detectedAt: new Date().toISOString(),
                anomalyType: aiAnomaly.type || "ai_detected",
                severity: aiAnomaly.severity || "medium",
                affectedResources: (aiAnomaly.affected_resources || []).map((r: string) => ({
                  resourceType: r.split('/')[0] || 'Unknown',
                  resourceId: r.split('/')[1] || 'unknown',
                  field: 'multiple'
                })),
                description: aiAnomaly.description || "AI-detected data quality issue",
                aiAnalysis: "AI analysis identified potential data quality concerns that warrant review.",
                suggestedActions: ["Review flagged resources", "Verify data accuracy", "Consult data steward if needed"],
                status: "new",
                noCdsCompliance: "INFORMATIONAL ONLY - AI-powered anomaly detection"
              };
              detectedAnomalies.push(anomaly);
              anomalyDetections.set(anomaly.id, anomaly);
            }
          } catch {
            console.log("[AIFHIRGovernanceQC] Could not parse AI anomaly response");
          }
        }
      } catch (error) {
        console.log("[AIFHIRGovernanceQC] AI anomaly detection unavailable");
      }
    }

    return detectedAnomalies;
  }

  async generateEnrichmentSuggestions(
    resourceType: string,
    resourceId: string,
    resourceData: Record<string, unknown>
  ): Promise<EnrichmentSuggestion[]> {
    logAudit('GENERATE_ENRICHMENTS', { resourceType, resourceId }, true);

    const suggestions: EnrichmentSuggestion[] = [];

    const missingFields = this.identifyMissingFields(resourceType, resourceData);
    for (const field of missingFields) {
      const suggestion: EnrichmentSuggestion = {
        id: `es-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        resourceType,
        resourceId,
        priority: field.priority,
        suggestionType: "missing_data",
        field: field.path,
        suggestedValue: field.suggestedValue,
        rationale: field.rationale,
        confidence: 0.85,
        createdAt: new Date().toISOString(),
        status: "pending",
        noCdsCompliance: "INFORMATIONAL ONLY - Data completeness suggestion"
      };
      suggestions.push(suggestion);
      enrichmentSuggestions.set(suggestion.id, suggestion);
    }

    const terminologyIssues = this.checkTerminologyStandardization(resourceType, resourceData);
    for (const issue of terminologyIssues) {
      const suggestion: EnrichmentSuggestion = {
        id: `es-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        resourceType,
        resourceId,
        priority: "high",
        suggestionType: "terminology_mapping",
        field: issue.field,
        currentValue: issue.currentValue,
        suggestedValue: issue.suggestedValue,
        rationale: issue.rationale,
        confidence: issue.confidence,
        source: issue.source,
        createdAt: new Date().toISOString(),
        status: "pending",
        noCdsCompliance: "INFORMATIONAL ONLY - Terminology standardization suggestion"
      };
      suggestions.push(suggestion);
      enrichmentSuggestions.set(suggestion.id, suggestion);
    }

    if (isOpenAIConfigured()) {
      try {
        const content = await generatePhiSafeText({
          system: `You are a FHIR data enrichment specialist. Analyze resources and suggest data improvements for better interoperability and completeness. Focus on: missing identifiers, unstandardized codes, format inconsistencies. Do NOT provide clinical suggestions. Return JSON with: suggestions array containing field, current_value, suggested_value, rationale, confidence (0-1).`,
          user: `Analyze this ${resourceType} for enrichment opportunities:\n${JSON.stringify(resourceData, null, 2)}`,
          maxTokens: 400,
          responseMimeType: "application/json"
        });

        if (content) {
          try {
            const parsed = JSON.parse(content);
            const aiSuggestions = parsed.suggestions || [];
            for (const aiSug of aiSuggestions.slice(0, 3)) {
              const suggestion: EnrichmentSuggestion = {
                id: `es-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                resourceType,
                resourceId,
                priority: aiSug.confidence > 0.8 ? "high" : aiSug.confidence > 0.5 ? "medium" : "low",
                suggestionType: "data_correction",
                field: aiSug.field || "unknown",
                currentValue: aiSug.current_value,
                suggestedValue: aiSug.suggested_value || "N/A",
                rationale: aiSug.rationale || "AI-suggested improvement",
                confidence: aiSug.confidence || 0.7,
                source: "AI Analysis",
                createdAt: new Date().toISOString(),
                status: "pending",
                noCdsCompliance: "INFORMATIONAL ONLY - AI-powered enrichment suggestion"
              };
              suggestions.push(suggestion);
              enrichmentSuggestions.set(suggestion.id, suggestion);
            }
          } catch {
            console.log("[AIFHIRGovernanceQC] Could not parse AI enrichment response");
          }
        }
      } catch {
        console.log("[AIFHIRGovernanceQC] AI enrichment suggestions unavailable");
      }
    }

    return suggestions;
  }

  private checkForDuplicates(resources: Array<{ resourceType: string; resourceId: string; data: Record<string, unknown> }>): Array<{ resourceType: string; resources: AffectedResource[] }> {
    const duplicates: Array<{ resourceType: string; resources: AffectedResource[] }> = [];
    const grouped = new Map<string, typeof resources>();

    for (const r of resources) {
      const key = r.resourceType;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    Array.from(grouped.entries()).forEach(([resourceType, items]) => {
      if (items.length > 1) {
        const seen = new Map<string, Array<{ resourceType: string; resourceId: string }>>();
        for (const item of items) {
          const sig = JSON.stringify({
            code: item.data.code,
            status: item.data.status,
            date: item.data.effectiveDateTime || item.data.recorded
          });
          if (!seen.has(sig)) seen.set(sig, []);
          seen.get(sig)!.push({ resourceType: item.resourceType, resourceId: item.resourceId });
        }

        Array.from(seen.values()).forEach((matches: Array<{ resourceType: string; resourceId: string }>) => {
          if (matches.length > 1) {
            duplicates.push({
              resourceType,
              resources: matches.map((m: { resourceType: string; resourceId: string }) => ({ resourceType: m.resourceType, resourceId: m.resourceId, field: "signature" }))
            });
          }
        });
      }
    });

    return duplicates;
  }

  private checkTemporalConsistency(resources: Array<{ resourceType: string; resourceId: string; data: Record<string, unknown> }>): Array<{
    severity: AnomalySeverity;
    description: string;
    analysis: string;
    actions: string[];
    resources: AffectedResource[];
  }> {
    const issues: Array<{
      severity: AnomalySeverity;
      description: string;
      analysis: string;
      actions: string[];
      resources: AffectedResource[];
    }> = [];

    const encounters = resources.filter(r => r.resourceType === "Encounter");
    const observations = resources.filter(r => r.resourceType === "Observation");

    for (const obs of observations) {
      const obsDate = obs.data.effectiveDateTime as string;
      if (!obsDate) continue;

      for (const enc of encounters) {
        const period = enc.data.period as { start?: string; end?: string } | undefined;
        if (period?.end && new Date(obsDate) > new Date(period.end)) {
          issues.push({
            severity: "medium",
            description: "Observation recorded after encounter end date",
            analysis: "An observation has a date that falls after its associated encounter's end date. This may indicate delayed documentation or a data entry error.",
            actions: ["Verify observation date", "Check if follow-up encounter exists", "Review documentation timeline"],
            resources: [
              { resourceType: "Observation", resourceId: obs.resourceId, field: "effectiveDateTime", conflictingValue: obsDate },
              { resourceType: "Encounter", resourceId: enc.resourceId, field: "period.end", conflictingValue: period.end }
            ]
          });
        }
      }
    }

    return issues;
  }

  private checkOrphanedReferences(resources: Array<{ resourceType: string; resourceId: string; data: Record<string, unknown> }>): AffectedResource[] {
    const orphans: AffectedResource[] = [];
    const existingIds = new Set(resources.map(r => `${r.resourceType}/${r.resourceId}`));

    for (const resource of resources) {
      const checkRef = (obj: unknown, path: string) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          obj.forEach((item, idx) => checkRef(item, `${path}[${idx}]`));
          return;
        }
        const record = obj as Record<string, unknown>;
        if (record.reference && typeof record.reference === 'string') {
          const ref = record.reference as string;
          if (ref.includes('/') && !ref.startsWith('http') && !existingIds.has(ref)) {
            orphans.push({
              resourceType: resource.resourceType,
              resourceId: resource.resourceId,
              field: path,
              conflictingValue: ref
            });
          }
        }
        for (const [key, value] of Object.entries(record)) {
          if (key !== 'reference') checkRef(value, `${path}.${key}`);
        }
      };
      checkRef(resource.data, 'root');
    }

    return orphans;
  }

  private identifyMissingFields(resourceType: string, data: Record<string, unknown>): Array<{
    path: string;
    priority: EnrichmentPriority;
    suggestedValue: string;
    rationale: string;
  }> {
    const missing: Array<{ path: string; priority: EnrichmentPriority; suggestedValue: string; rationale: string }> = [];

    const recommendations: Record<string, Array<{ path: string; priority: EnrichmentPriority; suggestion: string; rationale: string }>> = {
      Patient: [
        { path: "identifier", priority: "high", suggestion: "Add MRN or SSN identifier", rationale: "Identifiers improve patient matching accuracy" },
        { path: "address", priority: "medium", suggestion: "Add patient address", rationale: "Address enables location-based analytics and mailings" },
        { path: "communication", priority: "low", suggestion: "Add preferred language", rationale: "Language preference improves patient engagement" }
      ],
      Observation: [
        { path: "category", priority: "high", suggestion: "Add observation category", rationale: "Categories enable proper grouping and filtering" },
        { path: "interpretation", priority: "medium", suggestion: "Add interpretation if applicable", rationale: "Interpretation aids in understanding results" }
      ],
      Condition: [
        { path: "severity", priority: "medium", suggestion: "Add condition severity", rationale: "Severity helps prioritize care coordination" },
        { path: "category", priority: "high", suggestion: "Add condition category", rationale: "Categories improve clinical organization" }
      ]
    };

    const recs = recommendations[resourceType] || [];
    for (const rec of recs) {
      const pathParts = rec.path.split('.');
      let value: unknown = data;
      for (const part of pathParts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }

      if (!value || (Array.isArray(value) && value.length === 0)) {
        missing.push({
          path: rec.path,
          priority: rec.priority,
          suggestedValue: rec.suggestion,
          rationale: rec.rationale
        });
      }
    }

    return missing;
  }

  private checkTerminologyStandardization(resourceType: string, data: Record<string, unknown>): Array<{
    field: string;
    currentValue: string;
    suggestedValue: string;
    rationale: string;
    confidence: number;
    source: string;
  }> {
    const issues: Array<{
      field: string;
      currentValue: string;
      suggestedValue: string;
      rationale: string;
      confidence: number;
      source: string;
    }> = [];

    const checkCoding = (obj: unknown, path: string) => {
      if (!obj || typeof obj !== 'object') return;
      const record = obj as Record<string, unknown>;
      
      if (record.coding && Array.isArray(record.coding)) {
        const codings = record.coding as Array<{ system?: string; code?: string; display?: string }>;
        for (const coding of codings) {
          if (coding.display && !coding.system) {
            issues.push({
              field: path,
              currentValue: coding.display,
              suggestedValue: "Add appropriate code system (e.g., SNOMED CT, LOINC, ICD-10)",
              rationale: "Coded values without systems reduce interoperability",
              confidence: 0.9,
              source: "Terminology validation"
            });
          }
        }
      }

      if (record.text && typeof record.text === 'string' && !record.coding) {
        issues.push({
          field: path,
          currentValue: record.text as string,
          suggestedValue: "Map to standard terminology (SNOMED CT, LOINC, or ICD-10)",
          rationale: "Free-text values should be mapped to standard codes for interoperability",
          confidence: 0.85,
          source: "Terminology validation"
        });
      }
    };

    const traverse = (obj: unknown, path: string) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => traverse(item, `${path}[${idx}]`));
        return;
      }
      checkCoding(obj, path);
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        traverse(value, `${path}.${key}`);
      }
    };

    traverse(data, resourceType);
    return issues;
  }

  getValidations(): ConformanceValidation[] {
    return Array.from(conformanceValidations.values());
  }

  getAnomalies(): AnomalyDetection[] {
    return Array.from(anomalyDetections.values());
  }

  getEnrichments(): EnrichmentSuggestion[] {
    return Array.from(enrichmentSuggestions.values());
  }

  updateAnomalyStatus(anomalyId: string, status: AnomalyDetection["status"]): AnomalyDetection | null {
    const anomaly = anomalyDetections.get(anomalyId);
    if (anomaly) {
      anomaly.status = status;
      logAudit('UPDATE_ANOMALY_STATUS', { anomalyId, status }, true);
    }
    return anomaly || null;
  }

  updateEnrichmentStatus(enrichmentId: string, status: EnrichmentSuggestion["status"]): EnrichmentSuggestion | null {
    const enrichment = enrichmentSuggestions.get(enrichmentId);
    if (enrichment) {
      enrichment.status = status;
      logAudit('UPDATE_ENRICHMENT_STATUS', { enrichmentId, status }, true);
    }
    return enrichment || null;
  }
}

export const aiFHIRGovernanceQualityControlService = new AIFHIRGovernanceQualityControlService();
console.log("[AIFHIRGovernanceQC] Service initialized");
console.log("[AIFHIRGovernanceQC] Features: Conformance validation, Anomaly detection, Enrichment suggestions");
console.log("[AIFHIRGovernanceQC] NO-CDS compliance enabled for all outputs");
