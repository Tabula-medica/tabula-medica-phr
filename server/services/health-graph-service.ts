import { generatePhiSafeText } from "./ai-gateway";

export interface HealthNode {
  id: string;
  nodeType: "condition" | "medication" | "procedure" | "lab" | "vital" | "imaging" | "specialist" | "episode" | "encounter" | "symptom" | "allergy";
  label: string;
  code?: string;
  codeSystem?: string;
  startDate?: string;
  endDate?: string;
  status: "active" | "resolved" | "inactive" | "unknown";
  source: string;
  confidence: number;
  metadata: Record<string, any>;
}

export interface SymptomConditionLink {
  symptomNodeId: string;
  symptomLabel: string;
  conditionNodeId: string;
  conditionLabel: string;
  relationshipType: RelationshipType;
  confidence: number;
  strength: number;
  evidence: string[];
  aiInferred: boolean;
  clinicalRationale: string;
  temporalCorrelation: string;
}

export interface SymptomAnalysis {
  patientId: string;
  totalSymptoms: number;
  totalLinks: number;
  symptomNodes: HealthNode[];
  conditionNodes: HealthNode[];
  links: SymptomConditionLink[];
  clusters: SymptomCluster[];
  insights: GraphInsight[];
  noCdsDisclaimer: string;
  analyzedAt: string;
}

export interface SymptomCluster {
  id: string;
  name: string;
  description: string;
  symptomIds: string[];
  primaryConditionId: string;
  conditionLabel: string;
  clusterConfidence: number;
  clinicalPattern: string;
}

export interface HealthEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: RelationshipType;
  strength: number;
  temporalOrder: "before" | "after" | "concurrent" | "unknown";
  evidence: string[];
  aiInferred: boolean;
  confidence: number;
  createdAt: string;
}

export type RelationshipType =
  | "treats"
  | "causes"
  | "monitors"
  | "diagnosed_by"
  | "ordered_by"
  | "performed_during"
  | "resulted_in"
  | "contraindicated_by"
  | "indicates"
  | "follows"
  | "part_of_episode"
  | "managed_by"
  | "improved_by"
  | "worsened_by"
  | "correlated_with";

export interface HealthGraph {
  patientId: string;
  nodes: HealthNode[];
  edges: HealthEdge[];
  episodes: Episode[];
  timelines: Timeline[];
  lastUpdated: string;
  version: number;
}

export interface Episode {
  id: string;
  episodeType: "chronic_condition" | "acute_illness" | "surgical" | "pregnancy" | "preventive" | "mental_health" | "rehabilitation";
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  status: "active" | "resolved" | "ongoing";
  nodeIds: string[];
  primaryConditionId?: string;
  specialists: string[];
  outcomes: string[];
}

export interface Timeline {
  id: string;
  timelineType: "medication" | "condition" | "labs" | "procedures" | "overall";
  events: TimelineEvent[];
}

export interface TimelineEvent {
  nodeId: string;
  date: string;
  eventType: string;
  description: string;
  significance: "high" | "medium" | "low";
}

export interface GraphInsight {
  insightId: string;
  insightType: "correlation" | "trend" | "risk" | "gap" | "interaction" | "optimization";
  title: string;
  description: string;
  relatedNodeIds: string[];
  confidence: number;
  actionable: boolean;
  noCdsDisclaimer: string;
}

export interface GraphQuery {
  nodeTypes?: string[];
  relationshipTypes?: RelationshipType[];
  dateRange?: { start: string; end: string };
  depth?: number;
  centerNodeId?: string;
}

class HealthGraphService {
  private graphs: Map<string, HealthGraph> = new Map();
  private readonly NO_CDS_DISCLAIMER = "This is for informational purposes only and does not constitute medical advice. Always consult your healthcare provider.";

  async initializeGraph(patientId: string): Promise<HealthGraph> {
    const existingGraph = this.graphs.get(patientId);
    if (existingGraph) {
      return existingGraph;
    }

    const graph: HealthGraph = {
      patientId,
      nodes: [],
      edges: [],
      episodes: [],
      timelines: [],
      lastUpdated: new Date().toISOString(),
      version: 1,
    };

    // Initialize with sample health data for samplenstration
    await this.populateSampleData(graph);

    this.graphs.set(patientId, graph);
    console.log(`[HealthGraph] Initialized graph for patient ${patientId}`);
    console.log(`[HIPAA-AUDIT] Health graph accessed - Patient: ${patientId}, Action: INITIALIZE`);

    return graph;
  }

