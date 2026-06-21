import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import {
  getPatient360View,
  generatePatient360Summary,
  listPatients,
  getPatient360Stats,
  Patient360Request
} from "./services/ai-patient-360";

const router = Router();

function logAudit(action: string, req: Request, details: Record<string, any>): void {
  const userId = (req as any).user?.id || "anonymous";
  const hashedUserId = crypto.createHash("sha256").update(userId).digest("hex").substring(0, 16);
  console.log(`[HIPAA Audit] [Patient360] Action: ${action}, User: ${hashedUserId}, IP: ${req.ip}, Details: ${JSON.stringify(details)}`);
}

const Patient360RequestSchema = z.object({
  patientId: z.string().min(1),
  includeResources: z.boolean().optional().default(true),
  includeAIInsights: z.boolean().optional().default(true),
  resourceTypes: z.array(z.string()).optional()
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    logAudit("get_stats", req, {});
    const stats = getPatient360Stats();
    res.json({
      ...stats,
      noCdsCompliance: "Statistics for data integration monitoring only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Patient360] Error getting stats:", error);
    res.status(500).json({ error: "Failed to get Patient 360 statistics" });
  }
});

router.get("/patients", async (req: Request, res: Response) => {
  try {
    logAudit("list_patients", req, {});
    const patients = listPatients();
    res.json({
      patients,
      noCdsCompliance: "Patient list for data integration purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Patient360] Error listing patients:", error);
    res.status(500).json({ error: "Failed to list patients" });
  }
});

router.get("/view/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const includeResources = req.query.includeResources !== "false";
    const includeAIInsights = req.query.includeAIInsights !== "false";
    const resourceTypes = req.query.resourceTypes
      ? String(req.query.resourceTypes).split(",")
      : undefined;

    logAudit("get_patient_360_view", req, { patientId, includeResources, includeAIInsights });

    const request: Patient360Request = {
      patientId,
      includeResources,
      includeAIInsights,
      resourceTypes
    };

    const view = await getPatient360View(request);

    if (!view) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({ view });
  } catch (error) {
    console.error("[Patient360] Error getting patient view:", error);
    res.status(500).json({ error: "Failed to get Patient 360 view" });
  }
});

router.post("/view", async (req: Request, res: Response) => {
  try {
    const validation = Patient360RequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const request = validation.data;
    logAudit("get_patient_360_view_post", req, { patientId: request.patientId });

    const view = await getPatient360View(request);

    if (!view) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({ view });
  } catch (error) {
    console.error("[Patient360] Error getting patient view:", error);
    res.status(500).json({ error: "Failed to get Patient 360 view" });
  }
});

router.get("/summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    logAudit("get_patient_summary", req, { patientId });

    const summary = await generatePatient360Summary(patientId);

    res.json({
      patientId,
      summary,
      noCdsCompliance: "Summary for data integration purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Patient360] Error generating summary:", error);
    res.status(500).json({ error: "Failed to generate patient summary" });
  }
});

export default router;
