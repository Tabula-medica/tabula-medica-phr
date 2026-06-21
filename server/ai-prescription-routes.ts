import { Router, Request, Response } from "express";
import {
  getMedicationSuggestions,
  generateAutoRefillRequests,
  getRefillRequests,
  updateRefillRequestStatus,
  identifyAdherenceIssues,
  getAdherenceDashboard,
  MedicationSelectionRequest
} from "./services/ai-prescription-management-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    name: "AI Prescription Management",
    version: "1.0.0",
    description: "AI-powered prescription assistance for clinicians",
    features: [
      "AI medication selection with drug interaction checking",
      "Allergy cross-reactivity detection",
      "Automated refill request generation",
      "Medication adherence issue identification",
      "AI-suggested interventions for adherence"
    ],
    disclaimer: "AI assistance is informational only. All prescribing decisions require clinician review."
  });
});

router.post("/medication-suggestions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const request: MedicationSelectionRequest = req.body;
    
    if (!request.patientProfile || !request.indication) {
      return res.status(400).json({ 
        error: "Missing required fields: patientProfile, indication" 
      });
    }
    
    const suggestions = await getMedicationSuggestions(userId, request);
    res.json(suggestions);
  } catch (error) {
    console.error("[AIPrescription] Medication suggestions error:", error);
    res.status(500).json({ error: "Failed to generate medication suggestions" });
  }
});

router.post("/refills/generate/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { patientId } = req.params;
    
    const refills = await generateAutoRefillRequests(userId, patientId);
    res.json({
      generated: refills.length,
      refills,
      message: refills.length > 0 
        ? `Generated ${refills.length} refill request(s) for review`
        : "No refills needed at this time"
    });
  } catch (error) {
    console.error("[AIPrescription] Generate refills error:", error);
    res.status(500).json({ error: "Failed to generate refill requests" });
  }
});

router.get("/refills", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const patientId = req.query.patientId as string | undefined;
    
    const refills = await getRefillRequests(userId, patientId);
    res.json({ refills, count: refills.length });
  } catch (error) {
    console.error("[AIPrescription] Get refills error:", error);
    res.status(500).json({ error: "Failed to get refill requests" });
  }
});

const VALID_REFILL_STATUSES = ["draft", "pending_review", "approved", "sent", "denied"] as const;
type RefillStatus = typeof VALID_REFILL_STATUSES[number];

router.patch("/refills/:requestId/status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { requestId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }
    
    if (!VALID_REFILL_STATUSES.includes(status as RefillStatus)) {
      return res.status(400).json({ 
        error: `Invalid status. Valid values: ${VALID_REFILL_STATUSES.join(", ")}` 
      });
    }
    
    const updated = await updateRefillRequestStatus(userId, requestId, status);
    
    if (!updated) {
      return res.status(404).json({ error: "Refill request not found" });
    }
    
    res.json(updated);
  } catch (error) {
    console.error("[AIPrescription] Update refill status error:", error);
    res.status(500).json({ error: "Failed to update refill status" });
  }
});

router.get("/adherence/issues/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { patientId } = req.params;
    
    const issues = await identifyAdherenceIssues(userId, patientId);
    res.json({ issues, count: issues.length });
  } catch (error) {
    console.error("[AIPrescription] Adherence issues error:", error);
    res.status(500).json({ error: "Failed to identify adherence issues" });
  }
});

router.get("/adherence/dashboard/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { patientId } = req.params;
    
    const dashboard = await getAdherenceDashboard(userId, patientId);
    res.json(dashboard);
  } catch (error) {
    console.error("[AIPrescription] Adherence dashboard error:", error);
    res.status(500).json({ error: "Failed to get adherence dashboard" });
  }
});

export default router;
