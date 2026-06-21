import OpenAI from "openai";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { aiDataCatalogService, DataAsset, DataDomain } from "./ai-data-catalog";
import { aiDataDiscoveryClassificationService, SensitiveDataType } from "./ai-data-discovery-classification";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const NO_CDS_LINEAGE_PROMPT = `You are a healthcare data lineage analyst focusing on tracing data flow and dependencies.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing data lineage and flow across systems
- Identifying data transformations and dependencies
- Assessing data lineage impact on compliance and risk
- Recommending data governance improvements for lineage
- Explaining data movement patterns and relationships

All analysis must focus on DATA LINEAGE and GOVERNANCE - never clinical interpretation.`;

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

export type LineageNodeType = 
  | "source_system" 
  | "data_store" 
  | "transformation" 
  | "api_gateway" 
  | "analytics_engine"
  | "reporting"
  | "archive"
  | "external_system";

export type LineageEdgeType = 
  | "extracts" 
  | "transforms" 
  | "loads" 
  | "syncs" 
  | "aggregates"
  | "derives"
  | "copies"
  | "archives";

export type RiskLevel = "critical" | "high" | "medium" | "low";
export type ComplianceStatus = "compliant" | "non_compliant" | "review_needed" | "unknown";

export interface LineageNode {
  id: string;
  name: string;
  displayName: string;
  type: LineageNodeType;
  description: string;
  system: string;
  domain?: DataDomain;
  sensitiveDataTypes: SensitiveDataType[];
  riskLevel: RiskLevel;
  complianceStatus: ComplianceStatus;
  dataClassifications: string[];
  catalogAssetId?: string;
  metadata: Record<string, unknown>;
  position?: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

export interface LineageEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: LineageEdgeType;
  label: string;
  transformationDetails?: TransformationDetails;
  dataVolume?: DataVolumeInfo;
  frequency: string;
  latencyMs?: number;
  isActive: boolean;
  riskImpact: RiskLevel;
  createdAt: string;
}

export interface TransformationDetails {
  name: string;
  description: string;
  logic: string;
  inputFields: string[];
  outputFields: string[];
  dataQualityRules?: string[];
}

export interface DataVolumeInfo {
  recordsPerDay: number;
  sizePerDayMb: number;
  peakHourlyVolume: number;
  trend: "increasing" | "stable" | "decreasing";
}

export interface LineageGraph {
  id: string;
  name: string;
  description: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  metrics: LineageMetrics;
  riskSummary: RiskSummary;
  complianceSummary: ComplianceSummary;
  lastUpdated: string;
}

export interface LineageMetrics {
  totalNodes: number;
  totalEdges: number;
  sourceSystemCount: number;
  dataStoreCount: number;
  transformationCount: number;
  avgPathLength: number;
  maxPathLength: number;
  circularDependencies: number;
}

export interface RiskSummary {
  overallRisk: RiskLevel;
  highRiskPaths: RiskPath[];
  riskFactors: LineageRiskFactor[];
  mitigationSuggestions: string[];
}

export interface RiskPath {
  pathId: string;
  nodes: string[];
  riskLevel: RiskLevel;
  reason: string;
  sensitiveDataFlow: boolean;
}

export interface LineageRiskFactor {
  factor: string;
  severity: RiskLevel;
  description: string;
  affectedNodes: string[];
  category: "security" | "privacy" | "compliance" | "operational";
}

export interface ComplianceSummary {
  overallStatus: ComplianceStatus;
  frameworks: FrameworkCompliance[];
  violations: PolicyViolation[];
  policyImpacts: PolicyImpact[];
}

export interface FrameworkCompliance {
  framework: string;
  status: ComplianceStatus;
  score: number;
  findings: string[];
}

export interface PolicyViolation {
  id: string;
  policyId: string;
  policyName: string;
  nodeId: string;
  nodeName: string;
  severity: RiskLevel;
  description: string;
  remediationSteps: string[];
  detectedAt: string;
}

export interface PolicyImpact {
  policyId: string;
  policyName: string;
  affectedNodes: string[];
  impactLevel: RiskLevel;
  complianceRequirements: string[];
}

export interface LineageSearchFilter {
  query?: string;
  assetIds?: string[];
  systems?: string[];
  domains?: DataDomain[];
  dataClassifications?: SensitiveDataType[];
  riskLevels?: RiskLevel[];
  complianceStatuses?: ComplianceStatus[];
  nodeTypes?: LineageNodeType[];
  includeUpstream?: boolean;
  includeDownstream?: boolean;
  maxDepth?: number;
}