  private async populateSampleData(graph: HealthGraph): Promise<void> {
    // Sample conditions
    const hypertension: HealthNode = {
      id: "cond_hypertension_001",
      nodeType: "condition",
      label: "Essential Hypertension",
      code: "I10",
      codeSystem: "ICD-10",
      startDate: "2020-03-15",
      status: "active",
      source: "Regional Medical Center",
      confidence: 0.98,
      metadata: { severity: "Stage 2", controlled: true },
    };

    const diabetes: HealthNode = {
      id: "cond_diabetes_001",
      nodeType: "condition",
      label: "Type 2 Diabetes Mellitus",
      code: "E11.9",
      codeSystem: "ICD-10",
      startDate: "2019-06-20",
      status: "active",
      source: "Primary Care Clinic",
      confidence: 0.99,
      metadata: { hba1c: 7.2, controlled: true },
    };

    const ckd: HealthNode = {
      id: "cond_ckd_001",
      nodeType: "condition",
      label: "Chronic Kidney Disease Stage 2",
      code: "N18.2",
      codeSystem: "ICD-10",
      startDate: "2022-01-10",
      status: "active",
      source: "Nephrology Associates",
      confidence: 0.95,
      metadata: { eGFR: 72 },
    };

    // Sample medications
    const lisinopril: HealthNode = {
      id: "med_lisinopril_001",
      nodeType: "medication",
      label: "Lisinopril 20mg",
      code: "197884",
      codeSystem: "RxNorm",
      startDate: "2020-03-20",
      status: "active",
      source: "Regional Medical Center",
      confidence: 0.99,
      metadata: { dosage: "20mg", frequency: "daily", route: "oral" },
    };

    const metformin: HealthNode = {
      id: "med_metformin_001",
      nodeType: "medication",
      label: "Metformin 1000mg",
      code: "861007",
      codeSystem: "RxNorm",
      startDate: "2019-06-25",
      status: "active",
      source: "Primary Care Clinic",
      confidence: 0.99,
      metadata: { dosage: "1000mg", frequency: "twice daily", route: "oral" },
    };

    const amlodipine: HealthNode = {
      id: "med_amlodipine_001",
      nodeType: "medication",
      label: "Amlodipine 5mg",
      code: "197361",
      codeSystem: "RxNorm",
      startDate: "2021-02-15",
      status: "active",
      source: "Primary Care Clinic",
      confidence: 0.99,
      metadata: { dosage: "5mg", frequency: "daily", route: "oral" },
    };

    // Sample labs
    const creatinine: HealthNode = {
      id: "lab_creatinine_001",
      nodeType: "lab",
      label: "Serum Creatinine",
      code: "2160-0",
      codeSystem: "LOINC",
      startDate: "2024-01-15",
      status: "active",
      source: "Quest Diagnostics",
      confidence: 0.99,
      metadata: { 
        value: 1.3, 
        unit: "mg/dL", 
        referenceRange: "0.7-1.3",
        trend: [
          { date: "2022-01-10", value: 1.0 },
          { date: "2022-07-15", value: 1.1 },
          { date: "2023-01-20", value: 1.2 },
          { date: "2023-07-25", value: 1.25 },
          { date: "2024-01-15", value: 1.3 },
        ]
      },
    };

    const hba1c: HealthNode = {
      id: "lab_hba1c_001",
      nodeType: "lab",
      label: "Hemoglobin A1c",
      code: "4548-4",
      codeSystem: "LOINC",
      startDate: "2024-01-15",
      status: "active",
      source: "Quest Diagnostics",
      confidence: 0.99,
      metadata: { 
        value: 7.2, 
        unit: "%", 
        referenceRange: "< 5.7",
        trend: [
          { date: "2019-06-20", value: 8.5 },
          { date: "2020-01-15", value: 7.8 },
          { date: "2021-01-20", value: 7.4 },
          { date: "2022-01-15", value: 7.1 },
          { date: "2023-01-20", value: 7.0 },
          { date: "2024-01-15", value: 7.2 },
        ]
      },
    };

    const egfr: HealthNode = {
      id: "lab_egfr_001",
      nodeType: "lab",
      label: "Estimated GFR",
      code: "33914-3",
      codeSystem: "LOINC",
      startDate: "2024-01-15",
      status: "active",
      source: "Quest Diagnostics",
      confidence: 0.99,
      metadata: { 
        value: 72, 
        unit: "mL/min/1.73m2", 
        referenceRange: "> 90",
        trend: [
          { date: "2020-03-15", value: 95 },
          { date: "2021-03-20", value: 88 },
          { date: "2022-01-10", value: 78 },
          { date: "2023-01-20", value: 74 },
          { date: "2024-01-15", value: 72 },
        ]
      },
    };

    // Sample specialists
    const cardiologist: HealthNode = {
      id: "spec_cardio_001",
      nodeType: "specialist",
      label: "Dr. Sarah Chen - Cardiology",
      startDate: "2020-04-10",
      status: "active",
      source: "Cardiology Associates",
      confidence: 0.99,
      metadata: { specialty: "Cardiology", npi: "1234567890", facilityName: "Heart Health Center" },
    };

    const nephrologist: HealthNode = {
      id: "spec_nephro_001",
      nodeType: "specialist",
      label: "Dr. Michael Wong - Nephrology",
      startDate: "2022-01-15",
      status: "active",
      source: "Nephrology Associates",
      confidence: 0.99,
      metadata: { specialty: "Nephrology", npi: "0987654321", facilityName: "Kidney Care Center" },
    };

    const endocrinologist: HealthNode = {
      id: "spec_endo_001",
      nodeType: "specialist",
      label: "Dr. Lisa Park - Endocrinology",
      startDate: "2019-07-01",
      status: "active",
      source: "Diabetes & Endocrine Center",
      confidence: 0.99,
      metadata: { specialty: "Endocrinology", npi: "1122334455", facilityName: "Diabetes Management Clinic" },
    };

    // Sample imaging
    const echocardiogram: HealthNode = {
      id: "img_echo_001",
      nodeType: "imaging",
      label: "Echocardiogram",
      code: "93306",
      codeSystem: "CPT",
      startDate: "2023-06-15",
      status: "active",
      source: "Heart Health Center",
      confidence: 0.99,
      metadata: { 
        findings: "Mild left ventricular hypertrophy, EF 55%",
        indication: "Hypertension evaluation"
      },
    };

    const headaches: HealthNode = {
      id: "sym_headache_001",
      nodeType: "symptom",
      label: "Recurring Headaches",
      code: "R51.9",
      codeSystem: "ICD-10",
      startDate: "2020-05-10",
      status: "active",
      source: "Patient-Reported",
      confidence: 0.85,
      metadata: {
        severity: "moderate",
        frequency: "3-4 times per week",
        location: "occipital and temporal",
        triggers: ["stress", "morning hours"],
        duration: "2-4 hours",
        reportedBy: "patient",
        onsetContext: "Began approximately 2 months after hypertension diagnosis",
        lastReported: "2025-12-15",
      },
    };

    const dizziness: HealthNode = {
      id: "sym_dizziness_001",
      nodeType: "symptom",
      label: "Dizziness & Lightheadedness",
      code: "R42",
      codeSystem: "ICD-10",
      startDate: "2020-06-05",
      status: "active",
      source: "Patient-Reported",
      confidence: 0.80,
      metadata: {
        severity: "mild to moderate",
        frequency: "2-3 times per week",
        triggers: ["standing quickly", "medication timing"],
        duration: "5-15 minutes",
        reportedBy: "patient",
        onsetContext: "Reported after starting blood pressure medications",
        lastReported: "2026-01-10",
      },
    };

    const fatigue: HealthNode = {
      id: "sym_fatigue_001",
      nodeType: "symptom",
      label: "Persistent Fatigue",
      code: "R53.83",
      codeSystem: "ICD-10",
      startDate: "2019-08-15",
      status: "active",
      source: "Patient-Reported",
      confidence: 0.88,
      metadata: {
        severity: "moderate",
        frequency: "daily",
        pattern: "worse in afternoon",
        impact: "affects daily activities and work performance",
        reportedBy: "patient",
        onsetContext: "Developed 2 months after diabetes diagnosis, persists despite treatment",
        lastReported: "2026-01-20",
      },
    };

    const frequentUrination: HealthNode = {
      id: "sym_polyuria_001",
      nodeType: "symptom",
      label: "Frequent Urination",
      code: "R35.0",
      codeSystem: "ICD-10",
      startDate: "2019-05-01",
      status: "active",
      source: "Patient-Reported",
      confidence: 0.90,
      metadata: {
        severity: "moderate",
        frequency: "8-10 times daily, 2-3 times nightly",
        reportedBy: "patient",
        onsetContext: "Key presenting symptom before diabetes diagnosis",
        improvement: "Improved with metformin but persists at reduced frequency",
        lastReported: "2025-11-20",
      },
    };

    const tingling: HealthNode = {
      id: "sym_tingling_001",
      nodeType: "symptom",
      label: "Numbness & Tingling in Extremities",
      code: "R20.2",
      codeSystem: "ICD-10",
      startDate: "2023-03-10",
      status: "active",
      source: "Patient-Reported",
      confidence: 0.82,
      metadata: {
        severity: "mild",
        frequency: "intermittent, several times per week",
        location: "feet and lower legs, occasionally hands",
        pattern: "worse at night",
        reportedBy: "patient",
        onsetContext: "Gradual onset noticed approximately 4 years after diabetes diagnosis",
        lastReported: "2026-01-25",
      },
    };

    const legSwelling: HealthNode = {
      id: "sym_edema_001",
      nodeType: "symptom",
      label: "Leg Swelling",
      code: "R60.0",
      codeSystem: "ICD-10",
      startDate: "2022-06-15",
      status: "active",
      source: "Patient-Reported",
      confidence: 0.83,
      metadata: {
        severity: "mild to moderate",
        frequency: "daily, worse in evening",
        location: "bilateral lower legs and ankles",
        reportedBy: "patient",
        onsetContext: "Noted approximately 6 months after CKD diagnosis",
        aggravatingFactors: ["prolonged standing", "high sodium intake"],
        lastReported: "2026-01-18",
      },
    };

    const blurredVision: HealthNode = {
      id: "sym_vision_001",
      nodeType: "symptom",
      label: "Intermittent Blurred Vision",
      code: "H53.8",
      codeSystem: "ICD-10",
      startDate: "2021-09-20",
      status: "active",
      source: "Patient-Reported",
      confidence: 0.78,
      metadata: {
        severity: "mild",
        frequency: "several times per month",
        pattern: "correlates with blood glucose fluctuations",
        reportedBy: "patient",
        onsetContext: "Episodic blurring noticed during periods of poor glucose control",
        lastReported: "2025-12-28",
      },
    };

    const dryCough: HealthNode = {
      id: "sym_cough_001",
      nodeType: "symptom",
      label: "Persistent Dry Cough",
      code: "R05.9",
      codeSystem: "ICD-10",
      startDate: "2020-04-15",
      status: "active",
      source: "Patient-Reported",
      confidence: 0.86,
      metadata: {
        severity: "mild",
        frequency: "daily, worse at night",
        character: "dry, non-productive",
        reportedBy: "patient",
        onsetContext: "Developed approximately 1 month after starting Lisinopril (ACE inhibitor)",
        lastReported: "2026-01-15",
      },
    };

    graph.nodes = [
      hypertension, diabetes, ckd,
      lisinopril, metformin, amlodipine,
      creatinine, hba1c, egfr,
      cardiologist, nephrologist, endocrinologist,
      echocardiogram,
      headaches, dizziness, fatigue, frequentUrination,
      tingling, legSwelling, blurredVision, dryCough,
    ];

    // Create meaningful relationships (edges)
    graph.edges = [
      // Medications treating conditions
      {
        id: "edge_001",
        sourceNodeId: "med_lisinopril_001",
        targetNodeId: "cond_hypertension_001",
        relationshipType: "treats",
        strength: 0.95,
        temporalOrder: "after",
        evidence: ["Prescribed 5 days after hypertension diagnosis"],
        aiInferred: false,
        confidence: 0.99,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_002",
        sourceNodeId: "med_metformin_001",
        targetNodeId: "cond_diabetes_001",
        relationshipType: "treats",
        strength: 0.98,
        temporalOrder: "after",
        evidence: ["First-line diabetes medication"],
        aiInferred: false,
        confidence: 0.99,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_003",
        sourceNodeId: "med_amlodipine_001",
        targetNodeId: "cond_hypertension_001",
        relationshipType: "treats",
        strength: 0.90,
        temporalOrder: "after",
        evidence: ["Added for additional BP control"],
        aiInferred: false,
        confidence: 0.98,
        createdAt: new Date().toISOString(),
      },
      // Labs monitoring conditions
      {
        id: "edge_004",
        sourceNodeId: "lab_creatinine_001",
        targetNodeId: "cond_ckd_001",
        relationshipType: "monitors",
        strength: 0.95,
        temporalOrder: "concurrent",
        evidence: ["Creatinine monitors kidney function"],
        aiInferred: false,
        confidence: 0.99,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_005",
        sourceNodeId: "lab_egfr_001",
        targetNodeId: "cond_ckd_001",
        relationshipType: "diagnosed_by",
        strength: 0.98,
        temporalOrder: "before",
        evidence: ["eGFR decline led to CKD diagnosis"],
        aiInferred: false,
        confidence: 0.99,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_006",
        sourceNodeId: "lab_hba1c_001",
        targetNodeId: "cond_diabetes_001",
        relationshipType: "monitors",
        strength: 0.98,
        temporalOrder: "concurrent",
        evidence: ["HbA1c primary diabetes control metric"],
        aiInferred: false,
        confidence: 0.99,
        createdAt: new Date().toISOString(),
      },
      // Specialists managing conditions
      {
        id: "edge_007",
        sourceNodeId: "spec_cardio_001",
        targetNodeId: "cond_hypertension_001",
        relationshipType: "managed_by",
        strength: 0.90,
        temporalOrder: "after",
        evidence: ["Referred to cardiology for BP management"],
        aiInferred: false,
        confidence: 0.95,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_008",
        sourceNodeId: "spec_nephro_001",
        targetNodeId: "cond_ckd_001",
        relationshipType: "managed_by",
        strength: 0.95,
        temporalOrder: "after",
        evidence: ["Nephrology referral for CKD management"],
        aiInferred: false,
        confidence: 0.98,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_009",
        sourceNodeId: "spec_endo_001",
        targetNodeId: "cond_diabetes_001",
        relationshipType: "managed_by",
        strength: 0.95,
        temporalOrder: "after",
        evidence: ["Endocrinology managing diabetes"],
        aiInferred: false,
        confidence: 0.98,
        createdAt: new Date().toISOString(),
      },
      // AI-inferred correlations
      {
        id: "edge_010",
        sourceNodeId: "med_lisinopril_001",
        targetNodeId: "lab_creatinine_001",
        relationshipType: "correlated_with",
        strength: 0.75,
        temporalOrder: "before",
        evidence: ["ACE inhibitors can affect kidney function; creatinine rose after lisinopril initiation"],
        aiInferred: true,
        confidence: 0.82,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_011",
        sourceNodeId: "cond_diabetes_001",
        targetNodeId: "cond_ckd_001",
        relationshipType: "causes",
        strength: 0.85,
        temporalOrder: "before",
        evidence: ["Diabetes is a leading cause of CKD; temporal progression observed"],
        aiInferred: true,
        confidence: 0.88,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_012",
        sourceNodeId: "cond_hypertension_001",
        targetNodeId: "cond_ckd_001",
        relationshipType: "causes",
        strength: 0.80,
        temporalOrder: "before",
        evidence: ["Hypertension contributes to kidney damage"],
        aiInferred: true,
        confidence: 0.85,
        createdAt: new Date().toISOString(),
      },
      // Imaging ordered by specialist
      {
        id: "edge_013",
        sourceNodeId: "spec_cardio_001",
        targetNodeId: "img_echo_001",
        relationshipType: "ordered_by",
        strength: 0.95,
        temporalOrder: "before",
        evidence: ["Cardiologist ordered echo for LVH evaluation"],
        aiInferred: false,
        confidence: 0.99,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_014",
        sourceNodeId: "img_echo_001",
        targetNodeId: "cond_hypertension_001",
        relationshipType: "indicates",
        strength: 0.88,
        temporalOrder: "after",
        evidence: ["LVH finding consistent with chronic hypertension"],
        aiInferred: true,
        confidence: 0.90,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_001",
        sourceNodeId: "sym_headache_001",
        targetNodeId: "cond_hypertension_001",
        relationshipType: "indicates",
        strength: 0.82,
        temporalOrder: "after",
        evidence: ["Occipital headaches common in uncontrolled hypertension", "Temporal correlation: onset 2 months post-diagnosis"],
        aiInferred: true,
        confidence: 0.84,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_002",
        sourceNodeId: "sym_dizziness_001",
        targetNodeId: "cond_hypertension_001",
        relationshipType: "correlated_with",
        strength: 0.75,
        temporalOrder: "after",
        evidence: ["Dizziness may indicate BP fluctuation", "Onset coincides with antihypertensive medication start"],
        aiInferred: true,
        confidence: 0.78,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_003",
        sourceNodeId: "sym_dizziness_001",
        targetNodeId: "med_lisinopril_001",
        relationshipType: "correlated_with",
        strength: 0.80,
        temporalOrder: "after",
        evidence: ["ACE inhibitor side effect: orthostatic dizziness", "Patient reports dizziness worse around medication timing"],
        aiInferred: true,
        confidence: 0.83,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_004",
        sourceNodeId: "sym_fatigue_001",
        targetNodeId: "cond_diabetes_001",
        relationshipType: "indicates",
        strength: 0.85,
        temporalOrder: "after",
        evidence: ["Fatigue is common in Type 2 Diabetes due to insulin resistance", "Onset correlated with diabetes diagnosis timeframe"],
        aiInferred: true,
        confidence: 0.87,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_005",
        sourceNodeId: "sym_fatigue_001",
        targetNodeId: "cond_ckd_001",
        relationshipType: "correlated_with",
        strength: 0.70,
        temporalOrder: "concurrent",
        evidence: ["CKD commonly causes fatigue through anemia and toxin buildup", "Multiple contributing conditions may compound fatigue"],
        aiInferred: true,
        confidence: 0.72,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_006",
        sourceNodeId: "sym_polyuria_001",
        targetNodeId: "cond_diabetes_001",
        relationshipType: "indicates",
        strength: 0.92,
        temporalOrder: "before",
        evidence: ["Polyuria is a hallmark presenting symptom of diabetes mellitus", "Patient reported this symptom before diabetes diagnosis"],
        aiInferred: false,
        confidence: 0.95,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_007",
        sourceNodeId: "sym_tingling_001",
        targetNodeId: "cond_diabetes_001",
        relationshipType: "indicates",
        strength: 0.88,
        temporalOrder: "after",
        evidence: ["Peripheral neuropathy is a common complication of long-standing diabetes", "Onset 4 years after diagnosis consistent with diabetic neuropathy timeline"],
        aiInferred: true,
        confidence: 0.86,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_008",
        sourceNodeId: "sym_edema_001",
        targetNodeId: "cond_ckd_001",
        relationshipType: "indicates",
        strength: 0.85,
        temporalOrder: "after",
        evidence: ["Peripheral edema common in CKD due to fluid retention", "Onset 6 months after CKD diagnosis supports renal cause"],
        aiInferred: true,
        confidence: 0.84,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_009",
        sourceNodeId: "sym_edema_001",
        targetNodeId: "med_amlodipine_001",
        relationshipType: "correlated_with",
        strength: 0.78,
        temporalOrder: "after",
        evidence: ["Peripheral edema is a known side effect of calcium channel blockers", "Amlodipine started before edema onset"],
        aiInferred: true,
        confidence: 0.80,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_010",
        sourceNodeId: "sym_vision_001",
        targetNodeId: "cond_diabetes_001",
        relationshipType: "indicates",
        strength: 0.83,
        temporalOrder: "after",
        evidence: ["Blurred vision correlates with glucose fluctuations", "May indicate early diabetic retinopathy risk"],
        aiInferred: true,
        confidence: 0.81,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_011",
        sourceNodeId: "sym_vision_001",
        targetNodeId: "cond_hypertension_001",
        relationshipType: "correlated_with",
        strength: 0.65,
        temporalOrder: "after",
        evidence: ["Hypertensive retinopathy can cause visual changes", "Co-morbid diabetes and hypertension increase retinal risk"],
        aiInferred: true,
        confidence: 0.68,
        createdAt: new Date().toISOString(),
      },
      {
        id: "edge_sym_012",
        sourceNodeId: "sym_cough_001",
        targetNodeId: "med_lisinopril_001",
        relationshipType: "correlated_with",
        strength: 0.92,
        temporalOrder: "after",
        evidence: ["Dry cough is a well-known ACE inhibitor side effect (5-20% incidence)", "Onset 1 month after starting Lisinopril is typical"],
        aiInferred: false,
        confidence: 0.94,
        createdAt: new Date().toISOString(),
      },
    ];

    // Create episodes
    graph.episodes = [
      {
        id: "episode_dm_001",
        episodeType: "chronic_condition",
        title: "Diabetes Management Journey",
        description: "Ongoing Type 2 Diabetes management including medication optimization and specialist care",
        startDate: "2019-06-20",
        status: "ongoing",
        nodeIds: ["cond_diabetes_001", "med_metformin_001", "lab_hba1c_001", "spec_endo_001", "sym_fatigue_001", "sym_polyuria_001", "sym_tingling_001", "sym_vision_001"],
        primaryConditionId: "cond_diabetes_001",
        specialists: ["Dr. Lisa Park - Endocrinology"],
        outcomes: ["HbA1c improved from 8.5% to 7.2%", "No diabetic complications to date"],
      },
      {
        id: "episode_htn_001",
        episodeType: "chronic_condition",
        title: "Hypertension Control",
        description: "Blood pressure management with medication optimization and cardiac monitoring",
        startDate: "2020-03-15",
        status: "ongoing",
        nodeIds: ["cond_hypertension_001", "med_lisinopril_001", "med_amlodipine_001", "spec_cardio_001", "img_echo_001", "sym_headache_001", "sym_dizziness_001", "sym_cough_001"],
        primaryConditionId: "cond_hypertension_001",
        specialists: ["Dr. Sarah Chen - Cardiology"],
        outcomes: ["Blood pressure controlled at 128/82", "Mild LVH stable on echo"],
      },
      {
        id: "episode_ckd_001",
        episodeType: "chronic_condition",
        title: "Kidney Function Monitoring",
        description: "CKD Stage 2 monitoring related to diabetes and hypertension",
        startDate: "2022-01-10",
        status: "ongoing",
        nodeIds: ["cond_ckd_001", "lab_creatinine_001", "lab_egfr_001", "spec_nephro_001", "sym_edema_001"],
        primaryConditionId: "cond_ckd_001",
        specialists: ["Dr. Michael Wong - Nephrology"],
        outcomes: ["eGFR stable at 72", "ACE inhibitor renoprotection ongoing"],
      },
    ];

    // Create timelines
    graph.timelines = [
      {
        id: "timeline_overall",
        timelineType: "overall",
        events: [
          { nodeId: "cond_diabetes_001", date: "2019-06-20", eventType: "diagnosis", description: "Type 2 Diabetes diagnosed", significance: "high" },
          { nodeId: "med_metformin_001", date: "2019-06-25", eventType: "medication_start", description: "Started Metformin", significance: "medium" },
          { nodeId: "spec_endo_001", date: "2019-07-01", eventType: "referral", description: "Referred to Endocrinology", significance: "medium" },
          { nodeId: "cond_hypertension_001", date: "2020-03-15", eventType: "diagnosis", description: "Hypertension Stage 2 diagnosed", significance: "high" },
          { nodeId: "med_lisinopril_001", date: "2020-03-20", eventType: "medication_start", description: "Started Lisinopril", significance: "medium" },
          { nodeId: "spec_cardio_001", date: "2020-04-10", eventType: "referral", description: "Referred to Cardiology", significance: "medium" },
          { nodeId: "med_amlodipine_001", date: "2021-02-15", eventType: "medication_start", description: "Added Amlodipine for BP control", significance: "medium" },
          { nodeId: "cond_ckd_001", date: "2022-01-10", eventType: "diagnosis", description: "CKD Stage 2 diagnosed", significance: "high" },
          { nodeId: "spec_nephro_001", date: "2022-01-15", eventType: "referral", description: "Referred to Nephrology", significance: "medium" },
          { nodeId: "img_echo_001", date: "2023-06-15", eventType: "imaging", description: "Echocardiogram showing mild LVH", significance: "medium" },
          { nodeId: "sym_polyuria_001", date: "2019-05-01", eventType: "symptom_reported", description: "Patient reports frequent urination (pre-diagnosis)", significance: "high" },
          { nodeId: "sym_fatigue_001", date: "2019-08-15", eventType: "symptom_reported", description: "Persistent fatigue reported post-diabetes diagnosis", significance: "medium" },
          { nodeId: "sym_headache_001", date: "2020-05-10", eventType: "symptom_reported", description: "Recurring headaches reported, linked to hypertension", significance: "medium" },
          { nodeId: "sym_cough_001", date: "2020-04-15", eventType: "symptom_reported", description: "Dry cough develops after starting Lisinopril", significance: "medium" },
          { nodeId: "sym_dizziness_001", date: "2020-06-05", eventType: "symptom_reported", description: "Dizziness reported, possibly medication-related", significance: "medium" },
          { nodeId: "sym_vision_001", date: "2021-09-20", eventType: "symptom_reported", description: "Intermittent blurred vision correlated with glucose changes", significance: "medium" },
          { nodeId: "sym_edema_001", date: "2022-06-15", eventType: "symptom_reported", description: "Leg swelling noted post-CKD diagnosis", significance: "medium" },
          { nodeId: "sym_tingling_001", date: "2023-03-10", eventType: "symptom_reported", description: "Numbness and tingling in feet, possible neuropathy", significance: "high" },
        ],
      },
    ];
  }

