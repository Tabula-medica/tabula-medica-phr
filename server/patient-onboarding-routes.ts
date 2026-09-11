import { Express, Request, Response } from "express";
import {
  startPatientOnboardingSchema,
  submitPatientOnboardingStepSchema,
  assignPatientOnboardingTaskSchema,
  patientOnboardingStepTypes,
} from "@shared/schema";
import {
  startOnboardingWorkflow,
  submitOnboardingStep,
  assignCareTeamTask,
  getOnboardingWorkflow,
  getPatientOnboardingWorkflows,
  getAllOnboardingWorkflows,
  getDataCollectionForm,
  getOnboardingMetrics,
  getOnboardingAuditLog,
} from "./services/patient-onboarding-service";
import { requireUser, getUserId } from "./middleware/require-user";

export function registerPatientOnboardingRoutes(app: Express): void {
  app.post("/api/patient-onboarding/start", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const validation = startPatientOnboardingSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid request",
          details: validation.error.errors,
        });
        return;
      }

      const workflow = await startOnboardingWorkflow(
        validation.data,
        userId,
        "provider",
        ipAddress,
        userAgent
      );

      res.status(201).json({
        success: true,
        message: "Onboarding workflow started",
        workflow,
      });
    } catch (error) {
      console.error("[PatientOnboarding] Start error:", error);
      res.status(500).json({ error: "Failed to start onboarding" });
    }
  });

  app.post("/api/patient-onboarding/submit-step", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const validation = submitPatientOnboardingStepSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid request",
          details: validation.error.errors,
        });
        return;
      }

      const result = await submitOnboardingStep(
        validation.data,
        userId,
        "patient",
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        message: `Step ${validation.data.stepType} ${validation.data.skip ? "skipped" : "completed"}`,
        workflow: result.workflow,
        step: result.step,
      });
    } catch (error) {
      console.error("[PatientOnboarding] Submit step error:", error);
      res.status(500).json({ error: "Failed to submit step" });
    }
  });

  app.post("/api/patient-onboarding/assign-task", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const validation = assignPatientOnboardingTaskSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid request",
          details: validation.error.errors,
        });
        return;
      }

      const assignment = await assignCareTeamTask(
        validation.data,
        userId,
        "provider",
        ipAddress,
        userAgent
      );

      res.status(201).json({
        success: true,
        message: "Task assigned to care team member",
        assignment,
      });
    } catch (error) {
      console.error("[PatientOnboarding] Assign task error:", error);
      res.status(500).json({ error: "Failed to assign task" });
    }
  });

  app.get("/api/patient-onboarding/workflows", requireUser, async (_req: Request, res: Response) => {
    try {
      const workflows = getAllOnboardingWorkflows();
      res.json({ workflows });
    } catch (error) {
      console.error("[PatientOnboarding] Get workflows error:", error);
      res.status(500).json({ error: "Failed to get workflows" });
    }
  });

  app.get("/api/patient-onboarding/workflows/:workflowId", requireUser, async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      const workflow = getOnboardingWorkflow(workflowId);
      if (!workflow) {
        res.status(404).json({ error: "Workflow not found" });
        return;
      }
      res.json({ workflow });
    } catch (error) {
      console.error("[PatientOnboarding] Get workflow error:", error);
      res.status(500).json({ error: "Failed to get workflow" });
    }
  });

  app.get("/api/patient-onboarding/patient/:patientId", requireUser, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const workflows = getPatientOnboardingWorkflows(patientId);
      res.json({ workflows });
    } catch (error) {
      console.error("[PatientOnboarding] Get patient workflows error:", error);
      res.status(500).json({ error: "Failed to get patient workflows" });
    }
  });

  app.get("/api/patient-onboarding/forms/:stepType", requireUser, async (req: Request, res: Response) => {
    try {
      const { stepType } = req.params;
      if (!patientOnboardingStepTypes.includes(stepType as any)) {
        res.status(400).json({ error: "Invalid step type" });
        return;
      }
      const form = getDataCollectionForm(stepType as any);
      res.json({ form });
    } catch (error) {
      console.error("[PatientOnboarding] Get form error:", error);
      res.status(500).json({ error: "Failed to get form" });
    }
  });

  app.get("/api/patient-onboarding/metrics", requireUser, async (_req: Request, res: Response) => {
    try {
      const metrics = getOnboardingMetrics();
      res.json({ metrics });
    } catch (error) {
      console.error("[PatientOnboarding] Get metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  app.get("/api/patient-onboarding/audit", requireUser, async (req: Request, res: Response) => {
    try {
      const workflowId = req.query.workflowId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const auditLog = getOnboardingAuditLog(workflowId, limit);
      res.json({ auditLog });
    } catch (error) {
      console.error("[PatientOnboarding] Get audit log error:", error);
      res.status(500).json({ error: "Failed to get audit log" });
    }
  });

  console.log("[Routes] Patient Onboarding Workflow routes registered at /api/patient-onboarding");
}
