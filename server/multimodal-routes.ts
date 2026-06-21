import { Router, type Request, type Response } from "express";
import { multimodalDocumentParser } from "./services/multimodal-document-parser";
import { medicalSafetyValidator } from "./services/medical-safety-validator";

const router = Router();

router.post("/api/multimodal/parse", async (req: Request, res: Response) => {
  try {
    const { imageData, mimeType, documentType } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: "imageData (base64) is required" });
    }

    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    const mime = mimeType || "image/jpeg";
    if (!validMimes.includes(mime)) {
      return res.status(400).json({ error: `Unsupported mime type. Supported: ${validMimes.join(", ")}` });
    }

    const userId = (req as any).user?.id || "anonymous";
    const result = await multimodalDocumentParser.parseDocument(
      imageData,
      mime,
      documentType || "unknown",
      userId
    );

    const safetyCheck = await medicalSafetyValidator.validateAIOutput(
      JSON.stringify(result.extractedData)
    );

    res.json({
      ...result,
      safetyValidation: {
        passed: safetyCheck.passed,
        risk: safetyCheck.overallRisk,
        issues: safetyCheck.checks.filter((c) => !c.passed).map((c) => c.details),
      },
    });
  } catch (error: any) {
    console.error("[MultimodalParse] Error:", error.message);
    res.status(500).json({ error: "Document parsing failed", details: error.message });
  }
});

router.post("/api/multimodal/parse-anonymous", async (req: Request, res: Response) => {
  try {
    const { imageData, mimeType, documentType } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: "imageData (base64) is required" });
    }

    const result = await multimodalDocumentParser.parseDocument(
      imageData,
      mimeType || "image/jpeg",
      documentType || "unknown",
      undefined
    );

    const safeResult = {
      documentType: result.documentType,
      confidence: result.confidence,
      thinking: result.thinking,
      extractedData: result.extractedData,
      warnings: result.warnings,
      ocrQuality: result.ocrQuality,
      noCdsDisclaimer: result.noCdsDisclaimer,
      fhirResourceCount: result.fhirResources.length,
    };

    res.json(safeResult);
  } catch (error: any) {
    console.error("[MultimodalParseAnonymous] Error:", error.message);
    res.status(500).json({ error: "Document parsing failed" });
  }
});

router.get("/api/multimodal/history", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const limit = parseInt(req.query.limit as string) || 10;
    const history = await multimodalDocumentParser.getRecentRequests(userId, limit);
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export function registerMultimodalRoutes(app: any) {
  app.use(router);
  console.log("[MultimodalRoutes] Registered: /api/multimodal/parse, /api/multimodal/parse-anonymous, /api/multimodal/history");
}
