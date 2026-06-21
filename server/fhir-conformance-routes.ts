import { Router, Request, Response } from "express";
import { conformanceCheckingService } from "./services/fhir-conformance-checking-service";

const router = Router();

router.get("/profiles", (_req: Request, res: Response) => {
  try {
    const profiles = conformanceCheckingService.getProfiles();
    res.json({ profiles });
  } catch (error) {
    console.error("[ConformanceRoutes] Error getting profiles:", error);
    res.status(500).json({ error: "Failed to get profiles" });
  }
});

router.get("/resources", (_req: Request, res: Response) => {
  try {
    const resources = conformanceCheckingService.getStoredResources();
    res.json({ resources });
  } catch (error) {
    console.error("[ConformanceRoutes] Error getting resources:", error);
    res.status(500).json({ error: "Failed to get resources" });
  }
});

router.get("/issues", (req: Request, res: Response) => {
  try {
    const { status, severity, profileId, resourceType } = req.query;
    const issues = conformanceCheckingService.getIssues({
      status: status as string,
      severity: severity as string,
      profileId: profileId as string,
      resourceType: resourceType as string,
    });
    res.json({ issues });
  } catch (error) {
    console.error("[ConformanceRoutes] Error getting issues:", error);
    res.status(500).json({ error: "Failed to get issues" });
  }
});

router.patch("/issues/:id/status", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !["open", "fixed", "ignored", "pending-review"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const issue = conformanceCheckingService.updateIssueStatus(id, status);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }
    res.json({ issue });
  } catch (error) {
    console.error("[ConformanceRoutes] Error updating issue:", error);
    res.status(500).json({ error: "Failed to update issue" });
  }
});

router.get("/reports", (_req: Request, res: Response) => {
  try {
    const reports = conformanceCheckingService.getReports();
    res.json({ reports });
  } catch (error) {
    console.error("[ConformanceRoutes] Error getting reports:", error);
    res.status(500).json({ error: "Failed to get reports" });
  }
});

router.get("/reports/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = conformanceCheckingService.getReport(id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json({ report });
  } catch (error) {
    console.error("[ConformanceRoutes] Error getting report:", error);
    res.status(500).json({ error: "Failed to get report" });
  }
});

router.get("/scans", (_req: Request, res: Response) => {
  try {
    const scans = conformanceCheckingService.getScanResults();
    res.json({ scans });
  } catch (error) {
    console.error("[ConformanceRoutes] Error getting scans:", error);
    res.status(500).json({ error: "Failed to get scans" });
  }
});

router.post("/scan", async (_req: Request, res: Response) => {
  try {
    const result = await conformanceCheckingService.runFullScan();
    res.json({ scan: result });
  } catch (error) {
    console.error("[ConformanceRoutes] Error running scan:", error);
    res.status(500).json({ error: "Failed to run scan" });
  }
});

router.post("/validate/:resourceId", async (req: Request, res: Response) => {
  try {
    const { resourceId } = req.params;
    const resource = conformanceCheckingService.getStoredResource(resourceId);
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }
    const report = await conformanceCheckingService.validateResource(resource);
    res.json({ report });
  } catch (error) {
    console.error("[ConformanceRoutes] Error validating resource:", error);
    res.status(500).json({ error: "Failed to validate resource" });
  }
});

router.get("/dashboard", (_req: Request, res: Response) => {
  try {
    const stats = conformanceCheckingService.getDashboardStats();
    res.json({ stats });
  } catch (error) {
    console.error("[ConformanceRoutes] Error getting dashboard:", error);
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

router.post("/auto-fix/:issueId", async (req: Request, res: Response) => {
  try {
    const { issueId } = req.params;
    const result = await conformanceCheckingService.applyAutoFix(issueId);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    res.json(result);
  } catch (error) {
    console.error("[ConformanceRoutes] Error applying auto-fix:", error);
    res.status(500).json({ error: "Failed to apply auto-fix" });
  }
});

router.post("/auto-fix-batch", async (req: Request, res: Response) => {
  try {
    const { issueIds } = req.body;
    if (!Array.isArray(issueIds)) {
      return res.status(400).json({ error: "issueIds must be an array" });
    }
    const result = await conformanceCheckingService.applyMultipleAutoFixes(issueIds);
    res.json(result);
  } catch (error) {
    console.error("[ConformanceRoutes] Error applying batch auto-fix:", error);
    res.status(500).json({ error: "Failed to apply batch auto-fix" });
  }
});

router.post("/ai-suggestions", async (req: Request, res: Response) => {
  try {
    const { issueIds } = req.body;
    if (!Array.isArray(issueIds)) {
      return res.status(400).json({ error: "issueIds must be an array" });
    }
    const suggestions = await conformanceCheckingService.generateAICorrections(issueIds);
    res.json({ suggestions });
  } catch (error) {
    console.error("[ConformanceRoutes] Error generating AI suggestions:", error);
    res.status(500).json({ error: "Failed to generate AI suggestions" });
  }
});

router.post("/scheduler/start", (req: Request, res: Response) => {
  try {
    const { intervalMinutes } = req.body;
    conformanceCheckingService.startScheduler(intervalMinutes || 60);
    res.json({ status: "started", intervalMinutes: intervalMinutes || 60 });
  } catch (error) {
    console.error("[ConformanceRoutes] Error starting scheduler:", error);
    res.status(500).json({ error: "Failed to start scheduler" });
  }
});

router.post("/scheduler/stop", (_req: Request, res: Response) => {
  try {
    conformanceCheckingService.stopScheduler();
    res.json({ status: "stopped" });
  } catch (error) {
    console.error("[ConformanceRoutes] Error stopping scheduler:", error);
    res.status(500).json({ error: "Failed to stop scheduler" });
  }
});

router.get("/scheduler/status", (_req: Request, res: Response) => {
  try {
    const isActive = conformanceCheckingService.isSchedulerActive();
    const lastScan = conformanceCheckingService.getLastScanTime();
    res.json({ isActive, lastScan });
  } catch (error) {
    console.error("[ConformanceRoutes] Error getting scheduler status:", error);
    res.status(500).json({ error: "Failed to get scheduler status" });
  }
});

export default router;
