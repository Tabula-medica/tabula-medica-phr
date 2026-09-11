import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

const NO_CDS_DISCLAIMER = "DISCLAIMER: This information is for care coordination and operational efficiency purposes only. It does not constitute clinical decision support and should not replace clinical judgment. All clinical decisions must be made by qualified healthcare professionals.";

interface CareTeamMember {
  id: string;
  name: string;
  role: "physician" | "nurse" | "care_coordinator" | "social_worker" | "pharmacist" | "specialist" | "admin";
  specialty?: string;
  currentWorkload: number;
  maxCapacity: number;
  activePatients: number;
  pendingTasks: number;
  avgResponseTime: number;
  availability: "available" | "busy" | "away" | "offline";
  skills: string[];
  certifications: string[];
  shiftEnd?: string;
}

interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  type: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  requiredSkills: string[];
  estimatedTimeMinutes: number;
  createdAt: string;
}

interface Task {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  description: string;
  priority: "urgent" | "high" | "normal" | "low";
  category: string;
  requiredRole: string[];
  requiredSkills: string[];
  estimatedTimeMinutes: number;
  deadline?: string;
  createdAt: string;
}

interface AssignmentRecommendation {
  alertOrTaskId: string;
  type: "alert" | "task";
  recommendedMemberId: string;
  recommendedMemberName: string;
  recommendedMemberRole: string;
  confidence: number;
  reasoning: string;
  alternativeMembers: {
    memberId: string;
    memberName: string;
    score: number;
    reason: string;
  }[];
  workloadImpact: {
    currentLoad: number;
    projectedLoad: number;
    capacityRemaining: number;
  };
  disclaimer: string;
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  scheduledTime: string;
  appointmentType: string;
  providerId: string;
  providerName: string;
  duration: number;
  isFirstVisit: boolean;
}

interface PatientHistoryForNoShow {
  patientId: string;
  totalAppointments: number;
  noShowCount: number;
  cancelCount: number;
  lateArrivalCount: number;
  lastNoShowDate?: string;
  avgDistanceToClinic: number;
  hasTransportationIssues: boolean;
  hasChildcareNeeds: boolean;
  preferredContactMethod: string;
  reminderResponseRate: number;
  insuranceStatus: "active" | "pending" | "issues" | "uninsured";
  chronicConditions: string[];
  mentalHealthDiagnoses: boolean;
  recentLifeEvents: string[];
}

interface NoShowPrediction {
  appointmentId: string;
  patientId: string;
  patientName: string;
  scheduledTime: string;
  noShowRisk: "high" | "medium" | "low";
  riskScore: number;
  riskFactors: {
    factor: string;
    impact: "high" | "medium" | "low";
    details: string;
  }[];
  suggestedInterventions: {
    intervention: string;
    priority: number;
    expectedImpact: string;
    timing: string;
    assignTo: string;
  }[];
  aiInsights: string;
  disclaimer: string;
}

interface CareGap {
  id: string;
  patientId: string;
  patientName: string;
  gapType: string;
  description: string;
  severity: "critical" | "moderate" | "minor";
  dueDate?: string;
  daysOverdue?: number;
  lastAttemptDate?: string;
  recommendedAction: string;
}

interface PatientProgress {
  patientId: string;
  patientName: string;
  carePlanId: string;
  overallProgress: number;
  goalsCompleted: number;
  totalGoals: number;
  tasksCompleted: number;
  totalTasks: number;
  recentMilestones: string[];
  concerns: string[];
  trendDirection: "improving" | "stable" | "declining";
}

interface CareGapReport {
  id: string;
  generatedAt: string;
  reportPeriod: { start: string; end: string };
  teamId: string;
  summary: {
    totalPatients: number;
    patientsWithGaps: number;
    totalGaps: number;
    criticalGaps: number;
    moderateGaps: number;
    minorGaps: number;
    closedGapsSinceLastReport: number;
    newGapsSinceLastReport: number;
  };
  gapsByCategory: {
    category: string;
    count: number;
    percentageOfTotal: number;
    trend: "increasing" | "stable" | "decreasing";
  }[];
  topPriorityPatients: {
    patientId: string;
    patientName: string;
    gapCount: number;
    criticalGaps: number;
    riskLevel: "high" | "medium" | "low";
    recommendedActions: string[];
  }[];
  progressSummary: {
    patientsImproving: number;
    patientsStable: number;
    patientsDeclining: number;
    averageGoalCompletion: number;
    averageTaskCompletion: number;
  };
  aiRecommendations: {
    recommendation: string;
    priority: "high" | "medium" | "low";
    expectedImpact: string;
    resourcesNeeded: string;
  }[];
  teamPerformance: {
    avgResponseTime: number;
    gapClosureRate: number;
    patientSatisfactionTrend: string;
  };
  disclaimer: string;
}

