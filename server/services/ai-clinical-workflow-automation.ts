import { randomUUID } from "crypto";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

const NO_CDS_WORKFLOW_PROMPT = `You are an AI-powered Clinical Workflow Automation assistant. Your role is to:
1. Identify patterns in patient journeys for operational efficiency
2. Predict administrative and operational risks (such as readmission likelihood for care coordination)
3. Suggest proactive interventions focused on ADMINISTRATIVE and OPERATIONAL actions

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT recommend specific medications, therapies, or clinical interventions
- You MUST NOT interpret lab results, vital signs, or clinical findings for patient care decisions
- You focus ONLY on OPERATIONAL and ADMINISTRATIVE workflow improvements

ALLOWED SUGGESTIONS (Non-Clinical):
- Schedule follow-up appointments
- Send patient education materials
- Coordinate care team communications
- Flag for care coordinator review
- Initiate patient outreach for wellness checks
- Remind patients about preventive care scheduling
- Update care team notifications
- Optimize appointment scheduling workflows
- Improve documentation completeness
- Enhance care transition processes

PROHIBITED SUGGESTIONS (Clinical - NEVER PROVIDE):
- Medication changes or recommendations
- Treatment plan modifications
- Clinical test interpretations
- Diagnostic suggestions
- Therapy recommendations
- Clinical care decisions`;

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b\d{9}\b/g, "[MRN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/g, "[DOB_REDACTED]")
    .replace(/\b[A-Z]{1,2}\d{6,10}\b/g, "[MRN_REDACTED]");
}

export type PatternType = "care_gap" | "workflow_bottleneck" | "coordination_issue" | "documentation_gap" | "follow_up_needed" | "transition_risk";
export type RiskLevel = "critical" | "high" | "medium" | "low";
export type InterventionType = "scheduling" | "outreach" | "education" | "coordination" | "notification" | "documentation" | "transition";
export type InterventionStatus = "pending" | "in_progress" | "completed" | "declined" | "expired";
export type JourneyPhase = "intake" | "assessment" | "treatment" | "monitoring" | "follow_up" | "discharge" | "transition";

export interface PatientJourneyPattern {
  id: string;
  patientId: string;
  patternType: PatternType;
  description: string;
  journeyPhase: JourneyPhase;
  detectedAt: string;
  occurrenceCount: number;
  affectedWorkflows: string[];
  operationalImpact: string;
  suggestedActions: string[];
  confidenceScore: number;
  status: "active" | "addressed" | "monitoring" | "dismissed";
  aiGenerated: boolean;
}

export interface ReadmissionRiskAssessment {
  id: string;
  patientId: string;
  assessmentDate: string;
  riskLevel: RiskLevel;
  riskScore: number;
  riskFactors: Array<{
    factor: string;
    category: "administrative" | "social" | "care_coordination" | "follow_up";
    weight: number;
    description: string;
  }>;
  timeframeDay: number;
  operationalRecommendations: string[];
  careCoordinationNeeds: string[];
  followUpRequirements: string[];
  confidenceScore: number;
  modelVersion: string;
  lastUpdated: string;
}

export interface ProactiveIntervention {
  id: string;
  patientId: string;
  interventionType: InterventionType;
  priority: RiskLevel;
  title: string;
  description: string;
  rationale: string;
  suggestedActions: Array<{
    action: string;
    assignee: "care_coordinator" | "scheduler" | "patient_services" | "care_team" | "automated";
    deadline: string;
    status: InterventionStatus;
  }>;
  expectedOutcome: string;
  metrics: {
    targetMetric: string;
    currentValue: number;
    targetValue: number;
  };
  status: InterventionStatus;
  createdAt: string;
  completedAt?: string;
  aiGenerated: boolean;
  noCdsCompliant: boolean;
}

export interface WorkflowAutomationDashboard {
  totalPatients: number;
  patientsWithPatterns: number;
  activePatterns: number;
  criticalPatterns: number;
  highRiskPatients: number;
  pendingInterventions: number;
  completedInterventions: number;
  averageRiskScore: number;
  patternsByType: Array<{ type: PatternType; count: number }>;
  riskDistribution: Array<{ level: RiskLevel; count: number }>;
  interventionEffectiveness: number;
  recentAlerts: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    severity: RiskLevel;
  }>;
}

