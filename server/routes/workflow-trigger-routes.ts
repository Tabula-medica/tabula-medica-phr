import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  emitEvent,
  getTriggers,
  registerTrigger,
  removeTrigger,
  getExecutionHistory,
  getExecution,
  reviewExecution,
  type TriggerEvent,
} from "../services/workflow-trigger-service";

const router = Router();

const emitEventSchema = z.object({
  event: z.enum([
    "encounter.completed",
    "encounter.status_changed",
    "lab.results_available",
    "referral.created",
    "discharge.initiated",
    "medication.changed",
    "appointment.completed",
  ]),
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  providerId: z.string().optional(),
  contextData: z.record(z.string()).optional(),
});

const registerTriggerSchema = z.object({
  id: z.string().min(1),
  event: z.enum([
    "encounter.completed",
    "encounter.status_changed",
    "lab.results_available",
    "referral.created",
    "discharge.initiated",
    "medication.changed",
    "appointment.completed",
  ]),
  documentType: z.string().min(1),
  autoGenerate: z.boolean().default(true),
  requiresProviderReview: z.boolean().default(true),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  conditions: z.record(z.string()).optional(),
});

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewedBy: z.string().min(1),
  reviewNotes: z.string().optional(),
});

router.get("/triggers", (_req: Request, res: Response) => {
  res.json({ triggers: getTriggers() });
});

router.post("/triggers", (req: Request, res: Response) => {
  const parsed = registerTriggerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid trigger configuration", details: parsed.error.issues });
  }
  registerTrigger(parsed.data);
  res.json({ success: true, trigger: parsed.data });
});

router.delete("/triggers/:triggerId", (req: Request, res: Response) => {
  const removed = removeTrigger(req.params.triggerId);
  if (!removed) {
    return res.status(404).json({ error: "Trigger not found" });
  }
  res.json({ success: true });
});

router.post("/emit", async (req: Request, res: Response) => {
  const parsed = emitEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid event data", details: parsed.error.issues });
  }

  try {
    const executions = await emitEvent(parsed.data.event as TriggerEvent, {
      patientId: parsed.data.patientId,
      encounterId: parsed.data.encounterId,
      providerId: parsed.data.providerId,
      contextData: parsed.data.contextData,
    });

    res.json({
      success: true,
      event: parsed.data.event,
      executionsTriggered: executions.length,
      executions,
    });
  } catch (error: any) {
    console.error("[WorkflowTrigger] Emit error:", error);
    res.status(500).json({ error: "Failed to process event", message: error.message });
  }
});

router.get("/executions", (req: Request, res: Response) => {
  const patientId = req.query.patientId as string | undefined;
  res.json({ executions: getExecutionHistory(patientId) });
});

router.get("/executions/:executionId", (req: Request, res: Response) => {
  const execution = getExecution(req.params.executionId);
  if (!execution) {
    return res.status(404).json({ error: "Execution not found" });
  }
  res.json({ execution });
});

router.post("/executions/:executionId/review", (req: Request, res: Response) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid review data", details: parsed.error.issues });
  }

  const result = reviewExecution(
    req.params.executionId,
    parsed.data.decision,
    parsed.data.reviewedBy,
    parsed.data.reviewNotes
  );

  if (!result) {
    return res.status(404).json({ error: "Execution not found or not awaiting review" });
  }

  res.json({ success: true, execution: result });
});

export default router;
