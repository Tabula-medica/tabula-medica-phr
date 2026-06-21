import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  orchestrateOutreach,
  analyzePatientForOutreach,
  generateFullOutreachContent,
  executeOutreach,
  getOrchestrationResult,
  getOutreachExecution,
  getRecentOrchestrations,
  getPatientOutreachHistory,
  getOutreachStats,
  ContactMethod,
  OutreachCategory,
} from "./services/aiOutreachOrchestrator";
import { requireRole } from "./rbac";
import { requireConsents } from "./consent/consent-enforcement";

const router = Router();

function getRequestInfo(req: Request): { userId: string; ipAddress: string } {
  const user = (req as any).user;
  return {
    userId: user?.id || "anonymous",
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
  };
}

const orchestrateSchema = z.object({
  patientIds: z.array(z.string()).optional(),
});

const analyzePatientSchema = z.object({
  patientId: z.string(),
});

const generateContentSchema = z.object({
  patientId: z.string(),
  category: z.enum([
    "care_gap",
    "medication_adherence",
    "appointment_followup",
    "questionnaire_response",
    "care_plan_update",
    "wellness_check",
    "lab_results",
    "preventive_care",
  ]),
  contactMethod: z.enum([
    "secure_message",
    "sms",
    "phone_call",
    "email",
    "push_notification",
  ]),
});

const executeOutreachSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  priorityScore: z.number(),
  category: z.enum([
    "care_gap",
    "medication_adherence",
    "appointment_followup",
    "questionnaire_response",
    "care_plan_update",
    "wellness_check",
    "lab_results",
    "preventive_care",
  ]),
  reasons: z.array(z.string()),
  suggestedContactMethod: z.enum([
    "secure_message",
    "sms",
    "phone_call",
    "email",
    "push_notification",
  ]),
  suggestedContactMethodReason: z.string(),
  optimalContactWindow: z.string(),
  personalizedMessagePreview: z.string(),
  dataSourcesUsed: z.array(z.string()),
  complianceFlags: z.array(z.string()),
  overrideContactMethod: z.enum([
    "secure_message",
    "sms",
    "phone_call",
    "email",
    "push_notification",
  ]).optional(),
  overrideContent: z.object({
    subject: z.string(),
    content: z.string(),
  }).optional(),
});

