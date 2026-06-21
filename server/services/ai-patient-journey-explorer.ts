import OpenAI from "openai";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import {
  aiClinicalWorkflowAutomation,
  PatientJourneyPattern,
  ReadmissionRiskAssessment,
  ProactiveIntervention,
  JourneyPhase,
  RiskLevel,
  PatternType,
} from "./ai-clinical-workflow-automation";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const NO_CDS_JOURNEY_PROMPT = `You are an AI-powered Patient Journey Explorer assistant. Your role is to:
1. Analyze patient pathway patterns for operational visualization
2. Identify temporal correlations between journey events
3. Detect predictive markers for operational planning
4. Highlight critical decision points in care coordination

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT recommend specific medications, therapies, or clinical interventions
- You focus ONLY on OPERATIONAL, ADMINISTRATIVE, and WORKFLOW insights

ALLOWED ANALYSES (Non-Clinical):
- Pathway timing and duration patterns
- Bottleneck identification in care workflows
- Care coordination efficiency metrics
- Appointment scheduling patterns
- Documentation workflow timing
- Care transition logistics
- Resource utilization patterns

PROHIBITED ANALYSES (Clinical - NEVER PROVIDE):
- Treatment effectiveness assessments
- Clinical outcome predictions
- Medication-related recommendations
- Diagnostic interpretations`;

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({
    type: "HIPAA_AUDIT",
    timestamp: new Date().toISOString(),
    component: "PatientJourneyExplorer",
    action,
    details: {
      ...details,
      patientId: details.patientId ? hashIdentifier(String(details.patientId)) : undefined,
    },
  }));
}

const CDS_PROHIBITED_PATTERNS = [
  /\b(prescribe|prescription|medication|drug|dosage|dose|mg|ml)\b/i,
  /\b(diagnose|diagnosis|prognosis|treatment plan|therapy|intervention)\b/i,
  /\b(recommend|suggest|advise) (taking|starting|stopping|changing|adjusting)\b/i,
  /\b(clinical trial|clinical study|clinical outcome|clinical indication)\b/i,
  /\b(symptom|symptoms|side effect|adverse event|contraindication)\b/i,
  /\b(bloodwork|lab results|test results|imaging|mri|ct scan|x-ray)\b/i,
  /\b(increase|decrease|adjust|modify) (medication|treatment|therapy|dosage)\b/i,
  /\b(consult|refer to) (specialist|physician|doctor|oncologist|cardiologist)\b/i,
];

function enforceCdsCompliance(text: string): { compliant: boolean; sanitized: string; violations: string[] } {
  const violations: string[] = [];
  let sanitized = text;

  CDS_PROHIBITED_PATTERNS.forEach((pattern, idx) => {
    if (pattern.test(text)) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push(`CDS violation detected: "${matches[0]}"`);
        sanitized = sanitized.replace(new RegExp(pattern.source, "gi"), "[REMOVED: Clinical content]");
      }
    }
  });

  const compliant = violations.length === 0;
  if (!compliant) {
    console.log(JSON.stringify({
      type: "CDS_GUARDRAIL_VIOLATION",
      timestamp: new Date().toISOString(),
      component: "PatientJourneyExplorer",
      violations,
      action: "CONTENT_SANITIZED",
    }));
  }

  return { compliant, sanitized, violations };
}

function sanitizeRecommendations(recommendations: string[]): string[] {
  return recommendations.map(rec => {
    const result = enforceCdsCompliance(rec);
    return result.compliant ? rec : result.sanitized;
  }).filter(rec => !rec.includes("[REMOVED: Clinical content]") || rec.replace(/\[REMOVED: Clinical content\]/g, "").trim().length > 10);
}

function sanitizeAiInsights(insights: {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  temporalPatterns: string[];
  predictiveAlerts: string[];
}): typeof insights {
  return {
    summary: enforceCdsCompliance(insights.summary).sanitized,
    keyFindings: sanitizeRecommendations(insights.keyFindings),
    recommendations: sanitizeRecommendations(insights.recommendations),
    temporalPatterns: sanitizeRecommendations(insights.temporalPatterns),
    predictiveAlerts: sanitizeRecommendations(insights.predictiveAlerts),
  };
}

export type PathwayNodeType = "intake" | "assessment" | "treatment" | "procedure" | "monitoring" | "follow_up" | "discharge" | "transition" | "decision_point" | "milestone";
export type EdgeType = "sequential" | "parallel" | "conditional" | "alternative" | "delayed" | "emergency";
export type TemporalMarkerType = "delay" | "acceleration" | "gap" | "overlap" | "recurring" | "milestone";
export type PredictiveMarkerType = "risk_indicator" | "outcome_predictor" | "bottleneck_warning" | "opportunity" | "trend";

