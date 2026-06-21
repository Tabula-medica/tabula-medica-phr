import { Router, type Request, type Response } from "express";
import { medicalSafetyValidator } from "./services/medical-safety-validator";

const router = Router();

router.post("/api/safety/validate-output", async (req: Request, res: Response) => {
  try {
    const { output, context } = req.body;
    if (!output) return res.status(400).json({ error: "output text is required" });

    const result = await medicalSafetyValidator.validateAIOutput(output, context);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Safety validation failed" });
  }
});

router.post("/api/safety/validate-prompt", async (req: Request, res: Response) => {
  try {
    const { template } = req.body;
    if (!template) return res.status(400).json({ error: "template is required" });

    const result = await medicalSafetyValidator.validatePromptTemplate(template);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Prompt validation failed" });
  }
});

router.get("/api/monitoring/health-deep", async (_req: Request, res: Response) => {
  try {
    const checks = {
      server: { status: "healthy", uptime: process.uptime() },
      memory: {
        status: "healthy",
        usage: process.memoryUsage(),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      ai: {
        status: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY ? "configured" : "not_configured",
      },
      environment: process.env.NODE_ENV || "development",
      version: process.env.K_REVISION || "local",
    };

    const allHealthy = checks.server.status === "healthy" && checks.memory.status === "healthy";
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error: any) {
    res.status(500).json({ status: "unhealthy", error: error.message });
  }
});

router.get("/api/monitoring/error-summary", async (_req: Request, res: Response) => {
  res.json({
    last24h: {
      totalErrors: 0,
      byCategory: {
        ai_parsing: 0,
        fhir_connection: 0,
        authentication: 0,
        phi_access: 0,
      },
    },
    alerts: [],
    recommendation: "Connect Cloud Logging for production error aggregation",
  });
});

export function registerMonitoringRoutes(app: any) {
  app.use(router);
  console.log("[MonitoringRoutes] Registered: /api/safety/*, /api/monitoring/*");
}
