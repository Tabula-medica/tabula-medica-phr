import { Router, Request, Response } from "express";
import { aiDataGovernanceService } from "./services/ai-data-governance-service";

const router = Router();

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const dashboard = aiDataGovernanceService.getGovernanceDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[AIDataGovernance] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch governance dashboard" });
  }
});

router.get("/classifications", async (req: Request, res: Response) => {
  try {
    const filters = {
      resourceType: req.query.resourceType as string | undefined,
      level: req.query.level as string | undefined,
      reviewRequired: req.query.reviewRequired === "true" ? true : req.query.reviewRequired === "false" ? false : undefined
    };
    const classifications = aiDataGovernanceService.getClassifications(filters);
    res.json(classifications);
  } catch (error) {
    console.error("[AIDataGovernance] Get classifications error:", error);
    res.status(500).json({ error: "Failed to fetch classifications" });
  }
});

router.get("/classifications/:id", async (req: Request, res: Response) => {
  try {
    const classification = aiDataGovernanceService.getClassification(req.params.id);
    if (!classification) {
      return res.status(404).json({ error: "Classification not found" });
    }
    res.json(classification);
  } catch (error) {
    console.error("[AIDataGovernance] Get classification error:", error);
    res.status(500).json({ error: "Failed to fetch classification" });
  }
});

router.post("/classify", async (req: Request, res: Response) => {
  try {
    const { resourceId, resourceType, resourceData } = req.body;
    if (!resourceId || !resourceType || !resourceData) {
      return res.status(400).json({ error: "resourceId, resourceType, and resourceData are required" });
    }
    const classification = await aiDataGovernanceService.classifyResource(resourceId, resourceType, resourceData);
    res.json(classification);
  } catch (error) {
    console.error("[AIDataGovernance] Classify error:", error);
    res.status(500).json({ error: "Failed to classify resource" });
  }
});

router.patch("/classifications/:id", async (req: Request, res: Response) => {
  try {
    const classification = aiDataGovernanceService.updateClassification(req.params.id, req.body);
    if (!classification) {
      return res.status(404).json({ error: "Classification not found" });
    }
    res.json(classification);
  } catch (error) {
    console.error("[AIDataGovernance] Update classification error:", error);
    res.status(500).json({ error: "Failed to update classification" });
  }
});

router.patch("/classifications/:id/review", async (req: Request, res: Response) => {
  try {
    const { reviewedBy, approved, newLevel } = req.body;
    const updates: Record<string, unknown> = {
      reviewRequired: false,
      lastReviewedAt: new Date().toISOString(),
      reviewedBy: reviewedBy || "admin"
    };
    if (newLevel) {
      updates.classificationLevel = newLevel;
      updates.classifiedBy = "manual";
    }
    const classification = aiDataGovernanceService.updateClassification(req.params.id, updates);
    if (!classification) {
      return res.status(404).json({ error: "Classification not found" });
    }
    res.json(classification);
  } catch (error) {
    console.error("[AIDataGovernance] Review classification error:", error);
    res.status(500).json({ error: "Failed to review classification" });
  }
});

router.get("/quality-checks", async (_req: Request, res: Response) => {
  try {
    const checks = aiDataGovernanceService.getQualityChecks();
    res.json(checks);
  } catch (error) {
    console.error("[AIDataGovernance] Get quality checks error:", error);
    res.status(500).json({ error: "Failed to fetch quality checks" });
  }
});

router.get("/quality-checks/:id", async (req: Request, res: Response) => {
  try {
    const check = aiDataGovernanceService.getQualityCheck(req.params.id);
    if (!check) {
      return res.status(404).json({ error: "Quality check not found" });
    }
    res.json(check);
  } catch (error) {
    console.error("[AIDataGovernance] Get quality check error:", error);
    res.status(500).json({ error: "Failed to fetch quality check" });
  }
});

router.post("/quality-checks", async (req: Request, res: Response) => {
  try {
    const { checkType, resourceType, fieldPath, rule, severity, enabled } = req.body;
    if (!checkType || !resourceType || !rule) {
      return res.status(400).json({ error: "checkType, resourceType, and rule are required" });
    }
    const check = aiDataGovernanceService.createQualityCheck({
      checkType,
      resourceType,
      fieldPath,
      rule,
      severity: severity || "warning",
      enabled: enabled !== false
    });
    res.status(201).json(check);
  } catch (error) {
    console.error("[AIDataGovernance] Create quality check error:", error);
    res.status(500).json({ error: "Failed to create quality check" });
  }
});

