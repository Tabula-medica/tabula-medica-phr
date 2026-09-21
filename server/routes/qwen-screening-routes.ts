import type { Router, Request, Response } from "express";
import { qwenScreeningService } from "../services/qwen-image-screening-service";
import {
  requireQwenSafePrompt,
  ensureQwenValidated,
} from "../middleware/require-qwen-safe-prompt";
import { Logger } from "pino";
import multer from "multer";

/**
 * Qwen Image Screening Routes
 *
 * Safe API endpoints for document screening WITHOUT PHI extraction.
 * All endpoints:
 * - ✅ Validate prompts against PHI keywords
 * - ✅ Accept only image files
 * - ✅ Return only metadata (no content extraction)
 * - ✅ Log all decisions for audit trail
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files allowed"));
      return;
    }
    cb(null, true);
  },
});

export function attachQwenScreeningRoutes(
  router: Router,
  logger: Logger
): void {
  // Middleware for all Qwen routes
  const qwenMiddleware = [
    requireQwenSafePrompt(logger),
    ensureQwenValidated(logger),
  ];

  /**
   * POST /api/qwen/classify
   *
   * Classify document type WITHOUT extracting content
   * SAFE: Output contains only document class label
   *
   * Request:
   * - Form: multipart/form-data
   * - File: document image (jpeg, png)
   * - documentId: (optional) UUID for audit linking
   *
   * Response:
   * - classification: "insurance_card" | "lab_report" | ...
   * - confidence: 0-1
   * - processingTimeMs: number
   *
   * ❌ BLOCKED: Prompts asking to extract names, dates, medical info
   */
  router.post(
    "/api/qwen/classify",
    upload.single("document"),
    qwenMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "No image file provided" });
          return;
        }

        const documentId = req.body.documentId || req.file.filename;

        // ✅ SAFE: Classification only
        const result = await qwenScreeningService.classifyDocument(
          req.file.buffer,
          documentId
        );

        // Log result (NEVER log image content)
        logger.info(
          {
            documentId,
            classification: result.classification,
            confidence: result.confidence,
            processingMs: result.processingTimeMs,
          },
          "Document classified"
        );

        res.json({
          id: result.id,
          classification: result.classification,
          confidence: result.confidence,
          processingTimeMs: result.processingTimeMs,
          // NO: result.imageData, result.ocr, result.extractedText
        });
      } catch (error) {
        logger.error(error, "Classification failed");
        res.status(500).json({
          error: "CLASSIFICATION_FAILED",
          message: "Document classification failed",
        });
      }
    }
  );

  /**
   * POST /api/qwen/legibility
   *
   * Assess document legibility for OCR
   * SAFE: Output is binary (readable/unreadable) + quality score
   *
   * Response:
   * - isLegible: boolean
   * - legibilityScore: 0-100
   * - issues: ["blurry", "rotated", ...] (max 5)
   */
  router.post(
    "/api/qwen/legibility",
    upload.single("document"),
    qwenMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "No image file provided" });
          return;
        }

        const documentId = req.body.documentId || req.file.filename;

        // ✅ SAFE: Binary legibility check
        const result = await qwenScreeningService.assessLegibility(
          req.file.buffer,
          documentId
        );

        logger.info(
          {
            documentId,
            isLegible: result.isLegible,
            score: result.score,
          },
          "Legibility assessed"
        );

        res.json({
          isLegible: result.isLegible,
          legibilityScore: result.score,
          issues: result.issues,
          // NO: extracted text, content, image analysis
        });
      } catch (error) {
        logger.error(error, "Legibility assessment failed");
        res.status(500).json({
          error: "LEGIBILITY_ASSESSMENT_FAILED",
        });
      }
    }
  );

  /**
   * POST /api/qwen/quality
   *
   * Assess image quality (rotation, cropping, clarity)
   * SAFE: Output is metadata flags, not content
   *
   * Response:
   * - quality: 0-100
   * - rotation: -180 to 180 degrees
   * - cropped: boolean
   * - issues: ["blurry", "faded", "rotated", ...] (max 5)
   */
  router.post(
    "/api/qwen/quality",
    upload.single("document"),
    qwenMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "No image file provided" });
          return;
        }

        const documentId = req.body.documentId || req.file.filename;

        // ✅ SAFE: Metadata only
        const result = await qwenScreeningService.assessQuality(
          req.file.buffer,
          documentId
        );

        logger.info(
          {
            documentId,
            quality: result.quality,
            rotation: result.rotation,
            cropped: result.cropped,
          },
          "Quality assessed"
        );

        res.json({
          quality: result.quality,
          rotation: result.rotation,
          cropped: result.cropped,
          issues: result.issues,
        });
      } catch (error) {
        logger.error(error, "Quality assessment failed");
        res.status(500).json({
          error: "QUALITY_ASSESSMENT_FAILED",
        });
      }
    }
  );

  /**
   * POST /api/qwen/signature
   *
   * Detect presence of signature on document
   * SAFE: Binary output (has signature or not)
   *
   * Use case: Verify consent forms, signed agreements
   *
   * Response:
   * - hasSignature: boolean
   * - confidence: 0-100
   */
  router.post(
    "/api/qwen/signature",
    upload.single("document"),
    qwenMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "No image file provided" });
          return;
        }

        const documentId = req.body.documentId || req.file.filename;

        // ✅ SAFE: Binary signature detection
        const result = await qwenScreeningService.detectSignature(
          req.file.buffer,
          documentId
        );

        logger.info(
          {
            documentId,
            hasSignature: result.hasSignature,
            confidence: result.confidence,
          },
          "Signature detected"
        );

        res.json({
          hasSignature: result.hasSignature,
          confidence: result.confidence,
        });
      } catch (error) {
        logger.error(error, "Signature detection failed");
        res.status(500).json({
          error: "SIGNATURE_DETECTION_FAILED",
        });
      }
    }
  );

  /**
   * POST /api/qwen/screen
   *
   * Full document screening: classify + legibility + quality
   * SAFE: Returns only metadata, no PHI extraction
   *
   * Combines classification, legibility, quality assessment in one call
   *
   * Response:
   * {
   *   id: "uuid",
   *   classification: "insurance_card",
   *   confidence: 0.92,
   *   isLegible: true,
   *   legibilityScore: 0.95,
   *   qualityIssues: ["slight_rotation"],
   *   processingTimeMs: 450,
   *   timestamp: "2026-09-21T..."
   * }
   */
  router.post(
    "/api/qwen/screen",
    upload.single("document"),
    qwenMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "No image file provided" });
          return;
        }

        const documentId = req.body.documentId || req.file.filename;

        // ✅ SAFE: Full screening pipeline
        const result = await qwenScreeningService.screenDocument(
          req.file.buffer,
          documentId
        );

        logger.info(
          {
            documentId,
            classification: result.classification,
            legible: result.isLegible,
            qualityIssues: result.qualityIssues.length,
            processingMs: result.processingTimeMs,
          },
          "Full document screening complete"
        );

        res.json(result);
      } catch (error) {
        logger.error(error, "Full screening failed");
        res.status(500).json({
          error: "SCREENING_FAILED",
        });
      }
    }
  );

  /**
   * GET /api/qwen/config
   *
   * Returns allowed screening operations (for UI)
   * SAFE: Public endpoint with no PHI exposure
   */
  router.get("/api/qwen/config", (req: Request, res: Response): void => {
    res.json({
      operations: [
        {
          endpoint: "/api/qwen/classify",
          description: "Classify document type (insurance card, lab report, etc)",
          safe: true,
        },
        {
          endpoint: "/api/qwen/legibility",
          description: "Assess document legibility for OCR",
          safe: true,
        },
        {
          endpoint: "/api/qwen/quality",
          description: "Assess image quality (rotation, cropping, blur)",
          safe: true,
        },
        {
          endpoint: "/api/qwen/signature",
          description: "Detect presence of handwritten signature",
          safe: true,
        },
        {
          endpoint: "/api/qwen/screen",
          description: "Full screening: classify + legibility + quality",
          safe: true,
        },
      ],
      restrictions: [
        "No PHI extraction (names, dates, medical info forbidden)",
        "No diagnosis inference",
        "No treatment recommendations",
        "Local inference only (no external APIs)",
      ],
    });
  });
}
