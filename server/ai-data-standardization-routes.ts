import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiFhirDataStandardizationService, NO_CDS_DISCLAIMER } from "./services/ai-fhir-data-standardization";
import { aiDocumentExtractionService, EXTRACTION_NO_CDS_DISCLAIMER, DocumentType } from "./services/ai-document-extraction";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

function getUserId(req: Request): string {
  return (req as any).user?.id || "anonymous";
}

function createSuccessResponse(data: any, isExtraction: boolean = false) {
  return {
    success: true,
    data,
    noCdsDisclaimer: isExtraction ? EXTRACTION_NO_CDS_DISCLAIMER : NO_CDS_DISCLAIMER
  };
}

function createErrorResponse(message: string, code: string = "ERROR", isExtraction: boolean = false) {
  return {
    success: false,
    error: { code, message },
    noCdsDisclaimer: isExtraction ? EXTRACTION_NO_CDS_DISCLAIMER : NO_CDS_DISCLAIMER
  };
}

const standardizationOptionsSchema = z.object({
  harmonizeCodeSystems: z.boolean().default(true),
  normalizeUnits: z.boolean().default(true),
  standardizeDates: z.boolean().default(true),
  deduplicateResources: z.boolean().default(true),
  inferMissingFields: z.boolean().default(false),
  validateOutput: z.boolean().default(true),
  preferredCodeSystems: z.array(z.string()).default(["SNOMED_CT", "LOINC", "RXNORM"])
});

const standardizeRequestSchema = z.object({
  sourceResources: z.array(z.record(z.unknown())).min(1, "At least one resource is required"),
  sourceFormat: z.enum(["FHIR_R4", "FHIR_STU3", "FHIR_DSTU2", "HL7_V2", "CDA", "CUSTOM"]),
  options: standardizationOptionsSchema.optional()
});

const documentTypes: DocumentType[] = [
  "clinical_note", "lab_report", "radiology_report", "pathology_report",
  "discharge_summary", "referral_letter", "prescription", "insurance_form",
  "consent_form", "fax", "external_record", "unknown"
];

const extractDocumentSchema = z.object({
  documentContent: z.string().min(10, "Document content is required"),
  documentType: z.enum(documentTypes as [DocumentType, ...DocumentType[]]),
  contentType: z.enum(["text", "base64_image", "pdf_text"]).default("text"),
  patientId: z.string().optional()
});

const requestIdSchema = z.object({
  requestId: z.string().min(1, "Request ID is required")
});

router.get("/standardization/metadata", async (req: Request, res: Response) => {
  try {
    const stats = aiFhirDataStandardizationService.getStats();
    const profiles = aiFhirDataStandardizationService.getProfiles();
    const commonElements = aiFhirDataStandardizationService.getCommonElements();

    res.json(createSuccessResponse({
      feature: "AI FHIR Data Standardization",
      description: "Automatically harmonizes disparate FHIR resources into a consistent internal format using AI-powered mapping",
      capabilities: [
        "Code system harmonization (SNOMED-CT, LOINC, RxNorm, ICD-10)",
        "Unit normalization (UCUM standardization)",
        "Date format standardization (ISO 8601)",
        "Duplicate resource detection and merging",
        "AI-powered missing field inference",
        "Cross-profile common data element identification",
        "Quality scoring and recommendations"
      ],
      supportedFormats: ["FHIR_R4", "FHIR_STU3", "FHIR_DSTU2", "HL7_V2", "CDA", "CUSTOM"],
      supportedResourceTypes: ["Patient", "Condition", "Observation", "MedicationRequest", "AllergyIntolerance", "Procedure", "Encounter", "DiagnosticReport", "Immunization"],
      profiles: profiles.map(p => ({ id: p.id, name: p.name, description: p.description })),
      commonDataElementsCount: commonElements.length,
      stats
    }));
  } catch (error) {
    console.error("[API] Standardization metadata error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve metadata", "METADATA_ERROR"));
  }
});

