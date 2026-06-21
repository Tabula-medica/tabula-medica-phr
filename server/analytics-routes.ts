import { Router } from "express";
import { z } from "zod";
import { logPhiAccess } from "./security/hipaa-audit";
import { 
  insertAnalyticsEventSchema, 
  AnalyticsEvent, 
  SuccessMetrics,
} from "@shared/schema";

const router = Router();

// Mock data generators for analytics
function generateKPIData() {
  const now = new Date();
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (29 - i));
    return date.toISOString().split('T')[0];
  });

  return {
    appointmentMetrics: {
      totalScheduled: 1247,
      completed: 1089,
      noShows: 98,
      cancelled: 60,
      noShowRate: 7.9,
      noShowTrend: last30Days.map(date => ({
        date,
        rate: Math.round((5 + Math.random() * 8) * 10) / 10,
        count: Math.floor(2 + Math.random() * 6)
      }))
    },
    patientOutcomes: {
      improved: 412,
      stable: 287,
      declined: 34,
      improvementRate: 56.2,
      outcomeTrend: last30Days.map(date => ({
        date,
        improved: Math.floor(10 + Math.random() * 8),
        stable: Math.floor(6 + Math.random() * 6),
        declined: Math.floor(Math.random() * 3)
      }))
    },
    clinicianWorkload: {
      averagePatientsPerDay: 18.4,
      averageAppointmentDuration: 24,
      utilizationRate: 82.5,
      workloadByClinic: [
        { clinicianId: "dr-001", name: "Dr. Sarah Johnson", specialty: "Internal Medicine", patientsToday: 22, utilization: 95 },
        { clinicianId: "dr-002", name: "Dr. Michael Chen", specialty: "Cardiology", patientsToday: 16, utilization: 78 },
        { clinicianId: "dr-003", name: "Dr. Emily Rodriguez", specialty: "Endocrinology", patientsToday: 19, utilization: 88 },
        { clinicianId: "dr-004", name: "Dr. James Wilson", specialty: "Pulmonology", patientsToday: 14, utilization: 72 },
        { clinicianId: "dr-005", name: "Dr. Amanda Foster", specialty: "Neurology", patientsToday: 18, utilization: 85 }
      ],
      workloadTrend: last30Days.map(date => ({
        date,
        avgPatients: Math.round((16 + Math.random() * 6) * 10) / 10,
        utilization: Math.round((75 + Math.random() * 15) * 10) / 10
      }))
    },
    summary: {
      totalPatients: 3421,
      activePatients: 2847,
      newPatientsThisMonth: 156,
      averageSatisfaction: 4.6
    }
  };
}