export interface PathwayNode {
  id: string;
  type: PathwayNodeType;
  label: string;
  description: string;
  phase: JourneyPhase;
  timestamp: string;
  duration?: number;
  status: "completed" | "in_progress" | "pending" | "delayed" | "cancelled";
  riskLevel: RiskLevel;
  isDecisionPoint: boolean;
  isCritical: boolean;
  metadata: {
    facility?: string;
    department?: string;
    provider?: string;
    encounterType?: string;
    documentationComplete?: boolean;
  };
  position: { x: number; y: number; layer: number };
  connectedPatterns: string[];
  interventions: string[];
}

export interface PathwayEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  label?: string;
  duration?: number;
  expectedDuration?: number;
  isDelayed: boolean;
  riskContribution: number;
  transitionNotes?: string;
}

export interface TemporalCorrelation {
  id: string;
  type: TemporalMarkerType;
  description: string;
  affectedNodes: string[];
  timeframe: {
    start: string;
    end: string;
    durationDays: number;
  };
  significance: "high" | "medium" | "low";
  pattern: string;
  operationalImpact: string;
  suggestedActions: string[];
}

export interface PredictiveMarker {
  id: string;
  type: PredictiveMarkerType;
  title: string;
  description: string;
  confidence: number;
  riskLevel: RiskLevel;
  affectedPhases: JourneyPhase[];
  triggerConditions: string[];
  operationalIndicators: string[];
  recommendedActions: string[];
  timeToAction?: number;
  historicalAccuracy?: number;
}

export interface DecisionPoint {
  id: string;
  nodeId: string;
  type: "care_coordination" | "resource_allocation" | "scheduling" | "transition" | "escalation";
  title: string;
  description: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
    likelihood: number;
    operationalImpact: string;
    resourceRequirements: string[];
  }>;
  selectedOption?: string;
  timestamp: string;
  outcome?: {
    selected: string;
    result: string;
    effectivenessScore: number;
  };
}

export interface JourneyPathway {
  id: string;
  patientId: string;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  currentPhase: JourneyPhase;
  status: "active" | "completed" | "on_hold" | "discontinued";
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  temporalCorrelations: TemporalCorrelation[];
  predictiveMarkers: PredictiveMarker[];
  decisionPoints: DecisionPoint[];
  overallRisk: RiskLevel;
  progressPercentage: number;
  metrics: {
    totalDuration: number;
    averageStepDuration: number;
    delayedSteps: number;
    completedSteps: number;
    pendingSteps: number;
    criticalPathLength: number;
    bottleneckCount: number;
  };
}

export interface JourneySegment {
  id: string;
  name: string;
  phase: JourneyPhase;
  startNode: string;
  endNode: string;
  nodes: string[];
  duration: number;
  riskLevel: RiskLevel;
  patterns: PatternType[];
  interventionCount: number;
  isBottleneck: boolean;
}

export interface JourneyVisualizationData {
  pathway: JourneyPathway;
  segments: JourneySegment[];
  riskOverlay: {
    nodeRisks: Array<{ nodeId: string; riskLevel: RiskLevel; factors: string[] }>;
    edgeRisks: Array<{ edgeId: string; riskLevel: RiskLevel; reason: string }>;
    phaseRisks: Array<{ phase: JourneyPhase; riskLevel: RiskLevel; score: number }>;
  };
  interventionOverlay: {
    activeInterventions: ProactiveIntervention[];
    completedInterventions: ProactiveIntervention[];
    interventionsByNode: Record<string, string[]>;
    effectivenessMetrics: {
      totalInterventions: number;
      completionRate: number;
      averageEffectiveness: number;
    };
  };
  aiInsights: {
    summary: string;
    keyFindings: string[];
    recommendations: string[];
    temporalPatterns: string[];
    predictiveAlerts: string[];
  };
}

export interface JourneyFilter {
  phases?: JourneyPhase[];
  riskLevels?: RiskLevel[];
  dateRange?: { start: string; end: string };
  patternTypes?: PatternType[];
  includeDecisionPoints?: boolean;
  includeInterventions?: boolean;
  showCriticalOnly?: boolean;
  segmentId?: string;
}

export interface TemporalAnalysisResult {
  correlations: TemporalCorrelation[];
  patterns: Array<{
    type: string;
    description: string;
    frequency: number;
    averageDuration: number;
    operationalInsight: string;
  }>;
  timeline: Array<{
    date: string;
    events: Array<{ nodeId: string; type: string; description: string }>;
    riskLevel: RiskLevel;
  }>;
  bottleneckAnalysis: {
    identified: Array<{
      location: string;
      phase: JourneyPhase;
      averageDelay: number;
      frequency: number;
      impact: string;
    }>;
    recommendations: string[];
  };
}

