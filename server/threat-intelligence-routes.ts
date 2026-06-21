import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiThreatIntelligenceService } from "./services/ai-threat-intelligence";

const auditLogSchema = z.object({
  id: z.string(),
  timestamp: z.string().or(z.date()).transform(val => new Date(val)),
  action: z.string(),
  resourceType: z.string(),
  userId: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  details: z.string(),
  originalRiskScore: z.number().min(0).max(100)
});

const accessPatternSchema = z.object({
  id: z.string(),
  userId: z.string(),
  description: z.string(),
  behaviors: z.array(z.string()),
  timeOfAccess: z.string().or(z.date()).transform(val => new Date(val)),
  resourcesAccessed: z.array(z.string()),
  originalRiskScore: z.number().min(0).max(100)
});

const remediationSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  originalPriority: z.number().min(0).max(100),
  affectedAssets: z.array(z.string())
});

const router = Router();

function logHipaaAudit(action: string, resourceType: string, req: Request, details: Record<string, unknown>): void {
  const userId = (req as any).user?.id || "anonymous";
  console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | ${action} | ${resourceType} | User: ${userId} | ${JSON.stringify(details)}`);
}

router.get("/summary", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_THREAT_SUMMARY", "threat_intelligence", req, {});
    
    const summary = await aiThreatIntelligenceService.generateThreatIntelligenceSummary();
    res.json(summary);
  } catch (error) {
    console.error("[ThreatIntelligence] Error generating summary:", error);
    res.status(500).json({ error: "Failed to generate threat intelligence summary" });
  }
});

router.get("/threats", async (req: Request, res: Response) => {
  try {
    const { category, severity, activeOnly } = req.query;
    
    logHipaaAudit("LIST_THREATS", "threat_intelligence", req, { category, severity });
    
    const threats = aiThreatIntelligenceService.listThreats({
      category: category as any,
      severity: severity as any,
      activeOnly: activeOnly !== "false"
    });
    
    res.json(threats);
  } catch (error) {
    console.error("[ThreatIntelligence] Error listing threats:", error);
    res.status(500).json({ error: "Failed to list threats" });
  }
});

router.get("/threats/:threatId", async (req: Request, res: Response) => {
  try {
    const { threatId } = req.params;
    
    logHipaaAudit("VIEW_THREAT", "threat_intelligence", req, { threatId });
    
    const threat = aiThreatIntelligenceService.getThreat(threatId);
    
    if (!threat) {
      return res.status(404).json({ error: "Threat not found" });
    }
    
    res.json(threat);
  } catch (error) {
    console.error("[ThreatIntelligence] Error fetching threat:", error);
    res.status(500).json({ error: "Failed to fetch threat" });
  }
});

router.get("/regulatory-updates", async (req: Request, res: Response) => {
  try {
    const { framework } = req.query;
    
    logHipaaAudit("LIST_REGULATORY_UPDATES", "threat_intelligence", req, { framework });
    
    const updates = aiThreatIntelligenceService.listRegulatoryUpdates(framework as any);
    res.json(updates);
  } catch (error) {
    console.error("[ThreatIntelligence] Error listing regulatory updates:", error);
    res.status(500).json({ error: "Failed to list regulatory updates" });
  }
});

router.get("/attack-vectors", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_ATTACK_VECTORS", "threat_intelligence", req, {});
    
    const vectors = aiThreatIntelligenceService.listAttackVectors();
    res.json(vectors);
  } catch (error) {
    console.error("[ThreatIntelligence] Error listing attack vectors:", error);
    res.status(500).json({ error: "Failed to list attack vectors" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("REFRESH_THREAT_FEED", "threat_intelligence", req, {});
    
    const context = await aiThreatIntelligenceService.refreshThreatFeed();
    res.json({
      success: true,
      threatsCount: context.threats.length,
      regulatoryUpdatesCount: context.regulatoryUpdates.length,
      attackVectorsCount: context.attackVectors.length,
      lastUpdated: context.lastUpdated
    });
  } catch (error) {
    console.error("[ThreatIntelligence] Error refreshing feed:", error);
    res.status(500).json({ error: "Failed to refresh threat feed" });
  }
});

router.post("/analyze-audit-log", async (req: Request, res: Response) => {
  try {
    const parseResult = auditLogSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid audit log entry",
        details: parseResult.error.errors
      });
    }
    
    const logEntry = parseResult.data;
    logHipaaAudit("ANALYZE_AUDIT_LOG", "threat_intelligence", req, { logEntryId: logEntry.id });
    
    const assessment = await aiThreatIntelligenceService.analyzeAuditLogWithThreatContext(logEntry);
    res.json(assessment);
  } catch (error) {
    console.error("[ThreatIntelligence] Error analyzing audit log:", error);
    res.status(500).json({ error: "Failed to analyze audit log" });
  }
});

router.post("/analyze-access-pattern", async (req: Request, res: Response) => {
  try {
    const parseResult = accessPatternSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid access pattern",
        details: parseResult.error.errors
      });
    }
    
    const pattern = parseResult.data;
    logHipaaAudit("ANALYZE_ACCESS_PATTERN", "threat_intelligence", req, { patternId: pattern.id });
    
    const assessment = await aiThreatIntelligenceService.analyzeAccessPatternWithThreatContext(pattern);
    res.json(assessment);
  } catch (error) {
    console.error("[ThreatIntelligence] Error analyzing access pattern:", error);
    res.status(500).json({ error: "Failed to analyze access pattern" });
  }
});

router.post("/adjust-remediation-priority", async (req: Request, res: Response) => {
  try {
    const parseResult = remediationSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid remediation data",
        details: parseResult.error.errors
      });
    }
    
    const remediation = parseResult.data;
    logHipaaAudit("ADJUST_REMEDIATION_PRIORITY", "threat_intelligence", req, { 
      remediationId: remediation.id 
    });
    
    const adjustment = await aiThreatIntelligenceService.adjustRemediationPriority(remediation);
    res.json(adjustment);
  } catch (error) {
    console.error("[ThreatIntelligence] Error adjusting remediation priority:", error);
    res.status(500).json({ error: "Failed to adjust remediation priority" });
  }
});

router.get("/configuration", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_THREAT_CONFIG", "threat_intelligence", req, {});
    
    const config = aiThreatIntelligenceService.getConfiguration();
    res.json(config);
  } catch (error) {
    console.error("[ThreatIntelligence] Error fetching configuration:", error);
    res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

router.patch("/configuration", async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    
    logHipaaAudit("UPDATE_THREAT_CONFIG", "threat_intelligence", req, { updates });
    
    const config = aiThreatIntelligenceService.updateConfiguration(updates);
    res.json(config);
  } catch (error) {
    console.error("[ThreatIntelligence] Error updating configuration:", error);
    res.status(500).json({ error: "Failed to update configuration" });
  }
});

export default router;
