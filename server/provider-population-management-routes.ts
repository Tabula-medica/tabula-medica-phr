import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "./db";
import {
  vitalSignsTable,
  monitoringAlertsTable,
  healthGoalsTable,
  goalProgressTable,
  medicationAdherenceLogsTable,
  medicationInteractionFlagsTable,
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql, inArray, or, isNull, not } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

const NO_CDS_DISCLAIMER = "This information is for educational purposes only. It is not intended to replace professional clinical judgment. All care decisions should be made by qualified healthcare providers in consultation with their patients.";

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const sanitized = { ...details };
  console.log(`[HIPAA-AUDIT][PopulationMgmt] ${timestamp} - ${action} -`, JSON.stringify(sanitized));
}

function requireProviderAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  const isProvider = (req.session as any)?.isProvider || (req.session as any)?.role === "provider";
  
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", { path: req.path });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  
  (req as any).providerId = sessionUserId;
  (req as any).isProvider = isProvider;
  next();
}

interface PatientSummary {
  patientId: string;
  displayName: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  pendingAlerts: number;
  criticalAlerts: number;
  overdueGoals: number;
  lastVitalDate: string | null;
  medicationAdherence: number;
  followUpNeeded: boolean;
  followUpReasons: string[];
  assignedTeamMember: string | null;
  lastContactDate: string | null;
}

interface TeamTask {
  id: string;
  patientId: string;
  patientName: string;
  assignedTo: string;
  assignedBy: string;
  taskType: "follow_up" | "review_alert" | "care_plan" | "medication_review" | "lab_review" | "documentation" | "other";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
  notes: string | null;
}

const teamTasksStore: Map<string, TeamTask> = new Map();
const patientAssignmentsStore: Map<string, { providerId: string; teamMemberId: string; assignedAt: string }> = new Map();

/**
 * DEVELOPMENT STUB: Generate sample patient data for samplenstration.
 * 
 * In production, this function would be replaced with real database queries:
 * 1. Query monitoringAlertsTable for patients with unacknowledged critical/high alerts
 * 2. Query healthGoalsTable for patients with overdue goals (dueDate < now)
 * 3. Query medicationAdherenceLogsTable for patients with low adherence rates
 * 4. Query vitalSignsTable for patients with no recent vitals (>7 days)
 * 
 * Example real implementation:
 * - const criticalAlerts = await db.select().from(monitoringAlertsTable).where(
 *     and(eq(monitoringAlertsTable.acknowledged, false), eq(monitoringAlertsTable.severity, 'critical'))
 *   );
 * - Aggregate patient IDs from all sources and compute risk scores
 */
function generateSamplePatients(): PatientSummary[] {
  const names = [
    "Maria Garcia", "John Smith", "Sarah Johnson", "Robert Williams", 
    "Patricia Brown", "James Davis", "Elizabeth Miller", "Michael Wilson",
    "Jennifer Moore", "William Taylor", "Linda Anderson", "David Thomas"
  ];
  
  return names.map((name, idx) => {
    const riskLevel = idx < 2 ? "critical" : idx < 5 ? "high" : idx < 8 ? "medium" : "low";
    const criticalAlerts = riskLevel === "critical" ? Math.floor(Math.random() * 3) + 1 : 0;
    const pendingAlerts = criticalAlerts + Math.floor(Math.random() * 5);
    const overdueGoals = riskLevel === "critical" || riskLevel === "high" ? Math.floor(Math.random() * 3) : 0;
    
    const followUpReasons: string[] = [];
    if (criticalAlerts > 0) followUpReasons.push("Critical vital sign alert");
    if (overdueGoals > 0) followUpReasons.push("Overdue health goals");
    if (Math.random() > 0.7) followUpReasons.push("Missed appointment");
    if (Math.random() > 0.8) followUpReasons.push("Medication interaction flagged");
    if (Math.random() > 0.75) followUpReasons.push("Low medication adherence");
    
    return {
      patientId: `patient-${String(idx + 1).padStart(3, "0")}`,
      displayName: name,
      riskLevel,
      pendingAlerts,
      criticalAlerts,
      overdueGoals,
      lastVitalDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      medicationAdherence: Math.floor(60 + Math.random() * 40),
      followUpNeeded: followUpReasons.length > 0,
      followUpReasons,
      assignedTeamMember: Math.random() > 0.3 ? ["Dr. Smith", "Dr. Johnson", "Nurse Williams", "PA Chen"][Math.floor(Math.random() * 4)] : null,
      lastContactDate: Math.random() > 0.2 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : null,
    };
  });
}