  async getGraph(patientId: string): Promise<HealthGraph | null> {
    let graph = this.graphs.get(patientId);
    if (!graph) {
      graph = await this.initializeGraph(patientId);
    }
    console.log(`[HIPAA-AUDIT] Health graph accessed - Patient: ${patientId}, Action: GET_GRAPH`);
    return graph;
  }

  async queryGraph(patientId: string, query: GraphQuery): Promise<{ nodes: HealthNode[]; edges: HealthEdge[] }> {
    const graph = await this.getGraph(patientId);
    if (!graph) {
      return { nodes: [], edges: [] };
    }

    let filteredNodes = [...graph.nodes];
    let filteredEdges = [...graph.edges];

    // Filter by node types
    if (query.nodeTypes?.length) {
      filteredNodes = filteredNodes.filter(n => query.nodeTypes!.includes(n.nodeType));
    }

    // Filter by date range
    if (query.dateRange) {
      filteredNodes = filteredNodes.filter(n => {
        if (!n.startDate) return false;
        return n.startDate >= query.dateRange!.start && n.startDate <= query.dateRange!.end;
      });
    }

    // Filter edges by relationship types
    if (query.relationshipTypes?.length) {
      filteredEdges = filteredEdges.filter(e => query.relationshipTypes!.includes(e.relationshipType));
    }

    // Filter edges to only include those between filtered nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(e => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId));

    // Center-based subgraph extraction
    if (query.centerNodeId && query.depth) {
      const result = this.extractSubgraph(graph, query.centerNodeId, query.depth);
      return result;
    }

    console.log(`[HIPAA-AUDIT] Health graph queried - Patient: ${patientId}, Nodes: ${filteredNodes.length}, Edges: ${filteredEdges.length}`);
    return { nodes: filteredNodes, edges: filteredEdges };
  }

