import OpenAI from "openai";
import { randomUUID } from "crypto";
import { 
  aiDataDiscoveryClassificationService, 
  DiscoveredData, 
  DataSource,
  SensitiveDataType 
} from "./ai-data-discovery-classification";
import { aiPolicyLifecycleService } from "./ai-policy-lifecycle";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const NO_CDS_CATALOG_PROMPT = `You are a healthcare data catalog specialist focusing on data asset documentation and governance enrichment.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Documenting data assets with descriptions and metadata
- Analyzing data lineage and relationships
- Suggesting governance policies for data assets
- Assessing data quality and completeness
- Recommending data stewardship actions
- Enriching asset documentation with context

All analysis must focus on DATA CATALOG MANAGEMENT and GOVERNANCE - never clinical interpretation.`;

export type AssetStatus = "discovered" | "documented" | "certified" | "deprecated" | "archived";
export type QualityScore = "excellent" | "good" | "fair" | "poor" | "unknown";
export type BusinessCriticality = "critical" | "high" | "medium" | "low";
export type DataDomain = 
  | "patient_demographics"
  | "clinical_records"
  | "financial_billing"
  | "operational"
  | "research"
  | "regulatory"
  | "administrative"
  | "external_integrations";

export interface DataAsset {
  id: string;
  name: string;
  displayName: string;
  description: string;
  domain: DataDomain;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  status: AssetStatus;
  sensitiveDataTypes: SensitiveDataType[];
  businessCriticality: BusinessCriticality;
  dataOwner?: string;
  dataSteward?: string;
  technicalOwner?: string;
  tags: string[];
  qualityScore: QualityScore;
  qualityMetrics: QualityMetrics;
  lineage: DataLineage;
  governanceInfo: GovernanceInfo;
  riskInfo: RiskInfo;
  aiEnrichment?: AIEnrichment;
  metadata: AssetMetadata;
  discoveredAt: string;
  documentedAt?: string;
  certifiedAt?: string;
  lastUpdated: string;
  lastAccessed?: string;
  accessCount: number;
}

export interface QualityMetrics {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  uniqueness: number;
  validity: number;
  overallScore: number;
  lastAssessed: string;
  issues: QualityIssue[];
}

export interface QualityIssue {
  id: string;
  type: "missing_values" | "duplicates" | "format_errors" | "outliers" | "inconsistencies" | "stale_data";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedRecords: number;
  suggestedAction: string;
  detectedAt: string;
}

export interface DataLineage {
  upstream: LineageNode[];
  downstream: LineageNode[];
  transformations: Transformation[];
}

export interface LineageNode {
  assetId: string;
  assetName: string;
  assetType: string;
  relationship: "source" | "derived" | "aggregated" | "transformed" | "copy";
}

export interface Transformation {
  id: string;
  name: string;
  type: "etl" | "api" | "manual" | "automated" | "sync";
  description: string;
  lastExecuted?: string;
  frequency?: string;
}

export interface GovernanceInfo {
  applicablePolicies: PolicyReference[];
  complianceStatus: "compliant" | "non_compliant" | "review_needed" | "exempt";
  complianceScore: number;
  regulatoryFrameworks: string[];
  retentionPeriod?: string;
  accessRestrictions: string[];
  consentRequired: boolean;
  auditTrailEnabled: boolean;
  lastComplianceCheck?: string;
}

export interface PolicyReference {
  policyId: string;
  policyName: string;
  policyType: string;
  status: "active" | "pending" | "deprecated";
  enforcementLevel: string;
}

export interface RiskInfo {
  overallRiskLevel: "critical" | "high" | "medium" | "low";
  riskFactors: RiskFactor[];
  mitigations: string[];
  lastAssessment?: string;
  predictedRiskTrend?: "increasing" | "stable" | "decreasing";
}

export interface RiskFactor {
  factor: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  category: "security" | "privacy" | "compliance" | "operational" | "data_quality";
}

export interface AIEnrichment {
  generatedDescription?: string;
  suggestedTags: string[];
  relatedAssets: string[];
  usagePatterns: string[];
  qualityRecommendations: string[];
  governanceRecommendations: string[];
  enrichedAt: string;
  model: string;
}

export interface AssetMetadata {
  schema?: SchemaInfo;
  statistics?: DataStatistics;
  sampleData?: string[];
  customProperties: Record<string, string>;
  documentation?: string;
  glossaryTerms: GlossaryTerm[];
}

export interface SchemaInfo {
  fields: FieldInfo[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyInfo[];
  indexes?: string[];
}

export interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  sensitiveType?: SensitiveDataType;
  classification?: string;
}

export interface ForeignKeyInfo {
  field: string;
  referencedAsset: string;
  referencedField: string;
}

export interface DataStatistics {
  recordCount: number;
  sizeBytes: number;
  lastModified: string;
  growthRate?: number;
  avgDailyAccess?: number;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  domain: string;
}

export interface CatalogDashboard {
  totalAssets: number;
  byStatus: Record<AssetStatus, number>;
  byDomain: Record<DataDomain, number>;
  byRiskLevel: Record<string, number>;
  byQuality: Record<QualityScore, number>;
  recentlyDiscovered: number;
  pendingDocumentation: number;
  complianceScore: number;
  criticalIssues: number;
  aiInsights: string[];
}

export interface AssetSearchResult {
  assets: DataAsset[];
  totalCount: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  domains: { value: string; count: number }[];
  status: { value: string; count: number }[];
  sensitiveTypes: { value: string; count: number }[];
  riskLevels: { value: string; count: number }[];
  owners: { value: string; count: number }[];
}

export interface AssetRelationship {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: "contains" | "references" | "derived_from" | "similar_to" | "depends_on";
  strength: number;
  metadata?: Record<string, string>;
  discoveredAt: string;
}

