import { Router, type Request, type Response } from "express";
import { thirdPartyDataGovernanceService } from "../services/third-party-data-governance-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json(thirdPartyDataGovernanceService.getMetadata());
});

router.get("/dashboard", (_req: Request, res: Response) => {
  try {
    res.json(thirdPartyDataGovernanceService.getDashboard());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/integrations", (req: Request, res: Response) => {
  const { status, category, riskLevel } = req.query;
  const integrations = thirdPartyDataGovernanceService.getIntegrations({
    status: status as string,
    category: category as string,
    riskLevel: riskLevel as string,
  });
  res.json({ integrations, total: integrations.length });
});

router.get("/integrations/:id", (req: Request, res: Response) => {
  const integration = thirdPartyDataGovernanceService.getIntegrationById(req.params.id);
  if (!integration) {
    return res.status(404).json({ error: "Integration not found" });
  }
  res.json(integration);
});

router.get("/data-flows", (req: Request, res: Response) => {
  const { sensitivityLevel, direction, crossBorder } = req.query;
  const result = thirdPartyDataGovernanceService.getDataFlows({
    sensitivityLevel: sensitivityLevel as string,
    direction: direction as string,
    crossBorder: crossBorder === "true" ? true : crossBorder === "false" ? false : undefined,
  });
  res.json(result);
});

router.get("/compliance-checks", (_req: Request, res: Response) => {
  try {
    const checks = thirdPartyDataGovernanceService.runAllFrameworkChecks();
    const byFramework: Record<string, any[]> = {};
    for (const check of checks) {
      if (!byFramework[check.framework]) byFramework[check.framework] = [];
      byFramework[check.framework].push(check);
    }
    res.json({
      checks,
      total: checks.length,
      compliant: checks.filter((c) => c.status === "compliant").length,
      nonCompliant: checks.filter((c) => c.status === "non_compliant").length,
      partial: checks.filter((c) => c.status === "partial").length,
      byFramework,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/contractual-coverage", (_req: Request, res: Response) => {
  res.json(thirdPartyDataGovernanceService.getContractualCoverageSummary());
});

router.get("/audit-events", (req: Request, res: Response) => {
  const { integrationId, eventType, outcome, limit } = req.query;
  const result = thirdPartyDataGovernanceService.getAuditEvents({
    integrationId: integrationId as string,
    eventType: eventType as string,
    outcome: outcome as string,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  });
  res.json(result);
});

router.post("/audit-events", (req: Request, res: Response) => {
  try {
    const event = thirdPartyDataGovernanceService.logAuditEvent(req.body);
    res.status(201).json(event);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/remediation-plan", (_req: Request, res: Response) => {
  try {
    res.json(thirdPartyDataGovernanceService.getRemediationPlan());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