function generateCohortData(filters: { condition?: string; ageRange?: string; treatment?: string; gender?: string }) {
  const conditions = ["Diabetes Type 2", "Hypertension", "Chronic Heart Failure", "COPD", "Asthma", "Chronic Kidney Disease"];
  const treatments = ["Medication Only", "Lifestyle Modification", "Combined Therapy", "Surgical Intervention", "Physical Therapy"];
  
  const basePatients = [
    { id: "p-001", age: 58, gender: "Male", condition: "Diabetes Type 2", treatment: "Combined Therapy", outcomeScore: 78, riskLevel: "medium" },
    { id: "p-002", age: 67, gender: "Female", condition: "Hypertension", treatment: "Medication Only", outcomeScore: 85, riskLevel: "low" },
    { id: "p-003", age: 45, gender: "Male", condition: "Diabetes Type 2", treatment: "Lifestyle Modification", outcomeScore: 72, riskLevel: "medium" },
    { id: "p-004", age: 72, gender: "Female", condition: "Chronic Heart Failure", treatment: "Combined Therapy", outcomeScore: 65, riskLevel: "high" },
    { id: "p-005", age: 38, gender: "Male", condition: "Asthma", treatment: "Medication Only", outcomeScore: 92, riskLevel: "low" },
    { id: "p-006", age: 55, gender: "Female", condition: "COPD", treatment: "Combined Therapy", outcomeScore: 68, riskLevel: "high" },
    { id: "p-007", age: 62, gender: "Male", condition: "Hypertension", treatment: "Lifestyle Modification", outcomeScore: 81, riskLevel: "low" },
    { id: "p-008", age: 49, gender: "Female", condition: "Diabetes Type 2", treatment: "Medication Only", outcomeScore: 75, riskLevel: "medium" },
    { id: "p-009", age: 71, gender: "Male", condition: "Chronic Kidney Disease", treatment: "Combined Therapy", outcomeScore: 58, riskLevel: "high" },
    { id: "p-010", age: 43, gender: "Female", condition: "Asthma", treatment: "Medication Only", outcomeScore: 89, riskLevel: "low" },
    { id: "p-011", age: 66, gender: "Male", condition: "COPD", treatment: "Physical Therapy", outcomeScore: 71, riskLevel: "medium" },
    { id: "p-012", age: 54, gender: "Female", condition: "Hypertension", treatment: "Combined Therapy", outcomeScore: 83, riskLevel: "low" },
    { id: "p-013", age: 78, gender: "Male", condition: "Chronic Heart Failure", treatment: "Medication Only", outcomeScore: 52, riskLevel: "high" },
    { id: "p-014", age: 35, gender: "Female", condition: "Diabetes Type 2", treatment: "Lifestyle Modification", outcomeScore: 88, riskLevel: "low" },
    { id: "p-015", age: 61, gender: "Male", condition: "Chronic Kidney Disease", treatment: "Combined Therapy", outcomeScore: 64, riskLevel: "high" }
  ];

  let filteredPatients = [...basePatients];

  if (filters.condition && filters.condition !== "all") {
    filteredPatients = filteredPatients.filter(p => p.condition === filters.condition);
  }
  if (filters.treatment && filters.treatment !== "all") {
    filteredPatients = filteredPatients.filter(p => p.treatment === filters.treatment);
  }
  if (filters.gender && filters.gender !== "all") {
    filteredPatients = filteredPatients.filter(p => p.gender === filters.gender);
  }
  if (filters.ageRange && filters.ageRange !== "all") {
    const [min, max] = filters.ageRange.split("-").map(Number);
    filteredPatients = filteredPatients.filter(p => p.age >= min && p.age <= max);
  }

  const cohortStats = {
    totalPatients: filteredPatients.length,
    averageAge: filteredPatients.length > 0 
      ? Math.round(filteredPatients.reduce((sum, p) => sum + p.age, 0) / filteredPatients.length * 10) / 10 
      : 0,
    averageOutcomeScore: filteredPatients.length > 0 
      ? Math.round(filteredPatients.reduce((sum, p) => sum + p.outcomeScore, 0) / filteredPatients.length * 10) / 10 
      : 0,
    riskDistribution: {
      low: filteredPatients.filter(p => p.riskLevel === "low").length,
      medium: filteredPatients.filter(p => p.riskLevel === "medium").length,
      high: filteredPatients.filter(p => p.riskLevel === "high").length
    },
    genderDistribution: {
      male: filteredPatients.filter(p => p.gender === "Male").length,
      female: filteredPatients.filter(p => p.gender === "Female").length
    },
    conditionBreakdown: conditions.map(c => ({
      condition: c,
      count: filteredPatients.filter(p => p.condition === c).length
    })).filter(c => c.count > 0),
    treatmentBreakdown: treatments.map(t => ({
      treatment: t,
      count: filteredPatients.filter(p => p.treatment === t).length
    })).filter(t => t.count > 0)
  };

  return {
    patients: filteredPatients,
    stats: cohortStats,
    availableFilters: {
      conditions,
      treatments,
      ageRanges: ["18-30", "31-45", "46-60", "61-75", "76+"],
      genders: ["Male", "Female"]
    }
  };
}

