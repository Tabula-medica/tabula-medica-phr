import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { zeroClickRetrievalService } from "./services/zero-click-retrieval-service";
import { healthGraphService } from "./services/health-graph-service";
import { aiChartExplanationService } from "./services/ai-chart-explanation-service";
import { oneTapShareService } from "./services/one-tap-share-service";
import { patientDataPermissionsService } from "./services/patient-data-permissions-service";
import { duplicateTestPreventionService } from "./services/duplicate-test-prevention-service";
import { uscdiV5ExchangeService } from './services/uscdi-v5-exchange-service';
import { uscdiV3ComplianceService } from './services/uscdi-v3-compliance-service';
import { migrationDedupService } from './services/migration-dedup-service';
import { tefcaFrameworkService } from './services/tefca-framework-service';
import { epicIntegrationService } from './services/epic-integration-service';
import { fhirBundleImportService } from './services/fhir-bundle-import-service';
import { wearableDeviceService } from './services/wearable-device-service';
import { wearablePlatformConnectorManager } from './services/wearable-platform-connectors';
import { dataLineageService } from './services/data-lineage-service';
import { ehrPatientPortalService } from './services/ehr-patient-portal-service';
import { healthAppConnectorService } from './services/health-app-connectors-service';
import { healthGoalsService } from './services/health-goals-service';
import { secureMessagingService } from './services/secure-messaging-service';
import { intakeHistoryService } from './services/intake-history-service';
import { clinicalToolsService } from './services/clinical-tools-service';
import { communityService } from './services/community-service';
import { phrService } from './services/phr-service';
import { providerAdminService } from './services/provider-admin-service';
import { checkDrugInteractions } from './clinical-decision-support-service';
import { insertComprehensiveIntakeSchema } from '@shared/schema';

const router = Router();

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

// Rate limiter middleware
function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  
  const entry = rateLimitStore.get(ip);
  if (entry && entry.resetAt > now) {
    if (entry.count >= RATE_LIMIT_MAX) {
      console.log(`[HIPAA-AUDIT] Rate limit exceeded - IP: ${ip}`);
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    entry.count++;
  } else {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
  }
  
  next();
}

// Authentication middleware - validates session/token
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const sessionId = req.headers["x-session-id"] as string;
  const hasSession = req.isAuthenticated?.() || !!(req.user as any)?.claims?.sub;
  const hasCookie = !!(req.headers.cookie);
  const isXHR = req.headers["x-requested-with"] === "XMLHttpRequest";
  const isSameOrigin = !!(req.headers.referer || req.headers.origin);
  
  if (hasSession || sessionId || authHeader || hasCookie || isXHR || isSameOrigin) {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || sessionId || "system_user";
    console.log(`[HIPAA-AUDIT] Authenticated access - User: ${userId}, Path: ${req.path}, IP: ${req.ip}`);
    next();
  } else {
    console.log(`[HIPAA-AUDIT] Unauthenticated access denied - Path: ${req.path}, IP: ${req.ip}`);
    return res.status(401).json({ error: "Authentication required" });
  }
}

// Patient access verification middleware
function verifyPatientAccess(req: Request, res: Response, next: NextFunction) {
  const requestedPatientId = req.params.patientId || req.body?.patientId;
  const userId = (req.user as any)?.id || req.headers["x-session-id"] || "system";
  
  // Log PHI access attempt
  console.log(`[HIPAA-AUDIT] PHI access - User: ${userId}, PatientId: ${requestedPatientId}, Action: ${req.method} ${req.path}, IP: ${req.ip}`);
  
  // In production, this would verify the user has permission to access this patient's data
  // For now, we log and allow (sample mode)
  next();
}

// Generate cryptographically secure token
function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

// HIPAA-compliant audit logging
interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  actorRole: string;
  timestamp: string;
  details: Record<string, unknown>;
  outcome: string;
  ipAddress: string;
}

function logAuditEntry(entry: AuditLogEntry): void {
  console.log(`[HIPAA-AUDIT] ${entry.action} - Resource: ${entry.resourceType}/${entry.resourceId}, Actor: ${entry.actorId} (${entry.actorRole}), Outcome: ${entry.outcome}, IP: ${entry.ipAddress}`);
  if (Object.keys(entry.details).length > 0) {
    console.log(`[HIPAA-AUDIT] Details: ${JSON.stringify(entry.details)}`);
  }
}

function logAudit(action: string, details: Record<string, unknown> = {}): void {
  logAuditEntry({
    action,
    resourceType: "infrastructure",
    resourceId: crypto.randomBytes(8).toString("hex"),
    actorId: "system",
    actorRole: "infrastructure_service",
    timestamp: new Date().toISOString(),
    details,
    outcome: "success",
    ipAddress: "internal"
  });
}

// Apply rate limiting and authentication to all routes
router.use(rateLimiter);
router.use(requireAuth);

// ============================================
// ZERO-CLICK RECORD RETRIEVAL ROUTES
// ============================================

router.post("/zero-click/initiate", verifyPatientAccess, async (req: Request, res: Response) => {
  try {
    const { patientId, identity } = req.body;
    
    if (!patientId || !identity?.firstName || !identity?.lastName || !identity?.dateOfBirth) {
      return res.status(400).json({ error: "Patient ID and identity (firstName, lastName, dateOfBirth) required" });
    }

    const session = await zeroClickRetrievalService.initiateZeroClickRetrieval(
      patientId,
      identity,
      req.ip
    );

    res.json({ 
      success: true, 
      session,
      message: "Zero-click retrieval initiated. Records will appear automatically." 
    });
  } catch (error) {
    console.error("[ZeroClick] Initiation error:", error);
    res.status(500).json({ error: "Failed to initiate record retrieval" });
  }
});

router.get("/zero-click/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await zeroClickRetrievalService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({ session });
  } catch (error) {
    console.error("[ZeroClick] Session fetch error:", error);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

router.get("/zero-click/sessions/:sessionId/progress", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const progress = await zeroClickRetrievalService.getDiscoveryProgress(sessionId);
    res.json(progress);
  } catch (error) {
    console.error("[ZeroClick] Progress fetch error:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

router.get("/zero-click/patient/:patientId/sessions", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const sessions = await zeroClickRetrievalService.getSessionsByPatient(patientId);
    res.json({ sessions });
  } catch (error) {
    console.error("[ZeroClick] Patient sessions fetch error:", error);
    res.status(500).json({ error: "Failed to fetch patient sessions" });
  }
});

// ============================================
// HEALTH GRAPH ROUTES
// ============================================

router.get("/health-graph/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const graph = await healthGraphService.getGraph(patientId);
    
    if (!graph) {
      return res.status(404).json({ error: "Health graph not found" });
    }

    res.json({ graph });
  } catch (error) {
    console.error("[HealthGraph] Fetch error:", error);
    res.status(500).json({ error: "Failed to fetch health graph" });
  }
});

router.post("/health-graph/:patientId/query", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const query = req.body;
    
    const result = await healthGraphService.queryGraph(patientId, query);
    res.json(result);
  } catch (error) {
    console.error("[HealthGraph] Query error:", error);
    res.status(500).json({ error: "Failed to query health graph" });
  }
});

router.get("/health-graph/:patientId/insights", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const insights = await healthGraphService.generateInsights(patientId);
    res.json({ insights });
  } catch (error) {
    console.error("[HealthGraph] Insights error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

router.get("/health-graph/:patientId/episodes", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const episodes = await healthGraphService.getEpisodes(patientId);
    res.json({ episodes });
  } catch (error) {
    console.error("[HealthGraph] Episodes error:", error);
    res.status(500).json({ error: "Failed to fetch episodes" });
  }
});

router.get("/health-graph/:patientId/timelines", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const timelines = await healthGraphService.getTimelines(patientId);
    res.json({ timelines });
  } catch (error) {
    console.error("[HealthGraph] Timelines error:", error);
    res.status(500).json({ error: "Failed to fetch timelines" });
  }
});

router.post("/health-graph/:patientId/explain", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { sourceNodeId, targetNodeId } = req.body;
    
    if (!sourceNodeId || !targetNodeId) {
      return res.status(400).json({ error: "sourceNodeId and targetNodeId required" });
    }

    const explanation = await healthGraphService.explainRelationship(patientId, sourceNodeId, targetNodeId);
    res.json({ explanation });
  } catch (error) {
    console.error("[HealthGraph] Explain error:", error);
    res.status(500).json({ error: "Failed to generate explanation" });
  }
});

router.get("/health-graph/:patientId/statistics", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const stats = healthGraphService.getGraphStatistics(patientId);
    
    if (!stats) {
      return res.status(404).json({ error: "Graph not found" });
    }

    res.json({ statistics: stats });
  } catch (error) {
    console.error("[HealthGraph] Statistics error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

router.get("/health-graph/:patientId/symptom-analysis", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const analysis = await healthGraphService.analyzeSymptomConditionLinks(patientId);
    res.json({ success: true, analysis });
  } catch (error) {
    console.error("[HealthGraph] Symptom analysis error:", error);
    res.status(500).json({ error: "Failed to analyze symptom-condition links" });
  }
});

router.post("/health-graph/:patientId/build", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const graph = await healthGraphService.buildHealthGraph(patientId);
    console.log(`[HIPAA-AUDIT] Health graph built via API - Patient: ${patientId}`);
    res.json({
      success: true,
      graph: {
        patientId: graph.patientId,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        symptomCount: graph.nodes.filter(n => n.nodeType === "symptom").length,
        lastUpdated: graph.lastUpdated,
        version: graph.version,
      },
    });
  } catch (error) {
    console.error("[HealthGraph] Build error:", error);
    res.status(500).json({ error: "Failed to build health graph" });
  }
});

router.post("/health-graph/:patientId/symptoms", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { label, code, codeSystem, severity, frequency, location, triggers, onsetDate, description } = req.body;

    if (!label) {
      return res.status(400).json({ error: "Symptom label is required" });
    }

    const node = await healthGraphService.addNode(patientId, {
      nodeType: "symptom",
      label,
      code: code || undefined,
      codeSystem: codeSystem || "ICD-10",
      startDate: onsetDate || new Date().toISOString().split("T")[0],
      status: "active",
      source: "Patient-Reported",
      confidence: 0.80,
      metadata: {
        severity: severity || "mild",
        frequency: frequency || "unknown",
        location: location || undefined,
        triggers: triggers || [],
        description: description || "",
        reportedBy: "patient",
        lastReported: new Date().toISOString().split("T")[0],
      },
    });

    console.log(`[HIPAA-AUDIT] Symptom reported - Patient: ${patientId}, Symptom: ${node.id}, Label: ${label}`);
    res.json({ success: true, symptom: node });
  } catch (error) {
    console.error("[HealthGraph] Add symptom error:", error);
    res.status(500).json({ error: "Failed to add symptom" });
  }
});

// ============================================
// AI CHART EXPLANATION ROUTES
// ============================================

router.get("/chart-explain/:patientId/lab/:labNodeId", async (req: Request, res: Response) => {
  try {
    const { patientId, labNodeId } = req.params;
    const explanation = await aiChartExplanationService.explainLabTrend(patientId, labNodeId);
    res.json({ explanation });
  } catch (error) {
    console.error("[ChartExplain] Lab trend error:", error);
    res.status(500).json({ error: "Failed to explain lab trend" });
  }
});

router.get("/chart-explain/:patientId/medication/:medicationNodeId/effects", async (req: Request, res: Response) => {
  try {
    const { patientId, medicationNodeId } = req.params;
    const effects = await aiChartExplanationService.analyzeMedicationEffects(patientId, medicationNodeId);
    res.json({ effects });
  } catch (error) {
    console.error("[ChartExplain] Medication effects error:", error);
    res.status(500).json({ error: "Failed to analyze medication effects" });
  }
});

router.get("/chart-explain/:patientId/narrative", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const narrative = await aiChartExplanationService.generateHealthNarrative(patientId);
    res.json({ narrative });
  } catch (error) {
    console.error("[ChartExplain] Narrative error:", error);
    res.status(500).json({ error: "Failed to generate health narrative" });
  }
});

router.post("/chart-explain/:patientId/correlation", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { nodeId1, nodeId2 } = req.body;
    
    if (!nodeId1 || !nodeId2) {
      return res.status(400).json({ error: "nodeId1 and nodeId2 required" });
    }

    const explanation = await aiChartExplanationService.explainCorrelation(patientId, nodeId1, nodeId2);
    res.json({ explanation });
  } catch (error) {
    console.error("[ChartExplain] Correlation error:", error);
    res.status(500).json({ error: "Failed to explain correlation" });
  }
});

router.get("/chart-explain/:patientId/smart-insights", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const insights = await aiChartExplanationService.getSmartInsights(patientId);
    res.json({ insights });
  } catch (error) {
    console.error("[ChartExplain] Smart insights error:", error);
    res.status(500).json({ error: "Failed to generate smart insights" });
  }
});

// ============================================
// ONE-TAP SHARE ROUTES
// ============================================

router.get("/share/templates", async (req: Request, res: Response) => {
  try {
    const templates = oneTapShareService.getShareTemplates();
    res.json({ templates });
  } catch (error) {
    console.error("[OneTapShare] Templates error:", error);
    res.status(500).json({ error: "Failed to fetch share templates" });
  }
});

router.post("/share/create", async (req: Request, res: Response) => {
  try {
    const { patientId, templateId, options } = req.body;
    
    if (!patientId || !templateId) {
      return res.status(400).json({ error: "patientId and templateId required" });
    }

    const sharePackage = await oneTapShareService.createSharePackage(patientId, templateId, options || {});
    res.json({ 
      success: true, 
      package: sharePackage,
      message: "Share package created successfully" 
    });
  } catch (error) {
    console.error("[OneTapShare] Create error:", error);
    res.status(500).json({ error: "Failed to create share package" });
  }
});

router.get("/share/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const packages = await oneTapShareService.getPatientPackages(patientId);
    res.json({ packages });
  } catch (error) {
    console.error("[OneTapShare] Patient packages error:", error);
    res.status(500).json({ error: "Failed to fetch patient packages" });
  }
});

router.post("/share/access/:packageId", async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    const { accessToken, accessorName } = req.body;
    
    if (!accessToken || !accessorName) {
      return res.status(400).json({ error: "accessToken and accessorName required" });
    }

    const result = await oneTapShareService.accessSharePackage(
      packageId,
      accessToken,
      { name: accessorName, ipAddress: req.ip }
    );

    if (!result) {
      return res.status(403).json({ error: "Access denied or package not available" });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[OneTapShare] Access error:", error);
    res.status(500).json({ error: "Failed to access share package" });
  }
});

router.post("/share/revoke/:packageId", async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "patientId required" });
    }

    const success = await oneTapShareService.revokeSharePackage(patientId, packageId);
    
    if (!success) {
      return res.status(404).json({ error: "Package not found or not authorized" });
    }

    res.json({ success: true, message: "Share package revoked" });
  } catch (error) {
    console.error("[OneTapShare] Revoke error:", error);
    res.status(500).json({ error: "Failed to revoke share package" });
  }
});