function generateSampleTasks(): void {
  const taskTypes: TeamTask["taskType"][] = ["follow_up", "review_alert", "care_plan", "medication_review", "lab_review", "documentation"];
  const priorities: TeamTask["priority"][] = ["critical", "high", "medium", "low"];
  const teamMembers = ["Dr. Smith", "Dr. Johnson", "Nurse Williams", "PA Chen", "RN Garcia"];
  
  const taskTitles: Record<TeamTask["taskType"], string[]> = {
    follow_up: ["Schedule follow-up call", "Post-discharge check-in", "Annual wellness reminder"],
    review_alert: ["Review critical BP alert", "Evaluate glucose trend", "Assess heart rate variability"],
    care_plan: ["Update diabetes management plan", "Review preventive care schedule", "Adjust treatment goals"],
    medication_review: ["Reconcile medication list", "Review drug interaction flag", "Adjust dosage recommendation"],
    lab_review: ["Review A1C results", "Evaluate lipid panel", "Assess kidney function labs"],
    documentation: ["Complete visit summary", "Update care notes", "Document phone consultation"],
    other: ["General patient task", "Administrative follow-up", "Coordination needed"],
  };
  
  const patients = generateSamplePatients();
  
  for (let i = 0; i < 15; i++) {
    const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    
    const task: TeamTask = {
      id: `task-${String(i + 1).padStart(4, "0")}`,
      patientId: patient.patientId,
      patientName: patient.displayName,
      assignedTo: teamMembers[Math.floor(Math.random() * teamMembers.length)],
      assignedBy: teamMembers[Math.floor(Math.random() * teamMembers.length)],
      taskType,
      priority,
      title: taskTitles[taskType][Math.floor(Math.random() * taskTitles[taskType].length)],
      description: `Task for ${patient.displayName} requiring ${taskType.replace(/_/g, " ")} attention.`,
      status: Math.random() > 0.7 ? "completed" : Math.random() > 0.5 ? "in_progress" : "pending",
      dueDate: new Date(Date.now() + (Math.random() * 14 - 3) * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: null,
      notes: null,
    };
    
    teamTasksStore.set(task.id, task);
  }
}

generateSampleTasks();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    name: "Provider Population Management",
    version: "1.0.0",
    description: "Patient population management with proactive follow-up identification, team tasks, and status summaries",
    features: [
      "Patient population overview with risk stratification",
      "Proactive identification of patients needing follow-up",
      "Integration with RPM alerts and vital sign monitoring",
      "Team task management and assignment",
      "Patient status summaries and care gap detection",
      "EHR data-driven follow-up recommendations"
    ],
    riskLevels: ["critical", "high", "medium", "low"],
    taskTypes: ["follow_up", "review_alert", "care_plan", "medication_review", "lab_review", "documentation", "other"],
    taskStatuses: ["pending", "in_progress", "completed", "cancelled"],
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
});

