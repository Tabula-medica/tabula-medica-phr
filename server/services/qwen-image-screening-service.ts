import { Logger } from "pino";
import { v4 as uuidv4 } from "uuid";
import type { AuditLog } from "@shared/schema";

export type QwenDocumentClass =
  | "insurance_card"
  | "lab_report"
  | "discharge_summary"
  | "prescription"
  | "consent_form"
  | "progress_note"
  | "imaging_report"
  | "referral"
  | "other"
  | "unclassified";

export interface QwenScreeningResult {
  id: string;
  documentId: string;
  classification: QwenDocumentClass;
  confidence: number;
  isLegible: boolean;
  legibilityScore: number;
  qualityIssues: string[];
  hasSignature?: boolean;
  processingTimeMs: number;
  timestamp: string;
  // CRITICAL: No PHI field in result
}

export interface QwenScreeningConfig {
  modelPath: string;
  maxPromptLength: number;
  allowedPrompts: Set<string>;
  timeout: number;
  logger: Logger;
}

// Safe-list of prompts that CANNOT access PHI
const SAFE_PROMPTS = new Set([
  "classification",
  "legibility",
  "quality",
  "signature_detection",
  "image_quality_assessment",
]);

// Keywords that indicate PHI extraction attempts
const PHI_KEYWORDS = [
  "name",
  "patient",
  "ssn",
  "dob",
  "date of birth",
  "mrn",
  "medical record",
  "phone",
  "email",
  "address",
  "insurance id",
  "policy",
  "account",
  "extract",
  "read",
  "transcribe",
  "diagnosis",
  "prognosis",
  "treatment",
  "medication",
];

export class QwenImageScreeningService {
  private modelPath: string;
  private allowedPrompts: Set<string>;
  private logger: Logger;
  private model: any = null; // Will be loaded on demand

  constructor(config: QwenScreeningConfig) {
    this.modelPath = config.modelPath;
    this.allowedPrompts = config.allowedPrompts || SAFE_PROMPTS;
    this.logger = config.logger;
  }