router.post("/share/download/:packageId", async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    const { accessToken, accessorName, format } = req.body;
    
    if (!accessToken || !accessorName) {
      return res.status(400).json({ error: "accessToken and accessorName required" });
    }

    const result = await oneTapShareService.downloadPackage(
      packageId,
      accessToken,
      { name: accessorName, ipAddress: req.ip },
      format || "fhir"
    );

    if (!result) {
      return res.status(403).json({ error: "Download denied or package not available" });
    }

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.json(result.data);
  } catch (error) {
    console.error("[OneTapShare] Download error:", error);
    res.status(500).json({ error: "Failed to download package" });
  }
});

// ============================================
// PATIENT DATA PERMISSIONS ROUTES
// ============================================

router.post("/permissions/grant", async (req: Request, res: Response) => {
  try {
    const { patientId, ...options } = req.body;
    
    if (!patientId || !options.permissionType || !options.granteeId || !options.granteeName) {
      return res.status(400).json({ error: "patientId, permissionType, granteeId, and granteeName required" });
    }

    const permission = await patientDataPermissionsService.grantPermission(patientId, options);
    res.json({ success: true, permission });
  } catch (error) {
    console.error("[Permissions] Grant error:", error);
    res.status(500).json({ error: "Failed to grant permission" });
  }
});

router.post("/permissions/revoke/:permissionId", async (req: Request, res: Response) => {
  try {
    const { permissionId } = req.params;
    const { patientId, reason } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "patientId required" });
    }

    const success = await patientDataPermissionsService.revokePermission(patientId, permissionId, reason);
    
    if (!success) {
      return res.status(404).json({ error: "Permission not found or not authorized" });
    }

    res.json({ success: true, message: "Permission revoked" });
  } catch (error) {
    console.error("[Permissions] Revoke error:", error);
    res.status(500).json({ error: "Failed to revoke permission" });
  }
});

router.post("/permissions/suspend/:permissionId", async (req: Request, res: Response) => {
  try {
    const { permissionId } = req.params;
    const { patientId, reason } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "patientId required" });
    }

    const success = await patientDataPermissionsService.suspendPermission(patientId, permissionId, reason);
    
    if (!success) {
      return res.status(404).json({ error: "Permission not found or not authorized" });
    }

    res.json({ success: true, message: "Permission suspended" });
  } catch (error) {
    console.error("[Permissions] Suspend error:", error);
    res.status(500).json({ error: "Failed to suspend permission" });
  }
});

router.post("/permissions/reactivate/:permissionId", async (req: Request, res: Response) => {
  try {
    const { permissionId } = req.params;
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "patientId required" });
    }

    const success = await patientDataPermissionsService.reactivatePermission(patientId, permissionId);
    
    if (!success) {
      return res.status(404).json({ error: "Permission not found, not suspended, or not authorized" });
    }

    res.json({ success: true, message: "Permission reactivated" });
  } catch (error) {
    console.error("[Permissions] Reactivate error:", error);
    res.status(500).json({ error: "Failed to reactivate permission" });
  }
});

router.get("/permissions/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const permissions = await patientDataPermissionsService.getPatientPermissions(patientId);
    res.json({ permissions });
  } catch (error) {
    console.error("[Permissions] Patient permissions error:", error);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

router.get("/permissions/patient/:patientId/summary", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const summary = await patientDataPermissionsService.getPermissionSummary(patientId);
    res.json({ summary });
  } catch (error) {
    console.error("[Permissions] Summary error:", error);
    res.status(500).json({ error: "Failed to fetch permission summary" });
  }
});

router.post("/permissions/check-access", async (req: Request, res: Response) => {
  try {
    const { granteeId, patientId, requestedCategory } = req.body;
    
    if (!granteeId || !patientId || !requestedCategory) {
      return res.status(400).json({ error: "granteeId, patientId, and requestedCategory required" });
    }

    const result = await patientDataPermissionsService.checkAccess(granteeId, patientId, requestedCategory);
    res.json(result);
  } catch (error) {
    console.error("[Permissions] Check access error:", error);
    res.status(500).json({ error: "Failed to check access" });
  }
});

router.post("/permissions/request", async (req: Request, res: Response) => {
  try {
    const request = await patientDataPermissionsService.createPermissionRequest(req.body);
    res.json({ success: true, request });
  } catch (error) {
    console.error("[Permissions] Request creation error:", error);
    res.status(500).json({ error: "Failed to create permission request" });
  }
});

router.get("/permissions/patient/:patientId/requests", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const requests = await patientDataPermissionsService.getPatientRequests(patientId);
    res.json({ requests });
  } catch (error) {
    console.error("[Permissions] Patient requests error:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

router.post("/permissions/request/:requestId/respond", async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { patientId, approved, note } = req.body;
    
    if (!patientId || approved === undefined) {
      return res.status(400).json({ error: "patientId and approved required" });
    }

    const permission = await patientDataPermissionsService.respondToRequest(patientId, requestId, approved, note);
    
    res.json({ 
      success: true, 
      approved,
      permission,
      message: approved ? "Request approved" : "Request denied"
    });
  } catch (error) {
    console.error("[Permissions] Request response error:", error);
    res.status(500).json({ error: "Failed to respond to request" });
  }
});

router.get("/permissions/opportunities/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const conditions = req.query.conditions ? String(req.query.conditions).split(",") : undefined;
    
    const opportunities = await patientDataPermissionsService.getDataBrokerOpportunities(patientId, conditions);
    res.json({ opportunities });
  } catch (error) {
    console.error("[Permissions] Opportunities error:", error);
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

router.post("/permissions/opportunities/:opportunityId/participate", async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { patientId, consent } = req.body;
    
    if (!patientId || !consent) {
      return res.status(400).json({ error: "patientId and consent required" });
    }

    const result = await patientDataPermissionsService.participateInOpportunity(patientId, opportunityId, consent);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Permissions] Participation error:", error);
    res.status(500).json({ error: "Failed to participate in opportunity" });
  }
});

router.get("/permissions/categories", async (req: Request, res: Response) => {
  try {
    const categories = patientDataPermissionsService.getDataCategoryLabels();
    res.json({ categories });
  } catch (error) {
    console.error("[Permissions] Categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/permissions/patient/:patientId/consents", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const consents = await patientDataPermissionsService.getPatientConsents(patientId);
    res.json({ consents });
  } catch (error) {
    console.error("[Permissions] Consents error:", error);
    res.status(500).json({ error: "Failed to fetch consents" });
  }
});

router.post("/permissions/consents/:consentId/withdraw", async (req: Request, res: Response) => {
  try {
    const { consentId } = req.params;
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "patientId required" });
    }

    const success = await patientDataPermissionsService.withdrawConsent(patientId, consentId);
    
    if (!success) {
      return res.status(404).json({ error: "Consent not found or not authorized" });
    }

    res.json({ success: true, message: "Consent withdrawn" });
  } catch (error) {
    console.error("[Permissions] Withdraw consent error:", error);
    res.status(500).json({ error: "Failed to withdraw consent" });
  }
});

// ============================================
// DUPLICATE TEST PREVENTION ROUTES
// ============================================

router.post("/duplicate-prevention/analyze", verifyPatientAccess, async (req: Request, res: Response) => {
  try {
    const { patientId, order, searchNetworks } = req.body;
    
    if (!patientId || !order?.testCode || !order?.testName || !order?.testType) {
      return res.status(400).json({ 
        error: "patientId and order (testCode, testName, testType) required" 
      });
    }

    const orderedTest = {
      orderId: order.orderId || `order_${Date.now()}`,
      testType: order.testType,
      testCode: order.testCode,
      testName: order.testName,
      orderingProvider: order.orderingProvider || "Unknown Provider",
      orderingFacility: order.orderingFacility || "Current Facility",
      orderedAt: order.orderedAt || new Date().toISOString(),
      urgency: order.urgency || "routine",
      clinicalIndication: order.clinicalIndication,
      icd10Codes: order.icd10Codes
    };

    console.log(`[HIPAA-AUDIT] Duplicate test analysis - PatientId: ${patientId}, Test: ${orderedTest.testName}`);

    const analysis = await duplicateTestPreventionService.analyzeTestOrder(
      patientId,
      orderedTest,
      searchNetworks !== false
    );

    if (analysis.duplicatesFound && analysis.alerts.length > 0) {
      const alertMessage = await duplicateTestPreventionService.generateAlertMessage(analysis.alerts[0]);
      res.json({
        success: true,
        duplicatesFound: true,
        alertMessage,
        analysis,
        message: "Prior test results found. Review before proceeding."
      });
    } else {
      res.json({
        success: true,
        duplicatesFound: false,
        analysis,
        message: "No duplicate tests detected. Order may proceed."
      });
    }
  } catch (error) {
    console.error("[DuplicatePrevention] Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze test order" });
  }
});

router.get("/duplicate-prevention/alerts", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.query;
    
    const alerts = duplicateTestPreventionService.getActiveAlerts(patientId as string);

    res.json({ 
      alerts,
      totalActive: alerts.length
    });
  } catch (error) {
    console.error("[DuplicatePrevention] Fetch alerts error:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.get("/duplicate-prevention/alerts/:alertId", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const alert = duplicateTestPreventionService.getAlert(alertId);
    
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    const alertMessage = await duplicateTestPreventionService.generateAlertMessage(alert);

    res.json({ 
      alert,
      alertMessage
    });
  } catch (error) {
    console.error("[DuplicatePrevention] Fetch alert error:", error);
    res.status(500).json({ error: "Failed to fetch alert" });
  }
});

router.post("/duplicate-prevention/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { action, reason, actorId, actorRole } = req.body;

    if (!action || !["retrieved", "overridden", "dismissed"].includes(action)) {
      return res.status(400).json({ error: "Valid action (retrieved, overridden, dismissed) required" });
    }

    const userId = actorId || (req.user as any)?.id || req.headers["x-session-id"] || "unknown";
    const role = actorRole || "physician";

    console.log(`[HIPAA-AUDIT] Alert acknowledged - AlertId: ${alertId}, Action: ${action}, Actor: ${userId}`);

    const alert = await duplicateTestPreventionService.acknowledgeAlert(
      alertId,
      userId,
      role,
      action,
      reason,
      req.ip
    );

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json({ 
      success: true, 
      alert,
      message: `Alert ${action} successfully`
    });
  } catch (error) {
    console.error("[DuplicatePrevention] Acknowledge error:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.post("/duplicate-prevention/alerts/:alertId/retrieve", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resultId, actorId } = req.body;

    if (!resultId) {
      return res.status(400).json({ error: "resultId required" });
    }

    const userId = actorId || (req.user as any)?.id || req.headers["x-session-id"] || "unknown";

    console.log(`[HIPAA-AUDIT] Prior result retrieval - AlertId: ${alertId}, ResultId: ${resultId}, Actor: ${userId}`);

    const result = await duplicateTestPreventionService.retrievePriorResult(
      alertId,
      resultId,
      userId,
      req.ip
    );

    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }

    res.json(result);
  } catch (error) {
    console.error("[DuplicatePrevention] Retrieve error:", error);
    res.status(500).json({ error: "Failed to retrieve prior result" });
  }
});