  private extractSubgraph(graph: HealthGraph, centerNodeId: string, depth: number): { nodes: HealthNode[]; edges: HealthEdge[] } {
    const visitedNodes = new Set<string>([centerNodeId]);
    const relevantEdges: HealthEdge[] = [];
    
    let currentLayer = [centerNodeId];
    
    for (let d = 0; d < depth; d++) {
      const nextLayer: string[] = [];
      
      for (const nodeId of currentLayer) {
        for (const edge of graph.edges) {
          if (edge.sourceNodeId === nodeId && !visitedNodes.has(edge.targetNodeId)) {
            visitedNodes.add(edge.targetNodeId);
            nextLayer.push(edge.targetNodeId);
            relevantEdges.push(edge);
          }
          if (edge.targetNodeId === nodeId && !visitedNodes.has(edge.sourceNodeId)) {
            visitedNodes.add(edge.sourceNodeId);
            nextLayer.push(edge.sourceNodeId);
            relevantEdges.push(edge);
          }
        }
      }
      
      currentLayer = nextLayer;
    }

    const nodes = graph.nodes.filter(n => visitedNodes.has(n.id));
    return { nodes, edges: relevantEdges };
  }

  async generateInsights(patientId: string): Promise<GraphInsight[]> {
    const graph = await this.getGraph(patientId);
    if (!graph) return [];

    const insights: GraphInsight[] = [];

    // Find AI-inferred correlations
    const aiEdges = graph.edges.filter(e => e.aiInferred);
    
    for (const edge of aiEdges) {
      const sourceNode = graph.nodes.find(n => n.id === edge.sourceNodeId);
      const targetNode = graph.nodes.find(n => n.id === edge.targetNodeId);
      
      if (sourceNode && targetNode) {
        insights.push({
          insightId: `insight_${edge.id}`,
          insightType: "correlation",
          title: `${sourceNode.label} may be related to ${targetNode.label}`,
          description: edge.evidence.join(". "),
          relatedNodeIds: [edge.sourceNodeId, edge.targetNodeId],
          confidence: edge.confidence,
          actionable: edge.relationshipType === "worsened_by" || edge.relationshipType === "causes",
          noCdsDisclaimer: this.NO_CDS_DISCLAIMER,
        });
      }
    }

    // Find lab trends that need attention
    const labNodes = graph.nodes.filter(n => n.nodeType === "lab" && n.metadata?.trend);
    
    for (const lab of labNodes) {
      const trend = lab.metadata.trend as Array<{ date: string; value: number }>;
      if (trend && trend.length >= 3) {
        const isRising = trend.every((t, i) => i === 0 || t.value >= trend[i - 1].value);
        const isFalling = trend.every((t, i) => i === 0 || t.value <= trend[i - 1].value);
        
        if (isRising || isFalling) {
          const direction = isRising ? "rising" : "falling";
          const percentChange = ((trend[trend.length - 1].value - trend[0].value) / trend[0].value * 100).toFixed(1);
          
          insights.push({
            insightId: `insight_trend_${lab.id}`,
            insightType: "trend",
            title: `${lab.label} has been ${direction}`,
            description: `Your ${lab.label} has changed by ${percentChange}% since ${trend[0].date}`,
            relatedNodeIds: [lab.id],
            confidence: 0.95,
            actionable: Math.abs(parseFloat(percentChange)) > 20,
            noCdsDisclaimer: this.NO_CDS_DISCLAIMER,
          });
        }
      }
    }

    console.log(`[HIPAA-AUDIT] Insights generated - Patient: ${patientId}, Count: ${insights.length}`);
    return insights;
  }