function generateReportData(reportType: string, dateRange: string) {
  const now = new Date();
  const reportId = `RPT-${Date.now()}`;
  
  const baseReport = {
    id: reportId,
    type: reportType,
    generatedAt: now.toISOString(),
    dateRange,
    generatedBy: "System Administrator"
  };

  switch (reportType) {
    case "patient-outcomes":
      return {
        ...baseReport,
        title: "Patient Outcomes Summary Report",
        sections: [
          {
            title: "Overall Outcomes",
            metrics: [
              { label: "Total Patients Tracked", value: 2847, trend: "+12%" },
              { label: "Improvement Rate", value: "56.2%", trend: "+3.4%" },
              { label: "Average Outcome Score", value: 76.8, trend: "+2.1" },
              { label: "High-Risk Patients", value: 234, trend: "-8%" }
            ]
          },
          {
            title: "By Condition",
            data: [
              { condition: "Diabetes Type 2", patients: 487, improvementRate: 52.3 },
              { condition: "Hypertension", patients: 623, improvementRate: 61.8 },
              { condition: "Chronic Heart Failure", patients: 189, improvementRate: 45.2 },
              { condition: "COPD", patients: 234, improvementRate: 48.7 },
              { condition: "Asthma", patients: 412, improvementRate: 72.4 }
            ]
          }
        ]
      };
    case "clinician-performance":
      return {
        ...baseReport,
        title: "Clinician Performance Report",
        sections: [
          {
            title: "Department Overview",
            metrics: [
              { label: "Active Clinicians", value: 42, trend: "+2" },
              { label: "Avg. Patients Per Day", value: 18.4, trend: "+1.2" },
              { label: "Avg. Patient Satisfaction", value: 4.6, trend: "+0.2" },
              { label: "On-Time Appointment Rate", value: "87%", trend: "+5%" }
            ]
          },
          {
            title: "Top Performers",
            data: [
              { name: "Dr. Sarah Johnson", specialty: "Internal Medicine", satisfaction: 4.9, patients: 412 },
              { name: "Dr. Emily Rodriguez", specialty: "Endocrinology", satisfaction: 4.8, patients: 387 },
              { name: "Dr. Amanda Foster", specialty: "Neurology", satisfaction: 4.7, patients: 298 }
            ]
          }
        ]
      };
    case "appointment-analytics":
      return {
        ...baseReport,
        title: "Appointment Analytics Report",
        sections: [
          {
            title: "Scheduling Metrics",
            metrics: [
              { label: "Total Appointments", value: 1247, trend: "+8%" },
              { label: "Completion Rate", value: "87.3%", trend: "+2.1%" },
              { label: "No-Show Rate", value: "7.9%", trend: "-1.2%" },
              { label: "Cancellation Rate", value: "4.8%", trend: "-0.5%" }
            ]
          },
          {
            title: "By Day of Week",
            data: [
              { day: "Monday", scheduled: 245, completed: 218, noShow: 18 },
              { day: "Tuesday", scheduled: 267, completed: 241, noShow: 16 },
              { day: "Wednesday", scheduled: 258, completed: 225, noShow: 22 },
              { day: "Thursday", scheduled: 251, completed: 219, noShow: 21 },
              { day: "Friday", scheduled: 226, completed: 186, noShow: 21 }
            ]
          }
        ]
      };
    case "population-health":
      return {
        ...baseReport,
        title: "Population Health Report",
        sections: [
          {
            title: "Demographics",
            metrics: [
              { label: "Total Population", value: 3421, trend: "+156" },
              { label: "Average Age", value: 54.2, trend: "-0.3" },
              { label: "Chronic Conditions", value: 67.4, trend: "+1.2%" },
              { label: "Preventive Care Compliance", value: "72%", trend: "+4%" }
            ]
          },
          {
            title: "Health Risk Distribution",
            data: [
              { category: "Low Risk", count: 1842, percentage: 53.8 },
              { category: "Medium Risk", count: 1087, percentage: 31.8 },
              { category: "High Risk", count: 492, percentage: 14.4 }
            ]
          }
        ]
      };
    default:
      return {
        ...baseReport,
        title: "Custom Report",
        sections: []
      };
  }
}

// KPI Dashboard endpoint
router.get("/kpis", async (req, res) => {
  await logPhiAccess({
    action: "read",
    resourceType: "Analytics",
    userId: "admin-user",
    details: "Accessed KPI analytics dashboard"
  });

  const kpiData = generateKPIData();
  res.json(kpiData);
});

