import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db } from "./db";
import {
  patientOutcomeReportsTable,
  patientSymptomLogsTable,
  patientExperienceFeedbackTable,
  insertPatientOutcomeReportSchema,
  insertPatientSymptomLogSchema,
  insertPatientExperienceFeedbackSchema,
  profiles,
  comprehensiveCarePlansTable,
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][PatientOutcomes] ${timestamp} - ${action} -`, JSON.stringify(details));
}


async function verifyProfileAccess(userId: string, requestedProfileId: string | undefined): Promise<{ allowed: boolean; profileId: string }> {
  // If no profile ID requested, use the session user's ID
  const targetProfileId = requestedProfileId || userId;
  
  // For now, patients can only access their own profile
  // In a full implementation, this would check caregiver access tables
  if (targetProfileId !== userId) {
    // Check if user has caregiver access to this profile
    // For security, we deny access unless explicitly granted
    logHipaaAudit("PROFILE_ACCESS_DENIED", { 
      userId: hashIdentifier(userId), 
      requestedProfile: hashIdentifier(targetProfileId),
      reason: "not_authorized"
    });
    return { allowed: false, profileId: targetProfileId };
  }
  
  return { allowed: true, profileId: targetProfileId };
}


function enforceSessionUserId(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", { path: req.path });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  
  (req as any).userId = sessionUserId;
  next();
}

function requireProviderAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  const isProvider = (req.session as any)?.isProvider || (req.session as any)?.role === "provider";
  
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", { path: req.path });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  
  if (!isProvider) {
    logHipaaAudit("PROVIDER_AUTH_DENIED", { 
      path: req.path, 
      userId: hashIdentifier(sessionUserId), 
      reason: "not_provider_role" 
    });
    return res.status(403).json({ 
      success: false, 
      error: "Provider access required" 
    });
  }
  
  (req as any).providerId = sessionUserId;
  next();
}

router.get("/metadata", (req: Request, res: Response) => {
  res.json({
    version: "1.0.0",
    name: "Patient-Reported Outcomes (PRO)",
    description: "Capture patient experiences, treatment outcomes, quality of life, and satisfaction metrics",
    reportTypes: [
      { value: "treatment_outcome", label: "Treatment Outcome" },
      { value: "care_plan_experience", label: "Care Plan Experience" },
      { value: "quality_of_life", label: "Quality of Life Assessment" },
      { value: "symptom_assessment", label: "Symptom Assessment" },
      { value: "satisfaction_survey", label: "Satisfaction Survey" },
      { value: "general_experience", label: "General Experience" },
    ],
    ratingScales: {
      qualityOfLife: { min: 1, max: 10, labels: ["Very Poor", "Poor", "Fair", "Good", "Excellent"] },
      symptomSeverity: { min: 1, max: 10, labels: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      satisfaction: { min: 1, max: 10, labels: ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"] },
      painLevel: { min: 0, max: 10, labels: ["No Pain", "Mild", "Moderate", "Severe", "Worst Possible"] },
    },
  });
});

router.post("/reports", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Verify user can only submit reports for their own profile
    const access = await verifyProfileAccess(userId, req.body.profileId);
    if (!access.allowed) {
      return res.status(403).json({ 
        success: false, 
        error: "You can only submit reports for your own profile" 
      });
    }
    
    const validation = insertPatientOutcomeReportSchema.safeParse({
      ...req.body,
      profileId: access.profileId,
    });
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid report data",
        details: validation.error.errors 
      });
    }
    
    const data = validation.data;
    
    logHipaaAudit("OUTCOME_REPORT_SUBMITTED", { 
      userId: hashIdentifier(userId),
      profileId: hashIdentifier(data.profileId),
      reportType: data.reportType
    });
    
    const [report] = await db.insert(patientOutcomeReportsTable).values({
      profileId: data.profileId,
      reportType: data.reportType,
      relatedCarePlanId: data.relatedCarePlanId,
      relatedTreatmentId: data.relatedTreatmentId,
      qualityOfLifeRating: data.qualityOfLifeRating,
      symptomSeverityRating: data.symptomSeverityRating,
      satisfactionRating: data.satisfactionRating,
      overallWellbeingRating: data.overallWellbeingRating,
      painLevel: data.painLevel,
      energyLevel: data.energyLevel,
      moodRating: data.moodRating,
      sleepQualityRating: data.sleepQualityRating,
      dailyFunctioningRating: data.dailyFunctioningRating,
      treatmentEffectivenessRating: data.treatmentEffectivenessRating,
      sideEffectsReported: data.sideEffectsReported,
      improvementAreas: data.improvementAreas,
      concernsNotes: data.concernsNotes,
      additionalComments: data.additionalComments,
      wouldRecommend: data.wouldRecommend,
      reportPeriodStart: data.reportPeriodStart ? new Date(data.reportPeriodStart) : null,
      reportPeriodEnd: data.reportPeriodEnd ? new Date(data.reportPeriodEnd) : null,
    }).returning();
    
    res.status(201).json({ 
      success: true, 
      report,
      message: "Outcome report submitted successfully" 
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error submitting report:", error);
    res.status(500).json({ success: false, error: "Failed to submit outcome report" });
  }
});

router.get("/reports", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { profileId, reportType, limit = "20" } = req.query;
    
    // Verify user can only view their own reports
    const access = await verifyProfileAccess(userId, profileId as string);
    if (!access.allowed) {
      return res.status(403).json({ 
        success: false, 
        error: "You can only view your own reports" 
      });
    }
    
    const targetProfileId = access.profileId;
    
    logHipaaAudit("OUTCOME_REPORTS_VIEW", { 
      userId: hashIdentifier(userId),
      profileId: hashIdentifier(targetProfileId)
    });
    
    let query = db.select().from(patientOutcomeReportsTable)
      .where(eq(patientOutcomeReportsTable.profileId, targetProfileId))
      .orderBy(desc(patientOutcomeReportsTable.createdAt))
      .limit(parseInt(limit as string) || 20);
    
    const reports = await query;
    
    res.json({ 
      success: true, 
      reports,
      count: reports.length
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error fetching reports:", error);
    res.status(500).json({ success: false, error: "Failed to fetch outcome reports" });
  }
});

router.get("/reports/:reportId", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { reportId } = req.params;
    
    logHipaaAudit("OUTCOME_REPORT_DETAIL_VIEW", { 
      userId: hashIdentifier(userId),
      reportId: hashIdentifier(reportId)
    });
    
    const [report] = await db.select().from(patientOutcomeReportsTable)
      .where(eq(patientOutcomeReportsTable.id, reportId));
    
    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    
    // Verify the user owns this report
    const access = await verifyProfileAccess(userId, report.profileId);
    if (!access.allowed) {
      return res.status(403).json({ 
        success: false, 
        error: "You can only view your own reports" 
      });
    }
    
    const symptoms = await db.select().from(patientSymptomLogsTable)
      .where(eq(patientSymptomLogsTable.outcomeReportId, reportId))
      .orderBy(desc(patientSymptomLogsTable.loggedAt));
    
    const feedback = await db.select().from(patientExperienceFeedbackTable)
      .where(eq(patientExperienceFeedbackTable.outcomeReportId, reportId));
    
    res.json({ 
      success: true, 
      report,
      symptoms,
      feedback
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error fetching report:", error);
    res.status(500).json({ success: false, error: "Failed to fetch report details" });
  }
});

router.post("/symptoms", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Verify user can only log symptoms for their own profile
    const access = await verifyProfileAccess(userId, req.body.profileId);
    if (!access.allowed) {
      return res.status(403).json({ 
        success: false, 
        error: "You can only log symptoms for your own profile" 
      });
    }
    
    const validation = insertPatientSymptomLogSchema.safeParse({
      ...req.body,
      profileId: access.profileId,
    });
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid symptom data",
        details: validation.error.errors 
      });
    }
    
    const data = validation.data;
    
    logHipaaAudit("SYMPTOM_LOGGED", { 
      userId: hashIdentifier(userId),
      profileId: hashIdentifier(data.profileId),
      symptom: data.symptomName
    });
    
    const [symptom] = await db.insert(patientSymptomLogsTable).values({
      profileId: data.profileId,
      outcomeReportId: data.outcomeReportId,
      symptomName: data.symptomName,
      severity: data.severity,
      frequency: data.frequency,
      duration: data.duration,
      triggerFactors: data.triggerFactors,
      reliefMeasures: data.reliefMeasures,
      impactOnDaily: data.impactOnDaily,
      notes: data.notes,
    }).returning();
    
    res.status(201).json({ 
      success: true, 
      symptom,
      message: "Symptom logged successfully" 
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error logging symptom:", error);
    res.status(500).json({ success: false, error: "Failed to log symptom" });
  }
});

router.get("/symptoms", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { profileId, limit = "50" } = req.query;
    
    // Verify user can only view their own symptoms
    const access = await verifyProfileAccess(userId, profileId as string);
    if (!access.allowed) {
      return res.status(403).json({ 
        success: false, 
        error: "You can only view your own symptoms" 
      });
    }
    
    const targetProfileId = access.profileId;
    
    logHipaaAudit("SYMPTOMS_VIEW", { 
      userId: hashIdentifier(userId),
      profileId: hashIdentifier(targetProfileId)
    });
    
    const symptoms = await db.select().from(patientSymptomLogsTable)
      .where(eq(patientSymptomLogsTable.profileId, targetProfileId))
      .orderBy(desc(patientSymptomLogsTable.loggedAt))
      .limit(parseInt(limit as string) || 50);
    
    res.json({ success: true, symptoms });
  } catch (error) {
    console.error("[PatientOutcomes] Error fetching symptoms:", error);
    res.status(500).json({ success: false, error: "Failed to fetch symptoms" });
  }
});

router.post("/feedback", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Verify user can only submit feedback for their own profile
    const access = await verifyProfileAccess(userId, req.body.profileId);
    if (!access.allowed) {
      return res.status(403).json({ 
        success: false, 
        error: "You can only submit feedback for your own profile" 
      });
    }
    
    const validation = insertPatientExperienceFeedbackSchema.safeParse({
      ...req.body,
      profileId: access.profileId,
    });
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid feedback data",
        details: validation.error.errors 
      });
    }
    
    const data = validation.data;
    
    logHipaaAudit("FEEDBACK_SUBMITTED", { 
      userId: hashIdentifier(userId),
      profileId: hashIdentifier(data.profileId),
      category: data.feedbackCategory,
      isAnonymous: data.isAnonymous
    });
    
    const [feedback] = await db.insert(patientExperienceFeedbackTable).values({
      profileId: data.profileId,
      outcomeReportId: data.outcomeReportId,
      feedbackCategory: data.feedbackCategory,
      rating: data.rating,
      feedbackText: data.feedbackText,
      isAnonymous: data.isAnonymous ?? false,
    }).returning();
    
    res.status(201).json({ 
      success: true, 
      feedback,
      message: "Feedback submitted successfully" 
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error submitting feedback:", error);
    res.status(500).json({ success: false, error: "Failed to submit feedback" });
  }
});

router.get("/summary", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { profileId, days = "30" } = req.query;
    
    // Verify user can only view their own summary
    const access = await verifyProfileAccess(userId, profileId as string);
    if (!access.allowed) {
      return res.status(403).json({ 
        success: false, 
        error: "You can only view your own summary" 
      });
    }
    
    const targetProfileId = access.profileId;
    const daysNum = parseInt(days as string) || 30;
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
    
    logHipaaAudit("OUTCOME_SUMMARY_VIEW", { 
      userId: hashIdentifier(userId),
      profileId: hashIdentifier(targetProfileId),
      days: daysNum
    });
    
    const reports = await db.select().from(patientOutcomeReportsTable)
      .where(and(
        eq(patientOutcomeReportsTable.profileId, targetProfileId),
        gte(patientOutcomeReportsTable.createdAt, startDate)
      ))
      .orderBy(desc(patientOutcomeReportsTable.createdAt));
    
    const symptoms = await db.select().from(patientSymptomLogsTable)
      .where(and(
        eq(patientSymptomLogsTable.profileId, targetProfileId),
        gte(patientSymptomLogsTable.loggedAt, startDate)
      ));
    
    const avgQoL = reports.filter(r => r.qualityOfLifeRating).length > 0
      ? reports.reduce((sum, r) => sum + (r.qualityOfLifeRating || 0), 0) / reports.filter(r => r.qualityOfLifeRating).length
      : null;
    
    const avgSymptomSeverity = reports.filter(r => r.symptomSeverityRating).length > 0
      ? reports.reduce((sum, r) => sum + (r.symptomSeverityRating || 0), 0) / reports.filter(r => r.symptomSeverityRating).length
      : null;
    
    const avgSatisfaction = reports.filter(r => r.satisfactionRating).length > 0
      ? reports.reduce((sum, r) => sum + (r.satisfactionRating || 0), 0) / reports.filter(r => r.satisfactionRating).length
      : null;
    
    const avgPainLevel = reports.filter(r => r.painLevel !== null).length > 0
      ? reports.reduce((sum, r) => sum + (r.painLevel || 0), 0) / reports.filter(r => r.painLevel !== null).length
      : null;
    
    const symptomCounts: Record<string, number> = {};
    symptoms.forEach(s => {
      symptomCounts[s.symptomName] = (symptomCounts[s.symptomName] || 0) + 1;
    });
    
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    const recommendCount = reports.filter(r => r.wouldRecommend === true).length;
    const wouldNotRecommendCount = reports.filter(r => r.wouldRecommend === false).length;
    
    const trends = {
      qolTrend: calculateTrend(reports, "qualityOfLifeRating"),
      symptomTrend: calculateTrend(reports, "symptomSeverityRating"),
      satisfactionTrend: calculateTrend(reports, "satisfactionRating"),
    };
    
    res.json({
      success: true,
      summary: {
        periodDays: daysNum,
        totalReports: reports.length,
        totalSymptomLogs: symptoms.length,
        averages: {
          qualityOfLife: avgQoL ? Math.round(avgQoL * 10) / 10 : null,
          symptomSeverity: avgSymptomSeverity ? Math.round(avgSymptomSeverity * 10) / 10 : null,
          satisfaction: avgSatisfaction ? Math.round(avgSatisfaction * 10) / 10 : null,
          painLevel: avgPainLevel ? Math.round(avgPainLevel * 10) / 10 : null,
        },
        topSymptoms,
        recommendations: {
          wouldRecommend: recommendCount,
          wouldNotRecommend: wouldNotRecommendCount,
        },
        trends,
      },
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error fetching summary:", error);
    res.status(500).json({ success: false, error: "Failed to fetch outcome summary" });
  }
});

function calculateTrend(reports: any[], field: string): "improving" | "stable" | "declining" | null {
  const values = reports
    .filter(r => r[field] !== null && r[field] !== undefined)
    .map(r => ({ value: r[field], date: new Date(r.createdAt) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  
  if (values.length < 2) return null;
  
  const midpoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midpoint);
  const secondHalf = values.slice(midpoint);
  
  const firstAvg = firstHalf.reduce((sum, v) => sum + v.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v.value, 0) / secondHalf.length;
  
  const diff = secondAvg - firstAvg;
  
  if (field === "symptomSeverityRating" || field === "painLevel") {
    if (diff < -0.5) return "improving";
    if (diff > 0.5) return "declining";
  } else {
    if (diff > 0.5) return "improving";
    if (diff < -0.5) return "declining";
  }
  
  return "stable";
}

router.get("/provider/patients/reports", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { reviewed, limit = "50" } = req.query;
    
    logHipaaAudit("PROVIDER_REPORTS_VIEW", { 
      providerId: hashIdentifier(providerId),
      filter: reviewed
    });
    
    let query = db.select({
      report: patientOutcomeReportsTable,
      profile: {
        id: profiles.id,
        fullName: profiles.fullName,
      },
    })
      .from(patientOutcomeReportsTable)
      .leftJoin(profiles, eq(patientOutcomeReportsTable.profileId, profiles.id))
      .orderBy(desc(patientOutcomeReportsTable.createdAt))
      .limit(parseInt(limit as string) || 50);
    
    const results = await query;
    
    let reports = results.map(r => ({
      ...r.report,
      patientName: r.profile?.fullName || "Unknown",
    }));
    
    if (reviewed === "true") {
      reports = reports.filter(r => r.providerReviewed);
    } else if (reviewed === "false") {
      reports = reports.filter(r => !r.providerReviewed);
    }
    
    res.json({ 
      success: true, 
      reports,
      count: reports.length,
      pendingReview: reports.filter(r => !r.providerReviewed).length
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error fetching provider reports:", error);
    res.status(500).json({ success: false, error: "Failed to fetch patient reports" });
  }
});

router.get("/provider/patient/:patientId/reports", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { patientId } = req.params;
    const { limit = "20" } = req.query;
    
    logHipaaAudit("PROVIDER_PATIENT_REPORTS_VIEW", { 
      providerId: hashIdentifier(providerId),
      patientId: hashIdentifier(patientId)
    });
    
    const reports = await db.select().from(patientOutcomeReportsTable)
      .where(eq(patientOutcomeReportsTable.profileId, patientId))
      .orderBy(desc(patientOutcomeReportsTable.createdAt))
      .limit(parseInt(limit as string) || 20);
    
    const summary = await getPatientSummary(patientId, 90);
    
    res.json({ 
      success: true, 
      reports,
      summary
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error fetching patient reports:", error);
    res.status(500).json({ success: false, error: "Failed to fetch patient reports" });
  }
});

async function getPatientSummary(patientId: string, days: number) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const reports = await db.select().from(patientOutcomeReportsTable)
    .where(and(
      eq(patientOutcomeReportsTable.profileId, patientId),
      gte(patientOutcomeReportsTable.createdAt, startDate)
    ));
  
  const avgQoL = reports.filter(r => r.qualityOfLifeRating).length > 0
    ? reports.reduce((sum, r) => sum + (r.qualityOfLifeRating || 0), 0) / reports.filter(r => r.qualityOfLifeRating).length
    : null;
  
  const avgSymptomSeverity = reports.filter(r => r.symptomSeverityRating).length > 0
    ? reports.reduce((sum, r) => sum + (r.symptomSeverityRating || 0), 0) / reports.filter(r => r.symptomSeverityRating).length
    : null;
  
  const avgSatisfaction = reports.filter(r => r.satisfactionRating).length > 0
    ? reports.reduce((sum, r) => sum + (r.satisfactionRating || 0), 0) / reports.filter(r => r.satisfactionRating).length
    : null;
  
  return {
    periodDays: days,
    totalReports: reports.length,
    averages: {
      qualityOfLife: avgQoL ? Math.round(avgQoL * 10) / 10 : null,
      symptomSeverity: avgSymptomSeverity ? Math.round(avgSymptomSeverity * 10) / 10 : null,
      satisfaction: avgSatisfaction ? Math.round(avgSatisfaction * 10) / 10 : null,
    },
    trends: {
      qolTrend: calculateTrend(reports, "qualityOfLifeRating"),
      symptomTrend: calculateTrend(reports, "symptomSeverityRating"),
      satisfactionTrend: calculateTrend(reports, "satisfactionRating"),
    },
  };
}

const reviewReportSchema = z.object({
  providerNotes: z.string().optional(),
});

router.patch("/provider/reports/:reportId/review", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { reportId } = req.params;
    
    const validation = reviewReportSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid review data",
        details: validation.error.errors 
      });
    }
    
    logHipaaAudit("REPORT_REVIEWED", { 
      providerId: hashIdentifier(providerId),
      reportId: hashIdentifier(reportId)
    });
    
    const [updated] = await db.update(patientOutcomeReportsTable)
      .set({
        providerReviewed: true,
        providerReviewedAt: new Date(),
        providerReviewedBy: providerId,
        providerNotes: validation.data.providerNotes,
        updatedAt: new Date(),
      })
      .where(eq(patientOutcomeReportsTable.id, reportId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    
    res.json({ 
      success: true, 
      report: updated,
      message: "Report marked as reviewed" 
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error reviewing report:", error);
    res.status(500).json({ success: false, error: "Failed to review report" });
  }
});

router.get("/provider/analytics", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { days = "30" } = req.query;
    
    const daysNum = parseInt(days as string) || 30;
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
    
    logHipaaAudit("PROVIDER_ANALYTICS_VIEW", { 
      providerId: hashIdentifier(providerId),
      days: daysNum
    });
    
    const reports = await db.select().from(patientOutcomeReportsTable)
      .where(gte(patientOutcomeReportsTable.createdAt, startDate));
    
    const symptoms = await db.select().from(patientSymptomLogsTable)
      .where(gte(patientSymptomLogsTable.loggedAt, startDate));
    
    const reportsByType: Record<string, number> = {};
    reports.forEach(r => {
      reportsByType[r.reportType] = (reportsByType[r.reportType] || 0) + 1;
    });
    
    const avgQoL = reports.filter(r => r.qualityOfLifeRating).length > 0
      ? reports.reduce((sum, r) => sum + (r.qualityOfLifeRating || 0), 0) / reports.filter(r => r.qualityOfLifeRating).length
      : null;
    
    const avgSatisfaction = reports.filter(r => r.satisfactionRating).length > 0
      ? reports.reduce((sum, r) => sum + (r.satisfactionRating || 0), 0) / reports.filter(r => r.satisfactionRating).length
      : null;
    
    const symptomCounts: Record<string, number> = {};
    symptoms.forEach(s => {
      symptomCounts[s.symptomName] = (symptomCounts[s.symptomName] || 0) + 1;
    });
    
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    res.json({
      success: true,
      analytics: {
        periodDays: daysNum,
        totalReports: reports.length,
        pendingReview: reports.filter(r => !r.providerReviewed).length,
        reportsByType,
        populationAverages: {
          qualityOfLife: avgQoL ? Math.round(avgQoL * 10) / 10 : null,
          satisfaction: avgSatisfaction ? Math.round(avgSatisfaction * 10) / 10 : null,
        },
        topSymptoms,
        recommendationRate: reports.filter(r => r.wouldRecommend !== null).length > 0
          ? Math.round((reports.filter(r => r.wouldRecommend).length / reports.filter(r => r.wouldRecommend !== null).length) * 100)
          : null,
      },
    });
  } catch (error) {
    console.error("[PatientOutcomes] Error fetching analytics:", error);
    res.status(500).json({ success: false, error: "Failed to fetch analytics" });
  }
});

console.log("[PatientReportedOutcomes] Routes registered at /api/patient-outcomes/*");
console.log("[PatientReportedOutcomes] Patient endpoints: reports, symptoms, feedback, summary");
console.log("[PatientReportedOutcomes] Provider endpoints: patients/reports, patient/:id/reports, reports/:id/review, analytics");

export default router;
