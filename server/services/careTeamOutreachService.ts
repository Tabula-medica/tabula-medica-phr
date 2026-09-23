import { generatePhiSafeText } from "./ai-gateway";
import type {
  HighRiskPatient,
  PatientRiskFactor,
  PatientAlert,
  SuggestedOutreachAction,
  OutreachTalkingPoints,
  OutreachAction,
  OutreachAttempt,
  PatientOutcome,
  OutreachDashboardSummary,
  OutreachAnalytics,
  RiskPriorityLevel,
  OutreachActionType,
  OutreachStatus,
  CareTeamRole,
  InsertOutreachAction,
  InsertOutreachAttempt,
} from "@shared/schema";
import { format, subDays, differenceInDays } from "date-fns";

const outreachActions = new Map<string, OutreachAction>();
const talkingPointsCache = new Map<string, OutreachTalkingPoints>();

function generateId(): string {
  return `outreach_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function getSampleHighRiskPatients(): HighRiskPatient[] {
  const today = new Date();
  return [
    {
      patientId: "patient-001",
      patientName: "Maria Garcia",
      dateOfBirth: "1958-03-15",
      priorityLevel: "critical",
      riskScore: 92,
      riskFactors: [
        {
          id: "rf-001",
          category: "vital_trend",
          severity: "critical",
          title: "Blood Pressure Readings Above Target",
          description: "Recent systolic blood pressure readings show 165-175 mmHg over the past 2 weeks. Discuss with provider about blood pressure management.",
          dataPoints: ["Jan 15: 172/98", "Jan 12: 168/95", "Jan 8: 175/100"],
          lastUpdated: format(subDays(today, 1), "yyyy-MM-dd"),
          trendDirection: "worsening",
        },
        {
          id: "rf-002",
          category: "medication_adherence",
          severity: "high",
          title: "Medication Refill Records Show Gap",
          description: "Pharmacy records show Lisinopril last filled Dec 15 and Metformin last filled Dec 20. Discuss refill status with patient.",
          dataPoints: ["Lisinopril: Last filled Dec 15", "Metformin: Last filled Dec 20"],
          lastUpdated: format(subDays(today, 2), "yyyy-MM-dd"),
          trendDirection: "worsening",
        },
      ],
      recentAlerts: [
        {
          id: "alert-001",
          type: "critical_value",
          severity: "critical",
          message: "BP reading of 175/100 mmHg recorded - discuss with provider",
          timestamp: format(subDays(today, 1), "yyyy-MM-dd'T'HH:mm:ss"),
          acknowledged: false,
        },
      ],
      lastContactDate: format(subDays(today, 21), "yyyy-MM-dd"),
      daysSinceContact: 21,
      suggestedActions: [
        {
          id: "action-001",
          actionType: "phone_call",
          priority: "critical",
          reason: "Check in about blood pressure readings and medication refills",
          suggestedTiming: "Today - within 2 hours",
          estimatedDuration: 15,
          requiredRole: "nurse",
        },
      ],
      assignedCareTeamMember: "nurse-jennifer",
      primaryProvider: "Dr. Robert Chen",
      contactInfo: {
        phone: "(555) 123-4567",
        email: "m.garcia@email.com",
        preferredContactMethod: "phone_call",
      },
    },
    {
      patientId: "patient-002",
      patientName: "James Wilson",
      dateOfBirth: "1965-07-22",
      priorityLevel: "high",
      riskScore: 78,
      riskFactors: [
        {
          id: "rf-003",
          category: "lab_abnormality",
          severity: "high",
          title: "HbA1c Level Shows Trend Change",
          description: "Latest HbA1c shows 9.2%, compared to 7.8% three months ago. Discuss blood sugar management with provider.",
          dataPoints: ["Jan 10: 9.2%", "Oct 5: 7.8%", "Jul 12: 7.5%"],
          lastUpdated: format(subDays(today, 8), "yyyy-MM-dd"),
          trendDirection: "worsening",
        },
        {
          id: "rf-004",
          category: "care_gap",
          severity: "moderate",
          title: "Missed Annual Eye Exam",
          description: "Diabetic retinopathy screening overdue by 4 months.",
          dataPoints: ["Last exam: Sep 2024", "Due: Sep 2025"],
          lastUpdated: format(subDays(today, 5), "yyyy-MM-dd"),
        },
      ],
      recentAlerts: [
        {
          id: "alert-002",
          type: "care_gap",
          severity: "high",
          message: "HbA1c trend change noted - discuss with care team",
          timestamp: format(subDays(today, 8), "yyyy-MM-dd'T'HH:mm:ss"),
          acknowledged: true,
        },
      ],
      lastContactDate: format(subDays(today, 14), "yyyy-MM-dd"),
      daysSinceContact: 14,
      suggestedActions: [
        {
          id: "action-002",
          actionType: "phone_call",
          priority: "high",
          reason: "Check in about blood sugar management and recent lab results",
          suggestedTiming: "Within 24-48 hours",
          estimatedDuration: 20,
          requiredRole: "care_coordinator",
        },
        {
          id: "action-003",
          actionType: "secure_message",
          priority: "moderate",
          reason: "Schedule eye exam appointment",
          suggestedTiming: "This week",
          estimatedDuration: 5,
          requiredRole: "care_coordinator",
        },
      ],
      assignedCareTeamMember: "coord-sarah",
      primaryProvider: "Dr. Amanda Foster",
      contactInfo: {
        phone: "(555) 234-5678",
        email: "j.wilson@email.com",
        preferredContactMethod: "phone_call",
      },
    },
    {
      patientId: "patient-003",
      patientName: "Eleanor Thompson",
      dateOfBirth: "1952-11-08",
      priorityLevel: "high",
      riskScore: 75,
      riskFactors: [
        {
          id: "rf-005",
          category: "hospitalization_risk",
          severity: "high",
          title: "Recent ED Visit",
          description: "ED visit 5 days ago for chest pain. Cardiology referral provided. Discuss follow-up appointment with patient.",
          dataPoints: ["ED visit: Jan 13 - Chest pain, discharged with cardiology referral"],
          lastUpdated: format(subDays(today, 5), "yyyy-MM-dd"),
        },
        {
          id: "rf-006",
          category: "chronic_condition",
          severity: "moderate",
          title: "Multiple Chronic Conditions",
          description: "Managing CHF, atrial fibrillation, and CKD stage 3. High complexity patient.",
          dataPoints: ["CHF - stable", "A-fib - on anticoagulation", "CKD Stage 3 - eGFR 42"],
          lastUpdated: format(subDays(today, 10), "yyyy-MM-dd"),
          trendDirection: "stable",
        },
      ],
      recentAlerts: [
        {
          id: "alert-003",
          type: "er_visit",
          severity: "high",
          message: "ED visit for chest pain - needs cardiology follow-up",
          timestamp: format(subDays(today, 5), "yyyy-MM-dd'T'HH:mm:ss"),
          acknowledged: false,
        },
      ],
      lastContactDate: format(subDays(today, 7), "yyyy-MM-dd"),
      daysSinceContact: 7,
      suggestedActions: [
        {
          id: "action-004",
          actionType: "phone_call",
          priority: "high",
          reason: "Post-ED follow-up and cardiology appointment confirmation",
          suggestedTiming: "Today",
          estimatedDuration: 20,
          requiredRole: "nurse",
        },
      ],
      assignedCareTeamMember: "nurse-jennifer",
      primaryProvider: "Dr. Robert Chen",
      contactInfo: {
        phone: "(555) 345-6789",
        preferredContactMethod: "phone_call",
      },
    },
    {
      patientId: "patient-004",
      patientName: "Robert Martinez",
      dateOfBirth: "1970-04-30",
      priorityLevel: "moderate",
      riskScore: 55,
      riskFactors: [
        {
          id: "rf-007",
          category: "medication_adherence",
          severity: "moderate",
          title: "Inconsistent Statin Usage",
          description: "Pharmacy claims show gaps in atorvastatin refills over past 6 months.",
          dataPoints: ["Filled: Jul, Sep, Nov", "Gaps: Aug, Oct, Dec-Jan"],
          lastUpdated: format(subDays(today, 3), "yyyy-MM-dd"),
        },
      ],
      recentAlerts: [],
      lastContactDate: format(subDays(today, 30), "yyyy-MM-dd"),
      daysSinceContact: 30,
      suggestedActions: [
        {
          id: "action-005",
          actionType: "secure_message",
          priority: "moderate",
          reason: "Check in about statin adherence and refill reminder",
          suggestedTiming: "This week",
          estimatedDuration: 10,
          requiredRole: "pharmacist",
        },
      ],
      assignedCareTeamMember: "pharm-michael",
      primaryProvider: "Dr. Amanda Foster",
      contactInfo: {
        phone: "(555) 456-7890",
        email: "r.martinez@email.com",
        preferredContactMethod: "secure_message",
      },
    },
    {
      patientId: "patient-005",
      patientName: "Patricia Chen",
      dateOfBirth: "1948-09-12",
      priorityLevel: "moderate",
      riskScore: 48,
      riskFactors: [
        {
          id: "rf-008",
          category: "care_gap",
          severity: "moderate",
          title: "Overdue Colonoscopy",
          description: "Colorectal cancer screening overdue by 8 months. Last screening 2014.",
          dataPoints: ["Last colonoscopy: 2014", "Due: 2024"],
          lastUpdated: format(subDays(today, 15), "yyyy-MM-dd"),
        },
        {
          id: "rf-009",
          category: "social_determinant",
          severity: "low",
          title: "Transportation Barrier",
          description: "Patient has reported difficulty getting to appointments due to lack of transportation.",
          dataPoints: ["Noted in chart: Oct 2024"],
          lastUpdated: format(subDays(today, 90), "yyyy-MM-dd"),
        },
      ],
      recentAlerts: [],
      lastContactDate: format(subDays(today, 45), "yyyy-MM-dd"),
      daysSinceContact: 45,
      suggestedActions: [
        {
          id: "action-006",
          actionType: "phone_call",
          priority: "moderate",
          reason: "Discuss colonoscopy scheduling and transportation assistance",
          suggestedTiming: "Within 1 week",
          estimatedDuration: 15,
          requiredRole: "social_worker",
        },
      ],
      assignedCareTeamMember: "sw-david",
      primaryProvider: "Dr. Robert Chen",
      contactInfo: {
        phone: "(555) 567-8901",
        preferredContactMethod: "phone_call",
      },
    },
  ];
}

async function generateTalkingPointsWithAI(patient: HighRiskPatient): Promise<OutreachTalkingPoints> {
  const riskSummary = patient.riskFactors
    .map((rf) => `- ${rf.title} (${rf.severity}): ${rf.description}`)
    .join("\n");

  const alertSummary = patient.recentAlerts
    .map((a) => `- ${a.type}: ${a.message}`)
    .join("\n") || "No recent alerts";

  try {
    const content = await generatePhiSafeText({
      system: `You are a healthcare care coordinator assistant helping care team members prepare for patient outreach calls. Generate talking points that are:
- Professional and empathetic in tone
- Focused on patient education and engagement
- Using safe language (avoid medical advice - use "discuss with your provider", "your care team recommends")
- Culturally sensitive and patient-centered
- Action-oriented with clear next steps

Return a JSON object with this structure:
{
  "openingStatement": "Friendly, personalized greeting",
  "keyDiscussionPoints": [
    {
      "topic": "Topic name",
      "importance": "critical|high|moderate",
      "talkingPoint": "What to say",
      "suggestedQuestions": ["Question 1", "Question 2"],
      "anticipatedConcerns": ["Concern patient might raise"]
    }
  ],
  "suggestedInterventions": [
    {
      "intervention": "What to recommend",
      "rationale": "Why this helps",
      "patientBenefits": ["Benefit 1", "Benefit 2"]
    }
  ],
  "closingGuidance": "How to end the call positively",
  "followUpRecommendations": ["Next step 1", "Next step 2"],
  "messageTemplate": "Brief secure message template if call unsuccessful",
  "escalationTriggers": ["When to escalate to provider"]
}`,
      user: `Generate outreach talking points for this patient:

Patient: ${patient.patientName}
Age: ${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years old
Priority Level: ${patient.priorityLevel}
Risk Score: ${patient.riskScore}/100
Days Since Last Contact: ${patient.daysSinceContact}
Primary Provider: ${patient.primaryProvider || "Not assigned"}

Risk Factors:
${riskSummary}

Recent Alerts:
${alertSummary}

Preferred Contact Method: ${patient.contactInfo.preferredContactMethod || "phone_call"}`,
      responseMimeType: "application/json",
      temperature: 0.7,
    });

    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content);

    return {
      patientId: patient.patientId,
      generatedAt: new Date().toISOString(),
      patientContext: {
        name: patient.patientName,
        recentChanges: patient.riskFactors.map((rf) => rf.title),
        keyRisks: patient.riskFactors.filter((rf) => rf.severity === "critical" || rf.severity === "high").map((rf) => rf.title),
        lastInteraction: patient.lastContactDate || "No recent contact",
      },
      openingStatement: parsed.openingStatement,
      keyDiscussionPoints: parsed.keyDiscussionPoints,
      suggestedInterventions: parsed.suggestedInterventions,
      closingGuidance: parsed.closingGuidance,
      followUpRecommendations: parsed.followUpRecommendations,
      messageTemplate: parsed.messageTemplate,
      escalationTriggers: parsed.escalationTriggers,
    };
  } catch (error) {
    console.error("[CareTeamOutreach] AI talking points generation failed:", error);
    return generateFallbackTalkingPoints(patient);
  }
}

function generateFallbackTalkingPoints(patient: HighRiskPatient): OutreachTalkingPoints {
  const criticalRisks = patient.riskFactors.filter((rf) => rf.severity === "critical" || rf.severity === "high");

  return {
    patientId: patient.patientId,
    generatedAt: new Date().toISOString(),
    patientContext: {
      name: patient.patientName,
      recentChanges: patient.riskFactors.map((rf) => rf.title),
      keyRisks: criticalRisks.map((rf) => rf.title),
      lastInteraction: patient.lastContactDate || "No recent contact",
    },
    openingStatement: `Hello ${patient.patientName.split(" ")[0]}, this is [Your Name] from your care team at [Practice Name]. I'm calling to check in with you about your health and see how you're doing.`,
    keyDiscussionPoints: patient.riskFactors.slice(0, 3).map((rf) => ({
      topic: rf.title,
      importance: rf.severity as "critical" | "high" | "moderate",
      talkingPoint: `I wanted to discuss ${rf.title.toLowerCase()} with you. ${rf.description}`,
      suggestedQuestions: [
        "How have you been feeling lately?",
        "Have you noticed any changes or concerns?",
        "Is there anything making it difficult to manage this?",
      ],
      anticipatedConcerns: [
        "Cost of medications or treatments",
        "Side effects from current medications",
        "Difficulty understanding care plan",
      ],
    })),
    suggestedInterventions: [
      {
        intervention: "Schedule follow-up appointment with care team",
        rationale: "Regular monitoring helps track progress",
        patientBenefits: ["Personalized care adjustments", "Early problem detection", "Better health outcomes"],
      },
    ],
    closingGuidance: "Thank you for taking the time to speak with me today. Your health is important to us, and we're here to support you. Is there anything else you'd like to discuss before we end our call?",
    followUpRecommendations: [
      "Document call outcome in patient chart",
      "Schedule follow-up call if needed",
      "Update care plan based on patient feedback",
    ],
    messageTemplate: `Hello ${patient.patientName.split(" ")[0]}, we tried to reach you by phone today. Please call us back at [Phone Number] when you have a moment, or reply to this message. We'd like to check in about your recent health status. - Your Care Team`,
    escalationTriggers: [
      "Patient reports new or concerning symptoms",
      "Patient expresses safety concerns",
      "Patient refuses recommended care without clear reason",
      "Unable to reach patient after 3 attempts",
    ],
  };
}

