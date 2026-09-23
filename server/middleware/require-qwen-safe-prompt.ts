import type { Request, Response, NextFunction } from "express";
import { Logger } from "pino";
import { automatedAlertingService } from "../services/automated-alerting";

/**
 * CRITICAL MIDDLEWARE: PHI Boundary Enforcement for Qwen-Image Service
 *
 * This middleware BLOCKS any attempt to use Qwen for PHI extraction.
 * It is the hard compliance barrier between user requests and the screening service.
 *
 * NO EXCEPTIONS: If this middleware rejects a request, it is INVALID and must not proceed.
 */

const PHI_KEYWORDS = [
  // Patient identifiers
  "name",
  "patient",
  "ssn",
  "social security",
  "dob",
  "date of birth",
  "mrn",
  "medical record",
  "phone",
  "email",
  "address",

  // Insurance/financial
  "insurance",
  "policy",
  "account",
  "billing",
  "credit card",
  "bank",

  // Clinical
  "diagnosis",
  "prognosis",
  "treatment",
  "medication",
  "symptoms",
  "condition",
  "disease",
  "illness",
  "allergies",
  "prescribe",
  "dosage",

  // Extraction/retrieval
  "extract",
  "read",
  "transcribe",
  "get",
  "retrieve",
  "find",
  "identify",
  "detect patient",
  "recognize patient",
  "who is",
  "what is the patient",

  // Medical inference
  "analyze",
  "interpret",
  "assess medical",
  "evaluate clinical",
  "predict outcome",
  "prognosis",
  "severity",
  "risk score",
];

const SAFE_PROMPT_KEYWORDS = [
  "classify",
  "classification",
  "document type",
  "legible",
  "legibility",
  "quality",
  "blur",
  "rotation",
  "signature",
  "presence",
];

interface QwenRequest extends Request {
  qwenPrompt?: string;
  qwenValidation?: {
    valid: boolean;
    reason?: string;
  };
}

export function requireQwenSafePrompt(logger: Logger) {
  return async (
    req: QwenRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Only validate if this is a Qwen request with user-supplied prompt
    if (!req.body.qwenPrompt) {
      // Internal/fixed-operation calls (no user prompt) are pre-validated
      req.qwenValidation = { valid: true };
      next();
      return;
    }

    const prompt = (req.body.qwenPrompt ?? "").toLowerCase().trim();

    // ============================================================
    // VALIDATION LAYER 1: Check for PHI Keywords
    // ============================================================

    for (const keyword of PHI_KEYWORDS) {
      if (prompt.includes(keyword)) {
        // Log only the keyword and metadata, NEVER log prompt content (no PHI)
        logger.error(
          {
            timestamp: new Date().toISOString(),
            userId: (req.user as any)?.id || "unknown",
            keyword,
            promptLength: prompt.length,
          },
          "🚨 BLOCKED: Qwen prompt contains PHI keyword"
        );

        // Alert security team immediately
        try {
          await automatedAlertingService.recordSecurityAnomaly(
            "qwen_phi_extraction_attempt",
            "critical",
            {
              userId: (req.user as any)?.id || "unknown",
              ipAddress: req.ip,
              action: "prompt_validation_blocked",
              reason: `PHI keyword detected: "${keyword}"`,
            }
          );
        } catch (alertError) {
          logger.error(alertError, "Failed to record security anomaly");
        }

        res.status(400).json({
          error: "UNSAFE_PROMPT",
          message: "This prompt is not allowed for Qwen screening.",
          reason: `Contains restricted keyword: "${keyword}"`,
          code: "QWEN_PHI_VIOLATION",
        });
        return;
      }
    }

    // ============================================================
    // VALIDATION LAYER 2: Verify prompt is in safe-list
    // ============================================================

    const isSafePrompt = SAFE_PROMPT_KEYWORDS.some((keyword) =>
      prompt.includes(keyword)
    );

    if (!isSafePrompt) {
      logger.warn(
        { userId: (req.user as any)?.id },
        "Qwen prompt does not match safe-list"
      );

      res.status(400).json({
        error: "UNSAFE_PROMPT",
        message: "Prompt does not match allowed use cases.",
        reason:
          "Qwen screening supports only: classification, legibility, quality, signature detection",
        code: "QWEN_UNSAFE_PROMPT",
      });
      return;
    }

    // ============================================================
    // VALIDATION LAYER 3: Length check (long prompts = complexity)
    // ============================================================

    if (prompt.length > 500) {
      logger.warn(
        {
          promptLength: prompt.length,
          userId: (req.user as any)?.id,
        },
        "Qwen prompt exceeds length limit"
      );

      res.status(400).json({
        error: "PROMPT_TOO_LONG",
        message: "Prompt exceeds maximum length (500 characters).",
        code: "QWEN_LENGTH_VIOLATION",
      });
      return;
    }

    // ============================================================
    // VALIDATION LAYER 4: Ensure no image contains visible PHI
    // ============================================================

    // TODO: Optional — add vision-based PHI detection if Qwen is used with pre-screening
    // For now, rely on prompt validation

    // ============================================================
    // PASSED ALL CHECKS: Mark as valid and proceed
    // ============================================================

    req.qwenValidation = {
      valid: true,
    };

    logger.debug(
      {
        userId: (req.user as any)?.id,
        promptKeyword: SAFE_PROMPT_KEYWORDS.find((k) => prompt.includes(k)),
      },
      "Qwen prompt validation passed"
    );

    next();
  };
}

/**
 * Guard middleware: Ensure Qwen validation ran before calling service
 */
export function ensureQwenValidated(logger: Logger) {
  return (req: QwenRequest, res: Response, next: NextFunction): void => {
    if (!req.qwenValidation?.valid) {
      logger.error(
        { userId: (req.user as any)?.id },
        "Qwen service called without validation"
      );

      res.status(400).json({
        error: "VALIDATION_REQUIRED",
        message: "Qwen prompt validation middleware must run first.",
        code: "QWEN_NO_VALIDATION",
      });
      return;
    }

    next();
  };
}
