import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import {
  aiIncidentResponseService,
  type IncidentStatus,
  type IncidentSeverity,
  type IncidentCategory,
} from "./services/ai-incident-response";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, resource: string, req: Request, details: Record<string, unknown>): void {
  console.log(`[IncidentResponseAPI][HIPAA] ${action}`, {
    resource,
    userId: hashIdentifier((req as any).user?.id || req.ip || "anonymous"),
    ip: req.ip,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

const createIncidentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum(["security", "compliance", "data_quality", "system", "access_violation", "phi_breach", "operational"]),
});

const updateStatusSchema = z.object({
  status: z.enum(["detected", "investigating", "containing", "contained", "remediating", "resolved", "closed"]),
  notes: z.string().max(1000).optional(),
});

const escalateSchema = z.object({
  escalateTo: z.string().min(1).max(100),
  reason: z.string().min(1).max(500),
});

const assignSchema = z.object({
  assignTo: z.string().min(1).max(100),
});

const executeStepSchema = z.object({
  result: z.string().min(1).max(1000),
});

const addNoteSchema = z.object({
  note: z.string().min(1).max(2000),
});

const incidentFiltersSchema = z.object({
  status: z.enum(["detected", "investigating", "containing", "contained", "remediating", "resolved", "closed"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  category: z.enum(["security", "compliance", "data_quality", "system", "access_violation", "phi_breach", "operational"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const createPlaybookSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  category: z.enum(["security", "compliance", "data_quality", "system", "access_violation", "phi_breach", "operational"]),
  triggerConditions: z.object({
    alertTypes: z.array(z.string()),
    minSeverity: z.enum(["critical", "high", "medium", "low"]),
    keywords: z.array(z.string()),
  }),
  containmentSteps: z.array(z.object({
    order: z.number(),
    action: z.string(),
    description: z.string(),
    automated: z.boolean(),
    estimatedDuration: z.string(),
    requiredPermissions: z.array(z.string()),
  })),
  remediationSteps: z.array(z.string()),
  notificationTargets: z.array(z.string()),
  escalationPath: z.array(z.string()),
  automationLevel: z.enum(["full", "partial", "manual"]),
});

router.get("/incidents", async (req: Request, res: Response) => {
  try {
    const filters = incidentFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_INCIDENTS", "incidents", req, { filters });

    const incidents = aiIncidentResponseService.listIncidents(filters);
    
    res.json({
      success: true,
      incidents,
      total: incidents.length,
      compliance: { noClinicalDecisionSupport: true },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[IncidentResponseAPI] List incidents error:", error);
    res.status(500).json({ error: "Failed to list incidents" });
  }
});

router.get("/incidents/metrics", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("GET_INCIDENT_METRICS", "metrics", req, {});

    const metrics = aiIncidentResponseService.getIncidentMetrics();
    
    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error("[IncidentResponseAPI] Get metrics error:", error);
    res.status(500).json({ error: "Failed to get incident metrics" });
  }
});

router.get("/incidents/:id", async (req: Request, res: Response) => {
  try {
    const incident = aiIncidentResponseService.getIncident(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    logHipaaAudit("VIEW_INCIDENT", "incidents", req, { incidentId: req.params.id });

    res.json({
      success: true,
      incident,
      compliance: { noClinicalDecisionSupport: true },
    });
  } catch (error) {
    console.error("[IncidentResponseAPI] Get incident error:", error);
    res.status(500).json({ error: "Failed to retrieve incident" });
  }
});

router.post("/incidents", async (req: Request, res: Response) => {
  try {
    const { title, description, severity, category } = createIncidentSchema.parse(req.body);
    const userId = (req as any).user?.id || "system";

    logHipaaAudit("CREATE_INCIDENT", "incidents", req, { severity, category });

    const incident = await aiIncidentResponseService.createManualIncident(
      title,
      description,
      severity as IncidentSeverity,
      category as IncidentCategory,
      userId
    );

    res.status(201).json({
      success: true,
      incident,
      compliance: { noClinicalDecisionSupport: true },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[IncidentResponseAPI] Create incident error:", error);
    res.status(500).json({ error: "Failed to create incident" });
  }
});

router.patch("/incidents/:id/status", async (req: Request, res: Response) => {
  try {
    const { status, notes } = updateStatusSchema.parse(req.body);
    const userId = (req as any).user?.id || "system";

    logHipaaAudit("UPDATE_INCIDENT_STATUS", "incidents", req, {
      incidentId: req.params.id,
      newStatus: status,
    });

    const incident = await aiIncidentResponseService.updateIncidentStatus(
      req.params.id,
      status as IncidentStatus,
      userId,
      notes
    );

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    res.json({ success: true, incident });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[IncidentResponseAPI] Update status error:", error);
    res.status(500).json({ error: "Failed to update incident status" });
  }
});

router.post("/incidents/:id/escalate", async (req: Request, res: Response) => {
  try {
    const { escalateTo, reason } = escalateSchema.parse(req.body);
    const userId = (req as any).user?.id || "system";

    logHipaaAudit("ESCALATE_INCIDENT", "incidents", req, {
      incidentId: req.params.id,
      escalateTo,
    });

    const incident = await aiIncidentResponseService.escalateIncident(
      req.params.id,
      escalateTo,
      userId,
      reason
    );

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    res.json({ success: true, incident });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[IncidentResponseAPI] Escalate error:", error);
    res.status(500).json({ error: "Failed to escalate incident" });
  }
});

router.post("/incidents/:id/assign", async (req: Request, res: Response) => {
  try {
    const { assignTo } = assignSchema.parse(req.body);
    const userId = (req as any).user?.id || "system";

    logHipaaAudit("ASSIGN_INCIDENT", "incidents", req, {
      incidentId: req.params.id,
      assignTo,
    });

    const incident = await aiIncidentResponseService.assignIncident(
      req.params.id,
      assignTo,
      userId
    );

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    res.json({ success: true, incident });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[IncidentResponseAPI] Assign error:", error);
    res.status(500).json({ error: "Failed to assign incident" });
  }
});

router.post("/incidents/:id/containment/:stepId/execute", async (req: Request, res: Response) => {
  try {
    const { result } = executeStepSchema.parse(req.body);
    const userId = (req as any).user?.id || "system";

    logHipaaAudit("EXECUTE_CONTAINMENT_STEP", "incidents", req, {
      incidentId: req.params.id,
      stepId: req.params.stepId,
    });

    const incident = await aiIncidentResponseService.executeManualContainmentStep(
      req.params.id,
      req.params.stepId,
      userId,
      result
    );

    if (!incident) {
      return res.status(404).json({ error: "Incident or step not found" });
    }

    res.json({ success: true, incident });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[IncidentResponseAPI] Execute step error:", error);
    res.status(500).json({ error: "Failed to execute containment step" });
  }
});

router.post("/incidents/:id/notes", async (req: Request, res: Response) => {
  try {
    const { note } = addNoteSchema.parse(req.body);
    const userId = (req as any).user?.id || "system";

    logHipaaAudit("ADD_INCIDENT_NOTE", "incidents", req, {
      incidentId: req.params.id,
    });

    const incident = await aiIncidentResponseService.addNote(
      req.params.id,
      note,
      userId
    );

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    res.json({ success: true, incident });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[IncidentResponseAPI] Add note error:", error);
    res.status(500).json({ error: "Failed to add note" });
  }
});

router.get("/incidents/:id/timeline", async (req: Request, res: Response) => {
  try {
    const incident = aiIncidentResponseService.getIncident(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    logHipaaAudit("VIEW_INCIDENT_TIMELINE", "incidents", req, {
      incidentId: req.params.id,
    });

    res.json({
      success: true,
      timeline: incident.timeline,
      totalEvents: incident.timeline.length,
    });
  } catch (error) {
    console.error("[IncidentResponseAPI] Get timeline error:", error);
    res.status(500).json({ error: "Failed to retrieve incident timeline" });
  }
});

router.get("/playbooks", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_PLAYBOOKS", "playbooks", req, {});

    const playbooks = aiIncidentResponseService.listPlaybooks();
    
    res.json({
      success: true,
      playbooks,
      total: playbooks.length,
    });
  } catch (error) {
    console.error("[IncidentResponseAPI] List playbooks error:", error);
    res.status(500).json({ error: "Failed to list playbooks" });
  }
});

router.get("/playbooks/:id", async (req: Request, res: Response) => {
  try {
    const playbook = aiIncidentResponseService.getPlaybook(req.params.id);
    if (!playbook) {
      return res.status(404).json({ error: "Playbook not found" });
    }

    logHipaaAudit("VIEW_PLAYBOOK", "playbooks", req, { playbookId: req.params.id });

    res.json({ success: true, playbook });
  } catch (error) {
    console.error("[IncidentResponseAPI] Get playbook error:", error);
    res.status(500).json({ error: "Failed to retrieve playbook" });
  }
});

router.post("/playbooks", async (req: Request, res: Response) => {
  try {
    const playbookData = createPlaybookSchema.parse(req.body);

    logHipaaAudit("CREATE_PLAYBOOK", "playbooks", req, { name: playbookData.name });

    const playbook = aiIncidentResponseService.createPlaybook(playbookData as any);

    res.status(201).json({ success: true, playbook });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[IncidentResponseAPI] Create playbook error:", error);
    res.status(500).json({ error: "Failed to create playbook" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_INCIDENT_DASHBOARD", "dashboard", req, {});

    const metrics = aiIncidentResponseService.getIncidentMetrics();
    const activeIncidents = aiIncidentResponseService.listIncidents({
      limit: 10,
    }).filter(i => !["resolved", "closed"].includes(i.status));

    const criticalIncidents = activeIncidents.filter(i => i.severity === "critical");
    const recentIncidents = aiIncidentResponseService.listIncidents({ limit: 5 });

    res.json({
      success: true,
      dashboard: {
        metrics,
        activeIncidents: activeIncidents.length,
        criticalIncidents: criticalIncidents.length,
        recentIncidents: recentIncidents.map(i => ({
          id: i.id,
          title: i.title,
          status: i.status,
          severity: i.severity,
          category: i.category,
          createdAt: i.createdAt,
          alertCount: i.correlatedAlerts.length,
        })),
        playbooks: aiIncidentResponseService.listPlaybooks().length,
      },
      compliance: { noClinicalDecisionSupport: true },
    });
  } catch (error) {
    console.error("[IncidentResponseAPI] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

export default router;