  async explainRelationship(patientId: string, sourceNodeId: string, targetNodeId: string): Promise<string> {
    const graph = await this.getGraph(patientId);
    if (!graph) return "Unable to access health graph.";

    const sourceNode = graph.nodes.find(n => n.id === sourceNodeId);
    const targetNode = graph.nodes.find(n => n.id === targetNodeId);
    const edge = graph.edges.find(e => 
      (e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId) ||
      (e.sourceNodeId === targetNodeId && e.targetNodeId === sourceNodeId)
    );

    if (!sourceNode || !targetNode) {
      return "Unable to find the requested health records.";
    }

    try {
      const prompt = `Explain the relationship between these two health items in patient-friendly language:

Source: ${sourceNode.label} (${sourceNode.nodeType})
- Started: ${sourceNode.startDate || 'unknown'}
- Status: ${sourceNode.status}
${sourceNode.metadata ? `- Details: ${JSON.stringify(sourceNode.metadata)}` : ''}

Target: ${targetNode.label} (${targetNode.nodeType})
- Started: ${targetNode.startDate || 'unknown'}
- Status: ${targetNode.status}
${targetNode.metadata ? `- Details: ${JSON.stringify(targetNode.metadata)}` : ''}

${edge ? `Known relationship: ${edge.relationshipType} (confidence: ${(edge.confidence * 100).toFixed(0)}%)
Evidence: ${edge.evidence.join(', ')}` : 'No direct relationship recorded.'}

Provide a clear, educational explanation a patient would understand. Focus on:
1. How these items are connected
2. Why this connection matters for their health
3. Any patterns or trends visible

Important: This is for informational purposes only. Do not provide medical advice or recommendations.`;

      const explanation = await generatePhiSafeText({
        system: "You are a health educator explaining medical relationships to patients. Use simple language, avoid jargon, and always remind patients to consult their healthcare provider. Never provide medical advice or treatment recommendations.",
        user: prompt,
        maxTokens: 500,
        temperature: 0.7,
      }) || "Unable to generate explanation.";
      
      console.log(`[HIPAA-AUDIT] Relationship explanation generated - Patient: ${patientId}, Source: ${sourceNodeId}, Target: ${targetNodeId}`);
      
      return explanation + `\n\n${this.NO_CDS_DISCLAIMER}`;
    } catch (error) {
      console.error("[HealthGraph] AI explanation error:", error);
      return `These two items (${sourceNode.label} and ${targetNode.label}) appear in your health record. Please discuss any questions with your healthcare provider.\n\n${this.NO_CDS_DISCLAIMER}`;
    }
  }

