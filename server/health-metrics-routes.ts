import { Router, Request, Response } from "express";
import { z } from "zod";

const router = Router();

interface HealthMetric {
  id: string;
  profileId: string;
  type: string;
  value: number;
  unit: string;
  recordedAt: string;
  source: "manual" | "device" | "extracted";
  notes?: string;
  createdAt: string;
}

const metricUnits: Record<string, string> = {
  blood_pressure_systolic: "mmHg",
  blood_pressure_diastolic: "mmHg",
  heart_rate: "bpm",
  weight: "lbs",
  bmi: "kg/m²",
  temperature: "°F",
  spo2: "%",
  respiration_rate: "breaths/min",
  blood_glucose: "mg/dL",
  height: "in",
};

const healthMetricsStore = new Map<string, HealthMetric>();

const logMetricSchema = z.object({
  type: z.string(),
  value: z.number(),
  recordedAt: z.string(),
  source: z.enum(["manual", "device", "extracted"]),
  notes: z.string().optional(),
  profileId: z.string().optional(),
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    
    let metrics = Array.from(healthMetricsStore.values());
    
    if (profileId) {
      metrics = metrics.filter(m => m.profileId === profileId);
    }
    
    metrics.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    
    res.json({ metrics });
  } catch (error) {
    console.error("Error fetching health metrics:", error);
    res.status(500).json({ error: "Failed to fetch health metrics" });
  }
});

router.get("/history/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const profileId = req.query.profileId as string;
    const days = parseInt(req.query.days as string) || 30;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let metrics = Array.from(healthMetricsStore.values())
      .filter(m => m.type === type)
      .filter(m => new Date(m.recordedAt) >= cutoffDate);
    
    if (profileId) {
      metrics = metrics.filter(m => m.profileId === profileId);
    }
    
    metrics.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    
    res.json({ history: metrics });
  } catch (error) {
    console.error("Error fetching metric history:", error);
    res.status(500).json({ error: "Failed to fetch metric history" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const validation = logMetricSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid metric data",
        details: validation.error.errors 
      });
    }
    
    const { type, value, recordedAt, source, notes, profileId } = validation.data;
    
    const metric: HealthMetric = {
      id: `metric-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      profileId: profileId || "profile-1",
      type,
      value,
      unit: metricUnits[type] || "",
      recordedAt,
      source,
      notes,
      createdAt: new Date().toISOString(),
    };
    
    healthMetricsStore.set(metric.id, metric);
    
    res.status(201).json({ 
      success: true,
      metric 
    });
  } catch (error) {
    console.error("Error logging health metric:", error);
    res.status(500).json({ error: "Failed to log health metric" });
  }
});

router.get("/latest", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    
    const metrics = Array.from(healthMetricsStore.values());
    const filteredMetrics = profileId 
      ? metrics.filter(m => m.profileId === profileId)
      : metrics;
    
    const latestByType = new Map<string, HealthMetric>();
    
    for (const metric of filteredMetrics) {
      const existing = latestByType.get(metric.type);
      if (!existing || new Date(metric.recordedAt) > new Date(existing.recordedAt)) {
        latestByType.set(metric.type, metric);
      }
    }
    
    res.json({ 
      metrics: Array.from(latestByType.values()) 
    });
  } catch (error) {
    console.error("Error fetching latest metrics:", error);
    res.status(500).json({ error: "Failed to fetch latest metrics" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!healthMetricsStore.has(id)) {
      return res.status(404).json({ error: "Metric not found" });
    }
    
    healthMetricsStore.delete(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting health metric:", error);
    res.status(500).json({ error: "Failed to delete health metric" });
  }
});

export default router;
