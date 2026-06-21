import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  aiAdminOperationsService,
  NO_CDS_DISCLAIMER,
} from "./services/ai-admin-operations-service";

const router = Router();

function getUserId(req: Request): string {
  return (req as any).user?.id || (req as any).userId || "anonymous";
}

function getProviderId(req: Request): string {
  return (req as any).user?.providerId || (req as any).providerId || "provider-001";
}

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    name: "AI Administrative Operations",
    version: "1.0.0",
    description: "AI-powered administrative automation for healthcare operations",
    features: [
      "Automated insurance eligibility verification",
      "AI-powered scheduling optimization",
      "Patient no-show prediction analytics",
      "AI-driven prior authorization management",
      "Intelligent patient inquiry routing",
      "AI billing and claims analysis"
    ],
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
});

router.get("/stats", (_req: Request, res: Response) => {
  try {
    const stats = aiAdminOperationsService.getStats();
    res.json({ success: true, data: stats, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Stats error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve statistics" });
  }
});

const eligibilityVerifySchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  insurerId: z.string(),
  insurerName: z.string(),
  memberId: z.string(),
  groupNumber: z.string().optional()
});

router.post("/eligibility/verify", async (req: Request, res: Response) => {
  try {
    const body = eligibilityVerifySchema.parse(req.body);
    const result = await aiAdminOperationsService.verifyInsuranceEligibility(
      body.patientId,
      body.patientName,
      { insurerId: body.insurerId, insurerName: body.insurerName, memberId: body.memberId, groupNumber: body.groupNumber }
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Eligibility verification error:", error);
    res.status(500).json({ success: false, error: "Failed to verify eligibility" });
  }
});

router.get("/eligibility", (req: Request, res: Response) => {
  try {
    const patientId = req.query.patientId as string | undefined;
    const records = aiAdminOperationsService.getEligibilityRecords(patientId);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get eligibility error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve eligibility records" });
  }
});

const scheduleOptimizeSchema = z.object({
  providerId: z.string(),
  providerName: z.string(),
  date: z.string(),
  schedule: z.array(z.object({
    id: z.string(),
    time: z.string(),
    duration: z.number(),
    patientId: z.string().optional(),
    patientName: z.string().optional(),
    appointmentType: z.string(),
    status: z.enum(["scheduled", "available", "blocked", "buffer"])
  }))
});

router.post("/scheduling/optimize", async (req: Request, res: Response) => {
  try {
    const body = scheduleOptimizeSchema.parse(req.body);
    const result = await aiAdminOperationsService.optimizeSchedule(
      body.providerId,
      body.providerName,
      body.date,
      body.schedule
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Schedule optimization error:", error);
    res.status(500).json({ success: false, error: "Failed to optimize schedule" });
  }
});

router.get("/scheduling/optimizations", (req: Request, res: Response) => {
  try {
    const providerId = req.query.providerId as string | undefined;
    const records = aiAdminOperationsService.getOptimizations(providerId);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get optimizations error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve optimizations" });
  }
});

const noShowPredictSchema = z.object({
  appointmentId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  date: z.string(),
  time: z.string(),
  type: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  previousNoShows: z.number().optional(),
  totalAppointments: z.number().optional(),
  lastVisit: z.string().optional()
});

router.post("/no-show/predict", async (req: Request, res: Response) => {
  try {
    const body = noShowPredictSchema.parse(req.body);
    const result = await aiAdminOperationsService.predictNoShow(
      body.appointmentId,
      body.patientId,
      body.patientName,
      { date: body.date, time: body.time, type: body.type, providerId: body.providerId, providerName: body.providerName },
      body.previousNoShows !== undefined ? { previousNoShows: body.previousNoShows, totalAppointments: body.totalAppointments || 0, lastVisit: body.lastVisit } : undefined
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] No-show prediction error:", error);
    res.status(500).json({ success: false, error: "Failed to predict no-show" });
  }
});

router.get("/no-show/predictions", (req: Request, res: Response) => {
  try {
    const providerId = req.query.providerId as string | undefined;
    const highRiskOnly = req.query.highRiskOnly === "true";
    const records = aiAdminOperationsService.getNoShowPredictions(providerId, highRiskOnly);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get predictions error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve predictions" });
  }
});

const priorAuthCreateSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  insurerId: z.string(),
  insurerName: z.string(),
  serviceType: z.string(),
  procedureCode: z.string().optional(),
  diagnosisCode: z.string().optional(),
  urgency: z.enum(["routine", "urgent", "emergent"]),
  notes: z.string()
});