  async getEpisodes(patientId: string): Promise<Episode[]> {
    const graph = await this.getGraph(patientId);
    console.log(`[HIPAA-AUDIT] Episodes accessed - Patient: ${patientId}`);
    return graph?.episodes || [];
  }

  async getTimelines(patientId: string): Promise<Timeline[]> {
    const graph = await this.getGraph(patientId);
    console.log(`[HIPAA-AUDIT] Timelines accessed - Patient: ${patientId}`);
    return graph?.timelines || [];
  }

  async buildHealthGraph(patientId: string): Promise<HealthGraph> {
    let graph = this.graphs.get(patientId);
    if (!graph) {
      graph = await this.initializeGraph(patientId);
    }

    const symptomNodes = graph.nodes.filter(n => n.nodeType === "symptom");
    const conditionNodes = graph.nodes.filter(n => n.nodeType === "condition");
    const medicationNodes = graph.nodes.filter(n => n.nodeType === "medication");

    for (const symptom of symptomNodes) {
      const existingSymptomEdges = graph.edges.filter(
        e => e.sourceNodeId === symptom.id || e.targetNodeId === symptom.id
      );

      if (existingSymptomEdges.length === 0) {
        const aiLinks = await this.inferSymptomLinks(symptom, conditionNodes, medicationNodes);
        for (const link of aiLinks) {
          graph.edges.push(link);
        }
      }
    }

    graph.lastUpdated = new Date().toISOString();
    graph.version++;
    this.graphs.set(patientId, graph);

    console.log(`[HIPAA-AUDIT] Health graph built - Patient: ${patientId}, Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);
    return graph;
  }

  private async inferSymptomLinks(
    symptom: HealthNode,
    conditions: HealthNode[],
    medications: HealthNode[]
  ): Promise<HealthEdge[]> {
    const edges: HealthEdge[] = [];

    try {
      const prompt = `Given this patient-reported symptom and list of diagnosed conditions and medications, identify the most likely clinical relationships.

Symptom: ${symptom.label} (ICD-10: ${symptom.code || 'unknown'})
- Onset: ${symptom.startDate || 'unknown'}
- Details: ${JSON.stringify(symptom.metadata)}

Conditions:
${conditions.map(c => `- ${c.label} (${c.code}, diagnosed ${c.startDate})`).join('\n')}

Medications:
${medications.map(m => `- ${m.label} (${m.code}, started ${m.startDate})`).join('\n')}

For each relationship found, return a JSON array with objects containing:
- targetId: the condition/medication id
- type: "indicates" (symptom suggests condition) or "correlated_with" (associated but not diagnostic)
- strength: 0-1 confidence
- evidence: brief clinical rationale

Return ONLY the JSON array, no other text. This is informational only, not medical advice.`;

      const content = await generatePhiSafeText({
        system: "You are a clinical informatics system. Return only valid JSON arrays. Never provide medical advice.",
        user: prompt,
        maxTokens: 500,
        temperature: 0.3,
      }) || "[]";
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const links = JSON.parse(cleanContent);

      for (const link of links) {
        edges.push({
          id: `edge_ai_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          sourceNodeId: symptom.id,
          targetNodeId: link.targetId,
          relationshipType: link.type || "correlated_with",
          strength: link.strength || 0.7,
          temporalOrder: "unknown",
          evidence: [link.evidence || "AI-inferred relationship"],
          aiInferred: true,
          confidence: link.strength || 0.7,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[HealthGraph] AI inference error for symptom ${symptom.id}:`, error);
    }

    return edges;
  }

  async analyzeSymptomConditionLinks(patientId: string): Promise<SymptomAnalysis> {
    const graph = await this.buildHealthGraph(patientId);

    const symptomNodes = graph.nodes.filter(n => n.nodeType === "symptom");
    const conditionNodes = graph.nodes.filter(n => n.nodeType === "condition");
    const medicationNodes = graph.nodes.filter(n => n.nodeType === "medication");

    const links: SymptomConditionLink[] = [];

    for (const symptom of symptomNodes) {
      const symptomEdges = graph.edges.filter(e => e.sourceNodeId === symptom.id);

      for (const edge of symptomEdges) {
        const targetNode = graph.nodes.find(n => n.id === edge.targetNodeId);
        if (!targetNode) continue;

        const isCondition = targetNode.nodeType === "condition";
        const isMedication = targetNode.nodeType === "medication";

        if (isCondition || isMedication) {
          let temporalCorrelation = "unknown";
          if (symptom.startDate && targetNode.startDate) {
            const symptomDate = new Date(symptom.startDate);
            const targetDate = new Date(targetNode.startDate);
            const diffDays = Math.round((symptomDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays < -30) temporalCorrelation = `Symptom appeared ${Math.abs(diffDays)} days before ${targetNode.nodeType}`;
            else if (diffDays > 30) temporalCorrelation = `Symptom appeared ${diffDays} days after ${targetNode.nodeType}`;
            else temporalCorrelation = `Symptom appeared around the same time as ${targetNode.nodeType}`;
          }

          links.push({
            symptomNodeId: symptom.id,
            symptomLabel: symptom.label,
            conditionNodeId: targetNode.id,
            conditionLabel: targetNode.label,
            relationshipType: edge.relationshipType,
            confidence: edge.confidence,
            strength: edge.strength,
            evidence: edge.evidence,
            aiInferred: edge.aiInferred,
            clinicalRationale: edge.evidence.join(". "),
            temporalCorrelation,
          });
        }
      }
    }

    const clusters = this.identifySymptomClusters(symptomNodes, conditionNodes, links);

    const insights = this.generateSymptomInsights(symptomNodes, conditionNodes, links, clusters);

    console.log(`[HIPAA-AUDIT] Symptom analysis - Patient: ${patientId}, Symptoms: ${symptomNodes.length}, Links: ${links.length}, Clusters: ${clusters.length}`);

    return {
      patientId,
      totalSymptoms: symptomNodes.length,
      totalLinks: links.length,
      symptomNodes,
      conditionNodes,
      links,
      clusters,
      insights,
      noCdsDisclaimer: this.NO_CDS_DISCLAIMER,
      analyzedAt: new Date().toISOString(),
    };
  }

  private identifySymptomClusters(
    symptoms: HealthNode[],
    conditions: HealthNode[],
    links: SymptomConditionLink[]
  ): SymptomCluster[] {
    const clusters: SymptomCluster[] = [];

    for (const condition of conditions) {
      const conditionLinks = links.filter(l => l.conditionNodeId === condition.id);
      if (conditionLinks.length < 2) continue;

      const symptomIds = conditionLinks.map(l => l.symptomNodeId);
      const avgConfidence = conditionLinks.reduce((sum, l) => sum + l.confidence, 0) / conditionLinks.length;

      const symptomLabels = conditionLinks.map(l => l.symptomLabel);
      let clinicalPattern = "";
      if (condition.label.includes("Diabetes")) {
        clinicalPattern = "Classic diabetic symptom constellation: metabolic and neuropathic features";
      } else if (condition.label.includes("Hypertension")) {
        clinicalPattern = "Hypertensive symptom pattern: vascular and end-organ indicators";
      } else if (condition.label.includes("Kidney")) {
        clinicalPattern = "Renal insufficiency pattern: fluid retention and metabolic symptoms";
      } else {
        clinicalPattern = `${symptomLabels.length} symptoms clustered around ${condition.label}`;
      }

      clusters.push({
        id: `cluster_${condition.id}`,
        name: `${condition.label} Symptom Pattern`,
        description: `${symptomLabels.join(", ")} are collectively associated with ${condition.label}`,
        symptomIds,
        primaryConditionId: condition.id,
        conditionLabel: condition.label,
        clusterConfidence: avgConfidence,
        clinicalPattern,
      });
    }

    return clusters;
  }

  private generateSymptomInsights(
    symptoms: HealthNode[],
    conditions: HealthNode[],
    links: SymptomConditionLink[],
    clusters: SymptomCluster[]
  ): GraphInsight[] {
    const insights: GraphInsight[] = [];

    const multiConditionSymptoms = symptoms.filter(s => {
      const symptomLinks = links.filter(l => l.symptomNodeId === s.id);
      const conditionTargets = symptomLinks.filter(l => {
        const node = conditions.find(c => c.id === l.conditionNodeId);
        return node?.nodeType === "condition";
      });
      return conditionTargets.length > 1;
    });

    for (const symptom of multiConditionSymptoms) {
      const relatedConditions = links
        .filter(l => l.symptomNodeId === symptom.id && conditions.some(c => c.id === l.conditionNodeId))
        .map(l => l.conditionLabel);

      insights.push({
        insightId: `insight_multi_${symptom.id}`,
        insightType: "correlation",
        title: `${symptom.label} may relate to multiple conditions`,
        description: `Your reported ${symptom.label.toLowerCase()} may be connected to ${relatedConditions.join(" and ")}. Discuss this pattern with your care team.`,
        relatedNodeIds: [symptom.id, ...links.filter(l => l.symptomNodeId === symptom.id).map(l => l.conditionNodeId)],
        confidence: 0.80,
        actionable: true,
        noCdsDisclaimer: this.NO_CDS_DISCLAIMER,
      });
    }

    for (const cluster of clusters) {
      if (cluster.symptomIds.length >= 3) {
        insights.push({
          insightId: `insight_cluster_${cluster.id}`,
          insightType: "correlation",
          title: `Symptom pattern identified for ${cluster.conditionLabel}`,
          description: `${cluster.symptomIds.length} of your reported symptoms form a pattern commonly associated with ${cluster.conditionLabel}. ${cluster.clinicalPattern}.`,
          relatedNodeIds: [...cluster.symptomIds, cluster.primaryConditionId],
          confidence: cluster.clusterConfidence,
          actionable: true,
          noCdsDisclaimer: this.NO_CDS_DISCLAIMER,
        });
      }
    }

    const medSideEffects = links.filter(l => {
      const node = [...conditions].find(c => c.id === l.conditionNodeId);
      return !node;
    }).filter(l => {
      return l.conditionNodeId.startsWith("med_");
    });

    for (const sideEffect of medSideEffects) {
      insights.push({
        insightId: `insight_sideeffect_${sideEffect.symptomNodeId}_${sideEffect.conditionNodeId}`,
        insightType: "interaction",
        title: `${sideEffect.symptomLabel} may be related to ${sideEffect.conditionLabel}`,
        description: `Your ${sideEffect.symptomLabel.toLowerCase()} may be associated with your medication ${sideEffect.conditionLabel}. Mention this to your prescribing provider.`,
        relatedNodeIds: [sideEffect.symptomNodeId, sideEffect.conditionNodeId],
        confidence: sideEffect.confidence,
        actionable: true,
        noCdsDisclaimer: this.NO_CDS_DISCLAIMER,
      });
    }

    const preExistingSymptoms = symptoms.filter(s => {
      return links.some(l => {
        if (l.symptomNodeId !== s.id) return false;
        const condition = conditions.find(c => c.id === l.conditionNodeId);
        if (!condition || !s.startDate || !condition.startDate) return false;
        return new Date(s.startDate) < new Date(condition.startDate);
      });
    });

    for (const symptom of preExistingSymptoms) {
      const preCondLinks = links.filter(l => {
        if (l.symptomNodeId !== symptom.id) return false;
        const condition = conditions.find(c => c.id === l.conditionNodeId);
        return condition && symptom.startDate && condition.startDate && new Date(symptom.startDate) < new Date(condition.startDate);
      });

      for (const link of preCondLinks) {
        insights.push({
          insightId: `insight_precursor_${symptom.id}_${link.conditionNodeId}`,
          insightType: "trend",
          title: `${symptom.label} preceded ${link.conditionLabel} diagnosis`,
          description: `You reported ${symptom.label.toLowerCase()} before being diagnosed with ${link.conditionLabel}. ${link.temporalCorrelation}.`,
          relatedNodeIds: [symptom.id, link.conditionNodeId],
          confidence: link.confidence,
          actionable: false,
          noCdsDisclaimer: this.NO_CDS_DISCLAIMER,
        });
      }
    }

    return insights;
  }

  async addNode(patientId: string, node: Omit<HealthNode, "id">): Promise<HealthNode> {
    const graph = await this.getGraph(patientId);
    if (!graph) throw new Error("Graph not found");

    const newNode: HealthNode = {
      ...node,
      id: `${node.nodeType}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    };

    graph.nodes.push(newNode);
    graph.lastUpdated = new Date().toISOString();
    graph.version++;

    console.log(`[HIPAA-AUDIT] Node added - Patient: ${patientId}, Node: ${newNode.id}, Type: ${newNode.nodeType}`);
    return newNode;
  }