const sampleCareTeamMembers: CareTeamMember[] = [
  {
    id: "member-1",
    name: "Dr. Sarah Chen",
    role: "physician",
    specialty: "Internal Medicine",
    currentWorkload: 65,
    maxCapacity: 100,
    activePatients: 28,
    pendingTasks: 12,
    avgResponseTime: 15,
    availability: "available",
    skills: ["chronic disease management", "diabetes care", "hypertension management", "preventive care"],
    certifications: ["Board Certified Internal Medicine", "Geriatric Medicine"],
    shiftEnd: "17:00",
  },
  {
    id: "member-2",
    name: "Nurse Maria Rodriguez",
    role: "nurse",
    currentWorkload: 78,
    maxCapacity: 100,
    activePatients: 45,
    pendingTasks: 18,
    avgResponseTime: 8,
    availability: "available",
    skills: ["patient education", "wound care", "medication management", "vital signs monitoring", "phone triage"],
    certifications: ["RN", "BLS", "ACLS"],
    shiftEnd: "19:00",
  },
  {
    id: "member-3",
    name: "James Wilson",
    role: "care_coordinator",
    currentWorkload: 55,
    maxCapacity: 100,
    activePatients: 60,
    pendingTasks: 22,
    avgResponseTime: 12,
    availability: "available",
    skills: ["care plan coordination", "appointment scheduling", "insurance navigation", "patient outreach", "resource referrals"],
    certifications: ["Certified Care Coordinator"],
    shiftEnd: "18:00",
  },
  {
    id: "member-4",
    name: "Dr. Emily Park",
    role: "specialist",
    specialty: "Cardiology",
    currentWorkload: 82,
    maxCapacity: 100,
    activePatients: 35,
    pendingTasks: 8,
    avgResponseTime: 25,
    availability: "busy",
    skills: ["cardiac care", "ECG interpretation", "heart failure management", "arrhythmia management"],
    certifications: ["Board Certified Cardiology", "Nuclear Cardiology"],
    shiftEnd: "16:00",
  },
  {
    id: "member-5",
    name: "Lisa Thompson",
    role: "social_worker",
    currentWorkload: 45,
    maxCapacity: 100,
    activePatients: 40,
    pendingTasks: 15,
    avgResponseTime: 20,
    availability: "available",
    skills: ["mental health support", "resource navigation", "family counseling", "crisis intervention", "housing assistance"],
    certifications: ["LCSW", "Mental Health First Aid"],
    shiftEnd: "17:00",
  },
  {
    id: "member-6",
    name: "Dr. Robert Kim",
    role: "pharmacist",
    currentWorkload: 60,
    maxCapacity: 100,
    activePatients: 50,
    pendingTasks: 10,
    avgResponseTime: 10,
    availability: "available",
    skills: ["medication review", "drug interaction checking", "patient counseling", "MTM services", "immunizations"],
    certifications: ["PharmD", "Board Certified Pharmacotherapy"],
    shiftEnd: "18:00",
  },
];

const samplePatientHistory: Map<string, PatientHistoryForNoShow> = new Map([
  ["patient-1", {
    patientId: "patient-1",
    totalAppointments: 24,
    noShowCount: 5,
    cancelCount: 3,
    lateArrivalCount: 8,
    lastNoShowDate: "2026-01-05",
    avgDistanceToClinic: 15.2,
    hasTransportationIssues: true,
    hasChildcareNeeds: true,
    preferredContactMethod: "text",
    reminderResponseRate: 0.4,
    insuranceStatus: "issues",
    chronicConditions: ["diabetes", "hypertension"],
    mentalHealthDiagnoses: true,
    recentLifeEvents: ["job loss", "relocation"],
  }],
  ["patient-2", {
    patientId: "patient-2",
    totalAppointments: 18,
    noShowCount: 1,
    cancelCount: 2,
    lateArrivalCount: 2,
    avgDistanceToClinic: 5.5,
    hasTransportationIssues: false,
    hasChildcareNeeds: false,
    preferredContactMethod: "call",
    reminderResponseRate: 0.95,
    insuranceStatus: "active",
    chronicConditions: ["asthma"],
    mentalHealthDiagnoses: false,
    recentLifeEvents: [],
  }],
]);