// Cohort Analysis endpoint
router.get("/cohorts", async (req, res) => {
  const { condition, ageRange, treatment, gender } = req.query;
  
  await logPhiAccess({
    action: "read",
    resourceType: "CohortAnalysis",
    userId: "admin-user",
    details: `Cohort analysis with filters: ${JSON.stringify(req.query)}`
  });

  const cohortData = generateCohortData({
    condition: condition as string,
    ageRange: ageRange as string,
    treatment: treatment as string,
    gender: gender as string
  });
  res.json(cohortData);
});

// Available report types
router.get("/reports/types", async (req, res) => {
  await logPhiAccess({
    action: "read",
    resourceType: "ReportTypes",
    userId: "admin-user",
    details: "Accessed available report types"
  });

  res.json([
    { id: "patient-outcomes", name: "Patient Outcomes Summary", description: "Overview of patient health outcomes and trends" },
    { id: "clinician-performance", name: "Clinician Performance", description: "Staff productivity and satisfaction metrics" },
    { id: "appointment-analytics", name: "Appointment Analytics", description: "Scheduling efficiency and no-show analysis" },
    { id: "population-health", name: "Population Health", description: "Demographics and health risk distribution" }
  ]);
});

// Generate report endpoint
router.post("/reports/generate", async (req, res) => {
  const { reportType, dateRange } = req.body;

  if (!reportType) {
    return res.status(400).json({ error: "Report type is required" });
  }

  await logPhiAccess({
    action: "read",
    resourceType: "Report",
    userId: "admin-user",
    details: `Generated ${reportType} report for date range: ${dateRange || "last 30 days"}`
  });

  const report = generateReportData(reportType, dateRange || "last-30-days");
  res.json(report);
});

// Clinician workload details
router.get("/workload/:clinicianId", async (req, res) => {
  const { clinicianId } = req.params;
  
  await logPhiAccess({
    action: "read",
    resourceType: "ClinicianWorkload",
    userId: "admin-user",
    details: `Viewed workload details for clinician ${clinicianId}`
  });

  const workloadDetails = {
    clinicianId,
    todaySchedule: [
      { time: "09:00", patient: "Patient A", type: "Follow-up", status: "completed" },
      { time: "09:30", patient: "Patient B", type: "New Patient", status: "completed" },
      { time: "10:00", patient: "Patient C", type: "Consultation", status: "in-progress" },
      { time: "10:30", patient: "Patient D", type: "Follow-up", status: "scheduled" },
      { time: "11:00", patient: "Patient E", type: "Annual Exam", status: "scheduled" }
    ],
    weeklyStats: {
      totalPatients: 87,
      avgPerDay: 17.4,
      noShows: 3,
      cancellations: 5
    }
  };

  res.json(workloadDetails);
});

// ============================================
// SUCCESS METRICS TRACKING
// ============================================