router.post("/prior-auth/create", async (req: Request, res: Response) => {
  try {
    const body = priorAuthCreateSchema.parse(req.body);
    const result = await aiAdminOperationsService.createPriorAuthorization(
      body.patientId,
      body.patientName,
      body.providerId,
      body.providerName,
      { id: body.insurerId, name: body.insurerName },
      { type: body.serviceType, procedureCode: body.procedureCode, diagnosisCode: body.diagnosisCode, urgency: body.urgency, notes: body.notes }
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Create prior auth error:", error);
    res.status(500).json({ success: false, error: "Failed to create prior authorization" });
  }
});

router.post("/prior-auth/:authId/submit", async (req: Request, res: Response) => {
  try {
    const { authId } = req.params;
    const result = await aiAdminOperationsService.submitPriorAuthorization(authId);
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Submit prior auth error:", error);
    res.status(500).json({ success: false, error: "Failed to submit prior authorization" });
  }
});

router.get("/prior-auth", (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const records = aiAdminOperationsService.getPriorAuthorizations(status);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get prior auths error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve prior authorizations" });
  }
});

const inquiryRouteSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  channel: z.enum(["phone", "email", "portal", "chat", "in_person"]),
  subject: z.string(),
  content: z.string()
});

router.post("/inquiries/route", async (req: Request, res: Response) => {
  try {
    const body = inquiryRouteSchema.parse(req.body);
    const result = await aiAdminOperationsService.routePatientInquiry(
      body.patientId,
      body.patientName,
      { channel: body.channel, subject: body.subject, content: body.content }
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Route inquiry error:", error);
    res.status(500).json({ success: false, error: "Failed to route inquiry" });
  }
});

router.get("/inquiries", (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const records = aiAdminOperationsService.getInquiries(status);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get inquiries error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve inquiries" });
  }
});

const claimAnalyzeSchema = z.object({
  claimId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  dateOfService: z.string(),
  totalAmount: z.number(),
  procedureCodes: z.array(z.string()),
  diagnosisCodes: z.array(z.string())
});

router.post("/claims/analyze", async (req: Request, res: Response) => {
  try {
    const body = claimAnalyzeSchema.parse(req.body);
    const result = await aiAdminOperationsService.analyzeBillingClaim(
      body.claimId,
      body.patientId,
      body.patientName,
      body.providerId,
      body.providerName,
      { dateOfService: body.dateOfService, totalAmount: body.totalAmount, procedureCodes: body.procedureCodes, diagnosisCodes: body.diagnosisCodes }
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Analyze claim error:", error);
    res.status(500).json({ success: false, error: "Failed to analyze claim" });
  }
});

router.get("/claims/analyses", (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const records = aiAdminOperationsService.getClaimAnalyses(status);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get claim analyses error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve claim analyses" });
  }
});

// === NEW FEATURE 1: Auto Form Population ===

const autoFormSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  formType: z.enum([
    "new_patient_registration",
    "health_history",
    "insurance_enrollment",
    "prior_authorization",
    "referral_request",
    "consent_form",
    "appointment_intake",
    "medication_reconciliation",
    "disability_claim",
    "fmla_request"
  ]),
  ehrData: z.record(z.any())
});

router.post("/forms/auto-populate", async (req: Request, res: Response) => {
  try {
    const body = autoFormSchema.parse(req.body);
    const result = await aiAdminOperationsService.autoPopulateForm(
      body.patientId,
      body.patientName,
      body.formType,
      body.ehrData
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Auto-populate form error:", error);
    res.status(500).json({ success: false, error: "Failed to auto-populate form" });
  }
});

router.get("/forms", (req: Request, res: Response) => {
  try {
    const patientId = req.query.patientId as string | undefined;
    const formType = req.query.formType as any;
    const records = aiAdminOperationsService.getAutoPopulatedForms(patientId, formType);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get forms error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve forms" });
  }
});

// === Pre-Authorization Request Generation ===

const preAuthRequestSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  insurerId: z.string(),
  insurerName: z.string(),
  serviceRequested: z.string(),
  procedureCodes: z.array(z.string()),
  diagnosisCodes: z.array(z.string()),
  clinicalData: z.record(z.any())
});

