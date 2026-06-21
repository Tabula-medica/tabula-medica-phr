import { Router, Request, Response } from "express";
import { 
  aiFHIRDataSummarizationService,
  type SummarizationRequest,
  type DataViewType,
  type AudienceType,
  type PatientFHIRData
} from "./services/ai-fhir-data-summarization-service";

const router = Router();

const NO_CDS_DISCLAIMER = "IMPORTANT: This summary is for informational and educational purposes only. It does NOT constitute clinical decision support, diagnosis, or medical advice. All information requires verification by qualified healthcare professionals before use in clinical decisions.";

router.post("/summarize", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { 
      patientId, 
      viewType, 
      audience, 
      style,
      timeframeDays,
      focusAreas,
      includeTrends,
      includeHighlights,
      fhirData
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        error: "patientId is required",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }

    if (!viewType || !["medications", "conditions", "labs", "encounters", "comprehensive"].includes(viewType)) {
      return res.status(400).json({
        error: "viewType must be one of: medications, conditions, labs, encounters, comprehensive",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }

    if (!audience || !["patient", "provider", "caregiver"].includes(audience)) {
      return res.status(400).json({
        error: "audience must be one of: patient, provider, caregiver",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }

    const request: SummarizationRequest = {
      patientId,
      viewType: viewType as DataViewType,
      audience: audience as AudienceType,
      style: style || "detailed",
      timeframeDays,
      focusAreas,
      includetrends: includeTrends !== false,
      includeHighlights: includeHighlights !== false
    };

    const patientData: PatientFHIRData = fhirData || await aiFHIRDataSummarizationService.getSamplePatientData(patientId);

    const summary = await aiFHIRDataSummarizationService.summarizeFHIRData(
      patientData,
      request,
      userId
    );

    res.json({
      summary,
      message: `Generated ${viewType} summary for ${audience}`,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIFHIRDataSummarization] Error generating summary:", error);
    res.status(500).json({
      error: "Failed to generate FHIR data summary",
      message: error instanceof Error ? error.message : "Unknown error",
      disclaimer: NO_CDS_DISCLAIMER
    });
  }
});

router.get("/medications/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { patientId } = req.params;
    const audience = (req.query.audience as AudienceType) || "patient";

    const request: SummarizationRequest = {
      patientId,
      viewType: "medications",
      audience,
      includetrends: true,
      includeHighlights: true
    };

    const patientData = await aiFHIRDataSummarizationService.getSamplePatientData(patientId);
    const summary = await aiFHIRDataSummarizationService.summarizeFHIRData(patientData, request, userId);

    res.json({
      summary,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIFHIRDataSummarization] Medications summary error:", error);
    res.status(500).json({
      error: "Failed to generate medications summary",
      disclaimer: NO_CDS_DISCLAIMER
    });
  }
});

router.get("/conditions/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { patientId } = req.params;
    const audience = (req.query.audience as AudienceType) || "patient";

    const request: SummarizationRequest = {
      patientId,
      viewType: "conditions",
      audience,
      includetrends: true,
      includeHighlights: true
    };

    const patientData = await aiFHIRDataSummarizationService.getSamplePatientData(patientId);
    const summary = await aiFHIRDataSummarizationService.summarizeFHIRData(patientData, request, userId);

    res.json({
      summary,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIFHIRDataSummarization] Conditions summary error:", error);
    res.status(500).json({
      error: "Failed to generate conditions summary",
      disclaimer: NO_CDS_DISCLAIMER
    });
  }
});

router.get("/labs/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { patientId } = req.params;
    const audience = (req.query.audience as AudienceType) || "patient";

    const request: SummarizationRequest = {
      patientId,
      viewType: "labs",
      audience,
      includetrends: true,
      includeHighlights: true
    };

    const patientData = await aiFHIRDataSummarizationService.getSamplePatientData(patientId);
    const summary = await aiFHIRDataSummarizationService.summarizeFHIRData(patientData, request, userId);

    res.json({
      summary,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIFHIRDataSummarization] Labs summary error:", error);
    res.status(500).json({
      error: "Failed to generate labs summary",
      disclaimer: NO_CDS_DISCLAIMER
    });
  }
});

router.get("/encounters/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { patientId } = req.params;
    const audience = (req.query.audience as AudienceType) || "patient";

    const request: SummarizationRequest = {
      patientId,
      viewType: "encounters",
      audience,
      includetrends: true,
      includeHighlights: true
    };

    const patientData = await aiFHIRDataSummarizationService.getSamplePatientData(patientId);
    const summary = await aiFHIRDataSummarizationService.summarizeFHIRData(patientData, request, userId);

    res.json({
      summary,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIFHIRDataSummarization] Encounters summary error:", error);
    res.status(500).json({
      error: "Failed to generate encounters summary",
      disclaimer: NO_CDS_DISCLAIMER
    });
  }
});

router.get("/comprehensive/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { patientId } = req.params;
    const audience = (req.query.audience as AudienceType) || "patient";

    const request: SummarizationRequest = {
      patientId,
      viewType: "comprehensive",
      audience,
      includetrends: true,
      includeHighlights: true
    };

    const patientData = await aiFHIRDataSummarizationService.getSamplePatientData(patientId);
    const summary = await aiFHIRDataSummarizationService.summarizeFHIRData(patientData, request, userId);

    res.json({
      summary,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIFHIRDataSummarization] Comprehensive summary error:", error);
    res.status(500).json({
      error: "Failed to generate comprehensive summary",
      disclaimer: NO_CDS_DISCLAIMER
    });
  }
});

router.post("/batch-summarize", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "system";
    const { patientId, viewTypes, audience } = req.body;

    if (!patientId) {
      return res.status(400).json({
        error: "patientId is required",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }

    const validViewTypes: DataViewType[] = ["medications", "conditions", "labs", "encounters"];
    const requestedTypes = viewTypes?.filter((t: string) => validViewTypes.includes(t as DataViewType)) || validViewTypes;

    const patientData = await aiFHIRDataSummarizationService.getSamplePatientData(patientId);
    
    const summaries = await Promise.all(
      requestedTypes.map(async (viewType: DataViewType) => {
        const request: SummarizationRequest = {
          patientId,
          viewType,
          audience: audience || "patient",
          includetrends: true,
          includeHighlights: true
        };
        return aiFHIRDataSummarizationService.summarizeFHIRData(patientData, request, userId);
      })
    );

    const result: Record<string, any> = {};
    requestedTypes.forEach((type: string, index: number) => {
      result[type] = summaries[index];
    });

    res.json({
      patientId,
      summaries: result,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIFHIRDataSummarization] Batch summary error:", error);
    res.status(500).json({
      error: "Failed to generate batch summaries",
      disclaimer: NO_CDS_DISCLAIMER
    });
  }
});

export function registerAIFHIRDataSummarizationRoutes(app: any) {
  app.use("/api/fhir-summarization", router);
  console.log("[Routes] AI FHIR Data Summarization routes registered at /api/fhir-summarization/*");
}

export default router;