  async addEdge(patientId: string, edge: Omit<HealthEdge, "id" | "createdAt">): Promise<HealthEdge> {
    const graph = await this.getGraph(patientId);
    if (!graph) throw new Error("Graph not found");

    const newEdge: HealthEdge = {
      ...edge,
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    graph.edges.push(newEdge);
    graph.lastUpdated = new Date().toISOString();
    graph.version++;

    console.log(`[HIPAA-AUDIT] Edge added - Patient: ${patientId}, Edge: ${newEdge.id}, Type: ${newEdge.relationshipType}`);
    return newEdge;
  }

  getGraphStatistics(patientId: string): {
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<string, number>;
    episodeCount: number;
    conditionCount: number;
    medicationCount: number;
    symptomCount: number;
    symptomLinkCount: number;
  } | null {
    const graph = this.graphs.get(patientId);
    if (!graph) return null;

    const nodesByType: Record<string, number> = {};
    graph.nodes.forEach(n => {
      nodesByType[n.nodeType] = (nodesByType[n.nodeType] || 0) + 1;
    });

    const symptomIds = new Set(graph.nodes.filter(n => n.nodeType === "symptom").map(n => n.id));
    const symptomLinkCount = graph.edges.filter(e => symptomIds.has(e.sourceNodeId) || symptomIds.has(e.targetNodeId)).length;

    return {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodesByType,
      episodeCount: graph.episodes.length,
      conditionCount: nodesByType["condition"] || 0,
      medicationCount: nodesByType["medication"] || 0,
      symptomCount: nodesByType["symptom"] || 0,
      symptomLinkCount,
    };
  }
}

export const healthGraphService = new HealthGraphService();
