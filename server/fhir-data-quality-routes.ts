import { Router, Request, Response } from "express";
import { fhirDataQualityService, IssueStatus, ValidationSeverity, ValidationCategory } from "./services/fhir-data-quality-service";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

router.get("/metadata", (req: Request, res: Response) => {
  try {
    const metadata = fhirDataQualityService.getMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[FHIRDataQuality] Metadata error:", error);
    res.status(500).json({ error: "Failed to get service metadata" });
  }
});

router.get("/dashboard", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const dashboard = fhirDataQualityService.getDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    console.error("[FHIRDataQuality] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard" });
  }
});

router.get("/issues", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const filters = {
      status: req.query.status as IssueStatus | undefined,
      severity: req.query.severity as ValidationSeverity | undefined,
      resourceType: req.query.resourceType as string | undefined,
      category: req.query.category as ValidationCategory | undefined
    };
    const result = fhirDataQualityService.getIssues(filters, userId);
    res.json(result);
  } catch (error) {
    console.error("[FHIRDataQuality] Issues list error:", error);
    res.status(500).json({ error: "Failed to get issues" });
  }
});

router.get("/issues/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const result = fhirDataQualityService.getIssue(req.params.id, userId);
    if (!result) {
      return res.status(404).json({ error: "Issue not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("[FHIRDataQuality] Issue detail error:", error);
    res.status(500).json({ error: "Failed to get issue" });
  }
});

router.patch("/issues/:id/status", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }
    const result = fhirDataQualityService.updateIssueStatus(req.params.id, status, userId, notes);
    if (!result) {
      return res.status(404).json({ error: "Issue not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("[FHIRDataQuality] Status update error:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.post("/issues/:id/suggestion", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const suggestion = await fhirDataQualityService.generateAISuggestion(req.params.id, userId);
    if (!suggestion) {
      return res.status(404).json({ error: "Issue not found" });
    }
    res.json(suggestion);
  } catch (error) {
    console.error("[FHIRDataQuality] AI suggestion error:", error);
    res.status(500).json({ error: "Failed to generate suggestion" });
  }
});

router.post("/issues/:id/correct", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { correctedValue } = req.body;
    if (correctedValue === undefined) {
      return res.status(400).json({ error: "Corrected value is required" });
    }
    const result = fhirDataQualityService.applyCorrection(req.params.id, correctedValue, userId);
    if (!result) {
      return res.status(404).json({ error: "Issue not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("[FHIRDataQuality] Correction error:", error);
    res.status(500).json({ error: "Failed to apply correction" });
  }
});

router.get("/rules", (req: Request, res: Response) => {
  try {
    const result = fhirDataQualityService.getRules();
    res.json(result);
  } catch (error) {
    console.error("[FHIRDataQuality] Rules list error:", error);
    res.status(500).json({ error: "Failed to get rules" });
  }
});

router.patch("/rules/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { enabled } = req.body;
    if (enabled === undefined) {
      return res.status(400).json({ error: "Enabled flag is required" });
    }
    const result = fhirDataQualityService.toggleRule(req.params.id, enabled, userId);
    if (!result) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("[FHIRDataQuality] Rule toggle error:", error);
    res.status(500).json({ error: "Failed to toggle rule" });
  }
});

router.post("/scan", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const scan = fhirDataQualityService.runValidationScan(userId);
    res.json(scan);
  } catch (error) {
    console.error("[FHIRDataQuality] Scan error:", error);
    res.status(500).json({ error: "Failed to run validation scan" });
  }
});

router.get("/scans", (req: Request, res: Response) => {
  try {
    const scans = fhirDataQualityService.getScans();
    res.json({ scans });
  } catch (error) {
    console.error("[FHIRDataQuality] Scans list error:", error);
    res.status(500).json({ error: "Failed to get scans" });
  }
});

export default router;