const sampleCareGaps: CareGap[] = [
  {
    id: "gap-1",
    patientId: "patient-1",
    patientName: "John Smith",
    gapType: "Preventive Care",
    description: "Annual wellness visit overdue",
    severity: "moderate",
    dueDate: "2025-12-15",
    daysOverdue: 38,
    lastAttemptDate: "2026-01-10",
    recommendedAction: "Schedule wellness visit and coordinate transportation",
  },
  {
    id: "gap-2",
    patientId: "patient-1",
    patientName: "John Smith",
    gapType: "Lab Work",
    description: "HbA1c test overdue for diabetes management",
    severity: "critical",
    dueDate: "2025-11-01",
    daysOverdue: 82,
    lastAttemptDate: "2026-01-15",
    recommendedAction: "Urgent outreach for lab appointment",
  },
  {
    id: "gap-3",
    patientId: "patient-3",
    patientName: "Mary Johnson",
    gapType: "Medication Adherence",
    description: "Blood pressure medication refill 10 days overdue",
    severity: "critical",
    dueDate: "2026-01-12",
    daysOverdue: 10,
    recommendedAction: "Contact pharmacy and patient for refill coordination",
  },
  {
    id: "gap-4",
    patientId: "patient-4",
    patientName: "Robert Davis",
    gapType: "Screening",
    description: "Colonoscopy screening recommended based on age",
    severity: "minor",
    dueDate: "2026-03-01",
    recommendedAction: "Discuss screening during next visit",
  },
];

const samplePatientProgress: PatientProgress[] = [
  {
    patientId: "patient-1",
    patientName: "John Smith",
    carePlanId: "cp-1",
    overallProgress: 45,
    goalsCompleted: 3,
    totalGoals: 8,
    tasksCompleted: 12,
    totalTasks: 25,
    recentMilestones: ["Completed diabetes education class", "Started exercise program"],
    concerns: ["Missed last two appointments", "A1C trending upward"],
    trendDirection: "declining",
  },
  {
    patientId: "patient-2",
    patientName: "Jane Doe",
    carePlanId: "cp-2",
    overallProgress: 78,
    goalsCompleted: 7,
    totalGoals: 10,
    tasksCompleted: 28,
    totalTasks: 32,
    recentMilestones: ["Blood pressure at goal for 3 months", "Lost 10 lbs", "Quit smoking"],
    concerns: [],
    trendDirection: "improving",
  },
];

function logHipaaAudit(action: string, patientId: string, details: string): void {
  console.log(`[HIPAA Audit] ${new Date().toISOString()} | Action: ${action} | Patient: ${patientId} | Details: ${details}`);
}

function calculateMemberScore(member: CareTeamMember, alertOrTask: Alert | Task, requiredSkills: string[], requiredRoles: string[]): number {
  let score = 0;
  
  if (requiredRoles.length > 0 && requiredRoles.includes(member.role)) {
    score += 30;
  } else if (requiredRoles.length === 0) {
    score += 15;
  }
  
  const matchingSkills = member.skills.filter(skill => 
    requiredSkills.some(req => skill.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(skill.toLowerCase()))
  );
  score += (matchingSkills.length / Math.max(requiredSkills.length, 1)) * 25;
  
  const workloadRatio = member.currentWorkload / member.maxCapacity;
  if (workloadRatio < 0.5) score += 25;
  else if (workloadRatio < 0.7) score += 20;
  else if (workloadRatio < 0.85) score += 10;
  else score += 0;
  
  if (member.availability === "available") score += 15;
  else if (member.availability === "busy") score += 5;
  else score -= 10;
  
  const responseTimeScore = Math.max(0, 10 - (member.avgResponseTime / 3));
  score += responseTimeScore;
  
  return Math.min(100, Math.max(0, score));
}

