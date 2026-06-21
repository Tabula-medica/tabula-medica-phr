/**
 * Episodes of Care API Routes
 * 
 * Provides endpoints for detecting and managing Episodes of Care -
 * clinical groupings that link related events into unified care pathways.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { episodesOfCareService, TimelineEventForGrouping } from "../services/episodes-of-care-service";

const router = Router();

const timelineEventSchema = z.object({
  id: z.string().min(1, "Event ID is required"),
  domain: z.string().min(1, "Domain is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  type: z.enum(["point", "range"]).optional().default("point"),
  landmark: z.string().optional(),
  severity: z.string().optional(),
});

const detectEpisodesSchema = z.object({
  patientId: z.string().min(1, "patientId is required"),
  events: z.array(timelineEventSchema).min(1, "At least one event is required"),
});

/**
 * GET /api/episodes-of-care/metadata
 * Returns service metadata and capabilities
 */
router.get("/metadata", (_req: Request, res: Response) => {
  try {
    const metadata = episodesOfCareService.getMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[EpisodesOfCare] Metadata error:", error);
    res.status(500).json({ error: "Failed to retrieve metadata" });
  }
});

/**
 * POST /api/episodes-of-care/detect
 * Detect and group clinical events into Episodes of Care
 */
router.post("/detect", (req: Request, res: Response) => {
  try {
    const validationResult = detectEpisodesSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join(".")}: ${e.message}`);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: errors 
      });
    }

    const { patientId, events } = validationResult.data;

    const timelineEvents: TimelineEventForGrouping[] = events.map((e) => ({
      id: e.id,
      domain: e.domain,
      name: e.name,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      type: e.type || "point",
      landmark: e.landmark,
      severity: e.severity,
    }));

    console.log(`[EpisodesOfCare] Detecting episodes for patient ${patientId} with ${events.length} events`);
    
    const episodes = episodesOfCareService.detectEpisodes(patientId, timelineEvents);

    console.log(`[EpisodesOfCare] Detected ${episodes.length} episodes for patient ${patientId}`);

    res.json({
      patientId,
      episodeCount: episodes.length,
      episodes,
      detectedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[EpisodesOfCare] Detection error:", error);
    res.status(500).json({ error: "Failed to detect episodes" });
  }
});

/**
 * GET /api/episodes-of-care/:patientId
 * Get all episodes for a patient
 */
router.get("/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    const episodes = episodesOfCareService.getPatientEpisodes(patientId);

    res.json({
      patientId,
      episodeCount: episodes.length,
      episodes,
    });
  } catch (error) {
    console.error("[EpisodesOfCare] Get episodes error:", error);
    res.status(500).json({ error: "Failed to retrieve episodes" });
  }
});

/**
 * GET /api/episodes-of-care/:patientId/active
 * Get active/ongoing episodes for a patient
 */
router.get("/:patientId/active", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    const activeEpisodes = episodesOfCareService.getActiveEpisodes(patientId);

    res.json({
      patientId,
      activeEpisodeCount: activeEpisodes.length,
      episodes: activeEpisodes,
    });
  } catch (error) {
    console.error("[EpisodesOfCare] Get active episodes error:", error);
    res.status(500).json({ error: "Failed to retrieve active episodes" });
  }
});

/**
 * GET /api/episodes-of-care/:patientId/episode/:episodeId
 * Get a specific episode by ID
 */
router.get("/:patientId/episode/:episodeId", (req: Request, res: Response) => {
  try {
    const { patientId, episodeId } = req.params;

    if (!patientId || !episodeId) {
      return res.status(400).json({ error: "patientId and episodeId are required" });
    }

    const episode = episodesOfCareService.getEpisodeById(patientId, episodeId);

    if (!episode) {
      return res.status(404).json({ error: "Episode not found" });
    }

    res.json(episode);
  } catch (error) {
    console.error("[EpisodesOfCare] Get episode error:", error);
    res.status(500).json({ error: "Failed to retrieve episode" });
  }
});

/**
 * GET /api/episodes-of-care/:patientId/timeline
 * Get episode timeline mapping (which events belong to which episodes)
 */
router.get("/:patientId/timeline", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    const timeline = episodesOfCareService.getEpisodeTimeline(patientId);

    res.json({
      patientId,
      episodeTimeline: timeline,
    });
  } catch (error) {
    console.error("[EpisodesOfCare] Get timeline error:", error);
    res.status(500).json({ error: "Failed to retrieve episode timeline" });
  }
});

export function registerEpisodesOfCareRoutes(app: any) {
  app.use("/api/episodes-of-care", router);
  console.log("[Routes] Episodes of Care routes registered at /api/episodes-of-care/*");
}