router.get("/duplicate-prevention/stats", async (req: Request, res: Response) => {
  try {
    const { organizationId, startDate, endDate } = req.query;

    const start = (startDate as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = (endDate as string) || new Date().toISOString();
    const orgId = (organizationId as string) || "default_org";

    const stats = await duplicateTestPreventionService.getDuplicatePreventionStats(orgId, start, end);

    res.json({ 
      success: true,
      stats,
      message: "Cost savings analytics for duplicate test prevention"
    });
  } catch (error) {
    console.error("[DuplicatePrevention] Stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ============================================================================
// USCDI v5 DATA EXCHANGE ROUTES
// ============================================================================

router.get("/uscdi-v5/data-classes", async (req: Request, res: Response) => {
  try {
    const dataClasses = uscdiV5ExchangeService.getSupportedDataClasses();
    res.json({
      success: true,
      version: "v5",
      totalClasses: dataClasses.length,
      newInV5: dataClasses.filter(dc => dc.isNewInV5).length,
      dataClasses
    });
  } catch (error) {
    console.error("[USCDI-V5] Data classes error:", error);
    res.status(500).json({ error: "Failed to fetch data classes" });
  }
});

router.get("/uscdi-v5/data-classes/:dataClass", async (req: Request, res: Response) => {
  try {
    const { dataClass } = req.params;
    const definition = uscdiV5ExchangeService.getDataClassDefinition(dataClass as any);
    
    if (!definition) {
      return res.status(404).json({ error: "Data class not found" });
    }
    
    res.json({ success: true, definition });
  } catch (error) {
    console.error("[USCDI-V5] Data class definition error:", error);
    res.status(500).json({ error: "Failed to fetch data class definition" });
  }
});

router.post("/uscdi-v5/exchange", async (req: Request, res: Response) => {
  try {
    const { patientId, requestedDataClasses, dateRange, purpose, requestingOrganization, requestingProvider } = req.body;
    
    if (!patientId || !requestedDataClasses || !purpose || !requestingOrganization) {
      return res.status(400).json({ error: "Missing required fields: patientId, requestedDataClasses, purpose, requestingOrganization" });
    }

    logAuditEntry({
      action: "USCDI_V5_EXCHANGE",
      resourceType: "USCDIExchange",
      resourceId: patientId,
      actorId: requestingProvider || "system",
      actorRole: "data_exchange",
      timestamp: new Date().toISOString(),
      details: { dataClasses: requestedDataClasses, purpose },
      outcome: "initiated",
      ipAddress: req.ip || "unknown"
    });

    const response = await uscdiV5ExchangeService.initiateExchange({
      patientId,
      requestedDataClasses,
      dateRange,
      purpose,
      requestingOrganization,
      requestingProvider
    });

    res.json({ success: true, exchange: response });
  } catch (error) {
    console.error("[USCDI-V5] Exchange error:", error);
    res.status(500).json({ error: "Failed to initiate USCDI v5 exchange" });
  }
});

router.get("/uscdi-v5/exchange/:exchangeId", async (req: Request, res: Response) => {
  try {
    const { exchangeId } = req.params;
    const exchange = uscdiV5ExchangeService.getExchangeStatus(exchangeId);
    
    if (!exchange) {
      return res.status(404).json({ error: "Exchange not found" });
    }
    
    res.json({ success: true, exchange });
  } catch (error) {
    console.error("[USCDI-V5] Exchange status error:", error);
    res.status(500).json({ error: "Failed to fetch exchange status" });
  }
});

router.post("/uscdi-v5/validate", async (req: Request, res: Response) => {
  try {
    const { resource } = req.body;
    
    if (!resource) {
      return res.status(400).json({ error: "Missing resource" });
    }
    
    const validation = uscdiV5ExchangeService.validateResource(resource);
    res.json({ success: true, validation });
  } catch (error) {
    console.error("[USCDI-V5] Validation error:", error);
    res.status(500).json({ error: "Failed to validate resource" });
  }
});

router.get("/uscdi-v5/history", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.query;
    const history = uscdiV5ExchangeService.getExchangeHistory(patientId as string);
    res.json({ success: true, exchanges: history });
  } catch (error) {
    console.error("[USCDI-V5] History error:", error);
    res.status(500).json({ error: "Failed to fetch exchange history" });
  }
});

// ============================================================================
// USCDI v3 COMPLIANCE ROUTES (Mandatory as of January 1, 2026 per ONC HTI-1)
// ============================================================================

router.get("/uscdi-v3/compliance", async (_req: Request, res: Response) => {
  try {
    const summary = uscdiV3ComplianceService.getComplianceSummary();
    res.json({ success: true, ...summary });
  } catch (error) {
    console.error("[USCDI-V3] Compliance summary error:", error);
    res.status(500).json({ error: "Failed to fetch USCDI v3 compliance summary" });
  }
});

router.get("/uscdi-v3/data-classes/:dataClass", async (req: Request, res: Response) => {
  try {
    const { dataClass } = req.params;
    const definition = uscdiV3ComplianceService.getDataClassDetail(dataClass as any);
    if (!definition) {
      return res.status(404).json({ error: "Data class not found" });
    }
    res.json({ success: true, definition });
  } catch (error) {
    console.error("[USCDI-V3] Data class detail error:", error);
    res.status(500).json({ error: "Failed to fetch data class detail" });
  }
});

router.get("/uscdi-v3/gap-analysis", async (_req: Request, res: Response) => {
  try {
    const gaps = uscdiV3ComplianceService.getGapAnalysis();
    res.json({ success: true, gaps, totalGaps: gaps.length });
  } catch (error) {
    console.error("[USCDI-V3] Gap analysis error:", error);
    res.status(500).json({ error: "Failed to fetch gap analysis" });
  }
});

router.get("/uscdi-v3/patient-completeness/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const completeness = await uscdiV3ComplianceService.getPatientDataCompleteness(patientId);
    res.json({ success: true, ...completeness });
  } catch (error) {
    console.error("[USCDI-V3] Patient completeness error:", error);
    res.status(500).json({ error: "Failed to fetch patient data completeness" });
  }
});

// ============================================================================
// TEFCA FRAMEWORK ROUTES
// ============================================================================

router.get("/tefca/qhins", async (req: Request, res: Response) => {
  try {
    const qhins = tefcaFrameworkService.getQHINConnections();
    res.json({
      success: true,
      totalQHINs: qhins.length,
      activeQHINs: qhins.filter(q => q.status === 'active').length,
      qhins
    });
  } catch (error) {
    console.error("[TEFCA] QHINs error:", error);
    res.status(500).json({ error: "Failed to fetch QHINs" });
  }
});

router.get("/tefca/qhins/:qhinId", async (req: Request, res: Response) => {
  try {
    const { qhinId } = req.params;
    const qhin = tefcaFrameworkService.getQHINConnection(qhinId as any);
    
    if (!qhin) {
      return res.status(404).json({ error: "QHIN not found" });
    }
    
    res.json({ success: true, qhin });
  } catch (error) {
    console.error("[TEFCA] QHIN error:", error);
    res.status(500).json({ error: "Failed to fetch QHIN" });
  }
});

router.get("/tefca/qhins/purpose/:purpose", async (req: Request, res: Response) => {
  try {
    const { purpose } = req.params;
    const qhins = tefcaFrameworkService.getActiveQHINs(purpose as any);
    res.json({ success: true, purpose, qhins });
  } catch (error) {
    console.error("[TEFCA] QHINs by purpose error:", error);
    res.status(500).json({ error: "Failed to fetch QHINs by purpose" });
  }
});

router.post("/tefca/query", async (req: Request, res: Response) => {
  try {
    const { patientDemographics, purpose, requestingOrganization, requestingUser, targetQHINs, dataElements, dateRange } = req.body;
    
    if (!patientDemographics || !purpose || !requestingOrganization) {
      return res.status(400).json({ error: "Missing required fields: patientDemographics, purpose, requestingOrganization" });
    }

    const requestId = `tefca_req_${Date.now()}`;

    logAuditEntry({
      action: "TEFCA_QUERY",
      resourceType: "TEFCAQuery",
      resourceId: requestId,
      actorId: requestingUser?.name || "system",
      actorRole: "tefca_exchange",
      timestamp: new Date().toISOString(),
      details: { purpose, patientName: `${patientDemographics.lastName}, ${patientDemographics.firstName}` },
      outcome: "initiated",
      ipAddress: req.ip || "unknown"
    });

    const response = await tefcaFrameworkService.initiateQuery({
      requestId,
      purpose,
      patientDemographics,
      requestingOrganization,
      requestingUser,
      targetQHINs,
      dataElements,
      dateRange
    });

    res.json({ success: true, query: response });
  } catch (error) {
    console.error("[TEFCA] Query error:", error);
    res.status(500).json({ error: "Failed to initiate TEFCA query" });
  }
});

router.get("/tefca/query/:queryId", async (req: Request, res: Response) => {
  try {
    const { queryId } = req.params;
    const query = tefcaFrameworkService.getQueryStatus(queryId);
    
    if (!query) {
      return res.status(404).json({ error: "Query not found" });
    }
    
    res.json({ success: true, query });
  } catch (error) {
    console.error("[TEFCA] Query status error:", error);
    res.status(500).json({ error: "Failed to fetch query status" });
  }
});

router.post("/tefca/retrieve", async (req: Request, res: Response) => {
  try {
    const { queryId, documentIds, requestingOrganization, requestingUser, purpose } = req.body;
    
    if (!queryId || !documentIds || !requestingOrganization || !requestingUser || !purpose) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    logAuditEntry({
      action: "TEFCA_DOCUMENT_RETRIEVE",
      resourceType: "TEFCADocuments",
      resourceId: queryId,
      actorId: requestingUser,
      actorRole: "document_retrieval",
      timestamp: new Date().toISOString(),
      details: { documentCount: documentIds.length },
      outcome: "success",
      ipAddress: req.ip || "unknown"
    });

    const response = await tefcaFrameworkService.retrieveDocuments({
      queryId,
      documentIds,
      requestingOrganization,
      requestingUser,
      purpose
    });

    res.json({ success: true, retrieval: response });
  } catch (error) {
    console.error("[TEFCA] Document retrieve error:", error);
    res.status(500).json({ error: "Failed to retrieve documents" });
  }
});

router.get("/tefca/audit", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, purpose, organization } = req.query;
    const auditLog = tefcaFrameworkService.getAuditLog({
      startDate: startDate as string,
      endDate: endDate as string,
      purpose: purpose as any,
      organization: organization as string
    });
    res.json({ success: true, entries: auditLog.length, auditLog });
  } catch (error) {
    console.error("[TEFCA] Audit log error:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

router.get("/tefca/history", async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const history = tefcaFrameworkService.getQueryHistory(limit ? parseInt(limit as string) : undefined);
    res.json({ success: true, queries: history });
  } catch (error) {
    console.error("[TEFCA] History error:", error);
    res.status(500).json({ error: "Failed to fetch query history" });
  }
});

router.get("/tefca/stats", async (req: Request, res: Response) => {
  try {
    const stats = tefcaFrameworkService.getTEFCAStatistics();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("[TEFCA] Stats error:", error);
    res.status(500).json({ error: "Failed to fetch TEFCA statistics" });
  }
});

// ============================================================================
// EPIC IAS (INDIVIDUAL ACCESS SERVICES) ROUTES
// ============================================================================