router.post("/orchestrate",
  requireRole("provider", "admin"),
  requireConsents,
  async (req: Request, res: Response) => {
    try {
      const validationResult = orchestrateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const result = await orchestrateOutreach(
        userId,
        ipAddress,
        validationResult.data.patientIds
      );

      res.json({
        success: true,
        result,
        compliance: {
          noCdsPolicy: "ENFORCED",
          hipaaAuditLogging: "ENABLED",
          phiProtection: "ACTIVE",
        },
      });
    } catch (error: any) {
      console.error("[AIOutreachOrchestrator] Orchestration error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/analyze-patient",
  requireRole("provider", "admin"),
  requireConsents,
  async (req: Request, res: Response) => {
    try {
      const validationResult = analyzePatientSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const prioritization = await analyzePatientForOutreach(
        validationResult.data.patientId,
        userId,
        ipAddress
      );

      if (!prioritization) {
        return res.json({
          success: true,
          requiresOutreach: false,
          message: "Patient does not currently require prioritized outreach",
        });
      }

      res.json({
        success: true,
        requiresOutreach: true,
        prioritization,
        compliance: {
          noCdsPolicy: "ENFORCED",
          hipaaAuditLogging: "ENABLED",
        },
      });
    } catch (error: any) {
      console.error("[AIOutreachOrchestrator] Analyze patient error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/generate-content",
  requireRole("provider", "admin"),
  requireConsents,
  async (req: Request, res: Response) => {
    try {
      const validationResult = generateContentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const { patientId, category, contactMethod } = validationResult.data;

      const content = await generateFullOutreachContent(
        patientId,
        category as OutreachCategory,
        contactMethod as ContactMethod,
        userId,
        ipAddress
      );

      res.json({
        success: true,
        content,
        compliance: {
          noCdsPolicy: "ENFORCED",
          contentSanitized: true,
          disclaimerIncluded: true,
        },
      });
    } catch (error: any) {
      console.error("[AIOutreachOrchestrator] Generate content error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/execute",
  requireRole("provider", "admin"),
  requireConsents,
  async (req: Request, res: Response) => {
    try {
      const validationResult = executeOutreachSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const { overrideContactMethod, overrideContent, ...prioritization } = validationResult.data;

      const execution = await executeOutreach(
        prioritization as any,
        userId,
        ipAddress,
        overrideContactMethod as ContactMethod | undefined,
        overrideContent
      );

      res.json({
        success: true,
        execution,
        compliance: {
          noCdsPolicy: "ENFORCED",
          hipaaAuditLogging: "ENABLED",
          auditTrailId: execution.auditTrailId,
        },
      });
    } catch (error: any) {
      console.error("[AIOutreachOrchestrator] Execute outreach error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/results/:resultId",
  requireRole("provider", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { resultId } = req.params;
      const result = getOrchestrationResult(resultId);

      if (!result) {
        return res.status(404).json({ error: "Orchestration result not found" });
      }

      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/executions/:executionId",
  requireRole("provider", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { executionId } = req.params;
      const execution = getOutreachExecution(executionId);

      if (!execution) {
        return res.status(404).json({ error: "Outreach execution not found" });
      }

      res.json({ success: true, execution });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/recent",
  requireRole("provider", "admin"),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const orchestrations = getRecentOrchestrations(limit);

      res.json({ success: true, orchestrations });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/patient-history/:patientId",
  requireRole("provider", "admin", "patient"),
  requireConsents,
  async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const history = getPatientOutreachHistory(patientId);

      res.json({ success: true, history });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/stats",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const stats = getOutreachStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/contact-methods",
  requireRole("provider", "admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      contactMethods: [
        {
          id: "secure_message",
          name: "Secure Message",
          description: "In-app secure messaging portal",
          hipaaCompliant: true,
          requiresOptIn: false,
        },
        {
          id: "sms",
          name: "SMS Text Message",
          description: "Standard text message to patient's phone",
          hipaaCompliant: true,
          requiresOptIn: true,
          note: "Limited PHI allowed",
        },
        {
          id: "phone_call",
          name: "Phone Call",
          description: "Direct phone call from care team",
          hipaaCompliant: true,
          requiresOptIn: true,
        },
        {
          id: "email",
          name: "Email",
          description: "Encrypted email communication",
          hipaaCompliant: true,
          requiresOptIn: true,
          note: "Must use encrypted email service",
        },
        {
          id: "push_notification",
          name: "Push Notification",
          description: "Mobile app push notification",
          hipaaCompliant: true,
          requiresOptIn: false,
          note: "Limited content - no PHI",
        },
      ],
    });
  }
);

router.get("/outreach-categories",
  requireRole("provider", "admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      categories: [
        {
          id: "care_gap",
          name: "Care Gap",
          description: "Addressing identified gaps in patient care",
          priority: "high",
        },
        {
          id: "medication_adherence",
          name: "Medication Adherence",
          description: "Supporting medication compliance and refills",
          priority: "medium",
        },
        {
          id: "appointment_followup",
          name: "Appointment Follow-up",
          description: "Post-visit check-ins and care coordination",
          priority: "medium",
        },
        {
          id: "questionnaire_response",
          name: "Questionnaire Response",
          description: "Following up on patient questionnaire results",
          priority: "high",
        },
        {
          id: "care_plan_update",
          name: "Care Plan Update",
          description: "Care plan progress and milestone tracking",
          priority: "medium",
        },
        {
          id: "wellness_check",
          name: "Wellness Check",
          description: "General patient engagement and wellness",
          priority: "low",
        },
        {
          id: "lab_results",
          name: "Lab Results",
          description: "Following up on laboratory test results",
          priority: "high",
        },
        {
          id: "preventive_care",
          name: "Preventive Care",
          description: "Preventive screening and vaccination reminders",
          priority: "medium",
        },
      ],
    });
  }
);

export default router;
