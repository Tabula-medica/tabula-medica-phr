/**
 * Medical Journey API Routes
 * Endpoints for accessing longitudinal patient health timeline
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  getPatientJourneyTimeline,
  regenerateJourneySummary
} from "../services/medical-journey-service";
import {
  getAllLoincMappings,
  getAllRxNormMappings,
  getAllSnomedMappings,
  normalizeLoincCode,
  normalizeRxNormCode,
  normalizeSnomedCode
} from "../services/semantic-normalization-service";

const router = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.claims?.sub) {
    return res.status(401).json({ success: false, error: "Authentication required to access medical journey data" });
  }
  next();
}

const timeRangeSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional()
});

const normalizeQuerySchema = z.object({
  term: z.string().min(1),
  type: z.enum(["loinc", "rxnorm", "snomed", "all"]).default("all")
});

router.get("/timeline/:patientId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).user?.claims?.sub;
    
    const timeRange = timeRangeSchema.safeParse({
      start: req.query.start,
      end: req.query.end
    });
    
    const timeline = await getPatientJourneyTimeline(
      patientId,
      userId,
      timeRange.success && timeRange.data.start && timeRange.data.end
        ? { start: timeRange.data.start, end: timeRange.data.end }
        : undefined
    );
    
    res.json({ success: true, data: timeline });
  } catch (error: any) {
    console.error("Error fetching journey timeline:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch journey timeline" 
    });
  }
});

router.post("/timeline/:patientId/regenerate-summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).user?.claims?.sub;
    
    const summary = await regenerateJourneySummary(patientId, userId);
    
    res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error("Error regenerating summary:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to regenerate summary" 
    });
  }
});

router.get("/terminology/loinc", async (_req: Request, res: Response) => {
  try {
    const mappings = getAllLoincMappings();
    res.json({ success: true, data: mappings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to fetch LOINC mappings" });
  }
});

router.get("/terminology/rxnorm", async (_req: Request, res: Response) => {
  try {
    const mappings = getAllRxNormMappings();
    res.json({ success: true, data: mappings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to fetch RxNorm mappings" });
  }
});

router.get("/terminology/snomed", async (_req: Request, res: Response) => {
  try {
    const mappings = getAllSnomedMappings();
    res.json({ success: true, data: mappings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to fetch SNOMED mappings" });
  }
});

router.post("/normalize", async (req: Request, res: Response) => {
  try {
    const validation = normalizeQuerySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request",
        details: validation.error.errors
      });
    }
    
    const { term, type } = validation.data;
    const results: Record<string, any> = {};
    
    if (type === "all" || type === "loinc") {
      results.loinc = normalizeLoincCode(term);
    }
    if (type === "all" || type === "rxnorm") {
      results.rxnorm = normalizeRxNormCode(term);
    }
    if (type === "all" || type === "snomed") {
      results.snomed = normalizeSnomedCode(term);
    }
    
    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to normalize term" });
  }
});

export function registerMedicalJourneyRoutes(app: any): void {
  app.use("/api/medical-journey", router);
}

export default router;
