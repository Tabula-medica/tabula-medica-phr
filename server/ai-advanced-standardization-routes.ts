import { Router, Request, Response } from "express";
import { z } from "zod";
import { 
  aiFhirAdvancedStandardizationService, 
  ADVANCED_STANDARDIZATION_DISCLAIMER 
} from "./services/ai-fhir-advanced-standardization";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

function getUserId(req: Request): string {
  return (req as any).user?.id || "anonymous";
}

function createSuccessResponse(data: any) {
  return {
    success: true,
    data,
    noCdsDisclaimer: ADVANCED_STANDARDIZATION_DISCLAIMER
  };
}

function createErrorResponse(message: string, code: string = "ERROR") {
  return {
    success: false,
    error: { code, message },
    noCdsDisclaimer: ADVANCED_STANDARDIZATION_DISCLAIMER
  };
}

const versionMappingSchema = z.object({
  sourceResource: z.record(z.unknown()),
  sourceVersion: z.enum(["DSTU2", "STU3", "R4", "R4B", "R5"])
});

const terminologySuggestionSchema = z.object({
  text: z.string().min(2, "Text must be at least 2 characters"),
  context: z.string().min(5, "Context must be at least 5 characters"),
  resourceType: z.string(),
  fieldPath: z.string()
});

const dataInferenceSchema = z.object({
  patientResources: z.array(z.record(z.unknown())).min(1),
  patientId: z.string().min(1),
  targetField: z.string().min(1)
});

const feedbackSchema = z.object({
  itemType: z.enum(["version_mapping", "terminology_suggestion", "data_inference"]),
  itemId: z.string().min(1),
  action: z.enum(["approve", "reject", "refine"]),
  reviewerRole: z.string().default("clinician"),
  refinement: z.object({
    refinementType: z.enum(["correction", "enhancement", "context", "alternative"]).optional(),
    originalValue: z.unknown().optional(),
    refinedValue: z.unknown().optional(),
    rationale: z.string().optional(),
    impactScore: z.number().min(0).max(1).optional()
  }).optional(),
  comments: z.string().optional()
});

const commonElementsSchema = z.object({
  profiles: z.array(z.string()).default(["US Core", "USCDI", "FHIR R4"]),
  versions: z.array(z.string()).default(["DSTU2", "STU3", "R4"])
});

router.get("/metadata", async (req: Request, res: Response) => {
  try {
    const stats = aiFhirAdvancedStandardizationService.getStats();

    res.json(createSuccessResponse({
      feature: "AI Advanced FHIR Standardization",
      description: "Advanced AI-powered FHIR harmonization with version mapping, terminology suggestion, data inference, and clinician feedback loop",
      capabilities: [
        "AI-powered complex FHIR structure mapping across versions (DSTU2, STU3, R4, R4B, R5)",
        "Automatic common data element identification across profiles",
        "AI terminology suggestion for SNOMED CT, LOINC, RxNorm, ICD-10-CM",
        "Clinical knowledge graph-based missing data inference",
        "Clinician feedback loop for AI mapping refinement",
        "Accuracy tracking and improvement over time"
      ],
      supportedVersions: ["DSTU2", "STU3", "R4", "R4B", "R5"],
      terminologySystems: ["SNOMED_CT", "LOINC", "RXNORM", "ICD10_CM", "ICD10_PCS", "CVX", "CPT"],
      stats
    }));
  } catch (error) {
    console.error("[API] Advanced standardization metadata error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve metadata", "METADATA_ERROR"));
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "AdvancedStandardizationDashboard",
      resourceId: "dashboard",
      details: "Accessing advanced standardization dashboard"
    });

    const stats = aiFhirAdvancedStandardizationService.getStats();
    const pendingMappings = aiFhirAdvancedStandardizationService.getVersionMappings("pending_review");
    const pendingTerminology = aiFhirAdvancedStandardizationService.getTerminologySuggestions("pending_review");
    const pendingInferences = aiFhirAdvancedStandardizationService.getDataInferences("pending_review");
    const accuracyMetrics = aiFhirAdvancedStandardizationService.getAccuracyMetrics();

    res.json(createSuccessResponse({
      stats,
      pendingItems: {
        versionMappings: pendingMappings.slice(0, 10),
        terminologySuggestions: pendingTerminology.slice(0, 10),
        dataInferences: pendingInferences.slice(0, 10)
      },
      accuracyMetrics,
      lastUpdated: new Date().toISOString()
    }));
  } catch (error) {
    console.error("[API] Dashboard error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve dashboard", "DASHBOARD_ERROR"));
  }
});

router.post("/version-mapping/analyze", async (req: Request, res: Response) => {
  try {
    const parseResult = versionMappingSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse(
        `Validation error: ${parseResult.error.errors.map(e => e.message).join(", ")}`,
        "VALIDATION_ERROR"
      ));
    }

    const userId = getUserId(req);
    const { sourceResource, sourceVersion } = parseResult.data;

    const mapping = await aiFhirAdvancedStandardizationService.analyzeVersionMapping(
      sourceResource,
      sourceVersion,
      userId
    );

    res.json(createSuccessResponse({
      mapping,
      message: "Version mapping analysis completed. Pending clinician review."
    }));
  } catch (error) {
    console.error("[API] Version mapping error:", error);
    res.status(500).json(createErrorResponse("Failed to analyze version mapping", "MAPPING_ERROR"));
  }
});

router.get("/version-mapping", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const status = req.query.status as string | undefined;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VersionMappings",
      resourceId: "list",
      details: `Retrieving version mappings with status: ${status || "all"}`
    });

    const mappings = aiFhirAdvancedStandardizationService.getVersionMappings(
      status as any
    );

    res.json(createSuccessResponse({ mappings }));
  } catch (error) {
    console.error("[API] Get version mappings error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve version mappings", "RETRIEVAL_ERROR"));
  }
});