export interface LineageImpactAnalysis {
  targetNodeId: string;
  impactType: "upstream" | "downstream" | "both";
  affectedNodes: AffectedNode[];
  riskAssessment: RiskAssessment;
  complianceAssessment: ComplianceAssessment;
  recommendations: string[];
}

export interface AffectedNode {
  nodeId: string;
  nodeName: string;
  distance: number;
  impactLevel: RiskLevel;
  relationship: string;
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  riskFactors: LineageRiskFactor[];
  sensitiveDataExposure: SensitiveDataType[];
  cascadeRisk: boolean;
}

export interface ComplianceAssessment {
  overallStatus: ComplianceStatus;
  affectedPolicies: string[];
  potentialViolations: string[];
  regulatoryImpact: string[];
}

export interface AILineageAnalysis {
  query: string;
  analysis: string;
  keyFindings: string[];
  riskHighlights: string[];
  recommendations: string[];
  relatedNodes: string[];
  generatedAt: string;
}

const nodeStore = new Map<string, LineageNode>();
const edgeStore = new Map<string, LineageEdge>();
const violationStore = new Map<string, PolicyViolation>();

class AIDataLineageService {
  constructor() {
    this.initializeSampleLineage();
    console.log("[AIDataLineage] Service initialized");
  }

  private initializeSampleLineage(): void {
    const nodes: LineageNode[] = [
      {
        id: "node-epic-ehr",
        name: "epic_ehr_system",
        displayName: "Fasten Health EHR System",
        type: "source_system",
        description: "Primary electronic health record system containing patient demographics, encounters, and clinical data",
        system: "Fasten Health",
        domain: "clinical_records",
        sensitiveDataTypes: ["PHI", "PII"],
        riskLevel: "high",
        complianceStatus: "compliant",
        dataClassifications: ["PHI", "Confidential", "HIPAA-Protected"],
        metadata: { vendor: "Fasten Health", version: "2024.1" },
        position: { x: 100, y: 200 },
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "node-lab-system",
        name: "labcorp_interface",
        displayName: "LabCorp Interface",
        type: "source_system",
        description: "Laboratory results integration system for diagnostic data",
        system: "LabCorp",
        domain: "clinical_records",
        sensitiveDataTypes: ["PHI"],
        riskLevel: "high",
        complianceStatus: "compliant",
        dataClassifications: ["PHI", "Medical", "CLIA-Regulated"],
        metadata: { interfaceType: "HL7v2", protocol: "MLLP" },
        position: { x: 100, y: 350 },
        createdAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "node-claims-system",
        name: "claims_processing",
        displayName: "Claims Processing System",
        type: "source_system",
        description: "Insurance claims and billing data from payer interactions",
        system: "ClaimsHub",
        domain: "financial_billing",
        sensitiveDataTypes: ["PII", "FINANCIAL"],
        riskLevel: "medium",
        complianceStatus: "compliant",
        dataClassifications: ["PII", "Financial", "PCI-Relevant"],
        metadata: { format: "X12-837", clearinghouse: "Availity" },
        position: { x: 100, y: 500 },
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "node-fhir-gateway",
        name: "fhir_api_gateway",
        displayName: "FHIR API Gateway",
        type: "api_gateway",
        description: "Central FHIR R4 API gateway for healthcare data standardization and routing",
        system: "Tabula Medica",
        domain: "clinical_records",
        sensitiveDataTypes: ["PHI", "PII"],
        riskLevel: "high",
        complianceStatus: "compliant",
        dataClassifications: ["PHI", "HIPAA-Protected"],
        metadata: { fhirVersion: "R4", authMethod: "SMART-on-FHIR" },
        position: { x: 350, y: 350 },
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "node-etl-processor",
        name: "data_transformation_engine",
        displayName: "Data Transformation Engine",
        type: "transformation",
        description: "ETL processor for data normalization, deduplication, and FHIR conversion",
        system: "Tabula Medica",
        domain: "operational",
        sensitiveDataTypes: ["PHI", "PII"],
        riskLevel: "medium",
        complianceStatus: "compliant",
        dataClassifications: ["PHI", "Internal"],
        metadata: { engine: "Apache Spark", runtime: "Kubernetes" },
        position: { x: 600, y: 350 },
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "node-primary-fhir-store",
        name: "primary_fhir_store",
        displayName: "Primary FHIR Data Store",
        type: "data_store",
        description: "Main FHIR R4 data repository for patient health records",
        system: "GCP Healthcare API",
        domain: "clinical_records",
        sensitiveDataTypes: ["PHI", "PII"],
        riskLevel: "critical",
        complianceStatus: "compliant",
        dataClassifications: ["PHI", "HIPAA-Protected", "Encrypted"],
        catalogAssetId: "asset-fhir-patient-records",
        metadata: { encryption: "AES-256-GCM", region: "us-central1" },
        position: { x: 850, y: 250 },
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "node-analytics-warehouse",
        name: "analytics_data_warehouse",
        displayName: "Analytics Data Warehouse",
        type: "analytics_engine",
        description: "De-identified analytics warehouse for population health insights",
        system: "BigQuery",
        domain: "research",
        sensitiveDataTypes: [],
        riskLevel: "low",
        complianceStatus: "compliant",
        dataClassifications: ["De-identified", "Analytics"],
        catalogAssetId: "asset-analytics-warehouse",
        metadata: { deIdentificationMethod: "Safe Harbor", auditEnabled: true },
        position: { x: 850, y: 450 },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "node-patient-portal",
        name: "patient_portal_api",
        displayName: "Patient Portal API",
        type: "external_system",
        description: "Patient-facing API for health record access and management",
        system: "Tabula Medica",
        domain: "patient_demographics",
        sensitiveDataTypes: ["PHI", "PII"],
        riskLevel: "high",
        complianceStatus: "review_needed",
        dataClassifications: ["PHI", "Patient-Accessible"],
        metadata: { authMethod: "OAuth2.0", mfaRequired: true },
        position: { x: 1100, y: 250 },
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "node-reporting-engine",
        name: "compliance_reporting",
        displayName: "Compliance Reporting Engine",
        type: "reporting",
        description: "Regulatory and compliance reporting system for HIPAA audits",
        system: "Tabula Medica",
        domain: "regulatory",
        sensitiveDataTypes: [],
        riskLevel: "low",
        complianceStatus: "compliant",
        dataClassifications: ["Audit", "Compliance"],
        metadata: { reportTypes: ["HIPAA", "SOC2", "State-Regulations"] },
        position: { x: 1100, y: 450 },
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const edges: LineageEdge[] = [
      {
        id: "edge-epic-to-gateway",
        sourceId: "node-epic-ehr",
        targetId: "node-fhir-gateway",
        type: "extracts",
        label: "FHIR R4 Extract",
        transformationDetails: {
          name: "Provider FHIR Conversion",
          description: "Converts Source proprietary format to FHIR R4 resources",
          logic: "Map source patient to FHIR Patient, Fasten Health encounter to FHIR Encounter",
          inputFields: ["PatientID", "EncounterID", "Demographics", "Vitals"],
          outputFields: ["Patient", "Encounter", "Observation", "Condition"],
        },
        dataVolume: { recordsPerDay: 15000, sizePerDayMb: 250, peakHourlyVolume: 2500, trend: "stable" },
        frequency: "Real-time",
        latencyMs: 450,
        isActive: true,
        riskImpact: "high",
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "edge-lab-to-gateway",
        sourceId: "node-lab-system",
        targetId: "node-fhir-gateway",
        type: "transforms",
        label: "HL7v2 to FHIR",
        transformationDetails: {
          name: "HL7v2 FHIR Transformation",
          description: "Transforms HL7v2 ORU messages to FHIR DiagnosticReport and Observation",
          logic: "Parse HL7v2 OBR/OBX segments, map to FHIR resources with coding translations",
          inputFields: ["MSH", "PID", "OBR", "OBX"],
          outputFields: ["DiagnosticReport", "Observation", "Specimen"],
          dataQualityRules: ["LOINC code validation", "Result range validation"],
        },
        dataVolume: { recordsPerDay: 8500, sizePerDayMb: 120, peakHourlyVolume: 1200, trend: "increasing" },
        frequency: "Batch (15 min)",
        latencyMs: 320,
        isActive: true,
        riskImpact: "high",
        createdAt: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "edge-claims-to-gateway",
        sourceId: "node-claims-system",
        targetId: "node-fhir-gateway",
        type: "transforms",
        label: "X12 to FHIR",
        transformationDetails: {
          name: "Claims to FHIR Conversion",
          description: "Converts X12 837/835 claims to FHIR Claim and ExplanationOfBenefit",
          logic: "Parse X12 segments, map to FHIR financial resources",
          inputFields: ["ISA", "GS", "ST", "CLM", "NM1"],
          outputFields: ["Claim", "ExplanationOfBenefit", "Coverage"],
        },
        dataVolume: { recordsPerDay: 3200, sizePerDayMb: 45, peakHourlyVolume: 500, trend: "stable" },
        frequency: "Batch (hourly)",
        latencyMs: 550,
        isActive: true,
        riskImpact: "medium",
        createdAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "edge-gateway-to-etl",
        sourceId: "node-fhir-gateway",
        targetId: "node-etl-processor",
        type: "loads",
        label: "FHIR Bundle Load",
        dataVolume: { recordsPerDay: 26700, sizePerDayMb: 415, peakHourlyVolume: 4200, trend: "stable" },
        frequency: "Real-time",
        latencyMs: 150,
        isActive: true,
        riskImpact: "medium",
        createdAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "edge-etl-to-fhir-store",
        sourceId: "node-etl-processor",
        targetId: "node-primary-fhir-store",
        type: "loads",
        label: "Normalized FHIR Store",
        transformationDetails: {
          name: "FHIR Normalization & Dedup",
          description: "Deduplicates records, normalizes codes, and stores in primary FHIR repository",
          logic: "Patient matching algorithm, terminology normalization, resource versioning",
          inputFields: ["FHIR Bundle"],
          outputFields: ["Versioned FHIR Resources"],
          dataQualityRules: ["Duplicate detection", "Reference integrity", "Code normalization"],
        },
        dataVolume: { recordsPerDay: 24500, sizePerDayMb: 380, peakHourlyVolume: 3800, trend: "stable" },
        frequency: "Real-time",
        latencyMs: 200,
        isActive: true,
        riskImpact: "critical",
        createdAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "edge-etl-to-analytics",
        sourceId: "node-etl-processor",
        targetId: "node-analytics-warehouse",
        type: "aggregates",
        label: "De-identified Analytics",
        transformationDetails: {
          name: "Safe Harbor De-identification",
          description: "Removes 18 HIPAA identifiers using Safe Harbor method for analytics use",
          logic: "Remove direct identifiers, generalize quasi-identifiers, apply k-anonymity",
          inputFields: ["FHIR Resources with PHI"],
          outputFields: ["De-identified datasets"],
          dataQualityRules: ["k-anonymity verification", "Re-identification risk assessment"],
        },
        dataVolume: { recordsPerDay: 20000, sizePerDayMb: 180, peakHourlyVolume: 2500, trend: "increasing" },
        frequency: "Batch (daily)",
        latencyMs: 45000,
        isActive: true,
        riskImpact: "low",
        createdAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "edge-fhir-store-to-portal",
        sourceId: "node-primary-fhir-store",
        targetId: "node-patient-portal",
        type: "syncs",
        label: "Patient Access API",
        dataVolume: { recordsPerDay: 8500, sizePerDayMb: 95, peakHourlyVolume: 1500, trend: "increasing" },
        frequency: "On-demand",
        latencyMs: 180,
        isActive: true,
        riskImpact: "high",
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "edge-fhir-store-to-reporting",
        sourceId: "node-primary-fhir-store",
        targetId: "node-reporting-engine",
        type: "derives",
        label: "Compliance Audit Feed",
        dataVolume: { recordsPerDay: 500, sizePerDayMb: 12, peakHourlyVolume: 100, trend: "stable" },
        frequency: "Batch (daily)",
        latencyMs: 30000,
        isActive: true,
        riskImpact: "low",
        createdAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const violations: PolicyViolation[] = [
      {
        id: "violation-portal-mfa",
        policyId: "policy-access-control",
        policyName: "Multi-Factor Authentication Policy",
        nodeId: "node-patient-portal",
        nodeName: "Patient Portal API",
        severity: "medium",
        description: "MFA enforcement review needed for patient portal access patterns",
        remediationSteps: [
          "Review current MFA implementation",
          "Implement adaptive MFA based on risk scoring",
          "Update authentication audit logging",
        ],
        detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    nodes.forEach(n => nodeStore.set(n.id, n));
    edges.forEach(e => edgeStore.set(e.id, e));
    violations.forEach(v => violationStore.set(v.id, v));

    console.log(`[AIDataLineage] Initialized ${nodes.length} nodes, ${edges.length} edges`);
  }

  async getFullLineageGraph(): Promise<LineageGraph> {
    const nodes = Array.from(nodeStore.values());
    const edges = Array.from(edgeStore.values());
    const violations = Array.from(violationStore.values());

    return {
      id: "graph-main",
      name: "Enterprise Data Lineage",
      description: "Complete data lineage visualization across all healthcare systems",
      nodes,
      edges,
      metrics: this.calculateMetrics(nodes, edges),
      riskSummary: this.calculateRiskSummary(nodes, edges),
      complianceSummary: this.calculateComplianceSummary(nodes, violations),
      lastUpdated: new Date().toISOString(),
    };
  }

  async searchLineage(filter: LineageSearchFilter): Promise<LineageGraph> {
    let nodes = Array.from(nodeStore.values());
    let edges = Array.from(edgeStore.values());

    if (filter.query) {
      const q = filter.query.toLowerCase();
      nodes = nodes.filter(n => 
        n.name.toLowerCase().includes(q) ||
        n.displayName.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.system.toLowerCase().includes(q)
      );
    }

    if (filter.systems?.length) {
      nodes = nodes.filter(n => filter.systems!.includes(n.system));
    }

    if (filter.domains?.length) {
      nodes = nodes.filter(n => n.domain && filter.domains!.includes(n.domain));
    }

    if (filter.dataClassifications?.length) {
      nodes = nodes.filter(n => 
        n.sensitiveDataTypes.some(t => filter.dataClassifications!.includes(t))
      );
    }

    if (filter.riskLevels?.length) {
      nodes = nodes.filter(n => filter.riskLevels!.includes(n.riskLevel));
    }

    if (filter.complianceStatuses?.length) {
      nodes = nodes.filter(n => filter.complianceStatuses!.includes(n.complianceStatus));
    }

    if (filter.nodeTypes?.length) {
      nodes = nodes.filter(n => filter.nodeTypes!.includes(n.type));
    }

    const nodeIds = new Set(nodes.map(n => n.id));

    if (filter.assetIds?.length) {
      const assetNodes = nodes.filter(n => filter.assetIds!.includes(n.id));
      const maxDepth = filter.maxDepth || 3;

      if (filter.includeUpstream !== false) {
        const upstream = this.traceUpstream(assetNodes.map(n => n.id), maxDepth);
        upstream.forEach(id => nodeIds.add(id));
      }

      if (filter.includeDownstream !== false) {
        const downstream = this.traceDownstream(assetNodes.map(n => n.id), maxDepth);
        downstream.forEach(id => nodeIds.add(id));
      }

      nodes = Array.from(nodeStore.values()).filter(n => nodeIds.has(n.id));
    }

    edges = edges.filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

    const violations = Array.from(violationStore.values()).filter(v => nodeIds.has(v.nodeId));

    return {
      id: `search-${randomUUID().substring(0, 8)}`,
      name: "Search Results",
      description: `Filtered lineage graph: ${nodes.length} nodes, ${edges.length} edges`,
      nodes,
      edges,
      metrics: this.calculateMetrics(nodes, edges),
      riskSummary: this.calculateRiskSummary(nodes, edges),
      complianceSummary: this.calculateComplianceSummary(nodes, violations),
      lastUpdated: new Date().toISOString(),
    };
  }

  private traceUpstream(nodeIds: string[], maxDepth: number): Set<string> {
    const visited = new Set<string>(nodeIds);
    let currentLevel = new Set(nodeIds);

    for (let depth = 0; depth < maxDepth && currentLevel.size > 0; depth++) {
      const nextLevel = new Set<string>();
      Array.from(edgeStore.values()).forEach(edge => {
        if (currentLevel.has(edge.targetId) && !visited.has(edge.sourceId)) {
          visited.add(edge.sourceId);
          nextLevel.add(edge.sourceId);
        }
      });
      currentLevel = nextLevel;
    }

    return visited;
  }

  private traceDownstream(nodeIds: string[], maxDepth: number): Set<string> {
    const visited = new Set<string>(nodeIds);
    let currentLevel = new Set(nodeIds);

    for (let depth = 0; depth < maxDepth && currentLevel.size > 0; depth++) {
      const nextLevel = new Set<string>();
      Array.from(edgeStore.values()).forEach(edge => {
        if (currentLevel.has(edge.sourceId) && !visited.has(edge.targetId)) {
          visited.add(edge.targetId);
          nextLevel.add(edge.targetId);
        }
      });
      currentLevel = nextLevel;
    }

    return visited;
  }

  async getNodeDetails(nodeId: string): Promise<LineageNode | null> {
    return nodeStore.get(nodeId) || null;
  }

  async getImpactAnalysis(nodeId: string, direction: "upstream" | "downstream" | "both"): Promise<LineageImpactAnalysis> {
    const node = nodeStore.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const affectedNodes: AffectedNode[] = [];
    const maxDepth = 5;

    if (direction === "upstream" || direction === "both") {
      const upstream = this.traceUpstreamWithDistance(nodeId, maxDepth);
      upstream.forEach((distance, id) => {
        const n = nodeStore.get(id);
        if (n && id !== nodeId) {
          affectedNodes.push({
            nodeId: id,
            nodeName: n.displayName,
            distance,
            impactLevel: distance <= 1 ? "high" : distance <= 2 ? "medium" : "low",
            relationship: "upstream source",
          });
        }
      });
    }

    if (direction === "downstream" || direction === "both") {
      const downstream = this.traceDownstreamWithDistance(nodeId, maxDepth);
      downstream.forEach((distance, id) => {
        const n = nodeStore.get(id);
        if (n && id !== nodeId) {
          affectedNodes.push({
            nodeId: id,
            nodeName: n.displayName,
            distance,
            impactLevel: distance <= 1 ? "high" : distance <= 2 ? "medium" : "low",
            relationship: "downstream consumer",
          });
        }
      });
    }

    const affectedNodeObjs = affectedNodes.map(a => nodeStore.get(a.nodeId)!).filter(Boolean);
    const sensitiveTypes = new Set<SensitiveDataType>();
    affectedNodeObjs.forEach(n => n.sensitiveDataTypes.forEach(t => sensitiveTypes.add(t)));

    const riskFactors: LineageRiskFactor[] = [];
    if (sensitiveTypes.has("PHI")) {
      riskFactors.push({
        factor: "PHI Data Flow",
        severity: "high",
        description: "Protected Health Information flows through this lineage path",
        affectedNodes: affectedNodeObjs.filter(n => n.sensitiveDataTypes.includes("PHI")).map(n => n.id),
        category: "privacy",
      });
    }

    const criticalNodes = affectedNodeObjs.filter(n => n.riskLevel === "critical");
    if (criticalNodes.length > 0) {
      riskFactors.push({
        factor: "Critical System Dependencies",
        severity: "critical",
        description: `${criticalNodes.length} critical systems are affected`,
        affectedNodes: criticalNodes.map(n => n.id),
        category: "operational",
      });
    }

    const violations = Array.from(violationStore.values())
      .filter(v => affectedNodes.some(a => a.nodeId === v.nodeId));

    return {
      targetNodeId: nodeId,
      impactType: direction,
      affectedNodes,
      riskAssessment: {
        overallRisk: criticalNodes.length > 0 ? "critical" : riskFactors.length > 0 ? "high" : "medium",
        riskFactors,
        sensitiveDataExposure: Array.from(sensitiveTypes),
        cascadeRisk: affectedNodes.some(a => a.impactLevel === "high"),
      },
      complianceAssessment: {
        overallStatus: violations.length > 0 ? "review_needed" : "compliant",
        affectedPolicies: Array.from(new Set(violations.map(v => v.policyName))),
        potentialViolations: violations.map(v => v.description),
        regulatoryImpact: sensitiveTypes.has("PHI") ? ["HIPAA Privacy Rule", "HIPAA Security Rule"] : [],
      },
      recommendations: this.generateRecommendations(node, affectedNodes, riskFactors),
    };
  }

  private traceUpstreamWithDistance(nodeId: string, maxDepth: number): Map<string, number> {
    const distances = new Map<string, number>([[nodeId, 0]]);
    let currentLevel = new Set([nodeId]);

    for (let depth = 1; depth <= maxDepth && currentLevel.size > 0; depth++) {
      const nextLevel = new Set<string>();
      Array.from(edgeStore.values()).forEach(edge => {
        if (currentLevel.has(edge.targetId) && !distances.has(edge.sourceId)) {
          distances.set(edge.sourceId, depth);
          nextLevel.add(edge.sourceId);
        }
      });
      currentLevel = nextLevel;
    }

    return distances;
  }

  private traceDownstreamWithDistance(nodeId: string, maxDepth: number): Map<string, number> {
    const distances = new Map<string, number>([[nodeId, 0]]);
    let currentLevel = new Set([nodeId]);

    for (let depth = 1; depth <= maxDepth && currentLevel.size > 0; depth++) {
      const nextLevel = new Set<string>();
      Array.from(edgeStore.values()).forEach(edge => {
        if (currentLevel.has(edge.sourceId) && !distances.has(edge.targetId)) {
          distances.set(edge.targetId, depth);
          nextLevel.add(edge.targetId);
        }
      });
      currentLevel = nextLevel;
    }

    return distances;
  }

  private generateRecommendations(node: LineageNode, affected: AffectedNode[], risks: LineageRiskFactor[]): string[] {
    const recommendations: string[] = [];

    if (node.riskLevel === "critical" || node.riskLevel === "high") {
      recommendations.push("Implement additional monitoring for this high-risk data flow");
    }

    if (risks.some(r => r.category === "privacy")) {
      recommendations.push("Review data minimization practices across the lineage path");
      recommendations.push("Verify PHI access controls at each transformation point");
    }

    if (affected.length > 5) {
      recommendations.push("Consider implementing circuit breakers for cascading failure prevention");
    }

    if (affected.some(a => a.impactLevel === "high")) {
      recommendations.push("Document recovery procedures for high-impact downstream systems");
    }

    return recommendations;
  }

  private calculateMetrics(nodes: LineageNode[], edges: LineageEdge[]): LineageMetrics {
    const sourceCount = nodes.filter(n => n.type === "source_system").length;
    const storeCount = nodes.filter(n => n.type === "data_store").length;
    const transformCount = nodes.filter(n => n.type === "transformation").length;

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      sourceSystemCount: sourceCount,
      dataStoreCount: storeCount,
      transformationCount: transformCount,
      avgPathLength: edges.length > 0 ? Math.round((edges.length / Math.max(sourceCount, 1)) * 10) / 10 : 0,
      maxPathLength: this.calculateMaxPathLength(nodes, edges),
      circularDependencies: 0,
    };
  }

  private calculateMaxPathLength(nodes: LineageNode[], edges: LineageEdge[]): number {
    const sources = nodes.filter(n => !edges.some(e => e.targetId === n.id));
    let maxLength = 0;

    sources.forEach(source => {
      const visited = new Set<string>();
      const queue: Array<{ id: string; depth: number }> = [{ id: source.id, depth: 0 }];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.id)) continue;
        visited.add(current.id);
        maxLength = Math.max(maxLength, current.depth);

        edges.filter(e => e.sourceId === current.id).forEach(e => {
          if (!visited.has(e.targetId)) {
            queue.push({ id: e.targetId, depth: current.depth + 1 });
          }
        });
      }
    });

    return maxLength;
  }

  private calculateRiskSummary(nodes: LineageNode[], edges: LineageEdge[]): RiskSummary {
    const criticalNodes = nodes.filter(n => n.riskLevel === "critical");
    const highRiskNodes = nodes.filter(n => n.riskLevel === "high");

    const riskPaths: RiskPath[] = [];
    const phiNodes = nodes.filter(n => n.sensitiveDataTypes.includes("PHI"));

    if (phiNodes.length > 1) {
      riskPaths.push({
        pathId: "phi-flow-path",
        nodes: phiNodes.map(n => n.id),
        riskLevel: "high",
        reason: "PHI data flows through multiple systems",
        sensitiveDataFlow: true,
      });
    }

    const riskFactors: LineageRiskFactor[] = [];
    if (criticalNodes.length > 0) {
      riskFactors.push({
        factor: "Critical System Concentration",
        severity: "critical",
        description: `${criticalNodes.length} critical systems identified in lineage`,
        affectedNodes: criticalNodes.map(n => n.id),
        category: "operational",
      });
    }

    if (highRiskNodes.length > 0) {
      riskFactors.push({
        factor: "High Risk Data Flows",
        severity: "high",
        description: `${highRiskNodes.length} high-risk nodes require enhanced monitoring`,
        affectedNodes: highRiskNodes.map(n => n.id),
        category: "security",
      });
    }

    const overallRisk: RiskLevel = criticalNodes.length > 0 ? "critical" :
      highRiskNodes.length > 2 ? "high" :
      highRiskNodes.length > 0 ? "medium" : "low";

    return {
      overallRisk,
      highRiskPaths: riskPaths,
      riskFactors,
      mitigationSuggestions: [
        "Implement data loss prevention controls on PHI flow paths",
        "Review access controls for critical systems",
        "Establish monitoring dashboards for high-risk data flows",
      ],
    };
  }

  private calculateComplianceSummary(nodes: LineageNode[], violations: PolicyViolation[]): ComplianceSummary {
    const reviewNeeded = nodes.filter(n => n.complianceStatus === "review_needed").length;
    const nonCompliant = nodes.filter(n => n.complianceStatus === "non_compliant").length;

    const overallStatus: ComplianceStatus = nonCompliant > 0 ? "non_compliant" :
      reviewNeeded > 0 ? "review_needed" : "compliant";

    const phiNodes = nodes.filter(n => n.sensitiveDataTypes.includes("PHI"));

    return {
      overallStatus,
      frameworks: [
        {
          framework: "HIPAA",
          status: violations.length > 0 ? "review_needed" : "compliant",
          score: violations.length > 0 ? 85 : 98,
          findings: violations.length > 0 ? ["Access control review required"] : [],
        },
        {
          framework: "SOC2",
          status: "compliant",
          score: 95,
          findings: [],
        },
      ],
      violations,
      policyImpacts: phiNodes.length > 0 ? [
        {
          policyId: "policy-phi-handling",
          policyName: "PHI Handling Policy",
          affectedNodes: phiNodes.map(n => n.id),
          impactLevel: "high",
          complianceRequirements: [
            "Encryption at rest and in transit",
            "Access logging for all PHI access",
            "Minimum necessary data principle",
          ],
        },
      ] : [],
    };
  }

  async analyzeLineageWithAI(query: string, context?: { nodeIds?: string[] }): Promise<AILineageAnalysis> {
    const graph = await this.getFullLineageGraph();
    
    const contextNodes = context?.nodeIds 
      ? graph.nodes.filter(n => context.nodeIds!.includes(n.id))
      : graph.nodes.slice(0, 5);

    const graphSummary = `
Lineage Graph Overview:
- Total nodes: ${graph.metrics.totalNodes}
- Total edges: ${graph.metrics.totalEdges}
- Source systems: ${graph.metrics.sourceSystemCount}
- Data stores: ${graph.metrics.dataStoreCount}
- Transformations: ${graph.metrics.transformationCount}

Risk Summary: ${graph.riskSummary.overallRisk}
Compliance Status: ${graph.complianceSummary.overallStatus}

Key Nodes:
${contextNodes.map(n => `- ${n.displayName} (${n.type}): ${n.description}`).join('\n')}

Active Violations: ${graph.complianceSummary.violations.length}
`;

    if (!openai) {
      return {
        query,
        analysis: `Based on the lineage graph analysis: The data flows from ${graph.metrics.sourceSystemCount} source systems through ${graph.metrics.transformationCount} transformations to ${graph.metrics.dataStoreCount} data stores. Current risk level is ${graph.riskSummary.overallRisk} with ${graph.complianceSummary.violations.length} compliance items needing attention.`,
        keyFindings: [
          `${graph.metrics.totalNodes} nodes in the lineage graph`,
          `Overall risk level: ${graph.riskSummary.overallRisk}`,
          `Compliance status: ${graph.complianceSummary.overallStatus}`,
        ],
        riskHighlights: graph.riskSummary.riskFactors.map(r => r.description),
        recommendations: graph.riskSummary.mitigationSuggestions,
        relatedNodes: contextNodes.map(n => n.id),
        generatedAt: new Date().toISOString(),
      };
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_LINEAGE_PROMPT },
          { 
            role: "user", 
            content: `Analyze this data lineage and answer: ${query}\n\nLineage Context:\n${graphSummary}` 
          },
        ],
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content || "Unable to generate analysis";

      return {
        query,
        analysis: response,
        keyFindings: [
          `${graph.metrics.totalNodes} nodes across the data ecosystem`,
          `Data flows through ${graph.metrics.transformationCount} transformation points`,
          `${graph.riskSummary.highRiskPaths.length} high-risk data paths identified`,
        ],
        riskHighlights: graph.riskSummary.riskFactors.map(r => r.description),
        recommendations: graph.riskSummary.mitigationSuggestions,
        relatedNodes: contextNodes.map(n => n.id),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[AIDataLineage] AI analysis error:", error);
      return {
        query,
        analysis: "AI analysis temporarily unavailable. Based on graph metrics, the lineage shows standard healthcare data flow patterns.",
        keyFindings: [`${graph.metrics.totalNodes} total nodes`, `Risk level: ${graph.riskSummary.overallRisk}`],
        riskHighlights: [],
        recommendations: graph.riskSummary.mitigationSuggestions,
        relatedNodes: [],
        generatedAt: new Date().toISOString(),
      };
    }
  }

  async getSystems(): Promise<string[]> {
    return Array.from(new Set(Array.from(nodeStore.values()).map(n => n.system)));
  }

  async getDomains(): Promise<DataDomain[]> {
    const domains = Array.from(nodeStore.values()).map(n => n.domain).filter(Boolean) as DataDomain[];
    return Array.from(new Set(domains));
  }

  async getDataClassifications(): Promise<SensitiveDataType[]> {
    const types = new Set<SensitiveDataType>();
    Array.from(nodeStore.values()).forEach(n => n.sensitiveDataTypes.forEach(t => types.add(t)));
    return Array.from(types);
  }
}

export const aiDataLineageService = new AIDataLineageService();