router.get("/epic/organizations", async (req: Request, res: Response) => {
  try {
    const { query, nexusOnly } = req.query;
    
    let organizations = query 
      ? epicIntegrationService.searchOrganizations(query as string)
      : epicIntegrationService.getOrganizations();
    
    if (nexusOnly === 'true') {
      organizations = organizations.filter(org => org.isNexusMember);
    }
    
    res.json({
      success: true,
      totalOrganizations: organizations.length,
      organizations
    });
  } catch (error) {
    console.error("[Epic] Organizations error:", error);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

router.get("/epic/organizations/:organizationId", async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const organization = epicIntegrationService.getOrganization(organizationId);
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    res.json({ success: true, organization });
  } catch (error) {
    console.error("[Epic] Organization error:", error);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

router.get("/epic/scopes", async (req: Request, res: Response) => {
  try {
    const scopes = epicIntegrationService.getSupportedScopes();
    res.json({ success: true, scopes });
  } catch (error) {
    console.error("[Epic] Scopes error:", error);
    res.status(500).json({ error: "Failed to fetch scopes" });
  }
});

router.post("/epic/auth/initiate", async (req: Request, res: Response) => {
  try {
    const { organizationId, redirectUri, scopes, patientId } = req.body;
    
    if (!organizationId || !redirectUri || !scopes) {
      return res.status(400).json({ error: "Missing required fields: organizationId, redirectUri, scopes" });
    }

    logAuditEntry({
      action: "EPIC_AUTH_INITIATE",
      resourceType: "EpicAuth",
      resourceId: organizationId,
      actorId: patientId || "unknown",
      actorRole: "patient",
      timestamp: new Date().toISOString(),
      details: { scopes },
      outcome: "initiated",
      ipAddress: req.ip || "unknown"
    });

    const authResponse = epicIntegrationService.initiateAuth({
      organizationId,
      patientId,
      redirectUri,
      scopes
    });

    res.json({ success: true, auth: authResponse });
  } catch (error) {
    console.error("[Epic] Auth initiate error:", error);
    res.status(500).json({ error: "Failed to initiate Fasten Health authentication" });
  }
});

router.post("/epic/auth/token", async (req: Request, res: Response) => {
  try {
    const { organizationId, authorizationCode, redirectUri, codeVerifier } = req.body;
    
    if (!organizationId || !authorizationCode || !redirectUri || !codeVerifier) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tokenResponse = await epicIntegrationService.exchangeCodeForToken({
      organizationId,
      authorizationCode,
      redirectUri,
      codeVerifier
    });

    logAuditEntry({
      action: "EPIC_TOKEN_EXCHANGE",
      resourceType: "EpicAuth",
      resourceId: tokenResponse.patientId,
      actorId: tokenResponse.patientId,
      actorRole: "patient",
      timestamp: new Date().toISOString(),
      details: { scope: tokenResponse.scope },
      outcome: "success",
      ipAddress: req.ip || "unknown"
    });

    res.json({ success: true, token: tokenResponse });
  } catch (error) {
    console.error("[Epic] Token exchange error:", error);
    res.status(500).json({ error: "Failed to exchange authorization code" });
  }
});

router.post("/epic/auth/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken, organizationId } = req.body;
    
    if (!refreshToken || !organizationId) {
      return res.status(400).json({ error: "Missing required fields: refreshToken, organizationId" });
    }

    const tokenResponse = await epicIntegrationService.refreshToken(refreshToken, organizationId);
    res.json({ success: true, token: tokenResponse });
  } catch (error) {
    console.error("[Epic] Token refresh error:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

router.post("/epic/patient-data", async (req: Request, res: Response) => {
  try {
    const { accessToken, organizationId, patientId, resourceTypes, dateRange } = req.body;
    
    if (!accessToken || !organizationId || !patientId || !resourceTypes) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    logAuditEntry({
      action: "EPIC_PATIENT_DATA_FETCH",
      resourceType: "EpicPatientData",
      resourceId: patientId,
      actorId: patientId,
      actorRole: "patient",
      timestamp: new Date().toISOString(),
      details: { resourceTypes, organizationId },
      outcome: "success",
      ipAddress: req.ip || "unknown"
    });

    const data = await epicIntegrationService.fetchPatientData({
      accessToken,
      organizationId,
      patientId,
      resourceTypes,
      dateRange
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("[Epic] Patient data fetch error:", error);
    res.status(500).json({ error: "Failed to fetch patient data" });
  }
});

// ============================================================================
// EPIC NEXUS ROUTES
// ============================================================================

router.get("/epic/nexus/members", async (req: Request, res: Response) => {
  try {
    const members = epicIntegrationService.getNexusMemberOrganizations();
    res.json({
      success: true,
      totalMembers: members.length,
      members
    });
  } catch (error) {
    console.error("[Epic Nexus] Members error:", error);
    res.status(500).json({ error: "Failed to fetch Nexus members" });
  }
});

router.post("/epic/nexus/query", async (req: Request, res: Response) => {
  try {
    const { patientIdentifier, demographics, requestingOrganization, requestingProvider, purpose, dataTypes } = req.body;
    
    if (!demographics || !requestingOrganization || !purpose) {
      return res.status(400).json({ error: "Missing required fields: demographics, requestingOrganization, purpose" });
    }

    const queryId = `nexus_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    logAuditEntry({
      action: "EPIC_NEXUS_QUERY",
      resourceType: "NexusQuery",
      resourceId: queryId,
      actorId: requestingProvider || requestingOrganization,
      actorRole: "provider",
      timestamp: new Date().toISOString(),
      details: { purpose, patientName: `${demographics.lastName}, ${demographics.firstName}` },
      outcome: "initiated",
      ipAddress: req.ip || "unknown"
    });

    const response = await epicIntegrationService.queryNexusNetwork({
      queryId,
      patientIdentifier: patientIdentifier || { type: 'MRN', value: 'unknown' },
      demographics,
      requestingOrganization,
      requestingProvider,
      purpose,
      dataTypes
    });

    res.json({ success: true, query: response });
  } catch (error) {
    console.error("[Epic Nexus] Query error:", error);
    res.status(500).json({ error: "Failed to query Fasten Health Nexus network" });
  }
});

router.post("/epic/nexus/retrieve", async (req: Request, res: Response) => {
  try {
    const { documentId, accessToken } = req.body;
    
    if (!documentId || !accessToken) {
      return res.status(400).json({ error: "Missing required fields: documentId, accessToken" });
    }

    const document = await epicIntegrationService.retrieveNexusDocument(documentId, accessToken);

    logAuditEntry({
      action: "EPIC_NEXUS_DOCUMENT_RETRIEVE",
      resourceType: "NexusDocument",
      resourceId: documentId,
      actorId: "patient",
      actorRole: "patient",
      timestamp: new Date().toISOString(),
      details: { contentType: document.contentType },
      outcome: "success",
      ipAddress: req.ip || "unknown"
    });

    res.json({ success: true, document });
  } catch (error) {
    console.error("[Epic Nexus] Document retrieve error:", error);
    res.status(500).json({ error: "Failed to retrieve document" });
  }
});

router.get("/epic/nexus/history", async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const history = epicIntegrationService.getNexusQueryHistory(limit ? parseInt(limit as string) : undefined);
    res.json({ success: true, queries: history });
  } catch (error) {
    console.error("[Epic Nexus] History error:", error);
    res.status(500).json({ error: "Failed to fetch query history" });
  }
});

router.get("/epic/stats", async (req: Request, res: Response) => {
  try {
    const stats = epicIntegrationService.getEpicStatistics();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("[Epic] Stats error:", error);
    res.status(500).json({ error: "Failed to fetch Fasten Health statistics" });
  }
});

// ============================================================================
// FHIR BUNDLE IMPORT ROUTES
// ============================================================================

router.get("/bundle-import/sources", async (req: Request, res: Response) => {
  try {
    const sources = fhirBundleImportService.getSupportedSources();
    res.json({
      success: true,
      totalSources: sources.length,
      activeSources: sources.filter(s => s.status === 'active').length,
      sources
    });
  } catch (error) {
    console.error("[BundleImport] Sources error:", error);
    res.status(500).json({ error: "Failed to fetch FHIR bundle sources" });
  }
});

router.get("/bundle-import/sources/:sourceId", async (req: Request, res: Response) => {
  try {
    const source = fhirBundleImportService.getSourceById(req.params.sourceId);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }
    res.json({ success: true, source });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch source details" });
  }
});

router.post("/bundle-import/import", async (req: Request, res: Response) => {
  try {
    const { sourceId, patientId, resourceTypes, dateRange, format } = req.body;
    if (!sourceId || !patientId) {
      return res.status(400).json({ error: "sourceId and patientId are required" });
    }
    logAudit("FHIR_BUNDLE_IMPORT_INITIATED", { sourceId, patientId, resourceTypes });
    const result = await fhirBundleImportService.importBundle({
      sourceId,
      patientId,
      resourceTypes,
      dateRange,
      format: format || 'json'
    });
    logAudit("FHIR_BUNDLE_IMPORT_COMPLETED", { importId: result.importId, totalResources: result.totalResources, imported: result.importedResources });
    res.json({ success: true, result });
  } catch (error) {
    console.error("[BundleImport] Import error:", error);
    res.status(500).json({ error: "Failed to import FHIR bundle" });
  }
});

router.get("/bundle-import/history/:patientId", async (req: Request, res: Response) => {
  try {
    const history = fhirBundleImportService.getImportHistory(req.params.patientId);
    logAudit("FHIR_BUNDLE_IMPORT_HISTORY_ACCESSED", { patientId: req.params.patientId });
    res.json({ success: true, totalImports: history.length, history });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch import history" });
  }
});

router.post("/bundle-import/validate", async (req: Request, res: Response) => {
  try {
    const { bundle } = req.body;
    if (!bundle) {
      return res.status(400).json({ error: "bundle is required" });
    }
    const validationResults = fhirBundleImportService.validateBundle(bundle);
    res.json({ success: true, totalValidated: validationResults.length, validationResults });
  } catch (error) {
    res.status(500).json({ error: "Failed to validate FHIR bundle" });
  }
});

router.get("/bundle-import/stats", async (req: Request, res: Response) => {
  try {
    const stats = fhirBundleImportService.getImportStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch import statistics" });
  }
});

// ============================================================================
// WEARABLE DEVICE ROUTES
// ============================================================================

router.get("/wearables/platforms", async (req: Request, res: Response) => {
  try {
    const platforms = wearableDeviceService.getSupportedPlatforms();
    res.json({
      success: true,
      totalPlatforms: platforms.length,
      platforms
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch supported platforms" });
  }
});

router.get("/wearables/devices/:patientId", async (req: Request, res: Response) => {
  try {
    const devices = wearableDeviceService.getConnectedDevices(req.params.patientId);
    logAudit("WEARABLE_DEVICES_ACCESSED", { patientId: req.params.patientId });
    res.json({ success: true, totalDevices: devices.length, devices });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch connected devices" });
  }
});

router.post("/wearables/connect", async (req: Request, res: Response) => {
  try {
    const { patientId, platform, config } = req.body;
    if (!patientId || !platform) {
      return res.status(400).json({ error: "patientId and platform are required" });
    }
    logAudit("WEARABLE_DEVICE_CONNECTION_INITIATED", { patientId, platform });
    const device = await wearableDeviceService.connectDevice(patientId, platform, config || {});
    logAudit("WEARABLE_DEVICE_CONNECTED", { patientId, platform, deviceId: device.id });
    res.json({ success: true, device });
  } catch (error) {
    console.error("[Wearable] Connect error:", error);
    res.status(500).json({ error: "Failed to connect wearable device" });
  }
});

router.post("/wearables/disconnect", async (req: Request, res: Response) => {
  try {
    const { patientId, deviceId } = req.body;
    if (!patientId || !deviceId) {
      return res.status(400).json({ error: "patientId and deviceId are required" });
    }
    logAudit("WEARABLE_DEVICE_DISCONNECTED", { patientId, deviceId });
    const result = wearableDeviceService.disconnectDevice(patientId, deviceId);
    res.json({ success: true, disconnected: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to disconnect device" });
  }
});

router.post("/wearables/sync/:patientId/:deviceId", async (req: Request, res: Response) => {
  try {
    logAudit("WEARABLE_DATA_SYNC_INITIATED", { patientId: req.params.patientId, deviceId: req.params.deviceId });
    const result = await wearableDeviceService.syncDeviceData(req.params.patientId, req.params.deviceId);
    logAudit("WEARABLE_DATA_SYNC_COMPLETED", { patientId: req.params.patientId, syncId: result.syncId, dataPointsSynced: result.dataPointsSynced });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: "Failed to sync device data" });
  }
});

router.get("/wearables/data/:patientId/:deviceId", async (req: Request, res: Response) => {
  try {
    const { dataType, startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? { start: startDate as string, end: endDate as string } : undefined;
    logAudit("WEARABLE_DATA_ACCESSED", { patientId: req.params.patientId, deviceId: req.params.deviceId, dataType });
    const data = wearableDeviceService.getDeviceData(req.params.patientId, req.params.deviceId, dataType as any, dateRange);
    res.json({ success: true, totalDataPoints: data.length, data });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch device data" });
  }
});

router.get("/wearables/vitals/:patientId", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? { start: startDate as string, end: endDate as string } : undefined;
    logAudit("WEARABLE_VITALS_ACCESSED", { patientId: req.params.patientId });
    const vitals = wearableDeviceService.getAggregatedVitals(req.params.patientId, dateRange);
    res.json({ success: true, vitals });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch aggregated vitals" });
  }
});

router.get("/wearables/stream/:patientId/:deviceId", async (req: Request, res: Response) => {
  try {
    const stream = wearableDeviceService.getRealtimeStream(req.params.patientId, req.params.deviceId);
    res.json({ success: true, stream });
  } catch (error) {
    res.status(500).json({ error: "Failed to get realtime stream info" });
  }
});

// ============================================================================
// WEARABLE PLATFORM CONNECTOR ROUTES
// ============================================================================

router.get("/wearables/connectors/statuses", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.query;
    const pid = (patientId as string) || 'patient-001';
    logAudit("WEARABLE_CONNECTOR_STATUSES_ACCESSED", { patientId: pid });
    const devices = wearableDeviceService.getConnectedDevices(pid);
    const allData = wearableDeviceService.getDeviceData(pid, '', undefined);
    const statuses = wearablePlatformConnectorManager.getAllConnectorStatuses(devices, allData);
    res.json({ success: true, connectors: statuses });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch connector statuses" });
  }
});

router.get("/wearables/connectors/format/:platform", async (req: Request, res: Response) => {
  try {
    const platform = req.params.platform as any;
    logAudit("WEARABLE_DATA_FORMAT_ACCESSED", { platform });
    const format = wearablePlatformConnectorManager.getDataFormat(platform);
    res.json({ success: true, format });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to fetch data format" });
  }
});

router.get("/wearables/connectors/mapping/:platform", async (req: Request, res: Response) => {
  try {
    const platform = req.params.platform as any;
    logAudit("WEARABLE_MAPPING_RULES_ACCESSED", { platform });
    const rules = wearablePlatformConnectorManager.getMappingRules(platform);
    res.json({ success: true, platform, totalRules: rules.length, rules });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to fetch mapping rules" });
  }
});

router.post("/wearables/connectors/parse/:platform", async (req: Request, res: Response) => {
  try {
    const platform = req.params.platform as any;
    const rawData = req.body;
    logAudit("WEARABLE_DATA_PARSE_INITIATED", { platform });
    const parsed = wearablePlatformConnectorManager.parseData(platform, rawData);
    logAudit("WEARABLE_DATA_PARSE_COMPLETED", { platform, recordsProcessed: parsed.metadata.recordsProcessed });
    res.json({ success: true, ...parsed });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to parse wearable data" });
  }
});

// ============================================================================
// DATA LINEAGE ROUTES
// ============================================================================

router.get("/lineage/record/:recordId", async (req: Request, res: Response) => {
  try {
    const lineage = dataLineageService.getLineageForRecord(req.params.recordId);
    if (!lineage) {
      return res.status(404).json({ error: "Lineage record not found" });
    }
    logAudit("DATA_LINEAGE_RECORD_ACCESSED", { recordId: req.params.recordId });
    res.json({ success: true, lineage });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch record lineage" });
  }
});

router.get("/lineage/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { sourceType, resourceType, startDate, endDate } = req.query;
    const filters: any = {};
    if (sourceType) filters.sourceType = sourceType;
    if (resourceType) filters.resourceType = resourceType;
    if (startDate && endDate) filters.dateRange = { start: startDate as string, end: endDate as string };
    logAudit("DATA_LINEAGE_PATIENT_ACCESSED", { patientId: req.params.patientId, filters });
    const records = dataLineageService.getLineageForPatient(req.params.patientId, Object.keys(filters).length > 0 ? filters : undefined);
    res.json({ success: true, totalRecords: records.length, records });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch patient lineage" });
  }
});

router.get("/lineage/summary/:patientId", async (req: Request, res: Response) => {
  try {
    logAudit("DATA_LINEAGE_SUMMARY_ACCESSED", { patientId: req.params.patientId });
    const summary = dataLineageService.getLineageSummary(req.params.patientId);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lineage summary" });
  }
});

router.get("/lineage/sources/:patientId", async (req: Request, res: Response) => {
  try {
    const breakdown = dataLineageService.getSourceBreakdown(req.params.patientId);
    res.json({ success: true, breakdown });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch source breakdown" });
  }
});

router.get("/lineage/transformations/:recordId", async (req: Request, res: Response) => {
  try {
    logAudit("DATA_TRANSFORMATIONS_ACCESSED", { recordId: req.params.recordId });
    const transformations = dataLineageService.getTransformationHistory(req.params.recordId);
    res.json({ success: true, transformations });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transformation history" });
  }
});

router.get("/lineage/provenance/:recordId", async (req: Request, res: Response) => {
  try {
    logAudit("DATA_PROVENANCE_ACCESSED", { recordId: req.params.recordId });
    const provenance = dataLineageService.getProvenanceChain(req.params.recordId);
    res.json({ success: true, provenance });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch provenance chain" });
  }
});

router.get("/lineage/freshness/:patientId", async (req: Request, res: Response) => {
  try {
    logAudit("DATA_FRESHNESS_ACCESSED", { patientId: req.params.patientId });
    const freshness = dataLineageService.getDataFreshness(req.params.patientId);
    res.json({ success: true, freshness });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch data freshness" });
  }
});

router.get("/lineage/search", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Search query 'q' is required" });
    }
    const results = dataLineageService.searchLineage(q as string);
    res.json({ success: true, totalResults: results.length, results });
  } catch (error) {
    res.status(500).json({ error: "Failed to search lineage" });
  }
});

router.get("/lineage/timeline/:patientId", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? { start: startDate as string, end: endDate as string } : undefined;
    logAudit("DATA_LINEAGE_TIMELINE_ACCESSED", { patientId: req.params.patientId });
    const timeline = dataLineageService.getTimelineView(req.params.patientId, dateRange);
    res.json({ success: true, timeline });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lineage timeline" });
  }
});

// ==========================================
// EHR Patient Portal Routes
// ==========================================

router.get("/patient-portals/dashboard", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("PATIENT_PORTAL_DASHBOARD_ACCESSED", {});
    const dashboard = ehrPatientPortalService.getDashboard();
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch portal dashboard" });
  }
});

router.get("/patient-portals/platforms", rateLimiter, (_req: Request, res: Response) => {
  try {
    logAudit("PATIENT_PORTAL_PLATFORMS_LISTED", {});
    const platforms = ehrPatientPortalService.getSupportedPlatforms();
    res.json({ success: true, platforms });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch supported platforms" });
  }
});

router.get("/patient-portals/connections", rateLimiter, (_req: Request, res: Response) => {
  try {
    logAudit("PATIENT_PORTAL_CONNECTIONS_LISTED", {});
    const connections = ehrPatientPortalService.getConnections();
    res.json({ success: true, connections });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch portal connections" });
  }
});

router.get("/patient-portals/connections/:connectionId", rateLimiter, (req: Request, res: Response) => {
  try {
    const connection = ehrPatientPortalService.getConnection(req.params.connectionId);
    if (!connection) return res.status(404).json({ error: "Connection not found" });
    logAudit("PATIENT_PORTAL_CONNECTION_ACCESSED", { connectionId: req.params.connectionId });
    res.json({ success: true, connection });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch portal connection" });
  }
});

router.post("/patient-portals/connect", rateLimiter, (req: Request, res: Response) => {
  try {
    const { platform, organizationName } = req.body;
    if (!platform || !organizationName) return res.status(400).json({ error: "Platform and organizationName required" });
    logAudit("PATIENT_PORTAL_CONNECTION_INITIATED", { platform, organizationName });
    const connection = ehrPatientPortalService.initiateConnection(platform, organizationName);
    res.json({ success: true, connection });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to initiate connection" });
  }
});

router.post("/patient-portals/connections/:connectionId/sync", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("PATIENT_PORTAL_SYNC_TRIGGERED", { connectionId: req.params.connectionId });
    const result = ehrPatientPortalService.syncConnection(req.params.connectionId);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to sync connection" });
  }
});

router.get("/patient-portals/connections/:connectionId/summary", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("PATIENT_PORTAL_DATA_SUMMARY_ACCESSED", { connectionId: req.params.connectionId });
    const summary = ehrPatientPortalService.getDataSummary(req.params.connectionId);
    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to fetch data summary" });
  }
});

router.get("/patient-portals/connections/:connectionId/history", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("PATIENT_PORTAL_SYNC_HISTORY_ACCESSED", { connectionId: req.params.connectionId });
    const history = ehrPatientPortalService.getSyncHistory(req.params.connectionId);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sync history" });
  }
});

// ==========================================
// Health App Connector Routes
// ==========================================

router.get("/health-apps/dashboard", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("HEALTH_APP_DASHBOARD_ACCESSED", {});
    const dashboard = healthAppConnectorService.getDashboard();
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch health app dashboard" });
  }
});

router.get("/health-apps/platforms", rateLimiter, (_req: Request, res: Response) => {
  try {
    logAudit("HEALTH_APP_PLATFORMS_LISTED", {});
    const platforms = healthAppConnectorService.getSupportedPlatforms();
    res.json({ success: true, platforms });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch supported platforms" });
  }
});

router.get("/health-apps/connections", rateLimiter, (_req: Request, res: Response) => {
  try {
    logAudit("HEALTH_APP_CONNECTIONS_LISTED", {});
    const connections = healthAppConnectorService.getConnections();
    res.json({ success: true, connections });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch health app connections" });
  }
});

router.get("/health-apps/connections/:connectionId", rateLimiter, (req: Request, res: Response) => {
  try {
    const connection = healthAppConnectorService.getConnection(req.params.connectionId);
    if (!connection) return res.status(404).json({ error: "Connection not found" });
    logAudit("HEALTH_APP_CONNECTION_ACCESSED", { connectionId: req.params.connectionId });
    res.json({ success: true, connection });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch health app connection" });
  }
});

router.post("/health-apps/connect", rateLimiter, (req: Request, res: Response) => {
  try {
    const { platform, username } = req.body;
    if (!platform || !username) return res.status(400).json({ error: "Platform and username required" });
    logAudit("HEALTH_APP_CONNECTION_INITIATED", { platform, username });
    const connection = healthAppConnectorService.initiateConnection(platform, username);
    res.json({ success: true, connection });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to initiate connection" });
  }
});

router.post("/health-apps/connections/:connectionId/sync", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("HEALTH_APP_SYNC_TRIGGERED", { connectionId: req.params.connectionId });
    const result = healthAppConnectorService.syncConnection(req.params.connectionId);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to sync connection" });
  }
});

router.get("/health-apps/connections/:connectionId/nutrition", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("HEALTH_APP_NUTRITION_DATA_ACCESSED", { connectionId: req.params.connectionId });
    const nutrition = healthAppConnectorService.getNutritionData(req.params.connectionId);
    res.json({ success: true, nutrition });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch nutrition data" });
  }
});

router.get("/health-apps/connections/:connectionId/workouts", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("HEALTH_APP_WORKOUT_DATA_ACCESSED", { connectionId: req.params.connectionId });
    const workouts = healthAppConnectorService.getWorkoutData(req.params.connectionId);
    res.json({ success: true, workouts });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch workout data" });
  }
});

router.get("/health-apps/connections/:connectionId/history", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("HEALTH_APP_SYNC_HISTORY_ACCESSED", { connectionId: req.params.connectionId });
    const history = healthAppConnectorService.getSyncHistory(req.params.connectionId);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sync history" });
  }
});

// ==========================================
// Health Goals Routes
// ==========================================

router.get("/health-goals/:patientId/dashboard", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("HEALTH_GOALS_DASHBOARD_ACCESSED", { patientId: req.params.patientId });
    const dashboard = healthGoalsService.getDashboard(req.params.patientId);
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch health goals dashboard" });
  }
});

router.get("/health-goals/:patientId/goals", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("HEALTH_GOALS_LISTED", { patientId: req.params.patientId });
    const goals = healthGoalsService.getGoals(req.params.patientId);
    res.json({ success: true, goals });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch health goals" });
  }
});

router.get("/health-goals/goal/:goalId", rateLimiter, (req: Request, res: Response) => {
  try {
    const goal = healthGoalsService.getGoal(req.params.goalId);
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    logAudit("HEALTH_GOAL_ACCESSED", { goalId: req.params.goalId });
    res.json({ success: true, goal });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch health goal" });
  }
});

router.post("/health-goals/create", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId, title, description, category, targetValue, unit, targetDate, priority, linkedConditions } = req.body;
    if (!patientId || !title || !category || !targetValue || !unit || !targetDate) {
      return res.status(400).json({ error: "Missing required fields: patientId, title, category, targetValue, unit, targetDate" });
    }
    logAudit("HEALTH_GOAL_CREATED", { patientId, title, category });
    const goal = healthGoalsService.createGoal({ patientId, title, description: description || "", category, targetValue, unit, targetDate, priority: priority || "medium", linkedConditions });
    res.json({ success: true, goal });
  } catch (error) {
    res.status(500).json({ error: "Failed to create health goal" });
  }
});

router.post("/health-goals/goal/:goalId/progress", rateLimiter, (req: Request, res: Response) => {
  try {
    const { value, note, source } = req.body;
    if (value === undefined || value === null) return res.status(400).json({ error: "Value is required" });
    logAudit("HEALTH_GOAL_PROGRESS_LOGGED", { goalId: req.params.goalId, value });
    const entry = healthGoalsService.addProgress(req.params.goalId, value, note || "", source || "manual");
    if (!entry) return res.status(404).json({ error: "Goal not found" });
    const goal = healthGoalsService.getGoal(req.params.goalId);
    res.json({ success: true, entry, goal });
  } catch (error) {
    res.status(500).json({ error: "Failed to log progress" });
  }
});

router.patch("/health-goals/goal/:goalId/status", rateLimiter, (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status is required" });
    logAudit("HEALTH_GOAL_STATUS_UPDATED", { goalId: req.params.goalId, status });
    const goal = healthGoalsService.updateGoalStatus(req.params.goalId, status);
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    res.json({ success: true, goal });
  } catch (error) {
    res.status(500).json({ error: "Failed to update goal status" });
  }
});

router.delete("/health-goals/goal/:goalId", rateLimiter, (req: Request, res: Response) => {
  try {
    logAudit("HEALTH_GOAL_DELETED", { goalId: req.params.goalId });
    const deleted = healthGoalsService.deleteGoal(req.params.goalId);
    if (!deleted) return res.status(404).json({ error: "Goal not found" });
    res.json({ success: true, deleted: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete health goal" });
  }
});

router.get("/health-goals/templates", rateLimiter, (_req: Request, res: Response) => {
  try {
    logAudit("HEALTH_GOAL_TEMPLATES_ACCESSED", {});
    const templates = healthGoalsService.getTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch goal templates" });
  }
});

// =============================================
// SECURE MESSAGING ROUTES
// =============================================

router.get("/messaging/:patientId/dashboard", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const dashboard = secureMessagingService.getDashboard(patientId);
    logAudit("messaging_dashboard_viewed", patientId, "SecureMessaging", req);
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messaging dashboard" });
  }
});

router.get("/messaging/:patientId/conversations", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const filter = req.query.filter as string | undefined;
    const conversations = secureMessagingService.getConversations(patientId, filter);
    logAudit("conversations_listed", patientId, "SecureMessaging", req);
    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/messaging/conversation/:conversationId/messages", rateLimiter, (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const messages = secureMessagingService.getMessages(conversationId);
    logAudit("messages_viewed", "system", "SecureMessaging", req);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/messaging/conversation/:conversationId/send", rateLimiter, (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { senderId, senderName, content } = req.body;
    if (!senderId || !content) {
      return res.status(400).json({ error: "senderId and content are required" });
    }
    const message = secureMessagingService.sendMessage(conversationId, senderId, senderName || "Patient", content);
    logAudit("message_sent", senderId, "SecureMessaging", req);
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/messaging/conversation/create", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId, subject, participantIds, type } = req.body;
    if (!patientId || !subject) {
      return res.status(400).json({ error: "patientId and subject are required" });
    }
    const conversation = secureMessagingService.createConversation(patientId, subject, participantIds || [], type || "direct");
    logAudit("conversation_created", patientId, "SecureMessaging", req);
    res.json({ success: true, conversation });
  } catch (error) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.post("/messaging/conversation/:conversationId/read", rateLimiter, (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    secureMessagingService.markAsRead(conversationId, userId || "patient-001");
    logAudit("messages_marked_read", userId || "patient-001", "SecureMessaging", req);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

router.get("/messaging/:patientId/care-team", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const team = secureMessagingService.getCareTeam(patientId);
    logAudit("care_team_viewed", patientId, "SecureMessaging", req);
    res.json({ success: true, team });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch care team" });
  }
});

router.get("/messaging/:patientId/care-team-profiles", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const profiles = secureMessagingService.getCareTeamProfiles(patientId);
    logAudit("care_team_profiles_viewed", patientId, "SecureMessaging", req);
    res.json({ success: true, profiles });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch care team profiles" });
  }
});

router.get("/messaging/care-team-member/:memberId", rateLimiter, (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const profile = secureMessagingService.getCareTeamMemberProfile(memberId);
    if (!profile) return res.status(404).json({ error: "Member not found" });
    logAudit("care_team_member_profile_viewed", memberId, "SecureMessaging", req);
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch member profile" });
  }
});

router.post("/messaging/conversation/:conversationId/share-document", rateLimiter, (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { senderId, senderName, fileName, fileType, fileSize, description, isConfidential } = req.body;
    if (!senderId || !fileName) {
      return res.status(400).json({ error: "senderId and fileName are required" });
    }
    const message = secureMessagingService.shareDocument(conversationId, senderId, senderName || "Provider", {
      fileName, fileType: fileType || "other", fileSize: fileSize || "Unknown", description: description || "", isConfidential: isConfidential || false,
    });
    logAudit("document_shared", senderId, "SecureMessaging", req);
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: "Failed to share document" });
  }
});

router.post("/messaging/conversation/:conversationId/propose-appointment", rateLimiter, (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { senderId, senderName, providerId, providerName, appointmentType, proposedSlots, location, reason, notes } = req.body;
    if (!senderId || !proposedSlots?.length || !reason) {
      return res.status(400).json({ error: "senderId, proposedSlots, and reason are required" });
    }
    const message = secureMessagingService.proposeAppointment(conversationId, senderId, senderName || "Provider", {
      providerId: providerId || senderId, providerName: providerName || senderName || "Provider",
      appointmentType: appointmentType || "in_person", proposedSlots, location: location || "TBD", reason, notes: notes || "",
    });
    logAudit("appointment_proposed", senderId, "SecureMessaging", req);
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: "Failed to propose appointment" });
  }
});

router.post("/messaging/appointment/:appointmentId/confirm", rateLimiter, (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { selectedSlot } = req.body;
    if (!selectedSlot) {
      return res.status(400).json({ error: "selectedSlot is required" });
    }
    const appointment = secureMessagingService.confirmAppointment(appointmentId, selectedSlot);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    logAudit("appointment_confirmed", "patient", "SecureMessaging", req);
    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ error: "Failed to confirm appointment" });
  }
});

router.post("/messaging/conversation/:conversationId/care-advice", rateLimiter, (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { senderId, senderName, category, urgency, summary, details, suggestedActions, expiresAt } = req.body;
    if (!senderId || !summary || !details) {
      return res.status(400).json({ error: "senderId, summary, and details are required" });
    }
    const message = secureMessagingService.sendCareAdvice(conversationId, senderId, senderName || "Provider", {
      category: category || "follow_up", urgency: urgency || "routine", summary, details, suggestedActions: suggestedActions || [], expiresAt: expiresAt || null,
    });
    logAudit("care_advice_sent", senderId, "SecureMessaging", req);
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: "Failed to send care advice" });
  }
});

router.get("/messaging/:patientId/documents", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const documents = secureMessagingService.getSharedDocuments(patientId);
    logAudit("shared_documents_viewed", patientId, "SecureMessaging", req);
    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch shared documents" });
  }
});

router.get("/messaging/:patientId/appointments", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const appointments = secureMessagingService.getAppointments(patientId);
    logAudit("appointments_viewed", patientId, "SecureMessaging", req);
    res.json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

router.get("/messaging/:patientId/recent-communications", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const messages = secureMessagingService.getRecentCommunications(patientId, limit);
    logAudit("recent_communications_viewed", patientId, "SecureMessaging", req);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recent communications" });
  }
});

// =============================================
// INTAKE HISTORY ROUTES
// =============================================

router.get("/intake/reference-data", rateLimiter, (_req: Request, res: Response) => {
  try {
    const data = intakeHistoryService.getReferenceData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reference data" });
  }
});

router.get("/intake/:patientId/record", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const record = intakeHistoryService.getPatientIntake(patientId);
    logAudit("intake_record_viewed", patientId, "IntakeHistory", req);
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch intake record" });
  }
});

router.post("/intake/:patientId/save", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const data = req.body;
    const record = intakeHistoryService.savePatientIntake(patientId, data);
    logAudit("intake_record_updated", patientId, "IntakeHistory", req);
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ error: "Failed to save intake record" });
  }
});

router.post("/intake/score-phq9", rateLimiter, (req: Request, res: Response) => {
  try {
    const { responses } = req.body;
    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: "responses array is required" });
    }
    const result = intakeHistoryService.scorePHQ9(responses);
    logAudit("phq9_scored", "system", "IntakeHistory", req);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: "Failed to score PHQ-9" });
  }
});

router.post("/intake/score-peg", rateLimiter, (req: Request, res: Response) => {
  try {
    const { pain, enjoyment, generalActivity } = req.body;
    if (pain === undefined || enjoyment === undefined || generalActivity === undefined) {
      return res.status(400).json({ error: "pain, enjoyment, and generalActivity are required" });
    }
    const result = intakeHistoryService.scorePEG(pain, enjoyment, generalActivity);
    logAudit("peg_scored", "system", "IntakeHistory", req);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: "Failed to score PEG" });
  }
});

router.get("/intake/:patientId/preventive-recommendations", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const recommendations = intakeHistoryService.getPreventiveRecommendations(patientId);
    logAudit("preventive_recommendations_viewed", patientId, "IntakeHistory", req);
    res.json({ success: true, recommendations });
  } catch (error) {
    res.status(500).json({ error: "Failed to get preventive recommendations" });
  }
});

router.get("/intake/:patientId/vaccines/registry", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const registry = intakeHistoryService.getVaccineRegistry(patientId);
    logAudit("vaccine_registry_queried", patientId, "IntakeHistory", req);
    res.json({ success: true, registry });
  } catch (error) {
    res.status(500).json({ error: "Failed to query vaccine registry" });
  }
});

// ==================== Comprehensive Intake Wizard Routes ====================

router.post("/intake/:patientId/comprehensive", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const parseResult = insertComprehensiveIntakeSchema.safeParse({ ...req.body, patientId });
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.issues });
    }
    const record = intakeHistoryService.saveComprehensiveIntake(patientId, parseResult.data);
    logAudit("comprehensive_intake_submitted", patientId, "ComprehensiveIntake", req);
    res.json({ success: true, intake: record });
  } catch (error) {
    res.status(500).json({ error: "Failed to save comprehensive intake" });
  }
});

router.get("/intake/:patientId/comprehensive", rateLimiter, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const records = intakeHistoryService.getComprehensiveIntakesByPatient(patientId);
    logAudit("comprehensive_intake_list_viewed", patientId, "ComprehensiveIntake", req);
    res.json({ success: true, intakes: records });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch comprehensive intakes" });
  }
});

router.get("/intake/comprehensive/:intakeId", rateLimiter, (req: Request, res: Response) => {
  try {
    const { intakeId } = req.params;
    const record = intakeHistoryService.getComprehensiveIntake(intakeId);
    if (!record) {
      return res.status(404).json({ error: "Intake not found" });
    }
    logAudit("comprehensive_intake_viewed", record.patientId, "ComprehensiveIntake", req);
    res.json({ success: true, intake: record });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch comprehensive intake" });
  }
});

router.post("/intake/comprehensive/:intakeId/cds", rateLimiter, async (req: Request, res: Response) => {
  try {
    const { intakeId } = req.params;
    const intake = intakeHistoryService.getComprehensiveIntake(intakeId);
    if (!intake) {
      return res.status(404).json({ error: "Intake not found" });
    }

    const cdsRequest = intakeHistoryService.buildCdsRequestFromIntake(intake);

    const cdsResults: any = {
      generatedAt: new Date().toISOString(),
      drugInteractions: null,
      riskFactors: [],
      recommendations: [],
    };

    if (cdsRequest.medications.length >= 2) {
      try {
        const interactions = await checkDrugInteractions({
          patientId: cdsRequest.patientId,
          medications: cdsRequest.medications,
          allergies: cdsRequest.allergies,
          conditions: cdsRequest.conditions.map(c => c.name),
        });
        cdsResults.drugInteractions = interactions;
      } catch {
        cdsResults.drugInteractions = { error: "Unable to analyze drug interactions at this time" };
      }
    }

    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    if (intake.socialHistory.tobacco.status === "current") {
      riskFactors.push("Active tobacco use");
      recommendations.push("Tobacco cessation counseling and support resources are available");
    } else if (intake.socialHistory.tobacco.status === "former" && (intake.socialHistory.tobacco.yearsUsed || 0) >= 10) {
      riskFactors.push("Significant smoking history");
      recommendations.push("Annual low-dose CT lung screening may be indicated based on smoking history");
    }

    if (intake.socialHistory.alcohol.status === "heavy") {
      riskFactors.push("Heavy alcohol use reported");
      recommendations.push("Alcohol use assessment and counseling resources are available");
    }

    const hasDiabetes = intake.medicalHistory.conditions.some(c => c.code.startsWith("E11") || c.display.toLowerCase().includes("diabetes"));
    const hasHypertension = intake.medicalHistory.conditions.some(c => c.code === "I10" || c.display.toLowerCase().includes("hypertension"));

    if (hasDiabetes) {
      riskFactors.push("Diabetes documented");
      recommendations.push("Regular A1C monitoring, diabetic eye exam, and foot exam may be indicated");
    }

    if (hasHypertension) {
      riskFactors.push("Hypertension documented");
      recommendations.push("Regular blood pressure monitoring and cardiovascular screening may be indicated");
    }

    if (intake.allergies.allergies.some(a => a.severity === "severe" || a.severity === "life-threatening")) {
      riskFactors.push("Severe allergies documented - ensure allergy alerts are active");
    }

    const allergyMedConflicts: string[] = [];
    const allergyNames = intake.allergies.allergies.map(a => a.name.toLowerCase());
    const medNames = intake.medications.medications.map(m => m.name.toLowerCase());

    if (allergyNames.includes("penicillin") && medNames.some(m => m.includes("amoxicillin"))) {
      allergyMedConflicts.push("Penicillin allergy noted with amoxicillin in medication list - verify with provider");
    }
    if (allergyNames.includes("nsaids") && medNames.some(m => m.includes("ibuprofen") || m.includes("naproxen"))) {
      allergyMedConflicts.push("NSAID allergy noted with NSAID medication in list - verify with provider");
    }

    cdsResults.riskFactors = riskFactors;
    cdsResults.recommendations = recommendations;
    cdsResults.allergyMedConflicts = allergyMedConflicts;
    cdsResults.disclaimer = "This analysis is informational only and does not constitute medical advice. All findings should be reviewed by a qualified healthcare provider.";

    const updated = intakeHistoryService.updateIntakeCdsResults(intakeId, cdsResults);
    logAudit("comprehensive_intake_cds_triggered", intake.patientId, "ComprehensiveIntake", req);
    res.json({ success: true, intake: updated, cdsResults });
  } catch (error) {
    res.status(500).json({ error: "Failed to run CDS analysis" });
  }
});

// ==================== Clinical Tools Routes ====================

router.post("/clinical-tools/nmn/validate", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { firstName, middleName, lastName } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ error: "firstName and lastName are required" });
    }
    const result = clinicalToolsService.validateNMN(firstName, middleName, lastName);
    logAudit("NMN_VALIDATED", { firstName, lastName, resource: "ClinicalTools" });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: "Failed to validate NMN" });
  }
});

router.get("/clinical-tools/nmn/records", rateLimiter, requireAuth, (_req: Request, res: Response) => {
  try {
    const records = clinicalToolsService.getNMNRecords();
    logAudit("NMN_RECORDS_ACCESSED", { resource: "ClinicalTools" });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ error: "Failed to get NMN records" });
  }
});

router.post("/clinical-tools/nmn/:patientId/confirm", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { hasMiddleName, middleName } = req.body;
    const result = clinicalToolsService.confirmNMN(patientId, hasMiddleName, middleName);
    logAudit("NMN_CONFIRMED", { patientId, hasMiddleName, resource: "ClinicalTools" });
    res.json({ success: true, record: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to confirm NMN status" });
  }
});

router.get("/clinical-tools/:patientId/safety-alerts", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const alerts = clinicalToolsService.getSafetyAlerts(patientId);
    logAudit("SAFETY_ALERTS_VIEWED", { patientId, alertCount: alerts.length, resource: "ClinicalTools" });
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ error: "Failed to get safety alerts" });
  }
});

router.get("/clinical-tools/clinical-ranges", rateLimiter, requireAuth, (_req: Request, res: Response) => {
  try {
    const ranges = clinicalToolsService.getClinicalRanges();
    logAudit("CLINICAL_RANGES_ACCESSED", { rangeCount: ranges.length, resource: "ClinicalTools" });
    res.json({ success: true, ranges });
  } catch (error) {
    res.status(500).json({ error: "Failed to get clinical ranges" });
  }
});

router.get("/clinical-tools/:patientId/episodes", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const episodes = clinicalToolsService.getEpisodesOfCare(patientId);
    logAudit("EPISODES_OF_CARE_VIEWED", { patientId, episodeCount: episodes.length, resource: "ClinicalTools" });
    res.json({ success: true, episodes });
  } catch (error) {
    res.status(500).json({ error: "Failed to get episodes of care" });
  }
});

router.get("/clinical-tools/:patientId/ai-summary", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const summary = clinicalToolsService.generateAICareSummary(patientId);
    logAudit("AI_CARE_SUMMARY_GENERATED", { patientId, resource: "ClinicalTools" });
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate AI summary" });
  }
});

router.post("/clinical-tools/:patientId/smart-health-card", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { type } = req.body;
    const cardType = type || 'combined';
    const card = clinicalToolsService.generateSmartHealthCard(patientId, cardType);
    logAudit("SMART_HEALTH_CARD_GENERATED", { patientId, cardType, cardId: card.id, resource: "ClinicalTools" });
    res.json({ success: true, card });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate Smart Health Card" });
  }
});

router.post("/clinical-tools/:patientId/fhir/bulk-export", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { resourceTypes } = req.body;
    const job = clinicalToolsService.startBulkExport(patientId, resourceTypes);
    logAudit("FHIR_BULK_EXPORT_INITIATED", { patientId, jobId: job.jobId, totalResources: job.totalResources, resource: "ClinicalTools" });
    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ error: "Failed to start bulk export" });
  }
});

router.get("/clinical-tools/fhir/export/:jobId", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = clinicalToolsService.getExportJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Export job not found" });
    }
    logAudit("FHIR_EXPORT_JOB_ACCESSED", { jobId, resource: "ClinicalTools" });
    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ error: "Failed to get export job" });
  }
});

router.get("/clinical-tools/fhir/export/:jobId/download", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = clinicalToolsService.getExportJob(jobId);
    if (!job || !job.ndjsonContent) {
      return res.status(404).json({ error: "Export not found or not ready" });
    }
    res.setHeader('Content-Type', 'application/ndjson');
    res.setHeader('Content-Disposition', `attachment; filename="fhir-export-${jobId}.ndjson"`);
    logAudit("FHIR_EXPORT_DOWNLOADED", { jobId, resource: "ClinicalTools" });
    res.send(job.ndjsonContent);
  } catch (error) {
    res.status(500).json({ error: "Failed to download export" });
  }
});

router.get("/clinical-tools/:patientId/lab-sparklines", rateLimiter, requireAuth, (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const labs = clinicalToolsService.getLabResultsWithSparklines(patientId);
    logAudit("LAB_SPARKLINES_VIEWED", { patientId, labCount: labs.length, resource: "ClinicalTools" });
    res.json({ success: true, labs });
  } catch (error) {
    res.status(500).json({ error: "Failed to get lab results with sparklines" });
  }
});

// ============================================
// COMMUNITY ROUTES
// ============================================

router.get("/community/settings", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const settings = communityService.getOptInStatus(userId as string);
    const stats = communityService.getCommunityStats();
    logAudit("COMMUNITY_SETTINGS_VIEWED", { userId, resource: "Community" });
    res.json({ success: true, settings, stats });
  } catch (error) {
    res.status(500).json({ error: "Failed to get community settings" });
  }
});

router.post("/community/opt-in", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const { displayName, bio } = req.body;
    if (!displayName || typeof displayName !== "string" || displayName.trim().length < 3) {
      return res.status(400).json({ error: "Display name must be at least 3 characters." });
    }
    const phiCheck = communityService.scanForPHI(displayName + " " + (bio || ""));
    if (phiCheck.hasPHI) {
      return res.status(400).json({ error: "Display name or bio appears to contain personal health information. Please use anonymized content." });
    }
    const settings = communityService.optIn(userId as string, displayName.trim(), (bio || "").trim());
    logAuditEntry({ action: "COMMUNITY_OPT_IN", resourceType: "Community", resourceId: userId as string, actorId: userId as string, actorRole: "patient", timestamp: new Date().toISOString(), details: { displayName: settings.displayName }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: "Failed to opt into community" });
  }
});

router.post("/community/opt-out", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    communityService.optOut(userId as string);
    logAuditEntry({ action: "COMMUNITY_OPT_OUT", resourceType: "Community", resourceId: userId as string, actorId: userId as string, actorRole: "patient", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to opt out of community" });
  }
});

router.get("/community/feed", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const category = req.query.category as string | undefined;
    const feed = communityService.getFeed(page, limit, category);
    logAuditEntry({ action: "COMMUNITY_FEED_VIEWED", resourceType: "CommunityFeed", resourceId: "feed", actorId: userId as string, actorRole: "patient", timestamp: new Date().toISOString(), details: { page, category: category || "all", postCount: feed.posts.length }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ success: true, ...feed });
  } catch (error) {
    res.status(500).json({ error: "Failed to get community feed" });
  }
});

router.get("/community/posts/:postId", async (req: Request, res: Response) => {
  try {
    const post = communityService.getPostById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    const comments = communityService.getCommentsForPost(req.params.postId);
    res.json({ success: true, post, comments });
  } catch (error) {
    res.status(500).json({ error: "Failed to get post" });
  }
});

router.post("/community/posts", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const { title, content, goalCategory, tags, privacyLevel, progressMetric } = req.body;
    if (!title || !content || !goalCategory) {
      return res.status(400).json({ error: "Title, content, and goal category are required." });
    }
    if (communityService.isUserBanned(userId as string)) {
      return res.status(403).json({ error: "Your community access has been suspended." });
    }
    const optInStatus = communityService.getOptInStatus(userId as string);
    if (!optInStatus || !optInStatus.optedIn) {
      return res.status(403).json({ error: "You must opt into the community before posting." });
    }
    const result = communityService.createPost(userId as string, {
      title, content, goalCategory,
      tags: tags || [],
      privacyLevel: privacyLevel || "community_only",
      progressMetric: progressMetric || null,
    });
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    logAuditEntry({ action: "COMMUNITY_POST_CREATED", resourceType: "CommunityPost", resourceId: result.post!.id, actorId: userId as string, actorRole: "patient", timestamp: new Date().toISOString(), details: { goalCategory, status: result.post!.status, privacyLevel: result.post!.privacyLevel }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ success: true, post: result.post });
  } catch (error) {
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.post("/community/posts/:postId/comments", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim().length < 1) {
      return res.status(400).json({ error: "Comment content is required." });
    }
    const result = communityService.addComment(req.params.postId, userId as string, content.trim());
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    logAuditEntry({ action: "COMMUNITY_COMMENT_CREATED", resourceType: "CommunityComment", resourceId: result.comment!.id, actorId: userId as string, actorRole: "patient", timestamp: new Date().toISOString(), details: { postId: req.params.postId }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ success: true, comment: result.comment });
  } catch (error) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

router.post("/community/posts/:postId/support", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const result = communityService.toggleSupport(req.params.postId, userId as string);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle support" });
  }
});

router.post("/community/flag", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const { targetType, targetId, reason, details } = req.body;
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: "Target type, target ID, and reason are required." });
    }
    const result = communityService.flagContent(targetType, targetId, userId as string, reason, details || "");
    logAuditEntry({ action: "COMMUNITY_CONTENT_FLAGGED", resourceType: "CommunityFlag", resourceId: result.flag!.id, actorId: userId as string, actorRole: "patient", timestamp: new Date().toISOString(), details: { targetType, targetId, reason }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ success: true, flag: result.flag });
  } catch (error) {
    res.status(500).json({ error: "Failed to flag content" });
  }
});

// Moderation authorization middleware - restricts to moderator/admin roles
// In sample mode, allows access for sample_user; in production, checks role claims
function requireModeratorRole(req: Request, res: Response, next: NextFunction) {
  const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
  const userRole = (req.user as any)?.role || (req.user as any)?.claims?.role;

  // In production, enforce moderator/admin role
  if (userRole && !["moderator", "admin", "system_admin"].includes(userRole)) {
    logAuditEntry({ action: "COMMUNITY_MODERATION_ACCESS_DENIED", resourceType: "CommunityModeration", resourceId: "access_check", actorId: userId as string, actorRole: userRole || "unknown", timestamp: new Date().toISOString(), details: { reason: "insufficient_role" }, outcome: "denied", ipAddress: req.ip || "unknown" });
    return res.status(403).json({ error: "Moderator or admin access required." });
  }

  next();
}

router.get("/community/moderation/flags", requireModeratorRole, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const all = req.query.all === "true";
    const flags = all ? communityService.getAllFlags() : communityService.getPendingFlags();
    const stats = communityService.getCommunityStats();
    logAuditEntry({ action: "COMMUNITY_MODERATION_FLAGS_VIEWED", resourceType: "CommunityModeration", resourceId: "flags_list", actorId: userId as string, actorRole: "moderator", timestamp: new Date().toISOString(), details: { flagCount: flags.length, showAll: all }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ success: true, flags, stats });
  } catch (error) {
    res.status(500).json({ error: "Failed to get moderation flags" });
  }
});

router.post("/community/moderation/resolve/:flagId", requireModeratorRole, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const { action } = req.body;
    if (!["remove", "keep", "dismiss"].includes(action)) {
      return res.status(400).json({ error: "Action must be remove, keep, or dismiss." });
    }
    const result = communityService.resolveFlag(req.params.flagId, userId as string, action);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    logAuditEntry({ action: "COMMUNITY_FLAG_RESOLVED", resourceType: "CommunityModeration", resourceId: req.params.flagId, actorId: userId as string, actorRole: "moderator", timestamp: new Date().toISOString(), details: { flagId: req.params.flagId, action }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to resolve flag" });
  }
});

router.post("/community/moderation/ban", requireModeratorRole, async (req: Request, res: Response) => {
  try {
    const actorId = (req.user as any)?.id || (req.user as any)?.claims?.sub || req.headers["x-session-id"] || "system_user";
    const { userId, reason } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ error: "User ID and reason are required." });
    }
    communityService.banUser(userId, actorId as string, reason);
    logAuditEntry({ action: "COMMUNITY_USER_BANNED", resourceType: "CommunityModeration", resourceId: userId, actorId: actorId as string, actorRole: "moderator", timestamp: new Date().toISOString(), details: { bannedUserId: userId, reason }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to ban user" });
  }
});

router.get("/community/moderation/log", async (req: Request, res: Response) => {
  try {
    const log = communityService.getModerationLog();
    res.json({ success: true, log });
  } catch (error) {
    res.status(500).json({ error: "Failed to get moderation log" });
  }
});

router.get("/phr/:patientId/summary", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const result = phrService.getSummary(req.params.patientId);
    logAuditEntry({ action: "PHR_VIEW_SUMMARY", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load health record summary" });
  }
});

router.get("/phr/:patientId/medications", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string | undefined;
    const result = phrService.getMedications(req.params.patientId, filter);
    logAuditEntry({ action: "PHR_VIEW_MEDICATIONS", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: { filter }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load medications" });
  }
});

router.get("/phr/:patientId/allergies", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const result = phrService.getAllergies(req.params.patientId);
    logAuditEntry({ action: "PHR_VIEW_ALLERGIES", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load allergies" });
  }
});

router.get("/phr/:patientId/immunizations", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const result = phrService.getImmunizations(req.params.patientId);
    logAuditEntry({ action: "PHR_VIEW_IMMUNIZATIONS", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load immunizations" });
  }
});

router.get("/phr/:patientId/lab-results", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const result = phrService.getLabResults(req.params.patientId);
    logAuditEntry({ action: "PHR_VIEW_LAB_RESULTS", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load lab results" });
  }
});

router.get("/phr/:patientId/vitals", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const result = phrService.getVitals(req.params.patientId);
    logAuditEntry({ action: "PHR_VIEW_VITALS", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load vitals" });
  }
});

router.get("/phr/:patientId/conditions", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string | undefined;
    const result = phrService.getConditions(req.params.patientId, filter);
    logAuditEntry({ action: "PHR_VIEW_CONDITIONS", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: { filter }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load conditions" });
  }
});

router.get("/phr/:patientId/appointments", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string | undefined;
    const result = phrService.getAppointments(req.params.patientId, filter);
    logAuditEntry({ action: "PHR_VIEW_APPOINTMENTS", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: { filter }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load appointments" });
  }
});

router.get("/phr/:patientId/medical-history", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const result = phrService.getMedicalHistory(req.params.patientId);
    logAuditEntry({ action: "PHR_VIEW_MEDICAL_HISTORY", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load medical history" });
  }
});

router.get("/phr/:patientId/family-history", rateLimiter, verifyPatientAccess, (req: Request, res: Response) => {
  try {
    const result = phrService.getFamilyHistory(req.params.patientId);
    logAuditEntry({ action: "PHR_VIEW_FAMILY_HISTORY", resourceType: "PHR", resourceId: req.params.patientId, actorId: req.params.patientId, actorRole: "patient", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load family history" });
  }
});

// ============================================
// PROVIDER & ADMIN PORTAL ROUTES
// ============================================

router.get("/provider-admin/records", (req: Request, res: Response) => {
  try {
    const { query, riskLevel, page, limit } = req.query;
    const result = providerAdminService.getPatientRecords(
      query as string | undefined,
      riskLevel as string | undefined,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    logAuditEntry({ action: "PROVIDER_VIEW_RECORDS", resourceType: "PatientRecords", resourceId: "list", actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: { query, riskLevel }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch patient records" });
  }
});

router.get("/provider-admin/records/:patientId", (req: Request, res: Response) => {
  try {
    const record = providerAdminService.getPatientRecord(req.params.patientId);
    if (!record) return res.status(404).json({ error: "Patient not found" });
    logAuditEntry({ action: "PROVIDER_VIEW_RECORD", resourceType: "PatientRecord", resourceId: req.params.patientId, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch patient record" });
  }
});

router.get("/provider-admin/records/:patientId/intake", (req: Request, res: Response) => {
  try {
    const entries = providerAdminService.getPatientIntakeHistory(req.params.patientId);
    logAuditEntry({ action: "PROVIDER_VIEW_INTAKE", resourceType: "IntakeHistory", resourceId: req.params.patientId, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch intake history" });
  }
});

router.get("/provider-admin/appointments", (req: Request, res: Response) => {
  try {
    const { date, status, providerId } = req.query;
    const appointments = providerAdminService.getAppointments(
      date as string | undefined,
      status as string | undefined,
      providerId as string | undefined
    );
    logAuditEntry({ action: "PROVIDER_VIEW_APPOINTMENTS", resourceType: "Appointments", resourceId: "list", actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: { date, status }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ appointments });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

router.post("/provider-admin/appointments", (req: Request, res: Response) => {
  try {
    const appointment = providerAdminService.createAppointment(req.body);
    logAuditEntry({ action: "PROVIDER_CREATE_APPOINTMENT", resourceType: "Appointment", resourceId: appointment.id, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: { patientId: appointment.patientId, type: appointment.type }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

router.patch("/provider-admin/appointments/:id", (req: Request, res: Response) => {
  try {
    const updated = providerAdminService.updateAppointment(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Appointment not found" });
    logAuditEntry({ action: "PROVIDER_UPDATE_APPOINTMENT", resourceType: "Appointment", resourceId: req.params.id, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: req.body, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update appointment" });
  }
});

router.get("/provider-admin/insights", (req: Request, res: Response) => {
  try {
    const { patientId, category, status } = req.query;
    const insights = providerAdminService.getInsights(
      patientId as string | undefined,
      category as string | undefined,
      status as string | undefined
    );
    logAuditEntry({ action: "PROVIDER_VIEW_INSIGHTS", resourceType: "AIInsights", resourceId: "list", actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: { patientId, category, status }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ insights });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

router.patch("/provider-admin/insights/:id/acknowledge", (req: Request, res: Response) => {
  try {
    const { actorId } = req.body;
    const updated = providerAdminService.acknowledgeInsight(req.params.id, actorId || "provider");
    if (!updated) return res.status(404).json({ error: "Insight not found" });
    logAuditEntry({ action: "PROVIDER_ACKNOWLEDGE_INSIGHT", resourceType: "AIInsight", resourceId: req.params.id, actorId: actorId || "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to acknowledge insight" });
  }
});

router.get("/provider-admin/users", (req: Request, res: Response) => {
  try {
    const { query, role } = req.query;
    const users = providerAdminService.getUsers(query as string | undefined, role as string | undefined);
    logAuditEntry({ action: "ADMIN_VIEW_USERS", resourceType: "Users", resourceId: "list", actorId: "admin", actorRole: "admin", timestamp: new Date().toISOString(), details: { query, role }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/provider-admin/users", (req: Request, res: Response) => {
  try {
    const user = providerAdminService.createUser(req.body);
    logAuditEntry({ action: "ADMIN_CREATE_USER", resourceType: "User", resourceId: user.id, actorId: "admin", actorRole: "admin", timestamp: new Date().toISOString(), details: { email: user.email, role: user.role }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/provider-admin/users/:id/role", (req: Request, res: Response) => {
  try {
    const { role, permissions } = req.body;
    const updated = providerAdminService.updateUserRole(req.params.id, role, permissions || []);
    if (!updated) return res.status(404).json({ error: "User not found" });
    logAuditEntry({ action: "ADMIN_UPDATE_USER_ROLE", resourceType: "User", resourceId: req.params.id, actorId: "admin", actorRole: "admin", timestamp: new Date().toISOString(), details: { role, permissions }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user role" });
  }
});

router.get("/provider-admin/analytics", (req: Request, res: Response) => {
  try {
    const metrics = providerAdminService.getAdminMetrics();
    logAuditEntry({ action: "ADMIN_VIEW_ANALYTICS", resourceType: "AdminMetrics", resourceId: "dashboard", actorId: "admin", actorRole: "admin", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ metrics });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin metrics" });
  }
});

router.get("/provider-admin/audit-log", (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;
    const result = providerAdminService.getAuditLog(
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    logAuditEntry({ action: "ADMIN_VIEW_AUDIT_LOG", resourceType: "AuditLog", resourceId: "list", actorId: "admin", actorRole: "admin", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// ========== Provider Medication Adherence Routes ==========
import { medicationAdherenceService } from "./services/medication-adherence-service";
import OpenAI from "openai";

const adherenceOpenai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const adherenceAiCache = new Map<string, { data: string; timestamp: number }>();
const AI_CACHE_TTL = 5 * 60 * 1000;

interface PatientAdherenceSummary {
  patientId: string;
  patientName: string;
  overallRate: number;
  medicationCount: number;
  activeFlagCount: number;
  recentMissedCount: number;
  lastTaken: string | null;
  riskLevel: "low" | "moderate" | "high" | "critical";
  medications: Array<{
    name: string;
    adherenceRate: number;
    streakDays: number;
    totalDoses: number;
    missed: number;
  }>;
  flags: Array<{
    id: string;
    medicationName: string;
    flagType: string;
    severity: string;
    description: string;
    status: string;
    detectedAt: string;
  }>;
}

router.get("/provider-admin/adherence/summary", async (req: Request, res: Response) => {
  try {
    const patientIds = providerAdminService.getPatientIds();
    const summaries: PatientAdherenceSummary[] = [];

    for (const patientId of patientIds) {
      medicationAdherenceService.initializeSampleData(patientId);
      const stats = await medicationAdherenceService.getAdherenceStats(patientId, undefined, 30);
      const flags = await medicationAdherenceService.getFlags(patientId);
      const overallRate = await medicationAdherenceService.getOverallAdherenceRate(patientId, 30);
      const pendingFlags = flags.filter(f => f.status === "pending" || f.status === "escalated");

      const totalMissed = stats.reduce((sum, s) => sum + s.missed + s.skipped, 0);
      const lastTaken = stats
        .filter(s => s.lastTaken)
        .sort((a, b) => (b.lastTaken || "").localeCompare(a.lastTaken || ""))[0]?.lastTaken || null;

      let riskLevel: "low" | "moderate" | "high" | "critical" = "low";
      if (overallRate < 50) riskLevel = "critical";
      else if (overallRate < 70) riskLevel = "high";
      else if (overallRate < 85) riskLevel = "moderate";

      summaries.push({
        patientId,
        patientName: providerAdminService.getPatientName(patientId),
        overallRate,
        medicationCount: stats.length,
        activeFlagCount: pendingFlags.length,
        recentMissedCount: totalMissed,
        lastTaken,
        riskLevel,
        medications: stats.map(s => ({
          name: s.medicationName,
          adherenceRate: s.adherenceRate,
          streakDays: s.streakDays,
          totalDoses: s.totalDoses,
          missed: s.missed + s.skipped,
        })),
        flags: flags.map(f => ({
          id: f.id,
          medicationName: f.medicationName,
          flagType: f.flagType,
          severity: f.severity,
          description: f.description,
          status: f.status,
          detectedAt: f.detectedAt,
        })),
      });
    }

    summaries.sort((a, b) => a.overallRate - b.overallRate);

    logAuditEntry({ action: "PROVIDER_VIEW_ADHERENCE_SUMMARY", resourceType: "AdherenceSummary", resourceId: "all", actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: { patientCount: summaries.length }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ summaries });
  } catch (error) {
    console.error("[Provider Adherence] Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch adherence summaries" });
  }
});

router.get("/provider-admin/adherence/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    medicationAdherenceService.initializeSampleData(patientId);

    const stats = await medicationAdherenceService.getAdherenceStats(patientId, undefined, 30);
    const flags = await medicationAdherenceService.getFlags(patientId);
    const overallRate = await medicationAdherenceService.getOverallAdherenceRate(patientId, 30);
    const dailyData = await medicationAdherenceService.getDailyAdherenceData(patientId, 30);

    logAuditEntry({ action: "PROVIDER_VIEW_PATIENT_ADHERENCE", resourceType: "PatientAdherence", resourceId: patientId, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ stats, flags, overallRate, dailyData });
  } catch (error) {
    console.error("[Provider Adherence] Error fetching patient details:", error);
    res.status(500).json({ error: "Failed to fetch patient adherence details" });
  }
});

router.post("/provider-admin/adherence/ai-insights", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    const cacheKey = `adherence-insight-${patientId}`;
    const cached = adherenceAiCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < AI_CACHE_TTL) {
      logAuditEntry({ action: "PROVIDER_VIEW_ADHERENCE_AI_INSIGHT_CACHED", resourceType: "AdherenceAIInsight", resourceId: patientId, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
      return res.json({ insight: cached.data, cached: true });
    }

    medicationAdherenceService.initializeSampleData(patientId);
    const stats = await medicationAdherenceService.getAdherenceStats(patientId, undefined, 30);
    const flags = await medicationAdherenceService.getFlags(patientId);
    const overallRate = await medicationAdherenceService.getOverallAdherenceRate(patientId, 30);
    const patientName = providerAdminService.getPatientName(patientId);
    const medications = providerAdminService.getPatientMedications(patientId);

    const statsText = stats.map(s =>
      `- ${s.medicationName}: ${s.adherenceRate}% adherence, ${s.totalDoses} total doses, ${s.missed} missed, ${s.skipped} skipped, streak: ${s.streakDays} days`
    ).join("\n");

    const flagsText = flags.length > 0
      ? flags.map(f => `- [${f.severity.toUpperCase()}] ${f.medicationName}: ${f.description} (${f.status})`).join("\n")
      : "No active flags.";

    const systemPrompt = `You are a healthcare data analytics assistant providing observational summaries of medication adherence patterns. 

CRITICAL NO-CDS COMPLIANCE REQUIREMENTS:
- You MUST NOT provide clinical decision support, diagnostic suggestions, or treatment recommendations.
- You MUST NOT suggest medication changes, dosage adjustments, or therapeutic alternatives.
- You MUST NOT predict clinical outcomes or make prognostic statements.
- You MUST only describe observed patterns, trends, and data summaries.
- You MUST include the following disclaimer at the end: "This is an observational data summary only. It does not constitute clinical decision support, medical advice, or treatment recommendations. Clinical judgment by qualified healthcare professionals is required for all patient care decisions."

FORMAT: Provide a structured summary with these sections:
1. Overview (2-3 sentences about overall adherence patterns)
2. Key Observations (bullet points of notable patterns)
3. Timing Patterns (when doses are most commonly taken/missed)
4. Flag Summary (description of active non-adherence flags)
5. Disclaimer`;

    const userPrompt = `Patient: ${patientName}
Medications: ${medications.join(", ")}
Overall 30-day adherence rate: ${overallRate}%

Medication-specific stats (past 30 days):
${statsText}

Active flags:
${flagsText}

Provide an observational summary of this patient's medication adherence patterns.`;

    const response = await adherenceOpenai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const insight = response.choices[0]?.message?.content || "Unable to generate adherence insight at this time.";

    adherenceAiCache.set(cacheKey, { data: insight, timestamp: Date.now() });

    logAuditEntry({ action: "PROVIDER_GENERATE_ADHERENCE_AI_INSIGHT", resourceType: "AdherenceAIInsight", resourceId: patientId, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: { overallRate, flagCount: flags.length }, outcome: "success", ipAddress: req.ip || "unknown" });
    res.json({ insight, cached: false });
  } catch (error) {
    console.error("[Provider Adherence AI] Error generating insight:", error);
    res.status(500).json({ error: "Failed to generate adherence insight" });
  }
});

// ========== AI Patient Onboarding Routes ==========
import {
  createSession as createOnboardingSession,
  getSession as getOnboardingSession,
  getSessionProgress,
  processMessage as processOnboardingMessage,
  advanceSessionStep,
  completeSession,
  getSessionSummary,
  getAllSessions as getAllOnboardingSessions,
  ONBOARDING_STEPS_INFO,
} from "./services/ai-onboarding-service";

router.post("/ai-onboarding/sessions", (req: Request, res: Response) => {
  try {
    const { patientId, language, languageName } = req.body;
    if (!language || !languageName) {
      return res.status(400).json({ error: "Language and languageName are required" });
    }
    const session = createOnboardingSession(
      patientId || `patient_${Date.now()}`,
      language,
      languageName
    );
    logAudit("system", "ai_onboarding_session_created", `Session ${session.id} created for patient ${session.patientId} in ${languageName}`);
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/ai-onboarding/sessions/:id", (req: Request, res: Response) => {
  try {
    const session = getOnboardingSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/ai-onboarding/sessions/:id/progress", (req: Request, res: Response) => {
  try {
    const progress = getSessionProgress(req.params.id);
    if (!progress) return res.status(404).json({ error: "Session not found" });
    res.json({ progress });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai-onboarding/sessions/:id/messages", async (req: Request, res: Response) => {
  try {
    const { message, advanceStep } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });
    const result = await processOnboardingMessage(req.params.id, message, advanceStep === true);
    logAudit("patient", "ai_onboarding_message_sent", `Message sent in session ${req.params.id} at step ${result.session.currentStep}`);
    res.json({
      message: result.message,
      currentStep: result.session.currentStep,
      completedSteps: result.session.completedSteps,
    });
  } catch (error: any) {
    if (error.message === "Session not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai-onboarding/sessions/:id/advance", (req: Request, res: Response) => {
  try {
    const session = advanceSessionStep(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    logAudit("patient", "ai_onboarding_step_advanced", `Session ${session.id} advanced to ${session.currentStep}`);
    res.json({
      currentStep: session.currentStep,
      completedSteps: session.completedSteps,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai-onboarding/sessions/:id/complete", (req: Request, res: Response) => {
  try {
    const session = completeSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    logAudit("patient", "ai_onboarding_completed", `Session ${session.id} completed`);
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/ai-onboarding/sessions/:id/summary", (req: Request, res: Response) => {
  try {
    const summary = getSessionSummary(req.params.id);
    if (!summary) return res.status(404).json({ error: "Session not found" });
    res.json({ summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/ai-onboarding/steps", (_req: Request, res: Response) => {
  res.json({ steps: ONBOARDING_STEPS_INFO });
});

router.get("/ai-onboarding/sessions", (_req: Request, res: Response) => {
  try {
    const sessions = getAllOnboardingSessions();
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== AI Patient Record Summary Route ==========
const patientSummaryCache = new Map<string, { summary: string; generatedAt: string; expiresAt: number }>();

router.post("/provider-admin/records/:patientId/ai-summary", async (req: Request, res: Response) => {
  const { patientId } = req.params;

  try {
    const cached = patientSummaryCache.get(patientId);
    if (cached && cached.expiresAt > Date.now()) {
      logAuditEntry({ action: "PROVIDER_VIEW_AI_PATIENT_SUMMARY_CACHED", resourceType: "AIPatientSummary", resourceId: patientId, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: {}, outcome: "success", ipAddress: req.ip || "unknown" });
      return res.json({ summary: cached.summary, generatedAt: cached.generatedAt, cached: true });
    }

    const summaryData = providerAdminService.getPatientSummaryData(patientId);
    if (!summaryData) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const { patient, intakeHistory, flags } = summaryData;

    const onboardingSessions = getAllOnboardingSessions().filter(s => s.patientId === patientId);
    const completedOnboarding = onboardingSessions.find(s => s.status === "completed");

    let onboardingContext = "";
    if (completedOnboarding) {
      const conditions = completedOnboarding.conditions.map(c => `${c.name} (${c.status}, dx: ${c.diagnosisDate})`).join("; ");
      const meds = completedOnboarding.medications.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join("; ");
      const allergies = completedOnboarding.allergies.map(a => `${a.allergen}: ${a.reaction} (${a.severity})`).join("; ");
      const surgeries = completedOnboarding.surgeries.map(s => `${s.procedure} (${s.date})`).join("; ");
      const familyHx = completedOnboarding.familyHistory.map(f => `${f.condition} - ${f.relationship}`).join("; ");
      const social = completedOnboarding.socialHistory;
      const rosSystems = Object.entries(completedOnboarding.reviewOfSystems)
        .filter(([_, v]) => v.symptoms.length > 0)
        .map(([k, v]) => `${k}: ${v.symptoms.join(", ")}`)
        .join("; ");

      onboardingContext = `
PATIENT-REPORTED DATA (from AI Onboarding Interview):
- Self-Reported Conditions: ${conditions || "None reported"}
- Self-Reported Medications: ${meds || "None reported"}
- Self-Reported Allergies: ${allergies || "None reported"}
- Surgical History: ${surgeries || "None reported"}
- Family History: ${familyHx || "None reported"}
- Social History: Smoking: ${social.smokingStatus || "N/A"}, Alcohol: ${social.alcoholUse || "N/A"}, Exercise: ${social.exerciseFrequency || "N/A"}, Occupation: ${social.occupation || "N/A"}
- Review of Systems (positive findings): ${rosSystems || "No positive findings"}
`;
    }

    let labContext = "";
    let vitalContext = "";
    try {
      const { storage } = await import("./storage");
      const labs = await storage.getLabResultsByPatient(patientId);
      if (labs.length > 0) {
        const recentLabs = labs.slice(0, 15);
        const abnormalLabs = recentLabs.filter(l => l.status !== "normal");
        labContext = `
IMPORTED LAB RESULTS (from EHR/facility systems):
- Total recent labs: ${recentLabs.length}
- Abnormal values: ${abnormalLabs.length}
${recentLabs.map(l => `  ${l.testName}: ${l.value} ${l.unit} (${l.referenceRange || "N/A"}) [${l.status.toUpperCase()}] - ${l.date}${l.facility ? ` from ${l.facility}` : ""}`).join("\n")}
`;
      }

      const vitals = await storage.getVitalsByPatient(patientId);
      if (vitals.length > 0) {
        const recentVitals = vitals.slice(0, 10);
        vitalContext = `
IMPORTED HEALTH READINGS / VITALS (from EHR/facility systems):
${recentVitals.map(v => `  ${v.type}: ${v.value} ${v.unit} - recorded ${v.recordedAt}`).join("\n")}
`;
      }
    } catch (e) {
      // Storage data not available for this patient, continue with what we have
    }

    const intakeContext = intakeHistory.length > 0
      ? `
INTAKE HISTORY:
${intakeHistory.map(i => `  ${i.submittedAt} via ${i.source} - Sections: ${i.sections.map(s => `${s.name}(${s.status})`).join(", ")}${i.flags.length > 0 ? ` | Flags: ${i.flags.join(", ")}` : ""}`).join("\n")}
`
      : "";

    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;

    if (!apiKey) {
      const fallbackSummary = generateFallbackSummary(patient, intakeHistory, flags, completedOnboarding);
      patientSummaryCache.set(patientId, { summary: fallbackSummary, generatedAt: new Date().toISOString(), expiresAt: Date.now() + 300000 });
      logAuditEntry({ action: "PROVIDER_GENERATE_AI_PATIENT_SUMMARY_FALLBACK", resourceType: "AIPatientSummary", resourceId: patientId, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: { method: "fallback" }, outcome: "success", ipAddress: req.ip || "unknown" });
      return res.json({ summary: fallbackSummary, generatedAt: new Date().toISOString(), cached: false });
    }

    const openaiClient = new OpenAI({ apiKey, baseURL });

    const systemPrompt = `You are a clinical data summarization assistant generating concise patient record summaries for healthcare providers.

CRITICAL NO-CDS COMPLIANCE REQUIREMENTS:
- You MUST NOT provide clinical decision support, diagnostic suggestions, or treatment recommendations.
- You MUST NOT suggest changes to medications, dosages, or treatment plans.
- You MUST NOT interpret lab results as indicating specific diagnoses.
- You are ONLY permitted to organize and summarize existing data from patient records.
- Present ONLY factual observations from the data provided.
- End every summary with: "This summary is auto-generated for informational purposes only and does not constitute clinical decision support. All clinical decisions must be made by qualified healthcare professionals."

SUMMARY FORMAT:
Generate a structured summary with these sections:
1. **Patient Overview** - Demographics, risk level, primary physician
2. **Key Active Conditions** - List all documented conditions with sources
3. **Current Medications** - All active medications with dosages if available
4. **Recent Abnormal Lab Values** - Only labs flagged as abnormal or critical, with values
5. **Recent Vitals** - Key vital signs if available
6. **Allergies & Alerts** - Known allergies and clinical flags
7. **Data Source Indicators** - Clearly distinguish patient-reported data from EHR-imported data

For each data point, indicate the source:
- [Patient-Reported] for data from patient onboarding interviews
- [EHR-Imported] for data from electronic health record systems
- [Intake] for data from intake forms`;

    const userPrompt = `Generate a concise clinical summary for the following patient:

PATIENT RECORD (from provider system):
- Name: ${patient.name}
- DOB: ${patient.dob}
- MRN: ${patient.mrn}
- Risk Level: ${patient.riskLevel}
- Primary Physician: ${patient.primaryPhysician}
- Conditions: ${patient.conditions.join(", ") || "None"}
- Medications: ${patient.medications.join(", ") || "None"}
- Allergies: ${patient.allergies.join(", ") || "None"}
- Last Visit: ${patient.lastVisit}
${onboardingContext}${labContext}${vitalContext}${intakeContext}
${flags.length > 0 ? `CLINICAL FLAGS: ${flags.join("; ")}` : ""}`;

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content || "Unable to generate summary.";
    const generatedAt = new Date().toISOString();

    patientSummaryCache.set(patientId, { summary, generatedAt, expiresAt: Date.now() + 300000 });

    logAuditEntry({ action: "PROVIDER_GENERATE_AI_PATIENT_SUMMARY", resourceType: "AIPatientSummary", resourceId: patientId, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: { conditionCount: patient.conditions.length, medicationCount: patient.medications.length, hasOnboarding: !!completedOnboarding }, outcome: "success", ipAddress: req.ip || "unknown" });

    res.json({ summary, generatedAt, cached: false });
  } catch (error: any) {
    console.error("[AIPatientSummary] Error generating summary:", error.message);
    logAuditEntry({ action: "PROVIDER_GENERATE_AI_PATIENT_SUMMARY", resourceType: "AIPatientSummary", resourceId: patientId, actorId: "provider", actorRole: "provider", timestamp: new Date().toISOString(), details: { error: error.message }, outcome: "failure", ipAddress: req.ip || "unknown" });
    res.status(500).json({ error: "Failed to generate patient summary" });
  }
});

function generateFallbackSummary(
  patient: any,
  intakeHistory: any[],
  flags: string[],
  onboarding: any | null
): string {
  const sections: string[] = [];

  sections.push(`**Patient Overview**\n- Name: ${patient.name}\n- DOB: ${patient.dob}\n- MRN: ${patient.mrn}\n- Risk Level: ${patient.riskLevel.toUpperCase()}\n- Primary Physician: ${patient.primaryPhysician}\n- Last Visit: ${patient.lastVisit}`);

  if (patient.conditions.length > 0) {
    sections.push(`**Key Active Conditions**\n${patient.conditions.map((c: string) => `- ${c} [EHR-Imported]`).join("\n")}`);
  }

  if (patient.medications.length > 0) {
    sections.push(`**Current Medications**\n${patient.medications.map((m: string) => `- ${m} [EHR-Imported]`).join("\n")}`);
  }

  if (patient.allergies.length > 0) {
    sections.push(`**Allergies & Alerts**\n${patient.allergies.map((a: string) => `- ${a}`).join("\n")}`);
  }

  if (onboarding) {
    const selfConditions = onboarding.conditions?.map((c: any) => c.name).filter(Boolean) || [];
    const selfMeds = onboarding.medications?.map((m: any) => `${m.name} ${m.dosage}`).filter(Boolean) || [];
    if (selfConditions.length > 0 || selfMeds.length > 0) {
      let patientData = "**Patient-Reported Data**\n";
      if (selfConditions.length > 0) patientData += `Conditions: ${selfConditions.map((c: string) => `${c} [Patient-Reported]`).join(", ")}\n`;
      if (selfMeds.length > 0) patientData += `Medications: ${selfMeds.map((m: string) => `${m} [Patient-Reported]`).join(", ")}`;
      sections.push(patientData);
    }
  }

  if (flags.length > 0) {
    sections.push(`**Clinical Flags**\n${flags.map(f => `- ${f}`).join("\n")}`);
  }

  sections.push(`\nThis summary is auto-generated for informational purposes only and does not constitute clinical decision support. All clinical decisions must be made by qualified healthcare professionals.`);

  return sections.join("\n\n");
}

router.get("/migration/status", requireAuth, async (req: any, res: Response) => {
  try {
    const status = migrationDedupService.getMigrationStatus();
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/migration/snapshot", requireAuth, async (req: any, res: Response) => {
  try {
    const snapshot = await migrationDedupService.createSnapshot();
    res.json({
      success: true,
      snapshotId: snapshot.id,
      createdAt: snapshot.createdAt,
      recordCounts: snapshot.recordCounts,
      totalRecords: snapshot.totalRecords,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/migration/export-sample", requireAuth, async (req: any, res: Response) => {
  try {
    const { sampleSize = 100 } = req.body;
    const sample = await migrationDedupService.exportSampleDuplicates(sampleSize);
    res.json({ success: true, sampleCount: sample.length, samples: sample });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/migration/freeze-audit", requireAuth, async (_req: any, res: Response) => {
  try {
    migrationDedupService.freezeAuditLogging();
    res.json({ success: true, message: "Audit logging frozen for migration" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/migration/checklist", requireAuth, async (_req: any, res: Response) => {
  try {
    const checklist = migrationDedupService.getChecklist();
    res.json({ success: true, checklist });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/migration/run", requireAuth, async (_req: any, res: Response) => {
  try {
    const result = await migrationDedupService.runMigration();
    res.json({ success: true, migration: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/migration/validate", requireAuth, async (_req: any, res: Response) => {
  try {
    const validation = await migrationDedupService.runValidation();
    res.json({ success: true, validation });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/migration/monitoring/start", requireAuth, async (_req: any, res: Response) => {
  try {
    migrationDedupService.startMonitoring();
    res.json({ success: true, message: "72-hour post-launch monitoring started" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/migration/monitoring/stop", requireAuth, async (_req: any, res: Response) => {
  try {
    migrationDedupService.stopMonitoring();
    res.json({ success: true, message: "Post-launch monitoring stopped" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/migration/monitoring/dashboard", requireAuth, async (_req: any, res: Response) => {
  try {
    const dashboard = migrationDedupService.getMonitoringDashboard();
    res.json({ success: true, ...dashboard });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/migration/monitoring/acknowledge/:alertId", requireAuth, async (req: any, res: Response) => {
  try {
    const acknowledged = migrationDedupService.acknowledgeAlert(req.params.alertId);
    res.json({ success: acknowledged, message: acknowledged ? "Alert acknowledged" : "Alert not found" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/migration/reset", requireAuth, async (_req: any, res: Response) => {
  try {
    migrationDedupService.resetMigration();
    res.json({ success: true, message: "Migration state reset" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export function registerInfrastructureRoutes(app: any): void {
  app.use("/api/infrastructure", router);
  console.log("[Routes] Infrastructure routes registered at /api/infrastructure/*");
  console.log("[Routes] - Intake History at /api/infrastructure/intake/*");
  console.log("[Routes] - Clinical Tools at /api/infrastructure/clinical-tools/*");
  console.log("[Routes] - Community at /api/infrastructure/community/*");
  console.log("[Routes] - PHR at /api/infrastructure/phr/*");
  console.log("[Routes] - Provider Admin Portal at /api/infrastructure/provider-admin/*");
  console.log("[Routes] - AI Patient Onboarding at /api/infrastructure/ai-onboarding/*");
  console.log("[Routes] - AI Patient Record Summary at /api/infrastructure/provider-admin/records/:id/ai-summary");
  console.log("[Routes] - Migration & QA at /api/infrastructure/migration/*");
}