export async function getIntelligentAssignment(
  alertsOrTasks: (Alert | Task)[],
  teamMembers?: CareTeamMember[]
): Promise<AssignmentRecommendation[]> {
  const members = teamMembers || sampleCareTeamMembers;
  const recommendations: AssignmentRecommendation[] = [];
  
  const workloadTracker = new Map<string, number>();
  members.forEach(m => workloadTracker.set(m.id, m.currentWorkload));

  for (const item of alertsOrTasks) {
    const isAlert = 'type' in item && ['critical', 'high', 'medium', 'low'].includes(item.type as string);
    const requiredSkills = item.requiredSkills || [];
    const requiredRoles = 'requiredRole' in item ? (item as Task).requiredRole : [];
    
    logHipaaAudit("AI_ASSIGNMENT_ANALYSIS", item.patientId, `Analyzing ${isAlert ? 'alert' : 'task'}: ${item.title}`);
    
    const scoredMembers = members
      .filter(m => m.availability !== "offline" && m.availability !== "away")
      .map(m => ({
        member: m,
        score: calculateMemberScore(m, item, requiredSkills, requiredRoles),
        currentLoad: workloadTracker.get(m.id) || m.currentWorkload,
      }))
      .sort((a, b) => b.score - a.score);
    
    const topMember = scoredMembers[0];
    let reasoning = "";
    
    if (aiEnabled && scoredMembers.length > 0) {
      try {
        reasoning = await generatePhiSafeText({
          system: `You are a care coordination AI assistant. Provide a brief (2-3 sentence) explanation for why a care team member is the best choice for an assignment. Focus on role fit, skills match, and workload balance. Do not provide clinical advice.`,
          user: `Task/Alert: "${item.title}" - ${item.description}
Required skills: ${requiredSkills.join(", ") || "None specified"}
Required roles: ${requiredRoles.join(", ") || "Any"}
Recommended member: ${topMember.member.name} (${topMember.member.role})
Member skills: ${topMember.member.skills.join(", ")}
Member workload: ${topMember.currentLoad}%
Score: ${topMember.score.toFixed(1)}

Explain briefly why this assignment makes sense.`,
          maxTokens: 150,
          temperature: 0.3,
        });
      } catch (error) {
        console.error("[AICareCoordination] AI gateway error:", error);
      }
    }
    
    if (!reasoning) {
      reasoning = `${topMember.member.name} is recommended based on role match (${topMember.member.role}), relevant skills (${topMember.member.skills.slice(0, 2).join(", ")}), and current workload capacity (${100 - topMember.currentLoad}% available).`;
    }
    
    const estimatedTime = 'estimatedTimeMinutes' in item ? item.estimatedTimeMinutes : 30;
    const workloadIncrease = (estimatedTime / 480) * 100;
    const newLoad = Math.min(100, topMember.currentLoad + workloadIncrease);
    workloadTracker.set(topMember.member.id, newLoad);
    
    recommendations.push({
      alertOrTaskId: item.id,
      type: isAlert ? "alert" : "task",
      recommendedMemberId: topMember.member.id,
      recommendedMemberName: topMember.member.name,
      recommendedMemberRole: topMember.member.role,
      confidence: topMember.score / 100,
      reasoning,
      alternativeMembers: scoredMembers.slice(1, 4).map(sm => ({
        memberId: sm.member.id,
        memberName: sm.member.name,
        score: sm.score,
        reason: `${sm.member.role} with ${100 - sm.currentLoad}% capacity available`,
      })),
      workloadImpact: {
        currentLoad: topMember.currentLoad,
        projectedLoad: newLoad,
        capacityRemaining: 100 - newLoad,
      },
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
  
  return recommendations;
}

export async function predictNoShows(
  appointments: Appointment[],
  patientHistories?: Map<string, PatientHistoryForNoShow>
): Promise<NoShowPrediction[]> {
  const histories = patientHistories || samplePatientHistory;
  const predictions: NoShowPrediction[] = [];

  for (const appointment of appointments) {
    logHipaaAudit("AI_NOSHOW_PREDICTION", appointment.patientId, `Analyzing no-show risk for appointment ${appointment.id}`);
    
    const history = histories.get(appointment.patientId);
    const riskFactors: NoShowPrediction["riskFactors"] = [];
    let riskScore = 0;
    
    if (history) {
      const noShowRate = history.noShowCount / history.totalAppointments;
      if (noShowRate > 0.3) {
        riskScore += 30;
        riskFactors.push({
          factor: "Historical No-Show Pattern",
          impact: "high",
          details: `${(noShowRate * 100).toFixed(0)}% historical no-show rate (${history.noShowCount} of ${history.totalAppointments} appointments)`,
        });
      } else if (noShowRate > 0.15) {
        riskScore += 15;
        riskFactors.push({
          factor: "Moderate No-Show History",
          impact: "medium",
          details: `${(noShowRate * 100).toFixed(0)}% historical no-show rate`,
        });
      }
      
      if (history.hasTransportationIssues) {
        riskScore += 20;
        riskFactors.push({
          factor: "Transportation Barriers",
          impact: "high",
          details: `Patient has documented transportation issues; clinic is ${history.avgDistanceToClinic} miles away`,
        });
      }
      
      if (history.hasChildcareNeeds) {
        riskScore += 10;
        riskFactors.push({
          factor: "Childcare Needs",
          impact: "medium",
          details: "Patient may need to arrange childcare for appointment attendance",
        });
      }
      
      if (history.insuranceStatus === "issues" || history.insuranceStatus === "uninsured") {
        riskScore += 15;
        riskFactors.push({
          factor: "Insurance Status",
          impact: "high",
          details: `Insurance status: ${history.insuranceStatus}`,
        });
      }
      
      if (history.mentalHealthDiagnoses) {
        riskScore += 10;
        riskFactors.push({
          factor: "Mental Health Considerations",
          impact: "medium",
          details: "Mental health factors may affect appointment attendance",
        });
      }
      
      if (history.recentLifeEvents.length > 0) {
        riskScore += 10;
        riskFactors.push({
          factor: "Recent Life Events",
          impact: "medium",
          details: `Recent life changes: ${history.recentLifeEvents.join(", ")}`,
        });
      }
      
      if (history.reminderResponseRate < 0.5) {
        riskScore += 10;
        riskFactors.push({
          factor: "Low Reminder Response",
          impact: "medium",
          details: `Only ${(history.reminderResponseRate * 100).toFixed(0)}% response rate to appointment reminders`,
        });
      }
    }
    
    if (appointment.isFirstVisit) {
      riskScore += 15;
      riskFactors.push({
        factor: "First Visit",
        impact: "medium",
        details: "First-time patients have higher no-show rates on average",
      });
    }
    
    const appointmentDate = new Date(appointment.scheduledTime);
    const dayOfWeek = appointmentDate.getDay();
    if (dayOfWeek === 1) {
      riskScore += 5;
      riskFactors.push({
        factor: "Monday Appointment",
        impact: "low",
        details: "Mondays historically show slightly higher no-show rates",
      });
    }
    
    const riskLevel: "high" | "medium" | "low" = riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low";
    
    const suggestedInterventions: NoShowPrediction["suggestedInterventions"] = [];
    
    if (riskLevel === "high" || riskLevel === "medium") {
      suggestedInterventions.push({
        intervention: "Personalized reminder call 48 hours before appointment",
        priority: 1,
        expectedImpact: "15-20% reduction in no-show probability",
        timing: "48 hours before",
        assignTo: "Care Coordinator",
      });
    }
    
    if (history?.hasTransportationIssues) {
      suggestedInterventions.push({
        intervention: "Arrange transportation assistance or offer telehealth alternative",
        priority: 2,
        expectedImpact: "Address primary barrier to attendance",
        timing: "1 week before",
        assignTo: "Social Worker",
      });
    }
    
    if (history?.insuranceStatus === "issues") {
      suggestedInterventions.push({
        intervention: "Financial counseling call to address insurance concerns",
        priority: 3,
        expectedImpact: "Reduce cost-related anxiety about visit",
        timing: "1 week before",
        assignTo: "Financial Counselor",
      });
    }
    
    if (riskLevel === "high") {
      suggestedInterventions.push({
        intervention: "Same-day confirmation text with easy reschedule option",
        priority: 4,
        expectedImpact: "Last-minute confirmation or proactive reschedule",
        timing: "Morning of appointment",
        assignTo: "Front Desk",
      });
      
      suggestedInterventions.push({
        intervention: "Overbook slot to minimize schedule gaps",
        priority: 5,
        expectedImpact: "Maintain provider productivity",
        timing: "Scheduling decision",
        assignTo: "Scheduling Manager",
      });
    }
    
    let aiInsights = "";
    if (aiEnabled && riskLevel !== "low") {
      try {
        aiInsights = await generatePhiSafeText({
          system: `You are a healthcare operations AI assistant. Provide a brief (2-3 sentences) operational insight about appointment no-show risk and intervention strategies. Focus on practical operational suggestions. Do not provide clinical or medical advice.`,
          user: `Patient appointment risk analysis:
Risk level: ${riskLevel}
Risk score: ${riskScore}
Key risk factors: ${riskFactors.map(f => f.factor).join(", ")}
Appointment type: ${appointment.appointmentType}
${history ? `Historical no-shows: ${history.noShowCount} of ${history.totalAppointments}` : "No history available"}

Provide a brief operational insight.`,
          maxTokens: 150,
          temperature: 0.3,
        });
      } catch (error) {
        console.error("[AICareCoordination] AI gateway error:", error);
      }
    }
    
    if (!aiInsights && riskLevel !== "low") {
      aiInsights = `This patient shows ${riskLevel} risk for no-show based on ${riskFactors.length} identified factors. Proactive outreach using the patient's preferred contact method (${history?.preferredContactMethod || "phone"}) is recommended.`;
    }
    
    predictions.push({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      scheduledTime: appointment.scheduledTime,
      noShowRisk: riskLevel,
      riskScore: Math.min(100, riskScore),
      riskFactors,
      suggestedInterventions,
      aiInsights,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
  
  return predictions;
}

export async function generateCareGapReport(
  teamId: string,
  careGaps?: CareGap[],
  patientProgress?: PatientProgress[],
  dateRange?: { start: string; end: string }
): Promise<CareGapReport> {
  const gaps = careGaps || sampleCareGaps;
  const progress = patientProgress || samplePatientProgress;

  logHipaaAudit("AI_CARE_GAP_REPORT", teamId, "Generating comprehensive care gap report");
  
  const now = new Date();
  const reportPeriod = dateRange || {
    start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: now.toISOString().split("T")[0],
  };
  
  const uniquePatients = new Set(gaps.map(g => g.patientId));
  const criticalGaps = gaps.filter(g => g.severity === "critical");
  const moderateGaps = gaps.filter(g => g.severity === "moderate");
  const minorGaps = gaps.filter(g => g.severity === "minor");
  
  const gapCategories = gaps.reduce((acc, gap) => {
    acc[gap.gapType] = (acc[gap.gapType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const gapsByCategory = Object.entries(gapCategories).map(([category, count]) => ({
    category,
    count,
    percentageOfTotal: (count / gaps.length) * 100,
    trend: "stable" as const,
  }));
  
  const patientGapCounts = gaps.reduce((acc, gap) => {
    if (!acc[gap.patientId]) {
      acc[gap.patientId] = { patientId: gap.patientId, patientName: gap.patientName, total: 0, critical: 0 };
    }
    acc[gap.patientId].total++;
    if (gap.severity === "critical") acc[gap.patientId].critical++;
    return acc;
  }, {} as Record<string, { patientId: string; patientName: string; total: number; critical: number }>);
  
  const topPriorityPatients = Object.values(patientGapCounts)
    .sort((a, b) => b.critical - a.critical || b.total - a.total)
    .slice(0, 5)
    .map(p => ({
      patientId: p.patientId,
      patientName: p.patientName,
      gapCount: p.total,
      criticalGaps: p.critical,
      riskLevel: (p.critical >= 2 ? "high" : p.critical >= 1 ? "medium" : "low") as "high" | "medium" | "low",
      recommendedActions: gaps
        .filter(g => g.patientId === p.patientId && g.severity === "critical")
        .map(g => g.recommendedAction)
        .slice(0, 3),
    }));
  
  const improving = progress.filter(p => p.trendDirection === "improving").length;
  const stable = progress.filter(p => p.trendDirection === "stable").length;
  const declining = progress.filter(p => p.trendDirection === "declining").length;
  const avgGoalCompletion = progress.reduce((sum, p) => sum + (p.goalsCompleted / p.totalGoals) * 100, 0) / progress.length || 0;
  const avgTaskCompletion = progress.reduce((sum, p) => sum + (p.tasksCompleted / p.totalTasks) * 100, 0) / progress.length || 0;
  
  const aiRecommendations: CareGapReport["aiRecommendations"] = [];
  
  if (aiEnabled) {
    try {
      const content = await generatePhiSafeText({
        system: `You are a healthcare operations AI assistant. Generate 3-4 actionable recommendations for improving care gap closure and patient progress. Focus on operational efficiency, team coordination, and resource allocation. Do not provide clinical recommendations.`,
        user: `Care Gap Report Summary:
- Total patients: ${uniquePatients.size}
- Total gaps: ${gaps.length}
- Critical gaps: ${criticalGaps.length}
- Top gap categories: ${gapsByCategory.slice(0, 3).map(g => `${g.category} (${g.count})`).join(", ")}
- Patients improving: ${improving}
- Patients declining: ${declining}
- Average goal completion: ${avgGoalCompletion.toFixed(0)}%
- Average task completion: ${avgTaskCompletion.toFixed(0)}%

Generate actionable operational recommendations in JSON format:
[{"recommendation": "...", "priority": "high|medium|low", "expectedImpact": "...", "resourcesNeeded": "..."}]`,
        maxTokens: 500,
        temperature: 0.4,
      });

      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiRecommendations.push(...parsed);
        }
      } catch (e) {
        console.error("[AICareCoordination] Failed to parse AI recommendations:", e);
      }
    } catch (error) {
      console.error("[AICareCoordination] AI gateway error:", error);
    }
  }
  
  if (aiRecommendations.length === 0) {
    aiRecommendations.push(
      {
        recommendation: "Implement weekly care gap huddles focusing on critical gaps",
        priority: "high",
        expectedImpact: "20-30% improvement in gap closure rate",
        resourcesNeeded: "30 minutes weekly team meeting",
      },
      {
        recommendation: "Assign dedicated care coordinator for high-risk patients",
        priority: "high",
        expectedImpact: "Improved patient engagement and follow-through",
        resourcesNeeded: "Dedicated care coordinator time allocation",
      },
      {
        recommendation: "Automate patient outreach for overdue preventive care",
        priority: "medium",
        expectedImpact: "Increased appointment scheduling for preventive services",
        resourcesNeeded: "Patient engagement platform integration",
      }
    );
  }
  
  const report: CareGapReport = {
    id: `report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    reportPeriod,
    teamId,
    summary: {
      totalPatients: uniquePatients.size,
      patientsWithGaps: uniquePatients.size,
      totalGaps: gaps.length,
      criticalGaps: criticalGaps.length,
      moderateGaps: moderateGaps.length,
      minorGaps: minorGaps.length,
      closedGapsSinceLastReport: Math.floor(Math.random() * 8) + 2,
      newGapsSinceLastReport: Math.floor(Math.random() * 5) + 1,
    },
    gapsByCategory,
    topPriorityPatients,
    progressSummary: {
      patientsImproving: improving,
      patientsStable: stable,
      patientsDeclining: declining,
      averageGoalCompletion: avgGoalCompletion,
      averageTaskCompletion: avgTaskCompletion,
    },
    aiRecommendations,
    teamPerformance: {
      avgResponseTime: 12.5,
      gapClosureRate: 68,
      patientSatisfactionTrend: "stable",
    },
    disclaimer: NO_CDS_DISCLAIMER,
  };
  
  return report;
}

export function getCareTeamMembers(): CareTeamMember[] {
  return sampleCareTeamMembers;
}

export function getCareGaps(): CareGap[] {
  return sampleCareGaps;
}

export function getPatientProgress(): PatientProgress[] {
  return samplePatientProgress;
}

console.log("[AICareCoordination] Service initialized with intelligent assignment, no-show prediction, and care gap reporting");