const pathwayStore = new Map<string, JourneyPathway>();
const segmentStore = new Map<string, JourneySegment>();

function initializeSamplePathways(): void {
  const samplePathway: JourneyPathway = {
    id: "pathway-001",
    patientId: "patient-001",
    name: "Post-Discharge Care Coordination",
    description: "Comprehensive care pathway following hospital discharge with follow-up coordination",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    currentPhase: "follow_up",
    status: "active",
    nodes: [
      {
        id: "node-001",
        type: "intake",
        label: "Hospital Admission",
        description: "Initial hospital admission for acute care",
        phase: "intake",
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 1,
        status: "completed",
        riskLevel: "medium",
        isDecisionPoint: false,
        isCritical: true,
        metadata: { facility: "General Hospital", department: "Emergency" },
        position: { x: 0, y: 0, layer: 0 },
        connectedPatterns: [],
        interventions: [],
      },
      {
        id: "node-002",
        type: "assessment",
        label: "Initial Assessment",
        description: "Comprehensive health assessment and care planning",
        phase: "assessment",
        timestamp: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 2,
        status: "completed",
        riskLevel: "medium",
        isDecisionPoint: true,
        isCritical: true,
        metadata: { facility: "General Hospital", department: "Internal Medicine" },
        position: { x: 200, y: 0, layer: 1 },
        connectedPatterns: [],
        interventions: [],
      },
      {
        id: "node-003",
        type: "treatment",
        label: "Inpatient Treatment",
        description: "Active treatment phase during hospital stay",
        phase: "treatment",
        timestamp: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 5,
        status: "completed",
        riskLevel: "high",
        isDecisionPoint: false,
        isCritical: true,
        metadata: { facility: "General Hospital", department: "Internal Medicine" },
        position: { x: 400, y: 0, layer: 2 },
        connectedPatterns: [],
        interventions: [],
      },
      {
        id: "node-004",
        type: "decision_point",
        label: "Discharge Planning",
        description: "Critical decision point for discharge destination and follow-up",
        phase: "discharge",
        timestamp: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 1,
        status: "completed",
        riskLevel: "high",
        isDecisionPoint: true,
        isCritical: true,
        metadata: { facility: "General Hospital", department: "Care Coordination" },
        position: { x: 600, y: 0, layer: 3 },
        connectedPatterns: ["pat-001"],
        interventions: [],
      },
      {
        id: "node-005",
        type: "transition",
        label: "Hospital Discharge",
        description: "Transition from hospital to home care",
        phase: "transition",
        timestamp: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 1,
        status: "completed",
        riskLevel: "high",
        isDecisionPoint: false,
        isCritical: true,
        metadata: { facility: "General Hospital", department: "Discharge Planning" },
        position: { x: 800, y: 0, layer: 4 },
        connectedPatterns: [],
        interventions: ["int-001"],
      },
      {
        id: "node-006",
        type: "follow_up",
        label: "7-Day Follow-Up Call",
        description: "Post-discharge check-in call",
        phase: "follow_up",
        timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 0.5,
        status: "completed",
        riskLevel: "medium",
        isDecisionPoint: false,
        isCritical: false,
        metadata: { department: "Care Coordination" },
        position: { x: 1000, y: -50, layer: 5 },
        connectedPatterns: [],
        interventions: [],
      },
      {
        id: "node-007",
        type: "follow_up",
        label: "14-Day Follow-Up Visit",
        description: "Scheduled follow-up appointment - MISSED",
        phase: "follow_up",
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 0,
        status: "delayed",
        riskLevel: "critical",
        isDecisionPoint: true,
        isCritical: true,
        metadata: { facility: "Outpatient Clinic", department: "Primary Care" },
        position: { x: 1200, y: 0, layer: 6 },
        connectedPatterns: ["pat-001"],
        interventions: ["int-002"],
      },
      {
        id: "node-008",
        type: "milestone",
        label: "30-Day Milestone",
        description: "Critical 30-day post-discharge checkpoint",
        phase: "monitoring",
        timestamp: new Date().toISOString(),
        status: "pending",
        riskLevel: "high",
        isDecisionPoint: true,
        isCritical: true,
        metadata: {},
        position: { x: 1400, y: 0, layer: 7 },
        connectedPatterns: [],
        interventions: [],
      },
    ],
    edges: [
      { id: "edge-001", sourceId: "node-001", targetId: "node-002", type: "sequential", duration: 1, expectedDuration: 1, isDelayed: false, riskContribution: 0.1 },
      { id: "edge-002", sourceId: "node-002", targetId: "node-003", type: "sequential", duration: 2, expectedDuration: 2, isDelayed: false, riskContribution: 0.15 },
      { id: "edge-003", sourceId: "node-003", targetId: "node-004", type: "sequential", duration: 5, expectedDuration: 4, isDelayed: true, riskContribution: 0.2, transitionNotes: "Documentation completion delayed" },
      { id: "edge-004", sourceId: "node-004", targetId: "node-005", type: "sequential", duration: 1, expectedDuration: 1, isDelayed: false, riskContribution: 0.25 },
      { id: "edge-005", sourceId: "node-005", targetId: "node-006", type: "sequential", duration: 7, expectedDuration: 7, isDelayed: false, riskContribution: 0.1 },
      { id: "edge-006", sourceId: "node-005", targetId: "node-007", type: "parallel", duration: 14, expectedDuration: 14, isDelayed: false, riskContribution: 0.15, label: "Scheduled follow-up" },
      { id: "edge-007", sourceId: "node-006", targetId: "node-007", type: "sequential", duration: 7, expectedDuration: 7, isDelayed: false, riskContribution: 0.1 },
      { id: "edge-008", sourceId: "node-007", targetId: "node-008", type: "conditional", duration: 16, expectedDuration: 7, isDelayed: true, riskContribution: 0.4, transitionNotes: "Missed appointment - reschedule required" },
    ],
    temporalCorrelations: [
      {
        id: "tc-001",
        type: "delay",
        description: "Discharge documentation delayed by 1 day, correlated with weekend staffing",
        affectedNodes: ["node-003", "node-004"],
        timeframe: { start: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(), durationDays: 1 },
        significance: "medium",
        pattern: "Weekend staffing reduction correlates with documentation delays",
        operationalImpact: "Extended hospital stay by 1 day",
        suggestedActions: ["Review weekend documentation workflows", "Consider pre-weekend discharge planning"],
      },
      {
        id: "tc-002",
        type: "gap",
        description: "Care continuity gap identified between discharge and follow-up",
        affectedNodes: ["node-005", "node-007"],
        timeframe: { start: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), durationDays: 14 },
        significance: "high",
        pattern: "Follow-up appointment missed after discharge",
        operationalImpact: "Increased readmission risk due to care gap",
        suggestedActions: ["Implement automated appointment reminders", "Schedule backup contact protocols"],
      },
    ],
    predictiveMarkers: [
      {
        id: "pm-001",
        type: "risk_indicator",
        title: "Elevated Readmission Risk",
        description: "Multiple factors indicate elevated 30-day readmission risk for operational planning",
        confidence: 82,
        riskLevel: "high",
        affectedPhases: ["follow_up", "monitoring"],
        triggerConditions: ["Missed follow-up appointment", "Incomplete discharge documentation", "Limited social support indicators"],
        operationalIndicators: ["No confirmed PCP follow-up", "Medication reconciliation pending", "Transportation barriers noted"],
        recommendedActions: ["Prioritize outreach scheduling", "Arrange care coordinator contact", "Verify transportation for appointments"],
        timeToAction: 3,
        historicalAccuracy: 78,
      },
      {
        id: "pm-002",
        type: "bottleneck_warning",
        title: "Documentation Workflow Bottleneck",
        description: "Pattern indicates documentation completion delays affecting care transitions",
        confidence: 75,
        riskLevel: "medium",
        affectedPhases: ["discharge", "transition"],
        triggerConditions: ["Weekend discharge timing", "Multiple specialist involvement"],
        operationalIndicators: ["Pending discharge summary", "Incomplete medication list"],
        recommendedActions: ["Initiate documentation earlier in stay", "Assign documentation coordinator"],
        timeToAction: 5,
        historicalAccuracy: 72,
      },
    ],
    decisionPoints: [
      {
        id: "dp-001",
        nodeId: "node-004",
        type: "care_coordination",
        title: "Discharge Destination Decision",
        description: "Critical decision on post-discharge care setting",
        options: [
          { id: "opt-001", label: "Home with Home Health", description: "Discharge to home with home health services", likelihood: 65, operationalImpact: "Requires home health coordination", resourceRequirements: ["Home health referral", "Equipment delivery", "Medication delivery"] },
          { id: "opt-002", label: "Skilled Nursing Facility", description: "Discharge to SNF for continued care", likelihood: 25, operationalImpact: "Requires SNF bed availability and transfer", resourceRequirements: ["SNF bed reservation", "Transfer coordination", "Records transfer"] },
          { id: "opt-003", label: "Home - Self Care", description: "Discharge to home without additional services", likelihood: 10, operationalImpact: "Requires robust follow-up plan", resourceRequirements: ["Detailed discharge instructions", "Pharmacy coordination", "Follow-up scheduling"] },
        ],
        selectedOption: "opt-001",
        timestamp: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
        outcome: { selected: "Home with Home Health", result: "Care coordination initiated", effectivenessScore: 72 },
      },
      {
        id: "dp-002",
        nodeId: "node-007",
        type: "escalation",
        title: "Missed Appointment Response",
        description: "Decision on response to missed follow-up appointment",
        options: [
          { id: "opt-004", label: "Immediate Outreach", description: "Contact patient within 24 hours for rescheduling", likelihood: 70, operationalImpact: "Requires care coordinator availability", resourceRequirements: ["Care coordinator time", "Phone/text capability"] },
          { id: "opt-005", label: "Home Visit", description: "Schedule home visit to assess situation", likelihood: 20, operationalImpact: "Resource intensive but thorough assessment", resourceRequirements: ["Home visit nurse", "Transportation", "Mobile documentation"] },
          { id: "opt-006", label: "Automated Rescheduling", description: "Send automated rescheduling request", likelihood: 10, operationalImpact: "Low resource but lower engagement", resourceRequirements: ["Automated messaging system"] },
        ],
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    overallRisk: "high",
    progressPercentage: 75,
    metrics: {
      totalDuration: 30,
      averageStepDuration: 3.75,
      delayedSteps: 2,
      completedSteps: 6,
      pendingSteps: 2,
      criticalPathLength: 8,
      bottleneckCount: 2,
    },
  };

  pathwayStore.set(samplePathway.id, samplePathway);

  const segments: JourneySegment[] = [
    { id: "seg-001", name: "Acute Care Phase", phase: "treatment", startNode: "node-001", endNode: "node-003", nodes: ["node-001", "node-002", "node-003"], duration: 8, riskLevel: "medium", patterns: [], interventionCount: 0, isBottleneck: false },
    { id: "seg-002", name: "Discharge Transition", phase: "discharge", startNode: "node-004", endNode: "node-005", nodes: ["node-004", "node-005"], duration: 2, riskLevel: "high", patterns: ["transition_risk"], interventionCount: 1, isBottleneck: true },
    { id: "seg-003", name: "Post-Discharge Follow-up", phase: "follow_up", startNode: "node-006", endNode: "node-008", nodes: ["node-006", "node-007", "node-008"], duration: 20, riskLevel: "critical", patterns: ["care_gap", "follow_up_needed"], interventionCount: 1, isBottleneck: true },
  ];

  segments.forEach(s => segmentStore.set(s.id, s));

  console.log("[AIPatientJourneyExplorer] Sample pathways initialized: 1 pathway, 3 segments");
}

class AIPatientJourneyExplorer {
  constructor() {
    initializeSamplePathways();
    console.log("[AIPatientJourneyExplorer] OpenAI client", openai ? "configured" : "not configured");
    console.log("[AIPatientJourneyExplorer] Service initialized");
  }

  getPathway(pathwayId: string): JourneyPathway | undefined {
    return pathwayStore.get(pathwayId);
  }

  getPatientPathways(patientId: string): JourneyPathway[] {
    return Array.from(pathwayStore.values()).filter(p => p.patientId === patientId);
  }

  getAllPathways(): JourneyPathway[] {
    return Array.from(pathwayStore.values());
  }

  getSegments(pathwayId?: string): JourneySegment[] {
    if (!pathwayId) return Array.from(segmentStore.values());
    const pathway = pathwayStore.get(pathwayId);
    if (!pathway) return [];
    const nodeIds = new Set(pathway.nodes.map(n => n.id));
    return Array.from(segmentStore.values()).filter(s => 
      s.nodes.some(nId => nodeIds.has(nId))
    );
  }

  getFilteredPathway(pathwayId: string, filter: JourneyFilter): JourneyPathway | null {
    const pathway = pathwayStore.get(pathwayId);
    if (!pathway) return null;

    let nodes = [...pathway.nodes];
    let edges = [...pathway.edges];

    if (filter.phases && filter.phases.length > 0) {
      nodes = nodes.filter(n => filter.phases!.includes(n.phase));
    }

    if (filter.riskLevels && filter.riskLevels.length > 0) {
      nodes = nodes.filter(n => filter.riskLevels!.includes(n.riskLevel));
    }

    if (filter.showCriticalOnly) {
      nodes = nodes.filter(n => n.isCritical);
    }

    if (filter.dateRange) {
      const start = new Date(filter.dateRange.start).getTime();
      const end = new Date(filter.dateRange.end).getTime();
      nodes = nodes.filter(n => {
        const nodeTime = new Date(n.timestamp).getTime();
        return nodeTime >= start && nodeTime <= end;
      });
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

    const filteredCorrelations = pathway.temporalCorrelations.filter(tc =>
      tc.affectedNodes.some(nId => nodeIds.has(nId))
    );

    const filteredMarkers = pathway.predictiveMarkers.filter(pm =>
      !filter.phases || pm.affectedPhases.some(p => filter.phases!.includes(p))
    );

    const filteredDecisionPoints = filter.includeDecisionPoints !== false
      ? pathway.decisionPoints.filter(dp => nodeIds.has(dp.nodeId))
      : [];

    return {
      ...pathway,
      nodes,
      edges,
      temporalCorrelations: filteredCorrelations,
      predictiveMarkers: filteredMarkers,
      decisionPoints: filteredDecisionPoints,
    };
  }

  getVisualizationData(pathwayId: string, filter?: JourneyFilter): JourneyVisualizationData | null {
    const pathway = filter ? this.getFilteredPathway(pathwayId, filter) : pathwayStore.get(pathwayId);
    if (!pathway) return null;

    logHipaaAudit("VIEW_JOURNEY_VISUALIZATION", { pathwayId, patientId: pathway.patientId });

    const segments = this.getSegments(pathwayId);

    const nodeRisks = pathway.nodes.map(n => ({
      nodeId: n.id,
      riskLevel: n.riskLevel,
      factors: n.connectedPatterns.length > 0 
        ? [`Connected to ${n.connectedPatterns.length} pattern(s)`]
        : n.status === "delayed" ? ["Status: Delayed"] : [],
    }));

    const edgeRisks = pathway.edges.filter(e => e.isDelayed).map(e => ({
      edgeId: e.id,
      riskLevel: e.riskContribution > 0.3 ? "high" : e.riskContribution > 0.15 ? "medium" : "low" as RiskLevel,
      reason: e.transitionNotes || "Transition delayed",
    }));

    const phaseRisks = this.calculatePhaseRisks(pathway);

    const allInterventions = filter?.includeInterventions !== false
      ? aiClinicalWorkflowAutomation.getInterventions({ patientId: pathway.patientId })
      : [];

    const activeInterventions = allInterventions.filter(i => i.status === "pending" || i.status === "in_progress");
    const completedInterventions = allInterventions.filter(i => i.status === "completed");

    const interventionsByNode: Record<string, string[]> = {};
    pathway.nodes.forEach(n => {
      if (n.interventions.length > 0) {
        interventionsByNode[n.id] = n.interventions;
      }
    });

    const effectivenessMetrics = {
      totalInterventions: allInterventions.length,
      completionRate: allInterventions.length > 0 
        ? Math.round((completedInterventions.length / allInterventions.length) * 100) 
        : 0,
      averageEffectiveness: 72,
    };

    const rawInsights = {
      summary: "Patient pathway shows elevated risk due to missed follow-up appointment. Care coordination intervention recommended within 3 days.",
      keyFindings: [
        "Missed 14-day follow-up appointment creates care continuity gap",
        "Documentation delays during discharge transition identified",
        "30-day milestone approaching with pending actions",
      ],
      recommendations: [
        "Prioritize patient outreach for appointment rescheduling",
        "Review discharge documentation workflow for weekend discharges",
        "Assign dedicated care coordinator for 30-day milestone tracking",
      ],
      temporalPatterns: [
        "Weekend discharge timing correlates with documentation delays",
        "Post-discharge engagement drops after 7-day call without in-person follow-up",
      ],
      predictiveAlerts: [
        "82% confidence: Elevated care gap risk if follow-up not completed within 5 days",
        "75% confidence: Documentation bottleneck pattern may recur in similar cases",
      ],
    };

    return {
      pathway,
      segments,
      riskOverlay: { nodeRisks, edgeRisks, phaseRisks },
      interventionOverlay: { activeInterventions, completedInterventions, interventionsByNode, effectivenessMetrics },
      aiInsights: sanitizeAiInsights(rawInsights),
    };
  }

  private calculatePhaseRisks(pathway: JourneyPathway): Array<{ phase: JourneyPhase; riskLevel: RiskLevel; score: number }> {
    const phaseScores: Record<JourneyPhase, { total: number; count: number }> = {
      intake: { total: 0, count: 0 },
      assessment: { total: 0, count: 0 },
      treatment: { total: 0, count: 0 },
      monitoring: { total: 0, count: 0 },
      follow_up: { total: 0, count: 0 },
      discharge: { total: 0, count: 0 },
      transition: { total: 0, count: 0 },
    };

    const riskValues = { critical: 4, high: 3, medium: 2, low: 1 };

    pathway.nodes.forEach(n => {
      if (phaseScores[n.phase]) {
        phaseScores[n.phase].total += riskValues[n.riskLevel];
        phaseScores[n.phase].count++;
      }
    });

    return Object.entries(phaseScores)
      .filter(([_, v]) => v.count > 0)
      .map(([phase, v]) => {
        const avgScore = v.total / v.count;
        const riskLevel: RiskLevel = avgScore >= 3.5 ? "critical" : avgScore >= 2.5 ? "high" : avgScore >= 1.5 ? "medium" : "low";
        return { phase: phase as JourneyPhase, riskLevel, score: Math.round(avgScore * 25) };
      });
  }

  async analyzeTemporalCorrelations(pathwayId: string): Promise<TemporalAnalysisResult> {
    const pathway = pathwayStore.get(pathwayId);
    if (!pathway) {
      return {
        correlations: [],
        patterns: [],
        timeline: [],
        bottleneckAnalysis: { identified: [], recommendations: [] },
      };
    }

    logHipaaAudit("ANALYZE_TEMPORAL_CORRELATIONS", { pathwayId, patientId: pathway.patientId });

    let aiPatterns: Array<{ type: string; description: string; frequency: number; averageDuration: number; operationalInsight: string }> = [];

    if (openai) {
      try {
        const nodesSummary = pathway.nodes.map(n => ({
          type: n.type,
          phase: n.phase,
          status: n.status,
          duration: n.duration,
          isDelayed: n.status === "delayed",
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_JOURNEY_PROMPT },
            {
              role: "user",
              content: `Analyze temporal patterns in this patient journey for OPERATIONAL insights only.

Journey Summary:
- Total nodes: ${pathway.nodes.length}
- Delayed steps: ${pathway.metrics.delayedSteps}
- Bottleneck count: ${pathway.metrics.bottleneckCount}
- Current phase: ${pathway.currentPhase}

Node Summary: ${JSON.stringify(nodesSummary)}

Identify 2-3 temporal patterns. For each provide:
1. type (timing_pattern, delay_pattern, gap_pattern, workflow_pattern)
2. description (operational focus)
3. frequency (how often this pattern occurs, 1-10)
4. averageDuration (in days)
5. operationalInsight (workflow improvement suggestion)

Format as JSON array. NO clinical recommendations.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 800,
        });

        const content = response.choices[0]?.message?.content || "";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          aiPatterns = JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        console.error("[AIPatientJourneyExplorer] Temporal analysis error:", error);
      }
    }

    if (aiPatterns.length === 0) {
      aiPatterns = [
        { type: "delay_pattern", description: "Documentation delays during weekend transitions", frequency: 6, averageDuration: 1.5, operationalInsight: "Consider pre-weekend discharge planning protocols" },
        { type: "gap_pattern", description: "Follow-up engagement drops between phone and in-person visits", frequency: 4, averageDuration: 7, operationalInsight: "Implement intermediate touchpoints between scheduled visits" },
      ];
    }

    const timeline = pathway.nodes.map(n => ({
      date: n.timestamp.split("T")[0],
      events: [{ nodeId: n.id, type: n.type, description: n.label }],
      riskLevel: n.riskLevel,
    }));

    const bottleneckAnalysis = {
      identified: pathway.edges.filter(e => e.isDelayed).map(e => {
        const targetNode = pathway.nodes.find(n => n.id === e.targetId);
        return {
          location: targetNode?.label || e.targetId,
          phase: targetNode?.phase || "unknown" as JourneyPhase,
          averageDelay: (e.duration || 0) - (e.expectedDuration || 0),
          frequency: 3,
          impact: e.transitionNotes || "Transition delayed",
        };
      }),
      recommendations: [
        "Review staffing for weekend discharge planning",
        "Implement automated appointment reminder escalation",
        "Create backup contact protocols for missed appointments",
      ],
    };

    return {
      correlations: pathway.temporalCorrelations,
      patterns: aiPatterns,
      timeline,
      bottleneckAnalysis,
    };
  }

  async generatePredictiveInsights(pathwayId: string, query: string): Promise<{
    query: string;
    analysis: string;
    predictiveMarkers: PredictiveMarker[];
    recommendations: string[];
    confidence: number;
  }> {
    const pathway = pathwayStore.get(pathwayId);
    if (!pathway) {
      return {
        query,
        analysis: "Pathway not found",
        predictiveMarkers: [],
        recommendations: [],
        confidence: 0,
      };
    }

    logHipaaAudit("GENERATE_PREDICTIVE_INSIGHTS", { pathwayId, patientId: pathway.patientId, queryLength: query.length });

    let analysis = "";
    let recommendations: string[] = [];
    let confidence = 75;

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_JOURNEY_PROMPT },
            {
              role: "user",
              content: `Patient Journey Analysis Query: "${query}"

Journey Context:
- Current Phase: ${pathway.currentPhase}
- Overall Risk: ${pathway.overallRisk}
- Progress: ${pathway.progressPercentage}%
- Delayed Steps: ${pathway.metrics.delayedSteps}
- Pending Steps: ${pathway.metrics.pendingSteps}
- Active Predictive Markers: ${pathway.predictiveMarkers.length}

Existing Markers: ${JSON.stringify(pathway.predictiveMarkers.map(m => ({ type: m.type, title: m.title, confidence: m.confidence })))}

Provide OPERATIONAL analysis answering the query. Include:
1. analysis: Direct answer to the query (2-3 sentences, operational focus only)
2. recommendations: Array of 2-3 operational recommendations
3. confidence: Confidence score 0-100

Format as JSON object. NO clinical recommendations.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 600,
        });

        const content = response.choices[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          analysis = parsed.analysis || "";
          recommendations = parsed.recommendations || [];
          confidence = parsed.confidence || 75;
        }
      } catch (error) {
        console.error("[AIPatientJourneyExplorer] Predictive insights error:", error);
      }
    }

    if (!analysis) {
      analysis = `Based on the patient journey data, the current ${pathway.currentPhase} phase shows ${pathway.overallRisk} risk level with ${pathway.metrics.delayedSteps} delayed steps requiring attention. Operational focus should be on care coordination and appointment scheduling.`;
      recommendations = [
        "Prioritize outreach for delayed follow-up appointments",
        "Review and address documentation bottlenecks",
        "Assign care coordinator for milestone tracking",
      ];
    }

    const sanitizedAnalysis = enforceCdsCompliance(analysis);
    const sanitizedRecommendations = sanitizeRecommendations(recommendations);

    return {
      query,
      analysis: sanitizedAnalysis.sanitized,
      predictiveMarkers: pathway.predictiveMarkers.map(m => ({
        ...m,
        recommendedActions: sanitizeRecommendations(m.recommendedActions),
      })),
      recommendations: sanitizedRecommendations,
      confidence,
    };
  }

  getDashboard(): {
    totalPathways: number;
    activePathways: number;
    highRiskPathways: number;
    avgProgress: number;
    totalDecisionPoints: number;
    pendingDecisions: number;
    temporalAlerts: number;
    predictiveMarkers: number;
    phaseDistribution: Array<{ phase: JourneyPhase; count: number }>;
    riskDistribution: Array<{ level: RiskLevel; count: number }>;
    recentActivity: Array<{ pathwayId: string; action: string; timestamp: string }>;
  } {
    const pathways = Array.from(pathwayStore.values());

    const phaseCount: Record<JourneyPhase, number> = {
      intake: 0, assessment: 0, treatment: 0, monitoring: 0, follow_up: 0, discharge: 0, transition: 0,
    };
    const riskCount: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 };

    let totalProgress = 0;
    let totalDecisionPoints = 0;
    let pendingDecisions = 0;
    let temporalAlerts = 0;
    let predictiveMarkerCount = 0;

    pathways.forEach(p => {
      phaseCount[p.currentPhase]++;
      riskCount[p.overallRisk]++;
      totalProgress += p.progressPercentage;
      totalDecisionPoints += p.decisionPoints.length;
      pendingDecisions += p.decisionPoints.filter(dp => !dp.selectedOption).length;
      temporalAlerts += p.temporalCorrelations.filter(tc => tc.significance === "high").length;
      predictiveMarkerCount += p.predictiveMarkers.length;
    });

    return {
      totalPathways: pathways.length,
      activePathways: pathways.filter(p => p.status === "active").length,
      highRiskPathways: pathways.filter(p => p.overallRisk === "critical" || p.overallRisk === "high").length,
      avgProgress: pathways.length > 0 ? Math.round(totalProgress / pathways.length) : 0,
      totalDecisionPoints,
      pendingDecisions,
      temporalAlerts,
      predictiveMarkers: predictiveMarkerCount,
      phaseDistribution: Object.entries(phaseCount).map(([phase, count]) => ({ phase: phase as JourneyPhase, count })),
      riskDistribution: Object.entries(riskCount).map(([level, count]) => ({ level: level as RiskLevel, count })),
      recentActivity: [
        { pathwayId: "pathway-001", action: "Missed appointment detected", timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
        { pathwayId: "pathway-001", action: "Intervention created", timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
      ],
    };
  }
}

export const aiPatientJourneyExplorer = new AIPatientJourneyExplorer();
