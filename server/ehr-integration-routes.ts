import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ehrService from "./services/ehr-integration-service";
import * as dicomService from "./services/dicom-integration-service";
import { searchEpicEndpoints, getEndpointCount } from "./services/epic-endpoint-service";
import type { EhrPlatform } from "@shared/schema";

const router = Router();

function hashIdentifier(id: string): string {
  return id.slice(0, 8) + "***";
}

function logHipaaAudit(action: string, userId: string | null, resourceId: string, details: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][EHR-Routes] ${timestamp} - ${action} - User:${userId ? hashIdentifier(userId) : "NONE"} - Resource:${resourceId} - ${details}`);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", null, req.path, "No authenticated session");
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  
  (req as any).authenticatedUserId = sessionUserId;
  next();
}

function enforceSessionUserId(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req as any).authenticatedUserId;
  
  if (req.query.userId && req.query.userId !== sessionUserId) {
    logHipaaAudit("ACCESS_DENIED", sessionUserId, req.path, `Attempted access to userId:${hashIdentifier(req.query.userId as string)}`);
    return res.status(403).json({ success: false, error: "Access denied" });
  }
  
  if (req.body?.userId && req.body.userId !== sessionUserId) {
    logHipaaAudit("ACCESS_DENIED", sessionUserId, req.path, `Attempted access to userId:${hashIdentifier(req.body.userId)}`);
    return res.status(403).json({ success: false, error: "Access denied" });
  }
  
  (req.query as any).userId = sessionUserId;
  if (req.body) {
    req.body.userId = sessionUserId;
  }
  
  next();
}

function validateConnectionOwnership(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req as any).authenticatedUserId;
  const connectionId = req.params.connectionId;
  
  if (connectionId) {
    const connection = ehrService.getConnection(connectionId);
    if (connection && connection.userId !== sessionUserId) {
      logHipaaAudit("ACCESS_DENIED", sessionUserId, connectionId, "Connection belongs to different user");
      return res.status(403).json({ success: false, error: "Access denied" });
    }
  }
  
  next();
}

router.get("/platforms", async (req: Request, res: Response) => {
  try {
    const platforms = ehrService.getSupportedPlatforms();
    res.json({ success: true, platforms });
  } catch (error) {
    console.error("[EHR Routes] Error getting platforms:", error);
    res.status(500).json({ success: false, error: "Failed to get supported platforms" });
  }
});

router.get("/epic/endpoints", async (req: Request, res: Response) => {
  try {
    const query = z.string().min(1).safeParse(req.query.q);
    if (!query.success) {
      return res.status(400).json({ success: false, error: "Search query 'q' is required (min 1 character)" });
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const results = await searchEpicEndpoints(query.data, limit);
    res.json({ success: true, endpoints: results });
  } catch (error) {
    console.error("[EHR Routes] Error searching Epic endpoints:", error);
    res.status(500).json({ success: false, error: "Failed to search Epic endpoints" });
  }
});

router.get("/epic/endpoints/count", async (req: Request, res: Response) => {
  try {
    const count = await getEndpointCount();
    res.json({ success: true, count });
  } catch (error) {
    console.error("[EHR Routes] Error getting Epic endpoint count:", error);
    res.status(500).json({ success: false, error: "Failed to get endpoint count" });
  }
});

router.use(requireAuth);
router.use(enforceSessionUserId);
router.use(validateConnectionOwnership);

const ehrPlatformSchema = z.enum(["fastenhealth", "epic", "ecw", "athena", "meditech"]);

const initiateAuthSchema = z.object({
  platform: ehrPlatformSchema,
  userId: z.string().min(1),
  redirectUri: z.string().url(),
  launchContext: z.string().optional(),
  aud: z.string().optional(),
});

const tokenCallbackSchema = z.object({
  platform: ehrPlatformSchema,
  userId: z.string().min(1),
  code: z.string().min(1),
  codeVerifier: z.string().min(1),
  redirectUri: z.string().url(),
  state: z.string().min(1),
  facilityName: z.string().optional(),
});

const userIdQuerySchema = z.object({
  userId: z.string().min(1),
});

const syncSchema = z.object({
  userId: z.string().min(1),
});

const dicomConnectionSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  pacsEndpoint: z.string().min(1),
  wadoEndpoint: z.string().optional(),
  aetitle: z.string().min(1),
  calledAetitle: z.string().min(1),
  port: z.number().int().positive().optional(),
  supportedModalities: z.array(z.string()).optional(),
  retrievalMethods: z.array(z.string()).optional(),
  tlsEnabled: z.boolean().optional(),
  metadata: z.record(z.string()).optional(),
});

const dicomQuerySchema = z.object({
  userId: z.string().min(1),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  studyDate: z.string().optional(),
  modality: z.string().optional(),
  accessionNumber: z.string().optional(),
  studyInstanceUid: z.string().optional(),
  bodyPart: z.string().optional(),
  studyDescription: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().min(0).optional(),
});

const dicomRetrieveSchema = z.object({
  userId: z.string().min(1),
  studyInstanceUid: z.string().min(1),
  seriesInstanceUid: z.string().optional(),
  sopInstanceUid: z.string().optional(),
  format: z.enum(["dicom", "jpeg", "png"]).optional(),
  quality: z.number().int().min(1).max(100).optional(),
  windowCenter: z.number().optional(),
  windowWidth: z.number().optional(),
  frame: z.number().int().positive().optional(),
});

function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: result.error.errors.map(e => ({ path: e.path.join("."), message: e.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: result.error.errors.map(e => ({ path: e.path.join("."), message: e.message })),
      });
    }
    next();
  };
}

router.post("/auth/initiate", validateBody(initiateAuthSchema), async (req: Request, res: Response) => {
  try {
    const { platform, userId, redirectUri, launchContext, aud } = req.body;

    const authResponse = await ehrService.initiateSmartAuth({
      platform: platform as EhrPlatform,
      userId,
      redirectUri,
      launchContext,
      aud,
    });

    res.json({ success: true, ...authResponse });
  } catch (error) {
    console.error("[EHR Routes] Error initiating auth:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to initiate authentication" 
    });
  }
});

router.post("/auth/callback", validateBody(tokenCallbackSchema), async (req: Request, res: Response) => {
  try {
    const { platform, userId, code, codeVerifier, redirectUri, state } = req.body;

    const tokenResponse = await ehrService.exchangeToken({
      platform: platform as EhrPlatform,
      userId,
      code,
      codeVerifier,
      redirectUri,
      state,
    });

    const connection = await ehrService.createConnection(userId, platform as EhrPlatform, tokenResponse, {
      fhirBaseUrl: tokenResponse.fhirBaseUrl,
      tokenEndpoint: tokenResponse.tokenEndpoint,
      facilityName: req.body.facilityName,
    });

    res.json({ 
      success: true, 
      connection,
      patientId: tokenResponse.patientId,
    });
  } catch (error) {
    console.error("[EHR Routes] Error exchanging token:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to complete authentication" 
    });
  }
});

router.get("/connections", validateQuery(userIdQuerySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const connections = ehrService.getUserConnections(userId);
    res.json({ success: true, connections });
  } catch (error) {
    console.error("[EHR Routes] Error getting connections:", error);
    res.status(500).json({ success: false, error: "Failed to get connections" });
  }
});

router.get("/connections/:connectionId", async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const connection = ehrService.getConnection(connectionId);

    if (!connection) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    res.json({ success: true, connection });
  } catch (error) {
    console.error("[EHR Routes] Error getting connection:", error);
    res.status(500).json({ success: false, error: "Failed to get connection" });
  }
});

router.post("/connections/:connectionId/sync", validateBody(syncSchema), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { userId } = req.body;

    const result = await ehrService.syncConnection(connectionId, userId);

    logHipaaAudit("SYNC_WITH_DEDUP", userId, connectionId,
      `Sync complete. Dedup: ${result.deduplication?.ran ? result.deduplication.action : "skipped"}`);

    res.json(result);
  } catch (error) {
    console.error("[EHR Routes] Error syncing connection:", error);
    res.status(500).json({ success: false, error: "Failed to sync connection" });
  }
});

router.post("/connections/:connectionId/disconnect", validateBody(syncSchema), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { userId } = req.body;

    const success = await ehrService.disconnectConnection(connectionId, userId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: "Connection not found or unauthorized" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[EHR Routes] Error disconnecting:", error);
    res.status(500).json({ success: false, error: "Failed to disconnect" });
  }
});

router.get("/connections/:connectionId/resources/:resourceType", validateQuery(userIdQuerySchema), async (req: Request, res: Response) => {
  try {
    const { connectionId, resourceType } = req.params;
    const userId = req.query.userId as string;
    const resourceId = req.query.resourceId as string | undefined;
    
    let searchParams: Record<string, string> | undefined;
    if (req.query.search) {
      try {
        searchParams = JSON.parse(req.query.search as string);
      } catch {
        return res.status(400).json({ success: false, error: "Invalid search parameter format" });
      }
    }

    const result = await ehrService.fetchFhirResource({
      connectionId,
      userId,
      resourceType,
      resourceId,
      searchParams,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("[EHR Routes] Error fetching resource:", error);
    res.status(500).json({ success: false, error: "Failed to fetch resource" });
  }
});

router.get("/connections/:connectionId/audit", validateQuery(userIdQuerySchema), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const userId = req.query.userId as string;

    const auditLog = ehrService.getConnectionAuditLog(connectionId, userId);

    if (!auditLog) {
      return res.status(404).json({ success: false, error: "Connection not found or unauthorized" });
    }

    res.json({ success: true, auditLog });
  } catch (error) {
    console.error("[EHR Routes] Error getting audit log:", error);
    res.status(500).json({ success: false, error: "Failed to get audit log" });
  }
});

router.get("/dicom/modalities", async (req: Request, res: Response) => {
  try {
    const modalities = dicomService.getSupportedModalities();
    res.json({ success: true, modalities });
  } catch (error) {
    console.error("[DICOM Routes] Error getting modalities:", error);
    res.status(500).json({ success: false, error: "Failed to get modalities" });
  }
});

router.post("/dicom/connections", validateBody(dicomConnectionSchema), async (req: Request, res: Response) => {
  try {
    const { userId, displayName, pacsEndpoint, wadoEndpoint, aetitle, calledAetitle, port, supportedModalities, retrievalMethods, tlsEnabled, metadata } = req.body;

    const connection = await dicomService.createConnection(userId, {
      displayName,
      pacsEndpoint,
      wadoEndpoint,
      aetitle,
      calledAetitle,
      port,
      supportedModalities: supportedModalities as any,
      retrievalMethods: retrievalMethods as any,
      tlsEnabled,
      metadata,
    });

    res.json({ success: true, connection });
  } catch (error) {
    console.error("[DICOM Routes] Error creating connection:", error);
    res.status(500).json({ success: false, error: "Failed to create DICOM connection" });
  }
});

router.get("/dicom/connections", validateQuery(userIdQuerySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const connections = dicomService.getUserConnections(userId);
    res.json({ success: true, connections });
  } catch (error) {
    console.error("[DICOM Routes] Error getting connections:", error);
    res.status(500).json({ success: false, error: "Failed to get connections" });
  }
});

router.get("/dicom/connections/:connectionId", async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const connection = dicomService.getConnection(connectionId);

    if (!connection) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    res.json({ success: true, connection });
  } catch (error) {
    console.error("[DICOM Routes] Error getting connection:", error);
    res.status(500).json({ success: false, error: "Failed to get connection" });
  }
});

router.post("/dicom/connections/:connectionId/query", validateBody(dicomQuerySchema), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { userId, ...queryParams } = req.body;

    const result = await dicomService.queryStudies(connectionId, userId, queryParams);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("[DICOM Routes] Error querying studies:", error);
    res.status(500).json({ success: false, error: "Failed to query studies" });
  }
});

router.get("/dicom/connections/:connectionId/studies/:studyUid", validateQuery(userIdQuerySchema), async (req: Request, res: Response) => {
  try {
    const { connectionId, studyUid } = req.params;
    const userId = req.query.userId as string;

    const study = await dicomService.getStudyMetadata(connectionId, userId, studyUid);

    if (!study) {
      return res.status(404).json({ success: false, error: "Study not found" });
    }

    res.json({ success: true, study });
  } catch (error) {
    console.error("[DICOM Routes] Error getting study:", error);
    res.status(500).json({ success: false, error: "Failed to get study" });
  }
});

router.get("/dicom/connections/:connectionId/studies/:studyUid/fhir", validateQuery(userIdQuerySchema), async (req: Request, res: Response) => {
  try {
    const { connectionId, studyUid } = req.params;
    const userId = req.query.userId as string;
    const patientReference = req.query.patientReference as string;

    const study = await dicomService.getStudyMetadata(connectionId, userId, studyUid);

    if (!study) {
      return res.status(404).json({ success: false, error: "Study not found" });
    }

    const fhirResource = dicomService.convertToFhirImagingStudy(study, patientReference || `Patient/${userId}`);

    res.json({ success: true, fhirResource });
  } catch (error) {
    console.error("[DICOM Routes] Error converting to FHIR:", error);
    res.status(500).json({ success: false, error: "Failed to convert to FHIR" });
  }
});

router.post("/dicom/connections/:connectionId/retrieve", validateBody(dicomRetrieveSchema), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { userId, studyInstanceUid, seriesInstanceUid, sopInstanceUid, format, quality, windowCenter, windowWidth, frame } = req.body;

    const result = await dicomService.retrieveImage({
      connectionId,
      userId,
      studyInstanceUid,
      seriesInstanceUid,
      sopInstanceUid,
      format,
      quality,
      windowCenter,
      windowWidth,
      frame,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("[DICOM Routes] Error retrieving image:", error);
    res.status(500).json({ success: false, error: "Failed to retrieve image" });
  }
});

router.post("/dicom/connections/:connectionId/disconnect", validateBody(syncSchema), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { userId } = req.body;

    const success = await dicomService.disconnectConnection(connectionId, userId);

    if (!success) {
      return res.status(404).json({ success: false, error: "Connection not found or unauthorized" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[DICOM Routes] Error disconnecting:", error);
    res.status(500).json({ success: false, error: "Failed to disconnect" });
  }
});

router.get("/dicom/connections/:connectionId/audit", validateQuery(userIdQuerySchema), async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const userId = req.query.userId as string;

    const auditLog = dicomService.getConnectionAuditLog(connectionId, userId);

    if (!auditLog) {
      return res.status(404).json({ success: false, error: "Connection not found or unauthorized" });
    }

    res.json({ success: true, auditLog });
  } catch (error) {
    console.error("[DICOM Routes] Error getting audit log:", error);
    res.status(500).json({ success: false, error: "Failed to get audit log" });
  }
});

router.get("/consolidated", validateQuery(userIdQuerySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const connections = ehrService.getUserConnections(userId);
    
    if (!connections.length) {
      return res.json({ 
        success: true, 
        data: {
          conditions: [],
          medications: [],
          observations: [],
          allergies: [],
          immunizations: [],
          procedures: [],
          encounters: [],
          documents: [],
        },
        sources: [],
      });
    }

    const consolidatedData: Record<string, any[]> = {
      conditions: [],
      medications: [],
      observations: [],
      allergies: [],
      immunizations: [],
      procedures: [],
      encounters: [],
      documents: [],
    };

    const sources = connections.map((c: { id: string; platform: string; displayName: string }) => ({
      connectionId: c.id,
      platform: c.platform,
      displayName: c.displayName,
    }));

    const resourceTypeMap: Record<string, string> = {
      Condition: "conditions",
      MedicationRequest: "medications",
      Observation: "observations",
      AllergyIntolerance: "allergies",
      Immunization: "immunizations",
      Procedure: "procedures",
      Encounter: "encounters",
      DocumentReference: "documents",
    };

    for (const connection of connections) {
      if (connection.status !== "connected") continue;

      for (const [fhirType, dataKey] of Object.entries(resourceTypeMap)) {
        try {
          const result = await ehrService.fetchFhirResource({
            connectionId: connection.id,
            userId,
            resourceType: fhirType,
          });

          if (result.success && result.bundle?.entry) {
            const enrichedEntries = result.bundle.entry.map((entry: any) => ({
              ...entry.resource,
              _sourceConnectionId: connection.id,
              _sourcePlatform: connection.platform,
              _sourceDisplayName: connection.displayName,
            }));
            consolidatedData[dataKey].push(...enrichedEntries);
          }
        } catch (error) {
          console.error(`[EHR Consolidated] Error fetching ${fhirType} from ${connection.displayName}:`, error);
        }
      }
    }

    console.log(`[HIPAA-AUDIT][EHR-Consolidated] ${new Date().toISOString()} - CONSOLIDATED_DATA_ACCESS - User:${userId.slice(0, 8)}*** - Retrieved consolidated data from ${connections.length} sources`);

    res.json({ success: true, data: consolidatedData, sources });
  } catch (error) {
    console.error("[EHR Routes] Error getting consolidated data:", error);
    res.status(500).json({ success: false, error: "Failed to get consolidated data" });
  }
});

router.get("/ai-context", validateQuery(userIdQuerySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const connections = ehrService.getUserConnections(userId);
    
    if (!connections.length) {
      return res.json({ 
        success: true, 
        context: null,
        message: "No connected health records",
      });
    }

    const activeConnections = connections.filter((c: { status: string }) => c.status === "connected");
    
    if (!activeConnections.length) {
      return res.json({ 
        success: true, 
        context: null,
        message: "No active connections",
      });
    }

    const patientSummary: any = {
      demographics: null,
      activeConditions: [],
      activeMedications: [],
      recentLabs: [],
      allergies: [],
      immunizations: [],
      sources: activeConnections.map((c: { displayName: string; platform: string }) => ({ name: c.displayName, platform: c.platform })),
    };

    for (const connection of activeConnections) {
      try {
        const patientResult = await ehrService.fetchFhirResource({
          connectionId: connection.id,
          userId,
          resourceType: "Patient",
        });
        if (patientResult.success && patientResult.bundle?.entry?.[0]) {
          const patient = patientResult.bundle.entry[0].resource;
          patientSummary.demographics = {
            name: patient.name?.[0]?.given?.join(" ") + " " + patient.name?.[0]?.family,
            birthDate: patient.birthDate,
            gender: patient.gender,
          };
        }
      } catch (e) {}

      try {
        const conditionsResult = await ehrService.fetchFhirResource({
          connectionId: connection.id,
          userId,
          resourceType: "Condition",
        });
        if (conditionsResult.success && conditionsResult.bundle?.entry) {
          for (const entry of conditionsResult.bundle.entry) {
            const cond = entry.resource;
            if (cond.clinicalStatus?.coding?.[0]?.code === "active") {
              patientSummary.activeConditions.push({
                name: cond.code?.text || cond.code?.coding?.[0]?.display,
                onset: cond.onsetDateTime,
                source: connection.displayName,
              });
            }
          }
        }
      } catch (e) {}

      try {
        const medsResult = await ehrService.fetchFhirResource({
          connectionId: connection.id,
          userId,
          resourceType: "MedicationRequest",
        });
        if (medsResult.success && medsResult.bundle?.entry) {
          for (const entry of medsResult.bundle.entry) {
            const med = entry.resource;
            if (med.status === "active") {
              patientSummary.activeMedications.push({
                name: med.medicationCodeableConcept?.text || med.medicationCodeableConcept?.coding?.[0]?.display,
                dosage: med.dosageInstruction?.[0]?.text,
                source: connection.displayName,
              });
            }
          }
        }
      } catch (e) {}

      try {
        const labsResult = await ehrService.fetchFhirResource({
          connectionId: connection.id,
          userId,
          resourceType: "Observation",
        });
        if (labsResult.success && labsResult.bundle?.entry) {
          const recentLabs = labsResult.bundle.entry
            .map((e: any) => e.resource)
            .filter((obs: any) => obs.category?.[0]?.coding?.[0]?.code === "laboratory")
            .slice(0, 10);
          for (const lab of recentLabs) {
            patientSummary.recentLabs.push({
              name: lab.code?.coding?.[0]?.display || lab.code?.text,
              value: lab.valueQuantity ? `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : lab.valueString,
              interpretation: lab.interpretation?.[0]?.coding?.[0]?.code,
              date: lab.effectiveDateTime,
              source: connection.displayName,
            });
          }
        }
      } catch (e) {}

      try {
        const allergiesResult = await ehrService.fetchFhirResource({
          connectionId: connection.id,
          userId,
          resourceType: "AllergyIntolerance",
        });
        if (allergiesResult.success && allergiesResult.bundle?.entry) {
          for (const entry of allergiesResult.bundle.entry) {
            const allergy = entry.resource;
            patientSummary.allergies.push({
              name: allergy.code?.text || allergy.code?.coding?.[0]?.display,
              criticality: allergy.criticality,
              source: connection.displayName,
            });
          }
        }
      } catch (e) {}

      try {
        const immResult = await ehrService.fetchFhirResource({
          connectionId: connection.id,
          userId,
          resourceType: "Immunization",
        });
        if (immResult.success && immResult.bundle?.entry) {
          for (const entry of immResult.bundle.entry) {
            const imm = entry.resource;
            patientSummary.immunizations.push({
              name: imm.vaccineCode?.coding?.[0]?.display || imm.vaccineCode?.text,
              date: imm.occurrenceDateTime,
              status: imm.status,
              source: connection.displayName,
            });
          }
        }
      } catch (e) {}
    }

    console.log(`[HIPAA-AUDIT][EHR-AI-Context] ${new Date().toISOString()} - AI_CONTEXT_ACCESS - User:${userId.slice(0, 8)}*** - Generated AI context from ${activeConnections.length} sources`);

    res.json({ 
      success: true, 
      context: patientSummary,
      disclaimer: "This data is for informational purposes only and does not constitute clinical decision support. Always consult your healthcare provider for medical decisions.",
    });
  } catch (error) {
    console.error("[EHR Routes] Error getting AI context:", error);
    res.status(500).json({ success: false, error: "Failed to get AI context" });
  }
});

export default router;
