import { Router, Request, Response } from "express";
import { enhancedDataIngestionService } from "./services/enhanced-data-ingestion-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const dashboard = await enhancedDataIngestionService.getDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    console.error("[EnhancedIngestion] Dashboard fetch failed:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

router.get("/errors", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const jobId = req.query.jobId as string | undefined;
    const errors = await enhancedDataIngestionService.getErrors(userId, jobId);
    res.json({ errors });
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get errors:", error);
    res.status(500).json({ error: "Failed to retrieve errors" });
  }
});

router.get("/errors/:errorId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { errorId } = req.params;
    const error = await enhancedDataIngestionService.getError(userId, errorId);
    
    if (!error) {
      return res.status(404).json({ error: "Error not found" });
    }
    
    res.json(error);
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get error:", error);
    res.status(500).json({ error: "Failed to retrieve error" });
  }
});

router.post("/errors", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { jobId, severity, category, code, message, details, context } = req.body;
    
    if (!jobId || !severity || !category || !code || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const error = await enhancedDataIngestionService.createError(
      userId,
      jobId,
      severity,
      category,
      code,
      message,
      details || "",
      context || {}
    );
    
    res.status(201).json(error);
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to create error:", error);
    res.status(500).json({ error: "Failed to create error" });
  }
});

router.post("/errors/:errorId/resolve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { errorId } = req.params;
    const { notes } = req.body;
    
    const error = await enhancedDataIngestionService.resolveError(userId, errorId, notes || "Resolved manually");
    res.json(error);
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to resolve error:", error);
    res.status(500).json({ error: "Failed to resolve error" });
  }
});

router.post("/errors/:errorId/recover", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { errorId } = req.params;
    const { strategy, fallbackData } = req.body;
    
    if (!strategy) {
      return res.status(400).json({ error: "Recovery strategy is required" });
    }
    
    const attempt = await enhancedDataIngestionService.attemptRecovery(
      userId,
      errorId,
      strategy,
      fallbackData
    );
    
    res.json(attempt);
  } catch (error) {
    console.error("[EnhancedIngestion] Recovery failed:", error);
    res.status(500).json({ error: "Recovery attempt failed" });
  }
});

router.get("/errors/:errorId/recovery-strategies", async (req: Request, res: Response) => {
  try {
    const { errorId } = req.params;
    const userId = (req as any).user?.id || "anonymous";
    
    const error = await enhancedDataIngestionService.getError(userId, errorId);
    if (!error) {
      return res.status(404).json({ error: "Error not found" });
    }
    
    const strategies = await enhancedDataIngestionService.getRecommendedRecoveryStrategies(error.category);
    res.json({ strategies });
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get strategies:", error);
    res.status(500).json({ error: "Failed to get recovery strategies" });
  }
});

router.post("/errors/report", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: "Job ID is required" });
    }
    
    const report = await enhancedDataIngestionService.generateErrorReport(userId, jobId);
    res.json(report);
  } catch (error) {
    console.error("[EnhancedIngestion] Report generation failed:", error);
    res.status(500).json({ error: "Failed to generate error report" });
  }
});

router.get("/streaming/sources", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const sources = await enhancedDataIngestionService.getStreamingSources(userId);
    res.json({ sources });
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get streaming sources:", error);
    res.status(500).json({ error: "Failed to retrieve streaming sources" });
  }
});

router.get("/streaming/sources/:sourceId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { sourceId } = req.params;
    const source = await enhancedDataIngestionService.getStreamingSource(userId, sourceId);
    
    if (!source) {
      return res.status(404).json({ error: "Streaming source not found" });
    }
    
    res.json(source);
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get streaming source:", error);
    res.status(500).json({ error: "Failed to retrieve streaming source" });
  }
});

router.post("/streaming/sources", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { name, type, config } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }
    
    const source = await enhancedDataIngestionService.createStreamingSource(
      userId,
      name,
      type,
      config || {}
    );
    
    res.status(201).json(source);
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to create streaming source:", error);
    res.status(500).json({ error: "Failed to create streaming source" });
  }
});

router.post("/streaming/sources/:sourceId/connect", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { sourceId } = req.params;
    
    const source = await enhancedDataIngestionService.connectStreamingSource(userId, sourceId);
    res.json(source);
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to connect streaming source:", error);
    res.status(500).json({ error: "Failed to connect streaming source" });
  }
});

router.post("/streaming/sources/:sourceId/disconnect", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { sourceId } = req.params;
    
    const source = await enhancedDataIngestionService.disconnectStreamingSource(userId, sourceId);
    res.json(source);
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to disconnect streaming source:", error);
    res.status(500).json({ error: "Failed to disconnect streaming source" });
  }
});