router.post("/preauth/generate", async (req: Request, res: Response) => {
  try {
    const body = preAuthRequestSchema.parse(req.body);
    const result = await aiAdminOperationsService.generatePreAuthRequest(
      body.patientId,
      body.patientName,
      { insurerId: body.insurerId, insurerName: body.insurerName },
      { serviceRequested: body.serviceRequested, procedureCodes: body.procedureCodes, diagnosisCodes: body.diagnosisCodes },
      body.clinicalData
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Generate pre-auth error:", error);
    res.status(500).json({ success: false, error: "Failed to generate pre-authorization request" });
  }
});

router.get("/preauth/requests", (req: Request, res: Response) => {
  try {
    const patientId = req.query.patientId as string | undefined;
    const status = req.query.status as string | undefined;
    const records = aiAdminOperationsService.getPreAuthRequests(patientId, status);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get pre-auth requests error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve pre-authorization requests" });
  }
});

// === NEW FEATURE 2: Resource Management ===

const resourceOptSchema = z.object({
  facilityId: z.string(),
  facilityName: z.string(),
  date: z.string(),
  resources: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["room", "equipment", "clinician", "staff"]),
    category: z.string().optional(),
    capacity: z.number().optional(),
    currentUtilization: z.number(),
    targetUtilization: z.number(),
    scheduledSlots: z.array(z.any()),
    availableSlots: z.array(z.any()),
    conflicts: z.array(z.any())
  }))
});

router.post("/resources/optimize", async (req: Request, res: Response) => {
  try {
    const body = resourceOptSchema.parse(req.body);
    const result = await aiAdminOperationsService.optimizeResources(
      body.facilityId,
      body.facilityName,
      body.date,
      body.resources
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Resource optimization error:", error);
    res.status(500).json({ success: false, error: "Failed to optimize resources" });
  }
});

router.get("/resources/optimizations", (req: Request, res: Response) => {
  try {
    const facilityId = req.query.facilityId as string | undefined;
    const records = aiAdminOperationsService.getResourceOptimizations(facilityId);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get resource optimizations error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve resource optimizations" });
  }
});

// === NEW FEATURE 3: Chart Review & Coding ===

const chartReviewSchema = z.object({
  encounterId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  encounterDate: z.string(),
  encounterType: z.string(),
  chiefComplaint: z.string(),
  diagnoses: z.array(z.string()),
  procedures: z.array(z.string()),
  clinicalNotes: z.string()
});

router.post("/charts/review", async (req: Request, res: Response) => {
  try {
    const body = chartReviewSchema.parse(req.body);
    const result = await aiAdminOperationsService.reviewChart(
      body.encounterId,
      body.patientId,
      body.patientName,
      body.providerId,
      body.providerName,
      {
        encounterDate: body.encounterDate,
        encounterType: body.encounterType,
        chiefComplaint: body.chiefComplaint,
        diagnoses: body.diagnoses,
        procedures: body.procedures,
        clinicalNotes: body.clinicalNotes
      }
    );
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Chart review error:", error);
    res.status(500).json({ success: false, error: "Failed to review chart" });
  }
});

router.get("/charts/reviews", (req: Request, res: Response) => {
  try {
    const providerId = req.query.providerId as string | undefined;
    const status = req.query.status as string | undefined;
    const records = aiAdminOperationsService.getChartReviews(providerId, status);
    res.json({ success: true, data: records, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Get chart reviews error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve chart reviews" });
  }
});

const chartStatusUpdateSchema = z.object({
  status: z.enum(["pending_review", "reviewed", "approved", "needs_amendment"]),
  reviewedBy: z.string().optional()
});

router.patch("/charts/reviews/:reviewId/status", (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const body = chartStatusUpdateSchema.parse(req.body);
    const result = aiAdminOperationsService.updateChartReviewStatus(reviewId, body.status, body.reviewedBy);
    if (!result) {
      return res.status(404).json({ success: false, error: "Chart review not found" });
    }
    res.json({ success: true, data: result, noCdsDisclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[AIAdminOps] Update chart status error:", error);
    res.status(500).json({ success: false, error: "Failed to update chart review status" });
  }
});

// === Dashboard Endpoint ===

router.get("/dashboard", (_req: Request, res: Response) => {
  try {
    const dashboard = aiAdminOperationsService.getAdminDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[AIAdminOps] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve dashboard" });
  }
});

export function registerAIAdminOperationsRoutes(app: any): void {
  app.use("/api/admin-operations", router);
  console.log("[Routes] AI Administrative Operations routes registered at /api/admin-operations/*");
}

export default router;