router.post("/terminology/suggest", async (req: Request, res: Response) => {
  try {
    const parseResult = terminologySuggestionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse(
        `Validation error: ${parseResult.error.errors.map(e => e.message).join(", ")}`,
        "VALIDATION_ERROR"
      ));
    }

    const userId = getUserId(req);
    const { text, context, resourceType, fieldPath } = parseResult.data;

    const suggestion = await aiFhirAdvancedStandardizationService.suggestTerminology(
      text,
      context,
      resourceType,
      fieldPath,
      userId
    );

    res.json(createSuccessResponse({
      suggestion,
      message: "Terminology suggestions generated. Pending clinician review."
    }));
  } catch (error) {
    console.error("[API] Terminology suggestion error:", error);
    res.status(500).json(createErrorResponse("Failed to generate terminology suggestions", "SUGGESTION_ERROR"));
  }
});

router.get("/terminology", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const status = req.query.status as string | undefined;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "TerminologySuggestions",
      resourceId: "list",
      details: `Retrieving terminology suggestions with status: ${status || "all"}`
    });

    const suggestions = aiFhirAdvancedStandardizationService.getTerminologySuggestions(
      status as any
    );

    res.json(createSuccessResponse({ suggestions }));
  } catch (error) {
    console.error("[API] Get terminology suggestions error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve terminology suggestions", "RETRIEVAL_ERROR"));
  }
});

router.post("/data-inference/infer", async (req: Request, res: Response) => {
  try {
    const parseResult = dataInferenceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse(
        `Validation error: ${parseResult.error.errors.map(e => e.message).join(", ")}`,
        "VALIDATION_ERROR"
      ));
    }

    const userId = getUserId(req);
    const { patientResources, patientId, targetField } = parseResult.data;

    const inference = await aiFhirAdvancedStandardizationService.inferMissingData(
      patientResources,
      patientId,
      targetField,
      userId
    );

    res.json(createSuccessResponse({
      inference,
      message: "Data inference completed. Pending clinician review."
    }));
  } catch (error) {
    console.error("[API] Data inference error:", error);
    res.status(500).json(createErrorResponse("Failed to infer missing data", "INFERENCE_ERROR"));
  }
});

router.get("/data-inference", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const status = req.query.status as string | undefined;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DataInferences",
      resourceId: "list",
      details: `Retrieving data inferences with status: ${status || "all"}`
    });

    const inferences = aiFhirAdvancedStandardizationService.getDataInferences(
      status as any
    );

    res.json(createSuccessResponse({ inferences }));
  } catch (error) {
    console.error("[API] Get data inferences error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve data inferences", "RETRIEVAL_ERROR"));
  }
});

router.post("/feedback", async (req: Request, res: Response) => {
  try {
    const parseResult = feedbackSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse(
        `Validation error: ${parseResult.error.errors.map(e => e.message).join(", ")}`,
        "VALIDATION_ERROR"
      ));
    }

    const userId = getUserId(req);
    const { itemType, itemId, action, reviewerRole, refinement, comments } = parseResult.data;

    const feedback = await aiFhirAdvancedStandardizationService.submitFeedback(
      itemType,
      itemId,
      action,
      userId,
      reviewerRole,
      refinement,
      comments
    );

    res.json(createSuccessResponse({
      feedback,
      message: `Feedback submitted: ${action} for ${itemType}`
    }));
  } catch (error) {
    console.error("[API] Feedback submission error:", error);
    res.status(500).json(createErrorResponse("Failed to submit feedback", "FEEDBACK_ERROR"));
  }
});

router.get("/feedback", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const itemId = req.query.itemId as string | undefined;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "FeedbackHistory",
      resourceId: itemId || "all",
      details: "Retrieving feedback history"
    });

    const history = aiFhirAdvancedStandardizationService.getFeedbackHistory(itemId);

    res.json(createSuccessResponse({ feedbackHistory: history }));
  } catch (error) {
    console.error("[API] Get feedback history error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve feedback history", "RETRIEVAL_ERROR"));
  }
});

router.post("/common-elements/analyze", async (req: Request, res: Response) => {
  try {
    const parseResult = commonElementsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse(
        `Validation error: ${parseResult.error.errors.map(e => e.message).join(", ")}`,
        "VALIDATION_ERROR"
      ));
    }

    const userId = getUserId(req);
    const { profiles, versions } = parseResult.data;

    const analysis = await aiFhirAdvancedStandardizationService.analyzeCommonDataElements(
      profiles,
      versions,
      userId
    );

    res.json(createSuccessResponse({
      analysis,
      message: "Common data element analysis completed"
    }));
  } catch (error) {
    console.error("[API] Common elements analysis error:", error);
    res.status(500).json(createErrorResponse("Failed to analyze common elements", "ANALYSIS_ERROR"));
  }
});

router.get("/common-elements", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "CommonElementAnalyses",
      resourceId: "list",
      details: "Retrieving common element analyses"
    });

    const analyses = aiFhirAdvancedStandardizationService.getCommonElementAnalyses();

    res.json(createSuccessResponse({ analyses }));
  } catch (error) {
    console.error("[API] Get common elements error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve common element analyses", "RETRIEVAL_ERROR"));
  }
});

router.get("/accuracy-metrics", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "AccuracyMetrics",
      resourceId: "metrics",
      details: "Retrieving accuracy metrics"
    });

    const metrics = aiFhirAdvancedStandardizationService.getAccuracyMetrics();

    res.json(createSuccessResponse({ metrics }));
  } catch (error) {
    console.error("[API] Get accuracy metrics error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve accuracy metrics", "METRICS_ERROR"));
  }
});

export default router;
