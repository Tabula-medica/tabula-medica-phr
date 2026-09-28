import { Router, Request, Response } from "express";
import { speechScreeningService } from "./services/speech-screening-service";
import type { SpeechAcousticFeatures } from "../shared/speech-acoustics";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireProfile } from "./services/resolve-profile";
import { noStorePhi } from "./lib/middleware/no-store-phi";

const router = Router();

router.use(isAuthenticated, requireProfile, noStorePhi);

function ownProfileId(req: Request): string {
  return (req as any).resolvedProfileId as string;
}

function parseTaskType(value: unknown): SpeechAcousticFeatures["taskType"] | undefined {
  return value === "sustained_vowel" || value === "reading_passage" ? value : undefined;
}

const NUMERIC_FIELDS_BY_TASK: Record<SpeechAcousticFeatures["taskType"], string[]> = {
  sustained_vowel: ["f0MeanHz", "f0SdSemitones", "jitterPercent", "shimmerPercent", "hnrDb", "voicedRatio", "durationSec"],
  reading_passage: ["f0MeanHz", "f0SdSemitones", "intensityMeanDb", "intensitySdDb", "pauseRatio", "speakingRateEstimate", "voicedRatio", "durationSec"],
};

function validateFeatures(body: any): { valid: true; features: SpeechAcousticFeatures } | { valid: false; error: string } {
  const { taskType } = body || {};
  if (taskType !== "sustained_vowel" && taskType !== "reading_passage") {
    return { valid: false, error: "taskType must be 'sustained_vowel' or 'reading_passage'" };
  }

  const requiredFields = NUMERIC_FIELDS_BY_TASK[taskType as SpeechAcousticFeatures["taskType"]];
  for (const field of requiredFields) {
    if (typeof body[field] !== "number" || !Number.isFinite(body[field])) {
      return { valid: false, error: `Missing or invalid numeric field: ${field}` };
    }
  }

  const features = { taskType, ...Object.fromEntries(requiredFields.map(f => [f, body[f]])) } as SpeechAcousticFeatures;
  return { valid: true, features };
}

router.get("/task-info", async (_req: Request, res: Response) => {
  try {
    res.json(speechScreeningService.getTaskInfo());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch task info" });
  }
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const validation = validateFeatures(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = speechScreeningService.analyze(ownProfileId(req), validation.features);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: "Analysis failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/latest", async (req: Request, res: Response) => {
  try {
    const latest = speechScreeningService.getLatest(ownProfileId(req), parseTaskType(req.query.taskType));
    if (!latest) return res.status(404).json({ error: "No speech screening results found. Use POST to analyze a recording." });
    res.json(latest);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch latest speech screening result" });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  try {
    res.json(speechScreeningService.getHistory(ownProfileId(req), parseTaskType(req.query.taskType)));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch speech screening history" });
  }
});

export default router;
