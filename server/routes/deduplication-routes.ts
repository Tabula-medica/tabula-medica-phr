import { Router, Request, Response } from "express";
import { deduplicationEngineService } from "../services/deduplication-engine-service";
import { databaseDedupService } from "../services/database-dedup-service";
import { insertPatientIdentitySchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const stats = await deduplicationEngineService.getDashboardStats();
    res.json({
      success: true,
      data: stats,
      thresholds: {
        autoMerge: { min: 95, description: "Automatic merge for high-confidence matches" },
        flagForReview: { min: 80, max: 94, description: "Flagged for manual review" },
        newRecord: { max: 79, description: "Created as new unique record" },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/process", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPatientIdentitySchema.parse(req.body);
    const result = await deduplicationEngineService.processPatientRecord(validatedData);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        success: false, 
        error: "Validation error",
        details: error.errors,
      });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

const nmValidationSchema = z.object({
  middleName: z.string().optional(),
  hasNoMiddleName: z.boolean().optional().default(false),
});

router.post("/validate-nmn", async (req: Request, res: Response) => {
  try {
    const { middleName, hasNoMiddleName } = nmValidationSchema.parse(req.body);
    const validation = deduplicationEngineService.validateNMN(middleName, hasNoMiddleName);
    
    res.json({
      success: true,
      validation,
      recommendation: validation.hasMiddleName 
        ? null 
        : !validation.isNMN 
          ? "Please confirm: Does this patient have a middle name?" 
          : "No Middle Name (NMN) confirmed",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/pending-reviews", async (req: Request, res: Response) => {
  try {
    const reviews = await deduplicationEngineService.getPendingReviews();
    res.json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const resolveMatchSchema = z.object({
  decision: z.enum(["confirmed_match", "confirmed_different"]),
  reviewedBy: z.string(),
  notes: z.string().optional(),
});

router.post("/resolve-match/:matchId", async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    const { decision, reviewedBy, notes } = resolveMatchSchema.parse(req.body);
    
    await deduplicationEngineService.resolveMatch(matchId, decision, reviewedBy, notes);
    
    res.json({
      success: true,
      message: decision === "confirmed_match" 
        ? "Records merged successfully" 
        : "Records confirmed as different patients",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const patientData = await deduplicationEngineService.getPatientWithHistory(patientId);
    
    if (!patientData) {
      return res.status(404).json({ success: false, error: "Patient not found" });
    }
    
    res.json({
      success: true,
      data: patientData,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const searchSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  email: z.string().optional(),
  ssnLast4: z.string().length(4).optional(),
});

router.post("/search", async (req: Request, res: Response) => {
  try {
    const query = searchSchema.parse(req.body);
    const patients = await deduplicationEngineService.searchPatients(query);
    
    res.json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const bulkProcessSchema = z.object({
  records: z.array(insertPatientIdentitySchema),
});

router.post("/bulk-process", async (req: Request, res: Response) => {
  try {
    const { records } = bulkProcessSchema.parse(req.body);
    
    const results = {
      processed: 0,
      created: 0,
      merged: 0,
      flagged: 0,
      errors: [] as { index: number; error: string }[],
    };
    
    for (let i = 0; i < records.length; i++) {
      try {
        const result = await deduplicationEngineService.processPatientRecord(records[i]);
        results.processed++;
        
        switch (result.action) {
          case "created": results.created++; break;
          case "merged": results.merged++; break;
          case "flagged": results.flagged++; break;
        }
      } catch (error: any) {
        results.errors.push({ index: i, error: error.message });
      }
    }
    
    res.json({
      success: true,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/similarity-test", async (req: Request, res: Response) => {
  try {
    const { str1, str2 } = req.query;
    
    if (!str1 || !str2) {
      return res.status(400).json({ 
        success: false, 
        error: "Please provide str1 and str2 query parameters" 
      });
    }
    
    const service = deduplicationEngineService as any;
    const similarity = service.calculateSimilarity(str1 as string, str2 as string);
    const distance = service.levenshteinDistance(str1 as string, str2 as string);
    
    let action: string;
    if (similarity >= 95) {
      action = "auto_merge";
    } else if (similarity >= 80) {
      action = "flag_for_review";
    } else {
      action = "new_record";
    }
    
    res.json({
      success: true,
      string1: str1,
      string2: str2,
      levenshteinDistance: distance,
      similarityScore: similarity,
      recommendedAction: action,
      formula: "S = (1 - L(a,b) / max(len(a), len(b))) × 100",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/patient-pending-reviews", async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).user?.id || "patient-default";
    const pendingMatches = await deduplicationEngineService.getPatientPendingReviews(patientId);
    
    res.json({
      success: true,
      data: pendingMatches,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const patientConfirmMergeSchema = z.object({
  matchId: z.string(),
  confirmed: z.boolean(),
});

router.post("/patient-confirm-merge", async (req: Request, res: Response) => {
  try {
    const { matchId, confirmed } = patientConfirmMergeSchema.parse(req.body);
    const patientId = (req as any).user?.id || "patient-default";
    
    const result = await deduplicationEngineService.patientConfirmMerge(matchId, patientId, confirmed);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation error", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get("/database/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await databaseDedupService.getStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/database/scan", async (_req: Request, res: Response) => {
  try {
    if (databaseDedupService.isDeduplicationRunning()) {
      return res.status(409).json({ success: false, error: "Batch deduplication is already running" });
    }
    const result = await databaseDedupService.runBatchDeduplication();
    console.log(`[HIPAA-AUDIT][DatabaseDedup] Batch scan completed: ${result.duplicatesFound} duplicates, ${result.autoMerged} auto-merged`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/database/status", async (_req: Request, res: Response) => {
  res.json({
    success: true,
    isRunning: databaseDedupService.isDeduplicationRunning(),
  });
});

export default router;