router.get("/population/overview", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("POPULATION_VIEW", { providerId: hashIdentifier(providerId) });
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Query real data from database
    const [criticalAlerts, highAlerts, allAlerts, overdueGoals, recentAdherence] = await Promise.all([
      // Critical alerts count
      db.select({ count: sql<number>`count(*)` })
        .from(monitoringAlertsTable)
        .where(and(
          eq(monitoringAlertsTable.acknowledged, false),
          eq(monitoringAlertsTable.severity, "critical")
        )),
      // High severity alerts count  
      db.select({ count: sql<number>`count(*)` })
        .from(monitoringAlertsTable)
        .where(and(
          eq(monitoringAlertsTable.acknowledged, false),
          eq(monitoringAlertsTable.severity, "high")
        )),
      // Total pending alerts count
      db.select({ count: sql<number>`count(*)` })
        .from(monitoringAlertsTable)
        .where(eq(monitoringAlertsTable.acknowledged, false)),
      // Overdue goals count
      db.select({ count: sql<number>`count(*)` })
        .from(healthGoalsTable)
        .where(and(
          eq(healthGoalsTable.status, "active"),
          lte(healthGoalsTable.targetDate, new Date())
        )),
      // Recent adherence logs to calculate average
      db.select({
        profileId: medicationAdherenceLogsTable.profileId,
        status: medicationAdherenceLogsTable.status,
      })
      .from(medicationAdherenceLogsTable)
      .where(gte(medicationAdherenceLogsTable.loggedAt, sevenDaysAgo)),
    ]);
    
    // Calculate adherence statistics
    const adherenceByProfile = new Map<number, { taken: number; total: number }>();
    for (const log of recentAdherence) {
      const current = adherenceByProfile.get(log.profileId) || { taken: 0, total: 0 };
      current.total++;
      if (log.status === "taken") current.taken++;
      adherenceByProfile.set(log.profileId, current);
    }
    
    const adherenceRates = Array.from(adherenceByProfile.values())
      .filter(s => s.total > 0)
      .map(s => (s.taken / s.total) * 100);
    const avgAdherence = adherenceRates.length > 0 
      ? Math.round(adherenceRates.reduce((a, b) => a + b, 0) / adherenceRates.length)
      : 0;
    const lowAdherenceCount = adherenceRates.filter(r => r < 70).length;
    
    const criticalCount = Number(criticalAlerts[0]?.count || 0);
    const highCount = Number(highAlerts[0]?.count || 0);
    const totalAlertCount = Number(allAlerts[0]?.count || 0);
    const overdueGoalCount = Number(overdueGoals[0]?.count || 0);
    
    const hasRealData = criticalCount > 0 || highCount > 0 || totalAlertCount > 0 || 
                        overdueGoalCount > 0 || recentAdherence.length > 0;
    
    // If no real data, fall back to sample data
    if (!hasRealData) {
      const patients = generateSamplePatients();
      const overview = {
        totalPatients: patients.length,
        byRiskLevel: {
          critical: patients.filter(p => p.riskLevel === "critical").length,
          high: patients.filter(p => p.riskLevel === "high").length,
          medium: patients.filter(p => p.riskLevel === "medium").length,
          low: patients.filter(p => p.riskLevel === "low").length,
        },
        patientsNeedingFollowUp: patients.filter(p => p.followUpNeeded).length,
        totalPendingAlerts: patients.reduce((sum, p) => sum + p.pendingAlerts, 0),
        totalCriticalAlerts: patients.reduce((sum, p) => sum + p.criticalAlerts, 0),
        averageMedicationAdherence: Math.round(patients.reduce((sum, p) => sum + p.medicationAdherence, 0) / patients.length),
        unassignedPatients: patients.filter(p => !p.assignedTeamMember).length,
      };
      
      return res.json({ 
        success: true, 
        overview,
        dataSource: "sample",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
    
    // Use real data-driven overview
    const uniqueProfiles = new Set<number>();
    recentAdherence.forEach(log => uniqueProfiles.add(log.profileId));
    
    const overview = {
      totalPatients: uniqueProfiles.size,
      byRiskLevel: {
        critical: criticalCount,
        high: highCount,
        medium: overdueGoalCount,
        low: lowAdherenceCount,
      },
      patientsNeedingFollowUp: criticalCount + highCount + overdueGoalCount + lowAdherenceCount,
      totalPendingAlerts: totalAlertCount,
      totalCriticalAlerts: criticalCount,
      averageMedicationAdherence: avgAdherence,
      unassignedPatients: 0, // Would require assignment tracking table
    };
    
    res.json({ 
      success: true, 
      overview,
      dataSource: "database",
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[PopulationMgmt] Error fetching overview:", error);
    res.status(500).json({ success: false, error: "Failed to fetch population overview" });
  }
});

router.get("/population/patients", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { riskLevel, followUpNeeded, sortBy, limit } = req.query;
    
    logHipaaAudit("PATIENT_LIST_VIEW", { 
      providerId: hashIdentifier(providerId),
      filters: { riskLevel, followUpNeeded }
    });
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Query real data from database to build patient list
    const [alerts, goals, adherenceLogs, recentVitals] = await Promise.all([
      // Get all unacknowledged alerts with profile info
      db.select({
        profileId: monitoringAlertsTable.profileId,
        severity: monitoringAlertsTable.severity,
        acknowledged: monitoringAlertsTable.acknowledged,
      }).from(monitoringAlertsTable).where(eq(monitoringAlertsTable.acknowledged, false)),
      
      // Get overdue active goals
      db.select({
        profileId: healthGoalsTable.profileId,
        targetDate: healthGoalsTable.targetDate,
        status: healthGoalsTable.status,
      }).from(healthGoalsTable).where(and(
        eq(healthGoalsTable.status, "active"),
        lte(healthGoalsTable.targetDate, new Date())
      )),
      
      // Get recent adherence logs
      db.select({
        profileId: medicationAdherenceLogsTable.profileId,
        status: medicationAdherenceLogsTable.status,
      }).from(medicationAdherenceLogsTable).where(gte(medicationAdherenceLogsTable.loggedAt, sevenDaysAgo)),
      
      // Get recent vitals for last activity tracking
      db.select({
        profileId: vitalSignsTable.profileId,
        recordedAt: vitalSignsTable.recordedAt,
      }).from(vitalSignsTable).orderBy(desc(vitalSignsTable.recordedAt)),
    ]);
    
    // Build patient summaries from aggregated data
    const patientMap = new Map<number, {
      criticalAlerts: number;
      highAlerts: number;
      pendingAlerts: number;
      overdueGoals: number;
      adherenceTaken: number;
      adherenceTotal: number;
      lastVitalDate: Date | null;
    }>();
    
    // Aggregate alerts by profile
    for (const alert of alerts) {
      const data = patientMap.get(alert.profileId) || {
        criticalAlerts: 0, highAlerts: 0, pendingAlerts: 0, overdueGoals: 0,
        adherenceTaken: 0, adherenceTotal: 0, lastVitalDate: null
      };
      data.pendingAlerts++;
      if (alert.severity === "critical") data.criticalAlerts++;
      if (alert.severity === "high") data.highAlerts++;
      patientMap.set(alert.profileId, data);
    }
    
    // Aggregate goals by profile
    for (const goal of goals) {
      const data = patientMap.get(goal.profileId) || {
        criticalAlerts: 0, highAlerts: 0, pendingAlerts: 0, overdueGoals: 0,
        adherenceTaken: 0, adherenceTotal: 0, lastVitalDate: null
      };
      data.overdueGoals++;
      patientMap.set(goal.profileId, data);
    }
    
    // Aggregate adherence by profile
    for (const log of adherenceLogs) {
      const data = patientMap.get(log.profileId) || {
        criticalAlerts: 0, highAlerts: 0, pendingAlerts: 0, overdueGoals: 0,
        adherenceTaken: 0, adherenceTotal: 0, lastVitalDate: null
      };
      data.adherenceTotal++;
      if (log.status === "taken") data.adherenceTaken++;
      patientMap.set(log.profileId, data);
    }
    
    // Track last vital date by profile
    for (const vital of recentVitals) {
      const data = patientMap.get(vital.profileId);
      if (data && !data.lastVitalDate) {
        data.lastVitalDate = vital.recordedAt;
      }
    }
    
    // Check if we have real data
    const hasRealData = patientMap.size > 0;
    
    if (!hasRealData) {
      // Fall back to sample data
      let patients = generateSamplePatients();
      
      if (riskLevel && riskLevel !== "all") {
        patients = patients.filter(p => p.riskLevel === riskLevel);
      }
      
      if (followUpNeeded === "true") {
        patients = patients.filter(p => p.followUpNeeded);
      }
      
      if (sortBy === "risk") {
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        patients.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);
      } else if (sortBy === "alerts") {
        patients.sort((a, b) => b.criticalAlerts - a.criticalAlerts || b.pendingAlerts - a.pendingAlerts);
      } else if (sortBy === "adherence") {
        patients.sort((a, b) => a.medicationAdherence - b.medicationAdherence);
      }
      
      const maxLimit = Math.min(parseInt(limit as string) || 50, 100);
      patients = patients.slice(0, maxLimit);
      
      return res.json({ 
        success: true, 
        patients,
        total: patients.length,
        dataSource: "sample",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
    
    // Build patient list from real data
    let patients: PatientSummary[] = Array.from(patientMap.entries()).map(([profileId, data]) => {
      const adherenceRate = data.adherenceTotal > 0 
        ? Math.round((data.adherenceTaken / data.adherenceTotal) * 100) 
        : 100;
      
      // Compute risk level based on alerts and adherence
      let riskLevelValue: "critical" | "high" | "medium" | "low" = "low";
      if (data.criticalAlerts > 0) riskLevelValue = "critical";
      else if (data.highAlerts > 0 || data.overdueGoals > 1) riskLevelValue = "high";
      else if (data.overdueGoals > 0 || adherenceRate < 70) riskLevelValue = "medium";
      
      const followUpReasons: string[] = [];
      if (data.criticalAlerts > 0) followUpReasons.push("Critical vital sign alert");
      if (data.overdueGoals > 0) followUpReasons.push("Overdue health goals");
      if (adherenceRate < 70) followUpReasons.push("Low medication adherence");
      
      return {
        patientId: `profile-${profileId}`,
        displayName: `Patient ${profileId}`,
        riskLevel: riskLevelValue,
        pendingAlerts: data.pendingAlerts,
        criticalAlerts: data.criticalAlerts,
        overdueGoals: data.overdueGoals,
        lastVitalDate: data.lastVitalDate?.toISOString() || null,
        medicationAdherence: adherenceRate,
        followUpNeeded: followUpReasons.length > 0,
        followUpReasons,
        assignedTeamMember: null,
        lastContactDate: null,
      };
    });
    
    // Apply filters
    if (riskLevel && riskLevel !== "all") {
      patients = patients.filter(p => p.riskLevel === riskLevel);
    }
    
    if (followUpNeeded === "true") {
      patients = patients.filter(p => p.followUpNeeded);
    }
    
    // Apply sorting
    if (sortBy === "risk") {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      patients.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);
    } else if (sortBy === "alerts") {
      patients.sort((a, b) => b.criticalAlerts - a.criticalAlerts || b.pendingAlerts - a.pendingAlerts);
    } else if (sortBy === "adherence") {
      patients.sort((a, b) => a.medicationAdherence - b.medicationAdherence);
    }
    
    const maxLimit = Math.min(parseInt(limit as string) || 50, 100);
    patients = patients.slice(0, maxLimit);
    
    res.json({ 
      success: true, 
      patients,
      total: patients.length,
      dataSource: "database",
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[PopulationMgmt] Error fetching patients:", error);
    res.status(500).json({ success: false, error: "Failed to fetch patient list" });
  }
});

router.get("/proactive-followup", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("PROACTIVE_FOLLOWUP_VIEW", { providerId: hashIdentifier(providerId) });
    
    // Query real database for proactive follow-up identification
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // 1. Get unacknowledged critical/high alerts from RPM
    const criticalAlerts = await db.select({
      alertId: monitoringAlertsTable.id,
      profileId: monitoringAlertsTable.profileId,
      vitalType: monitoringAlertsTable.vitalType,
      message: monitoringAlertsTable.message,
      severity: monitoringAlertsTable.severity,
      createdAt: monitoringAlertsTable.createdAt,
    })
    .from(monitoringAlertsTable)
    .where(
      and(
        eq(monitoringAlertsTable.acknowledged, false),
        or(
          eq(monitoringAlertsTable.severity, "critical"),
          eq(monitoringAlertsTable.severity, "high")
        )
      )
    )
    .orderBy(desc(monitoringAlertsTable.createdAt))
    .limit(50);
    
    // 2. Get overdue health goals
    const overdueGoals = await db.select({
      goalId: healthGoalsTable.id,
      profileId: healthGoalsTable.profileId,
      goalType: healthGoalsTable.goalType,
      targetDate: healthGoalsTable.targetDate,
      status: healthGoalsTable.status,
    })
    .from(healthGoalsTable)
    .where(
      and(
        eq(healthGoalsTable.status, "active"),
        lte(healthGoalsTable.targetDate, now)
      )
    )
    .orderBy(healthGoalsTable.targetDate)
    .limit(50);
    
    // 3. Get recent adherence logs to calculate low adherence
    const recentAdherenceLogs = await db.select({
      profileId: medicationAdherenceLogsTable.profileId,
      status: medicationAdherenceLogsTable.status,
    })
    .from(medicationAdherenceLogsTable)
    .where(gte(medicationAdherenceLogsTable.loggedAt, sevenDaysAgo));
    
    // Calculate adherence rates per profile
    const adherenceByProfile = new Map<number, { taken: number; total: number }>();
    for (const log of recentAdherenceLogs) {
      const current = adherenceByProfile.get(log.profileId) || { taken: 0, total: 0 };
      current.total++;
      if (log.status === "taken") current.taken++;
      adherenceByProfile.set(log.profileId, current);
    }
    
    const lowAdherenceProfiles = Array.from(adherenceByProfile.entries())
      .filter(([_, stats]) => stats.total > 0 && (stats.taken / stats.total) < 0.7)
      .map(([profileId, stats]) => ({
        profileId,
        adherenceRate: Math.round((stats.taken / stats.total) * 100),
      }));
    
    // 4. Get patients with no recent vitals (>7 days)
    const recentVitals = await db.select({
      profileId: vitalSignsTable.profileId,
    })
    .from(vitalSignsTable)
    .where(gte(vitalSignsTable.recordedAt, sevenDaysAgo))
    .groupBy(vitalSignsTable.profileId);
    
    const profilesWithRecentVitals = new Set(recentVitals.map(v => v.profileId));
    
    // 5. Get all profiles that have ever logged vitals to find those without recent ones
    const allVitalProfiles = await db.selectDistinct({
      profileId: vitalSignsTable.profileId,
    })
    .from(vitalSignsTable);
    
    const profilesWithoutRecentVitals = allVitalProfiles
      .filter(p => !profilesWithRecentVitals.has(p.profileId))
      .slice(0, 20);
    
    // Build follow-up categories from real data
    const followUpCategories = {
      criticalAlerts: criticalAlerts.map(alert => ({
        patientId: `profile-${alert.profileId}`,
        patientName: `Patient ${alert.profileId}`,
        reason: `Critical ${alert.vitalType} alert: ${alert.message}`,
        alertCount: 1,
        priority: alert.severity as "critical" | "high",
        suggestedAction: "Review critical alerts and contact patient immediately",
      })),
      overdueGoals: overdueGoals.map(goal => ({
        patientId: `profile-${goal.profileId}`,
        patientName: `Patient ${goal.profileId}`,
        reason: `Overdue ${goal.goalType} goal needs review`,
        overdueCount: 1,
        priority: "high" as const,
        suggestedAction: "Schedule care plan review and goal adjustment",
      })),
      lowAdherence: lowAdherenceProfiles.map(p => ({
        patientId: `profile-${p.profileId}`,
        patientName: `Patient ${p.profileId}`,
        reason: "Low medication adherence detected",
        adherenceRate: p.adherenceRate,
        priority: "high" as const,
        suggestedAction: "Conduct medication reconciliation and adherence counseling",
      })),
      lostToFollowUp: profilesWithoutRecentVitals.map(p => ({
        patientId: `profile-${p.profileId}`,
        patientName: `Patient ${p.profileId}`,
        reason: "No vitals logged in over 7 days - potential lost to follow-up",
        lastContact: null,
        priority: "medium" as const,
        suggestedAction: "Schedule outreach call to check on patient status",
      })),
    };
    
    // If no real data found, fall back to sample data for samplenstration
    const hasRealData = criticalAlerts.length > 0 || overdueGoals.length > 0 || 
                        lowAdherenceProfiles.length > 0 || profilesWithoutRecentVitals.length > 0;
    
    if (!hasRealData) {
      const samplePatients = generateSamplePatients().filter(p => p.followUpNeeded);
      
      followUpCategories.criticalAlerts = samplePatients.filter(p => p.criticalAlerts > 0).map(p => ({
        patientId: p.patientId,
        patientName: p.displayName,
        reason: "Critical vital sign alert requires immediate attention",
        alertCount: p.criticalAlerts,
        priority: "critical" as const,
        suggestedAction: "Review critical alerts and contact patient immediately",
      }));
      followUpCategories.overdueGoals = samplePatients.filter(p => p.overdueGoals > 0).map(p => ({
        patientId: p.patientId,
        patientName: p.displayName,
        reason: "Overdue health goals need review",
        overdueCount: p.overdueGoals,
        priority: "high" as const,
        suggestedAction: "Schedule care plan review and goal adjustment",
      }));
      followUpCategories.lowAdherence = samplePatients.filter(p => p.medicationAdherence < 70).map(p => ({
        patientId: p.patientId,
        patientName: p.displayName,
        reason: "Low medication adherence detected",
        adherenceRate: p.medicationAdherence,
        priority: "high" as const,
        suggestedAction: "Conduct medication reconciliation and adherence counseling",
      }));
      followUpCategories.lostToFollowUp = samplePatients.filter(p => {
        if (!p.lastContactDate) return true;
        const daysSinceContact = (Date.now() - new Date(p.lastContactDate).getTime()) / (24 * 60 * 60 * 1000);
        return daysSinceContact > 30;
      }).map(p => ({
        patientId: p.patientId,
        patientName: p.displayName,
        reason: "No recent contact - potential lost to follow-up",
        lastContact: p.lastContactDate,
        priority: "medium" as const,
        suggestedAction: "Schedule outreach call or appointment reminder",
      }));
    }
    
    const totalFollowUpsNeeded = 
      followUpCategories.criticalAlerts.length +
      followUpCategories.overdueGoals.length +
      followUpCategories.lowAdherence.length +
      followUpCategories.lostToFollowUp.length;
    
    res.json({
      success: true,
      totalFollowUpsNeeded,
      categories: followUpCategories,
      generatedAt: new Date().toISOString(),
      dataSource: hasRealData ? "database" : "sample",
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[PopulationMgmt] Error generating proactive follow-ups:", error);
    res.status(500).json({ success: false, error: "Failed to generate proactive follow-up list" });
  }
});

router.get("/patient/:patientId/summary", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { patientId } = req.params;
    
    logHipaaAudit("PATIENT_SUMMARY_VIEW", { 
      providerId: hashIdentifier(providerId),
      patientId: hashIdentifier(patientId)
    });
    
    const patients = generateSamplePatients();
    const patient = patients.find(p => p.patientId === patientId);
    
    if (!patient) {
      return res.status(404).json({ success: false, error: "Patient not found" });
    }
    
    const recentVitals = [
      { type: "blood_pressure", value: "128/82", date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), status: "normal" },
      { type: "heart_rate", value: "78", date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), status: "normal" },
      { type: "blood_glucose", value: "142", date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), status: "elevated" },
      { type: "weight", value: "185", date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), status: "normal" },
    ];
    
    const activeGoals = [
      { type: "blood_glucose", target: "Maintain fasting glucose <126 mg/dL", progress: 65, status: "in_progress" },
      { type: "weight", target: "Lose 10 lbs by March 2026", progress: 40, status: "on_track" },
      { type: "exercise", target: "150 min moderate activity per week", progress: 80, status: "on_track" },
    ];
    
    const medications = [
      { name: "Metformin 500mg", frequency: "Twice daily", adherence: 92 },
      { name: "Lisinopril 10mg", frequency: "Once daily", adherence: 88 },
      { name: "Atorvastatin 20mg", frequency: "Once daily", adherence: 95 },
    ];
    
    const upcomingActions = [
      { type: "appointment", description: "Annual wellness visit", date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() },
      { type: "lab", description: "A1C test due", date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
    ];
    
    res.json({
      success: true,
      summary: {
        patient,
        recentVitals,
        activeGoals,
        medications,
        upcomingActions,
        careGaps: patient.followUpReasons,
      },
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[PopulationMgmt] Error fetching patient summary:", error);
    res.status(500).json({ success: false, error: "Failed to fetch patient summary" });
  }
});

router.get("/team/tasks", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { status, priority, assignedTo, patientId, limit } = req.query;
    
    logHipaaAudit("TEAM_TASKS_VIEW", { 
      providerId: hashIdentifier(providerId),
      filters: { status, priority, assignedTo }
    });
    
    let tasks = Array.from(teamTasksStore.values());
    
    if (status && status !== "all") {
      tasks = tasks.filter(t => t.status === status);
    }
    
    if (priority && priority !== "all") {
      tasks = tasks.filter(t => t.priority === priority);
    }
    
    if (assignedTo) {
      tasks = tasks.filter(t => t.assignedTo === assignedTo);
    }
    
    if (patientId) {
      tasks = tasks.filter(t => t.patientId === patientId);
    }
    
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      return priorityOrder[a.priority] - priorityOrder[b.priority] || 
             new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    
    const maxLimit = Math.min(parseInt(limit as string) || 50, 100);
    tasks = tasks.slice(0, maxLimit);
    
    const stats = {
      total: teamTasksStore.size,
      pending: Array.from(teamTasksStore.values()).filter(t => t.status === "pending").length,
      inProgress: Array.from(teamTasksStore.values()).filter(t => t.status === "in_progress").length,
      completed: Array.from(teamTasksStore.values()).filter(t => t.status === "completed").length,
      critical: Array.from(teamTasksStore.values()).filter(t => t.priority === "critical" && t.status !== "completed").length,
      overdue: Array.from(teamTasksStore.values()).filter(t => new Date(t.dueDate) < new Date() && t.status !== "completed").length,
    };
    
    res.json({ 
      success: true, 
      tasks,
      stats,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[PopulationMgmt] Error fetching team tasks:", error);
    res.status(500).json({ success: false, error: "Failed to fetch team tasks" });
  }
});

const createTaskSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  patientName: z.string().min(1, "Patient name is required"),
  assignedTo: z.string().min(1, "Assignee is required"),
  taskType: z.enum(["follow_up", "review_alert", "care_plan", "medication_review", "lab_review", "documentation", "other"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional().nullable(),
});

router.post("/team/tasks", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    const validation = createTaskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || "Invalid request data" 
      });
    }
    
    const data = validation.data;
    
    const taskId = `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    
    const newTask: TeamTask = {
      id: taskId,
      patientId: data.patientId,
      patientName: data.patientName,
      assignedTo: data.assignedTo,
      assignedBy: providerId,
      taskType: data.taskType,
      priority: data.priority,
      title: data.title,
      description: data.description,
      status: "pending",
      dueDate: data.dueDate,
      createdAt: new Date().toISOString(),
      completedAt: null,
      notes: data.notes || null,
    };
    
    teamTasksStore.set(taskId, newTask);
    
    logHipaaAudit("TASK_CREATED", { 
      providerId: hashIdentifier(providerId),
      taskId,
      patientId: hashIdentifier(data.patientId),
      assignedTo: data.assignedTo
    });
    
    res.json({ success: true, task: newTask });
  } catch (error) {
    console.error("[PopulationMgmt] Error creating task:", error);
    res.status(500).json({ success: false, error: "Failed to create task" });
  }
});

const updateTaskSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional().nullable(),
  dueDate: z.string().optional(),
});

router.patch("/team/tasks/:taskId", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { taskId } = req.params;
    
    const validation = updateTaskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || "Invalid request data" 
      });
    }
    
    const task = teamTasksStore.get(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }
    
    const updates = validation.data;
    
    if (updates.status) task.status = updates.status;
    if (updates.priority) task.priority = updates.priority;
    if (updates.assignedTo) task.assignedTo = updates.assignedTo;
    if (updates.notes !== undefined) task.notes = updates.notes;
    if (updates.dueDate) task.dueDate = updates.dueDate;
    
    if (updates.status === "completed") {
      task.completedAt = new Date().toISOString();
    }
    
    teamTasksStore.set(taskId, task);
    
    logHipaaAudit("TASK_UPDATED", { 
      providerId: hashIdentifier(providerId),
      taskId,
      updates: Object.keys(updates)
    });
    
    res.json({ success: true, task });
  } catch (error) {
    console.error("[PopulationMgmt] Error updating task:", error);
    res.status(500).json({ success: false, error: "Failed to update task" });
  }
});

router.get("/team/members", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("TEAM_MEMBERS_VIEW", { providerId: hashIdentifier(providerId) });
    
    const teamMembers = [
      { id: "dr-smith", name: "Dr. Smith", role: "Physician", specialty: "Internal Medicine", activeTasks: 5, completedToday: 3 },
      { id: "dr-johnson", name: "Dr. Johnson", role: "Physician", specialty: "Cardiology", activeTasks: 4, completedToday: 2 },
      { id: "nurse-williams", name: "Nurse Williams", role: "Registered Nurse", specialty: "Care Coordination", activeTasks: 8, completedToday: 5 },
      { id: "pa-chen", name: "PA Chen", role: "Physician Assistant", specialty: "Primary Care", activeTasks: 6, completedToday: 4 },
      { id: "rn-garcia", name: "RN Garcia", role: "Registered Nurse", specialty: "Chronic Disease Management", activeTasks: 7, completedToday: 3 },
    ];
    
    res.json({ success: true, members: teamMembers });
  } catch (error) {
    console.error("[PopulationMgmt] Error fetching team members:", error);
    res.status(500).json({ success: false, error: "Failed to fetch team members" });
  }
});

router.get("/dashboard/stats", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("DASHBOARD_STATS_VIEW", { providerId: hashIdentifier(providerId) });
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Query real data from database
    const [criticalAlerts, highAlerts, pendingAlerts, overdueGoals, recentAdherence, resolvedToday] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(monitoringAlertsTable)
        .where(and(eq(monitoringAlertsTable.acknowledged, false), eq(monitoringAlertsTable.severity, "critical"))),
      db.select({ count: sql<number>`count(*)` })
        .from(monitoringAlertsTable)
        .where(and(eq(monitoringAlertsTable.acknowledged, false), eq(monitoringAlertsTable.severity, "high"))),
      db.select({ count: sql<number>`count(*)` })
        .from(monitoringAlertsTable)
        .where(eq(monitoringAlertsTable.acknowledged, false)),
      db.select({ count: sql<number>`count(*)` })
        .from(healthGoalsTable)
        .where(and(eq(healthGoalsTable.status, "active"), lte(healthGoalsTable.targetDate, new Date()))),
      db.select({ profileId: medicationAdherenceLogsTable.profileId, status: medicationAdherenceLogsTable.status })
        .from(medicationAdherenceLogsTable)
        .where(gte(medicationAdherenceLogsTable.loggedAt, sevenDaysAgo)),
      db.select({ count: sql<number>`count(*)` })
        .from(monitoringAlertsTable)
        .where(and(eq(monitoringAlertsTable.acknowledged, true), gte(monitoringAlertsTable.acknowledgedAt, today))),
    ]);
    
    // Calculate adherence statistics
    const adherenceByProfile = new Map<number, { taken: number; total: number }>();
    for (const log of recentAdherence) {
      const current = adherenceByProfile.get(log.profileId) || { taken: 0, total: 0 };
      current.total++;
      if (log.status === "taken") current.taken++;
      adherenceByProfile.set(log.profileId, current);
    }
    
    const adherenceRates = Array.from(adherenceByProfile.values())
      .filter(s => s.total > 0)
      .map(s => (s.taken / s.total) * 100);
    const avgAdherence = adherenceRates.length > 0 
      ? Math.round(adherenceRates.reduce((a, b) => a + b, 0) / adherenceRates.length)
      : 0;
    const lowAdherenceCount = adherenceRates.filter(r => r < 70).length;
    
    const criticalCount = Number(criticalAlerts[0]?.count || 0);
    const highCount = Number(highAlerts[0]?.count || 0);
    const pendingCount = Number(pendingAlerts[0]?.count || 0);
    const overdueCount = Number(overdueGoals[0]?.count || 0);
    const resolvedTodayCount = Number(resolvedToday[0]?.count || 0);
    
    const tasks = Array.from(teamTasksStore.values());
    
    const hasRealData = criticalCount > 0 || highCount > 0 || pendingCount > 0 || 
                        overdueCount > 0 || recentAdherence.length > 0;
    
    if (!hasRealData) {
      // Fall back to sample data
      const patients = generateSamplePatients();
      
      const stats = {
        population: {
          total: patients.length,
          critical: patients.filter(p => p.riskLevel === "critical").length,
          high: patients.filter(p => p.riskLevel === "high").length,
          needingFollowUp: patients.filter(p => p.followUpNeeded).length,
        },
        alerts: {
          critical: patients.reduce((sum, p) => sum + p.criticalAlerts, 0),
          pending: patients.reduce((sum, p) => sum + p.pendingAlerts, 0),
          resolvedToday: Math.floor(Math.random() * 10) + 5,
        },
        tasks: {
          total: tasks.length,
          pending: tasks.filter(t => t.status === "pending").length,
          inProgress: tasks.filter(t => t.status === "in_progress").length,
          completedToday: tasks.filter(t => t.status === "completed" && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length,
          overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== "completed").length,
        },
        adherence: {
          average: Math.round(patients.reduce((sum, p) => sum + p.medicationAdherence, 0) / patients.length),
          lowAdherenceCount: patients.filter(p => p.medicationAdherence < 70).length,
        },
      };
      
      return res.json({ 
        success: true, 
        stats,
        dataSource: "sample",
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
    
    // Use real data
    const stats = {
      population: {
        total: adherenceByProfile.size,
        critical: criticalCount,
        high: highCount,
        needingFollowUp: criticalCount + highCount + overdueCount + lowAdherenceCount,
      },
      alerts: {
        critical: criticalCount,
        pending: pendingCount,
        resolvedToday: resolvedTodayCount,
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === "pending").length,
        inProgress: tasks.filter(t => t.status === "in_progress").length,
        completedToday: tasks.filter(t => t.status === "completed" && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length,
        overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== "completed").length,
      },
      adherence: {
        average: avgAdherence,
        lowAdherenceCount: lowAdherenceCount,
      },
    };
    
    res.json({ 
      success: true, 
      stats,
      dataSource: "database",
      generatedAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[PopulationMgmt] Error fetching dashboard stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch dashboard stats" });
  }
});

console.log("[PopulationMgmt] Service initialized with patient population management features");
console.log("[PopulationMgmt] Features: population overview, proactive follow-up, team tasks, patient summaries");

export default router;
