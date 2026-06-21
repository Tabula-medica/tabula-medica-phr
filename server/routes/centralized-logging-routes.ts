import { Router, type Request, type Response } from "express";
import { centralizedLoggingComplianceService } from "../services/centralized-logging-compliance-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json(centralizedLoggingComplianceService.getMetadata());
});

router.get("/dashboard", (_req: Request, res: Response) => {
  res.json(centralizedLoggingComplianceService.getDashboard());
});

router.get("/sinks", (_req: Request, res: Response) => {
  res.json({ sinks: centralizedLoggingComplianceService.getSinks() });
});

router.get("/retention-evidence", (_req: Request, res: Response) => {
  res.json({ evidence: centralizedLoggingComplianceService.getRetentionEvidence() });
});

router.get("/export-targets", (_req: Request, res: Response) => {
  res.json({ targets: centralizedLoggingComplianceService.getExportTargets() });
});

router.get("/verify-retention", (_req: Request, res: Response) => {
  res.json({ verification: centralizedLoggingComplianceService.verifyRetention() });
});

export default router;
