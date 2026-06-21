import { Router, Request, Response } from "express";
import { logPhiAccess } from "./security/hipaa-audit";
import {
  insertSymptomLogSchema,
  insertAdherenceLogSchema,
  insertLifestyleLogSchema,
  chronicConditionTypes,
} from "@shared/schema";
import * as cdmService from "./services/ai-chronic-disease-management";

const router = Router();

const isDevelopment = process.env.NODE_ENV !== "production";

function getPatientId(req: any): string | null {
  if (req.user?.claims?.sub) {
    return req.user.claims.sub;
  }
  if (isDevelopment) {
    return "patient-001";
  }
  return null;
}

function requirePatient(req: Request, res: Response): string | null {
  const patientId = getPatientId(req);
  if (!patientId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return patientId;
}

router.get("/dashboard", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const summary = await cdmService.getDashboardSummary(patientId);
    res.json(summary);
  } catch (error) {
    console.error("[ChronicDisease] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.get("/conditions", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const conditions = await cdmService.getPatientConditions(patientId);
    res.json(conditions);
  } catch (error) {
    console.error("[ChronicDisease] Conditions error:", error);
    res.status(500).json({ error: "Failed to load conditions" });
  }
});

router.post("/conditions", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const { conditionType, conditionName, diagnosisDate, severity, notes } = req.body;
    
    if (!conditionType || !chronicConditionTypes.includes(conditionType)) {
      return res.status(400).json({ error: "Invalid condition type" });
    }

    const condition = await cdmService.addConditionProfile(
      patientId,
      conditionType,
      conditionName || conditionType.replace(/_/g, " "),
      diagnosisDate,
      severity,
      notes
    );
    res.status(201).json(condition);
  } catch (error) {
    console.error("[ChronicDisease] Add condition error:", error);
    res.status(500).json({ error: "Failed to add condition" });
  }
});

router.get("/plans", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const plans = await cdmService.getPatientPlans(patientId);
    res.json(plans);
  } catch (error) {
    console.error("[ChronicDisease] Plans error:", error);
    res.status(500).json({ error: "Failed to load plans" });
  }
});

router.get("/plans/:planId", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const plan = await cdmService.getManagementPlan(patientId, req.params.planId);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.json(plan);
  } catch (error) {
    console.error("[ChronicDisease] Plan error:", error);
    res.status(500).json({ error: "Failed to load plan" });
  }
});

router.post("/plans/generate", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const { conditionId } = req.body;
    if (!conditionId) {
      return res.status(400).json({ error: "conditionId is required" });
    }

    const plan = await cdmService.generateManagementPlan(patientId, conditionId);
    res.status(201).json(plan);
  } catch (error: any) {
    console.error("[ChronicDisease] Generate plan error:", error);
    res.status(500).json({ error: error.message || "Failed to generate plan" });
  }
});

router.patch("/plans/:planId/status", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const { status } = req.body;
    const plan = await cdmService.updatePlanStatus(patientId, req.params.planId, status);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.json(plan);
  } catch (error) {
    console.error("[ChronicDisease] Update plan error:", error);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.post("/plans/:planId/progress", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const snapshot = await cdmService.generateProgressSnapshot(patientId, req.params.planId);
    res.status(201).json(snapshot);
  } catch (error: any) {
    console.error("[ChronicDisease] Progress snapshot error:", error);
    res.status(500).json({ error: error.message || "Failed to generate progress" });
  }
});

router.get("/plans/:planId/progress", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const snapshots = await cdmService.getProgressSnapshots(patientId, req.params.planId);
    res.json(snapshots);
  } catch (error) {
    console.error("[ChronicDisease] Progress history error:", error);
    res.status(500).json({ error: "Failed to load progress history" });
  }
});

router.get("/symptoms", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await cdmService.getSymptomLogs(patientId, limit);
    res.json(logs);
  } catch (error) {
    console.error("[ChronicDisease] Symptoms error:", error);
    res.status(500).json({ error: "Failed to load symptoms" });
  }
});

router.post("/symptoms", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const validated = insertSymptomLogSchema.parse({ ...req.body, patientId });
    const log = await cdmService.logSymptom(validated);
    res.status(201).json(log);
  } catch (error) {
    console.error("[ChronicDisease] Log symptom error:", error);
    res.status(400).json({ error: "Invalid symptom data" });
  }
});

router.get("/adherence", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await cdmService.getAdherenceLogs(patientId, limit);
    res.json(logs);
  } catch (error) {
    console.error("[ChronicDisease] Adherence error:", error);
    res.status(500).json({ error: "Failed to load adherence logs" });
  }
});

router.post("/adherence", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const validated = insertAdherenceLogSchema.parse({ ...req.body, patientId });
    const log = await cdmService.logAdherence(validated);
    res.status(201).json(log);
  } catch (error) {
    console.error("[ChronicDisease] Log adherence error:", error);
    res.status(400).json({ error: "Invalid adherence data" });
  }
});

router.get("/lifestyle", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await cdmService.getLifestyleLogs(patientId, limit);
    res.json(logs);
  } catch (error) {
    console.error("[ChronicDisease] Lifestyle error:", error);
    res.status(500).json({ error: "Failed to load lifestyle logs" });
  }
});

router.post("/lifestyle", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const validated = insertLifestyleLogSchema.parse({ ...req.body, patientId });
    const log = await cdmService.logLifestyle(validated);
    res.status(201).json(log);
  } catch (error) {
    console.error("[ChronicDisease] Log lifestyle error:", error);
    res.status(400).json({ error: "Invalid lifestyle data" });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const includeRead = req.query.includeRead === "true";
    const alerts = await cdmService.getAlerts(patientId, includeRead);
    res.json(alerts);
  } catch (error) {
    console.error("[ChronicDisease] Alerts error:", error);
    res.status(500).json({ error: "Failed to load alerts" });
  }
});

router.patch("/alerts/:alertId/read", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const success = await cdmService.markAlertRead(patientId, req.params.alertId);
    res.json({ success });
  } catch (error) {
    console.error("[ChronicDisease] Mark read error:", error);
    res.status(500).json({ error: "Failed to mark alert as read" });
  }
});

router.patch("/alerts/:alertId/dismiss", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const success = await cdmService.dismissAlert(patientId, req.params.alertId);
    res.json({ success });
  } catch (error) {
    console.error("[ChronicDisease] Dismiss error:", error);
    res.status(500).json({ error: "Failed to dismiss alert" });
  }
});

router.get("/education", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const content = await cdmService.getEducationContent(patientId);
    res.json(content);
  } catch (error) {
    console.error("[ChronicDisease] Education error:", error);
    res.status(500).json({ error: "Failed to load education content" });
  }
});

router.post("/education/generate", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const { conditionType, topic } = req.body;
    if (!conditionType || !chronicConditionTypes.includes(conditionType)) {
      return res.status(400).json({ error: "Valid conditionType is required" });
    }

    const content = await cdmService.generateEducationContent(patientId, conditionType, topic);
    res.status(201).json(content);
  } catch (error) {
    console.error("[ChronicDisease] Generate education error:", error);
    res.status(500).json({ error: "Failed to generate education content" });
  }
});

router.patch("/education/:contentId/complete", async (req: Request, res: Response) => {
  const patientId = requirePatient(req, res);
  if (!patientId) return;

  try {
    const { feedback } = req.body;
    const success = await cdmService.markEducationCompleted(patientId, req.params.contentId, feedback);
    res.json({ success });
  } catch (error) {
    console.error("[ChronicDisease] Complete education error:", error);
    res.status(500).json({ error: "Failed to mark as completed" });
  }
});

export default router;