  /**
   * CRITICAL SECURITY: Validate prompt before sending to Qwen
   * This is the PHI boundary enforcement layer
   */
  private validatePrompt(prompt: string): { valid: boolean; reason?: string } {
    // Check length
    if (prompt.length > 500) {
      return {
        valid: false,
        reason: "Prompt too long — may contain complex PHI extraction",
      };
    }

    // Check for PHI keywords
    const lowerPrompt = prompt.toLowerCase();
    for (const keyword of PHI_KEYWORDS) {
      if (lowerPrompt.includes(keyword)) {
        return {
          valid: false,
          reason: `Prompt contains PHI keyword: "${keyword}"`,
        };
      }
    }

    // If strict mode, verify prompt is in safe-list
    if (this.allowedPrompts.size > 0) {
      let isAllowed = false;
      for (const safe of this.allowedPrompts) {
        if (lowerPrompt.includes(safe)) {
          isAllowed = true;
          break;
        }
      }
      if (!isAllowed) {
        return {
          valid: false,
          reason: `Prompt not in safe-list. Allowed: ${Array.from(this.allowedPrompts).join(", ")}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Classify document type without extracting any content
   * SAFE: Output is only document class label
   */
  async classifyDocument(
    imageBuffer: Buffer,
    documentId: string
  ): Promise<QwenScreeningResult> {
    const startTime = Date.now();

    try {
      // PROMPT VALIDATION (PHI barrier #1)
      const classificationPrompt =
        "What type of medical document is this? Respond with ONLY one of these labels: insurance_card, lab_report, discharge_summary, prescription, consent_form, progress_note, imaging_report, referral, or other.";

      const validation = this.validatePrompt(classificationPrompt);
      if (!validation.valid) {
        throw new Error(`Unsafe prompt: ${validation.reason}`);
      }

      // Mock response (replace with actual Qwen inference)
      const result = await this.inferenceWithTimeout(
        imageBuffer,
        classificationPrompt,
        5000
      );

      const classification = this.parseClassification(result);

      const screeningResult: QwenScreeningResult = {
        id: uuidv4(),
        documentId,
        classification,
        confidence: 0.92, // Mock confidence
        isLegible: true, // Determined separately
        legibilityScore: 0.95,
        qualityIssues: [],
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      // AUDIT LOG (PHI barrier #2)
      this.logger.info(
        {
          docId: documentId,
          classification,
          processingMs: screeningResult.processingTimeMs,
        },
        "Qwen classification complete (no PHI logged)"
      );

      return screeningResult;
    } catch (error) {
      this.logger.error(
        { error, documentId },
        "Qwen classification failed"
      );
      throw error;
    }
  }

  /**
   * Assess document legibility
   * SAFE: Output is binary (readable/unreadable)
   */
  async assessLegibility(
    imageBuffer: Buffer,
    documentId: string
  ): Promise<{ isLegible: boolean; score: number; issues: string[] }> {
    try {
      const legibilityPrompt =
        "Rate this document's legibility for OCR. Respond with JSON: {legible: boolean, score: 0-100, issues: [list of problems]}. Issues may be: blurry, faded, rotated, cropped, glare, shadows.";

      const validation = this.validatePrompt(legibilityPrompt);
      if (!validation.valid) {
        throw new Error(`Unsafe prompt: ${validation.reason}`);
      }

      const result = await this.inferenceWithTimeout(
        imageBuffer,
        legibilityPrompt,
        5000
      );

      return this.parseLegibilityResult(result);
    } catch (error) {
      this.logger.error(
        { error, documentId },
        "Legibility assessment failed"
      );
      throw error;
    }
  }

  /**
   * Assess image quality (rotation, cropping, clarity)
   * SAFE: Output is metadata, not content
   */
  async assessQuality(
    imageBuffer: Buffer,
    documentId: string
  ): Promise<{
    quality: number;
    rotation: number;
    cropped: boolean;
    issues: string[];
  }> {
    try {
      const qualityPrompt =
        "Assess image quality. Respond with JSON: {quality: 0-100, rotation_degrees: -180 to 180, cropped: boolean, issues: [blurry|faded|rotated|cropped|glare|shadows]}";

      const validation = this.validatePrompt(qualityPrompt);
      if (!validation.valid) {
        throw new Error(`Unsafe prompt: ${validation.reason}`);
      }

      const result = await this.inferenceWithTimeout(
        imageBuffer,
        qualityPrompt,
        5000
      );

      return this.parseQualityResult(result);
    } catch (error) {
      this.logger.error(
        { error, documentId },
        "Quality assessment failed"
      );
      throw error;
    }
  }

  /**
   * Verify presence of signature (consent forms, consent docs)
   * SAFE: Binary output (has signature or not)
   */
  async detectSignature(
    imageBuffer: Buffer,
    documentId: string
  ): Promise<{ hasSignature: boolean; confidence: number }> {
    try {
      const signaturePrompt =
        "Does this document contain a handwritten signature? Respond with JSON: {has_signature: boolean, confidence: 0-100}";

      const validation = this.validatePrompt(signaturePrompt);
      if (!validation.valid) {
        throw new Error(`Unsafe prompt: ${validation.reason}`);
      }

      const result = await this.inferenceWithTimeout(
        imageBuffer,
        signaturePrompt,
        3000
      );

      return this.parseSignatureResult(result);
    } catch (error) {
      this.logger.error(
        { error, documentId },
        "Signature detection failed"
      );
      throw error;
    }
  }

  /**
   * Full screening pipeline: classify + assess legibility + assess quality
   * Returns ONLY metadata; zero PHI extraction
   */
  async screenDocument(
    imageBuffer: Buffer,
    documentId: string
  ): Promise<QwenScreeningResult> {
    const startTime = Date.now();

    try {
      // Run all checks in parallel (no dependencies)
      const [classification, legibility, quality] = await Promise.all([
        this.classifyDocument(imageBuffer, documentId),
        this.assessLegibility(imageBuffer, documentId),
        this.assessQuality(imageBuffer, documentId),
      ]);

      const result: QwenScreeningResult = {
        id: uuidv4(),
        documentId,
        classification: classification.classification,
        confidence: classification.confidence,
        isLegible: legibility.isLegible,
        legibilityScore: legibility.score,
        qualityIssues: quality.issues,
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      // Log screening decision (NEVER log image content)
      this.logger.info(
        {
          docId: documentId,
          classification: result.classification,
          legible: result.isLegible,
          issues: result.qualityIssues.length,
          processingMs: result.processingTimeMs,
        },
        "Document screening complete"
      );

      return result;
    } catch (error) {
      this.logger.error(
        { error, documentId },
        "Full document screening failed"
      );
      throw error;
    }
  }

  // ============================================================
  // PRIVATE HELPERS (no PHI exposure)
  // ============================================================

  private async inferenceWithTimeout(
    imageBuffer: Buffer,
    prompt: string,
    timeoutMs: number
  ): Promise<string> {
    // TODO: Replace with actual Qwen inference via llama-cpp-python or ollama
    // For now, return mock response
    return Promise.resolve(
      JSON.stringify({ classification: "lab_report", confidence: 0.92 })
    );
  }

  private parseClassification(result: string): QwenDocumentClass {
    try {
      const parsed = JSON.parse(result);
      const classification = parsed.classification?.toLowerCase() || "other";

      const validClasses: QwenDocumentClass[] = [
        "insurance_card",
        "lab_report",
        "discharge_summary",
        "prescription",
        "consent_form",
        "progress_note",
        "imaging_report",
        "referral",
        "other",
      ];

      if (validClasses.includes(classification)) {
        return classification;
      }
    } catch {
      // Parse error, fallback to unclassified
    }

    return "unclassified";
  }

  private parseLegibilityResult(result: string): {
    isLegible: boolean;
    score: number;
    issues: string[];
  } {
    try {
      const parsed = JSON.parse(result);
      return {
        isLegible: parsed.legible ?? true,
        score: Math.min(100, Math.max(0, parsed.score ?? 80)),
        issues: (parsed.issues ?? []).slice(0, 5), // Cap at 5 issues
      };
    } catch {
      return { isLegible: true, score: 0, issues: ["parse_error"] };
    }
  }

  private parseQualityResult(result: string): {
    quality: number;
    rotation: number;
    cropped: boolean;
    issues: string[];
  } {
    try {
      const parsed = JSON.parse(result);
      return {
        quality: Math.min(100, Math.max(0, parsed.quality ?? 80)),
        rotation: Math.max(-180, Math.min(180, parsed.rotation_degrees ?? 0)),
        cropped: parsed.cropped ?? false,
        issues: (parsed.issues ?? []).slice(0, 5),
      };
    } catch {
      return { quality: 0, rotation: 0, cropped: false, issues: [] };
    }
  }

  private parseSignatureResult(result: string): {
    hasSignature: boolean;
    confidence: number;
  } {
    try {
      const parsed = JSON.parse(result);
      return {
        hasSignature: parsed.has_signature ?? false,
        confidence: Math.min(100, Math.max(0, parsed.confidence ?? 0)),
      };
    } catch {
      return { hasSignature: false, confidence: 0 };
    }
  }
}

// Export singleton
export let qwenScreeningService: QwenImageScreeningService;

export function initializeQwenService(
  config: QwenScreeningConfig
): QwenImageScreeningService {
  qwenScreeningService = new QwenImageScreeningService(config);
  return qwenScreeningService;
}