const analyticsEvents: AnalyticsEvent[] = [];

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Log generic analytics event
router.post("/events", async (req, res) => {
  try {
    const validated = insertAnalyticsEventSchema.parse(req.body);
    
    const event: AnalyticsEvent = {
      id: generateEventId(),
      eventType: validated.eventType,
      userId: validated.userId,
      profileId: validated.profileId ?? null,
      metadata: validated.metadata ?? {},
      durationMs: validated.durationMs ?? null,
      createdAt: new Date().toISOString(),
    };
    
    analyticsEvents.push(event);
    
    console.log(`[Analytics] ${event.eventType} by user ${event.userId}`);
    
    res.json({ success: true, eventId: event.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid event data", details: error.errors });
    }
    console.error("[Analytics] Error logging event:", error);
    res.status(500).json({ error: "Failed to log event" });
  }
});

// Track packet export start time
router.post("/packet-export/start", async (req, res) => {
  try {
    const { userId, profileId, packetType } = req.body;
    
    const event: AnalyticsEvent = {
      id: generateEventId(),
      eventType: "packet_export_started",
      userId,
      profileId: profileId ?? null,
      metadata: { packetType, startTime: Date.now() },
      durationMs: null,
      createdAt: new Date().toISOString(),
    };
    
    analyticsEvents.push(event);
    
    res.json({ success: true, trackingId: event.id, startTime: event.metadata.startTime });
  } catch (error) {
    console.error("[Analytics] Error starting packet export tracking:", error);
    res.status(500).json({ error: "Failed to start tracking" });
  }
});

// Track packet export completion with duration
router.post("/packet-export/complete", async (req, res) => {
  try {
    const { userId, profileId, packetType, trackingId, startTime } = req.body;
    
    const durationMs = Date.now() - startTime;
    
    const event: AnalyticsEvent = {
      id: generateEventId(),
      eventType: "packet_export_completed",
      userId,
      profileId: profileId ?? null,
      metadata: { packetType, trackingId, durationMs },
      durationMs,
      createdAt: new Date().toISOString(),
    };
    
    analyticsEvents.push(event);
    
    const isUnder15Seconds = durationMs < 15000;
    
    res.json({ 
      success: true, 
      durationMs,
      meetsTarget: isUnder15Seconds,
      targetMs: 15000,
    });
  } catch (error) {
    console.error("[Analytics] Error completing packet export tracking:", error);
    res.status(500).json({ error: "Failed to complete tracking" });
  }
});

// Track auto-folder accuracy
router.post("/document/auto-folder", async (req, res) => {
  try {
    const { userId, profileId, documentId, suggestedFolder, wasAccepted, correctedFolder } = req.body;
    
    const eventType = wasAccepted ? "document_auto_folder_suggested" : "document_folder_corrected";
    
    const event: AnalyticsEvent = {
      id: generateEventId(),
      eventType,
      userId,
      profileId: profileId ?? null,
      metadata: { 
        documentId, 
        suggestedFolder, 
        wasAccepted,
        correctedFolder: correctedFolder ?? null,
      },
      durationMs: null,
      createdAt: new Date().toISOString(),
    };
    
    analyticsEvents.push(event);
    
    res.json({ success: true, eventId: event.id });
  } catch (error) {
    console.error("[Analytics] Error logging folder suggestion:", error);
    res.status(500).json({ error: "Failed to log folder suggestion" });
  }
});

// Track survivorship follow-up events
router.post("/survivorship/followup", async (req, res) => {
  try {
    const { userId, profileId, followUpId, status, followUpName } = req.body;
    
    const eventTypeMap: Record<string, "survivorship_followup_scheduled" | "survivorship_followup_completed" | "survivorship_followup_missed"> = {
      scheduled: "survivorship_followup_scheduled",
      completed: "survivorship_followup_completed",
      missed: "survivorship_followup_missed",
    };
    
    const eventType = eventTypeMap[status];
    if (!eventType) {
      return res.status(400).json({ error: "Invalid status. Use: scheduled, completed, or missed" });
    }
    
    const event: AnalyticsEvent = {
      id: generateEventId(),
      eventType,
      userId,
      profileId: profileId ?? null,
      metadata: { followUpId, followUpName, status },
      durationMs: null,
      createdAt: new Date().toISOString(),
    };
    
    analyticsEvents.push(event);
    
    res.json({ success: true, eventId: event.id });
  } catch (error) {
    console.error("[Analytics] Error logging survivorship followup:", error);
    res.status(500).json({ error: "Failed to log followup event" });
  }
});

// Get success metrics dashboard
router.get("/success-metrics", async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentEvents = analyticsEvents.filter(
      e => new Date(e.createdAt) >= thirtyDaysAgo
    );
    
    // Avg ER packet export time (target: <15 seconds)
    const packetExports = recentEvents.filter(e => e.eventType === "packet_export_completed");
    const avgPacketExportTimeMs = packetExports.length > 0
      ? packetExports.reduce((sum, e) => sum + (e.durationMs || 0), 0) / packetExports.length
      : 0;
    
    // Auto-folder accuracy (target: >80%)
    const folderSuggestions = recentEvents.filter(
      e => e.eventType === "document_auto_folder_suggested"
    ).length;
    const folderCorrections = recentEvents.filter(
      e => e.eventType === "document_folder_corrected"
    ).length;
    const totalFolderEvents = folderSuggestions + folderCorrections;
    const autoFolderAccuracyPercent = totalFolderEvents > 0
      ? (folderSuggestions / totalFolderEvents) * 100
      : 0;
    
    // Users with multiple profiles (family use tracking)
    const uniqueUsers = new Set(recentEvents.map(e => e.userId));
    const totalUsers = uniqueUsers.size || 1;
    
    const userProfiles = new Map<string, Set<string>>();
    recentEvents.forEach(e => {
      if (e.profileId) {
        if (!userProfiles.has(e.userId)) {
          userProfiles.set(e.userId, new Set());
        }
        userProfiles.get(e.userId)!.add(e.profileId);
      }
    });
    
    const usersWithMultipleProfiles = Array.from(userProfiles.values())
      .filter(profiles => profiles.size >= 2).length;
    const multiProfilePercent = (usersWithMultipleProfiles / totalUsers) * 100;
    
    // Packet exports per user per month
    const packetExportsPerUserPerMonth = packetExports.length / totalUsers;
    
    // Survivorship follow-up adherence
    const followUpScheduled = recentEvents.filter(
      e => e.eventType === "survivorship_followup_scheduled"
    ).length;
    const followUpCompleted = recentEvents.filter(
      e => e.eventType === "survivorship_followup_completed"
    ).length;
    const survivorshipAdherencePercent = followUpScheduled > 0
      ? (followUpCompleted / followUpScheduled) * 100
      : 0;
    
    const metrics: SuccessMetrics = {
      avgPacketExportTimeMs: Math.round(avgPacketExportTimeMs),
      autoFolderAccuracyPercent: Math.round(autoFolderAccuracyPercent * 10) / 10,
      usersWithMultipleProfiles,
      totalUsers,
      multiProfilePercent: Math.round(multiProfilePercent * 10) / 10,
      packetExportsPerUserPerMonth: Math.round(packetExportsPerUserPerMonth * 10) / 10,
      survivorshipAdherencePercent: Math.round(survivorshipAdherencePercent * 10) / 10,
      periodStart: thirtyDaysAgo.toISOString(),
      periodEnd: now.toISOString(),
    };
    
    res.json(metrics);
  } catch (error) {
    console.error("[Analytics] Error calculating metrics:", error);
    res.status(500).json({ error: "Failed to calculate metrics" });
  }
});