router.patch("/quality-checks/:id", async (req: Request, res: Response) => {
  try {
    const check = aiDataGovernanceService.updateQualityCheck(req.params.id, req.body);
    if (!check) {
      return res.status(404).json({ error: "Quality check not found" });
    }
    res.json(check);
  } catch (error) {
    console.error("[AIDataGovernance] Update quality check error:", error);
    res.status(500).json({ error: "Failed to update quality check" });
  }
});

router.post("/quality-checks/:id/run", async (req: Request, res: Response) => {
  try {
    const { resources } = req.body;
    if (!resources || !Array.isArray(resources)) {
      return res.status(400).json({ error: "resources array is required" });
    }
    const results = await aiDataGovernanceService.runQualityCheck(req.params.id, resources);
    res.json(results);
  } catch (error) {
    console.error("[AIDataGovernance] Run quality check error:", error);
    res.status(500).json({ error: "Failed to run quality check" });
  }
});

router.get("/anomalies", async (req: Request, res: Response) => {
  try {
    const filters = {
      severity: req.query.severity as string | undefined,
      resolved: req.query.resolved === "true" ? true : req.query.resolved === "false" ? false : undefined,
      resourceType: req.query.resourceType as string | undefined
    };
    const anomalies = aiDataGovernanceService.getAnomalies(filters);
    res.json(anomalies);
  } catch (error) {
    console.error("[AIDataGovernance] Get anomalies error:", error);
    res.status(500).json({ error: "Failed to fetch anomalies" });
  }
});

router.post("/anomalies/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { falsePositive } = req.body;
    const anomaly = aiDataGovernanceService.resolveAnomaly(req.params.id, falsePositive ?? false);
    if (!anomaly) {
      return res.status(404).json({ error: "Anomaly not found" });
    }
    res.json(anomaly);
  } catch (error) {
    console.error("[AIDataGovernance] Resolve anomaly error:", error);
    res.status(500).json({ error: "Failed to resolve anomaly" });
  }
});

router.post("/detect-anomalies", async (req: Request, res: Response) => {
  try {
    const { resources } = req.body;
    if (!resources || !Array.isArray(resources)) {
      return res.status(400).json({ error: "resources array is required" });
    }
    const anomalies = await aiDataGovernanceService.detectAnomalies(resources);
    res.json({ detected: anomalies.length, anomalies });
  } catch (error) {
    console.error("[AIDataGovernance] Detect anomalies error:", error);
    res.status(500).json({ error: "Failed to detect anomalies" });
  }
});