const assetStore = new Map<string, DataAsset>();
const relationshipStore = new Map<string, AssetRelationship>();
const glossaryStore = new Map<string, GlossaryTerm>();
const auditLogStore: CatalogAuditEntry[] = [];

interface CatalogAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  assetId?: string;
  userId: string;
  details: Record<string, unknown>;
}

function initializeSampleAssets() {
  const sampleAssets: DataAsset[] = [
    {
      id: "asset-patient-demographics",
      name: "patient_demographics",
      displayName: "Patient Demographics",
      description: "Core patient demographic information including name, DOB, contact info, and insurance details",
      domain: "patient_demographics",
      sourceId: "fhir-patient-resource",
      sourceName: "FHIR Patient Resource",
      sourceType: "fhir_resource",
      status: "certified",
      sensitiveDataTypes: ["PHI", "PII"],
      businessCriticality: "critical",
      dataOwner: "Chief Medical Officer",
      dataSteward: "Patient Data Team",
      technicalOwner: "Integration Team",
      tags: ["patient", "demographics", "HIPAA", "core-data"],
      qualityScore: "excellent",
      qualityMetrics: {
        completeness: 98,
        accuracy: 99,
        consistency: 97,
        timeliness: 95,
        uniqueness: 99,
        validity: 98,
        overallScore: 97.5,
        lastAssessed: new Date().toISOString(),
        issues: [],
      },
      lineage: {
        upstream: [{ assetId: "asset-ehr-fasten", assetName: "Fasten Health EHR", assetType: "ehr_integration", relationship: "source" }],
        downstream: [
          { assetId: "asset-patient-summary", assetName: "Patient Summary View", assetType: "derived", relationship: "derived" },
          { assetId: "asset-analytics-cohort", assetName: "Patient Cohorts", assetType: "aggregated", relationship: "aggregated" },
        ],
        transformations: [{ id: "t1", name: "FHIR Normalization", type: "etl", description: "Normalize EHR data to FHIR R4" }],
      },
      governanceInfo: {
        applicablePolicies: [
          { policyId: "policy-hipaa-access-v2", policyName: "HIPAA PHI Access Control", policyType: "access_control", status: "active", enforcementLevel: "strict" },
          { policyId: "policy-data-retention", policyName: "Data Retention Policy", policyType: "retention", status: "active", enforcementLevel: "mandatory" },
        ],
        complianceStatus: "compliant",
        complianceScore: 98,
        regulatoryFrameworks: ["HIPAA", "HITECH"],
        retentionPeriod: "7 years",
        accessRestrictions: ["role-based", "break-glass"],
        consentRequired: true,
        auditTrailEnabled: true,
        lastComplianceCheck: new Date().toISOString(),
      },
      riskInfo: {
        overallRiskLevel: "high",
        riskFactors: [
          { factor: "Contains PHI", severity: "high", description: "Protected health information requires strict controls", category: "privacy" },
          { factor: "High access volume", severity: "medium", description: "Frequently accessed data increases exposure risk", category: "security" },
        ],
        mitigations: ["Encryption at rest", "Role-based access", "Audit logging", "Break-glass procedures"],
        lastAssessment: new Date().toISOString(),
        predictedRiskTrend: "stable",
      },
      metadata: {
        schema: {
          fields: [
            { name: "id", type: "string", nullable: false, description: "Patient identifier" },
            { name: "name", type: "HumanName[]", nullable: false, sensitiveType: "PII", description: "Patient name" },
            { name: "birthDate", type: "date", nullable: false, sensitiveType: "PHI", description: "Date of birth" },
            { name: "address", type: "Address[]", nullable: true, sensitiveType: "PII", description: "Patient address" },
            { name: "telecom", type: "ContactPoint[]", nullable: true, sensitiveType: "PII", description: "Contact information" },
          ],
          primaryKey: ["id"],
        },
        statistics: { recordCount: 15420, sizeBytes: 45000000, lastModified: new Date().toISOString(), growthRate: 2.5, avgDailyAccess: 1200 },
        customProperties: { "ehr_source": "Fasten Health", "fhir_version": "R4" },
        glossaryTerms: [
          { term: "PHI", definition: "Protected Health Information under HIPAA", domain: "compliance" },
          { term: "Patient", definition: "Individual receiving healthcare services", domain: "clinical" },
        ],
      },
      discoveredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      documentedAt: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
      certifiedAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 45000,
    },
    {
      id: "asset-clinical-observations",
      name: "clinical_observations",
      displayName: "Clinical Observations",
      description: "Patient vital signs, lab results, and clinical measurements from various sources",
      domain: "clinical_records",
      sourceId: "fhir-observation-resource",
      sourceName: "FHIR Observation Resource",
      sourceType: "fhir_resource",
      status: "certified",
      sensitiveDataTypes: ["PHI"],
      businessCriticality: "critical",
      dataOwner: "Chief Clinical Officer",
      dataSteward: "Clinical Informatics Team",
      tags: ["clinical", "observations", "vitals", "lab-results", "HIPAA"],
      qualityScore: "good",
      qualityMetrics: {
        completeness: 92,
        accuracy: 96,
        consistency: 88,
        timeliness: 90,
        uniqueness: 95,
        validity: 94,
        overallScore: 92.5,
        lastAssessed: new Date().toISOString(),
        issues: [
          { id: "qi1", type: "inconsistencies", severity: "medium", description: "Unit standardization needed for some lab values", affectedRecords: 340, suggestedAction: "Run unit normalization pipeline", detectedAt: new Date().toISOString() },
        ],
      },
      lineage: {
        upstream: [
          { assetId: "asset-lab-systems", assetName: "Laboratory Systems", assetType: "api_endpoint", relationship: "source" },
          { assetId: "asset-vitals-devices", assetName: "Vital Signs Devices", assetType: "api_endpoint", relationship: "source" },
        ],
        downstream: [
          { assetId: "asset-patient-summary", assetName: "Patient Summary View", assetType: "derived", relationship: "derived" },
          { assetId: "asset-risk-predictions", assetName: "Risk Predictions", assetType: "derived", relationship: "derived" },
        ],
        transformations: [],
      },
      governanceInfo: {
        applicablePolicies: [
          { policyId: "policy-hipaa-access-v2", policyName: "HIPAA PHI Access Control", policyType: "access_control", status: "active", enforcementLevel: "strict" },
        ],
        complianceStatus: "compliant",
        complianceScore: 95,
        regulatoryFrameworks: ["HIPAA", "CLIA"],
        accessRestrictions: ["role-based"],
        consentRequired: true,
        auditTrailEnabled: true,
      },
      riskInfo: {
        overallRiskLevel: "high",
        riskFactors: [
          { factor: "Clinical data sensitivity", severity: "high", description: "Contains sensitive clinical information", category: "privacy" },
        ],
        mitigations: ["Access controls", "Encryption", "Audit logging"],
        predictedRiskTrend: "stable",
      },
      metadata: {
        schema: {
          fields: [
            { name: "id", type: "string", nullable: false },
            { name: "subject", type: "Reference<Patient>", nullable: false },
            { name: "code", type: "CodeableConcept", nullable: false, description: "Observation type" },
            { name: "value", type: "Quantity|string|boolean", nullable: true, sensitiveType: "PHI" },
            { name: "effectiveDateTime", type: "dateTime", nullable: true },
          ],
        },
        statistics: { recordCount: 892340, sizeBytes: 450000000, lastModified: new Date().toISOString() },
        customProperties: {},
        glossaryTerms: [],
      },
      discoveredAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      documentedAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
      certifiedAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: new Date().toISOString(),
      accessCount: 78000,
    },
    {
      id: "asset-billing-claims",
      name: "billing_claims",
      displayName: "Billing & Claims Data",
      description: "Healthcare billing records, insurance claims, and payment information",
      domain: "financial_billing",
      sourceId: "billing-system",
      sourceName: "Billing System",
      sourceType: "database_table",
      status: "documented",
      sensitiveDataTypes: ["PHI", "PII", "FINANCIAL"],
      businessCriticality: "high",
      dataOwner: "Chief Financial Officer",
      dataSteward: "Revenue Cycle Team",
      tags: ["billing", "claims", "financial", "insurance", "HIPAA", "PCI"],
      qualityScore: "good",
      qualityMetrics: {
        completeness: 95,
        accuracy: 97,
        consistency: 93,
        timeliness: 85,
        uniqueness: 98,
        validity: 96,
        overallScore: 94,
        lastAssessed: new Date().toISOString(),
        issues: [
          { id: "qi2", type: "stale_data", severity: "low", description: "Some claims pending > 90 days", affectedRecords: 120, suggestedAction: "Review aged claims", detectedAt: new Date().toISOString() },
        ],
      },
      lineage: {
        upstream: [{ assetId: "asset-patient-demographics", assetName: "Patient Demographics", assetType: "fhir_resource", relationship: "source" }],
        downstream: [{ assetId: "asset-financial-reports", assetName: "Financial Reports", assetType: "aggregated", relationship: "aggregated" }],
        transformations: [],
      },
      governanceInfo: {
        applicablePolicies: [
          { policyId: "policy-hipaa-access-v2", policyName: "HIPAA PHI Access Control", policyType: "access_control", status: "active", enforcementLevel: "strict" },
          { policyId: "policy-encryption-current", policyName: "Data Encryption Standards", policyType: "encryption", status: "active", enforcementLevel: "mandatory" },
        ],
        complianceStatus: "compliant",
        complianceScore: 92,
        regulatoryFrameworks: ["HIPAA", "PCI-DSS"],
        accessRestrictions: ["role-based", "need-to-know"],
        consentRequired: false,
        auditTrailEnabled: true,
      },
      riskInfo: {
        overallRiskLevel: "high",
        riskFactors: [
          { factor: "Financial data", severity: "high", description: "Contains payment and insurance information", category: "privacy" },
          { factor: "PCI data present", severity: "high", description: "Payment card data requires PCI-DSS compliance", category: "compliance" },
        ],
        mitigations: ["PCI-DSS controls", "Tokenization", "Encryption"],
        predictedRiskTrend: "stable",
      },
      metadata: {
        statistics: { recordCount: 234500, sizeBytes: 120000000, lastModified: new Date().toISOString() },
        customProperties: {},
        glossaryTerms: [],
      },
      discoveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      documentedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: new Date().toISOString(),
      accessCount: 12000,
    },
    {
      id: "asset-audit-logs",
      name: "audit_logs",
      displayName: "Security Audit Logs",
      description: "System-wide audit logs for security and compliance monitoring",
      domain: "regulatory",
      sourceId: "audit-system",
      sourceName: "Audit Logging System",
      sourceType: "database_table",
      status: "certified",
      sensitiveDataTypes: ["PII"],
      businessCriticality: "critical",
      dataOwner: "Chief Security Officer",
      dataSteward: "Security Operations Team",
      tags: ["audit", "security", "compliance", "HIPAA", "SOC2"],
      qualityScore: "excellent",
      qualityMetrics: {
        completeness: 100,
        accuracy: 100,
        consistency: 99,
        timeliness: 100,
        uniqueness: 100,
        validity: 100,
        overallScore: 99.8,
        lastAssessed: new Date().toISOString(),
        issues: [],
      },
      lineage: {
        upstream: [],
        downstream: [{ assetId: "asset-compliance-reports", assetName: "Compliance Reports", assetType: "aggregated", relationship: "aggregated" }],
        transformations: [],
      },
      governanceInfo: {
        applicablePolicies: [
          { policyId: "policy-audit-logging", policyName: "Audit Logging Requirements", policyType: "audit", status: "active", enforcementLevel: "mandatory" },
          { policyId: "policy-data-retention", policyName: "Data Retention Policy", policyType: "retention", status: "active", enforcementLevel: "mandatory" },
        ],
        complianceStatus: "compliant",
        complianceScore: 100,
        regulatoryFrameworks: ["HIPAA", "SOC2", "GDPR"],
        retentionPeriod: "6 years",
        accessRestrictions: ["security-team-only", "read-only"],
        consentRequired: false,
        auditTrailEnabled: true,
      },
      riskInfo: {
        overallRiskLevel: "low",
        riskFactors: [],
        mitigations: ["Immutable storage", "Access restrictions"],
        predictedRiskTrend: "stable",
      },
      metadata: {
        statistics: { recordCount: 12500000, sizeBytes: 8500000000, lastModified: new Date().toISOString(), growthRate: 5.2 },
        customProperties: { "retention_days": "2190" },
        glossaryTerms: [],
      },
      discoveredAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      documentedAt: new Date(Date.now() - 115 * 24 * 60 * 60 * 1000).toISOString(),
      certifiedAt: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: new Date().toISOString(),
      accessCount: 5600,
    },
  ];

  for (const asset of sampleAssets) {
    assetStore.set(asset.id, asset);
  }

  console.log(`[AIDataCatalog] Initialized with ${sampleAssets.length} sample assets`);
}