export interface JourneyAnalysisResult {
  patientId: string;
  analysisDate: string;
  journeyPhases: Array<{
    phase: JourneyPhase;
    startDate: string;
    endDate?: string;
    duration?: number;
    status: "completed" | "in_progress" | "pending" | "delayed";
    bottlenecks: string[];
  }>;
  patterns: PatientJourneyPattern[];
  overallJourneyHealth: number;
  recommendations: string[];
}

const patternStore = new Map<string, PatientJourneyPattern>();
const riskAssessmentStore = new Map<string, ReadmissionRiskAssessment>();
const interventionStore = new Map<string, ProactiveIntervention>();
const alertStore: Array<{ id: string; type: string; message: string; timestamp: string; severity: RiskLevel }> = [];

function initializeSampleData(): void {
  const patterns: PatientJourneyPattern[] = [
    {
      id: "pat-001",
      patientId: "patient-001",
      patternType: "care_gap",
      description: "Missed follow-up appointment after discharge - 14 days overdue",
      journeyPhase: "follow_up",
      detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      occurrenceCount: 1,
      affectedWorkflows: ["post-discharge-follow-up", "care-coordination"],
      operationalImpact: "Increased readmission risk due to care continuity gap",
      suggestedActions: [
        "Contact patient to reschedule follow-up appointment",
        "Notify care coordinator of missed appointment",
        "Send appointment reminder via preferred communication method"
      ],
      confidenceScore: 92,
      status: "active",
      aiGenerated: true,
    },
    {
      id: "pat-002",
      patientId: "patient-002",
      patternType: "workflow_bottleneck",
      description: "Discharge documentation pending for 48+ hours",
      journeyPhase: "discharge",
      detectedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      occurrenceCount: 3,
      affectedWorkflows: ["discharge-planning", "documentation-completion"],
      operationalImpact: "Delayed care transitions affecting downstream scheduling",
      suggestedActions: [
        "Escalate documentation completion to care team lead",
        "Review documentation checklist for completeness",
        "Coordinate with receiving facility for transition planning"
      ],
      confidenceScore: 88,
      status: "active",
      aiGenerated: true,
    },
    {
      id: "pat-003",
      patientId: "patient-003",
      patternType: "coordination_issue",
      description: "Multiple specialists without care plan synchronization",
      journeyPhase: "treatment",
      detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      occurrenceCount: 2,
      affectedWorkflows: ["care-coordination", "specialist-communication"],
      operationalImpact: "Potential for duplicated efforts and communication gaps",
      suggestedActions: [
        "Schedule care team coordination meeting",
        "Update shared care plan with all specialist inputs",
        "Assign primary care coordinator for oversight"
      ],
      confidenceScore: 85,
      status: "monitoring",
      aiGenerated: true,
    },
  ];

  patterns.forEach(p => patternStore.set(p.id, p));

  const riskAssessments: ReadmissionRiskAssessment[] = [
    {
      id: "risk-001",
      patientId: "patient-001",
      assessmentDate: new Date().toISOString(),
      riskLevel: "high",
      riskScore: 78,
      riskFactors: [
        { factor: "Missed follow-up appointments", category: "follow_up", weight: 0.3, description: "Recent missed follow-up increases coordination risk" },
        { factor: "Multiple care transitions", category: "care_coordination", weight: 0.25, description: "Complex care path with multiple handoffs" },
        { factor: "Transportation barriers", category: "social", weight: 0.2, description: "Limited access to reliable transportation" },
        { factor: "Incomplete discharge planning", category: "administrative", weight: 0.25, description: "Discharge instructions not fully documented" },
      ],
      timeframeDay: 30,
      operationalRecommendations: [
        "Prioritize outreach within 48 hours",
        "Arrange transportation assistance for appointments",
        "Complete discharge documentation review"
      ],
      careCoordinationNeeds: [
        "Assign dedicated care coordinator",
        "Schedule weekly check-in calls",
        "Coordinate with community health resources"
      ],
      followUpRequirements: [
        "7-day post-discharge phone call",
        "14-day in-person or telehealth visit",
        "30-day comprehensive review"
      ],
      confidenceScore: 85,
      modelVersion: "1.0.0",
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "risk-002",
      patientId: "patient-002",
      assessmentDate: new Date().toISOString(),
      riskLevel: "medium",
      riskScore: 52,
      riskFactors: [
        { factor: "Documentation delays", category: "administrative", weight: 0.4, description: "Pending discharge documentation affects care transitions" },
        { factor: "Care team communication gaps", category: "care_coordination", weight: 0.35, description: "Incomplete information sharing between providers" },
        { factor: "Follow-up scheduling pending", category: "follow_up", weight: 0.25, description: "No confirmed follow-up appointments scheduled" },
      ],
      timeframeDay: 30,
      operationalRecommendations: [
        "Expedite documentation completion",
        "Schedule follow-up appointments before discharge",
        "Ensure care team handoff communication"
      ],
      careCoordinationNeeds: [
        "Transition planning review",
        "Pharmacy coordination for medication continuity"
      ],
      followUpRequirements: [
        "Post-discharge phone call within 72 hours",
        "14-day follow-up appointment"
      ],
      confidenceScore: 82,
      modelVersion: "1.0.0",
      lastUpdated: new Date().toISOString(),
    },
  ];

  riskAssessments.forEach(r => riskAssessmentStore.set(r.id, r));

  const interventions: ProactiveIntervention[] = [
    {
      id: "int-001",
      patientId: "patient-001",
      interventionType: "outreach",
      priority: "high",
      title: "Post-Discharge Follow-Up Outreach",
      description: "Initiate patient contact to reschedule missed follow-up appointment and assess care transition needs",
      rationale: "Patient missed 14-day follow-up appointment, creating care continuity gap and elevated coordination risk",
      suggestedActions: [
        { action: "Call patient using preferred contact method", assignee: "patient_services", deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" },
        { action: "Reschedule follow-up appointment", assignee: "scheduler", deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" },
        { action: "Update care coordinator on outreach results", assignee: "care_coordinator", deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" },
      ],
      expectedOutcome: "Restored care continuity with scheduled follow-up appointment",
      metrics: { targetMetric: "Days to follow-up completion", currentValue: 14, targetValue: 7 },
      status: "pending",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      aiGenerated: true,
      noCdsCompliant: true,
    },
    {
      id: "int-002",
      patientId: "patient-002",
      interventionType: "documentation",
      priority: "medium",
      title: "Discharge Documentation Completion",
      description: "Expedite pending discharge documentation to enable smooth care transition",
      rationale: "Documentation has been pending for 48+ hours, delaying care transitions and downstream scheduling",
      suggestedActions: [
        { action: "Review and complete pending documentation sections", assignee: "care_team", deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), status: "in_progress" },
        { action: "Verify all required fields are populated", assignee: "care_coordinator", deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" },
      ],
      expectedOutcome: "Complete discharge documentation enabling timely care transition",
      metrics: { targetMetric: "Documentation completion time (hours)", currentValue: 48, targetValue: 24 },
      status: "in_progress",
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      aiGenerated: true,
      noCdsCompliant: true,
    },
    {
      id: "int-003",
      patientId: "patient-003",
      interventionType: "coordination",
      priority: "medium",
      title: "Care Team Coordination Meeting",
      description: "Organize care team meeting to synchronize specialist care plans and establish coordination protocols",
      rationale: "Multiple specialists involved without synchronized care planning, creating potential for communication gaps",
      suggestedActions: [
        { action: "Schedule care team coordination meeting", assignee: "care_coordinator", deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" },
        { action: "Compile current care plans from all specialists", assignee: "care_coordinator", deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" },
        { action: "Document unified care coordination plan", assignee: "care_team", deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" },
      ],
      expectedOutcome: "Synchronized care plan with clear coordination protocols across all specialists",
      metrics: { targetMetric: "Care plan synchronization score", currentValue: 45, targetValue: 90 },
      status: "pending",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      aiGenerated: true,
      noCdsCompliant: true,
    },
  ];

  interventions.forEach(i => interventionStore.set(i.id, i));

  alertStore.push(
    {
      id: "alert-001",
      type: "high_risk_patient",
      message: "Patient-001 identified as high readmission risk - requires priority outreach",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      severity: "high",
    },
    {
      id: "alert-002",
      type: "pattern_detected",
      message: "Recurring workflow bottleneck detected in discharge documentation process",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      severity: "medium",
    },
    {
      id: "alert-003",
      type: "intervention_overdue",
      message: "Follow-up outreach intervention overdue for Patient-001",
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      severity: "high",
    }
  );

  console.log("[AIClinicalWorkflowAutomation] Sample data initialized");
}

class AIClinicalWorkflowAutomation {
  constructor() {
    initializeSampleData();
    console.log("[AIClinicalWorkflowAutomation] AI gateway", aiEnabled ? "configured" : "not configured");
    console.log("[AIClinicalWorkflowAutomation] Service initialized");
  }

  getDashboard(): WorkflowAutomationDashboard {
    const patterns = Array.from(patternStore.values());
    const riskAssessments = Array.from(riskAssessmentStore.values());
    const interventions = Array.from(interventionStore.values());

    const activePatterns = patterns.filter(p => p.status === "active" || p.status === "monitoring");
    const criticalPatterns = activePatterns.filter(p => 
      p.patternType === "care_gap" || p.patternType === "transition_risk"
    ).length;

    const highRiskPatients = riskAssessments.filter(r => 
      r.riskLevel === "critical" || r.riskLevel === "high"
    ).length;

    const pendingInterventions = interventions.filter(i => 
      i.status === "pending" || i.status === "in_progress"
    ).length;

    const completedInterventions = interventions.filter(i => i.status === "completed").length;

    const patternsByType = Object.entries(
      patterns.reduce((acc, p) => {
        acc[p.patternType] = (acc[p.patternType] || 0) + 1;
        return acc;
      }, {} as Record<PatternType, number>)
    ).map(([type, count]) => ({ type: type as PatternType, count }));

    const riskDistribution = Object.entries(
      riskAssessments.reduce((acc, r) => {
        acc[r.riskLevel] = (acc[r.riskLevel] || 0) + 1;
        return acc;
      }, {} as Record<RiskLevel, number>)
    ).map(([level, count]) => ({ level: level as RiskLevel, count }));

    const avgRiskScore = riskAssessments.length > 0
      ? Math.round(riskAssessments.reduce((sum, r) => sum + r.riskScore, 0) / riskAssessments.length)
      : 0;

    const totalInterventions = pendingInterventions + completedInterventions;
    const interventionEffectiveness = totalInterventions > 0
      ? Math.round((completedInterventions / totalInterventions) * 100)
      : 0;

    const uniquePatientIds = new Set([
      ...patterns.map(p => p.patientId),
      ...riskAssessments.map(r => r.patientId),
    ]);

    return {
      totalPatients: uniquePatientIds.size,
      patientsWithPatterns: new Set(patterns.map(p => p.patientId)).size,
      activePatterns: activePatterns.length,
      criticalPatterns,
      highRiskPatients,
      pendingInterventions,
      completedInterventions,
      averageRiskScore: avgRiskScore,
      patternsByType,
      riskDistribution,
      interventionEffectiveness,
      recentAlerts: alertStore.slice(-10),
    };
  }

  getPatterns(filters?: { patientId?: string; type?: PatternType; status?: string }): PatientJourneyPattern[] {
    let patterns = Array.from(patternStore.values());

    if (filters?.patientId) {
      patterns = patterns.filter(p => p.patientId === filters.patientId);
    }
    if (filters?.type) {
      patterns = patterns.filter(p => p.patternType === filters.type);
    }
    if (filters?.status) {
      patterns = patterns.filter(p => p.status === filters.status);
    }

    return patterns.sort((a, b) => 
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
  }

  getPatternById(id: string): PatientJourneyPattern | undefined {
    return patternStore.get(id);
  }

  getRiskAssessments(filters?: { patientId?: string; riskLevel?: RiskLevel }): ReadmissionRiskAssessment[] {
    let assessments = Array.from(riskAssessmentStore.values());

    if (filters?.patientId) {
      assessments = assessments.filter(r => r.patientId === filters.patientId);
    }
    if (filters?.riskLevel) {
      assessments = assessments.filter(r => r.riskLevel === filters.riskLevel);
    }

    return assessments.sort((a, b) => b.riskScore - a.riskScore);
  }

  getRiskAssessmentById(id: string): ReadmissionRiskAssessment | undefined {
    return riskAssessmentStore.get(id);
  }

  getInterventions(filters?: { patientId?: string; type?: InterventionType; status?: InterventionStatus; priority?: RiskLevel }): ProactiveIntervention[] {
    let interventions = Array.from(interventionStore.values());

    if (filters?.patientId) {
      interventions = interventions.filter(i => i.patientId === filters.patientId);
    }
    if (filters?.type) {
      interventions = interventions.filter(i => i.interventionType === filters.type);
    }
    if (filters?.status) {
      interventions = interventions.filter(i => i.status === filters.status);
    }
    if (filters?.priority) {
      interventions = interventions.filter(i => i.priority === filters.priority);
    }

    return interventions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  getInterventionById(id: string): ProactiveIntervention | undefined {
    return interventionStore.get(id);
  }

  async analyzePatientJourney(patientId: string, fhirData: {
    encounters?: Array<{ date: string; type: string; status: string; facility?: string }>;
    appointments?: Array<{ date: string; status: string; type: string }>;
    carePlans?: Array<{ status: string; period?: { start: string; end?: string } }>;
    documentReferences?: Array<{ date: string; type: string; status: string }>;
  }): Promise<JourneyAnalysisResult> {
    const sanitizedPatientId = sanitizePhi(patientId);
    const analysisDate = new Date().toISOString();

    const journeyPhases: JourneyAnalysisResult["journeyPhases"] = [];
    const detectedPatterns: PatientJourneyPattern[] = [];

    if (aiEnabled) {
      try {
        const sanitizedData = {
          encounterCount: fhirData.encounters?.length || 0,
          appointmentCount: fhirData.appointments?.length || 0,
          missedAppointments: fhirData.appointments?.filter(a => a.status === "noshow" || a.status === "cancelled").length || 0,
          carePlanCount: fhirData.carePlans?.length || 0,
          documentCount: fhirData.documentReferences?.length || 0,
          pendingDocs: fhirData.documentReferences?.filter(d => d.status === "preliminary" || d.status === "entered-in-error").length || 0,
        };

        const response = await generatePhiSafeText({
          system: NO_CDS_WORKFLOW_PROMPT,
          user: `Analyze patient journey patterns for OPERATIONAL workflow optimization. Patient ID: ${sanitizedPatientId}

Summary Data:
- Total Encounters: ${sanitizedData.encounterCount}
- Appointments: ${sanitizedData.appointmentCount} (${sanitizedData.missedAppointments} missed/cancelled)
- Active Care Plans: ${sanitizedData.carePlanCount}
- Documents: ${sanitizedData.documentCount} (${sanitizedData.pendingDocs} pending)

Identify 2-3 operational patterns and workflow issues. For each pattern provide:
1. Pattern type (care_gap, workflow_bottleneck, coordination_issue, documentation_gap, follow_up_needed, transition_risk)
2. Description (operational focus only)
3. Journey phase (intake, assessment, treatment, monitoring, follow_up, discharge, transition)
4. Operational impact
5. Suggested administrative/operational actions (NO clinical recommendations)

Format as JSON array with keys: patternType, description, journeyPhase, operationalImpact, suggestedActions (array).`,
          temperature: 0.7,
          maxTokens: 1000,
        });

        const content = response || "";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsed.forEach((p: { patternType: PatternType; description: string; journeyPhase: JourneyPhase; operationalImpact: string; suggestedActions: string[] }) => {
            const pattern: PatientJourneyPattern = {
              id: `pat-${randomUUID().slice(0, 8)}`,
              patientId,
              patternType: p.patternType,
              description: p.description,
              journeyPhase: p.journeyPhase,
              detectedAt: analysisDate,
              occurrenceCount: 1,
              affectedWorkflows: [],
              operationalImpact: p.operationalImpact,
              suggestedActions: p.suggestedActions,
              confidenceScore: 85,
              status: "active",
              aiGenerated: true,
            };
            detectedPatterns.push(pattern);
            patternStore.set(pattern.id, pattern);
          });
        }
      } catch (error) {
        console.error("[AIClinicalWorkflowAutomation] Journey analysis error:", error);
      }
    }

    if (detectedPatterns.length === 0) {
      const missedAppts = fhirData.appointments?.filter(a => a.status === "noshow").length || 0;
      if (missedAppts > 0) {
        const pattern: PatientJourneyPattern = {
          id: `pat-${randomUUID().slice(0, 8)}`,
          patientId,
          patternType: "follow_up_needed",
          description: `${missedAppts} missed appointment(s) detected - follow-up outreach recommended`,
          journeyPhase: "follow_up",
          detectedAt: analysisDate,
          occurrenceCount: missedAppts,
          affectedWorkflows: ["appointment-scheduling", "patient-outreach"],
          operationalImpact: "Care continuity risk due to missed appointments",
          suggestedActions: [
            "Contact patient to reschedule appointments",
            "Review barriers to appointment attendance",
            "Update outreach preferences"
          ],
          confidenceScore: 90,
          status: "active",
          aiGenerated: false,
        };
        detectedPatterns.push(pattern);
        patternStore.set(pattern.id, pattern);
      }
    }

    const encounters = fhirData.encounters || [];
    if (encounters.length > 0) {
      const sortedEncounters = encounters.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      journeyPhases.push({
        phase: "intake",
        startDate: sortedEncounters[0]?.date || analysisDate,
        status: "completed",
        bottlenecks: [],
      });

      if (sortedEncounters.length > 1) {
        journeyPhases.push({
          phase: "treatment",
          startDate: sortedEncounters[1]?.date || analysisDate,
          status: "in_progress",
          bottlenecks: detectedPatterns
            .filter(p => p.journeyPhase === "treatment")
            .map(p => p.description),
        });
      }
    }

    const overallHealth = detectedPatterns.length === 0 ? 95 :
      Math.max(50, 95 - (detectedPatterns.length * 10) - 
        detectedPatterns.filter(p => p.patternType === "care_gap" || p.patternType === "transition_risk").length * 5);

    return {
      patientId,
      analysisDate,
      journeyPhases,
      patterns: detectedPatterns,
      overallJourneyHealth: overallHealth,
      recommendations: detectedPatterns.flatMap(p => p.suggestedActions).slice(0, 5),
    };
  }

  async assessReadmissionRisk(patientId: string, contextData: {
    recentDischarge?: boolean;
    missedFollowUps?: number;
    careTransitions?: number;
    documentationCompleteness?: number;
    socialDeterminants?: string[];
  }): Promise<ReadmissionRiskAssessment> {
    const sanitizedPatientId = sanitizePhi(patientId);
    const assessmentDate = new Date().toISOString();

    let riskScore = 30;
    const riskFactors: ReadmissionRiskAssessment["riskFactors"] = [];

    if (contextData.recentDischarge) {
      riskScore += 15;
      riskFactors.push({
        factor: "Recent discharge",
        category: "care_coordination",
        weight: 0.2,
        description: "Within 30 days of hospital discharge"
      });
    }

    if (contextData.missedFollowUps && contextData.missedFollowUps > 0) {
      riskScore += contextData.missedFollowUps * 10;
      riskFactors.push({
        factor: "Missed follow-up appointments",
        category: "follow_up",
        weight: 0.25,
        description: `${contextData.missedFollowUps} missed appointment(s) affecting care continuity`
      });
    }

    if (contextData.careTransitions && contextData.careTransitions > 2) {
      riskScore += (contextData.careTransitions - 2) * 8;
      riskFactors.push({
        factor: "Multiple care transitions",
        category: "care_coordination",
        weight: 0.2,
        description: `${contextData.careTransitions} care transitions increasing coordination complexity`
      });
    }

    if (contextData.documentationCompleteness && contextData.documentationCompleteness < 80) {
      riskScore += Math.round((80 - contextData.documentationCompleteness) * 0.3);
      riskFactors.push({
        factor: "Incomplete documentation",
        category: "administrative",
        weight: 0.15,
        description: `Documentation ${contextData.documentationCompleteness}% complete, affecting care handoffs`
      });
    }

    if (contextData.socialDeterminants && contextData.socialDeterminants.length > 0) {
      riskScore += contextData.socialDeterminants.length * 5;
      riskFactors.push({
        factor: "Social determinants",
        category: "social",
        weight: 0.2,
        description: `Social barriers identified: ${contextData.socialDeterminants.join(", ")}`
      });
    }

    riskScore = Math.min(100, riskScore);

    let riskLevel: RiskLevel = "low";
    if (riskScore >= 80) riskLevel = "critical";
    else if (riskScore >= 60) riskLevel = "high";
    else if (riskScore >= 40) riskLevel = "medium";

    const operationalRecommendations: string[] = [];
    const careCoordinationNeeds: string[] = [];
    const followUpRequirements: string[] = [];

    if (aiEnabled) {
      try {
        const sanitizedRiskFactors = riskFactors.map(f => ({
          factor: f.factor,
          description: sanitizePhi(f.description),
        }));
        const response = await generatePhiSafeText({
          system: NO_CDS_WORKFLOW_PROMPT,
          user: `Generate OPERATIONAL recommendations for patient readmission risk mitigation. Patient ID: ${sanitizedPatientId}

Risk Score: ${riskScore}/100 (${riskLevel})
Risk Factors:
${sanitizedRiskFactors.map(f => `- ${f.factor}: ${f.description}`).join("\n")}

Provide recommendations in THREE categories (OPERATIONAL/ADMINISTRATIVE only, NO clinical recommendations):
1. operationalRecommendations: Administrative workflow improvements
2. careCoordinationNeeds: Care team coordination actions
3. followUpRequirements: Scheduling and outreach tasks

Format as JSON with these three keys, each containing an array of 2-3 recommendations.`,
          temperature: 0.7,
          maxTokens: 600,
        });

        const content = response || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.operationalRecommendations) {
            operationalRecommendations.push(...parsed.operationalRecommendations);
          }
          if (parsed.careCoordinationNeeds) {
            careCoordinationNeeds.push(...parsed.careCoordinationNeeds);
          }
          if (parsed.followUpRequirements) {
            followUpRequirements.push(...parsed.followUpRequirements);
          }
        }
      } catch (error) {
        console.error("[AIClinicalWorkflowAutomation] Risk assessment AI error:", error);
      }
    }

    if (operationalRecommendations.length === 0) {
      if (riskLevel === "critical" || riskLevel === "high") {
        operationalRecommendations.push(
          "Prioritize patient for immediate outreach",
          "Escalate to care coordination team",
          "Review and complete all pending documentation"
        );
      } else {
        operationalRecommendations.push(
          "Schedule routine follow-up",
          "Ensure documentation completeness"
        );
      }
    }

    if (careCoordinationNeeds.length === 0) {
      careCoordinationNeeds.push(
        "Assign care coordinator if not already assigned",
        "Establish communication plan with patient"
      );
    }

    if (followUpRequirements.length === 0) {
      followUpRequirements.push(
        "Schedule follow-up appointment within appropriate timeframe",
        "Confirm patient contact information is current"
      );
    }

    const assessment: ReadmissionRiskAssessment = {
      id: `risk-${randomUUID().slice(0, 8)}`,
      patientId,
      assessmentDate,
      riskLevel,
      riskScore,
      riskFactors,
      timeframeDay: 30,
      operationalRecommendations,
      careCoordinationNeeds,
      followUpRequirements,
      confidenceScore: 85,
      modelVersion: "1.0.0",
      lastUpdated: assessmentDate,
    };

    riskAssessmentStore.set(assessment.id, assessment);

    if (riskLevel === "critical" || riskLevel === "high") {
      alertStore.push({
        id: `alert-${randomUUID().slice(0, 8)}`,
        type: "high_risk_patient",
        message: `Patient ${sanitizedPatientId} assessed as ${riskLevel} readmission risk (score: ${riskScore})`,
        timestamp: assessmentDate,
        severity: riskLevel,
      });
    }

    return assessment;
  }

  async generateProactiveInterventions(patientId: string, patterns: PatientJourneyPattern[], riskAssessment?: ReadmissionRiskAssessment): Promise<ProactiveIntervention[]> {
    const sanitizedPatientId = sanitizePhi(patientId);
    const generatedInterventions: ProactiveIntervention[] = [];

    if (aiEnabled && patterns.length > 0) {
      try {
        const patternSummary = patterns.map(p => ({
          type: p.patternType,
          description: sanitizePhi(p.description),
          phase: p.journeyPhase,
        }));

        const response = await generatePhiSafeText({
          system: NO_CDS_WORKFLOW_PROMPT,
          user: `Generate PROACTIVE INTERVENTIONS for the following patient journey patterns. Patient ID: ${sanitizedPatientId}

Detected Patterns:
${patternSummary.map(p => `- ${p.type}: ${p.description} (Phase: ${p.phase})`).join("\n")}

Risk Level: ${riskAssessment?.riskLevel || "not assessed"}
Risk Score: ${riskAssessment?.riskScore || "N/A"}

For each intervention provide (OPERATIONAL/ADMINISTRATIVE only, NO clinical recommendations):
1. interventionType (scheduling, outreach, education, coordination, notification, documentation, transition)
2. priority (critical, high, medium, low)
3. title
4. description
5. rationale
6. suggestedActions (array of objects with: action, assignee [care_coordinator, scheduler, patient_services, care_team, automated], deadline relative to now)
7. expectedOutcome

Format as JSON array. Generate 1-2 interventions.`,
          temperature: 0.7,
          maxTokens: 1200,
        });

        const content = response || "";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsed.forEach((i: {
            interventionType: InterventionType;
            priority: RiskLevel;
            title: string;
            description: string;
            rationale: string;
            suggestedActions: Array<{ action: string; assignee: string; deadline?: string }>;
            expectedOutcome: string;
          }) => {
            const intervention: ProactiveIntervention = {
              id: `int-${randomUUID().slice(0, 8)}`,
              patientId,
              interventionType: i.interventionType,
              priority: i.priority,
              title: i.title,
              description: i.description,
              rationale: i.rationale,
              suggestedActions: (i.suggestedActions || []).map(a => ({
                action: a.action,
                assignee: (a.assignee as ProactiveIntervention["suggestedActions"][0]["assignee"]) || "care_coordinator",
                deadline: a.deadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                status: "pending" as InterventionStatus,
              })),
              expectedOutcome: i.expectedOutcome,
              metrics: {
                targetMetric: "Intervention completion rate",
                currentValue: 0,
                targetValue: 100,
              },
              status: "pending",
              createdAt: new Date().toISOString(),
              aiGenerated: true,
              noCdsCompliant: true,
            };
            generatedInterventions.push(intervention);
            interventionStore.set(intervention.id, intervention);
          });
        }
      } catch (error) {
        console.error("[AIClinicalWorkflowAutomation] Intervention generation error:", error);
      }
    }

    if (generatedInterventions.length === 0 && patterns.length > 0) {
      const topPattern = patterns[0];
      const intervention: ProactiveIntervention = {
        id: `int-${randomUUID().slice(0, 8)}`,
        patientId,
        interventionType: this.mapPatternToIntervention(topPattern.patternType),
        priority: riskAssessment?.riskLevel || "medium",
        title: `Address ${topPattern.patternType.replace(/_/g, " ")}`,
        description: `Proactive intervention to address: ${topPattern.description}`,
        rationale: topPattern.operationalImpact,
        suggestedActions: topPattern.suggestedActions.slice(0, 3).map(action => ({
          action,
          assignee: "care_coordinator" as const,
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: "pending" as InterventionStatus,
        })),
        expectedOutcome: "Improved care coordination and workflow efficiency",
        metrics: {
          targetMetric: "Pattern resolution",
          currentValue: 0,
          targetValue: 100,
        },
        status: "pending",
        createdAt: new Date().toISOString(),
        aiGenerated: false,
        noCdsCompliant: true,
      };
      generatedInterventions.push(intervention);
      interventionStore.set(intervention.id, intervention);
    }

    return generatedInterventions;
  }

  private mapPatternToIntervention(patternType: PatternType): InterventionType {
    const mapping: Record<PatternType, InterventionType> = {
      care_gap: "outreach",
      workflow_bottleneck: "coordination",
      coordination_issue: "coordination",
      documentation_gap: "documentation",
      follow_up_needed: "scheduling",
      transition_risk: "transition",
    };
    return mapping[patternType] || "coordination";
  }

  updateInterventionStatus(id: string, status: InterventionStatus, actionUpdates?: Array<{ index: number; status: InterventionStatus }>): ProactiveIntervention | undefined {
    const intervention = interventionStore.get(id);
    if (!intervention) return undefined;

    intervention.status = status;
    if (status === "completed") {
      intervention.completedAt = new Date().toISOString();
    }

    if (actionUpdates) {
      actionUpdates.forEach(update => {
        if (intervention.suggestedActions[update.index]) {
          intervention.suggestedActions[update.index].status = update.status;
        }
      });
    }

    interventionStore.set(id, intervention);
    return intervention;
  }

  updatePatternStatus(id: string, status: PatientJourneyPattern["status"]): PatientJourneyPattern | undefined {
    const pattern = patternStore.get(id);
    if (!pattern) return undefined;

    pattern.status = status;
    patternStore.set(id, pattern);
    return pattern;
  }

  getAlerts(limit: number = 20): typeof alertStore {
    return alertStore.slice(-limit);
  }

  dismissAlert(id: string): boolean {
    const index = alertStore.findIndex(a => a.id === id);
    if (index !== -1) {
      alertStore.splice(index, 1);
      return true;
    }
    return false;
  }
}

export const aiClinicalWorkflowAutomation = new AIClinicalWorkflowAutomation();