router.get("/policies", async (_req: Request, res: Response) => {
  try {
    const policies = aiDataGovernanceService.getAccessPolicies();
    res.json(policies);
  } catch (error) {
    console.error("[AIDataGovernance] Get policies error:", error);
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

router.get("/policies/:id", async (req: Request, res: Response) => {
  try {
    const policy = aiDataGovernanceService.getAccessPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json(policy);
  } catch (error) {
    console.error("[AIDataGovernance] Get policy error:", error);
    res.status(500).json({ error: "Failed to fetch policy" });
  }
});

router.post("/policies", async (req: Request, res: Response) => {
  try {
    const { name, description, enabled, priority, conditions, actions, resourceTypes, classificationLevels, createdBy } = req.body;
    if (!name || !conditions || !actions || !resourceTypes || !classificationLevels) {
      return res.status(400).json({ error: "name, conditions, actions, resourceTypes, and classificationLevels are required" });
    }
    const policy = aiDataGovernanceService.createAccessPolicy({
      name,
      description: description || "",
      enabled: enabled !== false,
      priority: priority || 10,
      conditions,
      actions,
      resourceTypes,
      classificationLevels,
      createdBy: createdBy || "admin"
    });
    res.status(201).json(policy);
  } catch (error) {
    console.error("[AIDataGovernance] Create policy error:", error);
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.patch("/policies/:id", async (req: Request, res: Response) => {
  try {
    const policy = aiDataGovernanceService.updateAccessPolicy(req.params.id, req.body);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json(policy);
  } catch (error) {
    console.error("[AIDataGovernance] Update policy error:", error);
    res.status(500).json({ error: "Failed to update policy" });
  }
});

router.delete("/policies/:id", async (req: Request, res: Response) => {
  try {
    const deleted = aiDataGovernanceService.deleteAccessPolicy(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[AIDataGovernance] Delete policy error:", error);
    res.status(500).json({ error: "Failed to delete policy" });
  }
});

router.post("/evaluate-access", async (req: Request, res: Response) => {
  try {
    const { userId, userRole, department, purpose, resourceId, resourceType, classificationLevel, operation, requestedFields } = req.body;
    if (!userId || !userRole || !purpose || !resourceId || !resourceType || !classificationLevel || !operation) {
      return res.status(400).json({ error: "userId, userRole, purpose, resourceId, resourceType, classificationLevel, and operation are required" });
    }
    const result = aiDataGovernanceService.evaluateAccessPolicy({
      userId,
      userRole,
      department,
      purpose,
      resourceId,
      resourceType,
      classificationLevel,
      operation,
      requestedFields
    });
    res.json(result);
  } catch (error) {
    console.error("[AIDataGovernance] Evaluate access error:", error);
    res.status(500).json({ error: "Failed to evaluate access" });
  }
});

router.get("/violations", async (req: Request, res: Response) => {
  try {
    const violations = aiDataGovernanceService.getPolicyViolations(
      req.query.startDate as string | undefined,
      req.query.endDate as string | undefined
    );
    res.json(violations);
  } catch (error) {
    console.error("[AIDataGovernance] Get violations error:", error);
    res.status(500).json({ error: "Failed to fetch violations" });
  }
});

router.post("/generate-report", async (_req: Request, res: Response) => {
  try {
    const report = await aiDataGovernanceService.generateGovernanceReport();
    res.json({
      ...report,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: This governance report is for AUDIT purposes ONLY. Not for clinical decision support."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Generate report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

router.get("/compliance/dashboard", async (_req: Request, res: Response) => {
  try {
    const dashboard = aiDataGovernanceService.getComplianceDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[AIDataGovernance] Compliance dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch compliance dashboard" });
  }
});

router.get("/compliance/requirements", async (req: Request, res: Response) => {
  try {
    const framework = req.query.framework as string | undefined;
    const requirements = aiDataGovernanceService.getComplianceRequirements(framework);
    res.json({
      items: requirements,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: These compliance requirements are for GOVERNANCE purposes ONLY."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Get requirements error:", error);
    res.status(500).json({ error: "Failed to fetch compliance requirements" });
  }
});

router.get("/compliance/requirements/:id", async (req: Request, res: Response) => {
  try {
    const requirement = aiDataGovernanceService.getComplianceRequirement(req.params.id);
    if (!requirement) {
      return res.status(404).json({ error: "Requirement not found" });
    }
    res.json({
      ...requirement,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: This compliance requirement is for GOVERNANCE purposes ONLY."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Get requirement error:", error);
    res.status(500).json({ error: "Failed to fetch compliance requirement" });
  }
});

router.post("/compliance/assess", async (req: Request, res: Response) => {
  try {
    const { resourceId, resourceType, resourceData } = req.body;
    if (!resourceId || !resourceType || !resourceData) {
      return res.status(400).json({ error: "resourceId, resourceType, and resourceData are required" });
    }
    const assessment = await aiDataGovernanceService.assessCompliance(resourceId, resourceType, resourceData);
    res.json({
      ...assessment,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: This compliance assessment is for AUDIT purposes ONLY. Not for clinical decision support."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Assess compliance error:", error);
    res.status(500).json({ error: "Failed to assess compliance" });
  }
});

router.get("/compliance/assessments", async (req: Request, res: Response) => {
  try {
    const filters = {
      resourceType: req.query.resourceType as string | undefined,
      status: req.query.status as string | undefined
    };
    const assessments = aiDataGovernanceService.getComplianceAssessments(filters);
    res.json({
      items: assessments,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: These assessments are for AUDIT purposes ONLY."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Get assessments error:", error);
    res.status(500).json({ error: "Failed to fetch compliance assessments" });
  }
});

router.get("/compliance/assessments/:id", async (req: Request, res: Response) => {
  try {
    const assessment = aiDataGovernanceService.getComplianceAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }
    res.json({
      ...assessment,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: This assessment is for AUDIT purposes ONLY."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Get assessment error:", error);
    res.status(500).json({ error: "Failed to fetch compliance assessment" });
  }
});

router.get("/lineage/graph", async (_req: Request, res: Response) => {
  try {
    const graph = aiDataGovernanceService.getDataLineageGraph();
    res.json({
      ...graph,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: This data lineage is for GOVERNANCE purposes ONLY."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Get lineage graph error:", error);
    res.status(500).json({ error: "Failed to fetch data lineage graph" });
  }
});

router.get("/lineage/nodes/:id", async (req: Request, res: Response) => {
  try {
    const node = aiDataGovernanceService.getLineageNode(req.params.id);
    if (!node) {
      return res.status(404).json({ error: "Lineage node not found" });
    }
    res.json(node);
  } catch (error) {
    console.error("[AIDataGovernance] Get lineage node error:", error);
    res.status(500).json({ error: "Failed to fetch lineage node" });
  }
});

router.post("/lineage/nodes", async (req: Request, res: Response) => {
  try {
    const node = aiDataGovernanceService.addLineageNode(req.body);
    res.status(201).json(node);
  } catch (error) {
    console.error("[AIDataGovernance] Add lineage node error:", error);
    res.status(500).json({ error: "Failed to add lineage node" });
  }
});

router.patch("/lineage/nodes/:id", async (req: Request, res: Response) => {
  try {
    const node = aiDataGovernanceService.updateLineageNode(req.params.id, req.body);
    if (!node) {
      return res.status(404).json({ error: "Lineage node not found" });
    }
    res.json(node);
  } catch (error) {
    console.error("[AIDataGovernance] Update lineage node error:", error);
    res.status(500).json({ error: "Failed to update lineage node" });
  }
});

router.delete("/lineage/nodes/:id", async (req: Request, res: Response) => {
  try {
    const deleted = aiDataGovernanceService.deleteLineageNode(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Lineage node not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[AIDataGovernance] Delete lineage node error:", error);
    res.status(500).json({ error: "Failed to delete lineage node" });
  }
});

router.post("/lineage/edges", async (req: Request, res: Response) => {
  try {
    const edge = aiDataGovernanceService.addLineageEdge(req.body);
    res.status(201).json(edge);
  } catch (error) {
    console.error("[AIDataGovernance] Add lineage edge error:", error);
    res.status(500).json({ error: "Failed to add lineage edge" });
  }
});

router.post("/impact/analyze", async (req: Request, res: Response) => {
  try {
    const { nodeId, analysisType } = req.body;
    if (!nodeId || !analysisType) {
      return res.status(400).json({ error: "nodeId and analysisType are required" });
    }
    const analysis = await aiDataGovernanceService.analyzeImpact(nodeId, analysisType);
    res.json({
      ...analysis,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: This impact analysis is for GOVERNANCE purposes ONLY. Not for clinical decision support."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Impact analysis error:", error);
    res.status(500).json({ error: "Failed to analyze impact" });
  }
});

router.get("/impact/analyses", async (_req: Request, res: Response) => {
  try {
    const analyses = aiDataGovernanceService.getImpactAnalyses();
    res.json({
      items: analyses,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: These impact analyses are for GOVERNANCE purposes ONLY."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Get impact analyses error:", error);
    res.status(500).json({ error: "Failed to fetch impact analyses" });
  }
});

router.get("/impact/analyses/:id", async (req: Request, res: Response) => {
  try {
    const analysis = aiDataGovernanceService.getImpactAnalysis(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: "Impact analysis not found" });
    }
    res.json({
      ...analysis,
      noCdsCompliance: "CRITICAL COMPLIANCE NOTICE: This impact analysis is for GOVERNANCE purposes ONLY."
    });
  } catch (error) {
    console.error("[AIDataGovernance] Get impact analysis error:", error);
    res.status(500).json({ error: "Failed to fetch impact analysis" });
  }
});

export function registerAIDataGovernanceRoutes(app: Router) {
  app.use("/api/data-governance", router);
  console.log("[Routes] AI Data Governance routes registered at /api/data-governance/*");
  console.log("[Routes] - Compliance dashboard at /api/data-governance/compliance/dashboard");
  console.log("[Routes] - Data lineage at /api/data-governance/lineage/graph");
  console.log("[Routes] - Impact analysis at /api/data-governance/impact/analyze");
}
