import { Router, Request, Response } from "express";
import {
  getClinicalAiAuditDashboard,
  getClinicalAiAuditEntry,
  verifyClinicalAiAudit,
} from "./services/clinical-ai-audit-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    name: "Clinical AI Audit",
    version: "1.0.0",
    description: "Med-Gemini AI safety audit with confidence scoring, source grounding, explainability, and human-in-the-loop verification",
    model: "med-gemini-1.5-pro",
    features: [
      "Confidence scoring with amber threshold (<80%)",
      "Source grounding with deep-link to EHR records",
      "SHAP/LIME explainability factors",
      "Human-in-the-loop verify/flag (RLHF)",
    ],
    noCdsDisclaimer: "All AI outputs are informational only and do not constitute clinical decision support. Always verify with clinical judgment.",
  });
});

router.get("/dashboard", (_req: Request, res: Response) => {
  try {
    const dashboard = getClinicalAiAuditDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[ClinicalAIAudit] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard" });
  }
});

router.get("/entries/:entryId", (req: Request, res: Response) => {
  try {
    const entry = getClinicalAiAuditEntry(req.params.entryId);
    if (!entry) {
      return res.status(404).json({ error: "Audit entry not found" });
    }
    res.json(entry);
  } catch (error) {
    console.error("[ClinicalAIAudit] Entry error:", error);
    res.status(500).json({ error: "Failed to get entry" });
  }
});

router.post("/entries/:entryId/verify", (req: Request, res: Response) => {
  try {
    const { verification, feedback, clinicianName } = req.body;
    if (!verification || !["verified", "flagged"].includes(verification)) {
      return res.status(400).json({ error: "Invalid verification status. Must be 'verified' or 'flagged'" });
    }
    if (!clinicianName) {
      return res.status(400).json({ error: "Clinician name is required" });
    }
    if (verification === "flagged" && !feedback) {
      return res.status(400).json({ error: "Feedback is required when flagging an entry" });
    }

    const result = verifyClinicalAiAudit(req.params.entryId, {
      verification,
      feedback,
      clinicianName,
    });

    console.log(`[HIPAA-AUDIT][ClinicalAIAudit] Verification: ${verification} for ${req.params.entryId} by ${clinicianName}`);
    res.json(result);
  } catch (error: any) {
    console.error("[ClinicalAIAudit] Verify error:", error);
    res.status(500).json({ error: error.message || "Failed to verify entry" });
  }
});

export default router;