router.post("/standardization/standardize", async (req: Request, res: Response) => {
  try {
    const parseResult = standardizeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse(
        `Validation error: ${parseResult.error.errors.map(e => e.message).join(", ")}`,
        "VALIDATION_ERROR"
      ));
    }

    const { sourceResources, sourceFormat, options } = parseResult.data;
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "FHIRStandardization",
      details: `API request to standardize ${sourceResources.length} resources from ${sourceFormat}`
    });

    const defaultOptions = {
      harmonizeCodeSystems: true,
      normalizeUnits: true,
      standardizeDates: true,
      deduplicateResources: true,
      inferMissingFields: false,
      validateOutput: true,
      preferredCodeSystems: ["SNOMED_CT", "LOINC", "RXNORM"]
    };

    const result = await aiFhirDataStandardizationService.standardizeResources(
      sourceResources,
      sourceFormat,
      { ...defaultOptions, ...options },
      userId
    );

    res.json(createSuccessResponse({
      requestId: result.id,
      status: result.status,
      result: result.result,
      createdAt: result.createdAt,
      completedAt: result.completedAt
    }));
  } catch (error) {
    console.error("[API] Standardization error:", error);
    res.status(500).json(createErrorResponse("Standardization failed", "STANDARDIZATION_ERROR"));
  }
});

router.get("/standardization/request/:requestId", async (req: Request, res: Response) => {
  try {
    const parseResult = requestIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse("Invalid request ID", "VALIDATION_ERROR"));
    }

    const { requestId } = parseResult.data;
    const userId = getUserId(req);

    const request = aiFhirDataStandardizationService.getRequest(requestId);
    if (!request) {
      return res.status(404).json(createErrorResponse("Request not found", "NOT_FOUND"));
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "FHIRStandardization",
      resourceId: requestId,
      details: "Retrieved standardization request"
    });

    res.json(createSuccessResponse({
      requestId: request.id,
      status: request.status,
      sourceFormat: request.sourceFormat,
      targetFormat: request.targetFormat,
      result: request.result,
      createdAt: request.createdAt,
      completedAt: request.completedAt
    }));
  } catch (error) {
    console.error("[API] Get request error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve request", "RETRIEVAL_ERROR"));
  }
});

router.get("/standardization/profiles", async (req: Request, res: Response) => {
  try {
    const profiles = aiFhirDataStandardizationService.getProfiles();

    res.json(createSuccessResponse({
      profiles: profiles.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        sourceProfiles: p.sourceProfiles,
        targetProfile: p.targetProfile,
        rulesCount: p.mappingRules.length,
        codeSystemPreferences: p.codeSystemPreferences,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    }));
  } catch (error) {
    console.error("[API] Get profiles error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve profiles", "RETRIEVAL_ERROR"));
  }
});

router.get("/standardization/common-elements", async (req: Request, res: Response) => {
  try {
    const elements = aiFhirDataStandardizationService.getCommonElements();

    res.json(createSuccessResponse({
      commonDataElements: elements.map(e => ({
        id: e.id,
        name: e.name,
        description: e.description,
        fhirPath: e.fhirPath,
        dataType: e.dataType,
        codeSystem: e.codeSystem,
        occurrencePercentage: e.occurrenceAcrossProfiles,
        profiles: e.profiles,
        semanticMeaning: e.semanticMeaning
      }))
    }));
  } catch (error) {
    console.error("[API] Get common elements error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve common elements", "RETRIEVAL_ERROR"));
  }
});

router.post("/standardization/identify-common-elements", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      resources: z.array(z.record(z.unknown())).min(2, "At least 2 resources required")
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse(
        `Validation error: ${parseResult.error.errors.map(e => e.message).join(", ")}`,
        "VALIDATION_ERROR"
      ));
    }

    const { resources } = parseResult.data;
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "FHIRResources",
      details: `Identifying common elements across ${resources.length} resources`
    });

    const commonElements = await aiFhirDataStandardizationService.identifyCommonElements(resources, userId);

    res.json(createSuccessResponse({
      resourcesAnalyzed: resources.length,
      commonElementsFound: commonElements.length,
      elements: commonElements
    }));
  } catch (error) {
    console.error("[API] Identify common elements error:", error);
    res.status(500).json(createErrorResponse("Failed to identify common elements", "ANALYSIS_ERROR"));
  }
});