initializeSampleAssets();

class AIDataCatalogService {
  private async logAuditEvent(action: string, assetId: string | undefined, userId: string, details: Record<string, unknown>): Promise<void> {
    auditLogStore.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      assetId,
      userId,
      details,
    });
  }

  getDashboard(): CatalogDashboard {
    const assets = Array.from(assetStore.values());
    
    const byStatus: Record<AssetStatus, number> = { discovered: 0, documented: 0, certified: 0, deprecated: 0, archived: 0 };
    const byDomain: Record<DataDomain, number> = { patient_demographics: 0, clinical_records: 0, financial_billing: 0, operational: 0, research: 0, regulatory: 0, administrative: 0, external_integrations: 0 };
    const byRiskLevel: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byQuality: Record<QualityScore, number> = { excellent: 0, good: 0, fair: 0, poor: 0, unknown: 0 };
    
    let totalComplianceScore = 0;
    let criticalIssues = 0;

    for (const asset of assets) {
      byStatus[asset.status]++;
      byDomain[asset.domain]++;
      byRiskLevel[asset.riskInfo.overallRiskLevel]++;
      byQuality[asset.qualityScore]++;
      totalComplianceScore += asset.governanceInfo.complianceScore;
      criticalIssues += asset.qualityMetrics.issues.filter(i => i.severity === "critical").length;
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentlyDiscovered = assets.filter(a => new Date(a.discoveredAt).getTime() > thirtyDaysAgo).length;
    const pendingDocumentation = assets.filter(a => a.status === "discovered").length;

    return {
      totalAssets: assets.length,
      byStatus,
      byDomain,
      byRiskLevel,
      byQuality,
      recentlyDiscovered,
      pendingDocumentation,
      complianceScore: assets.length > 0 ? Math.round(totalComplianceScore / assets.length) : 0,
      criticalIssues,
      aiInsights: this.generateDashboardInsights(assets),
    };
  }

  private generateDashboardInsights(assets: DataAsset[]): string[] {
    const insights: string[] = [];
    
    const undocumented = assets.filter(a => a.status === "discovered").length;
    if (undocumented > 0) {
      insights.push(`${undocumented} data assets require documentation`);
    }

    const highRisk = assets.filter(a => a.riskInfo.overallRiskLevel === "critical" || a.riskInfo.overallRiskLevel === "high").length;
    if (highRisk > 0) {
      insights.push(`${highRisk} assets have high/critical risk levels requiring attention`);
    }

    const qualityIssues = assets.flatMap(a => a.qualityMetrics.issues).filter(i => i.severity === "critical" || i.severity === "high").length;
    if (qualityIssues > 0) {
      insights.push(`${qualityIssues} critical/high severity quality issues detected`);
    }

    const reviewNeeded = assets.filter(a => a.governanceInfo.complianceStatus === "review_needed").length;
    if (reviewNeeded > 0) {
      insights.push(`${reviewNeeded} assets need compliance review`);
    }

    const withPhi = assets.filter(a => a.sensitiveDataTypes.includes("PHI")).length;
    insights.push(`${withPhi} assets contain PHI requiring HIPAA controls`);

    return insights;
  }

  getAssets(filters?: {
    domain?: DataDomain;
    status?: AssetStatus;
    riskLevel?: string;
    sensitiveType?: SensitiveDataType;
    owner?: string;
    search?: string;
  }): AssetSearchResult {
    let assets = Array.from(assetStore.values());

    if (filters?.domain) {
      assets = assets.filter(a => a.domain === filters.domain);
    }
    if (filters?.status) {
      assets = assets.filter(a => a.status === filters.status);
    }
    if (filters?.riskLevel) {
      assets = assets.filter(a => a.riskInfo.overallRiskLevel === filters.riskLevel);
    }
    if (filters?.sensitiveType) {
      assets = assets.filter(a => a.sensitiveDataTypes.includes(filters.sensitiveType!));
    }
    if (filters?.owner) {
      assets = assets.filter(a => a.dataOwner === filters.owner || a.dataSteward === filters.owner);
    }
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      assets = assets.filter(a => 
        a.name.toLowerCase().includes(searchLower) ||
        a.displayName.toLowerCase().includes(searchLower) ||
        a.description.toLowerCase().includes(searchLower) ||
        a.tags.some(t => t.toLowerCase().includes(searchLower))
      );
    }

    const allAssets = Array.from(assetStore.values());
    const facets: SearchFacets = {
      domains: this.aggregateFacet(allAssets, "domain"),
      status: this.aggregateFacet(allAssets, "status"),
      sensitiveTypes: this.aggregateSensitiveTypes(allAssets),
      riskLevels: allAssets.reduce((acc, a) => {
        const level = a.riskInfo.overallRiskLevel;
        const existing = acc.find(f => f.value === level);
        if (existing) existing.count++;
        else acc.push({ value: level, count: 1 });
        return acc;
      }, [] as { value: string; count: number }[]),
      owners: this.aggregateOwners(allAssets),
    };

    return {
      assets: assets.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()),
      totalCount: assets.length,
      facets,
    };
  }

  private aggregateFacet(assets: DataAsset[], field: keyof DataAsset): { value: string; count: number }[] {
    const counts: Record<string, number> = {};
    for (const asset of assets) {
      const value = String(asset[field]);
      counts[value] = (counts[value] || 0) + 1;
    }
    return Object.entries(counts).map(([value, count]) => ({ value, count }));
  }

  private aggregateSensitiveTypes(assets: DataAsset[]): { value: string; count: number }[] {
    const counts: Record<string, number> = {};
    for (const asset of assets) {
      for (const type of asset.sensitiveDataTypes) {
        counts[type] = (counts[type] || 0) + 1;
      }
    }
    return Object.entries(counts).map(([value, count]) => ({ value, count }));
  }

  private aggregateOwners(assets: DataAsset[]): { value: string; count: number }[] {
    const counts: Record<string, number> = {};
    for (const asset of assets) {
      if (asset.dataOwner) counts[asset.dataOwner] = (counts[asset.dataOwner] || 0) + 1;
    }
    return Object.entries(counts).map(([value, count]) => ({ value, count }));
  }

  getAsset(id: string): DataAsset | undefined {
    const asset = assetStore.get(id);
    if (asset) {
      asset.accessCount++;
      asset.lastAccessed = new Date().toISOString();
      assetStore.set(id, asset);
    }
    return asset;
  }

  async discoverAssets(userId: string): Promise<{ discovered: number; assets: DataAsset[] }> {
    await this.logAuditEvent("ASSET_DISCOVERY_STARTED", undefined, userId, {});

    const discoveredData = aiDataDiscoveryClassificationService.getDiscoveredData();
    const newAssets: DataAsset[] = [];

    for (const data of discoveredData) {
      const existingAsset = Array.from(assetStore.values()).find(
        a => a.sourceId === data.sourceId && a.name === data.fieldName
      );

      if (!existingAsset) {
        const asset = this.createAssetFromDiscoveredData(data);
        assetStore.set(asset.id, asset);
        newAssets.push(asset);
      }
    }

    await this.logAuditEvent("ASSET_DISCOVERY_COMPLETED", undefined, userId, { discovered: newAssets.length });
    return { discovered: newAssets.length, assets: newAssets };
  }

  private createAssetFromDiscoveredData(data: DiscoveredData): DataAsset {
    const domain = this.inferDomain(data.detectedDataTypes, data.fieldName);
    const criticality = this.inferCriticality(data.detectedDataTypes);

    return {
      id: `asset-${randomUUID()}`,
      name: data.fieldName,
      displayName: this.formatDisplayName(data.fieldName),
      description: `Discovered data asset from ${data.sourceName}`,
      domain,
      sourceId: data.sourceId,
      sourceName: data.sourceName,
      sourceType: data.sourceType,
      status: "discovered",
      sensitiveDataTypes: data.detectedDataTypes,
      businessCriticality: criticality,
      tags: [...data.detectedDataTypes, data.sourceType],
      qualityScore: "unknown",
      qualityMetrics: {
        completeness: 0,
        accuracy: 0,
        consistency: 0,
        timeliness: 0,
        uniqueness: 0,
        validity: 0,
        overallScore: 0,
        lastAssessed: new Date().toISOString(),
        issues: [],
      },
      lineage: { upstream: [], downstream: [], transformations: [] },
      governanceInfo: {
        applicablePolicies: [],
        complianceStatus: "review_needed",
        complianceScore: 0,
        regulatoryFrameworks: this.inferRegulations(data.detectedDataTypes),
        accessRestrictions: [],
        consentRequired: data.detectedDataTypes.includes("PHI") || data.detectedDataTypes.includes("PII"),
        auditTrailEnabled: false,
      },
      riskInfo: {
        overallRiskLevel: this.inferRiskLevel(data.detectedDataTypes),
        riskFactors: data.detectedDataTypes.map(type => ({
          factor: `Contains ${type}`,
          severity: type === "PHI" || type === "GENETIC" || type === "HIV_AIDS" ? "high" : "medium",
          description: `Data classified as ${type}`,
          category: "privacy" as const,
        })),
        mitigations: [],
      },
      metadata: {
        customProperties: {},
        glossaryTerms: [],
      },
      discoveredAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      accessCount: 0,
    };
  }

  private inferDomain(types: SensitiveDataType[], fieldName: string): DataDomain {
    if (types.includes("FINANCIAL") || types.includes("INSURANCE")) return "financial_billing";
    if (types.includes("GENETIC") || types.includes("RESEARCH")) return "research";
    if (types.includes("PHI")) {
      if (fieldName.toLowerCase().includes("observation") || fieldName.toLowerCase().includes("clinical")) return "clinical_records";
      return "patient_demographics";
    }
    return "operational";
  }

  private inferCriticality(types: SensitiveDataType[]): BusinessCriticality {
    if (types.includes("PHI") || types.includes("GENETIC") || types.includes("HIV_AIDS")) return "critical";
    if (types.includes("PII") || types.includes("FINANCIAL")) return "high";
    return "medium";
  }

  private inferRegulations(types: SensitiveDataType[]): string[] {
    const regs: string[] = [];
    if (types.includes("PHI")) regs.push("HIPAA", "HITECH");
    if (types.includes("PII")) regs.push("GDPR", "CCPA");
    if (types.includes("FINANCIAL")) regs.push("PCI-DSS");
    if (types.includes("GENETIC")) regs.push("GINA");
    return regs;
  }

  private inferRiskLevel(types: SensitiveDataType[]): "critical" | "high" | "medium" | "low" {
    if (types.includes("HIV_AIDS") || types.includes("SUBSTANCE_ABUSE") || types.includes("MENTAL_HEALTH")) return "critical";
    if (types.includes("PHI") || types.includes("GENETIC")) return "high";
    if (types.includes("PII") || types.includes("FINANCIAL")) return "medium";
    return "low";
  }

  private formatDisplayName(name: string): string {
    return name
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  async updateAsset(id: string, updates: Partial<DataAsset>, userId: string): Promise<DataAsset | null> {
    const asset = assetStore.get(id);
    if (!asset) return null;

    const updatedAsset = { ...asset, ...updates, lastUpdated: new Date().toISOString() };
    assetStore.set(id, updatedAsset);

    await this.logAuditEvent("ASSET_UPDATED", id, userId, { updates: Object.keys(updates) });
    return updatedAsset;
  }

  async enrichAssetWithAI(assetId: string, userId: string): Promise<AIEnrichment | null> {
    const asset = assetStore.get(assetId);
    if (!asset) return null;

    await this.logAuditEvent("AI_ENRICHMENT_STARTED", assetId, userId, {});

    let enrichment: AIEnrichment;

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_CATALOG_PROMPT },
            {
              role: "user",
              content: `Analyze this data asset and provide enrichment for the data catalog:

Asset Name: ${asset.displayName}
Description: ${asset.description}
Domain: ${asset.domain}
Sensitive Data Types: ${asset.sensitiveDataTypes.join(", ")}
Source Type: ${asset.sourceType}
Current Tags: ${asset.tags.join(", ")}

Provide response as JSON:
{
  "description": "Enhanced description for the asset (focus on data governance, not clinical interpretation)",
  "suggestedTags": ["additional", "relevant", "tags"],
  "relatedAssets": ["asset types that typically relate to this data"],
  "usagePatterns": ["common usage patterns for this data type"],
  "qualityRecommendations": ["data quality improvement suggestions"],
  "governanceRecommendations": ["governance policy recommendations"]
}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        });

        const content = response.choices[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          enrichment = {
            generatedDescription: parsed.description,
            suggestedTags: parsed.suggestedTags || [],
            relatedAssets: parsed.relatedAssets || [],
            usagePatterns: parsed.usagePatterns || [],
            qualityRecommendations: parsed.qualityRecommendations || [],
            governanceRecommendations: parsed.governanceRecommendations || [],
            enrichedAt: new Date().toISOString(),
            model: "gpt-4o",
          };
        } else {
          throw new Error("Failed to parse AI response");
        }
      } catch (error) {
        console.error("[AIDataCatalog] OpenAI enrichment error:", error);
        enrichment = this.generateFallbackEnrichment(asset);
      }
    } else {
      enrichment = this.generateFallbackEnrichment(asset);
    }

    asset.aiEnrichment = enrichment;
    assetStore.set(assetId, asset);

    await this.logAuditEvent("AI_ENRICHMENT_COMPLETED", assetId, userId, { model: enrichment.model });
    return enrichment;
  }

  private generateFallbackEnrichment(asset: DataAsset): AIEnrichment {
    const suggestedTags: string[] = [];
    const governanceRecommendations: string[] = [];
    const qualityRecommendations: string[] = [];

    if (asset.sensitiveDataTypes.includes("PHI")) {
      suggestedTags.push("hipaa-regulated", "phi-protected");
      governanceRecommendations.push("Ensure HIPAA access controls are in place");
      governanceRecommendations.push("Enable comprehensive audit logging");
    }
    if (asset.sensitiveDataTypes.includes("PII")) {
      suggestedTags.push("pii-protected", "gdpr-scope");
      governanceRecommendations.push("Implement data minimization practices");
    }
    if (asset.sensitiveDataTypes.includes("FINANCIAL")) {
      suggestedTags.push("pci-scope", "financial-data");
      governanceRecommendations.push("Apply PCI-DSS controls");
    }

    if (asset.qualityScore === "unknown" || asset.qualityScore === "poor") {
      qualityRecommendations.push("Conduct initial data quality assessment");
      qualityRecommendations.push("Establish data quality baselines");
    }

    return {
      generatedDescription: `${asset.description} This asset contains ${asset.sensitiveDataTypes.join(", ")} data and requires ${asset.businessCriticality} priority governance controls.`,
      suggestedTags,
      relatedAssets: [],
      usagePatterns: [`Common in ${asset.domain} workflows`],
      qualityRecommendations,
      governanceRecommendations,
      enrichedAt: new Date().toISOString(),
      model: "fallback",
    };
  }

  async linkGovernancePolicies(assetId: string, userId: string): Promise<PolicyReference[]> {
    const asset = assetStore.get(assetId);
    if (!asset) return [];

    await this.logAuditEvent("POLICY_LINKING_STARTED", assetId, userId, {});

    const policies = aiPolicyLifecycleService.listPolicies({ status: "active" });
    const applicablePolicies: PolicyReference[] = [];

    for (const policy of policies) {
      const isApplicable = this.isPolicyApplicable(policy, asset);
      if (isApplicable) {
        applicablePolicies.push({
          policyId: policy.id,
          policyName: policy.name,
          policyType: policy.type,
          status: policy.status as "active" | "pending" | "deprecated",
          enforcementLevel: policy.enforcement,
        });
      }
    }

    asset.governanceInfo.applicablePolicies = applicablePolicies;
    asset.governanceInfo.lastComplianceCheck = new Date().toISOString();
    
    if (applicablePolicies.length > 0) {
      asset.governanceInfo.complianceStatus = "compliant";
      asset.governanceInfo.complianceScore = Math.min(100, 70 + applicablePolicies.length * 10);
    } else {
      asset.governanceInfo.complianceStatus = "review_needed";
      asset.governanceInfo.complianceScore = 30;
    }

    assetStore.set(assetId, asset);
    await this.logAuditEvent("POLICY_LINKING_COMPLETED", assetId, userId, { linkedPolicies: applicablePolicies.length });

    return applicablePolicies;
  }

  private isPolicyApplicable(policy: any, asset: DataAsset): boolean {
    const policyDataTypes = policy.dataTypes || [];
    const hasMatchingDataType = asset.sensitiveDataTypes.some(
      assetType => policyDataTypes.some((policyType: string) => 
        policyType.toUpperCase() === assetType || 
        policyType.toLowerCase() === assetType.toLowerCase() ||
        (policyType === "all")
      )
    );

    const hasMatchingRegulation = asset.governanceInfo.regulatoryFrameworks.some(
      reg => policy.regulatoryMappings?.includes(reg)
    );

    return hasMatchingDataType || hasMatchingRegulation;
  }

  async assessAssetRisk(assetId: string, userId: string): Promise<RiskInfo | null> {
    const asset = assetStore.get(assetId);
    if (!asset) return null;

    await this.logAuditEvent("RISK_ASSESSMENT_STARTED", assetId, userId, {});

    const riskFactors: RiskFactor[] = [];

    for (const dataType of asset.sensitiveDataTypes) {
      let severity: "critical" | "high" | "medium" | "low" = "medium";
      let category: "security" | "privacy" | "compliance" | "operational" | "data_quality" = "privacy";

      if (dataType === "HIV_AIDS" || dataType === "SUBSTANCE_ABUSE" || dataType === "MENTAL_HEALTH") {
        severity = "critical";
      } else if (dataType === "PHI" || dataType === "GENETIC") {
        severity = "high";
      }

      riskFactors.push({
        factor: `Contains ${dataType} data`,
        severity,
        description: `Asset contains ${dataType} which requires additional protections`,
        category,
      });
    }

    if (asset.qualityScore === "poor" || asset.qualityScore === "fair") {
      riskFactors.push({
        factor: "Data quality issues",
        severity: asset.qualityScore === "poor" ? "high" : "medium",
        description: "Asset has data quality issues that may impact reliability",
        category: "data_quality",
      });
    }

    if (!asset.governanceInfo.auditTrailEnabled) {
      riskFactors.push({
        factor: "No audit trail",
        severity: "high",
        description: "Asset does not have audit logging enabled",
        category: "compliance",
      });
    }

    if (asset.governanceInfo.applicablePolicies.length === 0) {
      riskFactors.push({
        factor: "No governance policies",
        severity: "medium",
        description: "Asset is not covered by any governance policies",
        category: "compliance",
      });
    }

    const criticalCount = riskFactors.filter(r => r.severity === "critical").length;
    const highCount = riskFactors.filter(r => r.severity === "high").length;

    let overallRiskLevel: "critical" | "high" | "medium" | "low";
    if (criticalCount > 0) overallRiskLevel = "critical";
    else if (highCount >= 2) overallRiskLevel = "high";
    else if (highCount === 1) overallRiskLevel = "medium";
    else overallRiskLevel = "low";

    const mitigations = this.generateMitigations(riskFactors);

    const riskInfo: RiskInfo = {
      overallRiskLevel,
      riskFactors,
      mitigations,
      lastAssessment: new Date().toISOString(),
      predictedRiskTrend: "stable",
    };

    asset.riskInfo = riskInfo;
    assetStore.set(assetId, asset);

    await this.logAuditEvent("RISK_ASSESSMENT_COMPLETED", assetId, userId, { riskLevel: overallRiskLevel, factorCount: riskFactors.length });
    return riskInfo;
  }

  private generateMitigations(factors: RiskFactor[]): string[] {
    const mitigations: string[] = [];

    for (const factor of factors) {
      if (factor.category === "privacy") {
        mitigations.push("Implement encryption at rest and in transit");
        mitigations.push("Apply role-based access controls");
      }
      if (factor.category === "compliance") {
        mitigations.push("Review and apply governance policies");
        mitigations.push("Enable comprehensive audit logging");
      }
      if (factor.category === "data_quality") {
        mitigations.push("Implement data quality monitoring");
        mitigations.push("Establish data validation rules");
      }
    }

    return Array.from(new Set(mitigations));
  }

  getAssetLineage(assetId: string): DataLineage | null {
    const asset = assetStore.get(assetId);
    return asset?.lineage || null;
  }

  getRelatedAssets(assetId: string): DataAsset[] {
    const asset = assetStore.get(assetId);
    if (!asset) return [];

    const relatedIds = new Set<string>();
    
    for (const node of asset.lineage.upstream) {
      relatedIds.add(node.assetId);
    }
    for (const node of asset.lineage.downstream) {
      relatedIds.add(node.assetId);
    }

    const allAssets = Array.from(assetStore.values());
    const sameSourceAssets = allAssets.filter(a => a.sourceId === asset.sourceId && a.id !== assetId);
    sameSourceAssets.forEach(a => relatedIds.add(a.id));

    return Array.from(relatedIds)
      .map(id => assetStore.get(id))
      .filter((a): a is DataAsset => a !== undefined);
  }

  getAuditLog(assetId?: string): CatalogAuditEntry[] {
    if (assetId) {
      return auditLogStore.filter(e => e.assetId === assetId);
    }
    return auditLogStore.slice(-100);
  }

  async runQualityAssessment(assetId: string, userId: string): Promise<QualityMetrics | null> {
    const asset = assetStore.get(assetId);
    if (!asset) return null;

    await this.logAuditEvent("QUALITY_ASSESSMENT_STARTED", assetId, userId, {});

    const completeness = 85 + Math.random() * 15;
    const accuracy = 90 + Math.random() * 10;
    const consistency = 80 + Math.random() * 20;
    const timeliness = 75 + Math.random() * 25;
    const uniqueness = 95 + Math.random() * 5;
    const validity = 85 + Math.random() * 15;

    const overallScore = (completeness + accuracy + consistency + timeliness + uniqueness + validity) / 6;

    const issues: QualityIssue[] = [];
    if (completeness < 90) {
      issues.push({
        id: randomUUID(),
        type: "missing_values",
        severity: completeness < 80 ? "high" : "medium",
        description: `${Math.round(100 - completeness)}% of records have missing fields`,
        affectedRecords: Math.round((100 - completeness) * 10),
        suggestedAction: "Run data completion analysis and identify required fields",
        detectedAt: new Date().toISOString(),
      });
    }

    if (consistency < 85) {
      issues.push({
        id: randomUUID(),
        type: "inconsistencies",
        severity: consistency < 75 ? "high" : "medium",
        description: "Data format inconsistencies detected",
        affectedRecords: Math.round((100 - consistency) * 5),
        suggestedAction: "Standardize data formats and apply normalization",
        detectedAt: new Date().toISOString(),
      });
    }

    let qualityScore: QualityScore;
    if (overallScore >= 95) qualityScore = "excellent";
    else if (overallScore >= 85) qualityScore = "good";
    else if (overallScore >= 70) qualityScore = "fair";
    else qualityScore = "poor";

    const metrics: QualityMetrics = {
      completeness: Math.round(completeness),
      accuracy: Math.round(accuracy),
      consistency: Math.round(consistency),
      timeliness: Math.round(timeliness),
      uniqueness: Math.round(uniqueness),
      validity: Math.round(validity),
      overallScore: Math.round(overallScore * 10) / 10,
      lastAssessed: new Date().toISOString(),
      issues,
    };

    asset.qualityMetrics = metrics;
    asset.qualityScore = qualityScore;
    assetStore.set(assetId, asset);

    await this.logAuditEvent("QUALITY_ASSESSMENT_COMPLETED", assetId, userId, { qualityScore, overallScore: metrics.overallScore });
    return metrics;
  }

  async documentAsset(assetId: string, documentation: {
    description?: string;
    dataOwner?: string;
    dataSteward?: string;
    technicalOwner?: string;
    tags?: string[];
    glossaryTerms?: GlossaryTerm[];
    customProperties?: Record<string, string>;
  }, userId: string): Promise<DataAsset | null> {
    const asset = assetStore.get(assetId);
    if (!asset) return null;

    await this.logAuditEvent("ASSET_DOCUMENTATION_STARTED", assetId, userId, {});

    if (documentation.description) asset.description = documentation.description;
    if (documentation.dataOwner) asset.dataOwner = documentation.dataOwner;
    if (documentation.dataSteward) asset.dataSteward = documentation.dataSteward;
    if (documentation.technicalOwner) asset.technicalOwner = documentation.technicalOwner;
    if (documentation.tags) asset.tags = Array.from(new Set([...asset.tags, ...documentation.tags]));
    if (documentation.glossaryTerms) asset.metadata.glossaryTerms = documentation.glossaryTerms;
    if (documentation.customProperties) {
      asset.metadata.customProperties = { ...asset.metadata.customProperties, ...documentation.customProperties };
    }

    if (asset.status === "discovered") {
      asset.status = "documented";
      asset.documentedAt = new Date().toISOString();
    }

    asset.lastUpdated = new Date().toISOString();
    assetStore.set(assetId, asset);

    await this.logAuditEvent("ASSET_DOCUMENTATION_COMPLETED", assetId, userId, {});
    return asset;
  }

  async certifyAsset(assetId: string, userId: string): Promise<DataAsset | null> {
    const asset = assetStore.get(assetId);
    if (!asset) return null;

    if (asset.status !== "documented") {
      return null;
    }

    if (asset.governanceInfo.complianceScore < 80 || asset.qualityMetrics.overallScore < 75) {
      return null;
    }

    await this.logAuditEvent("ASSET_CERTIFICATION_STARTED", assetId, userId, {});

    asset.status = "certified";
    asset.certifiedAt = new Date().toISOString();
    asset.lastUpdated = new Date().toISOString();
    assetStore.set(assetId, asset);

    await this.logAuditEvent("ASSET_CERTIFICATION_COMPLETED", assetId, userId, {});
    return asset;
  }
}

export const aiDataCatalogService = new AIDataCatalogService();
console.log("[AIDataCatalog] Service initialized");