router.get("/streaming/sources/:sourceId/events", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { sourceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const events = await enhancedDataIngestionService.getStreamingEvents(userId, sourceId, limit);
    res.json({ events });
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get streaming events:", error);
    res.status(500).json({ error: "Failed to retrieve streaming events" });
  }
});

router.get("/profiles", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const profiles = await enhancedDataIngestionService.getDataProfiles(userId);
    res.json({ profiles });
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get profiles:", error);
    res.status(500).json({ error: "Failed to retrieve data profiles" });
  }
});

router.get("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { profileId } = req.params;
    const profile = await enhancedDataIngestionService.getDataProfile(userId, profileId);
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json(profile);
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get profile:", error);
    res.status(500).json({ error: "Failed to retrieve data profile" });
  }
});

router.post("/profiles/analyze", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { jobId, data, datasetName } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: "Data array is required" });
    }
    
    if (!datasetName) {
      return res.status(400).json({ error: "Dataset name is required" });
    }
    
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "DataProfile",
      resourceId: jobId || "new",
      details: `analyze_data: ${datasetName}, records=${data.length}`,
    });
    
    const profile = await enhancedDataIngestionService.profileData(
      userId,
      jobId || `job-${Date.now()}`,
      data,
      datasetName
    );
    
    res.status(201).json(profile);
  } catch (error) {
    console.error("[EnhancedIngestion] Data profiling failed:", error);
    res.status(500).json({ error: "Failed to profile data" });
  }
});

router.get("/validations", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const validations = await enhancedDataIngestionService.getValidations(userId);
    res.json({ validations });
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get validations:", error);
    res.status(500).json({ error: "Failed to retrieve validations" });
  }
});

router.get("/validations/:validationId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { validationId } = req.params;
    const validation = await enhancedDataIngestionService.getValidation(userId, validationId);
    
    if (!validation) {
      return res.status(404).json({ error: "Validation not found" });
    }
    
    res.json(validation);
  } catch (error) {
    console.error("[EnhancedIngestion] Failed to get validation:", error);
    res.status(500).json({ error: "Failed to retrieve validation" });
  }
});

router.post("/streaming/sources/:sourceId/validate", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { sourceId } = req.params;
    const { runSampleProfiling, triggerAnomalyDetection } = req.body;
    
    const validation = await enhancedDataIngestionService.validateDataSource(
      userId,
      sourceId,
      { runSampleProfiling, triggerAnomalyDetection }
    );
    
    res.status(201).json(validation);
  } catch (error: any) {
    console.error("[EnhancedIngestion] Validation failed:", error);
    res.status(error.message === "Data source not found" ? 404 : 500).json({ 
      error: error.message || "Failed to validate data source" 
    });
  }
});

router.post("/validations/:validationId/rerun", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { validationId } = req.params;
    
    const validation = await enhancedDataIngestionService.rerunValidation(userId, validationId);
    res.json(validation);
  } catch (error: any) {
    console.error("[EnhancedIngestion] Rerun validation failed:", error);
    res.status(error.message === "Validation not found" ? 404 : 500).json({ 
      error: error.message || "Failed to rerun validation" 
    });
  }
});

router.post("/streaming/sources/register", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { name, type, config } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }
    
    const result = await enhancedDataIngestionService.registerAndValidateSource(
      userId,
      { name, type, config: config || {} }
    );
    
    res.status(201).json(result);
  } catch (error) {
    console.error("[EnhancedIngestion] Source registration failed:", error);
    res.status(500).json({ error: "Failed to register data source" });
  }
});

export function registerEnhancedDataIngestionRoutes(app: any) {
  app.use("/api/enhanced-ingestion", router);
  console.log("[EnhancedIngestionRoutes] Routes registered at /api/enhanced-ingestion/*");
  console.log("[EnhancedIngestionRoutes] Endpoints: /dashboard, /errors, /streaming/sources, /profiles, /validations");
}

export function setupStreamingWebSocket(wss: any) {
  wss.on("connection", (ws: any) => {
    console.log("[EnhancedIngestion-WS] Client connected to streaming events");

    enhancedDataIngestionService.onStreamingEvent((event) => {
      try {
        ws.send(JSON.stringify({
          type: "streaming_event",
          data: event,
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        console.error("[EnhancedIngestion-WS] Failed to send event:", error);
      }
    });

    ws.on("close", () => {
      console.log("[EnhancedIngestion-WS] Client disconnected");
    });

    ws.on("error", (error: Error) => {
      console.error("[EnhancedIngestion-WS] WebSocket error:", error);
    });

    ws.send(JSON.stringify({
      type: "connection_established",
      message: "Connected to Enhanced Data Ingestion streaming",
      timestamp: new Date().toISOString(),
    }));
  });

  console.log("[EnhancedIngestion-WS] WebSocket server initialized for streaming events");
}