router.get("/extraction/metadata", async (req: Request, res: Response) => {
  try {
    const stats = aiDocumentExtractionService.getStats();
    const templates = aiDocumentExtractionService.getTemplates();

    res.json(createSuccessResponse({
      feature: "AI Document Extraction",
      description: "Automatically extracts and structures data from unstructured sources into FHIR resources",
      capabilities: [
        "Clinical note parsing",
        "Lab report extraction",
        "Prescription data extraction",
        "Discharge summary processing",
        "Entity recognition (conditions, medications, procedures)",
        "Code system mapping (SNOMED, LOINC, RxNorm)",
        "Confidence scoring",
        "Human review flagging"
      ],
      supportedDocumentTypes: documentTypes,
      supportedContentTypes: ["text", "base64_image", "pdf_text"],
      outputResourceTypes: ["Condition", "Observation", "MedicationRequest", "AllergyIntolerance", "Procedure", "Immunization"],
      templates: templates.map(t => ({ id: t.id, name: t.name, documentType: t.documentType, patternsCount: t.patterns.length })),
      stats
    }, true));
  } catch (error) {
    console.error("[API] Extraction metadata error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve metadata", "METADATA_ERROR", true));
  }
});

router.post("/extraction/extract", async (req: Request, res: Response) => {
  try {
    const parseResult = extractDocumentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse(
        `Validation error: ${parseResult.error.errors.map(e => e.message).join(", ")}`,
        "VALIDATION_ERROR",
        true
      ));
    }

    const { documentContent, documentType, contentType, patientId } = parseResult.data;
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "DocumentExtraction",
      details: `API request to extract from ${documentType} (${contentType})`
    });

    const result = await aiDocumentExtractionService.extractFromDocument(
      documentContent,
      documentType,
      contentType,
      patientId,
      userId
    );

    res.json(createSuccessResponse({
      requestId: result.id,
      status: result.status,
      result: result.result,
      createdAt: result.createdAt,
      completedAt: result.completedAt
    }, true));
  } catch (error) {
    console.error("[API] Extraction error:", error);
    res.status(500).json(createErrorResponse("Document extraction failed", "EXTRACTION_ERROR", true));
  }
});

router.get("/extraction/request/:requestId", async (req: Request, res: Response) => {
  try {
    const parseResult = requestIdSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse("Invalid request ID", "VALIDATION_ERROR", true));
    }

    const { requestId } = parseResult.data;
    const userId = getUserId(req);

    const request = aiDocumentExtractionService.getRequest(requestId);
    if (!request) {
      return res.status(404).json(createErrorResponse("Request not found", "NOT_FOUND", true));
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DocumentExtraction",
      resourceId: requestId,
      details: "Retrieved extraction request"
    });

    res.json(createSuccessResponse({
      requestId: request.id,
      status: request.status,
      documentType: request.documentType,
      result: request.result,
      createdAt: request.createdAt,
      completedAt: request.completedAt
    }, true));
  } catch (error) {
    console.error("[API] Get extraction request error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve request", "RETRIEVAL_ERROR", true));
  }
});

router.get("/extraction/templates", async (req: Request, res: Response) => {
  try {
    const templates = aiDocumentExtractionService.getTemplates();

    res.json(createSuccessResponse({
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        documentType: t.documentType,
        patterns: t.patterns.map(p => ({ name: p.name, entityType: p.entityType })),
        fhirMappings: t.fhirMappings,
        isActive: t.isActive
      }))
    }, true));
  } catch (error) {
    console.error("[API] Get templates error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve templates", "RETRIEVAL_ERROR", true));
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const standardizationStats = aiFhirDataStandardizationService.getStats();
    const extractionStats = aiDocumentExtractionService.getStats();

    res.json(createSuccessResponse({
      standardization: standardizationStats,
      extraction: extractionStats,
      combined: {
        totalOperations: standardizationStats.totalRequests + extractionStats.totalExtractions,
        completedOperations: standardizationStats.completedRequests + extractionStats.completedExtractions,
        pendingReview: extractionStats.needsReview,
        avgQuality: Math.round((standardizationStats.avgQualityScore + extractionStats.avgConfidence) / 2)
      }
    }));
  } catch (error) {
    console.error("[API] Stats error:", error);
    res.status(500).json(createErrorResponse("Failed to retrieve stats", "STATS_ERROR"));
  }
});

export default router;
