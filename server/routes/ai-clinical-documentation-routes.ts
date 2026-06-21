import { Router, Request, Response } from "express";
import { aiClinicalDocService } from "../services/ai-clinical-documentation";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    service: "AI Clinical Documentation Assistant",
    version: "1.0.0",
    features: [
      "Audio transcription to structured notes",
      "AI-generated clinical note drafts",
      "ICD-10 and CPT code suggestions",
      "Prior authorization automation",
    ],
    compliance: {
      noCDS: true,
      disclaimer: "All outputs are for documentation assistance only and require physician verification.",
    },
  });
});

router.post("/transcribe", async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    console.log("[HIPAA-AUDIT] Transcription request initiated");
    const result = await aiClinicalDocService.transcribeConversation(audioBase64, mimeType);
    console.log("[HIPAA-AUDIT] Transcription completed successfully");

    res.json(result);
  } catch (error) {
    console.error("[AI-ClinicalDoc] Transcription error:", error);
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

router.post("/generate-note", async (req: Request, res: Response) => {
  try {
    const { patientId, patientSummary, visitType, chiefComplaint, caseReviewNotes, additionalContext } = req.body;

    if (!patientId || !chiefComplaint) {
      return res.status(400).json({ error: "Patient ID and chief complaint are required" });
    }

    console.log("[HIPAA-AUDIT] Clinical note generation requested for patient:", patientId);
    const result = await aiClinicalDocService.generateClinicalNote({
      patientId,
      patientSummary: patientSummary || "",
      visitType: visitType || "follow_up",
      chiefComplaint,
      caseReviewNotes,
      additionalContext,
    });
    console.log("[HIPAA-AUDIT] Clinical note generated:", result.noteId);

    res.json(result);
  } catch (error) {
    console.error("[AI-ClinicalDoc] Note generation error:", error);
    res.status(500).json({ error: "Failed to generate clinical note" });
  }
});

router.post("/suggest-codes", async (req: Request, res: Response) => {
  try {
    const { clinicalText, patientContext } = req.body;

    if (!clinicalText) {
      return res.status(400).json({ error: "Clinical text is required" });
    }

    console.log("[HIPAA-AUDIT] Code suggestion requested");
    const codes = await aiClinicalDocService.suggestCodes(clinicalText, patientContext);
    console.log("[HIPAA-AUDIT] Code suggestions generated:", codes.length);

    res.json({ codes });
  } catch (error) {
    console.error("[AI-ClinicalDoc] Code suggestion error:", error);
    res.status(500).json({ error: "Failed to suggest codes" });
  }
});

router.post("/prior-authorization", async (req: Request, res: Response) => {
  try {
    const { patientId, patientName, insuranceInfo, requestedService, clinicalJustification, supportingDocumentation } = req.body;

    if (!patientId || !patientName || !insuranceInfo || !requestedService) {
      return res.status(400).json({ error: "Missing required prior authorization fields" });
    }

    console.log("[HIPAA-AUDIT] Prior authorization request initiated for patient:", patientId);
    const result = await aiClinicalDocService.generatePriorAuthorization({
      patientId,
      patientName,
      insuranceInfo,
      requestedService,
      clinicalJustification: clinicalJustification || "",
      supportingDocumentation,
    });
    console.log("[HIPAA-AUDIT] Prior authorization generated:", result.requestId);

    res.json(result);
  } catch (error) {
    console.error("[AI-ClinicalDoc] Prior auth error:", error);
    res.status(500).json({ error: "Failed to generate prior authorization" });
  }
});

export function registerAIClinicalDocumentationRoutes(app: any) {
  app.use("/api/ai-clinical-documentation", router);
  console.log("[Routes] AI Clinical Documentation routes registered at /api/ai-clinical-documentation/*");
}
