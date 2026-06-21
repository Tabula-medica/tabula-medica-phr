import { Express, Request, Response } from "express";
import { z } from "zod";
import {
  generatePatientSummary,
  getSummaryHistory,
  getAvailablePatients,
  getSupportedRoles,
  type CareTeamRole,
  type SummaryLength,
} from "./services/patient-summary-generator-service";

const generateSummarySchema = z.object({
  patientId: z.string().min(1),
  role: z.enum(["physician", "nurse", "care_coordinator", "pharmacist", "specialist"]),
  focusAreas: z.array(z.string()).optional(),
  includeRecentUpdates: z.boolean().optional().default(true),
  timeframeDays: z.number().min(1).max(365).optional().default(30),
  summaryLength: z.enum(["concise", "standard", "detailed"]).optional().default("standard"),
  includeDataQualityFlags: z.boolean().optional().default(true),
  includeActionableInsights: z.boolean().optional().default(true),
});

export function registerPatientSummaryRoutes(app: Express): void {
  app.post("/api/patient-summary/generate", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const validation = generateSummarySchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const summary = await generatePatientSummary(
        {
          patientId: validation.data.patientId,
          role: validation.data.role as CareTeamRole,
          focusAreas: validation.data.focusAreas,
          includeRecentUpdates: validation.data.includeRecentUpdates,
          timeframeDays: validation.data.timeframeDays,
          summaryLength: validation.data.summaryLength as SummaryLength,
          includeDataQualityFlags: validation.data.includeDataQualityFlags,
          includeActionableInsights: validation.data.includeActionableInsights,
        },
        userId,
        ipAddress,
        userAgent
      );

      res.json({ success: true, summary });
    } catch (error) {
      console.error("[PatientSummary] Generate error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate summary";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/patient-summary/history/:patientId", async (req: Request, res: Response) => {
    try {
      const history = getSummaryHistory(req.params.patientId);
      res.json({ history });
    } catch (error) {
      console.error("[PatientSummary] Get history error:", error);
      res.status(500).json({ error: "Failed to get summary history" });
    }
  });

  app.get("/api/patient-summary/patients", async (_req: Request, res: Response) => {
    try {
      const patients = getAvailablePatients();
      res.json({ patients });
    } catch (error) {
      console.error("[PatientSummary] Get patients error:", error);
      res.status(500).json({ error: "Failed to get patients" });
    }
  });

  app.get("/api/patient-summary/roles", async (_req: Request, res: Response) => {
    try {
      const roles = getSupportedRoles();
      res.json({ roles });
    } catch (error) {
      console.error("[PatientSummary] Get roles error:", error);
      res.status(500).json({ error: "Failed to get roles" });
    }
  });

  console.log("[Routes] Patient Summary Generator routes registered at /api/patient-summary/*");
}