// ============================================
// AUDIT LOG FOR EXPORTS AND SHARES
// ============================================

interface AuditLogEntry {
  id: string;
  userId: string;
  profileId: string;
  action: "export" | "share" | "share_access" | "share_revoke";
  resourceType: "packet" | "document" | "profile" | "health_record";
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const auditLogs: AuditLogEntry[] = [];

function generateAuditId(): string {
  return `aud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Log export action
router.post("/audit/export", async (req, res) => {
  try {
    const { userId, profileId, resourceType, resourceId, exportFormat, includeAttachments } = req.body;
    
    if (!userId || !profileId || !resourceType || !resourceId) {
      return res.status(400).json({ error: "Missing required fields: userId, profileId, resourceType, resourceId" });
    }
    
    const entry: AuditLogEntry = {
      id: generateAuditId(),
      userId,
      profileId,
      action: "export",
      resourceType,
      resourceId,
      details: {
        exportFormat: exportFormat || "pdf",
        includeAttachments: includeAttachments || false,
        exportedAt: new Date().toISOString(),
      },
      ipAddress: req.ip || null,
      userAgent: req.get("User-Agent") || null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
    };
    
    auditLogs.push(entry);
    
    await logPhiAccess({
      action: "export",
      resourceType: resourceType as "Patient" | "Analytics" | "Document",
      userId,
      details: `Exported ${resourceType} ${resourceId} for profile ${profileId}`,
    });
    
    console.log(`[Audit] Export: ${userId} exported ${resourceType} ${resourceId}`);
    
    res.json({ success: true, auditId: entry.id });
  } catch (error) {
    console.error("[Audit] Error logging export:", error);
    res.status(500).json({ error: "Failed to log export" });
  }
});

// Log share creation (with time-limited expiration)
router.post("/audit/share", async (req, res) => {
  try {
    const { userId, profileId, resourceType, resourceId, recipientEmail, recipientName, accessScopes, expiresInHours } = req.body;
    
    if (!userId || !profileId || !resourceType || !resourceId) {
      return res.status(400).json({ error: "Missing required fields: userId, profileId, resourceType, resourceId" });
    }
    
    // Enforce time-limited shares (default 72 hours, max 7 days)
    const maxHours = 7 * 24;
    const hours = Math.min(expiresInHours || 72, maxHours);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    
    const entry: AuditLogEntry = {
      id: generateAuditId(),
      userId,
      profileId,
      action: "share",
      resourceType,
      resourceId,
      details: {
        recipientEmail: recipientEmail || null,
        recipientName: recipientName || null,
        accessScopes: accessScopes || ["view"],
        expiresInHours: hours,
        sharedAt: new Date().toISOString(),
      },
      ipAddress: req.ip || null,
      userAgent: req.get("User-Agent") || null,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    
    auditLogs.push(entry);
    
    await logPhiAccess({
      action: "share",
      resourceType: resourceType as "Patient" | "Analytics" | "Document",
      userId,
      details: `Shared ${resourceType} ${resourceId} with ${recipientEmail || "link"}, expires: ${expiresAt}`,
    });
    
    console.log(`[Audit] Share: ${userId} shared ${resourceType} ${resourceId}, expires: ${expiresAt}`);
    
    res.json({ 
      success: true, 
      auditId: entry.id,
      expiresAt,
      message: `Share link expires in ${hours} hours`,
    });
  } catch (error) {
    console.error("[Audit] Error logging share:", error);
    res.status(500).json({ error: "Failed to log share" });
  }
});

// Log share access
router.post("/audit/share-access", async (req, res) => {
  try {
    const { shareId, accessedBy, profileId, resourceType, resourceId } = req.body;
    
    if (!shareId || !profileId || !resourceType || !resourceId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const entry: AuditLogEntry = {
      id: generateAuditId(),
      userId: accessedBy || "anonymous",
      profileId,
      action: "share_access",
      resourceType,
      resourceId,
      details: {
        shareId,
        accessedAt: new Date().toISOString(),
      },
      ipAddress: req.ip || null,
      userAgent: req.get("User-Agent") || null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
    };
    
    auditLogs.push(entry);
    
    console.log(`[Audit] Share Access: ${shareId} accessed for ${resourceType} ${resourceId}`);
    
    res.json({ success: true, auditId: entry.id });
  } catch (error) {
    console.error("[Audit] Error logging share access:", error);
    res.status(500).json({ error: "Failed to log share access" });
  }
});

// Log share revocation
router.post("/audit/share-revoke", async (req, res) => {
  try {
    const { userId, profileId, shareId, resourceType, resourceId, reason } = req.body;
    
    if (!userId || !profileId || !shareId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const entry: AuditLogEntry = {
      id: generateAuditId(),
      userId,
      profileId,
      action: "share_revoke",
      resourceType: resourceType || "profile",
      resourceId: resourceId || shareId,
      details: {
        shareId,
        reason: reason || "User requested revocation",
        revokedAt: new Date().toISOString(),
      },
      ipAddress: req.ip || null,
      userAgent: req.get("User-Agent") || null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
    };
    
    auditLogs.push(entry);
    
    console.log(`[Audit] Share Revoked: ${userId} revoked share ${shareId}`);
    
    res.json({ success: true, auditId: entry.id });
  } catch (error) {
    console.error("[Audit] Error logging share revocation:", error);
    res.status(500).json({ error: "Failed to log share revocation" });
  }
});

// Get audit logs for a profile
router.get("/audit/logs/:profileId", async (req, res) => {
  try {
    const { profileId } = req.params;
    const { action, limit = 50 } = req.query;
    
    let logs = auditLogs.filter(l => l.profileId === profileId);
    
    if (action) {
      logs = logs.filter(l => l.action === action);
    }
    
    logs = logs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Number(limit));
    
    res.json({ logs, total: logs.length });
  } catch (error) {
    console.error("[Audit] Error fetching logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// Get raw analytics events for debugging
router.get("/events", async (req, res) => {
  try {
    const { eventType, userId, limit = 100 } = req.query;
    
    let filtered = analyticsEvents;
    
    if (eventType) {
      filtered = filtered.filter(e => e.eventType === eventType);
    }
    if (userId) {
      filtered = filtered.filter(e => e.userId === userId);
    }
    
    const sorted = filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    res.json({
      events: sorted.slice(0, Number(limit)),
      total: filtered.length,
    });
  } catch (error) {
    console.error("[Analytics] Error fetching events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

export default router;