class CareTeamOutreachService {
  async getHighRiskPatients(filters?: {
    priorityLevel?: RiskPriorityLevel;
    assignedTo?: string;
    riskCategory?: string;
  }): Promise<HighRiskPatient[]> {
    let patients = getSampleHighRiskPatients();

    if (filters?.priorityLevel) {
      patients = patients.filter((p) => p.priorityLevel === filters.priorityLevel);
    }
    if (filters?.assignedTo) {
      patients = patients.filter((p) => p.assignedCareTeamMember === filters.assignedTo);
    }
    if (filters?.riskCategory) {
      patients = patients.filter((p) => p.riskFactors.some((rf) => rf.category === filters.riskCategory));
    }

    return patients.sort((a, b) => b.riskScore - a.riskScore);
  }

  async getPatientDetails(patientId: string): Promise<HighRiskPatient | null> {
    const patients = getSampleHighRiskPatients();
    return patients.find((p) => p.patientId === patientId) || null;
  }

  async generateTalkingPoints(patientId: string): Promise<OutreachTalkingPoints> {
    const cached = talkingPointsCache.get(patientId);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (cached && new Date(cached.generatedAt).getTime() > oneHourAgo) {
      return cached;
    }

    const patient = await this.getPatientDetails(patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    const talkingPoints = await generateTalkingPointsWithAI(patient);
    talkingPointsCache.set(patientId, talkingPoints);
    return talkingPoints;
  }

  async createOutreachAction(data: InsertOutreachAction): Promise<OutreachAction> {
    const id = generateId();
    const now = new Date().toISOString();

    const action: OutreachAction = {
      id,
      patientId: data.patientId,
      patientName: data.patientName,
      actionType: data.actionType,
      status: "scheduled",
      priority: data.priority,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      assignedTo: data.assignedTo,
      assignedToRole: data.assignedToRole as CareTeamRole,
      reason: data.reason,
      createdAt: now,
      updatedAt: now,
      attempts: [],
      triggeredBy: data.triggeredBy || "manual",
      riskFactorIds: data.riskFactorIds || [],
    };

    outreachActions.set(id, action);
    return action;
  }

  async getOutreachActions(filters?: {
    status?: OutreachStatus;
    patientId?: string;
    assignedTo?: string;
    priority?: RiskPriorityLevel;
  }): Promise<OutreachAction[]> {
    let actions = Array.from(outreachActions.values());

    if (filters?.status) {
      actions = actions.filter((a) => a.status === filters.status);
    }
    if (filters?.patientId) {
      actions = actions.filter((a) => a.patientId === filters.patientId);
    }
    if (filters?.assignedTo) {
      actions = actions.filter((a) => a.assignedTo === filters.assignedTo);
    }
    if (filters?.priority) {
      actions = actions.filter((a) => a.priority === filters.priority);
    }

    return actions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async getOutreachAction(id: string): Promise<OutreachAction | null> {
    return outreachActions.get(id) || null;
  }

  async recordAttempt(actionId: string, attempt: InsertOutreachAttempt, performedBy: string): Promise<OutreachAction> {
    const action = outreachActions.get(actionId);
    if (!action) {
      throw new Error("Outreach action not found");
    }

    const newAttempt: OutreachAttempt = {
      id: `attempt_${Date.now()}`,
      attemptNumber: action.attempts.length + 1,
      timestamp: new Date().toISOString(),
      method: attempt.method,
      response: attempt.response,
      duration: attempt.duration,
      notes: attempt.notes,
      performedBy,
      nextSteps: attempt.nextSteps,
    };

    action.attempts.push(newAttempt);
    action.updatedAt = new Date().toISOString();

    if (["answered", "message_replied", "appointment_scheduled"].includes(attempt.response)) {
      action.status = "completed";
      action.completedAt = new Date().toISOString();
    } else if (attempt.response === "no_answer" || attempt.response === "voicemail") {
      if (action.attempts.length >= 3) {
        action.status = "no_response";
      } else {
        action.status = "scheduled";
      }
    }

    outreachActions.set(actionId, action);
    return action;
  }

  async updateOutcome(actionId: string, outcome: PatientOutcome): Promise<OutreachAction> {
    const action = outreachActions.get(actionId);
    if (!action) {
      throw new Error("Outreach action not found");
    }

    action.outcome = outcome;
    action.updatedAt = new Date().toISOString();
    action.status = "completed";
    action.completedAt = new Date().toISOString();

    outreachActions.set(actionId, action);
    return action;
  }

  async getDashboardSummary(): Promise<OutreachDashboardSummary> {
    const patients = await this.getHighRiskPatients();
    const actions = await this.getOutreachActions();
    const today = format(new Date(), "yyyy-MM-dd");

    const patientsByPriority = ["critical", "high", "moderate", "low"].map((priority) => ({
      priority: priority as RiskPriorityLevel,
      count: patients.filter((p) => p.priorityLevel === priority).length,
    }));

    const riskCategories = new Map<string, number>();
    patients.forEach((p) => {
      p.riskFactors.forEach((rf) => {
        riskCategories.set(rf.category, (riskCategories.get(rf.category) || 0) + 1);
      });
    });

    const topRiskCategories = Array.from(riskCategories.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const completedToday = actions.filter(
      (a) => a.status === "completed" && a.completedAt?.startsWith(today)
    ).length;

    const totalAttempts = actions.reduce((sum, a) => sum + a.attempts.length, 0);
    const successfulContacts = actions.filter((a) => 
      a.attempts.some((att) => ["answered", "message_replied", "appointment_scheduled"].includes(att.response))
    ).length;

    return {
      totalHighRiskPatients: patients.length,
      patientsByPriority,
      pendingOutreachActions: actions.filter((a) => a.status === "scheduled" || a.status === "in_progress").length,
      completedToday,
      overdueActions: actions.filter((a) => {
        if (a.status !== "scheduled") return false;
        return a.scheduledDate < today;
      }).length,
      averageResponseRate: totalAttempts > 0 ? (successfulContacts / actions.length) * 100 : 0,
      topRiskCategories,
      teamPerformance: [
        {
          memberId: "nurse-jennifer",
          memberName: "Jennifer Adams",
          role: "nurse" as CareTeamRole,
          assignedPatients: patients.filter((p) => p.assignedCareTeamMember === "nurse-jennifer").length,
          completedActions: actions.filter((a) => a.assignedTo === "nurse-jennifer" && a.status === "completed").length,
          pendingActions: actions.filter((a) => a.assignedTo === "nurse-jennifer" && a.status === "scheduled").length,
        },
        {
          memberId: "coord-sarah",
          memberName: "Sarah Mitchell",
          role: "care_coordinator" as CareTeamRole,
          assignedPatients: patients.filter((p) => p.assignedCareTeamMember === "coord-sarah").length,
          completedActions: actions.filter((a) => a.assignedTo === "coord-sarah" && a.status === "completed").length,
          pendingActions: actions.filter((a) => a.assignedTo === "coord-sarah" && a.status === "scheduled").length,
        },
        {
          memberId: "pharm-michael",
          memberName: "Michael Brown",
          role: "pharmacist" as CareTeamRole,
          assignedPatients: patients.filter((p) => p.assignedCareTeamMember === "pharm-michael").length,
          completedActions: actions.filter((a) => a.assignedTo === "pharm-michael" && a.status === "completed").length,
          pendingActions: actions.filter((a) => a.assignedTo === "pharm-michael" && a.status === "scheduled").length,
        },
      ],
    };
  }

  async getAnalytics(dateRange?: { start: string; end: string }): Promise<OutreachAnalytics> {
    const today = new Date();
    const start = dateRange?.start || format(subDays(today, 30), "yyyy-MM-dd");
    const end = dateRange?.end || format(today, "yyyy-MM-dd");

    const actions = await this.getOutreachActions();
    const filteredActions = actions.filter((a) => a.createdAt >= start && a.createdAt <= end);

    const totalAttempts = filteredActions.reduce((sum, a) => sum + a.attempts.length, 0);
    const successfulContacts = filteredActions.filter((a) =>
      a.attempts.some((att) => ["answered", "message_replied", "appointment_scheduled"].includes(att.response))
    ).length;

    const methodStats = new Map<OutreachActionType, { success: number; total: number }>();
    filteredActions.forEach((a) => {
      const current = methodStats.get(a.actionType) || { success: 0, total: 0 };
      current.total++;
      if (a.status === "completed") current.success++;
      methodStats.set(a.actionType, current);
    });

    const outcomes = filteredActions.filter((a) => a.outcome);

    return {
      dateRange: { start, end },
      totalOutreachAttempts: totalAttempts,
      successfulContacts,
      contactRate: filteredActions.length > 0 ? (successfulContacts / filteredActions.length) * 100 : 0,
      averageAttemptsPerPatient: filteredActions.length > 0 ? totalAttempts / filteredActions.length : 0,
      outcomeBreakdown: {
        appointmentsScheduled: outcomes.filter((a) => a.outcome?.appointmentScheduled).length,
        medicationsAdjusted: outcomes.filter((a) => a.outcome?.medicationChanged).length,
        referralsMade: outcomes.filter((a) => a.outcome?.referralMade).length,
        escalations: outcomes.filter((a) => a.outcome?.escalatedToProvider).length,
      },
      responseByMethod: Array.from(methodStats.entries()).map(([method, stats]) => ({
        method,
        successRate: stats.total > 0 ? (stats.success / stats.total) * 100 : 0,
        count: stats.total,
      })),
      patientEngagementTrend: [],
    };
  }

  async autoScheduleOutreach(): Promise<OutreachAction[]> {
    const patients = await this.getHighRiskPatients();
    const today = format(new Date(), "yyyy-MM-dd");
    const createdActions: OutreachAction[] = [];

    for (const patient of patients) {
      if (patient.priorityLevel === "critical" || patient.priorityLevel === "high") {
        const existingAction = Array.from(outreachActions.values()).find(
          (a) => a.patientId === patient.patientId && a.status === "scheduled"
        );

        if (!existingAction && patient.suggestedActions.length > 0) {
          const suggested = patient.suggestedActions[0];
          const action = await this.createOutreachAction({
            patientId: patient.patientId,
            patientName: patient.patientName,
            actionType: suggested.actionType,
            priority: patient.priorityLevel,
            scheduledDate: today,
            assignedTo: patient.assignedCareTeamMember || "unassigned",
            assignedToRole: suggested.requiredRole || "care_coordinator",
            reason: suggested.reason,
            riskFactorIds: patient.riskFactors.map((rf) => rf.id),
            triggeredBy: "ai_recommendation",
          });
          createdActions.push(action);
        }
      }
    }

    return createdActions;
  }
}

export const careTeamOutreachService = new CareTeamOutreachService();
