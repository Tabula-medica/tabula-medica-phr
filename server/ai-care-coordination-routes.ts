import { Router, Request, Response } from "express";
import {
  getIntelligentAssignment,
  predictNoShows,
  generateCareGapReport,
  getCareTeamMembers,
  getCareGaps,
  getPatientProgress,
} from "./services/aiCareCoordinationService";

const router = Router();

function logHipaaAudit(action: string, userId: string, details: string): void {
  console.log(`[HIPAA Audit] ${new Date().toISOString()} | Action: ${action} | User: ${userId} | Details: ${details}`);
}

const ROUTES_NO_CDS_DISCLAIMER = "DISCLAIMER: This information is for care coordination and operational efficiency purposes only. It does not constitute clinical decision support and should not replace clinical judgment.";

router.get("/team-members", async (req: Request, res: Response) => {
  try {
    const { userId = "system" } = req.query;
    
    logHipaaAudit("AI_TEAM_MEMBERS_ACCESS", userId as string, "Fetching care team members for coordination");
    
    const members = getCareTeamMembers();
    res.json({
      success: true,
      members,
      count: members.length,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error fetching team members:", error);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

router.post("/intelligent-assignment", async (req: Request, res: Response) => {
  try {
    const { alertsOrTasks, teamMembers, userId = "system" } = req.body;
    
    if (!alertsOrTasks || !Array.isArray(alertsOrTasks) || alertsOrTasks.length === 0) {
      return res.status(400).json({ error: "alertsOrTasks array is required" });
    }
    
    logHipaaAudit("AI_ASSIGNMENT_REQUEST", userId, `Analyzing ${alertsOrTasks.length} items for intelligent assignment`);
    
    const recommendations = await getIntelligentAssignment(alertsOrTasks, teamMembers);
    
    logHipaaAudit("AI_ASSIGNMENT_COMPLETE", userId, `Generated ${recommendations.length} assignment recommendations`);
    
    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      generatedAt: new Date().toISOString(),
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error in intelligent assignment:", error);
    res.status(500).json({ error: "Failed to generate assignment recommendations" });
  }
});

router.post("/batch-assign", async (req: Request, res: Response) => {
  try {
    const { alertsOrTasks, teamMembers, autoAssign = false, userId = "system" } = req.body;
    
    if (!alertsOrTasks || !Array.isArray(alertsOrTasks)) {
      return res.status(400).json({ error: "alertsOrTasks array is required" });
    }
    
    logHipaaAudit("AI_BATCH_ASSIGNMENT", userId, `Processing batch assignment for ${alertsOrTasks.length} items`);
    
    const recommendations = await getIntelligentAssignment(alertsOrTasks, teamMembers);
    
    const assignments = recommendations.map(rec => ({
      itemId: rec.alertOrTaskId,
      itemType: rec.type,
      assignedTo: rec.recommendedMemberId,
      assignedToName: rec.recommendedMemberName,
      assignedToRole: rec.recommendedMemberRole,
      confidence: rec.confidence,
      status: autoAssign ? "assigned" : "pending_approval",
      assignedAt: autoAssign ? new Date().toISOString() : null,
      reasoning: rec.reasoning,
      workloadImpact: rec.workloadImpact,
    }));
    
    logHipaaAudit("AI_BATCH_ASSIGNMENT_COMPLETE", userId, `Created ${assignments.length} assignments (autoAssign: ${autoAssign})`);
    
    res.json({
      success: true,
      assignments,
      autoAssigned: autoAssign,
      pendingApproval: !autoAssign,
      generatedAt: new Date().toISOString(),
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error in batch assignment:", error);
    res.status(500).json({ error: "Failed to process batch assignment" });
  }
});

router.post("/predict-no-shows", async (req: Request, res: Response) => {
  try {
    const { appointments, userId = "system" } = req.body;
    
    if (!appointments || !Array.isArray(appointments) || appointments.length === 0) {
      return res.status(400).json({ error: "appointments array is required" });
    }
    
    logHipaaAudit("AI_NOSHOW_PREDICTION_REQUEST", userId, `Analyzing ${appointments.length} appointments for no-show risk`);
    
    const predictions = await predictNoShows(appointments);
    
    const summary = {
      total: predictions.length,
      highRisk: predictions.filter(p => p.noShowRisk === "high").length,
      mediumRisk: predictions.filter(p => p.noShowRisk === "medium").length,
      lowRisk: predictions.filter(p => p.noShowRisk === "low").length,
      interventionsNeeded: predictions.filter(p => p.suggestedInterventions.length > 0).length,
    };
    
    logHipaaAudit("AI_NOSHOW_PREDICTION_COMPLETE", userId, `Generated predictions: ${summary.highRisk} high risk, ${summary.mediumRisk} medium risk`);
    
    res.json({
      success: true,
      predictions,
      summary,
      generatedAt: new Date().toISOString(),
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error in no-show prediction:", error);
    res.status(500).json({ error: "Failed to generate no-show predictions" });
  }
});

router.get("/appointments/at-risk", async (req: Request, res: Response) => {
  try {
    const { days = 7, minRiskLevel = "medium", userId = "system" } = req.query;
    
    logHipaaAudit("AI_ATRISK_APPOINTMENTS_REQUEST", userId as string, `Fetching at-risk appointments for next ${days} days`);
    
    const now = new Date();
    const endDate = new Date(now.getTime() + Number(days) * 24 * 60 * 60 * 1000);
    
    const sampleAppointments = [
      {
        id: "appt-1",
        patientId: "patient-1",
        patientName: "John Smith",
        scheduledTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        appointmentType: "Follow-up",
        providerId: "provider-1",
        providerName: "Dr. Sarah Chen",
        duration: 30,
        isFirstVisit: false,
      },
      {
        id: "appt-2",
        patientId: "patient-2",
        patientName: "Jane Doe",
        scheduledTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        appointmentType: "Annual Physical",
        providerId: "provider-1",
        providerName: "Dr. Sarah Chen",
        duration: 60,
        isFirstVisit: false,
      },
      {
        id: "appt-3",
        patientId: "patient-3",
        patientName: "Robert Davis",
        scheduledTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        appointmentType: "New Patient",
        providerId: "provider-2",
        providerName: "Dr. Emily Park",
        duration: 45,
        isFirstVisit: true,
      },
    ];
    
    const predictions = await predictNoShows(sampleAppointments);
    
    const riskLevels = ["high", "medium", "low"];
    const minRiskIndex = riskLevels.indexOf(minRiskLevel as string);
    
    const atRiskAppointments = predictions
      .filter(p => riskLevels.indexOf(p.noShowRisk) <= minRiskIndex)
      .sort((a, b) => b.riskScore - a.riskScore);
    
    res.json({
      success: true,
      atRiskAppointments,
      dateRange: { start: now.toISOString(), end: endDate.toISOString() },
      count: atRiskAppointments.length,
      generatedAt: new Date().toISOString(),
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error fetching at-risk appointments:", error);
    res.status(500).json({ error: "Failed to fetch at-risk appointments" });
  }
});

router.get("/care-gaps", async (req: Request, res: Response) => {
  try {
    const { userId = "system" } = req.query;
    
    logHipaaAudit("AI_CARE_GAPS_ACCESS", userId as string, "Fetching care gap data for coordination");
    
    const gaps = getCareGaps();
    
    const summary = {
      total: gaps.length,
      critical: gaps.filter(g => g.severity === "critical").length,
      moderate: gaps.filter(g => g.severity === "moderate").length,
      minor: gaps.filter(g => g.severity === "minor").length,
      overdue: gaps.filter(g => g.daysOverdue && g.daysOverdue > 0).length,
    };
    
    res.json({
      success: true,
      gaps,
      summary,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error fetching care gaps:", error);
    res.status(500).json({ error: "Failed to fetch care gaps" });
  }
});

router.get("/patient-progress", async (req: Request, res: Response) => {
  try {
    const { userId = "system" } = req.query;
    
    logHipaaAudit("AI_PATIENT_PROGRESS_ACCESS", userId as string, "Fetching patient progress data for coordination");
    
    const progress = getPatientProgress();
    
    const summary = {
      total: progress.length,
      improving: progress.filter(p => p.trendDirection === "improving").length,
      stable: progress.filter(p => p.trendDirection === "stable").length,
      declining: progress.filter(p => p.trendDirection === "declining").length,
      avgGoalCompletion: progress.reduce((sum, p) => sum + (p.goalsCompleted / p.totalGoals) * 100, 0) / progress.length,
    };
    
    res.json({
      success: true,
      progress,
      summary,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error fetching patient progress:", error);
    res.status(500).json({ error: "Failed to fetch patient progress" });
  }
});

router.post("/care-gap-report", async (req: Request, res: Response) => {
  try {
    const { teamId, dateRange, userId = "system" } = req.body;
    
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }
    
    logHipaaAudit("AI_CARE_GAP_REPORT_REQUEST", userId, `Generating care gap report for team ${teamId}`);
    
    const report = await generateCareGapReport(teamId, undefined, undefined, dateRange);
    
    logHipaaAudit("AI_CARE_GAP_REPORT_COMPLETE", userId, `Report generated: ${report.summary.totalGaps} gaps, ${report.aiRecommendations.length} recommendations`);
    
    res.json({
      success: true,
      report,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error generating care gap report:", error);
    res.status(500).json({ error: "Failed to generate care gap report" });
  }
});

router.get("/care-gap-report/:teamId", async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate, userId = "system" } = req.query;
    
    logHipaaAudit("AI_CARE_GAP_REPORT_REQUEST", userId as string, `Generating care gap report for team ${teamId}`);
    
    const dateRange = startDate && endDate ? { start: startDate as string, end: endDate as string } : undefined;
    
    const report = await generateCareGapReport(teamId, undefined, undefined, dateRange);
    
    logHipaaAudit("AI_CARE_GAP_REPORT_COMPLETE", userId as string, `Report generated for team ${teamId}`);
    
    res.json({
      success: true,
      report,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error generating care gap report:", error);
    res.status(500).json({ error: "Failed to generate care gap report" });
  }
});

router.get("/dashboard-summary", async (req: Request, res: Response) => {
  try {
    const { teamId = "default-team", userId = "system" } = req.query;
    
    logHipaaAudit("AI_DASHBOARD_SUMMARY", userId as string, "Fetching AI care coordination dashboard summary");
    
    const members = getCareTeamMembers();
    const gaps = getCareGaps();
    const progress = getPatientProgress();
    
    const now = new Date();
    const sampleAppointments = [
      {
        id: "appt-1",
        patientId: "patient-1",
        patientName: "John Smith",
        scheduledTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        appointmentType: "Follow-up",
        providerId: "provider-1",
        providerName: "Dr. Sarah Chen",
        duration: 30,
        isFirstVisit: false,
      },
    ];
    
    const predictions = await predictNoShows(sampleAppointments);
    
    const dashboard = {
      teamOverview: {
        totalMembers: members.length,
        availableMembers: members.filter(m => m.availability === "available").length,
        avgWorkload: members.reduce((sum, m) => sum + m.currentWorkload, 0) / members.length,
        totalPendingTasks: members.reduce((sum, m) => sum + m.pendingTasks, 0),
      },
      careGapOverview: {
        totalGaps: gaps.length,
        criticalGaps: gaps.filter(g => g.severity === "critical").length,
        overdueGaps: gaps.filter(g => g.daysOverdue && g.daysOverdue > 0).length,
        uniquePatientsWithGaps: new Set(gaps.map(g => g.patientId)).size,
      },
      patientProgress: {
        improving: progress.filter(p => p.trendDirection === "improving").length,
        stable: progress.filter(p => p.trendDirection === "stable").length,
        declining: progress.filter(p => p.trendDirection === "declining").length,
        avgGoalCompletion: progress.reduce((sum, p) => sum + (p.goalsCompleted / p.totalGoals) * 100, 0) / progress.length,
      },
      appointmentRisk: {
        upcomingAppointments: sampleAppointments.length,
        highRisk: predictions.filter(p => p.noShowRisk === "high").length,
        mediumRisk: predictions.filter(p => p.noShowRisk === "medium").length,
        interventionsNeeded: predictions.filter(p => p.suggestedInterventions.length > 0).length,
      },
      recentActivity: [
        { type: "assignment", message: "AI assigned medication review to Nurse Rodriguez", time: "5 minutes ago" },
        { type: "prediction", message: "High no-show risk identified for John Smith", time: "12 minutes ago" },
        { type: "gap_closed", message: "Care gap closed: Annual wellness visit for Jane Doe", time: "1 hour ago" },
      ],
      disclaimer: "DISCLAIMER: This dashboard is for care coordination and operational efficiency purposes only. It does not constitute clinical decision support.",
    };
    
    res.json({
      success: true,
      dashboard,
      generatedAt: new Date().toISOString(),
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[AICareCoordination] Error fetching dashboard summary:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

router.post("/workload-optimization", async (req: Request, res: Response) => {
  try {
    const { teamMembers, userId = "system" } = req.body;
    
    logHipaaAudit("AI_WORKLOAD_OPTIMIZATION", userId, "Analyzing team workload for optimization");
    
    const members = teamMembers || getCareTeamMembers();
    
    const overloaded = members.filter((m: any) => m.currentWorkload > 85);
    const underutilized = members.filter((m: any) => m.currentWorkload < 40 && m.availability === "available");
    
    const recommendations = [];
    
    for (const overMember of overloaded) {
      const compatibleUnder = underutilized.filter((u: any) => 
        overMember.skills.some((s: string) => u.skills.includes(s))
      );
      
      if (compatibleUnder.length > 0) {
        recommendations.push({
          type: "task_redistribution",
          from: { id: overMember.id, name: overMember.name, workload: overMember.currentWorkload },
          to: { id: compatibleUnder[0].id, name: compatibleUnder[0].name, workload: compatibleUnder[0].currentWorkload },
          suggestedTasks: Math.min(3, overMember.pendingTasks),
          expectedImpact: "Balance workload across team members",
          priority: "high",
        });
      }
    }
    
    if (overloaded.length > members.length * 0.5) {
      recommendations.push({
        type: "capacity_alert",
        message: "More than 50% of team members are at high capacity",
        suggestion: "Consider redistributing tasks or adding temporary support",
        priority: "high",
      });
    }
    
    res.json({
      success: true,
      analysis: {
        totalMembers: members.length,
        overloaded: overloaded.length,
        underutilized: underutilized.length,
        avgWorkload: members.reduce((sum: number, m: any) => sum + m.currentWorkload, 0) / members.length,
      },
      recommendations,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[AICareCoordination] Error in workload optimization:", error);
    res.status(500).json({ error: "Failed to analyze workload optimization" });
  }
});

export default router;

console.log("[AICareCoordination] Routes module loaded");
